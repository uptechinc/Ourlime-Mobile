import { tierSystemService } from '@/lib/tierSystem/TierSystemService';
import { auth } from '@/lib/firebaseConfig';
import { useProfileStore } from '@/src/store/useProfileStore';

/**
 * UserTierHelper - A simplified interface for tier-related functionality
 *
 * This helper provides easy-to-use methods for checking tier permissions
 * and recording user activities without needing to directly interact with
 * the TierSystemService.
 */
export class UserTierHelper {
	/**
	 * Check if the current user can perform a specific action
	 *
	 * @param actionType The type of action to check (post, comment, like, etc.)
	 * @param count The number of actions to check (default: 1)
	 * @returns Promise with the result of the check
	 */
	static async canCurrentUserPerformAction(
		actionType:
			| 'post'
			| 'comment'
			| 'like'
			| 'create_community'
			| 'post_product',
		count: number = 1
	) {
		const user = auth.currentUser;
		if (!user) {
			return {
				success: false,
				allowed: false,
				message: 'User not authenticated',
			};
		}

		return await tierSystemService.canPerformAction(
			user.uid,
			actionType,
			count
		);
	}

	/**
	 * Check if a specific user can perform an action
	 *
	 * @param userId The ID of the user to check
	 * @param actionType The type of action to check
	 * @param count The number of actions to check (default: 1)
	 * @returns Promise with the result of the check
	 */
	static async canUserPerformAction(
		userId: string,
		actionType:
			| 'post'
			| 'comment'
			| 'like'
			| 'create_community'
			| 'post_product',
		count: number = 1
	) {
		if (!userId) {
			return {
				success: false,
				allowed: false,
				message: 'User ID is required',
			};
		}

		return await tierSystemService.canPerformAction(userId, actionType, count);
	}

	/**
	 * Record an activity for the current user
	 *
	 * @param activityType The type of activity to record
	 * @returns Promise with the result of recording the activity
	 */
	static async recordCurrentUserActivity(
		activityType: 'post' | 'comment' | 'like'
	) {
		const user = auth.currentUser;
		if (!user) {
			return {
				success: false,
				message: 'User not authenticated',
			};
		}

		return await tierSystemService.recordActivity(user.uid, activityType);
	}

	/**
	 * Record an activity for a specific user
	 *
	 * @param userId The ID of the user
	 * @param activityType The type of activity to record
	 * @returns Promise with the result of recording the activity
	 */
	static async recordUserActivity(
		userId: string,
		activityType: 'post' | 'comment' | 'like'
	) {
		if (!userId) {
			return {
				success: false,
				message: 'User ID is required',
			};
		}

		return await tierSystemService.recordActivity(userId, activityType);
	}

	/**
	 * Get tier information for the current user
	 *
	 * @returns Promise with the user's tier information
	 */
	static async getCurrentUserTierInfo() {
		const user = auth.currentUser;
		if (!user) {
			return {
				success: false,
				message: 'User not authenticated',
			};
		}

		return await tierSystemService.getUserTierInfo(user.uid);
	}

	/**
	 * Get tier information for a specific user
	 *
	 * @param userId The ID of the user
	 * @returns Promise with the user's tier information
	 */
	static async getUserTierInfo(userId: string) {
		if (!userId) {
			return {
				success: false,
				message: 'User ID is required',
			};
		}

		return await tierSystemService.getUserTierInfo(userId);
	}

	/**
	 * Set a user's tier (admin only)
	 *
	 * @param userId The ID of the user to update
	 * @param tier The new tier level
	 * @returns Promise with the result of setting the tier
	 */
	static async setUserTier(userId: string, tier: number) {
		const adminUser = auth.currentUser;
		if (!adminUser) {
			return {
				success: false,
				message: 'Admin not authenticated',
			};
		}

		return await tierSystemService.setUserTier(userId, tier, adminUser.uid);
	}

	/**
	 * Get the name of a specific tier
	 *
	 * @param tier The tier number
	 * @returns The name of the tier
	 */
	static getTierName(tier: number): string {
		return tierSystemService.getTierName(tier);
	}

	/**
	 * Get the limits for a specific tier
	 *
	 * @param tier The tier number
	 * @returns The limits for the tier
	 */
	static getTierLimits(tier: number): any {
		return tierSystemService.getTierLimits(tier);
	}

	/**
	 * Get information about all tiers
	 *
	 * @returns Information about all tiers
	 */
	static getAllTierInfo(): any {
		return tierSystemService.getAllTierInfo();
	}

	/**
	 * Check if the current user has reached their daily limit for an action
	 *
	 * @param actionType The type of action to check
	 * @returns Promise with information about the user's limits
	 */
	static async getCurrentUserLimits(actionType: 'post' | 'comment' | 'like') {
		const tierInfo = await this.getCurrentUserTierInfo();
		if (!tierInfo.success) {
			return {
				success: false,
				message: tierInfo.message,
			};
		}

		const { tier, activity, limits } = tierInfo.data;
		const limitValue = limits[`${actionType}s`];
		const currentCount =
			activity[
				`daily${actionType.charAt(0).toUpperCase() + actionType.slice(1)}s`
			];

		return {
			success: true,
			data: {
				currentCount,
				limit: limitValue,
				remaining: limitValue === -1 ? -1 : limitValue - currentCount,
				unlimited: limitValue === -1,
				percentUsed:
					limitValue === -1 ? 0 : Math.round((currentCount / limitValue) * 100),
			},
		};
	}

	/**
	 * Format a user-friendly message about tier limits
	 *
	 * @param actionType The type of action
	 * @param tierInfo The tier information from getCurrentUserLimits
	 * @returns A user-friendly message
	 */
	static formatLimitMessage(
		actionType: 'post' | 'comment' | 'like',
		tierInfo: any
	): string {
		if (!tierInfo.success) {
			return 'Unable to check limits';
		}

		const { currentCount, limit, remaining, unlimited } = tierInfo.data;

		if (unlimited) {
			return `You have unlimited ${actionType}s with your current tier`;
		}

		return `You have used ${currentCount} of ${limit} daily ${actionType}s (${remaining} remaining)`;
	}

	/**
	 * Check if the current user has admin access to a specific page using Zustand store
	 *
	 * @param requiredTier The minimum tier required (default: 7 for admin pages)
	 * @param requireEmailVerified Whether email verification is required (default: true)
	 * @returns Object with success status and message
	 */
	static hasAdminAccessFromStore(
		requiredTier: number = 7,
		requireEmailVerified: boolean = true
	) {
		// Get current state from Zustand
		const store = useProfileStore.getState();

		// Check if user is authenticated
		if (!store.isAuthenticated) {
			return {
				success: false,
				message: 'User not authenticated',
				redirect: '/login',
			};
		}

		// Check email verification if required
		if (requireEmailVerified && !store.emailVerified) {
			return {
				success: false,
				message: 'Email verification required to access admin pages',
				redirect: '/profile',
			};
		}

		// Check if user has admin role and required tier
		const isAdmin = store.role === 'admin';
		const hasSufficientTier = store.userTier >= requiredTier;

		if (!isAdmin) {
			return {
				success: false,
				message: 'Admin role required to access this page',
				redirect: '/',
			};
		}

		if (!hasSufficientTier) {
			return {
				success: false,
				message: `Admin tier ${requiredTier} required to access this page`,
				redirect: '/',
			};
		}

		return {
			success: true,
			message: 'Access granted',
			data: {
				tier: store.userTier,
				role: store.role,
				emailVerified: store.emailVerified,
			},
		};
	}
}
