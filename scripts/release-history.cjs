/* global __dirname */
/**
 * lib/releaseHistory.json: every published app release and OTA, newest first. The app bundles it ("What's new"
 * shows the newest entry for the running version; Settings → Release notes lists them all), the publish script
 * reads the app release's notes from it, and `npm run release:check` validates it before every release.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const historyPath = path.join(projectRoot, 'lib', 'releaseHistory.json');
const MAX_NOTES = 12;
const MAX_NOTE_LENGTH = 240;

function readAppVersion() {
  const app = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8')).expo;
  return { version: app.version, versionCode: app.android && app.android.versionCode };
}

function readHistory() {
  return JSON.parse(fs.readFileSync(historyPath, 'utf8')).releases;
}

/** Problems with the file, as readable lines; empty when it is valid and its newest entry matches app.json. */
function validateHistory(releases, appVersion) {
  const problems = [];
  if (!Array.isArray(releases) || releases.length === 0) return ['lib/releaseHistory.json has no releases.'];
  const ids = new Set();
  releases.forEach((release, index) => {
    const label = `releases[${index}] (${release && release.id})`;
    if (!release || typeof release !== 'object') { problems.push(`${label} is not an object.`); return; }
    if (typeof release.id !== 'string' || !release.id) problems.push(`${label}: id is missing.`);
    else if (ids.has(release.id)) problems.push(`${label}: id is used twice.`);
    ids.add(release.id);
    if (!/^\d+(\.\d+){0,3}$/.test(String(release.version))) problems.push(`${label}: version must look like 1.3.1.`);
    if (!Number.isSafeInteger(release.versionCode) || release.versionCode <= 0) problems.push(`${label}: versionCode must be a positive whole number.`);
    if (release.kind !== 'app' && release.kind !== 'ota') problems.push(`${label}: kind must be "app" or "ota".`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(release.date)) || Number.isNaN(Date.parse(release.date))) problems.push(`${label}: date must be YYYY-MM-DD.`);
    const notes = Array.isArray(release.notes) ? release.notes : [];
    if (notes.length === 0) problems.push(`${label}: notes are empty.`);
    if (notes.length > MAX_NOTES) problems.push(`${label}: ${notes.length} notes, the most is ${MAX_NOTES}.`);
    notes.forEach((note, noteIndex) => {
      if (typeof note !== 'string' || !note.trim()) problems.push(`${label}: note ${noteIndex + 1} is empty.`);
      else if (note.length > MAX_NOTE_LENGTH) problems.push(`${label}: note ${noteIndex + 1} is ${note.length} characters, the most is ${MAX_NOTE_LENGTH}.`);
    });
    const newer = releases[index - 1];
    if (newer && (newer.versionCode < release.versionCode || String(newer.date) < String(release.date))) {
      problems.push(`${label} is newer than the entry above it; keep the newest release first.`);
    }
  });
  const newest = releases[0];
  if (appVersion && (newest.version !== appVersion.version || newest.versionCode !== appVersion.versionCode)) {
    problems.push(`The newest entry is ${newest.version} (${newest.versionCode}) but app.json is ${appVersion.version} (${appVersion.versionCode}). Add this release at the top.`);
  }
  return problems;
}

/** The notes of the app release (not an OTA) for this build, for siteConfig/mobileApp. */
function readAppReleaseNotes(appVersion) {
  const release = readHistory().find((entry) => entry.kind === 'app' && entry.versionCode === appVersion.versionCode);
  if (!release) return null;
  return release.notes.map((note) => String(note).trim()).filter(Boolean).slice(0, MAX_NOTES);
}

module.exports = { historyPath, readAppVersion, readHistory, validateHistory, readAppReleaseNotes };

if (require.main === module) {
  const problems = validateHistory(readHistory(), readAppVersion());
  if (problems.length) {
    console.error('Release notes check failed:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
  const [newest] = readHistory();
  console.log(`Release notes OK: newest is ${newest.kind === 'ota' ? 'OTA' : 'app release'} ${newest.version} (${newest.versionCode}), ${newest.date}, ${newest.notes.length} notes.`);
}
