import { useCallback, useEffect } from 'react';
import { MessageResourceService } from '@/lib/services/MessageResourceService';
import { useResourceStore, type MessageResourceData } from '@/lib/store/useResourceStore';
import { createIdleResource } from '@/lib/types/resourceState';

const messageResourceService = MessageResourceService.getInstance();
const IDLE_MESSAGE_RESOURCE = createIdleResource<MessageResourceData>();

export function useMessages(userId: string, peerId: string, chatId: string) {
  const resource = useResourceStore((state) => state.messages[chatId]) ?? IDLE_MESSAGE_RESOURCE;

  useEffect(() => {
    if (!userId || !peerId || !chatId) return;
    let isActive = true;
    void messageResourceService.hydrate(userId, chatId)
      .then(() => {
        if (!isActive) return;
        messageResourceService.startRealtime(userId, peerId, chatId);
        return messageResourceService.refresh(userId, peerId, chatId);
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
      messageResourceService.stopRealtime(chatId);
    };
  }, [userId, peerId, chatId]);

  return {
    resource,
    refresh: useCallback(() => messageResourceService.refresh(userId, peerId, chatId, true), [userId, peerId, chatId]),
    loadOlder: useCallback(() => messageResourceService.loadOlder(userId, peerId, chatId), [userId, peerId, chatId]),
    markRead: useCallback(() => messageResourceService.markRead(peerId).catch(() => undefined), [peerId]),
  };
}
