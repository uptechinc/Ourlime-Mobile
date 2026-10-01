const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');

function printUsage() {
  console.log(`Usage: npm run migrate:legacy-limes -- [options]

Dry-run is the default. Firebase writes only occur when --execute is supplied.
Every run writes a deterministic JSON manifest.

Options:
  --help                 Show this help without connecting to Firebase.
  --execute              Apply the planned author and cover normalization.
  --id <reel-id>         Audit or migrate one explicit Lime document.
  --limit <count>        Bound the number of documents processed.
  --manifest <path>      Write the report to an explicit manifest path.`);
}

if (helpRequested) {
  printUsage();
  process.exit(0);
}

const mobileRoot = path.resolve(__dirname, '..');
const webRoot = path.resolve(mobileRoot, '..');
const webNodeModules = path.join(webRoot, 'node_modules');
const dotenv = require(path.join(webNodeModules, 'dotenv'));
const admin = require(path.join(webNodeModules, 'firebase-admin'));
const { chromium } = require(path.join(webNodeModules, 'playwright'));

dotenv.config({ path: path.join(webRoot, '.env.local'), quiet: true });
dotenv.config({ path: path.join(webRoot, '.env'), quiet: true });

const execute = args.includes('--execute');
const requestedId = readArgument('--id');
const limit = Number(readArgument('--limit') || Number.MAX_SAFE_INTEGER);
const manifestPath = path.resolve(
  readArgument('--manifest') || path.join(mobileRoot, 'logs', 'legacy-lime-migration', `manifest-${Date.now()}.json`),
);

if (!Number.isSafeInteger(limit) || limit < 1) {
  throw new Error('--limit must be a positive integer.');
}

for (const argument of args.filter((argument) => argument.startsWith('--'))) {
  if (!new Set(['--help', '--execute', '--id', '--limit', '--manifest']).has(argument)) {
    throw new Error(`Unknown argument: ${argument}`);
  }
}

function readArgument(flag) {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  return value.trim();
}

function readString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDeleted(value) {
  return value.isDeleted === true
    || Boolean(value.deletedAt)
    || readString(value.status).toLowerCase() === 'deleted';
}

function mediaRecord(value) {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : {};
  return isRecord(value) ? value : {};
}

function videoUrlOf(value) {
  const media = mediaRecord(value.media);
  return readString(media.typeUrl) || readString(media.url);
}

function thumbnailUrlOf(value) {
  const media = mediaRecord(value.media);
  return readString(value.thumbnailUrl)
    || readString(value.posterUrl)
    || readString(media.thumbnailUrl)
    || readString(media.posterUrl);
}

function authorUserIdOf(value) {
  const ownerUserId = readString(value.userId);
  const repostedFrom = isRecord(value.repostedFrom) ? value.repostedFrom : {};
  const embeddedUser = isRecord(value.user) ? value.user : {};
  const isRepost = value.isRepost === true || Object.keys(repostedFrom).length > 0;
  if (!isRepost) return ownerUserId;
  return readString(repostedFrom.userId)
    || readString(embeddedUser.userId)
    || readString(embeddedUser.id)
    || ownerUserId;
}

function videoKey(value) {
  try {
    const parsed = new URL(value);
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return value;
  }
}

function storagePathFromUrl(value, bucketName) {
  try {
    const parsed = new URL(value);
    const firebaseMatch = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (firebaseMatch && decodeURIComponent(firebaseMatch[1]) === bucketName) {
      return decodeURIComponent(firebaseMatch[2]);
    }
    if (parsed.hostname === 'storage.googleapis.com') {
      const prefix = `/${bucketName}/`;
      if (parsed.pathname.startsWith(prefix)) return decodeURIComponent(parsed.pathname.slice(prefix.length));
    }
  } catch {
    return null;
  }
  return null;
}

function firebaseDownloadUrl(bucketName, objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

async function writeManifest(manifest) {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  const temporaryPath = `${manifestPath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(manifest, null, 2));
  await fs.rename(temporaryPath, manifestPath);
}

function initializeFirebase() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const storageBucket = readString(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  if (!rawServiceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not configured in the web environment.');
  if (!storageBucket) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not configured in the web environment.');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(rawServiceAccount)),
      storageBucket,
    });
  }
  return {
    database: admin.firestore(),
    bucket: admin.storage().bucket(storageBucket),
  };
}

async function readVideoBytes(bucket, value) {
  const sourceUrl = videoUrlOf(value);
  if (!sourceUrl) throw new Error('No video URL is stored.');
  const objectPath = storagePathFromUrl(sourceUrl, bucket.name);
  if (objectPath) {
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) throw new Error(`Source object is missing: ${objectPath}`);
    const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
    return { bytes, contentType: readString(metadata.contentType) || 'video/mp4', sourcePath: objectPath };
  }
  const response = await fetch(sourceUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Video download returned HTTP ${response.status}.`);
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 250 * 1024 * 1024) {
    throw new Error('Video exceeds the 250 MiB migration limit.');
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'video/mp4',
    sourcePath: null,
  };
}

async function createCover(browser, video) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  try {
    await page.route('https://legacy-lime.invalid/**', async (route) => {
      if (route.request().url().endsWith('/video')) {
        await route.fulfill({ status: 200, contentType: video.contentType, body: video.bytes });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<video id="lime" muted playsinline preload="auto" src="/video"></video>',
      });
    });
    await page.goto('https://legacy-lime.invalid/frame', { waitUntil: 'domcontentloaded' });
    const dataUrl = await page.evaluate(async () => {
      const videoElement = document.getElementById('lime');
      const waitFor = (eventName, timeoutMs) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}.`)), timeoutMs);
        videoElement.addEventListener(eventName, () => { clearTimeout(timeout); resolve(); }, { once: true });
        videoElement.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Browser could not decode the legacy video.')); }, { once: true });
      });
      videoElement.load();
      if (videoElement.readyState < 1) await waitFor('loadedmetadata', 20_000);
      const captureTime = Math.min(1, Math.max(0.1, Number.isFinite(videoElement.duration) ? videoElement.duration * 0.05 : 0.25));
      videoElement.currentTime = captureTime;
      if (videoElement.readyState < 2 || Math.abs(videoElement.currentTime - captureTime) > 0.05) {
        await waitFor('seeked', 20_000);
      }
      const sourceWidth = videoElement.videoWidth;
      const sourceHeight = videoElement.videoHeight;
      if (!sourceWidth || !sourceHeight) throw new Error('Decoded video has no display dimensions.');
      const scale = Math.min(1, 720 / sourceWidth, 1280 / sourceHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.round(sourceWidth * scale));
      canvas.height = Math.max(2, Math.round(sourceHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable.');
      context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.84);
    });
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  } finally {
    await page.close();
  }
}

async function createBrandedFallbackCover(browser) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  try {
    await page.setContent(`
      <style>
        html,body{margin:0;width:720px;height:1280px;overflow:hidden;background:#07170e;font-family:Arial,sans-serif}
        body{display:flex;align-items:center;justify-content:center;color:#10b981}
        .glow{position:absolute;width:560px;height:560px;border-radius:50%;background:rgba(16,185,129,.10);filter:blur(10px)}
        .badge{position:relative;text-align:center}.lime{font-size:118px}.brand{font-size:36px;font-weight:800;letter-spacing:8px;margin-top:18px}
        .note{font-size:22px;color:#9ca3af;margin-top:22px;letter-spacing:1px}
      </style>
      <div class="glow"></div><div class="badge"><div class="lime">🍋</div><div class="brand">OURLIME</div><div class="note">VIDEO UNAVAILABLE</div></div>
    `);
    return await page.screenshot({ type: 'jpeg', quality: 84 });
  } finally {
    await page.close();
  }
}

async function uploadCover(bucket, documentId, ownerUserId, bytes) {
  const objectPath = `limes/${ownerUserId}/thumbnails/${documentId}_legacy_thumbnail.jpg`;
  const token = crypto.randomUUID();
  const file = bucket.file(objectPath);
  await file.save(bytes, {
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: {
      contentType: 'image/jpeg',
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: { firebaseStorageDownloadTokens: token, migration: 'legacy-lime-v1' },
    },
  }).catch(async (error) => {
    if (!String(error?.message || '').includes('conditionNotMet')) throw error;
  });
  const [metadata] = await file.getMetadata();
  const storedToken = readString(metadata.metadata?.firebaseStorageDownloadTokens).split(',')[0] || token;
  return firebaseDownloadUrl(bucket.name, objectPath, storedToken);
}

async function freshCounts(database) {
  const snapshot = await database.collection('reels').get();
  const active = snapshot.docs.filter((document) => !isDeleted(document.data()));
  return {
    active: active.length,
    missingAuthorUserId: active.filter((document) => !readString(document.get('authorUserId'))).length,
    missingThumbnail: active.filter((document) => !thumbnailUrlOf(document.data())).length,
  };
}

async function main() {
  if (helpRequested) {
    printUsage();
    return;
  }
  const { database, bucket } = initializeFirebase();
  const snapshot = requestedId
    ? await database.collection('reels').where(admin.firestore.FieldPath.documentId(), '==', requestedId).get()
    : await database.collection('reels').orderBy(admin.firestore.FieldPath.documentId()).get();
  const documents = snapshot.docs.filter((document) => !isDeleted(document.data())).slice(0, limit);
  const coversByVideo = new Map();
  for (const document of documents) {
    const value = document.data();
    const cover = thumbnailUrlOf(value);
    const video = videoUrlOf(value);
    if (cover && video) coversByVideo.set(videoKey(video), cover);
  }
  const manifest = {
    version: 1,
    mode: execute ? 'execute' : 'dry-run',
    projectId: admin.app().options.projectId,
    bucket: bucket.name,
    createdAt: new Date().toISOString(),
    items: documents.map((document) => {
      const value = document.data();
      const authorUserId = authorUserIdOf(value);
      const existingCover = thumbnailUrlOf(value);
      const reusableCover = coversByVideo.get(videoKey(videoUrlOf(value))) || '';
      const media = mediaRecord(value.media);
      const isCurrent = value.legacyLimeMigrationVersion === 1
        && readString(value.authorUserId) === authorUserId
        && readString(value.thumbnailUrl) === existingCover
        && readString(media.thumbnailUrl) === existingCover;
      return {
        id: document.id,
        ownerUserId: readString(value.userId),
        authorUserId,
        needsAuthorUserId: readString(value.authorUserId) !== authorUserId,
        coverAction: isCurrent ? 'none' : existingCover ? 'normalize' : reusableCover ? 'reuse' : 'generate',
        status: isCurrent ? 'current' : 'pending',
        reason: null,
      };
    }),
  };
  await writeManifest(manifest);
  console.log(`[legacyLimes] ${execute ? 'Execute' : 'Dry run'} inventory: ${JSON.stringify(summarize(manifest.items))}`);
  if (!execute) {
    console.log(`[legacyLimes] Manifest: ${manifestPath}`);
    console.log(`[legacyLimes] Fresh counts: ${JSON.stringify(await freshCounts(database))}`);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  let generatedCanaries = 0;
  try {
    for (const item of manifest.items) {
      if (item.status === 'current') continue;
      try {
        const reference = database.collection('reels').doc(item.id);
        const currentDocument = await reference.get();
        if (!currentDocument.exists || isDeleted(currentDocument.data())) throw new Error('Document disappeared or became deleted.');
        const current = currentDocument.data();
        const currentAuthorUserId = authorUserIdOf(current);
        if (!currentAuthorUserId || !readString(current.userId)) throw new Error('Lime has no resolvable owner/author identity.');
        let cover = thumbnailUrlOf(current);
        if (!cover) cover = coversByVideo.get(videoKey(videoUrlOf(current))) || '';
        if (!cover) {
          let coverBytes;
          try {
            const video = await readVideoBytes(bucket, current);
            coverBytes = await createCover(browser, video);
          } catch (error) {
            coverBytes = await createBrandedFallbackCover(browser);
            item.reason = `Original media unavailable; persisted branded cover: ${error instanceof Error ? error.message : 'Unknown media error.'}`;
          }
          cover = await uploadCover(bucket, item.id, readString(current.userId), coverBytes);
          generatedCanaries += 1;
        }
        await reference.update({
          authorUserId: currentAuthorUserId,
          thumbnailUrl: cover,
          'media.thumbnailUrl': cover,
          legacyLimeMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
          legacyLimeMigrationVersion: 1,
        });
        coversByVideo.set(videoKey(videoUrlOf(current)), cover);
        item.status = item.reason ? 'migrated-with-placeholder' : 'migrated';
      } catch (error) {
        item.status = 'failed';
        item.reason = error instanceof Error ? error.message.replace(/token=[^&\s]+/g, 'token=[redacted]') : 'Unknown migration error.';
        if (generatedCanaries < 2) {
          await writeManifest(manifest);
          throw new Error(`Canary ${item.id} failed: ${item.reason}`);
        }
      }
      await writeManifest(manifest);
      console.log(`[legacyLimes] ${item.id}: ${item.status}`);
    }
  } finally {
    await browser.close();
  }
  const counts = await freshCounts(database);
  console.log(`[legacyLimes] Manifest: ${manifestPath}`);
  console.log(`[legacyLimes] Final: ${JSON.stringify(summarize(manifest.items))}`);
  console.log(`[legacyLimes] Fresh counts: ${JSON.stringify(counts)}`);
  if (manifest.items.some((item) => item.status === 'failed')) process.exitCode = 1;
}

function summarize(items) {
  return items.reduce((summary, item) => {
    summary.total += 1;
    summary[item.status] = (summary[item.status] || 0) + 1;
    summary[item.coverAction] = (summary[item.coverAction] || 0) + 1;
    if (item.needsAuthorUserId) summary.identity += 1;
    return summary;
  }, { total: 0, current: 0, pending: 0, migrated: 0, 'migrated-with-placeholder': 0, failed: 0, none: 0, normalize: 0, reuse: 0, generate: 0, identity: 0 });
}

main().catch((error) => {
  console.error('[legacyLimes] Error:', error instanceof Error ? error.message : 'Unknown error.');
  process.exitCode = 1;
});
