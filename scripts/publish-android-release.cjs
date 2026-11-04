#!/usr/bin/env node
/*
 * Announces a new production (Play, com.ourlime.mobile) release to installed apps (docs/app-updates/RELEASING.md).
 * Run it only after the release is live on Play: it sets latestVersion/latestVersionCode, the notes and the Play
 * link, so open apps show "Update available" (opening the Play listing) and notifyAppUpdate sends the push.
 *
 *   node scripts/publish-android-release.cjs --dry-run
 *   node scripts/publish-android-release.cjs
 *
 * Options:
 *   --dry-run                 Print what would change; write nothing.
 *   --sideload --apk <path>   Legacy: upload a sideload APK (com.ourlime.app) instead. Not used for releases.
 *   --notes "a|b|c"           Release notes, one line per "|" (or --notes-file <path>, one note per line).
 *                             Default: this build's app release in lib/releaseHistory.json (also shown in "What's new").
 *   --minimum-version <x.y.z> Also raise siteConfig/mobileApp.minimumVersion (blocks older builds). Use with care.
 *   --ota-available           Set the otaAvailable hint.
 *
 * Needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key with Storage + Firestore access (never commit
 * it). firebase-admin is loaded from ../functions/node_modules. This script never reads .env.
 *
 * Safety: refuses unless the APK's own versionCode and package match app.json, and its versionCode is greater than
 * siteConfig/mobileApp.latestVersionCode. The SHA-256 and size it publishes are what the app checks before installing.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const releaseHistory = require('./release-history.cjs');

const projectRoot = path.resolve(__dirname, '..');
const PACKAGE_NAME = 'com.ourlime.app';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.ourlime.mobile';
const STORAGE_PREFIX = 'app-releases/android';

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function readArguments(argv) {
  const options = { dryRun: false, sideload: false, apk: null, notes: [], minimumVersion: null, otaAvailable: false };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    const next = () => {
      const value = argv[++index];
      if (value === undefined) fail(`${argument} needs a value.`);
      return value;
    };
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--sideload') options.sideload = true;
    else if (argument === '--apk') options.apk = path.resolve(next());
    else if (argument === '--notes') options.notes = next().split('|');
    else if (argument === '--notes-file') options.notes = fs.readFileSync(path.resolve(next()), 'utf8').split(/\r?\n/);
    else if (argument === '--minimum-version') options.minimumVersion = next();
    else if (argument === '--ota-available') options.otaAvailable = true;
    else fail(`Unknown option ${argument}`);
  }
  if (options.apk && !options.sideload) fail('--apk is only for --sideload. Production releases ship through Play.');
  options.notes = options.notes.map((note) => note.trim()).filter(Boolean).slice(0, 12);
  if (options.minimumVersion && !/^\d+(\.\d+){0,3}$/.test(options.minimumVersion)) fail('--minimum-version must look like 1.2.0');
  return options;
}

function readAppConfig() {
  const app = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8')).expo;
  const version = app.version;
  const versionCode = app.android && app.android.versionCode;
  if (!/^\d+(\.\d+){0,3}$/.test(String(version))) fail('app.json expo.version is missing or not like 1.2.0');
  if (!Number.isSafeInteger(versionCode) || versionCode <= 0) fail('app.json expo.android.versionCode is missing');
  return { version, versionCode };
}

/** This build's app release in lib/releaseHistory.json, which must be valid (the app shows the same notes). */
function readBundledNotes(appConfig) {
  const problems = releaseHistory.validateHistory(releaseHistory.readHistory(), null);
  if (problems.length) fail(`lib/releaseHistory.json: ${problems.join(' ')}`);
  const notes = releaseHistory.readAppReleaseNotes(appConfig);
  if (!notes) fail(`lib/releaseHistory.json has no app release for ${appConfig.version} (${appConfig.versionCode}). Add it at the top, or pass --notes.`);
  return notes;
}

function readFirebaseProject() {
  const services = JSON.parse(fs.readFileSync(path.join(projectRoot, 'google-services.json'), 'utf8'));
  return { projectId: services.project_info.project_id, bucket: services.project_info.storage_bucket };
}

/** Newest release APK (not -debug) from the repo root or the Gradle output folder. */
function findNewestApk() {
  const folders = [projectRoot, path.join(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release')];
  const candidates = folders.flatMap((folder) => (fs.existsSync(folder) ? fs.readdirSync(folder) : [])
    .filter((name) => /^Ourlime-.*\.apk$/.test(name) && !name.endsWith('-debug.apk'))
    .map((name) => path.join(folder, name)));
  if (candidates.length === 0) fail('No release Ourlime-*.apk found. Build one with `npm run build:local` or pass --apk.');
  return candidates.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
}

function sha256Of(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex')));
  });
}

function findBuildTool(toolName) {
  const sdkRoots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'), path.join(os.homedir(), 'Library', 'Android', 'sdk'), path.join(os.homedir(), 'Android', 'Sdk')]
    .filter(Boolean);
  for (const sdkRoot of sdkRoots) {
    const buildTools = path.join(sdkRoot, 'build-tools');
    if (!fs.existsSync(buildTools)) continue;
    const versions = fs.readdirSync(buildTools).sort().reverse();
    for (const version of versions) {
      for (const candidate of [toolName, `${toolName}.exe`, `${toolName}.bat`]) {
        const toolPath = path.join(buildTools, version, candidate);
        if (fs.existsSync(toolPath)) return toolPath;
      }
    }
  }
  return null;
}

/** JAVA_HOME, then Android Studio's bundled runtime (where apksigner.bat itself looks). */
function findJava() {
  const executable = process.platform === 'win32' ? 'java.exe' : 'java';
  const homes = [process.env.JAVA_HOME, 'C:/Program Files/Android/Android Studio/jbr', path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Android Studio', 'jbr')].filter(Boolean);
  for (const home of homes) {
    const javaPath = path.join(home, 'bin', executable);
    if (fs.existsSync(javaPath)) return javaPath;
  }
  return null;
}

/** Package, versionCode and signing certificate read from the APK itself (Android SDK build-tools). */
function inspectApk(apkPath) {
  const aapt2 = findBuildTool('aapt2');
  const apksigner = findBuildTool('apksigner');
  if (!aapt2 || !apksigner) fail('Android SDK build-tools (aapt2, apksigner) not found. Set ANDROID_HOME.');
  const badging = execFileSync(aapt2, ['dump', 'badging', apkPath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const packageLine = badging.split(/\r?\n/).find((line) => line.startsWith('package:')) || '';
  const packageName = (packageLine.match(/name='([^']+)'/) || [])[1];
  const versionCode = Number((packageLine.match(/versionCode='(\d+)'/) || [])[1]);
  const versionName = (packageLine.match(/versionName='([^']+)'/) || [])[1];
  // On Windows apksigner is a .bat: run its jar with Java directly (or the .bat through cmd.exe) instead of shell: true.
  const signerJar = path.join(path.dirname(apksigner), 'lib', 'apksigner.jar');
  const java = findJava();
  const signerArguments = ['verify', '--print-certs', apkPath];
  const [signerCommand, commandArguments] = !apksigner.endsWith('.bat')
    ? [apksigner, signerArguments]
    : java && fs.existsSync(signerJar)
      ? [java, ['-jar', signerJar, ...signerArguments]]
      : ['cmd.exe', ['/d', '/c', apksigner, ...signerArguments]];
  const certificates = execFileSync(signerCommand, commandArguments, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const signingCertSha256 = (certificates.match(/certificate SHA-256 digest: ([a-f0-9]{64})/) || [])[1];
  return { packageName, versionCode, versionName, signingCertSha256 };
}

function loadFirebaseAdmin() {
  // This project, then the Cloud Functions workspace next to it.
  for (const base of [projectRoot, path.join(projectRoot, '..', 'functions')]) {
    try {
      const load = (id) => require(require.resolve(id, { paths: [base] }));
      return { app: load('firebase-admin/app'), firestore: load('firebase-admin/firestore'), storage: load('firebase-admin/storage') };
    } catch {
      // Try the next location.
    }
  }
  return null;
}

/** Production: no upload; the Play listing is the download. sideloadUpdates false sends every build to the store. */
async function publishPlayRelease(options, appConfig, firebaseProject) {
  const nextFields = {
    latestVersion: appConfig.version,
    latestVersionCode: appConfig.versionCode,
    releaseNotes: options.notes,
    androidStoreUrl: PLAY_STORE_URL,
    sideloadUpdates: false,
    ...(options.otaAvailable ? { otaAvailable: true } : {}),
    ...(options.minimumVersion ? { minimumVersion: options.minimumVersion } : {}),
  };
  console.log('Production release (Play)');
  console.log(`  version          ${appConfig.version} (versionCode ${appConfig.versionCode})`);
  console.log(`  store link       ${PLAY_STORE_URL}`);
  console.log(`  notes            ${options.notes.length ? options.notes.join(' | ') : '(none)'}`);

  const admin = loadFirebaseAdmin();
  if (!admin || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const reason = !admin ? 'firebase-admin was not found (run `bun install` in ../functions)' : 'GOOGLE_APPLICATION_CREDENTIALS is not set';
    if (options.dryRun) {
      console.log(`\n(dry run) Skipping the Firestore comparison: ${reason}.`);
      console.log(JSON.stringify({ ...nextFields, releasedAt: '<server timestamp>' }, null, 2));
      return;
    }
    fail(`Cannot publish: ${reason}.`);
  }
  admin.app.initializeApp({ credential: admin.app.applicationDefault(), projectId: firebaseProject.projectId });
  const database = admin.firestore.getFirestore();
  const configReference = database.doc('siteConfig/mobileApp');
  const current = (await configReference.get()).data() || {};
  const currentCode = Number.isSafeInteger(current.latestVersionCode) ? current.latestVersionCode : 0;
  console.log(`\nFirestore latestVersionCode now: ${currentCode || '(none)'}`);
  if (appConfig.versionCode <= currentCode) fail(`versionCode ${appConfig.versionCode} is not greater than the published ${currentCode}.`);
  console.log('\nsiteConfig/mobileApp changes:');
  Object.entries(nextFields).forEach(([key, value]) => {
    const before = JSON.stringify(current[key]);
    const after = JSON.stringify(value);
    if (before !== after) console.log(`  ${key}: ${before ?? '(unset)'} → ${after}`);
  });
  if (options.dryRun) {
    console.log('\n(dry run) Nothing was written.');
    return;
  }
  await database.runTransaction(async (transaction) => {
    const latest = (await transaction.get(configReference)).data() || {};
    const latestCode = Number.isSafeInteger(latest.latestVersionCode) ? latest.latestVersionCode : 0;
    if (appConfig.versionCode <= latestCode) throw new Error(`Someone published versionCode ${latestCode} meanwhile.`);
    transaction.set(configReference, { ...nextFields, releasedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  console.log(`\n✔ Announced Ourlime ${appConfig.version} (${appConfig.versionCode}). Open apps see it within seconds; notifyAppUpdate sends the push.`);
}

async function main() {
  const options = readArguments(process.argv.slice(2));
  const appConfig = readAppConfig();
  if (options.notes.length === 0) options.notes = readBundledNotes(appConfig);
  const firebaseProject = readFirebaseProject();
  if (!options.sideload) return publishPlayRelease(options, appConfig, firebaseProject);
  const apkPath = options.apk || findNewestApk();
  if (!fs.existsSync(apkPath)) fail(`APK not found: ${apkPath}`);

  console.log(`APK: ${apkPath}`);
  const apk = inspectApk(apkPath);
  if (apk.packageName !== PACKAGE_NAME) fail(`The APK is ${apk.packageName}, not ${PACKAGE_NAME}.`);
  if (apk.versionCode !== appConfig.versionCode) {
    fail(`The APK's versionCode (${apk.versionCode}) doesn't match app.json (${appConfig.versionCode}). Rebuild after bumping the version.`);
  }
  if (apk.versionName !== appConfig.version) {
    fail(`The APK's versionName (${apk.versionName}) doesn't match app.json (${appConfig.version}).`);
  }
  const sizeBytes = fs.statSync(apkPath).size;
  console.log('Computing SHA-256…');
  const sha256 = await sha256Of(apkPath);
  const destination = `${STORAGE_PREFIX}/${appConfig.versionCode}/Ourlime.apk`;
  const apkUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseProject.bucket}/o/${encodeURIComponent(destination)}?alt=media`;

  const nextFields = {
    latestVersion: appConfig.version,
    latestVersionCode: appConfig.versionCode,
    apkUrl,
    apkSha256: sha256,
    apkSizeBytes: sizeBytes,
    releaseNotes: options.notes,
    sideloadUpdates: true,
    ...(options.otaAvailable ? { otaAvailable: true } : {}),
    ...(options.minimumVersion ? { minimumVersion: options.minimumVersion } : {}),
  };

  console.log('\nRelease');
  console.log(`  version          ${appConfig.version} (versionCode ${appConfig.versionCode})`);
  console.log(`  size             ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`  sha256           ${sha256}`);
  console.log(`  signing cert     ${apk.signingCertSha256 || 'unknown'}`);
  console.log(`  upload to        gs://${firebaseProject.bucket}/${destination}`);
  console.log(`  notes            ${options.notes.length ? options.notes.join(' | ') : '(none)'}`);

  const admin = loadFirebaseAdmin();
  const hasCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!admin || !hasCredentials) {
    const reason = !admin ? 'firebase-admin was not found (run `bun install` in ../functions)' : 'GOOGLE_APPLICATION_CREDENTIALS is not set';
    if (options.dryRun) {
      console.log(`\n(dry run) Skipping the Firestore comparison: ${reason}.`);
      console.log('\nsiteConfig/mobileApp would be merged with:');
      console.log(JSON.stringify({ ...nextFields, releasedAt: '<server timestamp>' }, null, 2));
      return;
    }
    fail(`Cannot publish: ${reason}.`);
  }

  admin.app.initializeApp({ credential: admin.app.applicationDefault(), projectId: firebaseProject.projectId, storageBucket: firebaseProject.bucket });
  const database = admin.firestore.getFirestore();
  const configReference = database.doc('siteConfig/mobileApp');
  const current = (await configReference.get()).data() || {};
  const currentCode = Number.isSafeInteger(current.latestVersionCode) ? current.latestVersionCode : 0;
  console.log(`\nFirestore latestVersionCode now: ${currentCode || '(none)'}`);
  if (appConfig.versionCode <= currentCode) {
    fail(`versionCode ${appConfig.versionCode} is not greater than the published ${currentCode}. Bump expo.android.versionCode and rebuild.`);
  }

  console.log('\nsiteConfig/mobileApp changes:');
  Object.entries(nextFields).forEach(([key, value]) => {
    const before = JSON.stringify(current[key]);
    const after = JSON.stringify(value);
    if (before !== after) console.log(`  ${key}: ${before ?? '(unset)'} → ${after}`);
  });
  console.log('  releasedAt: → <server timestamp>');

  if (options.dryRun) {
    console.log('\n(dry run) Nothing was uploaded or written.');
    return;
  }

  console.log('\nUploading the APK (resumable)…');
  await admin.storage.getStorage().bucket(firebaseProject.bucket).upload(apkPath, {
    destination,
    resumable: true,
    metadata: {
      contentType: 'application/vnd.android.package-archive',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { versionCode: String(appConfig.versionCode), sha256 },
    },
  });

  // Write the release only after the file is in place, so the app never sees a URL that 404s.
  await database.runTransaction(async (transaction) => {
    const latest = (await transaction.get(configReference)).data() || {};
    const latestCode = Number.isSafeInteger(latest.latestVersionCode) ? latest.latestVersionCode : 0;
    if (appConfig.versionCode <= latestCode) throw new Error(`Someone published versionCode ${latestCode} meanwhile.`);
    transaction.set(configReference, { ...nextFields, releasedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  console.log(`\n✔ Published Ourlime ${appConfig.version} (${appConfig.versionCode}). Open apps see it within seconds.`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
