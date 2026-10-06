import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { simpleChatMessageService } from '@/lib/services/SimpleChatMessageService';
import type { MessageWindowTarget } from '@/lib/services/ChatDataService';
import type { FullMessage } from '@/lib/messaging/MessagingService';

export type ChatTimelineMode = 'live' | 'detached';

/**
 * The messages on screen, oldest first. "live" follows the newest messages; "detached" is a window around a
 * message the reader jumped to (a reply's original) that isn't connected to the newest messages yet.
 */
type ChatTimeline = {
  messages: FullMessage[];
  mode: ChatTimelineMode;
  olderCursor: string | null;
  hasOlder: boolean;
  newerCursor: string | null;
  hasNewer: boolean;
  /** Changes whenever the whole list is replaced (a jump or going back to the latest), so the list re-anchors. */
  windowKey: number;
  /** The message a jump loaded the window around. */
  targetId: string | null;
  /** Newest-message ids already known when the reader jumped away, so only messages after that are counted. */
  liveIdsAtDetach: string[];
};

type SimpleChatMessagesResult = {
  messages: FullMessage[];
  loading: boolean;
  errorMessage: string | null;
  mode: ChatTimelineMode;
  windowKey: number;
  windowTargetId: string | null;
  hasOlder: boolean;
  hasNewer: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  /** Messages from the other person that arrived while a jumped-to window is shown. */
  newWhileDetached: number;
  reload: () => Promise<void>;
  loadOlder: () => Promise<void>;
  loadNewer: () => Promise<void>;
  /** Loads the messages around the target. Resolves to the target's id, or null when it no longer exists. */
  jumpToMessage: (target: MessageWindowTarget) => Promise<string | null>;
  refreshMessage: (message: FullMessage) => Promise<void>;
  addMessage: (message: FullMessage) => void;
  clearMessages: () => void;
};

const EMPTY_TIMELINE: ChatTimeline = {
  messages: [],
  mode: 'live',
  olderCursor: null,
  hasOlder: false,
  newerCursor: null,
  hasNewer: false,
  windowKey: 0,
  targetId: null,
  liveIdsAtDetach: [],
};

export function useSimpleChatMessages(peerId: string, chatId: string): SimpleChatMessagesResult {
  const [timeline, setTimeline] = useState<ChatTimeline>(EMPTY_TIMELINE);
  const [liveMessages, setLiveMessages] = useState<FullMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Bumped whenever the list is replaced, so pages requested for an earlier list are dropped.
  const generationRef = useRef(0);
  const olderInFlightRef = useRef(false);
  const newerInFlightRef = useRef(false);
  const latestLiveRef = useRef<FullMessage[]>([]);

  const showLatest = useCallback(async (extraMessages: FullMessage[] = []) => {
    if (!peerId || !chatId) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    setLoading(true);
    setErrorMessage(null);
    try {
      const latest = await simpleChatMessageService.loadLatest(peerId);
      if (generation !== generationRef.current) return;
      const messages = simpleChatMessageService.mergeMessages(
        simpleChatMessageService.mergeMessages(latest.messages, latestLiveRef.current),
        extraMessages,
      );
      setTimeline((current) => ({
        ...EMPTY_TIMELINE,
        messages,
        olderCursor: latest.cursor,
        hasOlder: latest.hasMore,
        windowKey: current.mode === 'detached' ? current.windowKey + 1 : current.windowKey,
      }));
    } catch (error: unknown) {
      console.error('[useSimpleChatMessages.showLatest] Error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [chatId, peerId]);

  useEffect(() => {
    if (!peerId || !chatId) return;
    latestLiveRef.current = [];
    setLiveMessages([]);
    setTimeline(EMPTY_TIMELINE);
    void showLatest();
    const unsubscribe = simpleChatMessageService.subscribeToRecent(
      chatId,
      (incomingMessages) => {
        latestLiveRef.current = incomingMessages;
        setLiveMessages(incomingMessages);
        if (incomingMessages.length === 0) return;
        setTimeline((current) => (current.mode === 'live'
          ? { ...current, messages: simpleChatMessageService.mergeMessages(current.messages, incomingMessages) }
          : { ...current, messages: simpleChatMessageService.updateShownMessages(current.messages, incomingMessages) }));
      },
      () => undefined,
    );
    return unsubscribe;
  }, [chatId, peerId, showLatest]);

  useEffect(() => {
    if (!peerId || timeline.messages.length === 0) return;
    void simpleChatMessageService.markRead(peerId).catch(() => undefined);
  }, [timeline.messages.length, peerId]);

  const { olderCursor, hasOlder, newerCursor, hasNewer } = timeline;

  const loadOlder = useCallback(async () => {
    if (!peerId || olderInFlightRef.current || !hasOlder || !olderCursor) return;
    olderInFlightRef.current = true;
    setLoadingOlder(true);
    const generation = generationRef.current;
    try {
      const page = await simpleChatMessageService.loadOlder(peerId, olderCursor);
      if (generation !== generationRef.current) return;
      setTimeline((current) => ({
        ...current,
        messages: simpleChatMessageService.mergeMessages(current.messages, page.messages),
        olderCursor: page.cursor,
        hasOlder: page.hasMore,
      }));
    } catch (error: unknown) {
      console.error('[useSimpleChatMessages.loadOlder] Error:', error);
    } finally {
      olderInFlightRef.current = false;
      setLoadingOlder(false);
    }
  }, [hasOlder, olderCursor, peerId]);

  const loadNewer = useCallback(async () => {
    if (!peerId || newerInFlightRef.current || !hasNewer || !newerCursor) return;
    newerInFlightRef.current = true;
    setLoadingNewer(true);
    const generation = generationRef.current;
    try {
      const page = await simpleChatMessageService.loadNewer(peerId, newerCursor);
      if (generation !== generationRef.current) return;
      setTimeline((current) => {
        const messages = simpleChatMessageService.mergeMessages(current.messages, page.messages);
        if (page.hasMore) return { ...current, messages, newerCursor: page.cursor, hasNewer: true };
        // Caught up with the newest messages: follow them live again.
        return {
          ...current,
          messages: simpleChatMessageService.mergeMessages(messages, latestLiveRef.current),
          mode: 'live',
          newerCursor: null,
          hasNewer: false,
          liveIdsAtDetach: [],
        };
      });
    } catch (error: unknown) {
      console.error('[useSimpleChatMessages.loadNewer] Error:', error);
    } finally {
      newerInFlightRef.current = false;
      setLoadingNewer(false);
    }
  }, [hasNewer, newerCursor, peerId]);

  const jumpToMessage = useCallback(async (target: MessageWindowTarget): Promise<string | null> => {
    if (!peerId) return null;
    generationRef.current += 1;
    const generation = generationRef.current;
    const messageWindow = await simpleChatMessageService.loadWindow(peerId, target);
    if (!messageWindow) return null;
    if (generation !== generationRef.current) return messageWindow.targetId;
    const reachedLatest = !messageWindow.hasNewer;
    setTimeline((current) => ({
      messages: reachedLatest
        ? simpleChatMessageService.mergeMessages(messageWindow.messages, latestLiveRef.current)
        : messageWindow.messages,
      mode: reachedLatest ? 'live' : 'detached',
      olderCursor: messageWindow.olderCursor,
      hasOlder: messageWindow.hasOlder,
      newerCursor: reachedLatest ? null : messageWindow.newerCursor,
      hasNewer: !reachedLatest,
      windowKey: current.windowKey + 1,
      targetId: messageWindow.targetId,
      liveIdsAtDetach: reachedLatest ? [] : latestLiveRef.current.map((message) => simpleChatMessageService.getMessageId(message)),
    }));
    return messageWindow.targetId;
  }, [peerId]);

  const refreshMessage = useCallback(async (message: FullMessage) => {
    if (!peerId || !chatId) return;
    const messageId = simpleChatMessageService.getMessageId(message);
    try {
      const refreshed = await simpleChatMessageService.loadMessage(peerId, chatId, message);
      if (!refreshed) return;
      setTimeline((current) => ({
        ...current,
        messages: current.messages.map((candidate) => (
          simpleChatMessageService.getMessageId(candidate) === messageId ? refreshed : candidate
        )),
      }));
    } catch (error: unknown) {
      console.error('[useSimpleChatMessages.refreshMessage] Error:', error);
    }
  }, [chatId, peerId]);

  const addMessage = useCallback((message: FullMessage) => {
    if (timeline.mode === 'detached') {
      // Sending while reading old messages goes back to the newest messages, like WhatsApp.
      void showLatest([message]);
      return;
    }
    setTimeline((current) => ({ ...current, messages: simpleChatMessageService.mergeMessages(current.messages, [message]) }));
  }, [showLatest, timeline.mode]);

  const newWhileDetached = useMemo(() => {
    if (timeline.mode !== 'detached') return 0;
    const known = new Set(timeline.liveIdsAtDetach);
    return liveMessages.filter((message) => (
      message.senderId === peerId && !known.has(simpleChatMessageService.getMessageId(message))
    )).length;
  }, [liveMessages, peerId, timeline.liveIdsAtDetach, timeline.mode]);

  return {
    messages: timeline.messages,
    loading,
    errorMessage,
    mode: timeline.mode,
    windowKey: timeline.windowKey,
    windowTargetId: timeline.targetId,
    hasOlder,
    hasNewer,
    loadingOlder,
    loadingNewer,
    newWhileDetached,
    reload: useCallback(() => showLatest(), [showLatest]),
    loadOlder,
    loadNewer,
    jumpToMessage,
    refreshMessage,
    addMessage,
    clearMessages: useCallback(() => setTimeline((current) => ({ ...EMPTY_TIMELINE, windowKey: current.windowKey })), []),
  };
}
