export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export type Friendship = {
    id: string;
    userId1: string;
    userId2: string;
    friendshipStatus: FriendshipStatus;
    typeOfFriendship: string; // 'friend', 'best_friend', 'family', etc.
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
};

export type FriendshipResponse = {
    success: boolean;
    data?: Friendship | Friendship[];
    error?: string;
}; 