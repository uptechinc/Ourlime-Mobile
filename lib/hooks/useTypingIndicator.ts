import { useCallback, useEffect, useRef, useState } from 'react';
import { typingIndicatorService } from '@/lib/services/TypingIndicatorService';
import { serverClockService } from '@/lib/services/ServerClockService';

/** Re-send "typing" at most this often while keys are pressed. */
const TYPING_PING_INTERVAL_MS = 3_000;
/** No keystrokes for this long means the person stopped typing. */
const TYPING_IDLE_MS = 4_000;
/** Without a fresh ping for this long (counted from when it arrived), the person is no longer shown typing. */
const TYPING_STALE_MS = 7_000;
/** A ping this old when it arrives is a leftover (the sender's app closed mid-typing), not live typing. */
const TYPING_LEFTOVER_MS = 30_000;

type TypingIndicatorResult = {
  isPeerTyping: boolean;
  /** Call with the composer text on every change. */
  notifyTyping: (text: string) => void;
  /** Call when a message is sent or the composer is cleared. */
  stopTyping: () => void;
};

/** WhatsApp-style "typing…": sends throttled pings while the viewer types and follows the other person's pings. */
export function useTypingIndicator(chatId: string, peerId: string): TypingIndicatorResult {
  const [peerTypingAtMs, setPeerTypingAtMs] = useState<number | null>(null);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const lastPingAtRef = useRef(0);
  const isTypingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    lastPingAtRef.current = 0;
    void typingIndicatorService.setTyping(chatId, false);
  }, [chatId]);

  const notifyTyping = useCallback((text: string) => {
    if (!chatId) return;
    if (!text.trim()) {
      stopTyping();
      return;
    }
    const now = Date.now();
    if (!isTypingRef.current || now - lastPingAtRef.current >= TYPING_PING_INTERVAL_MS) {
      isTypingRef.current = true;
      lastPingAtRef.current = now;
      void typingIndicatorService.setTyping(chatId, true);
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [chatId, stopTyping]);

  // Follow the other person's pings.
  useEffect(() => {
    if (!chatId || !peerId) return;
    setPeerTypingAtMs(null);
    return typingIndicatorService.subscribe(chatId, peerId, setPeerTypingAtMs);
  }, [chatId, peerId]);

  // Hide once their latest ping goes stale, so a closed app never leaves "typing…" stuck on. Freshness counts
  // from when the ping arrived (not the sender's clock), so slow networks and clock differences don't hide it.
  useEffect(() => {
    if (peerTypingAtMs === null || serverClockService.nowSync() - peerTypingAtMs > TYPING_LEFTOVER_MS) {
      setIsPeerTyping(false);
      return;
    }
    setIsPeerTyping(true);
    const timer = setTimeout(() => setIsPeerTyping(false), TYPING_STALE_MS);
    return () => clearTimeout(timer);
  }, [peerTypingAtMs]);

  // Leaving the chat clears our own typing state.
  useEffect(() => stopTyping, [stopTyping]);

  return { isPeerTyping, notifyTyping, stopTyping };
}
