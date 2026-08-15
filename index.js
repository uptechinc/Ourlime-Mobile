const { nativeCallService } = require('./lib/services/NativeCallService');

void nativeCallService.registerAndroidBackgroundHandler();

require('expo-router/entry');
