import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';

export type PresenceState = {
  activityStatus: boolean;
  status: 'online' | 'offline';
  lastActiveMs: number | null;
};

const PRESENCE_FRESH_MS = 120_000;

/** Presence read and written directly in Firestore (same fields and rules as the website presence route). */
export class PresenceService {
  private static instance: PresenceService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): PresenceService {
    if (!PresenceService.instance) PresenceService.instance = new PresenceService();
    return PresenceService.instance;
  }

  private async readActivityStatus(userId: string): Promise<boolean> {
    const settings = await getDoc(doc(db, 'users', userId, 'userSettings', 'account')).catch(() => null);
    return settings?.data()?.activityStatus !== false;
  }

  public async heartbeat(state: 'online' | 'offline'): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Authentication required');
    // Users who hid their activity always appear offline.
    const activityStatus = await this.readActivityStatus(userId);
    await setDoc(doc(db, 'users', userId), { lastActive: serverTimestamp(), onlineStatus: activityStatus ? state : 'offline' }, { merge: true });
    this.logger.info('PresenceService', 'heartbeat', { state });
  }

  public async getPresence(userId: string): Promise<PresenceState> {
    const [user, activityStatus] = await Promise.all([getDoc(doc(db, 'users', userId)), this.readActivityStatus(userId)]);
    if (!user.exists()) throw new Error('User not found');
    const lastActive: unknown = user.data().lastActive;
    const lastActiveMs = lastActive && typeof lastActive === 'object' && 'toMillis' in lastActive && typeof lastActive.toMillis === 'function' ? (lastActive.toMillis as () => number)() : null;
    const isFresh = typeof lastActiveMs === 'number' && Date.now() - lastActiveMs < PRESENCE_FRESH_MS;
    return {
      activityStatus,
      lastActiveMs: activityStatus ? lastActiveMs : null,
      status: activityStatus && user.data().onlineStatus === 'online' && isFresh ? 'online' : 'offline',
    };
  }
}

export const presenceService = PresenceService.getInstance();
