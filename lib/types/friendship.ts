export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export type Friendship = {
    id: string;
    userId1: string;
    userId2: string;
    friendshipStatus: FriendshipStatus;
    typeOfFriendship: string; // 'friend', 'best_friend', 'family', etc.
    createdAt: unknown;
    updatedAt: unknown;
};

export type FriendshipResponse = {
    success: boolean;
    data?: Friendship | Friendship[];
    error?: string;
};
