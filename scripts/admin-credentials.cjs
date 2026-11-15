#!/usr/bin/env node
/*
 * The Firebase admin key the release scripts use (GOOGLE_APPLICATION_CREDENTIALS). The key itself lives outside the
 * repo and is never committed; this only knows where it usually is on the release PC.
 *
 *   bun set      Saves GOOGLE_APPLICATION_CREDENTIALS for your Windows user (setx), so new terminals have it.
 *
 * `bun notify` and `bun run ota:publish` call useAdminCredentials(), so they also work in a terminal where it isn't set.
 * Another location: set OURLIME_ADMIN_KEY (or GOOGLE_APPLICATION_CREDENTIALS) to the key's path.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const DEFAULT_KEY_PATH = path.join(os.homedir(), 'keys', 'ourlime-admin.json.json');

function resolveKeyPath() {
  const candidates = [process.env.GOOGLE_APPLICATION_CREDENTIALS, process.env.OURLIME_ADMIN_KEY, DEFAULT_KEY_PATH].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

/** Points GOOGLE_APPLICATION_CREDENTIALS at the admin key for this process; returns the path, or null when none exists. */
function useAdminCredentials() {
  const keyPath = resolveKeyPath();
  if (keyPath) process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
  return keyPath;
}

function saveForUser() {
  const keyPath = resolveKeyPath();
  if (!keyPath) {
    console.error(`✖ No admin key found. Put it at ${DEFAULT_KEY_PATH}, or set OURLIME_ADMIN_KEY to its path and run again.`);
    process.exit(1);
  }
  if (process.platform !== 'win32') {
    console.log(`Add this to your shell profile:\n  export GOOGLE_APPLICATION_CREDENTIALS="${keyPath}"`);
    return;
  }
  execFileSync('setx', ['GOOGLE_APPLICATION_CREDENTIALS', keyPath], { stdio: 'inherit' });
  console.log(`✔ GOOGLE_APPLICATION_CREDENTIALS = ${keyPath}\n  Open a new terminal for it to take effect (bun notify and ota:publish find the key either way).`);
}

module.exports = { useAdminCredentials, DEFAULT_KEY_PATH };

if (require.main === module) saveForUser();
