#!/usr/bin/env node
/*
 * Installs the newest local release APK on a connected Android device or emulator.
 *
 *   bun install-apk                          first ready device, newest Ourlime-*.apk in the repo root
 *   bun install-apk --device RF8RC1VCDPL     a specific device (adb serial; see `adb devices`)
 *   bun install-apk --apk Ourlime-24.10.26.apk
 *   bun install-apk --launch                 open the app after installing
 *
 * Options:
 *   -d, --device <serial>   Target this device. Also read from the ANDROID_SERIAL environment variable.
 *   -a, --apk <path>        The APK to install (default: newest release Ourlime-*.apk, debug builds excluded).
 *   -l, --launch            Start the app once it is installed.
 *   -h, --help              Show this help.
 *
 * Installs with `adb install -r`, so app data is kept. It never uninstalls anything: if Android reports a signature
 * mismatch, the message says how to uninstall the old build yourself (which deletes its local data).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const PACKAGE_NAME = 'com.ourlime.app';

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function readArguments(argv) {
  const options = { device: process.env.ANDROID_SERIAL || null, apk: null, launch: false };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    const next = () => argv[++index] || fail(`${argument} needs a value.`);
    if (argument === '-d' || argument === '--device') options.device = next();
    else if (argument === '-a' || argument === '--apk') options.apk = next();
    else if (argument === '-l' || argument === '--launch') options.launch = true;
    else if (argument === '-h' || argument === '--help') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\n?/, '').replace(/^ \* ?/gm, ''));
      process.exit(0);
    } else fail(`Unknown option ${argument}. Run with --help.`);
  }
  return options;
}

/** adb from PATH, ANDROID_HOME / ANDROID_SDK_ROOT, or the default Windows / macOS / Linux SDK folders. */
function resolveAdb() {
  const executable = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const sdkFolders = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Android', 'sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Android', 'Sdk'),
  ].filter(Boolean);
  for (const folder of sdkFolders) {
    const candidate = path.join(folder, 'platform-tools', executable);
    if (fs.existsSync(candidate)) return candidate;
  }
  const onPath = spawnSync(executable, ['version'], { encoding: 'utf8' });
  if (onPath.status === 0) return executable;
  return fail('adb not found. Install Android platform-tools or set ANDROID_HOME.');
}

function resolveApk(requested) {
  if (requested) {
    const resolved = path.resolve(requested);
    return fs.existsSync(resolved) ? resolved : fail(`APK not found: ${resolved}`);
  }
  const candidates = fs.readdirSync(projectRoot)
    .filter((name) => /^Ourlime-.*\.apk$/.test(name) && !name.endsWith('-debug.apk'))
    .map((name) => ({ file: path.join(projectRoot, name), modified: fs.statSync(path.join(projectRoot, name)).mtimeMs }))
    .sort((left, right) => right.modified - left.modified);
  if (candidates.length === 0) fail('No release Ourlime-*.apk in the repo root. Build one with `npm run build:local`, or pass --apk.');
  return candidates[0].file;
}

/** Parses `adb devices -l` into { serial, state, description }. */
function listDevices(adb) {
  const output = execFileSync(adb, ['devices', '-l'], { encoding: 'utf8' });
  return output.split(/\r?\n/).slice(1).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [serial, state, ...rest] = line.split(/\s+/);
    return { serial, state, description: rest.join(' ') };
  });
}

function chooseDevice(devices, requestedSerial) {
  if (devices.length === 0) fail('No device found. Plug in a phone with USB debugging on, or start an emulator.');
  if (requestedSerial) {
    const match = devices.find((device) => device.serial === requestedSerial);
    if (!match) fail(`Device ${requestedSerial} not found. Connected: ${devices.map((device) => device.serial).join(', ')}.`);
    if (match.state !== 'device') explainState(match);
    return match;
  }
  const ready = devices.filter((device) => device.state === 'device');
  if (ready.length === 0) explainState(devices[0]);
  if (ready.length > 1) {
    console.log(`Several devices connected; using the first. Pick another with --device <serial>:\n${ready.map((device) => `  ${device.serial}  ${device.description}`).join('\n')}\n`);
  }
  return ready[0];
}

function explainState(device) {
  if (device.state === 'unauthorized') {
    fail(`${device.serial} is unauthorized. Unlock the phone and tap "Allow" on the "Allow USB debugging?" prompt (tick "Always allow from this computer"), then run this again.`);
  }
  fail(`${device.serial} is "${device.state}", not ready. Reconnect it and try again.`);
}

function main() {
  const options = readArguments(process.argv.slice(2));
  const adb = resolveAdb();
  const apk = resolveApk(options.apk);
  const device = chooseDevice(listDevices(adb), options.device);
  const sizeMegabytes = Math.round(fs.statSync(apk).size / 1024 / 1024);

  console.log(`Installing ${path.basename(apk)} (${sizeMegabytes} MB) on ${device.serial} ${device.description}`);
  const install = spawnSync(adb, ['-s', device.serial, 'install', '-r', apk], { encoding: 'utf8' });
  const output = `${install.stdout || ''}${install.stderr || ''}`.trim();
  console.log(output);
  if (install.status !== 0 || !/Success/.test(output)) {
    if (/INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match/i.test(output)) {
      fail(`The installed Ourlime was signed with a different key. To replace it (this deletes its local data), run:\n  adb -s ${device.serial} uninstall ${PACKAGE_NAME}\nthen run this again.`);
    }
    fail('Install failed. See the message above.');
  }
  console.log('\n✔ Installed.');

  if (options.launch) {
    spawnSync(adb, ['-s', device.serial, 'shell', 'monkey', '-p', PACKAGE_NAME, '-c', 'android.intent.category.LAUNCHER', '1'], { encoding: 'utf8' });
    console.log('✔ Launched.');
  }
}

main();
