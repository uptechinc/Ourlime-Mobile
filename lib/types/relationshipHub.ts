export type RelationshipHubSection = 'friends' | 'requests' | 'active' | 'following' | 'followers' | 'suggestions';
export type PresenceState = { status: 'online' | 'offline'; lastActiveMs: number | null; activityStatus: boolean };
export type RelationshipDirection = 'incoming' | 'outgoing' | 'none';
export type RelationshipRequestDirection = 'incoming' | 'outgoing';
export type RelationshipHubUser = {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  profileImage?: string;
  relationshipId?: string;
  direction: RelationshipDirection;
  mutualCount: number;
  presence: PresenceState;
  permissions: { accept: boolean; decline: boolean; cancel: boolean; remove: boolean; follow: boolean; unfollow: boolean };
};
export type RelationshipHubPage = { items: RelationshipHubUser[]; nextCursor: string | null; hasMore: boolean };
