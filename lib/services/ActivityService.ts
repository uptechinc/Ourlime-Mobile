import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';

export type ActivitySummary = {
  likesReceived: number;
  commentsReceived: number;
  postsCreated: number;
};

export class ActivityService {
  private static instance: ActivityService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): ActivityService {
    if (!ActivityService.instance) ActivityService.instance = new ActivityService();
    return ActivityService.instance;
  }

  public async getWeeklyActivity(userId: string): Promise<ActivitySummary> {
    try {
      const oneWeekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const [posts, likes, comments] = await Promise.all([
        getDocs(query(collection(db, 'userPosts'), where('userId', '==', userId), where('createdAt', '>=', oneWeekAgo))),
        getDocs(query(collection(db, 'postLikes'), where('postOwnerId', '==', userId), where('createdAt', '>=', oneWeekAgo))),
        getDocs(query(collection(db, 'postComments'), where('postOwnerId', '==', userId), where('createdAt', '>=', oneWeekAgo))),
      ]);
      return { likesReceived: likes.size, commentsReceived: comments.size, postsCreated: posts.size };
    } catch (error: unknown) {
      this.logger.warn('ActivityService', 'firestore:query', { userId, error: error instanceof Error ? error.message : String(error) });
      return { likesReceived: 0, commentsReceived: 0, postsCreated: 0 };
    }
  }
}
