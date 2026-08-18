export type CommunityDirectoryScope = 'all' | 'joined' | 'friends' | 'new' | 'created';
export type CommunityDirectoryVisibility = 'all' | 'public' | 'private';
export type CommunityDirectorySort = 'popular' | 'newest' | 'active' | 'trending';
export type CommunityDirectoryViewMode = 'grid' | 'list';
export type CommunityMemberRole = 'owner' | 'admin' | 'moderator' | 'member' | 'none';
export type CommunityMembershipState = 'owner' | 'member' | 'pending' | 'declined' | 'banned' | 'none';
export type CommunityTab = 'posts' | 'events' | 'polls' | 'about' | 'members';

export type CommunityPersonPreview = {
  userId: string;
  firstName: string;
  lastName: string;
  userName: string;
  profilePicture: string | null;
};

export type CommunityPermissionSet = {
  canView: boolean;
  canJoin: boolean;
  canRequestAccess: boolean;
  canCancelRequest: boolean;
  canLeave: boolean;
  canPost: boolean;
  canHostEvent: boolean;
  canCreatePoll: boolean;
  canInvite: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canModerate: boolean;
  canReport: boolean;
};

export type CommunityCardModel = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string;
  creatorId: string;
  creatorName: string;
  creatorUserName: string;
  creatorProfilePicture: string | null;
  isPrivate: boolean;
  isVerified: boolean;
  verifiedMembersOnly: boolean;
  postingPermission: 'everyone' | 'members' | 'admins' | 'owner';
  createdAt: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  memberCount: number;
  likeCount: number;
  postCount: number;
  topMembers: CommunityPersonPreview[];
  friendMembers: CommunityPersonPreview[];
  friendMemberCount: number;
  membershipState: CommunityMembershipState;
  viewerRole: CommunityMemberRole;
  isLikedByViewer: boolean;
  permissions: CommunityPermissionSet;
};

export type CommunityDirectoryQuery = {
  scope: CommunityDirectoryScope;
  visibility: CommunityDirectoryVisibility;
  categoryId: string | null;
  search: string;
  sort: CommunityDirectorySort;
  cursor: string | null;
  limit: number;
};

export type CommunityDirectoryPage = {
  items: CommunityCardModel[];
  communityOfTheWeek: CommunityCardModel | null;
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
};

export type CommunityDetailResource = {
  community: CommunityCardModel;
  rules: string[];
};

export type CommunityMutationResult = {
  communityId: string;
  membershipState: CommunityMembershipState;
  memberCount: number;
};

export type CommunityReactionResult = {
  liked: boolean;
  likeCount: number;
};

export type CommunityCategory = {
  id: string;
  name: string;
  type: string;
  bannerImageUrl: string | null;
};

export type CreateCommunityInput = {
  title: string;
  slug: string;
  description: string;
  isPrivate: boolean;
  verifiedMembersOnly: boolean;
  postingPermission: CommunityCardModel['postingPermission'];
  categoryId: string | null;
  imageUrl: string | null;
  termsAccepted: boolean;
};

export type UpdateCommunityInput = Partial<Pick<CreateCommunityInput,
  'title' | 'slug' | 'description' | 'isPrivate' | 'verifiedMembersOnly' | 'postingPermission' | 'categoryId' | 'imageUrl'
>> & { rules?: string[] };

export type CommunityMember = CommunityPersonPreview & {
  membershipId: string;
  role: CommunityMemberRole;
  joinedAt: string | null;
  isFriend: boolean;
  isOnline: boolean;
  permissions: {
    canPromote: boolean;
    canDemote: boolean;
    canRemove: boolean;
    canBan: boolean;
  };
};

export type CommunityJoinRequest = CommunityPersonPreview & {
  requestId: string;
  requestedAt: string | null;
  status: 'pending' | 'approved' | 'declined' | 'canceled';
};

export type CommunityPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
};

export type CommunityPollOption = {
  id: string;
  text: string;
  voteCount: number;
  selectedByViewer: boolean;
};

export type CommunityPoll = {
  id: string;
  communityId: string;
  creatorId: string;
  question: string;
  options: CommunityPollOption[];
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  totalVotes: number;
  allowMultiple: boolean;
  permissions: { canVote: boolean; canDelete: boolean };
};

export type CommunityDashboardData = {
  memberCount: number;
  postCount: number;
  eventCount: number;
  pollCount: number;
  pendingRequestCount: number;
  openReportCount: number;
  activities: CommunityActivityItem[];
  reports: CommunityReportItem[];
};

export type CommunityActivityItem = {
  id: string;
  type: 'post' | 'event' | 'poll';
  title: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
};

export type CommunityReportStatus = 'pending' | 'in_review' | 'resolved' | 'dismissed';
export type CommunityReportTarget = 'post' | 'event' | 'poll';
export type CommunityReportItem = {
  id: string;
  targetId: string;
  targetType: CommunityReportTarget;
  title: string;
  reportedBy: string;
  reporterName: string;
  reason: string;
  details: string;
  status: CommunityReportStatus;
  reportedAt: string;
  assignedTo: string | null;
};
