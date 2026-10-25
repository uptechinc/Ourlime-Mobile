/**
 * Static settings live in app.json. The Play production build (eas.json "production") overrides two values through
 * environment variables, so local and emulator builds keep com.ourlime.app and the sideload updater:
 *   OURLIME_ANDROID_PACKAGE  the Play package (com.ourlime.mobile)
 *   OURLIME_DISTRIBUTION     "play" leaves out REQUEST_INSTALL_PACKAGES; default is "sideload"
 */
module.exports = ({ config }) => {
  const androidPackage = process.env.OURLIME_ANDROID_PACKAGE;
  const distribution = process.env.OURLIME_DISTRIBUTION;
  return {
    ...config,
    android: { ...config.android, ...(androidPackage ? { package: androidPackage } : {}) },
    extra: { ...config.extra, ...(distribution ? { distribution } : {}) },
  };
};
