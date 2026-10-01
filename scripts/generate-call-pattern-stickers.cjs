/* global Buffer, __dirname */
/**
 * Builds the small transparent sticker images used by the call wallpaper (components/calls/CallPatternBackground.tsx).
 *
 * Source: the chat sticker set in assets/images/stickers. Many of those PNGs are drawn on a solid light background,
 * which shows as a square when drawn small on the dark call screen. For each sticker this script:
 *   1. removes the solid background by flood-filling inward from the edges (colour close to the edge colour),
 *   2. downsizes it to PATTERN_SIZE px (area-averaged, alpha-aware),
 *   3. writes assets/images/stickers/pattern/<name>.png and the patternStickers.ts require() list,
 *   4. writes the same images to the website (public/images/stickers/pattern) plus lib/calls/callPatternStickers.ts,
 *      so the web call screen (components/chat/VideoCall) uses the identical set.
 *
 * Run from Ourlime-Mobile after adding or changing stickers:  node scripts/generate-call-pattern-stickers.cjs
 * JPEG stickers are skipped (no transparency to recover without an image library).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PATTERN_SIZE = 128;
const BACKGROUND_TOLERANCE = 56;
const STICKER_ROOT = path.join(__dirname, '..', 'assets', 'images', 'stickers');
const OUTPUT_DIR = path.join(STICKER_ROOT, 'pattern');
const OUTPUT_MODULE = path.join(STICKER_ROOT, 'patternStickers.ts');
const WEB_ROOT = path.join(__dirname, '..', '..');
const WEB_OUTPUT_DIR = path.join(WEB_ROOT, 'public', 'images', 'stickers', 'pattern');
const WEB_OUTPUT_MODULE = path.join(WEB_ROOT, 'lib', 'calls', 'callPatternStickers.ts');
const HAS_WEB = fs.existsSync(path.join(WEB_ROOT, 'public', 'images', 'stickers'));

function decodePng(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} is not a PNG`);
  let offset = 8; let width = 0; let height = 0; let bitDepth = 0; let colorType = 0; let interlace = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`${path.basename(file)}: unsupported PNG (depth ${bitDepth}, colour type ${colorType}, interlace ${interlace})`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = new Uint8ClampedArray(width * height * 4);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const current = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? current[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const distanceLeft = Math.abs(estimate - left); const distanceUp = Math.abs(estimate - up); const distanceUpLeft = Math.abs(estimate - upLeft);
        value += distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft ? left : distanceUp <= distanceUpLeft ? up : upLeft;
      }
      current[x] = value & 255;
    }
    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4;
      rgba[target] = current[x * channels];
      rgba[target + 1] = current[x * channels + 1];
      rgba[target + 2] = current[x * channels + 2];
      rgba[target + 3] = channels === 4 ? current[x * channels + 3] : 255;
    }
    previous = current;
  }
  return { width, height, rgba, hadAlpha: channels === 4 };
}

/** Clears the solid background connected to the image edges, softening the cut edge by colour distance. */
function removeEdgeBackground({ width, height, rgba }) {
  const cornerIndexes = [0, width - 1, (height - 1) * width, height * width - 1];
  const background = [0, 1, 2].map((channel) => cornerIndexes.reduce((sum, index) => sum + rgba[index * 4 + channel], 0) / cornerIndexes.length);
  const distance = (index) => Math.hypot(rgba[index * 4] - background[0], rgba[index * 4 + 1] - background[1], rgba[index * 4 + 2] - background[2]);
  const visited = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) { stack.push(x, (height - 1) * width + x); }
  for (let y = 0; y < height; y++) { stack.push(y * width, y * width + width - 1); }
  while (stack.length > 0) {
    const index = stack.pop();
    if (visited[index]) continue;
    visited[index] = 1;
    const colourDistance = distance(index);
    if (colourDistance > BACKGROUND_TOLERANCE) continue;
    // Fully clear clear background; fade pixels near the tolerance edge for a soft outline.
    const keep = Math.max(0, (colourDistance - BACKGROUND_TOLERANCE * 0.6) / (BACKGROUND_TOLERANCE * 0.4));
    rgba[index * 4 + 3] = Math.round(rgba[index * 4 + 3] * keep);
    const x = index % width; const y = (index - x) / width;
    if (x > 0) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (y > 0) stack.push(index - width);
    if (y < height - 1) stack.push(index + width);
  }
}

/** Area-averaged downscale into a square canvas (aspect preserved, centred), weighting colour by alpha. */
function downscale({ width, height, rgba }, size) {
  const scale = Math.max(width, height) / size;
  const targetWidth = Math.max(1, Math.round(width / scale));
  const targetHeight = Math.max(1, Math.round(height / scale));
  const offsetX = Math.floor((size - targetWidth) / 2);
  const offsetY = Math.floor((size - targetHeight) / 2);
  const out = new Uint8ClampedArray(size * size * 4);
  for (let ty = 0; ty < targetHeight; ty++) {
    for (let tx = 0; tx < targetWidth; tx++) {
      const startX = Math.floor(tx * scale); const endX = Math.min(width, Math.floor((tx + 1) * scale));
      const startY = Math.floor(ty * scale); const endY = Math.min(height, Math.floor((ty + 1) * scale));
      let red = 0; let green = 0; let blue = 0; let alpha = 0; let count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const index = (y * width + x) * 4;
          const pixelAlpha = rgba[index + 3];
          red += rgba[index] * pixelAlpha; green += rgba[index + 1] * pixelAlpha; blue += rgba[index + 2] * pixelAlpha;
          alpha += pixelAlpha; count++;
        }
      }
      const target = ((ty + offsetY) * size + tx + offsetX) * 4;
      if (alpha > 0) {
        out[target] = red / alpha; out[target + 1] = green / alpha; out[target + 2] = blue / alpha;
        out[target + 3] = alpha / Math.max(1, count);
      }
    }
  }
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function encodePng(rgba, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (HAS_WEB) fs.mkdirSync(WEB_OUTPUT_DIR, { recursive: true });
const outputs = [];
for (const folder of fs.readdirSync(STICKER_ROOT).sort()) {
  const folderPath = path.join(STICKER_ROOT, folder);
  if (folder === 'pattern' || !fs.statSync(folderPath).isDirectory()) continue;
  for (const name of fs.readdirSync(folderPath).sort()) {
    if (!/\.png$/i.test(name)) { console.log(`skip ${folder}/${name} (not a PNG)`); continue; }
    const image = decodePng(path.join(folderPath, name));
    if (!image.hadAlpha) removeEdgeBackground(image);
    const outputName = `${folder}-${name.replace(/\.png$/i, '').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}.png`;
    const png = encodePng(downscale(image, PATTERN_SIZE), PATTERN_SIZE);
    fs.writeFileSync(path.join(OUTPUT_DIR, outputName), png);
    if (HAS_WEB) fs.writeFileSync(path.join(WEB_OUTPUT_DIR, outputName), png);
    outputs.push(outputName);
    console.log(`wrote pattern/${outputName}${image.hadAlpha ? '' : ' (background removed)'}`);
  }
}

const moduleSource = `import type { ImageSourcePropType } from 'react-native';

// Generated by scripts/generate-call-pattern-stickers.cjs: small transparent copies of the chat stickers for the
// call wallpaper. Re-run that script after changing stickers; do not edit by hand.
export const PATTERN_STICKERS: ImageSourcePropType[] = [
${outputs.map((name) => `  require('./pattern/${name}'),`).join('\n')}
];
`;
fs.writeFileSync(OUTPUT_MODULE, moduleSource);
console.log(`\n${outputs.length} pattern stickers -> ${path.relative(process.cwd(), OUTPUT_MODULE)}`);

if (HAS_WEB) {
  const webModuleSource = `// Generated by Ourlime-Mobile/scripts/generate-call-pattern-stickers.cjs: small transparent copies of the chat
// stickers for the call wallpaper, served from public/images/stickers/pattern. Do not edit by hand.
export const CALL_PATTERN_STICKERS: readonly string[] = [
${outputs.map((name) => `  '/images/stickers/pattern/${name}',`).join('\n')}
];
`;
  fs.writeFileSync(WEB_OUTPUT_MODULE, webModuleSource);
  console.log(`web copies -> ${path.relative(process.cwd(), WEB_OUTPUT_DIR)} and ${path.relative(process.cwd(), WEB_OUTPUT_MODULE)}`);
}
