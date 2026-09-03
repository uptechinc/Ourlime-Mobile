if (typeof Promise !== 'undefined' && typeof Promise.prototype.finally !== 'function') {
  // Polyfill Promise.prototype.finally for Hermes / older Android JS runtimes
  // eslint-disable-next-line no-extend-native
  Promise.prototype.finally = function (callback) {
    if (typeof callback !== 'function') {
      return this.then(callback, callback);
    }
    const P = this.constructor || Promise;
    return this.then(
      (value) => P.resolve(callback()).then(() => value),
      (reason) => P.resolve(callback()).then(() => { throw reason; })
    );
  };
}

const { LogBox } = require('react-native');
const { errorLogService } = require('./lib/services/ErrorLogService');
const { nativeCallService } = require('./lib/services/NativeCallService');

errorLogService.install();

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'SafeAreaView has been deprecated and will be removed in a future release',
  '@firebase/firestore',
  'WebChannelConnection',
  "RPC 'Listen' stream",
  'transport errored',
  'Cannot connect to Expo CLI',
  'expo-notifications: Android Push notifications',
  'Require cycle:',
]);

void nativeCallService.registerAndroidBackgroundHandler();

require('expo-router/entry');
