type RelationshipStatus = {
    isFriend: boolean;
    isFollowing: boolean;
    friendshipStatus: 'none' | 'pending' | 'accepted' | 'declined';
    mutualFriends: number;
    mutualFollowers: number;
};

type NetworkStats = {
    friendsCount: number;
    followersCount: number;
    followingCount: number;
};

export const relationshipHelpers = {
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
