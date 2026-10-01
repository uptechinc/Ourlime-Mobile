const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

test('startup preload hydrates only the Home feed', () => {
  const preloadService = read('lib/services/AppPreloadService.ts');

  assert.match(preloadService, /const homeQuery = \{ userId, scope: 'home' as const, filter: 'all' as const \};/);
  assert.match(preloadService, /await this\.feedService\.refresh\(homeQuery\)/);
  assert.doesNotMatch(preloadService, /buildTasks\(/);
  assert.doesNotMatch(preloadService, /limes:feeds|marketplace:first-page|feed:friends:all/);
});

test('preload coordinator does not cancel healthy work on normal renders', () => {
  const coordinator = read('components/providers/AppPreloadCoordinator.tsx');

  assert.match(coordinator, /return \(\) => clearTimeout\(timer\);/);
  assert.match(coordinator, /useEffect\(\(\) => \(\) => appPreloadService\.cancel\(\), \[\]\)/);
});
