const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Expo Config Plugin to dynamically name the output APK
 * with the build date: Ourlime-dd.MM.yy.apk (e.g. Ourlime-13.09.26.apk)
 * Works for both local builds and EAS Cloud builds.
 */
module.exports = function withCustomApkName(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes('outputFileName = "Ourlime-')) {
      const customNamingSnippet = `
    applicationVariants.all { variant ->
        variant.outputs.all {
            def formattedDate = new java.text.SimpleDateFormat("dd.MM.yy").format(new Date())
            if (variant.buildType.name == 'release') {
                outputFileName = "Ourlime-\${formattedDate}.apk"
            } else {
                outputFileName = "Ourlime-\${formattedDate}-debug.apk"
            }
        }
    }
`;
      if (contents.includes('androidResources {')) {
        contents = contents.replace('androidResources {', `${customNamingSnippet}\n    androidResources {`);
      } else {
        contents += `\nandroid {\n${customNamingSnippet}\n}\n`;
      }
      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });
};
