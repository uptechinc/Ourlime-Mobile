import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Timestamp, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';

/** What other people see: the person's chosen status while they're using Ourlime, otherwise offline. */
export type ActivityStatus = 'online' | 'busy' | 'away' | 'working' | 'offline';

/** What the person picked on their profile; 'auto' = Online while using Ourlime, Offline when not. */
export type StatusPreference = 'auto' | 'busy' | 'away' | 'working' | 'offline';

export type PresenceState = {
  activityStatus: boolean;
  status: ActivityStatus;
  lastActiveMs: number | null;
};

/** The raw fields a status is worked out from (users doc + userSettings/account). */
export type PresenceRecord = {
  onlineStatus?: unknown;
  lastActiveMs?: number | null;
  statusPreference?: unknown;
  activityStatusEnabled?: boolean;
};

/** A heartbeat older than this means the person has left (the app and website ping every ~60 s while open). */
const PRESENCE_FRESH_MS = 2 * 60 * 1000;
const PICKED_STATUSES = new Set(['busy', 'away', 'working']);

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  online: 'Online',
  busy: 'Busy',
  away: 'Away',
  working: 'Working',
  offline: 'Offline',
};

export const ACTIVITY_STATUS_COLORS: Record<ActivityStatus, string> = {
  online: '#10b981',
  busy: '#ef4444',
  away: '#eab308',
  working: '#3b82f6',
  offline: '#9ca3af',
};

const toMillis = (value: unknown): number | null => {
  const timestamp = value as Timestamp | null | undefined;
  return typeof timestamp?.toMillis === 'function' ? timestamp.toMillis() : null;
};

/**
 * Presence read and written directly in Firestore (same fields and rules as the website). The picked status lives in
 * users/{uid}/userSettings/account.statusPreference; users/{uid}.onlineStatus + lastActive are the live heartbeat.
 */
export class PresenceService {
  private static instance: PresenceService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): PresenceService {
    if (!PresenceService.instance) PresenceService.instance = new PresenceService();
    return PresenceService.instance;
  }

  public readStatusPreference(statusPreference: unknown, onlineStatus?: unknown): StatusPreference {
    const value = String(statusPreference ?? '').toLowerCase();
    if (value === 'auto' || value === 'busy' || value === 'away' || value === 'working' || value === 'offline') return value;
    // Before statusPreference existed, the website saved the picked status in onlineStatus.
    const legacy = String(onlineStatus ?? '').toLowerCase();
    return PICKED_STATUSES.has(legacy) ? legacy as StatusPreference : 'auto';
  }

  /** The status shown to others. Same rules as the website (lib/presence/activityStatus.ts). */
  public resolveStatus(record: PresenceRecord, nowMs = Date.now()): ActivityStatus {
    if (record.activityStatusEnabled === false) return 'offline';
    const preference = this.readStatusPreference(record.statusPreference, record.onlineStatus);
    if (preference === 'offline') return 'offline';
    const isUsingOurlime = String(record.onlineStatus ?? '').toLowerCase() !== 'offline'
      && typeof record.lastActiveMs === 'number'
      && nowMs - record.lastActiveMs <= PRESENCE_FRESH_MS;
    if (!isUsingOurlime) return 'offline';
    return preference === 'auto' ? 'online' : preference;
  }

  private async readAccountSettings(userId: string): Promise<{ activityStatus: boolean; statusPreference: unknown }> {
    const settings = await getDoc(doc(db, 'users', userId, 'userSettings', 'account')).catch(() => null);
    return { activityStatus: settings?.data()?.activityStatus !== false, statusPreference: settings?.data()?.statusPreference };
  }

  public async heartbeat(state: 'online' | 'offline'): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Authentication required');
    // Users who hid their activity always appear offline.
    const { activityStatus } = await this.readAccountSettings(userId);
    await setDoc(doc(db, 'users', userId), { lastActive: serverTimestamp(), onlineStatus: activityStatus ? state : 'offline' }, { merge: true });
    this.logger.info('PresenceService', 'heartbeat', { state });
  }

  public async getPresence(userId: string): Promise<PresenceState> {
    const [user, settings] = await Promise.all([getDoc(doc(db, 'users', userId)), this.readAccountSettings(userId)]);
    if (!user.exists()) throw new Error('User not found');
    const lastActiveMs = toMillis(user.data().lastActive);
    return {
      activityStatus: settings.activityStatus,
      lastActiveMs: settings.activityStatus ? lastActiveMs : null,
      status: this.resolveStatus({
        onlineStatus: user.data().onlineStatus,
        lastActiveMs,
        statusPreference: settings.statusPreference,
        activityStatusEnabled: settings.activityStatus,
      }),
    };
  }

  /** A user's own pick ("auto" = Online while using Ourlime). */
  public async getStatusPreference(userId: string): Promise<StatusPreference> {
    if (!userId) return 'auto';
    const [user, settings] = await Promise.all([getDoc(doc(db, 'users', userId)).catch(() => null), this.readAccountSettings(userId)]);
    return this.readStatusPreference(settings.statusPreference, user?.data()?.onlineStatus);
  }

  public async setStatusPreference(preference: StatusPreference): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Authentication required');
    await setDoc(doc(db, 'users', userId, 'userSettings', 'account'), { statusPreference: preference }, { merge: true });
    // Picking a status means they're here right now.
    await this.heartbeat('online').catch(() => undefined);
    this.logger.info('PresenceService', 'statusPreference', { preference });
  }

  /**
   * Follows these people's raw presence live (their users doc + userSettings/account). Call `resolveStatus` on the
   * records to get what to show; re-resolve periodically so someone who left turns offline.
   */
  public subscribeToPresence(userIds: string[], onChange: (records: Record<string, PresenceRecord>) => void): Unsubscribe {
    const records: Record<string, PresenceRecord> = {};
    const merge = (userId: string, patch: PresenceRecord): void => {
      records[userId] = { ...records[userId], ...patch };
      onChange({ ...records });
    };
    const unsubscribers = userIds.flatMap((userId) => [
      onSnapshot(
        doc(db, 'users', userId),
        (snapshot) => merge(userId, { onlineStatus: snapshot.data()?.onlineStatus, lastActiveMs: toMillis(snapshot.data()?.lastActive) }),
        (error) => this.logger.warn('PresenceService', 'subscribe:user:failed', { error: error.message }),
      ),
      onSnapshot(
        doc(db, 'users', userId, 'userSettings', 'account'),
        (snapshot) => merge(userId, { statusPreference: snapshot.data()?.statusPreference, activityStatusEnabled: snapshot.data()?.activityStatus !== false }),
        (error) => this.logger.warn('PresenceService', 'subscribe:settings:failed', { error: error.message }),
      ),
    ]);
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }
}

export const presenceService = PresenceService.getInstance();
