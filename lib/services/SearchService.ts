import { DiagnosticLogService } from './DiagnosticLogService';
import { AuthService, type UserProfile } from './AuthService';
import { auth, db } from '@/lib/firebaseConfig';
import { collection, doc, getDoc, getDocs, limit, query, where, type QueryDocumentSnapshot } from 'firebase/firestore';
import { accountLifecycleVisibilityService } from './AccountLifecycleVisibilityService';

const QUERY_OVERSCAN_MULTIPLIER = 3;
const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readStringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

export class SearchService {
  private static instance: SearchService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly authService = AuthService.getInstance();

  private constructor() {}

  public static getInstance(): SearchService {
    if (!SearchService.instance) SearchService.instance = new SearchService();
    return SearchService.instance;
  }

  public async searchUsers(searchQuery: string, maxResults = 15): Promise<UserProfile[]> {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];
    this.logger.info('SearchService', 'searchUsers:start', { query: trimmed });
    const profiles = await this.searchUsersFromFirestore(trimmed, maxResults);
    this.logger.success('SearchService', 'searchUsers', { resultCount: profiles.length });
    return profiles;
  }

  /** Same indexed prefix queries and privacy/block filters as the website's user search route. */
  private async searchUsersFromFirestore(searchQuery: string, maxResults: number): Promise<UserProfile[]> {
    const resultLimit = Math.min(20, Math.max(1, maxResults));
    const currentUserId = auth.currentUser?.uid;
    const [currentUser, candidateDocuments] = await Promise.all([
      currentUserId ? getDoc(doc(db, 'users', currentUserId)).catch(() => null) : Promise.resolve(null),
      this.findCandidates(searchQuery.replace(/^@/, ''), resultLimit),
    ]);
    const currentBlockList = readStringList(currentUser?.data()?.blockList);
    const candidates = candidateDocuments.filter((document) => {
      if (document.id === currentUserId || currentBlockList.includes(document.id)) return false;
      const user = document.data();
      return !accountLifecycleVisibilityService.isHidden(user)
        && !(currentUserId && readStringList(user.blockList).includes(currentUserId))
        && readString(user.accountPrivacy) !== 'private'
        && user.isPrivate !== true;
    });
    const visibilityResults = await Promise.allSettled(
      candidates.map(async (candidateDocument) => ({
        candidateDocument,
        visible: await this.isSearchVisible(candidateDocument.id),
      })),
    );
    const visibleCandidates = visibilityResults.flatMap((result) => (
      result.status === 'fulfilled' && result.value.visible ? [result.value.candidateDocument] : []
    )).slice(0, resultLimit);
    const profileResults = await Promise.allSettled(
      visibleCandidates.map((candidateDocument) => this.authService.getUserProfile(candidateDocument.id)),
    );
    return profileResults.flatMap((result): UserProfile[] => (
      result.status === 'fulfilled' && result.value ? [result.value] : []
    ));
  }

  private async findCandidates(searchQuery: string, resultLimit: number): Promise<QueryDocumentSnapshot[]> {
    const normalized = searchQuery.trim().replace(/\s+/g, ' ');
    const titleCase = normalized.replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase());
    const variants = [...new Set([normalized, normalized.toLocaleLowerCase(), titleCase])];
    const fields = ['userName', 'firstName', 'lastName'] as const;
    const snapshots = await Promise.all(fields.flatMap((field) => variants.map((variant) => getDocs(query(
      collection(db, 'users'),
      where(field, '>=', variant),
      where(field, '<=', `${variant}\uf8ff`),
      limit(resultLimit * QUERY_OVERSCAN_MULTIPLIER),
    )))));
    return [...new Map(snapshots.flatMap((snapshot) => snapshot.docs).map((document) => [document.id, document] as const)).values()];
  }

  private async isSearchVisible(userId: string): Promise<boolean> {
    try {
      const privacyDocument = await getDoc(doc(db, 'users', userId, 'userPrivacySettings', 'privacy'));
      return privacyDocument.data()?.searchVisibility !== false;
    } catch (error: unknown) {
      this.logger.warn('SearchService', 'searchVisibility:fallback', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown privacy lookup error',
      });
      return true;
    }
  }
}

export const searchService = SearchService.getInstance();
