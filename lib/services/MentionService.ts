import { auth } from '@/lib/firebaseConfig';
import { rankMentionMatches } from '@/lib/helpers/mentionText';
import { RelationshipService, type RelationshipUser } from './RelationshipService';
import { searchService } from './SearchService';

export type MentionCandidate = RelationshipUser;

const MAX_SUGGESTIONS = 8;
const FRIENDS_CACHE_MS = 5 * 60 * 1000;

/**
 * People the "@" picker offers: your friends first (instant, from memory), then other members found by search.
 * Only friends are notified when mentioned (same rule as the website), but any member can be tagged in the text.
 */
export class MentionService {
  private static instance: MentionService;
  private readonly relationshipService = RelationshipService.getInstance();
  private friendsCache: { userId: string; loadedAt: number; friends: MentionCandidate[] } | null = null;
  private friendsRequest: Promise<MentionCandidate[]> | null = null;

  private constructor() {}

  public static getInstance(): MentionService {
    if (!MentionService.instance) MentionService.instance = new MentionService();
    return MentionService.instance;
  }

  /** The signed-in user's friends, cached for a few minutes so every composer opens the picker instantly. */
  public async getFriends(): Promise<MentionCandidate[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    const cache = this.friendsCache;
    if (cache && cache.userId === userId && Date.now() - cache.loadedAt < FRIENDS_CACHE_MS) return cache.friends;
    if (this.friendsRequest) return this.friendsRequest;
    // No Promise.finally: this app's JavaScript engine doesn't provide it.
    this.friendsRequest = this.relationshipService.getFriends(userId)
      .then((friends) => {
        const usable = friends.filter((friend) => friend.userName);
        this.friendsCache = { userId, loadedAt: Date.now(), friends: usable };
        this.friendsRequest = null;
        return usable;
      })
      .catch((error: unknown) => {
        console.warn('[MentionService.getFriends] Error:', error instanceof Error ? error.message : error);
        this.friendsRequest = null;
        return this.friendsCache?.friends ?? [];
      });
    return this.friendsRequest;
  }

  /** Friends that match the query (all friends for a bare "@"), best match first. Instant. */
  public matchFriends(friends: MentionCandidate[], query: string): MentionCandidate[] {
    return rankMentionMatches(friends, query).slice(0, MAX_SUGGESTIONS);
  }

  /** Other members matching the query (name or username), not already in `known`. Network call; empty on failure. */
  public async searchMembers(query: string, known: MentionCandidate[]): Promise<MentionCandidate[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    try {
      const profiles = await searchService.searchUsers(trimmed, MAX_SUGGESTIONS);
      const currentUserId = auth.currentUser?.uid;
      const knownIds = new Set(known.map((person) => person.id));
      const found = profiles.flatMap((profile): MentionCandidate[] => {
        if (!profile.userName || profile.uid === currentUserId || knownIds.has(profile.uid)) return [];
        return [{
          id: profile.uid,
          userName: profile.userName,
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          profileImage: profile.profilePicture || undefined,
        }];
      });
      return rankMentionMatches(found, trimmed);
    } catch (error: unknown) {
      console.warn('[MentionService.searchMembers] Error:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /** Friends then members, de-duplicated and capped. */
  public combine(friends: MentionCandidate[], members: MentionCandidate[]): MentionCandidate[] {
    const seen = new Set(friends.map((person) => person.id));
    return [...friends, ...members.filter((person) => !seen.has(person.id))].slice(0, MAX_SUGGESTIONS);
  }
}

export const mentionService = MentionService.getInstance();
