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
