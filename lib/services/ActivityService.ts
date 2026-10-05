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
        getDocs(query(collection(db, 'userPosts'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'postLikes'), where('postOwnerId', '==', userId))),
        getDocs(query(collection(db, 'postComments'), where('postOwnerId', '==', userId))),
      ]);
      // Owner + createdAt range queries need composite indexes that don't exist, so the week is filtered here.
      const thisWeek = (snapshot: typeof posts): number => snapshot.docs.filter((item) => {
        const createdAt: unknown = item.data().createdAt;
        return createdAt instanceof Timestamp && createdAt.toMillis() >= oneWeekAgo.toMillis();
      }).length;
      return { likesReceived: thisWeek(likes), commentsReceived: thisWeek(comments), postsCreated: thisWeek(posts) };
    } catch (error: unknown) {
      this.logger.warn('ActivityService', 'firestore:query', { userId, error: error instanceof Error ? error.message : String(error) });
      return { likesReceived: 0, commentsReceived: 0, postsCreated: 0 };
    }
  }
}
