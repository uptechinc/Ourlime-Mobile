import { useCallback, useEffect } from 'react';
import { ConversationResourceService } from '@/lib/services/ConversationResourceService';
import { useResourceStore } from '@/lib/store/useResourceStore';

const conversationResourceService = ConversationResourceService.getInstance();

export function useConversations(userId: string) {
  const resource = useResourceStore((state) => state.conversations);

  useEffect(() => {
    if (!userId) return;
    void conversationResourceService.hydrate(userId).then(() => conversationResourceService.refresh(userId));
  }, [userId]);

  return {
    resource,
    hasMore: conversationResourceService.hasMore(),
    refresh: useCallback(() => conversationResourceService.refresh(userId, true), [userId]),
    loadMore: useCallback(() => conversationResourceService.loadMore(userId), [userId]),
  };
}
