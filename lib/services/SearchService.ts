import { ApiService } from './ApiService';
import { DiagnosticLogService } from './DiagnosticLogService';
import type { UserProfile } from './AuthService';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => typeof value === 'string' ? value : '';

export class SearchService {
  private static instance: SearchService;
  private readonly apiService = ApiService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): SearchService {
    if (!SearchService.instance) SearchService.instance = new SearchService();
    return SearchService.instance;
  }

  public async searchUsers(searchQuery: string, maxResults = 15): Promise<UserProfile[]> {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];
    this.logger.info('SearchService', 'searchUsers:start', { query: trimmed });
    const response = await this.apiService.request<{ success: boolean; data?: unknown[]; error?: string; message?: string }>(
      `/api/users/search?q=${encodeURIComponent(trimmed)}&limit=${encodeURIComponent(String(Math.min(20, Math.max(1, maxResults))))}`,
      { authenticated: true }
    );
    if (!response.success) throw new Error(response.error || response.message || 'Search failed');
    const profiles = (response.data ?? []).flatMap((value): UserProfile[] => {
      if (!isRecord(value)) return [];
      const uid = readString(value.id) || readString(value.uid);
      if (!uid) return [];
      return [{
        uid,
        firstName: readString(value.firstName),
        lastName: readString(value.lastName),
        userName: readString(value.userName),
        email: '',
        accountType: 'user',
        emailVerified: value.emailVerified === true,
        profilePicture: readString(value.profileImage) || null,
      }];
    });
    this.logger.success('SearchService', 'searchUsers', { resultCount: profiles.length });
    return profiles;
  }
}

export const searchService = SearchService.getInstance();
