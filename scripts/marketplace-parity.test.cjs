const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadPreferences() {
  let saved = null;
  const storage = { getItem: async () => saved, setItem: async (_key, value) => { saved = value; } };
  const filename = path.resolve(__dirname, '../lib/services/MarketplacePreferenceService.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })((specifier) => {
    if (specifier === '@react-native-async-storage/async-storage') return { default: storage, __esModule: true };
    throw new Error(`Unexpected dependency ${specifier}`);
  }, module, module.exports);
  return module.exports.marketplacePreferenceService;
}

test('market favorites and recent views persist without product mock data', async () => {
  const service = loadPreferences();
  assert.deepEqual(await service.read(), { favoriteIds: [], recentIds: [] });
  await service.toggleFavorite('product_one');
  await service.recordViewed('product_two');
  await service.recordViewed('product_one');
  assert.deepEqual(await service.read(), { favoriteIds: ['product_one'], recentIds: ['product_one', 'product_two'] });
  await service.toggleFavorite('product_one');
  assert.deepEqual((await service.read()).favoriteIds, []);
});

test('E-Hub is a distinct real-data storefront that routes products into Market', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../components/ehub/EHubScreen.tsx'), 'utf8');
  assert.match(source, /useMarketplaceCatalog/);
  assert.match(source, /\/market\?product=/);
  assert.doesNotMatch(source, /MarketplaceScreen entryPoint="ehub"/);
  assert.doesNotMatch(source, /PRODUCTS|FREELANCERS|HERO_DEALS/);
});

test('market screen exposes the web discovery controls and honest payment state', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../components/market/MarketplaceScreen.tsx'), 'utf8');
  for (const label of ['Recently viewed', 'Filter and sort', 'Favorites only', 'Delivery available', 'Pickup available', 'Choose a variant']) assert.match(source, new RegExp(label));
  assert.match(source, /Payments are unavailable/);
  assert.doesNotMatch(source, /order (was|has been) placed|payment successful/i);
});

test('market catalog keeps legacy approved web listings readable until migration', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../lib/services/MarketplaceService.ts'), 'utf8');
  assert.match(source, /if \(snapshot\.empty\)/);
  assert.match(source, /const status = typeof value\.status === 'string' \? value\.status : 'approved'/);
  assert.match(source, /status === 'approved' \|\| status === 'active'/);
  assert.match(source, /publishedVariantsSnapshot\.empty/);
  assert.match(source, /limit\(90\)/);
});
