import { db } from '@/lib/firebaseConfig';
import {
	doc,
	getDoc,
	updateDoc,
	increment,
	collection,
	query,
	where,
	getDocs,
	addDoc,
} from 'firebase/firestore';

// Define tier limits
const TIER_LIMITS = {
	1: {
		// Basic users
		posts: 3,
		comments: 10,
		likes: 20,
		canCreateCommunities: false,
		canPostProducts: false,
	},
	2: {
		// Active users
		posts: 10,
		comments: 30,
		likes: 50,
		canCreateCommunities: false,
		canPostProducts: false,
	},
	3: {
		// Power users
		posts: -1, // Unlimited
		comments: -1, // Unlimited
		likes: -1, // Unlimited
		canCreateCommunities: true,
		canPostProducts: true,
	},
	4: {
		// Premium users
		posts: -1,
		comments: -1,
		likes: -1,
		canCreateCommunities: true,
		canPostProducts: true,
	},
	5: {
		// Moderators
		posts: -1,
		comments: -1,
		likes: -1,
		canCreateCommunities: true,
		canPostProducts: true,
	},
	6: {
		// Senior Moderators
		posts: -1,
		comments: -1,
		likes: -1,
		canCreateCommunities: true,
		canPostProducts: true,
	},
	7: {
		// Admins
		posts: -1,
		comments: -1,
		likes: -1,
		canCreateCommunities: true,
		canPostProducts: true,
	},
};

// Define tier requirements for automatic promotion
const TIER_REQUIREMENTS = {
	2: {
		// Requirements to reach tier 2
		totalPosts: 10,
		totalComments: 30,
		totalLikes: 50,
		daysActive: 7,
	},
	3: {
		// Requirements to reach tier 3
		totalPosts: 30,
		totalComments: 100,
		totalLikes: 200,
		daysActive: 30,
	},
};

// Define tier names for display
const TIER_NAMES = {
	1: 'Basic User',
	2: 'Active User',
	3: 'Power User',
	4: 'Premium User',
	5: 'Moderator',
	6: 'Senior Moderator',
	7: 'Admin',
};

// Response type for tier operations
interface TierResponse {
	success: boolean;
	allowed?: boolean;
	message?: string;
	currentCount?: number;
	limit?: number;
	tierName?: string;
	data?: any;
}

class TierSystemService {
	private static instance: TierSystemService;

	private constructor() {}

	public static getInstance(): TierSystemService {
		if (!TierSystemService.instance) {
			TierSystemService.instance = new TierSystemService();
		}
		return TierSystemService.instance;
	}

	/**
	 * Check if a user can perform an action based on their tier
	 */
	async canPerformAction(
		userId: string,
		actionType:
			| 'post'
			| 'comment'
			| 'like'
			| 'create_community'
			| 'post_product',
		count: number = 1
	): Promise<TierResponse> {
		try {
			// Get user data
			const userDoc = await getDoc(doc(db, 'users', userId));
			if (!userDoc.exists()) {
				return {
					success: false,
					allowed: false,
					message: 'User not found',
				};
			}

			const userData = userDoc.data();
			const userTier = userData.userTier || 1;
			const tierName =
				TIER_NAMES[userTier as keyof typeof TIER_NAMES] || 'Basic User';

			// Get user's activity counts
			const activityRef = doc(db, 'userActivity', userId);
			const activityDoc = await getDoc(activityRef);
			const activityData = activityDoc.exists()
				? activityDoc.data()
				: {
						dailyPosts: 0,
						dailyComments: 0,
						dailyLikes: 0,
						lastResetDate: new Date().toISOString().split('T')[0],
					};

			// Reset daily counts if it's a new day
			const today = new Date().toISOString().split('T')[0];
			if (activityData.lastResetDate !== today) {
				await updateDoc(activityRef, {
					dailyPosts: 0,
					dailyComments: 0,
					dailyLikes: 0,
					lastResetDate: today,
				});
				activityData.dailyPosts = 0;
				activityData.dailyComments = 0;
				activityData.dailyLikes = 0;
			}

			// Check limits based on action type
			switch (actionType) {
				case 'post':
					const postLimit =
						TIER_LIMITS[userTier as keyof typeof TIER_LIMITS].posts;
					if (
						postLimit === -1 ||
						activityData.dailyPosts + count <= postLimit
					) {
						return {
							success: true,
							allowed: true,
							message: 'Action allowed',
							currentCount: activityData.dailyPosts,
							limit: postLimit,
							tierName,
						};
					} else {
						return {
							success: true,
							allowed: false,
							message: `You've reached your daily post limit. Upgrade to a higher tier or try again tomorrow.`,
							currentCount: activityData.dailyPosts,
							limit: postLimit,
							tierName,
						};
					}

				case 'comment':
					const commentLimit =
						TIER_LIMITS[userTier as keyof typeof TIER_LIMITS].comments;
					if (
						commentLimit === -1 ||
						activityData.dailyComments + count <= commentLimit
					) {
						return {
							success: true,
							allowed: true,
							message: 'Action allowed',
							currentCount: activityData.dailyComments,
							limit: commentLimit,
							tierName,
						};
					} else {
						return {
							success: true,
							allowed: false,
							message: `You've reached your daily comment limit. Upgrade to a higher tier or try again tomorrow.`,
							currentCount: activityData.dailyComments,
							limit: commentLimit,
							tierName,
						};
					}

				case 'like':
					const likeLimit =
						TIER_LIMITS[userTier as keyof typeof TIER_LIMITS].likes;
					if (
						likeLimit === -1 ||
						activityData.dailyLikes + count <= likeLimit
					) {
						return {
							success: true,
							allowed: true,
							message: 'Action allowed',
							currentCount: activityData.dailyLikes,
							limit: likeLimit,
							tierName,
						};
					} else {
						return {
							success: true,
							allowed: false,
							message: `You've reached your daily like limit. Upgrade to a higher tier or try again tomorrow.`,
							currentCount: activityData.dailyLikes,
							limit: likeLimit,
							tierName,
						};
					}

				case 'create_community':
					const canCreateCommunity =
						TIER_LIMITS[userTier as keyof typeof TIER_LIMITS]
							.canCreateCommunities;
					if (canCreateCommunity) {
						return {
							success: true,
							allowed: true,
							message: 'Action allowed',
							tierName,
						};
					} else {
						return {
							success: true,
							allowed: false,
							message: `Your current tier doesn't allow creating communities. Upgrade to a higher tier to unlock this feature.`,
							tierName,
						};
					}

				case 'post_product':
					const canPostProduct =
						TIER_LIMITS[userTier as keyof typeof TIER_LIMITS].canPostProducts;
					if (canPostProduct) {
						return {
							success: true,
							allowed: true,
							message: 'Action allowed',
							tierName,
						};
					} else {
						return {
							success: true,
							allowed: false,
							message: `Your current tier doesn't allow posting products. Upgrade to a higher tier to unlock this feature.`,
							tierName,
						};
					}

				default:
					return {
						success: false,
						allowed: false,
						message: 'Invalid action type',
						tierName,
					};
			}
		} catch (error) {
			console.error('Error checking tier permissions:', error);
			return {
				success: false,
				allowed: false,
				message: 'Error checking permissions',
			};
		}
	}

	/**
	 * Record a user activity and update their counts
	 */
	async recordActivity(
		userId: string,
		activityType: 'post' | 'comment' | 'like'
	): Promise<TierResponse> {
		try {
			const activityRef = doc(db, 'userActivity', userId);
			const activityDoc = await getDoc(activityRef);

			// Get today's date in YYYY-MM-DD format
			const today = new Date().toISOString().split('T')[0];

			if (activityDoc.exists()) {
				const activityData = activityDoc.data();

				// Reset daily counts if it's a new day
				if (activityData.lastResetDate !== today) {
					await updateDoc(activityRef, {
						dailyPosts: activityType === 'post' ? 1 : 0,
						dailyComments: activityType === 'comment' ? 1 : 0,
						dailyLikes: activityType === 'like' ? 1 : 0,
						lastResetDate: today,
						[`total${activityType.charAt(0).toUpperCase() + activityType.slice(1)}s`]:
							increment(1),
					});
				} else {
					// Increment the appropriate counter
					await updateDoc(activityRef, {
						[`daily${activityType.charAt(0).toUpperCase() + activityType.slice(1)}s`]:
							increment(1),
						[`total${activityType.charAt(0).toUpperCase() + activityType.slice(1)}s`]:
							increment(1),
					});
				}
			} else {
				// Create new activity document
				const newActivityData: any = {
					userId,
					dailyPosts: 0,
					dailyComments: 0,
					dailyLikes: 0,
					totalPosts: 0,
					totalComments: 0,
					totalLikes: 0,
					lastResetDate: today,
					createdAt: new Date(),
				};

				// Set the specific activity count
				newActivityData[
					`daily${activityType.charAt(0).toUpperCase() + activityType.slice(1)}s`
				] = 1;
				newActivityData[
					`total${activityType.charAt(0).toUpperCase() + activityType.slice(1)}s`
				] = 1;

				await updateDoc(activityRef, newActivityData);
			}

			// Check if user qualifies for tier upgrade
			await this.checkTierUpgrade(userId);

			return {
				success: true,
				message: 'Activity recorded successfully',
			};
		} catch (error) {
			console.error('Error recording activity:', error);
			return {
				success: false,
				message: 'Failed to record activity',
			};
		}
	}

	/**
	 * Check if a user qualifies for a tier upgrade
	 */
	async checkTierUpgrade(userId: string): Promise<TierResponse> {
		try {
			const userDoc = await getDoc(doc(db, 'users', userId));
			if (!userDoc.exists()) {
				return {
					success: false,
					message: 'User not found',
				};
			}

			const userData = userDoc.data();
			const currentTier = userData.userTier || 1;

			// Only check for automatic upgrades for tiers 1 and 2
			if (currentTier >= 3) {
				return {
					success: true,
					message: 'User already at or above tier 3',
				};
			}

			// Get user's activity data
			const activityRef = doc(db, 'userActivity', userId);
			const activityDoc = await getDoc(activityRef);

			if (!activityDoc.exists()) {
				return {
					success: true,
					message: 'No activity data found',
				};
			}

			const activityData = activityDoc.data();
			const nextTier = currentTier + 1;
			const requirements =
				TIER_REQUIREMENTS[nextTier as keyof typeof TIER_REQUIREMENTS];

			// Calculate days active
			const createdAt = userData.createdAt?.toDate() || new Date();
			const daysActive = Math.floor(
				(new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
			);

			// Check if user meets all requirements for next tier
			if (
				activityData.totalPosts >= requirements.totalPosts &&
				activityData.totalComments >= requirements.totalComments &&
				activityData.totalLikes >= requirements.totalLikes &&
				daysActive >= requirements.daysActive
			) {
				// Upgrade user to next tier
				await updateDoc(doc(db, 'users', userId), {
					userTier: nextTier,
					tierUpdatedAt: new Date(),
				});

				return {
					success: true,
					message: `User upgraded to tier ${nextTier}`,
					data: { newTier: nextTier },
				};
			}

			return {
				success: true,
				message: 'User does not qualify for tier upgrade yet',
			};
		} catch (error) {
			console.error('Error checking tier upgrade:', error);
			return {
				success: false,
				message: 'Error checking tier upgrade',
			};
		}
	}

	/**
	 * Get a user's tier information
	 */
	async getUserTierInfo(userId: string): Promise<TierResponse> {
		try {
			const userDoc = await getDoc(doc(db, 'users', userId));
			if (!userDoc.exists()) {
				return {
					success: false,
					message: 'User not found',
				};
			}

			const userData = userDoc.data();
			const userTier = userData.userTier || 1;
			const tierName = TIER_NAMES[userTier as keyof typeof TIER_NAMES];
			const tierLimits = TIER_LIMITS[userTier as keyof typeof TIER_LIMITS];

			// Get user's activity data
			const activityRef = doc(db, 'userActivity', userId);
			const activityDoc = await getDoc(activityRef);
			const activityData = activityDoc.exists()
				? activityDoc.data()
				: {
						dailyPosts: 0,
						dailyComments: 0,
						dailyLikes: 0,
						totalPosts: 0,
						totalComments: 0,
						totalLikes: 0,
					};

			// Calculate progress to next tier if applicable
			let nextTierProgress = null;
			if (userTier < 3) {
				const nextTier = userTier + 1;
				const requirements =
					TIER_REQUIREMENTS[nextTier as keyof typeof TIER_REQUIREMENTS];

				// Calculate days active
				const createdAt = userData.createdAt?.toDate() || new Date();
				const daysActive = Math.floor(
					(new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
				);

				nextTierProgress = {
					tier: nextTier,
					tierName: TIER_NAMES[nextTier as keyof typeof TIER_NAMES],
					requirements,
					current: {
						totalPosts: activityData.totalPosts || 0,
						totalComments: activityData.totalComments || 0,
						totalLikes: activityData.totalLikes || 0,
						daysActive,
					},
					percentages: {
						posts: Math.min(
							100,
							Math.round(
								((activityData.totalPosts || 0) / requirements.totalPosts) * 100
							)
						),
						comments: Math.min(
							100,
							Math.round(
								((activityData.totalComments || 0) /
									requirements.totalComments) *
									100
							)
						),
						likes: Math.min(
							100,
							Math.round(
								((activityData.totalLikes || 0) / requirements.totalLikes) * 100
							)
						),
						days: Math.min(
							100,
							Math.round((daysActive / requirements.daysActive) * 100)
						),
					},
				};
			}

			return {
				success: true,
				message: 'User tier info retrieved successfully',
				data: {
					userId,
					tier: userTier,
					tierName,
					limits: tierLimits,
					activity: {
						dailyPosts: activityData.dailyPosts || 0,
						dailyComments: activityData.dailyComments || 0,
						dailyLikes: activityData.dailyLikes || 0,
						totalPosts: activityData.totalPosts || 0,
						totalComments: activityData.totalComments || 0,
						totalLikes: activityData.totalLikes || 0,
					},
					nextTierProgress,
				},
			};
		} catch (error) {
			console.error('Error getting user tier info:', error);
			return {
				success: false,
				message: 'Error getting user tier info',
			};
		}
	}

	/**
	 * Manually set a user's tier (admin function)
	 */
	async setUserTier(
		userId: string,
		tier: number,
		adminId: string
	): Promise<TierResponse> {
		try {
			// Verify admin permissions
			const adminDoc = await getDoc(doc(db, 'users', adminId));
			if (!adminDoc.exists() || adminDoc.data().role !== 'admin') {
				return {
					success: false,
					message: 'Unauthorized: Only admins can set user tiers',
				};
			}

			// Validate tier
			if (tier < 1 || tier > 7) {
				return {
					success: false,
					message: 'Invalid tier level. Must be between 1 and 7.',
				};
			}

			// Update user's tier
			await updateDoc(doc(db, 'users', userId), {
				userTier: tier,
				tierUpdatedAt: new Date(),
				tierUpdatedBy: adminId,
			});

			// Log the tier change
			await addTierChangeLog(userId, tier, adminId);

			return {
				success: true,
				message: `User tier updated to ${tier}`,
				data: {
					newTier: tier,
					tierName: TIER_NAMES[tier as keyof typeof TIER_NAMES],
				},
			};
		} catch (error) {
			console.error('Error setting user tier:', error);
			return {
				success: false,
				message: 'Error setting user tier',
			};
		}
	}

	/**
	 * Get tier limits for a specific tier
	 */
	getTierLimits(tier: number): any {
		return TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS[1];
	}

	/**
	 * Get tier name for a specific tier
	 */
	getTierName(tier: number): string {
		return TIER_NAMES[tier as keyof typeof TIER_NAMES] || 'Unknown Tier';
	}

	/**
	 * Get all tier information for display
	 */
	getAllTierInfo(): any {
		return {
			tierNames: TIER_NAMES,
			tierLimits: TIER_LIMITS,
			tierRequirements: TIER_REQUIREMENTS,
		};
	}
}

/**
 * Helper function to add a tier change log
 */
async function addTierChangeLog(
	userId: string,
	newTier: number,
	adminId: string
): Promise<void> {
	try {
		const logRef = collection(db, 'tierChangeLogs');
		await addDoc(logRef, {
			userId,
			newTier,
			adminId,
			timestamp: new Date(),
			tierName: TIER_NAMES[newTier as keyof typeof TIER_NAMES],
		});
	} catch (error) {
		console.error('Error adding tier change log:', error);
	}
}

export const tierSystemService = TierSystemService.getInstance();
