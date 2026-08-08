import 'expo-blob';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import * as FirebaseAuth from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DiagnosticLogService } from './services/DiagnosticLogService';

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
// Configure Firestore with long polling to stabilize WebChannel stream transport on React Native
const db = isNewApp
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : getFirestore(app);
const auth = Platform.OS === 'web' || !isNewApp
  ? FirebaseAuth.getAuth(app)
  : FirebaseAuth.initializeAuth(app, {
      persistence: reactNativeAuth.getReactNativePersistence(AsyncStorage),
    });
const storage = getStorage(app);

diagnosticLogService.info('Firebase', 'initialize', {
  platform: Platform.OS,
  appName: app.name,
  projectId: app.options.projectId,
  authDomain: app.options.authDomain,
  authPersistence: Platform.OS === 'web' ? 'web-default' : 'async-storage',
  reusedExistingApp: !isNewApp,
});

export { app, db, auth, storage };
