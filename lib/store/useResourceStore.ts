import { create } from 'zustand';
import type { ConversationEntry, FullMessage } from '@/lib/messaging/MessagingService';
import type { FeedPage, PostItem } from '@/lib/services/PostService';
import type { UserProfile } from '@/lib/services/AuthService';
import type { PublicProfileResult } from '@/lib/services/ProfileService';
import type { ResourceState } from '@/lib/types/resourceState';

export type OwnProfileResource = {
  profile: UserProfile;
  stats: { posts: number; friends: number; followers: number; following: number };
};

export type FeedResourceData = FeedPage & {
  pendingPosts: PostItem[];
  scrollOffset: number;
};

export type MessageResourceData = {
  messages: FullMessage[];
  nextCursor: string | null;
  hasMore: boolean;
  clearedAt?: number;
};

type ResourceStore = {
  conversations: ResourceState<ConversationEntry[]>;
  messages: Record<string, ResourceState<MessageResourceData>>;
  postEntities: Record<string, PostItem>;
  feeds: Record<string, ResourceState<FeedResourceData>>;
  ownProfiles: Record<string, ResourceState<OwnProfileResource>>;
  publicProfiles: Record<string, ResourceState<PublicProfileResult>>;
  setConversations: (resource: ResourceState<ConversationEntry[]>) => void;
  setMessages: (chatId: string, resource: ResourceState<MessageResourceData>) => void;
  upsertPostEntities: (posts: PostItem[]) => void;
  setFeed: (key: string, resource: ResourceState<FeedResourceData>) => void;
  setOwnProfile: (userId: string, resource: ResourceState<OwnProfileResource>) => void;
  setPublicProfile: (key: string, resource: ResourceState<PublicProfileResult>) => void;
  clearUserResources: () => void;
};

const emptyConversations: ResourceState<ConversationEntry[]> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };

export const useResourceStore = create<ResourceStore>((set) => ({
  conversations: emptyConversations,
  messages: {},
  postEntities: {},
  feeds: {},
  ownProfiles: {},
  publicProfiles: {},
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
  clearUserResources: () => set({ conversations: emptyConversations, messages: {}, postEntities: {}, feeds: {}, ownProfiles: {}, publicProfiles: {} }),
}));
