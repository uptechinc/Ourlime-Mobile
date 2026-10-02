import AsyncStorage from '@react-native-async-storage/async-storage';
import { creationDraftService, draftDaysLeft, DRAFT_REMINDER_DAYS, type CreationDraft } from './CreationDraftService';
import { inAppNotificationService } from './InAppNotificationService';
import { DiagnosticLogService } from './DiagnosticLogService';

type ExpiringDraft = { draft: CreationDraft; daysLeft: number };

const REMINDER_KEY_PREFIX = 'ourlime:draft-reminder:';
const SECOND_BANNER_DELAY_MS = 6500;

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
  private lastRunUserId: string | null = null;

  private constructor() {}

  public static getInstance(): DraftExpiryService {
    if (!DraftExpiryService.instance) DraftExpiryService.instance = new DraftExpiryService();
    return DraftExpiryService.instance;
  }

  /** Runs once per app session per signed-in user. */
  public async runOnFeedOpen(uid: string): Promise<void> {
    if (this.lastRunUserId === uid) return;
    this.lastRunUserId = uid;
    try {
      const now = Date.now();
      const drafts = await creationDraftService.list(uid);
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
        if (daysLeft <= DRAFT_REMINDER_DAYS && await this.claimTodaysReminder(draft.id)) expiring.push({ draft, daysLeft });
      }
      this.logger.info('DraftExpiryService', 'run', { total: drafts.length, deleted: deleted.length, expiring: expiring.length });
      if (deleted.length > 0) this.showDeleted(deleted);
      if (expiring.length > 0) {
        const show = (): void => this.showExpiring(expiring);
        if (deleted.length > 0) setTimeout(show, SECOND_BANNER_DELAY_MS);
        else show();
      }
    } catch (error: unknown) {
      this.lastRunUserId = null;
      this.logger.warn('DraftExpiryService', 'run:failed', { error: error instanceof Error ? error.message : String(error) });
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

  /** True the first time it's asked today for this draft (each reminder shows once a day). */
  private async claimTodaysReminder(draftId: string): Promise<boolean> {
    try {
      const key = `${REMINDER_KEY_PREFIX}${draftId}`;
      if ((await AsyncStorage.getItem(key)) === todayKey()) return false;
      await AsyncStorage.setItem(key, todayKey());
      return true;
    } catch {
      return true;
    }
  }
}

export const draftExpiryService = DraftExpiryService.getInstance();
