import { useCallback, useEffect, useState } from 'react';
import { simpleChatMessageService } from '@/lib/services/SimpleChatMessageService';
import type { FullMessage } from '@/lib/messaging/MessagingService';

type SimpleChatMessagesResult = {
  messages: FullMessage[];
  loading: boolean;
  errorMessage: string | null;
  reload: () => Promise<void>;
  addMessage: (message: FullMessage) => void;
  clearMessages: () => void;
};

export function useSimpleChatMessages(peerId: string, chatId: string): SimpleChatMessagesResult {
  const [messages, setMessages] = useState<FullMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!peerId || !chatId) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      setMessages(await simpleChatMessageService.loadRecent(peerId));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [chatId, peerId]);

  useEffect(() => {
    if (!peerId || !chatId) return;
    setMessages([]);
    void reload();
    const unsubscribe = simpleChatMessageService.subscribeToRecent(
      chatId,
      (incomingMessages) => {
        if (incomingMessages.length > 0) {
          setMessages((currentMessages) => simpleChatMessageService.mergeRecent(currentMessages, incomingMessages));
        }
      },
      () => undefined,
    );
    return unsubscribe;
  }, [chatId, peerId, reload]);

  useEffect(() => {
    if (!peerId || messages.length === 0) return;
    void simpleChatMessageService.markRead(peerId).catch(() => undefined);
  }, [messages.length, peerId]);

  return {
    messages,
    loading,
    errorMessage,
    reload,
    addMessage: useCallback((message: FullMessage) => {
      setMessages((currentMessages) => simpleChatMessageService.mergeRecent(currentMessages, [message]));
    }, []),
    clearMessages: useCallback(() => setMessages([]), []),
  };
}
