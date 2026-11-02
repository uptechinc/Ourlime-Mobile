const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');

// Automatically set up Java (JDK 17 LTS preferred for React Native 0.76+ / AGP)
function resolveJavaHome() {
  const knownJdk17Paths = [
    'C:\\Users\\aaron\\.gradle\\jdks\\eclipse_adoptium-17-amd64-windows.2',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17',
    'C:\\Program Files\\Java\\jdk-17',
  ];
  for (const jdkPath of knownJdk17Paths) {
    if (fs.existsSync(jdkPath)) return jdkPath;
  }
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }
  return 'C:\\Program Files\\Android\\Android Studio\\jbr';
}

const javaHome = resolveJavaHome();
const androidHome = process.env.ANDROID_HOME || 'C:\\Users\\aaron\\AppData\\Local\\Android\\Sdk';

const customEnv = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH}`,
  _JAVA_OPTIONS: '-Xmx8192m -XX:MaxMetaspaceSize=2048m',
  GRADLE_OPTS: '-Xmx8192m -XX:MaxMetaspaceSize=2048m',
};

// Production (Play, com.ourlime.mobile) is the only release target. Default: signed .aab for Play Console.
//   --apk    the same production build as an .apk, for testing on the emulator or a phone
//   --debug  the development client (com.ourlime.app), never released
const isDebug = process.argv.includes('--debug');
const isProductionApk = process.argv.includes('--apk');
const PLAY_PACKAGE = 'com.ourlime.mobile';
const DEV_PACKAGE = 'com.ourlime.app';
const PLAY_UPLOAD_SHA1 = '8E:EE:1D:44:7A:4D:0E:E9:5B:31:1F:FE:A7:4E:AC:C9:55:D6:38:05';
const targetPackage = isDebug ? DEV_PACKAGE : PLAY_PACKAGE;

if (!isDebug) {
  // Play upload key, downloaded with `npx eas-cli credentials -p android` → credentials.json (both git-ignored)
  const credentialsPath = path.join(rootDir, 'credentials.json');
  if (!fs.existsSync(credentialsPath)) {
    console.error('[build-local] Error: credentials.json is missing. Download the Play upload key first:');
    console.error('  npx eas-cli credentials -p android  → production → credentials.json → Download credentials from EAS to credentials.json');
    process.exit(1);
  }
  const keystore = JSON.parse(fs.readFileSync(credentialsPath, 'utf8')).android?.keystore;
  if (!keystore?.keystorePath) {
    console.error('[build-local] Error: credentials.json has no android.keystore entry.');
    process.exit(1);
  }
  Object.assign(customEnv, {
    OURLIME_ANDROID_PACKAGE: PLAY_PACKAGE,
    OURLIME_DISTRIBUTION: 'play',
    OURLIME_UPLOAD_STORE_FILE: path.resolve(rootDir, keystore.keystorePath),
    OURLIME_UPLOAD_STORE_PASSWORD: keystore.keystorePassword,
    OURLIME_UPLOAD_KEY_ALIAS: keystore.keyAlias,
    OURLIME_UPLOAD_KEY_PASSWORD: keystore.keyPassword,
  });
}

console.log(`🚀 Starting Local Native Android ${isDebug ? 'debug' : isProductionApk ? 'production APK' : 'production AAB'} Build (${targetPackage})...`);
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
const existingGradle = path.join(androidDir, 'app', 'build.gradle');
const packageChanged = fs.existsSync(existingGradle)
  && !fs.readFileSync(existingGradle, 'utf8').includes(`applicationId '${targetPackage}'`);
execSync(`npx expo prebuild --platform android${packageChanged ? ' --clean' : ''}`, {
  cwd: rootDir,
  stdio: 'inherit',
  env: customEnv,
});

// Configure Gradle to use JDK 17 explicitly
const gradlePropertiesPath = path.join(androidDir, 'gradle.properties');
if (fs.existsSync(gradlePropertiesPath)) {
  const javaHomeEscaped = javaHome.replace(/\\/g, '/');
  let content = fs.readFileSync(gradlePropertiesPath, 'utf8');
  if (!content.includes('org.gradle.java.home=')) {
    content += `\norg.gradle.java.home=${javaHomeEscaped}\n`;
    fs.writeFileSync(gradlePropertiesPath, content, 'utf8');
  }
}

// Configure custom APK output filename in android/app/build.gradle
const appBuildGradlePath = path.join(androidDir, 'app', 'build.gradle');
if (fs.existsSync(appBuildGradlePath)) {
  let gradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');
  if (!gradleContent.includes('outputFileName = "Ourlime-')) {
    const hookMarker = 'androidResources {';
    if (gradleContent.includes(hookMarker)) {
      const customNamingSnippet = `    applicationVariants.all { variant ->\n        variant.outputs.all {\n            def formattedDate = new java.text.SimpleDateFormat("dd.MM.yy").format(new Date())\n            if (variant.buildType.name == 'release') {\n                outputFileName = "Ourlime-\${formattedDate}.apk"\n            } else {\n                outputFileName = "Ourlime-\${formattedDate}-debug.apk"\n            }\n        }\n    }\n\n    ${hookMarker}`;
      gradleContent = gradleContent.replace(hookMarker, customNamingSnippet);
      fs.writeFileSync(appBuildGradlePath, gradleContent, 'utf8');
    }
  }
}

// Sign release builds with the Play upload key when OURLIME_UPLOAD_STORE_FILE is set (debug key otherwise)
if (fs.existsSync(appBuildGradlePath)) {
  let gradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');
  if (!gradleContent.includes('playUpload {')) {
    gradleContent = gradleContent.replace(
      /(signingConfigs \{\s*debug \{[\s\S]*?\n        \})/,
      `$1
        playUpload {
            if (System.getenv('OURLIME_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('OURLIME_UPLOAD_STORE_FILE'))
                storePassword System.getenv('OURLIME_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('OURLIME_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('OURLIME_UPLOAD_KEY_PASSWORD')
            }
        }`
    );
    const buildTypesIndex = gradleContent.indexOf('buildTypes {');
    const releaseIndex = gradleContent.indexOf('release {', buildTypesIndex);
    const signingIndex = gradleContent.indexOf('signingConfig signingConfigs.debug', releaseIndex);
    if (buildTypesIndex < 0 || releaseIndex < 0 || signingIndex < 0 || !gradleContent.includes('playUpload {')) {
      console.error('[build-local] Error: could not add Play signing to android/app/build.gradle');
      process.exit(1);
    }
    gradleContent = gradleContent.slice(0, signingIndex)
      + "signingConfig System.getenv('OURLIME_UPLOAD_STORE_FILE') ? signingConfigs.playUpload : signingConfigs.debug"
      + gradleContent.slice(signingIndex + 'signingConfig signingConfigs.debug'.length);
    fs.writeFileSync(appBuildGradlePath, gradleContent, 'utf8');
  }
}

// Step 2: Run Gradle
const isWindows = process.platform === 'win32';
// Explicit relative path: Windows may be set not to run programs from the current folder by bare name.
const gradlewCmd = isWindows ? '.\\gradlew.bat' : './gradlew';

// Stop any stale daemon using old JDK
try {
  execSync(`${gradlewCmd} --stop`, {
    cwd: androidDir,
    stdio: 'ignore',
    env: customEnv,
  });
} catch {
  // Non-blocking
}

const buildType = isDebug ? 'assembleDebug' : isProductionApk ? 'assembleRelease' : 'bundleRelease';

console.log(`🔨 Step 2: Running Gradle ${buildType}...`);
execSync(`${gradlewCmd} ${buildType} -x lint -x lintVitalRelease`, {
  cwd: androidDir,
  stdio: 'inherit',
  env: customEnv,
});

const appConfig = require(path.join(rootDir, 'app.json')).expo;
const releaseName = `Ourlime-${appConfig.version}-vc${appConfig.android.versionCode}`;

/** Prints the signing SHA-1 and stops the script when a production build isn't signed with the Play upload key. */
function checkPlaySigning(filePath) {
  const keytool = path.join(javaHome, 'bin', isWindows ? 'keytool.exe' : 'keytool');
  const output = execSync(`"${keytool}" -printcert -jarfile "${filePath}"`, { env: customEnv, encoding: 'utf8' });
  const sha1 = (output.match(/SHA1:\s*([0-9A-F:]+)/i) || [])[1] || 'unknown';
  console.log(`🔑 Signing SHA-1: ${sha1}`);
  if (sha1.toUpperCase() !== PLAY_UPLOAD_SHA1) {
    console.error(`[build-local] Error: not signed with the Play upload key (${PLAY_UPLOAD_SHA1}).`);
    process.exit(1);
  }
}

if (buildType === 'bundleRelease') {
  const builtAab = path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  if (!fs.existsSync(builtAab)) {
    console.error('[build-local] Error: app-release.aab was not produced.');
    process.exit(1);
  }
  const rootAabPath = path.join(rootDir, `${releaseName}.aab`);
  fs.copyFileSync(builtAab, rootAabPath);
  checkPlaySigning(rootAabPath);
  console.log('✅ Local production AAB Build Successful!');
  console.log(`📦 Upload to Play Console: ${rootAabPath}`);
  process.exit(0);
}

const outputFolder = buildType === 'assembleDebug' ? 'debug' : 'release';
const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', outputFolder);

// Compute current date format dd.mm.yy (e.g. Ourlime-13.09.26.apk)
const now = new Date();
const dd = String(now.getDate()).padStart(2, '0');
const mm = String(now.getMonth() + 1).padStart(2, '0');
const yy = String(now.getFullYear()).slice(-2);
const dateSuffix = `${dd}.${mm}.${yy}`;
const targetApkName = buildType === 'assembleDebug' ? `Ourlime-${dateSuffix}-debug.apk` : `Ourlime-${dateSuffix}.apk`;
const targetApkPath = path.join(apkDir, targetApkName);
const legacyApkPath = path.join(apkDir, `app-${outputFolder}.apk`);

let finalApkPath = null;
if (fs.existsSync(targetApkPath)) {
  finalApkPath = targetApkPath;
} else if (fs.existsSync(legacyApkPath)) {
  fs.copyFileSync(legacyApkPath, targetApkPath);
  finalApkPath = targetApkPath;
} else if (fs.existsSync(apkDir)) {
  const foundApk = fs.readdirSync(apkDir).find(file => file.endsWith('.apk'));
  if (foundApk) {
    const src = path.join(apkDir, foundApk);
    fs.copyFileSync(src, targetApkPath);
    finalApkPath = targetApkPath;
  }
}

if (finalApkPath && fs.existsSync(finalApkPath)) {
  // Also copy to root project directory for instant convenience
  const rootApkPath = path.join(rootDir, isDebug ? targetApkName : `${releaseName}.apk`);
  try {
    fs.copyFileSync(finalApkPath, rootApkPath);
  } catch {
    // Non-blocking
  }

  if (!isDebug) checkPlaySigning(rootApkPath);
  console.log('✅ Local Android APK Build Successful!');
  console.log(`📍 Built APK Location: ${finalApkPath}`);
  console.log(`📦 Root Shortcut: ${rootApkPath}`);
} else {
  console.log('⚠️ Build finished. Please check output directory inside android/app/build/outputs/apk/');
}

