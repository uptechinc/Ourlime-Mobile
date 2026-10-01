const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('legacy Lime migration exposes help without initializing Firebase', () => {
  const scriptPath = path.resolve(__dirname, 'migrate-legacy-limes.cjs');
  const result = spawnSync(process.execPath, [scriptPath, '--help'], {
    encoding: 'utf8',
    timeout: 5_000,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /Dry-run is the default/);
  assert.match(result.stdout, /--execute/);
  assert.doesNotMatch(result.stdout, /Firebase configuration error/);
});
