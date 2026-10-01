export class NativeFirebaseEmulatorService {
  private static instance: NativeFirebaseEmulatorService;
  private connected = false;
  public static getInstance(): NativeFirebaseEmulatorService { return this.instance ??= new NativeFirebaseEmulatorService(); }
  public host(): string | null {
    if (!__DEV__) return null;
    const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST?.trim() ?? '';
    if (!host) return null;
    if (!/^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/.test(host)) throw new Error('Invalid local Firebase emulator host.');
    return host;
  }
  public async connect(): Promise<void> {
    const host = this.host(); if (!host || this.connected) return;
    const authModule = await import('@react-native-firebase/auth');
    const firestoreModule = await import('@react-native-firebase/firestore');
    const storageModule = await import('@react-native-firebase/storage');
    const functionsModule = await import('@react-native-firebase/functions');
    authModule.connectAuthEmulator(authModule.getAuth(), `http://${host}:9099`);
    firestoreModule.connectFirestoreEmulator(firestoreModule.getFirestore(), host, 8080);
    storageModule.connectStorageEmulator(storageModule.getStorage(), host, 9199);
    functionsModule.connectFunctionsEmulator(functionsModule.getFunctions(), host, 5001);
    this.connected = true;
  }
  public nativeSessionUrl(projectId: string): string {
    const host = this.host();
    return host ? `http://${host}:5001/${projectId}/us-central1/nativeSession` : `https://us-central1-${projectId}.cloudfunctions.net/nativeSession`;
  }
}
export const nativeFirebaseEmulatorService = NativeFirebaseEmulatorService.getInstance();
