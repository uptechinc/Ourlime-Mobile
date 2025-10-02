import { Timestamp } from "firebase/firestore";
import { UserData } from "./userTypes";

export type Friendship = {
  id: string;
  userId1: string;
  userId2: string;
  friendshipStatus: 'pending' | 'accepted' | 'declined';
  typeOfFriendship: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type Following = {
  id: string;
  followerId: string;
  followeeId: string;
  createdAt: Timestamp;
}

export type FriendWithDetails = Friendship & {
  friendDetails: UserData;
  mutualFriendsCount: number;
}

export type FollowerWithDetails = Following & {
  userDetails: UserData;
}
