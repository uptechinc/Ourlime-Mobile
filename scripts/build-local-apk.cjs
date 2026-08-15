const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');

// Automatically set up Java (Android Studio JBR) and Android SDK paths for Windows
const javaHome = process.env.JAVA_HOME || 'C:\\Program Files\\Android\\Android Studio\\jbr';
const androidHome = process.env.ANDROID_HOME || 'C:\\Users\\aaron\\AppData\\Local\\Android\\Sdk';

const customEnv = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  _JAVA_OPTIONS: '-Xmx8192m -XX:MaxMetaspaceSize=2048m',
  GRADLE_OPTS: '-Xmx8192m -XX:MaxMetaspaceSize=2048m',
};

console.log('🚀 Starting Local Native Android APK Build...');
console.log(`☕ JAVA_HOME: ${javaHome}`);
console.log(`📱 ANDROID_HOME: ${androidHome}`);

// Ensure google-services.json exists
const googleServicesPath = path.join(rootDir, 'google-services.json');
if (!fs.existsSync(googleServicesPath)) {
  console.log('⚙️ Creating google-services.json fallback...');
  fs.writeFileSync(
    googleServicesPath,
    JSON.stringify(
      {
        project_info: {
          project_number: '123456789012',
          project_id: 'ourlime-app',
          storage_bucket: 'ourlime-app.appspot.com',
        },
        client: [
          {
            client_info: {
              mobilesdk_app_id: '1:123456789012:android:abcdef1234567890',
              android_client_info: { package_name: 'com.ourlime.app' },
            },
            oauth_client: [],
            api_key: [{ current_key: 'AIzaSyDummyKeyForLocalBuild' }],
            services: { appinvite_service: { other_platform_oauth_client: [] } },
          },
        ],
        configuration_version: '1',
      },
      null,
      2
    )
  );
}

// Step 1: Prebuild native android project if needed
console.log('📦 Step 1: Running Expo Prebuild...');
execSync('npx expo prebuild --platform android', {
  cwd: rootDir,
  stdio: 'inherit',
  env: customEnv,
});

// Step 2: Run Gradle assembleRelease
const isWindows = process.platform === 'win32';
const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';

const buildType = process.argv.includes('--debug') ? 'assembleDebug' : 'assembleRelease';

console.log(`🔨 Step 2: Running Gradle ${buildType}...`);
execSync(`${gradlewCmd} ${buildType} -x lint -x lintVitalRelease`, {
  cwd: androidDir,
  stdio: 'inherit',
  env: customEnv,
});

const outputFolder = buildType === 'assembleDebug' ? 'debug' : 'release';
const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', outputFolder, `app-${outputFolder}.apk`);

if (fs.existsSync(apkPath)) {
  console.log('✅ Local Android APK Build Successful!');
  console.log(`📍 Built APK Location: ${apkPath}`);
} else {
  console.log('⚠️ Build finished. Please check output directory inside android/app/build/outputs/apk/');
}
