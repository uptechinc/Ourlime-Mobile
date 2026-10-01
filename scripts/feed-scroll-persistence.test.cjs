const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'services', 'FeedResourceService.ts'), 'utf8');

test('feed scroll persistence is debounced instead of writing every scroll event', () => {
  assert.match(source, /const SCROLL_PERSIST_DELAY_MS = 750;/);
  assert.match(source, /private readonly pendingScrollOffsets = new Map<string, number>\(\);/);
  assert.match(source, /const existingTimer = this\.scrollPersistTimers\.get\(key\);/);
  assert.match(source, /if \(existingTimer\) clearTimeout\(existingTimer\);/);
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*this\.cacheService\.write\(/);
});
