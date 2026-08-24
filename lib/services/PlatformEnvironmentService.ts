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
	 * Returns the LAN host serving the current Expo development bundle.
	 * This lets native development use the sibling Next.js API without a
	 * machine-specific address in source control.
	 */
	public getDevelopmentHostName(): string | null {
		if (!__DEV__) return null;

		const candidates = [Constants.expoConfig?.hostUri, Constants.linkingUri];
		for (const candidate of candidates) {
			const normalized = candidate?.trim();
			if (!normalized) continue;
			const withoutScheme = normalized.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
			const authority = withoutScheme.split('/')[0];
			const bracketedHost = authority.match(/^\[([^\]]+)\]/)?.[1];
			const hostName = bracketedHost ?? authority.split(':')[0];
			if (hostName) return hostName;
		}
		return null;
	}

	/**
	 * Checks if native Firebase App module (RNFBAppModule) is compiled and present in the binary.
	 */
	public hasNativeFirebaseApp(): boolean {
		if (Platform.OS === 'web' || this.isExpoGo()) return false;
		try {
			const hasInNativeModules = Boolean(
				NativeModules && NativeModules.RNFBAppModule
			);
			const hasInTurboModule =
				typeof TurboModuleRegistry?.get === 'function' &&
				Boolean(TurboModuleRegistry.get('RNFBAppModule'));
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
			const hasInNativeModules = Boolean(
				NativeModules && NativeModules.RNFBMessagingModule
			);
			const hasInTurboModule =
				typeof TurboModuleRegistry?.get === 'function' &&
				Boolean(TurboModuleRegistry.get('RNFBMessagingModule'));
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

export const platformEnvironmentService =
	PlatformEnvironmentService.getInstance();
