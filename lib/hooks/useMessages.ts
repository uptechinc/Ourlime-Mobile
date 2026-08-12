import { useCallback, useEffect } from 'react';
import { MessageResourceService } from '@/lib/services/MessageResourceService';
import { useResourceStore, type MessageResourceData } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';

const messageResourceService = MessageResourceService.getInstance();

export function useMessages(userId: string, peerId: string, chatId: string) {
  const resource = useResourceStore((state) => state.messages[chatId]) ?? createIdleResource<MessageResourceData>();

  useEffect(() => {
    if (!userId || !peerId || !chatId) return;
    void messageResourceService.hydrate(userId, chatId).then(() => messageResourceService.refresh(userId, peerId, chatId));
    messageResourceService.startRealtime(userId, chatId);
    return () => messageResourceService.stopRealtime(chatId);
  }, [userId, peerId, chatId]);

  return {
    resource,
    loadOlder: useCallback(() => messageResourceService.loadOlder(userId, peerId, chatId), [userId, peerId, chatId]),
    markRead: useCallback(() => messageResourceService.markRead(peerId), [peerId]),
  };
}
