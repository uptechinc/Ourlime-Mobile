import { create } from 'zustand';
import type { ConversationEntry, FullMessage } from '@/lib/messaging/MessagingService';
import type { FeedPage, PostItem } from '@/lib/services/PostService';
import type { UserProfile } from '@/lib/services/AuthService';
import type { PublicProfileResult } from '@/lib/services/ProfileService';
import type { ResourceState } from '@/lib/types/resourceState';
import type { CommunitiesResourceData, DiscoverResourceData } from '@/lib/types/discoverResources';
import type { RelationshipHubPage, RelationshipHubSection } from '@/lib/types/relationshipHub';
import type { CommunityCategory, CommunityDashboardData, CommunityDetailResource, CommunityDirectoryPage, CommunityJoinRequest, CommunityMember, CommunityPage, CommunityPoll } from '@/lib/types/community';
import type { Event } from '@/types/eventTypes';

export type OwnProfileResource = {
  profile: UserProfile;
  stats: { posts: number; friends: number; followers: number; following: number };
};

export type FeedResourceData = FeedPage & {
  pendingPosts: PostItem[];
  scrollOffset: number;
  isPartialSeed?: boolean;
};

export type MessageResourceData = {
  messages: FullMessage[];
  nextCursor: string | null;
  hasMore: boolean;
  clearedAt?: number;
  pagination: MessagePaginationState;
};

export type MessagePaginationState = {
  status: 'idle' | 'loading' | 'error';
  errorMessage: string | null;
};

type ResourceStore = {
  conversations: ResourceState<ConversationEntry[]>;
  messages: Record<string, ResourceState<MessageResourceData>>;
  postEntities: Record<string, PostItem>;
  feeds: Record<string, ResourceState<FeedResourceData>>;
  ownProfiles: Record<string, ResourceState<OwnProfileResource>>;
  publicProfiles: Record<string, ResourceState<PublicProfileResult>>;
  discover: ResourceState<DiscoverResourceData>;
  communities: ResourceState<CommunitiesResourceData>;
  communityDirectories: { [queryKey: string]: ResourceState<CommunityDirectoryPage> };
  communityCategories: ResourceState<CommunityCategory[]>;
  communityDetails: { [communityId: string]: ResourceState<CommunityDetailResource> };
  communityMembers: { [communityId: string]: ResourceState<CommunityPage<CommunityMember>> };
  communityRequests: { [communityId: string]: ResourceState<CommunityPage<CommunityJoinRequest>> };
  communityEvents: { [communityId: string]: ResourceState<Event[]> };
  communityPolls: { [communityId: string]: ResourceState<CommunityPoll[]> };
  communityDashboards: { [communityId: string]: ResourceState<CommunityDashboardData> };
  relationshipHub: Partial<Record<RelationshipHubSection, ResourceState<RelationshipHubPage>>>;
  relationshipRequests: Record<string, ResourceState<RelationshipHubPage>>;
  communityFeeds: Record<string, ResourceState<PostItem[]>>;
  setConversations: (resource: ResourceState<ConversationEntry[]>) => void;
  setMessages: (chatId: string, resource: ResourceState<MessageResourceData>) => void;
  upsertPostEntities: (posts: PostItem[]) => void;
  setFeed: (key: string, resource: ResourceState<FeedResourceData>) => void;
  setOwnProfile: (userId: string, resource: ResourceState<OwnProfileResource>) => void;
  setPublicProfile: (key: string, resource: ResourceState<PublicProfileResult>) => void;
  setDiscover: (resource: ResourceState<DiscoverResourceData>) => void;
  setCommunities: (resource: ResourceState<CommunitiesResourceData>) => void;
  setCommunityDirectory: (queryKey: string, resource: ResourceState<CommunityDirectoryPage>) => void;
  setCommunityCategories: (resource: ResourceState<CommunityCategory[]>) => void;
  setCommunityDetail: (communityId: string, resource: ResourceState<CommunityDetailResource>) => void;
  setCommunityMembers: (communityId: string, resource: ResourceState<CommunityPage<CommunityMember>>) => void;
  setCommunityRequests: (communityId: string, resource: ResourceState<CommunityPage<CommunityJoinRequest>>) => void;
  setCommunityEvents: (communityId: string, resource: ResourceState<Event[]>) => void;
  setCommunityPolls: (communityId: string, resource: ResourceState<CommunityPoll[]>) => void;
  setCommunityDashboard: (communityId: string, resource: ResourceState<CommunityDashboardData>) => void;
  setRelationshipHub: (section: RelationshipHubSection, resource: ResourceState<RelationshipHubPage>) => void;
  setRelationshipRequests: (key: string, resource: ResourceState<RelationshipHubPage>) => void;
  setCommunityFeed: (key: string, resource: ResourceState<PostItem[]>) => void;
  clearUserResources: () => void;
};

const emptyConversations: ResourceState<ConversationEntry[]> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
const emptyDiscover: ResourceState<DiscoverResourceData> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
const emptyCommunities: ResourceState<CommunitiesResourceData> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
const emptyCommunityCategories: ResourceState<CommunityCategory[]> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };

export const useResourceStore = create<ResourceStore>((set) => ({
  conversations: emptyConversations,
  messages: {},
  postEntities: {},
  feeds: {},
  ownProfiles: {},
  publicProfiles: {},
  discover: emptyDiscover,
  communities: emptyCommunities,
  communityDirectories: {},
  communityCategories: emptyCommunityCategories,
  communityDetails: {},
  communityMembers: {},
  communityRequests: {},
  communityEvents: {},
  communityPolls: {},
  communityDashboards: {},
  relationshipHub: {},
  relationshipRequests: {},
  communityFeeds: {},
  setConversations: (conversations) => set({ conversations }),
  setMessages: (chatId, resource) => set((state) => ({ messages: { ...state.messages, [chatId]: resource } })),
  upsertPostEntities: (posts) => set((state) => {
    const merged = new Map(Object.entries(state.postEntities));
    posts.forEach((post) => merged.set(post.id, post));
    const bounded = [...merged.entries()].slice(-200);
    return { postEntities: Object.fromEntries(bounded) };
  }),
  setFeed: (key, resource) => set((state) => ({ feeds: { ...state.feeds, [key]: resource } })),
  setOwnProfile: (userId, resource) => set((state) => ({ ownProfiles: { ...state.ownProfiles, [userId]: resource } })),
  setPublicProfile: (key, resource) => set((state) => ({ publicProfiles: { ...state.publicProfiles, [key]: resource } })),
  setDiscover: (discover) => set({ discover }),
  setCommunities: (communities) => set({ communities }),
  setCommunityDirectory: (queryKey, resource) => set((state) => ({ communityDirectories: { ...state.communityDirectories, [queryKey]: resource } })),
  setCommunityCategories: (communityCategories) => set({ communityCategories }),
  setCommunityDetail: (communityId, resource) => set((state) => ({ communityDetails: { ...state.communityDetails, [communityId]: resource } })),
  setCommunityMembers: (communityId, resource) => set((state) => ({ communityMembers: { ...state.communityMembers, [communityId]: resource } })),
  setCommunityRequests: (communityId, resource) => set((state) => ({ communityRequests: { ...state.communityRequests, [communityId]: resource } })),
  setCommunityEvents: (communityId, resource) => set((state) => ({ communityEvents: { ...state.communityEvents, [communityId]: resource } })),
  setCommunityPolls: (communityId, resource) => set((state) => ({ communityPolls: { ...state.communityPolls, [communityId]: resource } })),
  setCommunityDashboard: (communityId, resource) => set((state) => ({ communityDashboards: { ...state.communityDashboards, [communityId]: resource } })),
  setRelationshipHub: (section, resource) => set((state) => ({ relationshipHub: { ...state.relationshipHub, [section]: resource } })),
  setRelationshipRequests: (key, resource) => set((state) => ({ relationshipRequests: { ...state.relationshipRequests, [key]: resource } })),
  setCommunityFeed: (key, resource) => set((state) => ({ communityFeeds: { ...state.communityFeeds, [key]: resource } })),
  clearUserResources: () => set({ conversations: emptyConversations, messages: {}, postEntities: {}, feeds: {}, ownProfiles: {}, publicProfiles: {}, discover: emptyDiscover, communities: emptyCommunities, communityDirectories: {}, communityCategories: emptyCommunityCategories, communityDetails: {}, communityMembers: {}, communityRequests: {}, communityEvents: {}, communityPolls: {}, communityDashboards: {}, relationshipHub: {}, relationshipRequests: {}, communityFeeds: {} }),
}));
