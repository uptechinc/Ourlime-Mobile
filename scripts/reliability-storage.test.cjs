const { test } = require('node:test');
const assert = require('node:assert/strict');
let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch {}
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(relativePath, dependencies) {
  const filename = path.join(__dirname, '..', relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })((name) => {
    if (name in dependencies) return dependencies[name];
    if (name === 'firebase/firestore') return {};
    if (name === '@/lib/firebaseConfig') return { auth: { currentUser: null }, db: {} };
    throw new Error(`Unexpected dependency ${name}`);
  }, module, module.exports);
  return module.exports;
}

if (!DatabaseSync) {
  test('SQLite tests require Node 22+ with node:sqlite (skipped in Bun)', { skip: true }, () => {});
  return;
}

function storageHarness() {
  const database = new DatabaseSync(':memory:');
  let failWrites = false;
  const sqlite = { execAsync: async (sql) => database.exec(sql), getFirstAsync: async (sql, ...args) => database.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql, ...args) => database.prepare(sql).all(...args), runAsync: async (sql, ...args) => { if (failWrites) throw new Error('Disk full'); return database.prepare(sql).run(...args); } };
  const work = load('lib/services/DurableWorkService.ts', { 'expo-sqlite': { openDatabaseAsync: async () => sqlite } }).durableWorkService;
  const decoder = load('lib/services/ReliabilityDecoderService.ts', {}).reliabilityDecoder;
  return { database, work, decoder, setFailWrites: (value) => { failWrites = value; } };
}
test('durable work uses real SQLite, survives service recreation, isolates accounts and rejects stale disk writes', async () => {
  const harness = storageHarness();
  const decode = (value) => { assert.equal(typeof value.text, 'string'); return value; };
  assert.equal(await harness.work.write('one', 'draft', 'id', { text: 'Unsaved work' }, 0), 1);
  assert.equal((await harness.work.read('one', 'draft', 'id', decode)).value.text, 'Unsaved work');
  const reopened = new harness.work.constructor();
  assert.equal((await reopened.read('one', 'draft', 'id', decode)).value.text, 'Unsaved work');
  assert.equal(await harness.work.read('two', 'draft', 'id', decode), null);
  await assert.rejects(harness.work.write('one', 'draft', 'id', { text: 'Stale' }, 0), /changed/);
  harness.setFailWrites(true);
  await assert.rejects(harness.work.write('one', 'draft', 'id', { text: 'Lost?' }, 1), /Disk full/);
  harness.setFailWrites(false);
  assert.equal((await harness.work.read('one', 'draft', 'id', decode)).value.text, 'Unsaved work');
  await assert.rejects(harness.work.remove('one', 'draft', 'id', 2), /preserved/);
  harness.database.close();
});
test('corrupt and future-version saved work is never silently discarded', async () => {
  const { database, work, decoder } = storageHarness();
  await work.write('one', 'cart', 'current', { malformed: true }, 0);
  await assert.rejects(work.read('one', 'cart', 'current', decoder.cart));
  assert.equal(database.prepare('SELECT count(*) AS count FROM durable_work').get().count, 1);
  database.exec('UPDATE durable_work SET schema_version = 9000');
  await assert.rejects(work.read('one', 'cart', 'current', decoder.cart), /preserved/);
  assert.equal(database.prepare('SELECT count(*) AS count FROM durable_work').get().count, 1);
  database.close();
});
test('catalog cache decoders reject malformed products and preserve stable cursors', () => {
  const { decoder, database } = storageHarness();
  const product = { id: 'product', title: 'Title', description: '', category: 'Home', images: [], sellerId: 'seller', sellerName: 'Store', sellerVerified: true, available: true, unavailableReason: null, variants: [{ id: 'variant', productId: 'product', label: 'Standard', price: 10, currency: 'CAD', stock: 2, available: true, image: null }] };
  const page = decoder.catalogPage({ products: [product], cursor: { search: 'ti', category: 'Home', title: 'title', id: 'product' } });
  assert.equal(page.products[0].variants[0].currency, 'CAD'); assert.equal(page.cursor.id, 'product');
  assert.throws(() => decoder.catalogPage({ products: [{ ...product, variants: [{ ...product.variants[0], stock: -1 }] }], cursor: null }), /revision or quantity/);
  const blog = decoder.blogPage({ items: [{ id: 'blog', title: 'Blog', excerpt: '', coverImage: '', author: { id: 'owner', name: 'Owner', avatar: '' }, category: 'News', categories: [], tags: [], readTime: 2, createdAt: '2026-01-01T00:00:00.000Z', likes: 1, comments: 2, engagement: { likes: 1, comments: 2 } }], cursor: { createdAtMillis: 1, id: 'blog' } });
  assert.equal(blog.items[0].id, 'blog'); assert.equal(blog.cursor.id, 'blog');
  database.close();
});
test('drafts preserve every task field and recover simultaneous edit versions', async () => {
  const { database, work, decoder } = storageHarness();
  let sequence = 0;
  const firestore = { collection: () => ({}), doc: () => ({ id: `id_${++sequence}` }) };
  const service = load('lib/services/ContentDraftService.ts', {
    '@/lib/firebaseConfig': { auth: { currentUser: { uid: 'one' } } }, './DurableWorkService': { durableWorkService: work }, './ReliabilityDecoderService': { reliabilityDecoder: decoder },
    './NativeSessionService': { nativeSessionService: { assertOwner: (uid) => assert.equal(uid, 'one') } }, './PageAccessService': { pageAccessService: { assertMutation() {} } },
    '@react-native-async-storage/async-storage': {}, 'firebase/firestore': firestore,
  }).contentDraftService;
  const payload = { title: 'Task', description: 'Keep notes', status: 'in-progress', priority: 'urgent', assignee: 'one', assignees: ['one', 'two'], dueDate: '2030-05-01', estimatedTime: 7, tags: ['real'] };
  const original = await service.create('one', 'task', payload, 'project1');
  const second = await service.create('one', 'task', { ...payload, title: 'Another' }, 'project1');
  await service.save({ ...original, payload: { ...payload, description: 'First device' } });
  const recovered = await service.save({ ...original, payload: { ...payload, description: 'Second device' } });
  assert.notEqual(recovered.id, original.id);
  assert.equal(recovered.conflictOf, original.id);
  const list = await service.list('one');
  assert.equal(list.length, 3);
  assert.deepEqual(list.find((draft) => draft.id === second.id).payload, { ...payload, title: 'Another' });
  database.close();
});
test('cart keeps variants separate, retains tombstones and does not show success after disk failure', async () => {
  const { database, work, decoder, setFailWrites } = storageHarness();
  let sequence = 0;
  const service = load('lib/services/CartSyncService.ts', { './DurableWorkService': { durableWorkService: work }, './ReliabilityDecoderService': { reliabilityDecoder: decoder },
    './NativeSessionService': { nativeSessionService: { assertOwner: (uid) => assert.equal(uid, 'one') } }, './ContentDraftService': { contentDraftService: { newId: async () => `operation_${++sequence}` } }, './PageAccessService': { pageAccessService: { assertMutation() {} } },
  }).cartSyncService;
  const product = { id: 'product', title: 'Product', available: true, images: [] };
  const variant = { id: 'small', productId: 'product', label: 'Small', price: 15, currency: 'CAD', stock: 5, available: true, image: null, colorName: null, colorCode: null, sizeName: 'Small', sku: null };
  await service.setQuantity('one', product, variant, 2);
  await service.setQuantity('one', product, { ...variant, id: 'large', label: 'Large' }, 3);
  assert.equal((await service.load('one')).lines.length, 2);
  await assert.rejects(service.setQuantity('one', product, variant, 6), /available quantity/);
  await service.setQuantity('one', product, variant, 0);
  assert.equal((await service.load('one')).lines.find((line) => line.variantId === 'small').removed, true);
  setFailWrites(true);
  await assert.rejects(service.setQuantity('one', product, variant, 1), /Disk full/);
  setFailWrites(false);
  assert.equal((await service.load('one')).lines.find((line) => line.variantId === 'small').removed, true);
  database.close();
});
test('checkout accepts international addresses without universal postal codes and rejects invalid contacts', () => {
  const { marketplaceService } = load('lib/services/MarketplaceService.ts', { './NativeSessionService': {}, './ReliabilityDecoderService': {}, '@/lib/constants/countries': load('lib/constants/countries.ts', {}), '@/lib/firebaseConfig': { db: {} }, 'firebase/firestore': {} });
  const contact = { name: 'Sample Person', email: 'person@example.test', phone: '+18685551234', country: 'TT', address: '1 Test Street', city: 'Port of Spain', postalCode: '' };
  marketplaceService.validateContact(contact);
  assert.throws(() => marketplaceService.validateContact({ ...contact, country: 'CA' }), /postal code/);
  assert.throws(() => marketplaceService.validateContact({ ...contact, country: 'ZZ' }), /country/);
  assert.throws(() => marketplaceService.validateContact({ ...contact, phone: '555' }), /international/);
  assert.throws(() => marketplaceService.validateContact({ ...contact, email: 'invalid' }), /valid email/);
});


test('seller resumption preserves a revised local form and adopts newer submitted revisions', () => {
  const { sellerVerificationService: service } = load('lib/services/SellerVerificationService.ts', {
    './NativeSessionService': {}, './DurableWorkService': {}, './ReliabilityDecoderService': {}, './ContentDraftService': {}, './PageAccessService': {}, './ContentDateService': {},
  });
  const local = { ownerId: 'one', revision: 2, status: 'draft', storeName: 'Unsaved revised name' };
  assert.equal(service.shouldAdoptRemote(local, { ...local, status: 'rejected', storeName: 'Old name' }), false);
  assert.equal(service.shouldAdoptRemote(local, { ...local, revision: 3, status: 'submitted' }), true);
  assert.equal(service.shouldAdoptRemote(local, { ...local, ownerId: 'two', revision: 3 }), false);
  assert.equal(service.shouldAdoptRemote({ ...local, status: 'submitted' }, { ...local, status: 'approved' }), true);
});


test('an authorized editor finishes its local draft flush after logout without granting another account access', async () => {
  const { database, work, decoder } = storageHarness(); let account = 'one'; let sequence = 0;
  const session = { assertOwner: (owner) => { if (owner !== account) throw new Error('Account changed'); } };
  const service = load('lib/services/ContentDraftService.ts', {
    '@/lib/firebaseConfig': { auth: { currentUser: { uid: 'one' } } }, './DurableWorkService': { durableWorkService: work }, './ReliabilityDecoderService': { reliabilityDecoder: decoder },
    './NativeSessionService': { nativeSessionService: session }, './PageAccessService': {}, '@react-native-async-storage/async-storage': {},
    'firebase/firestore': { collection: () => ({}), doc: () => ({ id: `id_${++sequence}` }) },
  }).contentDraftService;
  const draft = await service.create('one', 'blog', { title: 'Draft', type: 'blog', excerpt: '', content: 'Before', coverImage: '', categoryId: '', readTime: 0, tags: [], sources: [] });
  const writer = service.createLocalWriter('one'); account = 'two';
  await writer({ ...draft, payload: { ...draft.payload, content: 'Last keystroke before logout' } });
  assert.equal((await work.read('one', 'draft', draft.id, decoder.draft)).value.payload.content, 'Last keystroke before logout');
  assert.throws(() => service.createLocalWriter('one'), /Account changed/);
  await assert.rejects(service.list('one'), /Account changed/);
  await assert.rejects(writer({ ...draft, ownerId: 'two' }), /another account/);
  database.close();
});


test('project creation persists one destination before network access and retains it after lost acknowledgement', async () => {
  const harness = storageHarness(); const requests = []; const auth = { currentUser: { uid: 'one' } }; let sequence = 0; let loseResponse = true;
  const dependencies = {
    './DurableWorkService': { durableWorkService: harness.work }, './ReliabilityDecoderService': { reliabilityDecoder: harness.decoder },
    '@/lib/firebaseConfig': { auth }, './NativeSessionService': { nativeSessionService: { ensure: async () => {}, assertOwner: (uid) => { if (uid !== auth.currentUser?.uid) throw new Error('Account changed'); } } },
    './NativeTaskService': {}, './ContentDraftService': { contentDraftService: { newId: async () => `project_${++sequence}` } }, './PageAccessService': { pageAccessService: { assertMutation() {} } },
    '@react-native-async-storage/async-storage': {}, 'firebase/firestore': {}, '@/lib/services/AccountLifecycleVisibilityService': {},
    '@react-native-firebase/functions': { getFunctions: () => ({}), httpsCallable: () => async (request) => { requests.push(request); if (loseResponse) throw new Error('Lost acknowledgement'); return { data: {} }; } },
  };
  let service = load('lib/services/ProjectService.ts', dependencies).projectService;
  const input = { name: 'Reliable project', description: 'Keep this' };
  await assert.rejects(service.createProject(input), /Lost acknowledgement/);
  assert.equal(harness.database.prepare('SELECT count(*) AS count FROM durable_work').get().count, 1);
  service = load('lib/services/ProjectService.ts', dependencies).projectService; loseResponse = false;
  const [first, second] = await Promise.all([service.createProject(input), service.createProject(input)]);
  assert.equal(first, second); assert.equal(requests.length, 2); assert.equal(requests[0].projectId, requests[1].projectId); assert.equal(sequence, 1);
  assert.equal(harness.database.prepare('SELECT count(*) AS count FROM durable_work').get().count, 0);
  harness.setFailWrites(true);
  await assert.rejects(service.createProject({ ...input, name: 'Cannot save' }), /Disk full/); assert.equal(requests.length, 2);
  harness.database.close();
});
