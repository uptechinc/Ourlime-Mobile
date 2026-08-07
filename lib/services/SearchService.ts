import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AuthService, type UserProfile } from './AuthService';
import { DiagnosticLogService } from './DiagnosticLogService';

export class SearchService {
  private static instance: SearchService;
  private readonly authService = AuthService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  public async searchUsers(searchQuery: string, maxResults = 15): Promise<UserProfile[]> {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];

    this.logger.info('SearchService', 'searchUsers:start', { query: trimmed });
    try {
      // Query users where userName or firstName matches
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('userName', '>=', trimmed),
        where('userName', '<=', trimmed + '\uf8ff'),
        limit(maxResults)
      );

      const snapshot = await getDocs(q);
      const userProfiles: UserProfile[] = [];

      for (const docSnap of snapshot.docs) {
        const profile = await this.authService.getUserProfile(docSnap.id);
        if (profile) {
          userProfiles.push(profile);
        }
      }

      this.logger.success('SearchService', 'searchUsers', { resultCount: userProfiles.length });
      return userProfiles;
    } catch (error) {
      this.logger.error('SearchService', 'searchUsers', error, { query: trimmed });
      return [];
    }
  }
}
