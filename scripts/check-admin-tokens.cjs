/* eslint-env node */
// Fails when admin UI drifts from lib/admin/adminTokens.ts: raw hex colours or 800/900 font weights in
// components/admin and app/admin. See docs/ui-review/ADMIN_REDESIGN.md §4 step 9.
const fs = require('fs');
const path = require('path');

const ROOTS = ['components/admin', 'app/admin'];
const RULES = [
  { name: 'raw-hex', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'heavy-weight', pattern: /fontWeight:\s*['"]?(800|900)/ },
];

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });
}

const violations = [];
for (const file of ROOTS.flatMap((root) => listFiles(path.join(__dirname, '..', root)))) {
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) violations.push(`${path.relative(process.cwd(), file)}:${index + 1} ${rule.name}`);
    }
  });
}

if (violations.length > 0) {
  console.error(`[check-admin-tokens] Error: ${violations.length} violation(s)\n${violations.join('\n')}`);
  process.exit(1);
}
console.log('[check-admin-tokens] OK');
