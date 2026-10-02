import { useEffect, useState } from 'react';
import { callService } from '@/lib/services/CallService';
import type { CallSession } from '@/lib/types/call';

// Same rules as the server's pair lock (functions/src/CallSessionService.ts isLive).
const ANSWERED_CALL_LOCK_MS = 4 * 60 * 60 * 1000;

function isLive(session: CallSession, nowMs: number): boolean {
  if (session.state === 'ringing') return session.expiresAtMs > nowMs;
  if (session.state === 'connecting' || session.state === 'active') {
    return nowMs - (session.answeredAtMs ?? session.createdAtMs) < ANSWERED_CALL_LOCK_MS;
  }
  return false;
}

/**
 * Text for the "call on another device" pill in a chat, or null. Shown only while a call between the viewer and
 * this friend is live on a different device (this device's own call is excluded); it clears itself when that call
 * ends or stops ringing. An incoming ring is left to the incoming-call screen.
 */
export function useCallElsewhereNotice(
  currentUserId: string | null | undefined,
  friendId: string | null | undefined,
  friendName: string,
  thisDeviceCallId: string | null,
): string | null {
  const [session, setSession] = useState<CallSession | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setSession(null);
    if (!currentUserId || !friendId) return;
    return callService.subscribeToPairCall(currentUserId, friendId, setSession);
  }, [currentUserId, friendId]);

  // Re-check when a ring runs out, since nobody may update the call document at that moment.
  useEffect(() => {
    setNowMs(Date.now());
    if (session?.state !== 'ringing') return;
    const remainingMs = session.expiresAtMs - Date.now();
    if (remainingMs <= 0) return;
    const timer = setTimeout(() => setNowMs(Date.now()), remainingMs + 250);
    return () => clearTimeout(timer);
  }, [session]);

  if (!session || !currentUserId || session.id === thisDeviceCallId || !isLive(session, nowMs)) return null;
  const isCaller = session.caller.userId === currentUserId;
  if (session.state === 'ringing') return isCaller ? `You're calling ${friendName} on another device` : null;
  return `You're on a call with ${friendName} on another device`;
}
