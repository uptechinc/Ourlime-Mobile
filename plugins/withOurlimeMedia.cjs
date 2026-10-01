const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod, withMainApplication } = require('@expo/config-plugins');

// Keep in step with expo-video's Media3 (node_modules/expo-video/android/build.gradle) so Gradle resolves one version.
const MEDIA3_VERSION = '1.9.0';
const MEDIA3_DEPENDENCIES = [
  `implementation("androidx.media3:media3-transformer:${MEDIA3_VERSION}")`,
  `implementation("androidx.media3:media3-effect:${MEDIA3_VERSION}")`,
  `implementation("androidx.media3:media3-common:${MEDIA3_VERSION}")`,
];
const NATIVE_SOURCES = ['OurlimeVideoTrimModule.kt', 'OurlimeMediaPackage.kt'];

/** Adds the Media3 Transformer dependencies used by the on-device video trimmer. */
function withMediaGradle(config) {
  return withAppBuildGradle(config, (result) => {
    let source = result.modResults.contents;
    if (!source.includes('androidx.media3:media3-transformer')) {
      source = source.replace(
        /dependencies\s*\{/,
        `dependencies {\n    // Ourlime video trimmer (plugins/native-media)\n    ${MEDIA3_DEPENDENCIES.join('\n    ')}\n`,
      );
    }
    result.modResults.contents = source;
    return result;
  });
}

function withMediaMainApplication(config) {
  return withMainApplication(config, (result) => {
    if (result.modResults.language !== 'kt') return result;
    let source = result.modResults.contents;
    if (!source.includes('add(OurlimeMediaPackage())')) {
      source = source.replace(
        /PackageList\(this\)\.packages\.apply \{/,
        'PackageList(this).packages.apply {\n          add(OurlimeMediaPackage())',
      );
    }
    result.modResults.contents = source;
    return result;
  });
}

function withMediaAndroidSources(config) {
  return withDangerousMod(config, ['android', async (result) => {
    const packageDirectory = path.join(result.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', 'com', 'ourlime', 'app');
    fs.mkdirSync(packageDirectory, { recursive: true });
    NATIVE_SOURCES.forEach((fileName) => {
      fs.copyFileSync(path.join(__dirname, 'native-media', fileName), path.join(packageDirectory, fileName));
    });
    return result;
  }]);
}

/** On-device video trimming (Limes / feed posts): only the chosen part of a long video is uploaded. */
module.exports = function withOurlimeMedia(config) {
  return withMediaAndroidSources(withMediaMainApplication(withMediaGradle(config)));
};
