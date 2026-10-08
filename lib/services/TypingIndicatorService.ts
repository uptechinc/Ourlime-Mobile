import { deleteField, doc, onSnapshot, serverTimestamp, setDoc, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';

/**
 * Live "typing…" state for 1:1 chats, shared with the website: `chats/{chatId}.typing.{uid}` holds the server time
 * of the person's latest keystroke ping and is removed when they stop.
 */
export class TypingIndicatorService {
  private static instance: TypingIndicatorService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): TypingIndicatorService {
    if (!TypingIndicatorService.instance) TypingIndicatorService.instance = new TypingIndicatorService();
    return TypingIndicatorService.instance;
  }

  public async setTyping(chatId: string, isTyping: boolean): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId || !chatId) return;
    try {
      await setDoc(doc(db, 'chats', chatId), { typing: { [userId]: isTyping ? serverTimestamp() : deleteField() } }, { merge: true });
    } catch (error: unknown) {
      this.logger.warn('TypingIndicatorService', 'setTyping:failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Calls back with the peer's latest typing ping (server millis), or null when they're not typing. */
  public subscribe(chatId: string, peerId: string, onChange: (typingAtMs: number | null) => void): Unsubscribe {
    return onSnapshot(
      doc(db, 'chats', chatId),
      (snapshot) => {
        // 'estimate' fills in our own pending server timestamps instead of null.
        const typing: unknown = snapshot.data({ serverTimestamps: 'estimate' })?.typing;
        const value = typing && typeof typing === 'object' ? (typing as Partial<Record<string, unknown>>)[peerId] : undefined;
        onChange(value instanceof Timestamp ? value.toMillis() : null);
      },
      (error) => this.logger.warn('TypingIndicatorService', 'subscribe:failed', { error: error.message }),
    );
  }
}

export const typingIndicatorService = TypingIndicatorService.getInstance();
