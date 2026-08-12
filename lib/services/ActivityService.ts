import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { ApiService } from './ApiService';
import { DiagnosticLogService } from './DiagnosticLogService';

export type ActivitySummary = {
  likesReceived: number;
  commentsReceived: number;
  postsCreated: number;
};

type ActivityApiResponse = {
  success?: boolean;
  data?: Partial<ActivitySummary>;
};

export class ActivityService {
  private static instance: ActivityService;
  private readonly api = ApiService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): ActivityService {
    if (!ActivityService.instance) ActivityService.instance = new ActivityService();
    return ActivityService.instance;
  }

  public async getWeeklyActivity(userId: string): Promise<ActivitySummary> {
    try {
      const response = await this.api.request<ActivityApiResponse>('/api/home/LeftSection/activity', { authenticated: true });
      if (response.success && response.data) {
        return {
          likesReceived: this.readCount(response.data.likesReceived),
          commentsReceived: this.readCount(response.data.commentsReceived),
          postsCreated: this.readCount(response.data.postsCreated),
        };
      }
    } catch (error: unknown) {
      this.logger.warn('ActivityService', 'api-fallback', { userId, error: error instanceof Error ? error.message : String(error) });
    }

    const oneWeekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const [posts, likes, comments] = await Promise.all([
      getDocs(query(collection(db, 'userPosts'), where('userId', '==', userId), where('createdAt', '>=', oneWeekAgo))),
      getDocs(query(collection(db, 'postLikes'), where('postOwnerId', '==', userId), where('createdAt', '>=', oneWeekAgo))),
      getDocs(query(collection(db, 'postComments'), where('postOwnerId', '==', userId), where('createdAt', '>=', oneWeekAgo))),
    ]);
    return { likesReceived: likes.size, commentsReceived: comments.size, postsCreated: posts.size };
  }

  private readCount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
}
