const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const expected = {
  bundleId: 'com.ourlime.app',
  androidPackage: 'com.ourlime.app',
  projectId: 'ourlime-919f2',
  senderId: '854561867716',
  storageBucket: 'ourlime-919f2.appspot.com',
  databaseUrl: 'https://ourlime-919f2-default-rtdb.firebaseio.com',
};

function fail(message) {
  throw new Error(`[verify:ios-firebase] ${message}`);
}

function readText(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(filePath)) fail(`Missing ${relativePath}.`);
  return fs.readFileSync(filePath, 'utf8');
}

function plistString(plist, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = plist.match(new RegExp(`<key>${escapedKey}<\\/key>\\s*<string>([^<]+)<\\/string>`));
  if (!match) fail(`GoogleService-Info.plist is missing ${key}.`);
  return match[1].trim();
}

function assertEqual(label, actual, expectedValue) {
  if (actual !== expectedValue) fail(`${label} is ${actual || '(empty)'}, expected ${expectedValue}.`);
}

const appConfig = JSON.parse(readText('app.json'));
const packageJson = JSON.parse(readText('package.json'));
const androidConfig = JSON.parse(readText('google-services.json'));
const plist = readText('GoogleService-Info.plist');
const firebaseSource = readText(path.join('lib', 'firebaseConfig.ts'));

assertEqual('iOS bundle identifier', appConfig.expo?.ios?.bundleIdentifier, expected.bundleId);
assertEqual('iOS Firebase file', appConfig.expo?.ios?.googleServicesFile, './GoogleService-Info.plist');
assertEqual('Firebase iOS bundle identifier', plistString(plist, 'BUNDLE_ID'), expected.bundleId);
assertEqual('Firebase iOS project ID', plistString(plist, 'PROJECT_ID'), expected.projectId);
assertEqual('Firebase iOS sender ID', plistString(plist, 'GCM_SENDER_ID'), expected.senderId);
assertEqual('Firebase iOS Storage bucket', plistString(plist, 'STORAGE_BUCKET'), expected.storageBucket);
assertEqual('Firebase iOS Realtime Database URL', plistString(plist, 'DATABASE_URL'), expected.databaseUrl);
assertEqual('Android package identifier', appConfig.expo?.android?.package, expected.androidPackage);
assertEqual('Firebase Android project ID', androidConfig.project_info?.project_id, expected.projectId);
assertEqual('Firebase Android sender ID', androidConfig.project_info?.project_number, expected.senderId);
assertEqual('Firebase Android Storage bucket', androidConfig.project_info?.storage_bucket, expected.storageBucket);

const requiredDependencies = [
  '@react-native-firebase/app',
  '@react-native-firebase/app-check',
  '@react-native-firebase/auth',
  '@react-native-firebase/firestore',
  '@react-native-firebase/storage',
  'firebase',
];
for (const dependency of requiredDependencies) {
  if (!packageJson.dependencies?.[dependency]) fail(`Missing dependency ${dependency}.`);
}

const plugins = appConfig.expo?.plugins ?? [];
const pluginNames = plugins.map((plugin) => Array.isArray(plugin) ? plugin[0] : plugin);
for (const plugin of ['@react-native-firebase/app', '@react-native-firebase/app-check', '@react-native-firebase/auth', '@react-native-firebase/messaging']) {
  if (!pluginNames.includes(plugin)) fail(`Missing Expo config plugin ${plugin}.`);
}
const buildProperties = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
if (buildProperties?.[1]?.ios?.useFrameworks !== 'static') {
  fail('expo-build-properties must set ios.useFrameworks to static for React Native Firebase.');
}

const androidAutolinkingExclusions = packageJson.expo?.autolinking?.android?.exclude ?? [];
if (!androidAutolinkingExclusions.includes('@react-native-firebase/app-check')) {
  fail('Android must exclude the iOS App Check module from native autolinking.');
}

for (const value of [expected.projectId, expected.storageBucket, expected.databaseUrl]) {
  if (!firebaseSource.includes(value)) fail(`lib/firebaseConfig.ts does not contain the existing backend value ${value}.`);
}

console.log('iOS Firebase configuration verified.');
console.log(`Bundle: ${expected.bundleId}`);
console.log(`Project: ${expected.projectId}`);
console.log(`Firestore: projects/${expected.projectId}/databases/(default)`);
console.log(`Storage: gs://${expected.storageBucket}`);
