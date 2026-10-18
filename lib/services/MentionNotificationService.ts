import { extractMentionUserNames } from '@/lib/helpers/mentionText';
import { appServerService } from './AppServerService';
import { DiagnosticLogService } from './DiagnosticLogService';

export type MentionContentKind = 'post' | 'comment' | 'reply';

/**
 * "You were mentioned" notices. The server (Cloud Function sendMentionNotifications) reads the post, comment or reply
 * just created, finds the @names in it, and notifies the author's friends, like the website does. Best effort: a failure
 * is logged and never blocks posting.
 */
export class MentionNotificationService {
  private static instance: MentionNotificationService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): MentionNotificationService {
    if (!MentionNotificationService.instance) MentionNotificationService.instance = new MentionNotificationService();
    return MentionNotificationService.instance;
  }

  /** Only calls the server when the text really mentions someone. */
  public async notify(contentType: MentionContentKind, contentId: string, text: string): Promise<void> {
    if (!contentId || extractMentionUserNames(text).length === 0) return;
    try {
      await appServerService.call('sendMentionNotifications', { contentType, contentId });
    } catch (error: unknown) {
      console.warn('[MentionNotificationService.notify] Error:', error instanceof Error ? error.message : error);
      this.logger.warn('MentionNotificationService', 'notify:failed', { contentType });
    }
  }
}

export const mentionNotificationService = MentionNotificationService.getInstance();
