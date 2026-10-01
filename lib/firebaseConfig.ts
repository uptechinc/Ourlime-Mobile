import 'expo-blob';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';
import * as FirebaseAuth from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, LogBox } from 'react-native';
import { DiagnosticLogService } from './services/DiagnosticLogService';

if (Platform.OS !== 'web' && LogBox?.ignoreLogs) {
  LogBox.ignoreLogs([
    '@firebase/firestore',
    'WebChannelConnection',
    "RPC 'Listen' stream",
    'transport errored',
  ]);
}

type ReactNativeAuthModule = typeof FirebaseAuth & {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

const reactNativeAuth = FirebaseAuth as ReactNativeAuthModule;
const diagnosticLogService = DiagnosticLogService.getInstance();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA_P7kgoLL7FL62YsHGQVYstIL7sFn-AiE",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "ourlime-919f2.firebaseapp.com",
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://ourlime-919f2-default-rtdb.firebaseio.com/",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ourlime-919f2",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "ourlime-919f2.appspot.com",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "854561867716",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:854561867716:web:feca6de4daa027f984c691",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-HFJJZRKNSG"
};

// Initialize Firebase App
const isNewApp = getApps().length === 0;
const app = isNewApp ? initializeApp(firebaseConfig) : getApp();
let db: ReturnType<typeof getFirestore>;
try {
  db = isNewApp
    ? initializeFirestore(app, { experimentalForceLongPolling: true })
    : getFirestore(app);
} catch {
  db = getFirestore(app);
}
let auth: FirebaseAuth.Auth;
try {
  auth = Platform.OS === 'web'
    ? FirebaseAuth.getAuth(app)
    : FirebaseAuth.initializeAuth(app, {
        persistence: reactNativeAuth.getReactNativePersistence(AsyncStorage),
      });
} catch {
  auth = FirebaseAuth.getAuth(app);
}
const storage = getStorage(app);
const emulatorHost = __DEV__ ? process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST?.trim() : '';
if (emulatorHost) {
  const validHost = /^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/.test(emulatorHost);
  if (!validHost) throw new Error('Development Firebase emulator host must be localhost, 127.0.0.1 or the Android emulator host.');
  try { FirebaseAuth.connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true }); } catch { /* Existing development connection. */ }
  try { connectFirestoreEmulator(db, emulatorHost, 8080); } catch { /* Existing development connection. */ }
  try { connectStorageEmulator(storage, emulatorHost, 9199); } catch { /* Existing development connection. */ }
}

diagnosticLogService.info('Firebase', 'initialize', {
  platform: Platform.OS,
  appName: app.name,
  projectId: app.options.projectId,
  authDomain: app.options.authDomain,
  authPersistence: Platform.OS === 'web' ? 'web-default' : 'async-storage',
  reusedExistingApp: !isNewApp,
  emulator: emulatorHost ? 'local-development' : 'disabled',
});

export { app, db, auth, storage };
