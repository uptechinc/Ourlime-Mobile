const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadService(relativePath, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${source}\n})`, { filename })(
    (specifier) => {
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Unexpected dependency: ${specifier}`);
    }, module, module.exports,
  );
  return module.exports;
}

const dates = loadService('lib/services/ContentDateService.ts');
const authorization = loadService('lib/services/AuthorizationService.ts');

test('comment dates preserve Firestore, REST and ISO timestamps rather than displaying just now', () => {
  const milliseconds = Date.parse('2024-04-05T14:23:00Z');
  const dateService = dates.contentDateService;
  for (const value of [{ seconds: milliseconds / 1000 }, { _seconds: milliseconds / 1000 }, { toDate: () => new Date(milliseconds) }, new Date(milliseconds), milliseconds, milliseconds / 1000, '2024-04-05T14:23:00Z']) {
    assert.equal(dateService.toMilliseconds(value), milliseconds);
    assert.match(dateService.formatCommentDate(value), /2024/);
  }
  for (const value of [undefined, null, {}, 'invalid date']) assert.equal(dateService.formatCommentDate(value), 'Date unavailable');
  assert.equal(dateService.toMilliseconds({ seconds: 0 }), 0);
});

test('Coming Soon and Unavailable block standard roles while enabled and scoped roles still work', () => {
  const service = authorization.authorizationService;
  for (const role of ['user', 'premium']) {
    const state = service.resolve({ role });
    assert.equal(service.canAccessStatus('coming_soon', state), false);
    assert.equal(service.canAccessStatus('disabled', state), false);
    assert.equal(service.canAccessStatus('enabled', state), true);
  }
  assert.equal(service.canAccessStatus('admin_only', service.resolve({ role: 'tester' })), false);
  assert.equal(service.canAccessStatus('admin_only', service.resolve({ role: 'admin' })), true);
});

test('restricted parent settings apply to direct child URLs', () => {
  const service = loadService('lib/services/PageAccessService.ts', {
    'firebase/firestore': {}, '@/lib/firebaseConfig': { db: {} },
    '@/lib/pageAccess/PageRegistry': { getDefaultMobilePageSettings: () => [] },
    './AuthorizationService': authorization,
  }).pageAccessService;
  for (const status of ['coming_soon', 'disabled']) {
    const settings = [{ route: '/blogs', status }, { route: '/blogs/post', status: 'enabled' }];
    assert.equal(service.getDecision(settings, '/blogs/post?source=link', authorization.authorizationService.resolve({ role: 'user' })).canAccess, false);
  }
});

test('aliases, unresolved access and explicit staff preview share the same descendant decision', () => {
  const service = loadService('lib/services/PageAccessService.ts', {
    'firebase/firestore': {}, '@/lib/firebaseConfig': { db: {} },
    '@/lib/pageAccess/PageRegistry': { getDefaultMobilePageSettings: () => [] },
    './AuthorizationService': authorization,
  }).pageAccessService;
  const settings = [{ id: 'market', route: '/market', status: 'coming_soon', showPagePreview: true, showInNavigation: true }];
  const developer = authorization.authorizationService.resolve({ role: 'developer' });
  assert.equal(service.normalizeRoute('/ehub/product-1?source=deep-link'), '/market/product-1');
  assert.equal(service.getDecision(settings, '/ehub/product-1', developer, null, false).canRead, false);
  const preview = service.getDecision(settings, '/ehub/product-1', developer, '/market', true);
  assert.equal(preview.canRead, true); assert.equal(preview.canMutate, false); assert.equal(preview.isDeveloperPreview, true);
  assert.equal(service.getDecision(settings, '/market/product-1', authorization.authorizationService.resolve({ role: 'user' }), '/market', true).canRead, false);
});
