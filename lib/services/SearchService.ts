import { ApiService } from './ApiService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { AuthService, type UserProfile } from './AuthService';
import { auth, db } from '@/lib/firebaseConfig';
import { collection, doc, getDoc, getDocs, limit, query } from 'firebase/firestore';
import { accountLifecycleVisibilityService } from './AccountLifecycleVisibilityService';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => typeof value === 'string' ? value : '';

export class SearchService {
  private static instance: SearchService;
  private readonly apiService = ApiService.getInstance();
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
    try {
      const response = await this.apiService.request<{ success: boolean; data?: unknown[]; error?: string; message?: string }>(
        `/api/users/search?q=${encodeURIComponent(trimmed)}&limit=${encodeURIComponent(String(Math.min(20, Math.max(1, maxResults))))}`,
        { authenticated: true, timeoutMs: 18_000 }
      );
      if (!response.success) throw new Error(response.error || response.message || 'Search failed');
      const profiles = this.normalizeProfiles(response.data ?? []);
      this.logger.success('SearchService', 'searchUsers', { resultCount: profiles.length, source: 'api' });
      return profiles;
    } catch {
      const profiles = await this.searchUsersFromFirestore(trimmed, maxResults);
      this.logger.success('SearchService', 'searchUsers', { resultCount: profiles.length, source: 'firestore' });
      return profiles;
    }
  }

  private normalizeProfiles(values: unknown[]): UserProfile[] {
    return values.flatMap((value): UserProfile[] => {
      if (!isRecord(value)) return [];
      if (accountLifecycleVisibilityService.isHidden(value)) return [];
      const uid = readString(value.id) || readString(value.uid);
      if (!uid) return [];
      return [{
        uid,
        firstName: readString(value.firstName),
        lastName: readString(value.lastName),
        userName: readString(value.userName),
        email: '',
        accountType: readString(value.accountType) || 'user',
        emailVerified: value.emailVerified === true,
        profilePicture: readString(value.profileImage) || readString(value.profilePicture) || null,
      }];
    });
  }

  private async searchUsersFromFirestore(searchQuery: string, maxResults: number): Promise<UserProfile[]> {
    const normalizedQuery = searchQuery.toLowerCase().replace(/^@/, '');
    const currentUserId = auth.currentUser?.uid;
    const snapshot = await getDocs(query(collection(db, 'users'), limit(80)));
    const candidates = snapshot.docs
      .filter((document) => document.id !== currentUserId)
      .filter((document) => {
        const user = document.data();
        if (user.deletedAt != null || user.disabled === true || user.isPrivate === true || accountLifecycleVisibilityService.isHidden(user)) return false;
        if (readString(user.accountPrivacy) === 'private' || readString(user.visibility) === 'private') return false;
        const searchable = [
          readString(user.firstName),
          readString(user.lastName),
          readString(user.userName),
          readString(user.displayName),
        ].join(' ').toLowerCase();
        return searchable.includes(normalizedQuery);
      })
      .slice(0, Math.min(20, Math.max(1, maxResults)));
    const visibilityResults = await Promise.allSettled(
      candidates.map(async (candidateDocument) => ({
        candidateDocument,
        visible: await this.isSearchVisible(candidateDocument.id),
      })),
    );
    const visibleCandidates = visibilityResults.flatMap((result) => (
      result.status === 'fulfilled' && result.value.visible ? [result.value.candidateDocument] : []
    ));
    const profileResults = await Promise.allSettled(
      visibleCandidates.map((candidateDocument) => this.authService.getUserProfile(candidateDocument.id)),
    );
    return profileResults.flatMap((result): UserProfile[] => (
      result.status === 'fulfilled' && result.value ? [result.value] : []
    ));
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
