const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const webRoot = path.resolve(mobileRoot, '..');
const outputPath = path.join(mobileRoot, 'docs', 'WEB-MOBILE-COMPLETE-INVENTORY.json');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const PAGE_FILE_NAMES = new Set(['page.tsx', 'not-found.tsx', 'loading.tsx', 'error.tsx']);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function walk(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  const results = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.expo') continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(absolutePath, predicate));
    else if (predicate(absolutePath)) results.push(absolutePath);
  }
  return results;
}

function relativeFiles(root, directory, predicate) {
  return walk(path.join(root, directory), predicate)
    .map((absolutePath) => toPosix(path.relative(root, absolutePath)))
    .sort((first, second) => first.localeCompare(second));
}

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function isWebPage(filePath) {
  return PAGE_FILE_NAMES.has(path.basename(filePath));
}

function normalizeWebPageRoute(filePath) {
  const withoutPrefix = filePath.replace(/^app\//, '');
  if (withoutPrefix === 'page.tsx') return '/';
  if (withoutPrefix === 'not-found.tsx') return '/404';
  if (withoutPrefix === 'loading.tsx') return '/(loading)';
  if (withoutPrefix === 'error.tsx') return '/(error)';
  return `/${withoutPrefix.replace(/\/(page|not-found|loading|error)\.tsx$/, '').replace(/\/(page|not-found|loading|error)\.ts$/, '')}`;
}

function normalizeMobileRoute(filePath) {
  const withoutPrefix = filePath.replace(/^app\//, '').replace(/\.tsx$/, '');
  if (withoutPrefix === 'index') return '/';
  if (withoutPrefix === '+not-found') return '/404';
  const segments = withoutPrefix
    .split('/')
    .filter((segment) => segment !== '_layout' && !/^\(.+\)$/.test(segment));
  if (segments.at(-1) === 'index') segments.pop();
  return `/${segments.join('/')}` || '/';
}

function resolveLocalImport(importerPath, specifier, root) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const unresolved = specifier.startsWith('@/')
    ? path.join(root, specifier.slice(2))
    : path.resolve(path.dirname(importerPath), specifier);
  const candidates = [
    unresolved,
    ...[...SOURCE_EXTENSIONS].map((extension) => `${unresolved}${extension}`),
    ...[...SOURCE_EXTENSIONS].map((extension) => path.join(unresolved, `index${extension}`)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

function getFileDependencies(entryPath, root) {
  const visited = new Set();
  const dependencies = new Set();
  const apiReferences = new Set();
  const queue = [entryPath];

  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (!currentPath || visited.has(currentPath)) continue;
    visited.add(currentPath);
    const source = fs.readFileSync(currentPath, 'utf8');
    const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(importPattern)) {
      const resolved = resolveLocalImport(currentPath, match[1], root);
      if (!resolved || resolved === entryPath) continue;
      dependencies.add(resolved);
      queue.push(resolved);
    }
    const endpointPattern = /['"`]((?:https?:\/\/[^'"`\s]+)?\/api\/[A-Za-z0-9_?&=./${}\[\]-]+)/g;
    for (const match of source.matchAll(endpointPattern)) apiReferences.add(match[1]);
  }

  const relativeDependencies = [...dependencies].map((absolutePath) => toPosix(path.relative(root, absolutePath))).sort();
  return {
    components: relativeDependencies.filter((filePath) => filePath.startsWith('components/')),
    types: relativeDependencies.filter((filePath) => filePath.startsWith('types/') || filePath.startsWith('lib/types/')),
    services: relativeDependencies.filter((filePath) => /(^|\/)(services?|helpers?|api)(\/|$)/i.test(filePath)),
    apiReferences: [...apiReferences].sort(),
  };
}

function getRouteFamily(route) {
  const firstSegment = route.split('/').filter(Boolean)[0];
  return firstSegment || 'home';
}

const webPages = relativeFiles(webRoot, 'app', isWebPage)
  .filter((filePath) => !filePath.startsWith('app/api/'));
const webApiRoutes = relativeFiles(webRoot, 'app/api', (filePath) => path.basename(filePath) === 'route.ts');
const webComponents = relativeFiles(webRoot, 'components', isSourceFile);
const webTypes = [
  ...relativeFiles(webRoot, 'types', isSourceFile),
  ...relativeFiles(webRoot, 'lib/types', isSourceFile),
].sort();

const mobileRouteFiles = relativeFiles(mobileRoot, 'app', (filePath) => path.extname(filePath) === '.tsx');
const mobileComponents = relativeFiles(mobileRoot, 'components', isSourceFile);
const mobileServices = relativeFiles(mobileRoot, 'lib/services', (filePath) => path.extname(filePath) === '.ts');
const mobileTypes = relativeFiles(mobileRoot, 'lib/types', (filePath) => path.extname(filePath) === '.ts');

const mobileRoutes = mobileRouteFiles
  .filter((filePath) => !filePath.endsWith('/_layout.tsx') && filePath !== 'app/_layout.tsx' && filePath !== 'app/+native-intent.tsx')
  .map((filePath) => ({ file: filePath, route: normalizeMobileRoute(filePath) }));

const webRouteDetails = webPages.map((filePath) => {
  const absolutePath = path.join(webRoot, filePath);
  return {
    file: filePath,
    route: normalizeWebPageRoute(filePath),
    family: getRouteFamily(normalizeWebPageRoute(filePath)),
    dependencies: getFileDependencies(absolutePath, webRoot),
  };
});

const inventory = {
  schemaVersion: 1,
  baselines: {
    webRoot: toPosix(webRoot),
    mobileRoot: toPosix(mobileRoot),
  },
  counts: {
    webPages: webPages.length,
    webApiRoutes: webApiRoutes.length,
    webComponents: webComponents.length,
    webTypes: webTypes.length,
    mobileRoutes: mobileRoutes.length,
    mobileComponents: mobileComponents.length,
    mobileServices: mobileServices.length,
    mobileTypes: mobileTypes.length,
  },
  web: {
    pages: webRouteDetails,
    apiRoutes: webApiRoutes,
    components: webComponents,
    types: webTypes,
  },
  mobile: {
    routes: mobileRoutes,
    components: mobileComponents,
    services: mobileServices,
    types: mobileTypes,
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`);

console.log(`Wrote ${toPosix(path.relative(mobileRoot, outputPath))}`);
console.log(JSON.stringify(inventory.counts, null, 2));
