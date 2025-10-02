import { friendshipService } from '@/lib/relationships/friendshipService';
import { followService } from '@/lib/relationships/followService';
import { relationshipQueries } from '@/lib/relationships/relationshipQueries';
import { Friendship, Following, FriendWithDetails, FollowerWithDetails } from '@/types/friendTypes';

interface RelationshipStatus {
    isFriend: boolean;
    isFollowing: boolean;
    friendshipStatus: 'none' | 'pending' | 'accepted' | 'declined';
    mutualFriends: number;
    mutualFollowers: number;
}

interface NetworkStats {
    friendsCount: number;
    followersCount: number;
    followingCount: number;
}

export const relationshipHelpers = {
    async getRelationshipStatus(currentUserId: string, targetUserId: string): Promise<RelationshipStatus> {
        const [friendship, follow, connections] = await Promise.all([
            friendshipService.getFriendshipStatus(currentUserId, targetUserId),
            followService.getFollowStatus(currentUserId, targetUserId),
            relationshipQueries.getCommonConnections(currentUserId, targetUserId)
        ]);
    
        // First convert to unknown, then to the correct Friendship type
        const friendshipData = Array.isArray(friendship.data) 
            ? (friendship.data[0] as unknown as Friendship)
            : (friendship.data as unknown as Friendship);
    
        // First convert to unknown, then to the correct Following type    
        const followData = Array.isArray(follow.data)
            ? (follow.data[0] as unknown as Following)
            : (follow.data as unknown as Following);
    
        const status: RelationshipStatus = {
            isFriend: friendshipData?.friendshipStatus === 'accepted',
            isFollowing: Boolean(followData),
            friendshipStatus: friendshipData?.friendshipStatus || 'none',
            mutualFriends: connections.data?.mutualFriends?.length || 0,
            mutualFollowers: connections.data?.mutualFollowers?.length || 0
        };
    
        return status;
    },    

    async getNetworkStats(userId: string): Promise<NetworkStats> {
        const stats = await relationshipQueries.getUserNetworkStats(userId);
        return {
            friendsCount: stats.data?.friends || 0,
            followersCount: stats.data?.followers || 0,
            followingCount: stats.data?.following || 0
        };
    },

    formatRelationshipButton(status: RelationshipStatus): {
        text: string;
        action: 'unfriend' | 'cancel' | 'send-request';
        variant: 'primary' | 'secondary' | 'outline';
    } {
        if (status.isFriend) {
            return {
                text: 'Friends',
                action: 'unfriend',
                variant: 'secondary'
            };
        }

        if (status.friendshipStatus === 'pending') {
            return {
                text: 'Request Sent',
                action: 'cancel',
                variant: 'outline'
            };
        }

        return {
            text: 'Add Friend',
            action: 'send-request',
            variant: 'primary'
        };
    },

    formatFollowButton(isFollowing: boolean): {
        text: string;
        action: 'follow' | 'unfollow';
        variant: 'primary' | 'secondary';
    } {
        return {
            text: isFollowing ? 'Following' : 'Follow',
            action: isFollowing ? 'unfollow' : 'follow',
            variant: isFollowing ? 'secondary' : 'primary'
        };
    },

    async checkMutualConnections(userId1: string, userId2: string) {
        const connections = await relationshipQueries.getCommonConnections(userId1, userId2);
        return {
            mutualFriends: connections.data?.mutualFriends || [],
            mutualFollowers: connections.data?.mutualFollowers || [],
            mutualFollowing: connections.data?.mutualFollowing || [],
            commonCommunities: connections.data?.commonCommunities || [],
            commonEvents: connections.data?.commonEvents || []
        };
    },

    getRelationshipMetrics(stats: NetworkStats) {
        return {
            totalConnections: stats.friendsCount + stats.followersCount,
            engagementScore: calculateEngagementScore(stats),
            networkStrength: getNetworkStrength(stats)
        };
    }
};

function calculateEngagementScore(stats: NetworkStats): number {
    const total = stats.friendsCount + stats.followersCount + stats.followingCount;
    const ratio = (stats.followersCount / (stats.followingCount || 1));
    return Math.round((total * ratio) / 10);
}

function getNetworkStrength(stats: NetworkStats): 'weak' | 'moderate' | 'strong' {
    const score = calculateEngagementScore(stats);
    if (score < 30) return 'weak';
    if (score < 70) return 'moderate';
    return 'strong';
}

export default relationshipHelpers;
