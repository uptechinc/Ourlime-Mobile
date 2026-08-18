import { useCallback, useEffect } from 'react';
import type { Event } from '@/types/eventTypes';
import type { CommunityDetailResource, CommunityJoinRequest, CommunityMember, CommunityPage, CommunityPoll } from '@/lib/types/community';
import type { ResourceState } from '@/lib/types/resourceState';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { CommunityDetailResourceService } from '@/lib/services/CommunityDetailResourceService';

const detailService = CommunityDetailResourceService.getInstance();
const EMPTY_DETAIL: ResourceState<CommunityDetailResource> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
const EMPTY_MEMBERS: ResourceState<CommunityPage<CommunityMember>> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
const EMPTY_REQUESTS: ResourceState<CommunityPage<CommunityJoinRequest>> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
const EMPTY_EVENTS: ResourceState<Event[]> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
const EMPTY_POLLS: ResourceState<CommunityPoll[]> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };

export function useCommunityDetailResource(userId: string, identifier: string) {
  const detail = useResourceStore((state) => state.communityDetails[identifier]) ?? EMPTY_DETAIL;
  const resolvedId = detail.data?.community.id ?? identifier;
  const members = useResourceStore((state) => state.communityMembers[resolvedId]) ?? EMPTY_MEMBERS;
  const requests = useResourceStore((state) => state.communityRequests[resolvedId]) ?? EMPTY_REQUESTS;
  const events = useResourceStore((state) => state.communityEvents[resolvedId]) ?? EMPTY_EVENTS;
  const polls = useResourceStore((state) => state.communityPolls[resolvedId]) ?? EMPTY_POLLS;

  useEffect(() => {
    if (!userId || !identifier) return;
    void detailService.hydrateDetail(userId, identifier).then(() => detailService.refreshDetail(userId, identifier));
  }, [identifier, userId]);

  return {
    detail,
    members,
    requests,
    events,
    polls,
    refreshDetail: useCallback(() => detailService.refreshDetail(userId, identifier, true), [identifier, userId]),
    loadMembers: useCallback((force = false) => detailService.loadWorkspace(userId, resolvedId, 'members', force), [resolvedId, userId]),
    loadMoreMembers: useCallback(() => detailService.loadMoreMembers(userId, resolvedId), [resolvedId, userId]),
    searchMembers: useCallback((search: string) => detailService.searchMembers(userId, resolvedId, search), [resolvedId, userId]),
    loadRequests: useCallback((force = false) => detailService.loadWorkspace(userId, resolvedId, 'requests', force), [resolvedId, userId]),
    loadEvents: useCallback((force = false) => detailService.loadWorkspace(userId, resolvedId, 'events', force), [resolvedId, userId]),
    loadPolls: useCallback((force = false) => detailService.loadWorkspace(userId, resolvedId, 'polls', force), [resolvedId, userId]),
  };
}
