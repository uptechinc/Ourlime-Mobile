import { auth, db } from '@/lib/firebaseConfig';
import {
	doc,
	getDoc,
	setDoc,
	updateDoc,
	serverTimestamp,
	arrayUnion,
	Timestamp,
} from 'firebase/firestore';

import { 
    EmailAuthProvider, 
    reauthenticateWithCredential, 
    updatePassword 
} from 'firebase/auth';

interface SecurityActivity {
	type: string;
	timestamp: Date;
	successful: boolean;
	ipAddress?: string;
	deviceInfo?: string;
	location?: string;
    reason?: string; 
    details?: any; 
}

interface ConnectedAccount {
	id: string;
	connected: boolean;
	provider?: string;
	lastUpdated?: Timestamp;
}

export class PrivacyAndSecurityService {
	private static instance: PrivacyAndSecurityService;
	private readonly db;

	private constructor() {
		console.log('PrivacyAndSecurityService: Initializing');
		this.db = db;
	}

	public static getInstance(): PrivacyAndSecurityService {
		console.log('PrivacyAndSecurityService: Getting instance');
		if (!PrivacyAndSecurityService.instance) {
			PrivacyAndSecurityService.instance = new PrivacyAndSecurityService();
		}
		return PrivacyAndSecurityService.instance;
	}

	/**
	 * Get all security and privacy settings for a user
	 */
	public async getAllSettings(userId: string) {
		console.log(
			'PrivacyAndSecurityService: Getting all settings for user',
			userId
		);

		try {
			const [security, privacy, connectedAccounts, loginActivity] =
				await Promise.all([
					this.getSecuritySettings(userId),
					this.getPrivacySettings(userId),
					this.getConnectedAccounts(userId),
					this.getLoginActivity(userId),
				]);

			console.log(
				'PrivacyAndSecurityService: Successfully retrieved all settings'
			);
			return {
				security,
				privacy,
				connectedAccounts,
				loginActivity,
			};
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error getting all settings:',
				error.message
			);
			throw new Error(`Failed to get all settings: ${error.message}`);
		}
	}

	/**
	 * Get security settings for a user
	 */
	public async getSecuritySettings(userId: string) {
		console.log(
			'PrivacyAndSecurityService: Getting security settings for user',
			userId
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('PrivacyAndSecurityService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error(
					'PrivacyAndSecurityService: User email not verified',
					userId
				);
				throw new Error('Email verification required');
			}

			// Get security settings - UPDATED PATH
			const securityDoc = await getDoc(
				doc(this.db, `users/${userId}/userSecuritySettings/security`)
			);

			if (!securityDoc.exists()) {
				console.log(
					'PrivacyAndSecurityService: No security settings found, creating default settings'
				);
				// Create default settings if they don't exist
				const defaultSettings = {
					twoFactorEnabled: false,
					twoFactorMethod: null,
					lastPasswordChange: null,
					passwordStrength: 'medium',
					loginNotifications: true,
					suspiciousActivityAlerts: true,
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				};

				await setDoc(
					doc(this.db, `users/${userId}/userSecuritySettings/security`),
					defaultSettings
				);
				console.log(
					'PrivacyAndSecurityService: Default security settings created'
				);
				return defaultSettings;
			}

			const settings = securityDoc.data();
			console.log(
				'PrivacyAndSecurityService: Security settings retrieved successfully'
			);
			return settings;
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error getting security settings:',
				error.message
			);
			throw new Error(`Failed to get security settings: ${error.message}`);
		}
	}

	/**
	 * Get privacy settings for a user
	 */
	public async getPrivacySettings(userId: string) {
		console.log(
			'PrivacyAndSecurityService: Getting privacy settings for user',
			userId
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('PrivacyAndSecurityService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error(
					'PrivacyAndSecurityService: User email not verified',
					userId
				);
				throw new Error('Email verification required');
			}

			// Get privacy settings - UPDATED PATH
			const privacyDoc = await getDoc(
				doc(this.db, `users/${userId}/userPrivacySettings/privacy`)
			);

			if (!privacyDoc.exists()) {
				console.log(
					'PrivacyAndSecurityService: No privacy settings found, creating default settings'
				);
				// Create default settings if they don't exist
				const defaultSettings = {
					profileVisibility: 'public',
					activityStatus: true,
					searchVisibility: true,
					messagePermissions: 'everyone',
					dataSharing: {
						analytics: true,
						marketing: false,
						thirdParty: false,
					},
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				};

				await setDoc(
					doc(this.db, `users/${userId}/userPrivacySettings/privacy`),
					defaultSettings
				);
				console.log(
					'PrivacyAndSecurityService: Default privacy settings created'
				);
				return defaultSettings;
			}

			const settings = privacyDoc.data();
			console.log(
				'PrivacyAndSecurityService: Privacy settings retrieved successfully'
			);
			return settings;
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error getting privacy settings:',
				error.message
			);
			throw new Error(`Failed to get privacy settings: ${error.message}`);
		}
	}

	/**
	 * Get connected accounts for a user
	 */
	public async getConnectedAccounts(userId: string) {
		console.log(
			'PrivacyAndSecurityService: Getting connected accounts for user',
			userId
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('PrivacyAndSecurityService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error(
					'PrivacyAndSecurityService: User email not verified',
					userId
				);
				throw new Error('Email verification required');
			}

			// Get connected accounts - UPDATED PATH
			const accountsDoc = await getDoc(
				doc(this.db, `users/${userId}/userConnectedAccounts/accounts`)
			);

			if (!accountsDoc.exists()) {
				console.log(
					'PrivacyAndSecurityService: No connected accounts found, creating default entry'
				);
				// Create default entry if it doesn't exist
				const defaultAccounts = {
					accounts: [
						{ id: 'google', connected: false },
						{ id: 'facebook', connected: false },
						{ id: 'twitter', connected: false },
						{ id: 'github', connected: false },
						{ id: 'apple', connected: false },
					],
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				};

				await setDoc(
					doc(this.db, `users/${userId}/userConnectedAccounts/accounts`),
					defaultAccounts
				);
				console.log(
					'PrivacyAndSecurityService: Default connected accounts created'
				);
				return defaultAccounts.accounts;
			}

			const accounts = accountsDoc.data();
			console.log(
				'PrivacyAndSecurityService: Connected accounts retrieved successfully'
			);
			return accounts.accounts || [];
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error getting connected accounts:',
				error.message
			);
			throw new Error(`Failed to get connected accounts: ${error.message}`);
		}
	}

	/**
	 * Get login activity for a user
	 */
	public async getLoginActivity(userId: string) {
		console.log(
			'PrivacyAndSecurityService: Getting login activity for user',
			userId
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('PrivacyAndSecurityService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error(
					'PrivacyAndSecurityService: User email not verified',
					userId
				);
				throw new Error('Email verification required');
			}

			// Get login activity - UPDATED PATH
			const activityDoc = await getDoc(
				doc(this.db, `users/${userId}/userSecuritySettings/loginHistory`)
			);

			if (!activityDoc.exists()) {
				console.log(
					'PrivacyAndSecurityService: No login activity found, creating empty activity log'
				);
				// Create empty activity log if it doesn't exist
				const emptyActivity = {
					activities: [],
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				};

				await setDoc(
					doc(this.db, `users/${userId}/userSecuritySettings/loginHistory`),
					emptyActivity
				);
				console.log('PrivacyAndSecurityService: Empty activity log created');
				return [];
			}

			const activity = activityDoc.data();
			console.log(
				'PrivacyAndSecurityService: Login activity retrieved successfully'
			);
			return activity.activities || [];
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error getting login activity:',
				error.message
			);
			throw new Error(`Failed to get login activity: ${error.message}`);
		}
	}

	/**
	 * Enable two-factor authentication for a user
	 */
	public async enableTwoFactor(
		userId: string,
		method: string,
		phoneNumber?: string
	) {
		console.log(
			'PrivacyAndSecurityService: Enabling two-factor authentication for user',
			userId,
			method
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('PrivacyAndSecurityService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error(
					'PrivacyAndSecurityService: User email not verified',
					userId
				);
				throw new Error('Email verification required');
			}

			// Validate method
			if (!['sms', 'app', 'email'].includes(method)) {
				console.error(
					'PrivacyAndSecurityService: Invalid two-factor method',
					method
				);
				throw new Error(
					'Invalid two-factor method. Must be sms, app, or email'
				);
			}

			// If method is SMS, phone number is required
			if (method === 'sms' && !phoneNumber) {
				console.error(
					'PrivacyAndSecurityService: Phone number required for SMS two-factor'
				);
				throw new Error(
					'Phone number is required for SMS two-factor authentication'
				);
			}

			// Update security settings - UPDATED PATH
			const securityRef = doc(
				this.db,
				`users/${userId}/userSecuritySettings/security`
			);
			const securityDoc = await getDoc(securityRef);

			const twoFactorSettings = {
				twoFactorEnabled: true,
				twoFactorMethod: method,
				twoFactorPhoneNumber: method === 'sms' ? phoneNumber : null,
				updatedAt: serverTimestamp(),
			};

			if (!securityDoc.exists()) {
				console.log(
					'PrivacyAndSecurityService: No security settings found, creating new settings'
				);
				// Create new security settings if they don't exist
				await setDoc(securityRef, {
					...twoFactorSettings,
					loginNotifications: true,
					suspiciousActivityAlerts: true,
					createdAt: serverTimestamp(),
				});
			} else {
				console.log(
					'PrivacyAndSecurityService: Updating existing security settings'
				);
				// Update existing security settings
				await updateDoc(securityRef, twoFactorSettings);
			}

			// Log the security activity
			await this.logSecurityActivity(userId, {
				type: 'two_factor_enabled',
				timestamp: new Date(),
				successful: true,
			});

			console.log(
				'PrivacyAndSecurityService: Two-factor authentication enabled successfully'
			);
			return { success: true, method };
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error enabling two-factor:',
				error.message
			);
			throw new Error(
				`Failed to enable two-factor authentication: ${error.message}`
			);
		}
	}

	/**
	 * Disable two-factor authentication for a user
	 */
	public async disableTwoFactor(userId: string) {
		console.log(
			'PrivacyAndSecurityService: Disabling two-factor authentication for user',
			userId
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('PrivacyAndSecurityService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error(
					'PrivacyAndSecurityService: User email not verified',
					userId
				);
				throw new Error('Email verification required');
			}

			// Update security settings - UPDATED PATH
			const securityRef = doc(
				this.db,
				`users/${userId}/userSecuritySettings/security`
			);
			const securityDoc = await getDoc(securityRef);

			if (!securityDoc.exists()) {
				console.error('PrivacyAndSecurityService: No security settings found');
				throw new Error('Security settings not found');
			}

			// Update security settings
			await updateDoc(securityRef, {
				twoFactorEnabled: false,
				twoFactorMethod: null,
				twoFactorPhoneNumber: null,
				updatedAt: serverTimestamp(),
			});

			// Log the security activity
			await this.logSecurityActivity(userId, {
				type: 'two_factor_disabled',
				timestamp: new Date(),
				successful: true,
			});
			console.log(
				'PrivacyAndSecurityService: Two-factor authentication disabled successfully'
			);
			return { success: true };
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error disabling two-factor:',
				error.message
			);
			throw new Error(
				`Failed to disable two-factor authentication: ${error.message}`
			);
		}
	}
	/**
	 * Update privacy settings for a user
	 */
	public async updatePrivacySettings(userId: string, newSettings: any) {
		console.log(
			'PrivacyAndSecurityService: Updating privacy settings for user',
			userId,
			newSettings
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('PrivacyAndSecurityService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error(
					'PrivacyAndSecurityService: User email not verified',
					userId
				);
				throw new Error('Email verification required');
			}

			// Validate privacy settings
			if (!newSettings) {
				console.error('PrivacyAndSecurityService: Invalid privacy settings');
				throw new Error('Invalid privacy settings');
			}

			// Update privacy settings - UPDATED PATH
			const privacyRef = doc(
				this.db,
				`users/${userId}/userPrivacySettings/privacy`
			);
			const privacyDoc = await getDoc(privacyRef);

			if (!privacyDoc.exists()) {
				console.log(
					'PrivacyAndSecurityService: No privacy settings found, creating new settings'
				);
				// Create new privacy settings if they don't exist
				await setDoc(privacyRef, {
					...newSettings,
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				});
			} else {
				console.log(
					'PrivacyAndSecurityService: Updating existing privacy settings'
				);
				// Update existing privacy settings
				await updateDoc(privacyRef, {
					...newSettings,
					updatedAt: serverTimestamp(),
				});
			}

			console.log(
				'PrivacyAndSecurityService: Privacy settings updated successfully'
			);
			return { success: true, settings: newSettings };
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error updating privacy settings:',
				error.message
			);
			throw new Error(`Failed to update privacy settings: ${error.message}`);
		}
	}

	/**
	 * Connect a third-party account
	 */
	public async connectAccount(userId: string, account: ConnectedAccount) {
		console.log(
			'PrivacyAndSecurityService: Connecting account for user',
			userId,
			account
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('PrivacyAndSecurityService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error(
					'PrivacyAndSecurityService: User email not verified',
					userId
				);
				throw new Error('Email verification required');
			}

			// Validate account
			if (!account || !account.id) {
				console.error('PrivacyAndSecurityService: Invalid account data');
				throw new Error('Invalid account data');
			}

			// Get connected accounts - UPDATED PATH
			const accountsRef = doc(
				this.db,
				`users/${userId}/userConnectedAccounts/accounts`
			);
			const accountsDoc = await getDoc(accountsRef);

			if (!accountsDoc.exists()) {
				console.log(
					'PrivacyAndSecurityService: No connected accounts found, creating new entry'
				);
				// Create new connected accounts entry if it doesn't exist
				const newAccount = {
					...account,
					connected: true,
					lastUpdated: Timestamp.now(),
				};

				await setDoc(accountsRef, {
					accounts: [newAccount],
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				});

				console.log(
					'PrivacyAndSecurityService: New connected accounts entry created'
				);
				return newAccount;
			}

			// Update existing connected accounts
			const accounts = accountsDoc.data().accounts || [];
			const existingIndex = accounts.findIndex((a: any) => a.id === account.id);

			if (existingIndex >= 0) {
				console.log(
					'PrivacyAndSecurityService: Updating existing account connection'
				);
				// Update existing account
				accounts[existingIndex] = {
					...accounts[existingIndex],
					connected: true,
					lastUpdated: Timestamp.now(),
				};
			} else {
				console.log('PrivacyAndSecurityService: Adding new account connection');
				// Add new account
				accounts.push({
					...account,
					connected: true,
					lastUpdated: Timestamp.now(),
				});
			}

			await updateDoc(accountsRef, {
				accounts,
				updatedAt: serverTimestamp(),
			});

			// Log the security activity
			await this.logSecurityActivity(userId, {
				type: 'account_connected',
				timestamp: new Date(),
				successful: true,
			});

			console.log('PrivacyAndSecurityService: Account connected successfully');
			return { success: true, accountId: account.id };
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error connecting account:',
				error.message
			);
			throw new Error(`Failed to connect account: ${error.message}`);
		}
	}

	/**
	 * Disconnect a third-party account
	 */
	public async disconnectAccount(userId: string, accountId: string) {
		console.log(
			'PrivacyAndSecurityService: Disconnecting account for user',
			userId,
			accountId
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('PrivacyAndSecurityService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error(
					'PrivacyAndSecurityService: User email not verified',
					userId
				);
				throw new Error('Email verification required');
			}

			// Validate account ID
			if (!accountId) {
				console.error('PrivacyAndSecurityService: Invalid account ID');
				throw new Error('Invalid account ID');
			}

			// Get connected accounts - UPDATED PATH
			const accountsRef = doc(
				this.db,
				`users/${userId}/userConnectedAccounts/accounts`
			);
			const accountsDoc = await getDoc(accountsRef);

			if (!accountsDoc.exists()) {
				console.error('PrivacyAndSecurityService: No connected accounts found');
				throw new Error('No connected accounts found');
			}

			// Update existing connected accounts
			const accounts = accountsDoc.data().accounts || [];
			const existingIndex = accounts.findIndex((a: any) => a.id === accountId);

			if (existingIndex < 0) {
				console.error('PrivacyAndSecurityService: Account not found');
				throw new Error('Account not found');
			}

			console.log(
				'PrivacyAndSecurityService: Updating account connection status'
			);
			// Update account connection status
			accounts[existingIndex] = {
				...accounts[existingIndex],
				connected: false,
				lastUpdated: Timestamp.now(),
			};

			await updateDoc(accountsRef, {
				accounts,
				updatedAt: serverTimestamp(),
			});

			// Log the security activity
			await this.logSecurityActivity(userId, {
				type: 'account_disconnected',
				timestamp: new Date(),
				successful: true,
			});

			console.log(
				'PrivacyAndSecurityService: Account disconnected successfully'
			);
			return { success: true, accountId };
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error disconnecting account:',
				error.message
			);
			throw new Error(`Failed to disconnect account: ${error.message}`);
		}
	}

	/**
	 * Log security activity for a user
	 */
    public async logSecurityActivity(userId: string, activity: SecurityActivity) {
        console.log('PrivacyAndSecurityService: Logging security activity for user', userId, activity);
        
        try {
            // Filter out any undefined values from the activity object
            const cleanActivity = Object.fromEntries(
                Object.entries(activity).filter(([_, value]) => value !== undefined)
            ) as SecurityActivity;
            
            const historyRef = doc(this.db, `users/${userId}/userSecuritySettings/loginHistory`);
            const historyDoc = await getDoc(historyRef);
            
            if (!historyDoc.exists()) {
                console.log('PrivacyAndSecurityService: Creating new activity log');
                await setDoc(historyRef, {
                    activities: [cleanActivity],
                    updatedAt: serverTimestamp()
                });
            } else {
                console.log('PrivacyAndSecurityService: Updating existing activity log');
                await updateDoc(historyRef, {
                    activities: arrayUnion(cleanActivity),
                    updatedAt: serverTimestamp()
                });
            }
            
            console.log('PrivacyAndSecurityService: Security activity logged successfully');
        } catch (error: any) {
            console.error('PrivacyAndSecurityService: Error logging security activity:', error.message);
            throw new Error(`Failed to log security activity: ${error.message}`);
        }
    }
    

	/**
	 * Change user password
	 */
	public async changePassword(
		userId: string,
		currentPassword: string,
		newPassword: string
	) {
		console.log(
			'PrivacyAndSecurityService: Changing password for user',
			userId
		);

		try {
			// Check if user exists and is verified
			const userDoc = await getDoc(doc(this.db, 'users', userId));
			if (!userDoc.exists()) {
				console.error('PrivacyAndSecurityService: User not found', userId);
				throw new Error('User not found');
			}

			const userData = userDoc.data();
			if (!userData.emailVerified) {
				console.error(
					'PrivacyAndSecurityService: User email not verified',
					userId
				);
				throw new Error('Email verification required');
			}

			// Get current user from Firebase Auth
			const user = auth.currentUser;
			if (!user) {
				console.error('PrivacyAndSecurityService: No authenticated user');
				throw new Error('No authenticated user');
			}

			// Verify current password by reauthenticating the user
			const credential = EmailAuthProvider.credential(
				user.email!,
				currentPassword
			);
			await reauthenticateWithCredential(user, credential);

			// Update password
			await updatePassword(user, newPassword);

			// Log the security activity
			await this.logSecurityActivity(userId, {
				type: 'password_changed',
				timestamp: new Date(),
				successful: true,
			});

			console.log('PrivacyAndSecurityService: Password changed successfully');
			return { success: true };
		} catch (error: any) {
			console.error(
				'PrivacyAndSecurityService: Error changing password:',
				error.message
			);

			// Log failed attempt
			try {
				await this.logSecurityActivity(userId, {
					type: 'password_change_failed',
					timestamp: new Date(),
					successful: false,
					reason: error.message,
				});
			} catch (logError) {
				console.error(
					'PrivacyAndSecurityService: Error logging failed password change:',
					logError
				);
			}

			// Map Firebase Auth errors to user-friendly messages
			if (error.code === 'auth/wrong-password') {
				throw new Error('Current password is incorrect');
			} else if (error.code === 'auth/weak-password') {
				throw new Error(
					'New password is too weak. It should be at least 6 characters'
				);
			} else if (error.code === 'auth/requires-recent-login') {
				throw new Error(
					'This operation requires recent authentication. Please log in again before retrying'
				);
			}

			throw new Error(`Failed to change password: ${error.message}`);
		}
	}
}
