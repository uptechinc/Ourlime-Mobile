#!/usr/bin/env node
/*
 * Publishes a quick update (EAS Update, JavaScript only) to production and announces it, so installed apps show
 * the mandatory "An update is ready" sheet and every Android phone gets an "Ourlime update available" push
 * (notifyAppUpdate in ../functions, once per update group).
 *
 *   node scripts/publish-ota.cjs --message "Short summary"      publish, then announce
 *   node scripts/publish-ota.cjs --group <update group id>      announce a group that is already published
 *   add --dry-run to print what would happen without publishing or writing anything
 *
 * Before publishing: add an "ota" entry at the top of lib/releaseHistory.json (the app-release skill); this script
 * refuses if `npm run release:check` fails or the newest entry isn't an OTA for this app version.
 *
 * Needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key with Firestore access (never commit it).
 * firebase-admin is loaded from ../functions/node_modules. It writes siteConfig/mobileApp.latestOta only.
 */
const path = require('path');
const { execSync } = require('child_process');
const releaseHistory = require('./release-history.cjs');

const projectRoot = path.resolve(__dirname, '..');

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function readArgs() {
  const args = process.argv.slice(2);
  const valueOf = (name) => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
  };
  return { message: valueOf('--message'), group: valueOf('--group'), isDryRun: args.includes('--dry-run') };
}

/** EAS prints progress around the JSON; take the outermost array. */
function parseUpdates(output) {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start < 0 || end <= start) fail('EAS did not return update details (JSON).');
  const updates = JSON.parse(output.slice(start, end + 1));
  if (!Array.isArray(updates) || updates.length === 0) fail('EAS returned no updates.');
  return updates;
}

function runEas(command) {
  return execSync(command, { cwd: projectRoot, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });
}

function toLatestOta(updates, message) {
  const groupId = updates[0].group;
  const runtimeVersion = updates[0].runtimeVersion;
  const android = updates.find((update) => update.platform === 'android');
  const ios = updates.find((update) => update.platform === 'ios');
  if (!groupId || !runtimeVersion) fail('The update has no group or runtime version.');
  return {
    groupId,
    runtimeVersion,
    androidUpdateId: android ? android.id : '',
    iosUpdateId: ios ? ios.id : '',
    message: message || updates[0].message || '',
  };
}

function loadFirebaseAdmin() {
  for (const base of [projectRoot, path.join(projectRoot, '..', 'functions')]) {
    try {
      const load = (id) => require(require.resolve(id, { paths: [base] }));
      return { app: load('firebase-admin/app'), firestore: load('firebase-admin/firestore') };
    } catch {
      // Try the next location.
    }
  }
  return null;
}

async function main() {
  const { message, group, isDryRun } = readArgs();
  if (!message && !group) fail('Pass --message "Short summary" to publish, or --group <id> to announce an existing update.');

  const appVersion = releaseHistory.readAppVersion();
  const releases = releaseHistory.readHistory();
  const problems = releaseHistory.validateHistory(releases, appVersion);
  if (problems.length) fail(`Release notes check failed:\n- ${problems.join('\n- ')}`);
  if (releases[0].kind !== 'ota') fail('The newest entry in lib/releaseHistory.json is not an "ota" entry. Add one for this update first.');

  const admin = loadFirebaseAdmin();
  if (!isDryRun && (!admin || !process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    fail(!admin ? 'firebase-admin was not found (run `bun install` in ../functions).' : 'GOOGLE_APPLICATION_CREDENTIALS is not set.');
  }

  let updates;
  if (group) {
    updates = parseUpdates(runEas(`npx --yes eas-cli@latest update:view ${group} --json`));
  } else if (isDryRun) {
    console.log(`Would run: eas update --channel production --environment production --message "${message}"`);
    return;
  } else {
    const safeMessage = message.replace(/"/g, "'");
    console.log('Publishing to EAS: bundling Android and iOS takes 5–15 minutes and prints nothing until it finishes. Leave this window open.');
    updates = parseUpdates(runEas(`npx --yes eas-cli@latest update --channel production --environment production --message "${safeMessage}" --json --non-interactive`));
  }

  const latestOta = toLatestOta(updates, message);
  if (latestOta.runtimeVersion !== appVersion.version) {
    fail(`Update ${latestOta.groupId} targets runtime ${latestOta.runtimeVersion}, but app.json is ${appVersion.version}.`);
  }
  console.log('\nQuick update');
  console.log(`  group            ${latestOta.groupId}`);
  console.log(`  runtime          ${latestOta.runtimeVersion}`);
  console.log(`  android update   ${latestOta.androidUpdateId || '(none)'}`);
  console.log(`  notes            ${releases[0].notes.join(' | ')}`);
  if (isDryRun) {
    console.log('\nDry run: nothing written.');
    return;
  }

  admin.app.initializeApp({ credential: admin.app.applicationDefault() });
  const database = admin.firestore.getFirestore();
  await database.doc('siteConfig/mobileApp').set(
    { latestOta: { ...latestOta, publishedAt: admin.firestore.FieldValue.serverTimestamp() } },
    { merge: true },
  );
  console.log('\n✔ Announced. Open apps on this version show the update sheet; notifyAppUpdate sends the push (once per update).');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
