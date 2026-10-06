import AsyncStorage from '@react-native-async-storage/async-storage';
import { creationDraftService, draftDaysLeft, DRAFT_REMINDER_DAYS, type CreationDraft } from './CreationDraftService';
import { inAppNotificationService } from './InAppNotificationService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { serverClockService } from './ServerClockService';

type ExpiringDraft = { draft: CreationDraft; daysLeft: number };

const REMINDER_KEY_PREFIX = 'ourlime:draft-reminder:';

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/**
 * Draft clean-up without a Cloud Function: when the feed opens, drafts older than 7 days are deleted (the user is
 * told which), and drafts with 3 days or less left get a drop-down reminder once a day (red on the last day).
 */
export class DraftExpiryService {
  private static instance: DraftExpiryService;
  private readonly logger = DiagnosticLogService.getInstance();
  /** `uid:day` of the last completed check, so it runs again on a new day even if the app stayed open. */
  private lastRunKey: string | null = null;
  private running = false;

  private constructor() {}

  public static getInstance(): DraftExpiryService {
    if (!DraftExpiryService.instance) DraftExpiryService.instance = new DraftExpiryService();
    return DraftExpiryService.instance;
  }

  /**
   * Runs when the feed opens and when the app comes back to the foreground, at most once a day per signed-in user
   * (Android keeps the app alive for days, so "once per app session" could skip whole days of reminders).
   */
  public async runOnFeedOpen(uid: string): Promise<void> {
    const runKey = `${uid}:${todayKey()}`;
    if (this.running || this.lastRunKey === runKey) return;
    this.running = true;
    try {
      const [now, drafts] = await Promise.all([serverClockService.now(), creationDraftService.list(uid)]);
      const deleted: CreationDraft[] = [];
      const expiring: ExpiringDraft[] = [];
      for (const draft of drafts) {
        if (draft.expiresAtMs <= now) {
          try {
            await creationDraftService.remove(uid, draft.id);
            deleted.push(draft);
          } catch (error: unknown) {
            this.logger.warn('DraftExpiryService', 'delete:failed', { error: error instanceof Error ? error.message : String(error) });
          }
          continue;
        }
        const daysLeft = draftDaysLeft(draft.expiresAtMs, now);
        if (daysLeft <= DRAFT_REMINDER_DAYS && !(await this.wasRemindedToday(draft.id))) expiring.push({ draft, daysLeft });
      }
      this.logger.info('DraftExpiryService', 'run', { total: drafts.length, deleted: deleted.length, expiring: expiring.length });
      if (deleted.length > 0) this.showDeleted(deleted);
      // The banner host queues banners, so the reminder follows the "deleted" notice instead of replacing it.
      if (expiring.length > 0) {
        this.showExpiring(expiring);
        // Marked only once it has been handed to the banner, so a failed run doesn't use up today's reminder.
        await Promise.all(expiring.map(({ draft }) => this.markRemindedToday(draft.id)));
      }
      this.lastRunKey = runKey;
    } catch (error: unknown) {
      this.logger.warn('DraftExpiryService', 'run:failed', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.running = false;
    }
  }

  private showDeleted(deleted: CreationDraft[]): void {
    inAppNotificationService.showNotification({
      id: `drafts-deleted:${todayKey()}:${deleted.map((draft) => draft.id).join(',')}`,
      kind: 'notification',
      tone: 'default',
      title: deleted.length === 1 ? 'A draft expired and was deleted' : `${deleted.length} drafts expired and were deleted`,
      body: deleted.length === 1
        ? `"${deleted[0].title}" was more than 7 days old.`
        : deleted.map((draft) => `• ${draft.title}`).join('\n'),
      avatarUrl: null,
      destination: { type: 'draft_reminder', contentType: deleted[0].kind },
    });
  }

  private showExpiring(expiring: ExpiringDraft[]): void {
    const sorted = [...expiring].sort((first, second) => first.daysLeft - second.daysLeft);
    const hasLastDay = sorted[0].daysLeft <= 1;
    const describe = ({ draft, daysLeft }: ExpiringDraft): string => `"${draft.title}" ${daysLeft <= 1 ? 'expires today' : `expires in ${daysLeft} days`}`;
    inAppNotificationService.showNotification({
      id: `drafts-expiring:${todayKey()}:${sorted.map(({ draft }) => draft.id).join(',')}`,
      kind: 'notification',
      tone: hasLastDay ? 'danger' : 'warning',
      title: hasLastDay ? 'Draft expires today' : sorted.length === 1 ? `Draft expires in ${sorted[0].daysLeft} days` : 'Drafts expiring soon',
      body: sorted.length === 1 ? `${describe(sorted[0])}. Finish or post it before then.` : sorted.map((item) => `• ${describe(item)}`).join('\n'),
      avatarUrl: null,
      destination: { type: 'draft_reminder', contentType: sorted[0].draft.kind },
    });
  }

  /** Each draft's reminder shows once a day. */
  private async wasRemindedToday(draftId: string): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(`${REMINDER_KEY_PREFIX}${draftId}`)) === todayKey();
    } catch {
      return false;
    }
  }

  private async markRemindedToday(draftId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`${REMINDER_KEY_PREFIX}${draftId}`, todayKey());
    } catch {
      // Non-fatal: the reminder may show again today.
    }
  }
}

export const draftExpiryService = DraftExpiryService.getInstance();
