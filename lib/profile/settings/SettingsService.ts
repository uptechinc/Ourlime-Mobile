import { db } from '@/lib/firebaseConfig';
import {
	doc,
	getDoc,
	setDoc,
	updateDoc,
	serverTimestamp,
} from 'firebase/firestore';

export class SettingsService {
	private static instance: SettingsService;
	private readonly db;

	private constructor() {
		console.log('SettingsService: Initializing');
		this.db = db;
	}

	public static getInstance(): SettingsService {
		console.log('SettingsService: Getting instance');
		if (!SettingsService.instance) {
			SettingsService.instance = new SettingsService();
		}
		return SettingsService.instance;
	}

	/**
	 * Get all settings for a user
	 */
	public async getAllSettings(userId: string) {
		console.log('SettingsService: Getting all settings for user', userId);

		try {
			const [account, notifications, appearance] = await Promise.all([
				this.getAccountSettings(userId),
				this.getNotificationSettings(userId),
				this.getAppearanceSettings(userId),
			]);

			console.log('SettingsService: Successfully retrieved all settings');
			return {
				account,
				notifications,
				appearance,
			};
		} catch (error: any) {
			console.error(
				'SettingsService: Error getting all settings:',
				error.message
			);
			throw new Error(`Failed to get all settings: ${error.message}`);
		}
	}

	/**
	 * Get account settings for a user
	 */
	public async getAccountSettings(userId: string) {
		console.log('SettingsService: Getting account settings for user', userId);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('SettingsService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error('SettingsService: User email not verified', userId);
				throw new Error('Email verification required');
			}

			// Get account settings - UPDATED PATH
			const settingsDoc = await getDoc(
				doc(this.db, `users/${userId}/userSettings/account`)
			);

			if (!settingsDoc.exists()) {
				console.log(
					'SettingsService: No account settings found, creating default settings'
				);
				// Create default settings if they don't exist
				const defaultSettings = {
					emailNotifications: true,
					profileVisibility: 'public',
					activityStatus: true,
					language: 'en',
					timezone: 'UTC',
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				};

				await setDoc(
					doc(this.db, `users/${userId}/userSettings/account`),
					defaultSettings
				);
				console.log('SettingsService: Default account settings created');
				return defaultSettings;
			}

			const settings = settingsDoc.data();
			console.log('SettingsService: Account settings retrieved successfully');
			return settings || {};
		} catch (error: any) {
			console.error(
				'SettingsService: Error getting account settings:',
				error.message
			);
			throw new Error(`Failed to get account settings: ${error.message}`);
		}
	}

	/**
	 * Get notification settings for a user
	 */
	public async getNotificationSettings(userId: string) {
		console.log(
			'SettingsService: Getting notification settings for user',
			userId
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('SettingsService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error('SettingsService: User email not verified', userId);
				throw new Error('Email verification required');
			}

			// Get notification settings - UPDATED PATH
			const settingsDoc = await getDoc(
				doc(this.db, `users/${userId}/userSettings/notifications`)
			);

			if (!settingsDoc.exists()) {
				console.log(
					'SettingsService: No notification settings found, creating default settings'
				);
				// Create default settings if they don't exist
				const defaultSettings = {
					pushNotifications: true,
					emailUpdates: true,
					smsAlerts: false,
					marketingEmails: false,
					newMessages: true,
					newComments: true,
					mentions: true,
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				};

				await setDoc(
					doc(this.db, `users/${userId}/userSettings/notifications`),
					defaultSettings
				);
				console.log('SettingsService: Default notification settings created');
				return defaultSettings;
			}

			const settings = settingsDoc.data();
			console.log(
				'SettingsService: Notification settings retrieved successfully'
			);
			return settings || {};
		} catch (error: any) {
			console.error(
				'SettingsService: Error getting notification settings:',
				error.message
			);
			throw new Error(`Failed to get notification settings: ${error.message}`);
		}
	}

	/**
	 * Get appearance settings for a user
	 */
	public async getAppearanceSettings(userId: string) {
		console.log(
			'SettingsService: Getting appearance settings for user',
			userId
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('SettingsService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error('SettingsService: User email not verified', userId);
				throw new Error('Email verification required');
			}

			// Get appearance settings - UPDATED PATH
			const settingsDoc = await getDoc(
				doc(this.db, `users/${userId}/userSettings/appearance`)
			);

			if (!settingsDoc.exists()) {
				console.log(
					'SettingsService: No appearance settings found, creating default settings'
				);
				// Create default settings if they don't exist
				const defaultSettings = {
					theme: 'light',
					fontSize: 'medium',
					compactMode: false,
					highContrast: false,
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				};

				await setDoc(
					doc(this.db, `users/${userId}/userSettings/appearance`),
					defaultSettings
				);
				console.log('SettingsService: Default appearance settings created');
				return defaultSettings;
			}

			const settings = settingsDoc.data();
			console.log(
				'SettingsService: Appearance settings retrieved successfully'
			);
			return settings || {};
		} catch (error: any) {
			console.error(
				'SettingsService: Error getting appearance settings:',
				error.message
			);
			throw new Error(`Failed to get appearance settings: ${error.message}`);
		}
	}

	/**
	 * Update account settings for a user
	 */
	public async updateAccountSettings(userId: string, newSettings: any) {
		console.log(
			'SettingsService: Updating account settings for user',
			userId,
			newSettings
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('SettingsService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error('SettingsService: User email not verified', userId);
				throw new Error('Email verification required');
			}

			// Get current settings - UPDATED PATH
			const settingsRef = doc(this.db, `users/${userId}/userSettings/account`);
			const settingsDoc = await getDoc(settingsRef);

			if (!settingsDoc.exists()) {
				console.log(
					'SettingsService: No settings document found, creating new one'
				);
				// Create new settings document if it doesn't exist
				const settings = {
					...newSettings,
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				};

				await setDoc(settingsRef, settings);
				console.log('SettingsService: New account settings created');
				return newSettings;
			}

			// Update existing settings
			await updateDoc(settingsRef, {
				...newSettings,
				updatedAt: serverTimestamp(),
			});

			console.log('SettingsService: Account settings updated successfully');
			return newSettings;
		} catch (error: any) {
			console.error(
				'SettingsService: Error updating account settings:',
				error.message
			);
			throw new Error(`Failed to update account settings: ${error.message}`);
		}
	}

	/**
	 * Update notification settings for a user
	 */
	public async updateNotificationSettings(userId: string, newSettings: any) {
		console.log(
			'SettingsService: Updating notification settings for user',
			userId,
			newSettings
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('SettingsService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error('SettingsService: User email not verified', userId);
				throw new Error('Email verification required');
			}

			// Get current settings - UPDATED PATH
			const settingsRef = doc(
				this.db,
				`users/${userId}/userSettings/notifications`
			);
			const settingsDoc = await getDoc(settingsRef);

			if (!settingsDoc.exists()) {
				console.log(
					'SettingsService: No settings document found, creating new one'
				);
				// Create new settings document if it doesn't exist
				const settings = {
					...newSettings,
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				};

				await setDoc(settingsRef, settings);
				console.log('SettingsService: New notification settings created');
				return newSettings;
			}

			// Update existing settings
			await updateDoc(settingsRef, {
				...newSettings,
				updatedAt: serverTimestamp(),
			});

			console.log(
				'SettingsService: Notification settings updated successfully'
			);
			return newSettings;
		} catch (error: any) {
			console.error(
				'SettingsService: Error updating notification settings:',
				error.message
			);
			throw new Error(
				`Failed to update notification settings: ${error.message}`
			);
		}
	}

	/**
	 * Update appearance settings for a user
	 */
	public async updateAppearanceSettings(userId: string, newSettings: any) {
		console.log(
			'SettingsService: Updating appearance settings for user',
			userId,
			newSettings
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('SettingsService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error('SettingsService: User email not verified', userId);
				throw new Error('Email verification required');
			}

			// Get current settings - UPDATED PATH
			const settingsRef = doc(
				this.db,
				`users/${userId}/userSettings/appearance`
			);
			const settingsDoc = await getDoc(settingsRef);

			if (!settingsDoc.exists()) {
				console.log(
					'SettingsService: No settings document found, creating new one'
				);
				// Create new settings document if it doesn't exist
				const settings = {
					...newSettings,
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				};

				await setDoc(settingsRef, settings);
				console.log('SettingsService: New appearance settings created');
				return newSettings;
			}

			// Update existing settings
			await updateDoc(settingsRef, {
				...newSettings,
				updatedAt: serverTimestamp(),
			});

			console.log('SettingsService: Appearance settings updated successfully');
			return newSettings;
		} catch (error: any) {
			console.error(
				'SettingsService: Error updating appearance settings:',
				error.message
			);
			throw new Error(`Failed to update appearance settings: ${error.message}`);
		}
	}
}
