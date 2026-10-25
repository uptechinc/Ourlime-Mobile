const fs = require('fs');
const path = require('path');

/** The package the native Kotlin sources were written against; every occurrence is rewritten to the build's package. */
const SOURCE_PACKAGE = 'com.ourlime.app';

/** The Android package of this build (expo.android.package, which app.config.js may override per EAS profile). */
function readAndroidPackage(config) {
  return (config.android && config.android.package) || SOURCE_PACKAGE;
}

/** Copies plugin Kotlin files into app/src/main/java/<package path>/, rewriting the package name inside them. */
function copyNativeSources(platformProjectRoot, sourceDirectory, fileNames, androidPackage) {
  const packageDirectory = path.join(platformProjectRoot, 'app', 'src', 'main', 'java', ...androidPackage.split('.'));
  fs.mkdirSync(packageDirectory, { recursive: true });
  fileNames.forEach((fileName) => {
    const source = fs.readFileSync(path.join(sourceDirectory, fileName), 'utf8');
    fs.writeFileSync(path.join(packageDirectory, fileName), source.split(SOURCE_PACKAGE).join(androidPackage));
  });
}

module.exports = { SOURCE_PACKAGE, readAndroidPackage, copyNativeSources };
