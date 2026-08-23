import Constants, { ExecutionEnvironment } from 'expo-constants';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

export class PlatformEnvironmentService {
  private static instance: PlatformEnvironmentService;

  private constructor() {}

  public static getInstance(): PlatformEnvironmentService {
    if (!PlatformEnvironmentService.instance) {
      PlatformEnvironmentService.instance = new PlatformEnvironmentService();
    }
    return PlatformEnvironmentService.instance;
  }

  /**
   * Returns true when the JavaScript bundle is executing inside the Expo Go client app.
   * In modern Expo SDKs (SDK 50+), Constants.executionEnvironment === 'storeClient'.
   */
  public isExpoGo(): boolean {
    return (
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      Constants.appOwnership === 'expo'
    );
  }

  /**
   * Returns true if executing in a standalone, bare, or custom development build.
   */
  public isStandaloneOrDevClient(): boolean {
    return !this.isExpoGo() && Platform.OS !== 'web';
  }

  /**
   * Checks if native Firebase App module (RNFBAppModule) is compiled and present in the binary.
   */
  public hasNativeFirebaseApp(): boolean {
    if (Platform.OS === 'web' || this.isExpoGo()) return false;
    try {
      const hasInNativeModules = Boolean(NativeModules && NativeModules.RNFBAppModule);
      const hasInTurboModule = typeof TurboModuleRegistry?.get === 'function' && Boolean(TurboModuleRegistry.get('RNFBAppModule'));
      return hasInNativeModules || hasInTurboModule;
    } catch {
      return false;
    }
  }

  /**
   * Checks if native Firebase Messaging module (RNFBMessagingModule) is compiled and present in the binary.
   */
  public hasNativeFirebaseMessaging(): boolean {
    if (!this.hasNativeFirebaseApp()) return false;
    try {
      const hasInNativeModules = Boolean(NativeModules && NativeModules.RNFBMessagingModule);
      const hasInTurboModule = typeof TurboModuleRegistry?.get === 'function' && Boolean(TurboModuleRegistry.get('RNFBMessagingModule'));
      return hasInNativeModules || hasInTurboModule;
    } catch {
      return false;
    }
  }

  /**
   * Checks if native calling (Agora / CallKeep / FCM VoIP) can be executed.
   */
  public isNativeCallingSupported(): boolean {
    return this.isStandaloneOrDevClient();
  }

  /**
   * Checks if native push listeners (expo-notifications / FCM) are supported.
   */
  public isNativePushSupported(): boolean {
    return this.isStandaloneOrDevClient();
  }
}

export const platformEnvironmentService = PlatformEnvironmentService.getInstance();
