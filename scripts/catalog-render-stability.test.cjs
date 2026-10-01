const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

const originalConsoleError = console.error;
console.error = (...values) => {
  if (values[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer') return;
  originalConsoleError(...values);
};

global.IS_REACT_ACT_ENVIRONMENT = true;

function loadHook(relativePath, dependencies) {
  const filename = path.join(__dirname, '..', relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})', { filename })((name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error('Unexpected dependency ' + name);
  }, module, module.exports);
  return module.exports;
}

function externalStoreHook(state) {
  const listeners = new Set();
  const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
  const useStore = (selector) => React.useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
  return { useStore, notify: () => listeners.forEach((listener) => listener()) };
}

test('marketplace empty catalog snapshot remains stable across store notifications', async () => {
  const store = externalStoreHook({ catalogs: {} });
  const service = { key: () => 'all', hydrate: async () => {}, refresh: async () => {}, loadMore: async () => {}, cancel: () => {} };
  const { useMarketplaceCatalog } = loadHook('lib/hooks/useMarketplaceCatalog.ts', {
    react: React,
    '@/lib/services/MarketplaceResourceService': { marketplaceResourceService: service },
    '@/lib/store/useMarketplaceStore': { useMarketplaceStore: store.useStore },
  });
  let renders = 0;
  function Probe() { useMarketplaceCatalog(null, '', 'All'); renders += 1; return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Probe)); });
  await act(async () => { store.notify(); store.notify(); });
  assert.ok(renders <= 2, 'empty selector caused repeated renders: ' + renders);
  await act(async () => { renderer.unmount(); });
});

test('blog empty catalog snapshot remains stable across store notifications', async () => {
  const store = externalStoreHook({ ownerId: 'other', resource: { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null } });
  const service = { hydrate: async () => {}, refresh: async () => {}, loadMore: async () => {}, cancel: () => {} };
  const { useBlogCatalog } = loadHook('lib/hooks/useBlogCatalog.ts', {
    react: React,
    '@/lib/services/BlogCatalogResourceService': { blogCatalogResourceService: service },
    '@/lib/store/useBlogCatalogStore': { useBlogCatalogStore: store.useStore },
  });
  let renders = 0;
  function Probe() { useBlogCatalog(null); renders += 1; return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Probe)); });
  await act(async () => { store.notify(); store.notify(); });
  assert.ok(renders <= 2, 'empty selector caused repeated renders: ' + renders);
  await act(async () => { renderer.unmount(); });
});

test('E-Learning source contains no runtime sample fallbacks', () => {
  const service = fs.readFileSync(path.join(__dirname, '../lib/services/CourseService.ts'), 'utf8');
  const sources = [
    service,
    fs.readFileSync(path.join(__dirname, '../app/eLearning/index.tsx'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../app/eLearning/cxc.tsx'), 'utf8'),
  ].join('\\n');
  for (const forbidden of ['FALLBACK_COURSES', 'mockSchedules', 'CXC_SUBJECTS_DATA', 'mock-enr-']) {
    assert.equal(sources.includes(forbidden), false, 'found runtime sample marker ' + forbidden);
  }
});

test('marketplace hydration discards an incompatible cache and remains refreshable', async () => {
  const removed = [];
  const writes = [];
  const cache = {
    read: async () => ({ data: { products: [{ broken: true }] }, updatedAt: 1, isExpired: false }),
    remove: async (...keys) => { removed.push(keys); },
    write: async () => {},
  };
  let resource = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
  const store = {
    catalogs: {},
    setCatalog: (_key, next) => { resource = next; writes.push(next); },
  };
  const filename = path.join(__dirname, '../lib/services/MarketplaceResourceService.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})', { filename })((name) => {
    const dependencies = {
      './LocalCacheService': { LocalCacheService: { getInstance: () => cache } },
      './MarketplaceService': { marketplaceService: { catalog: async () => ({ products: [], cursor: null }) } },
      '@/lib/store/useMarketplaceStore': { useMarketplaceStore: { getState: () => ({ ...store, catalogs: { all: resource } }) } },
      '@/lib/types/serviceResults': { ServiceResultError: class ServiceResultError extends Error {} },
      './ReliabilityDecoderService': { reliabilityDecoder: { catalogPage: () => { throw new Error('Expected text in saved data.'); } } },
    };
    if (!(name in dependencies)) throw new Error('Unexpected dependency ' + name);
    return dependencies[name];
  }, module, module.exports);

  await module.exports.marketplaceResourceService.hydrate(null);
  assert.equal(removed.length, 1);
  assert.equal(resource.status, 'idle');
  assert.equal(writes.some((next) => next.status === 'hydrating'), true);
});

test('E-Learning and E-Projects reads use the verified JS session while native mutations stay gated', () => {
  const course = fs.readFileSync(path.join(__dirname, '../lib/services/CourseService.ts'), 'utf8');
  const project = fs.readFileSync(path.join(__dirname, '../lib/services/ProjectService.ts'), 'utf8');
  const courseReads = course.slice(course.indexOf('public async getOverview'), course.indexOf('public async enrollInCourse'));
  const projectReadStart = project.indexOf('public async listForCurrentUser');
  const projectMutationStart = project.indexOf('public async createProject', projectReadStart);
  assert.notEqual(projectReadStart, -1, 'ProjectService listForCurrentUser method was not found');
  assert.notEqual(projectMutationStart, -1, 'ProjectService createProject method was not found');
  const projectReads = project.slice(projectReadStart, projectMutationStart);
  assert.doesNotMatch(courseReads, /nativeSessionService\.ensure/);
  assert.doesNotMatch(projectReads, /nativeSessionService\.ensure/);
  assert.match(course.slice(course.indexOf('public async enrollInCourse')), /nativeSessionService\.ensure/);
  assert.match(project.slice(projectMutationStart), /nativeSessionService\.ensure/);
  assert.match(projectReads, /where\('memberUids', 'array-contains', userId\)/);
  assert.match(projectReads, /where\('ownerId', '==', userId\)/);
});

test('feature navigation keeps Market and E-Hub on distinct web-matching destinations', () => {
  const navigation = fs.readFileSync(path.join(__dirname, '../lib/navigation/AppNavigation.ts'), 'utf8');
  const expectedRoutes = [
    ['market', 'Market', '/market'],
    ['ehub', 'E-Hub', '/ehub'],
    ['elearning', 'E-Learning', '/eLearning'],
    ['projects', 'E-Projects', '/projectManagement'],
    ['jobs', 'Jobs', '/jobs'],
    ['blogs', 'Blogs', '/blogs'],
  ];
  for (const [id, label, route] of expectedRoutes) {
    assert.match(navigation, new RegExp(`id: '${id}', label: '${label}'.*route: '${route.replace('/', '\\/')}'`));
  }
});
