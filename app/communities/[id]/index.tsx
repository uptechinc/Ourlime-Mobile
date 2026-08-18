import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Flag, Lock, MessageCircle, Plus, Share2 } from 'lucide-react-native';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { CommunityService } from '@/lib/services/CommunityService';
import { CommunityDetailResourceService } from '@/lib/services/CommunityDetailResourceService';
import { CommunityDashboardService, type CommunityReportAction } from '@/lib/services/CommunityDashboardService';
import { CommunitiesResourceService } from '@/lib/services/CommunitiesResourceService';
import { CommunityFeedResourceService } from '@/lib/services/CommunityFeedResourceService';
import { EventService } from '@/lib/services/EventService';
import { ModerationService } from '@/lib/services/ModerationService';
import { FeedResourceService } from '@/lib/services/FeedResourceService';
import { deepLinkService } from '@/lib/services/DeepLinkService';
import { useCommunityDetailResource } from '@/lib/hooks/useCommunityDetailResource';
import { useCommunityFeedResource } from '@/lib/hooks/useCommunityFeedResource';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityCardModel, CommunityDashboardData, CommunityJoinRequest, CommunityMember, CommunityMutationResult, CommunityPoll, CommunityReportItem, CommunityTab, UpdateCommunityInput } from '@/lib/types/community';
import type { ResourceState } from '@/lib/types/resourceState';
import type { PostItem } from '@/lib/services/PostService';
import type { CommunityEventDraft } from '@/components/communities/detail/CommunityEventsWorkspace';
import type { Event } from '@/types/eventTypes';
import PostCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import CreatePostModal from '@/components/home/MiddleSection/MiddleSectionComponent/CreatePostModal';
import CommunityDetailHeader from '@/components/communities/detail/CommunityDetailHeader';
import CommunityAboutWorkspace from '@/components/communities/detail/CommunityAboutWorkspace';
import CommunityMembersWorkspace from '@/components/communities/detail/CommunityMembersWorkspace';
import CommunityEventsWorkspace from '@/components/communities/detail/CommunityEventsWorkspace';
import CommunityPollsWorkspace from '@/components/communities/detail/CommunityPollsWorkspace';
import CommunityDashboardSheet from '@/components/communities/detail/CommunityDashboardSheet';
import EditCommunityModal from '@/components/communities/detail/EditCommunityModal';
import CommunityMemberActionSheet from '@/components/communities/detail/CommunityMemberActionSheet';
import CommunityDetailSkeleton from '@/components/communities/detail/CommunityDetailSkeleton';
import CommunityReportModal from '@/components/communities/CommunityReportModal';
import CustomModal from '@/components/ui/CustomModal';
import type { ReportReasonCategory } from '@/lib/services/ModerationService';

type ConfirmationAction = 'leave' | 'delete' | 'poll-delete' | null;
type ReportTarget = { kind: 'community' } | { kind: 'poll'; poll: CommunityPoll } | { kind: 'event'; event: Event };
type ConfirmationState = {
  visible: boolean;
  action: ConfirmationAction;
  title: string;
  message: string;
  poll: CommunityPoll | null;
};

const authService = AuthService.getInstance();
const communityService = CommunityService.getInstance();
const detailService = CommunityDetailResourceService.getInstance();
const dashboardService = CommunityDashboardService.getInstance();
const directoryService = CommunitiesResourceService.getInstance();
const communityFeedService = CommunityFeedResourceService.getInstance();
const eventService = EventService.getInstance();
const moderationService = ModerationService.getInstance();
const feedService = FeedResourceService.getInstance();

const INITIAL_CONFIRMATION: ConfirmationState = {
  visible: false,
  action: null,
  title: '',
  message: '',
  poll: null,
};
const EMPTY_DASHBOARD: ResourceState<CommunityDashboardData> = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };

export default function CommunityDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const identifier = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  const { colors } = useAppTheme();
  const viewerId = authService.getCurrentUser()?.uid ?? '';
  const resources = useCommunityDetailResource(viewerId, identifier);
  const {
    detail,
    members,
    requests,
    events,
    polls,
    refreshDetail,
    loadMembers,
    loadMoreMembers,
    searchMembers,
    loadRequests,
    loadEvents,
    loadPolls,
  } = resources;
  const detailData = detail.data;
  const community = detailData?.community ?? null;
  const communityId = community?.id ?? '';
  const { resource: postResource, refresh: refreshPosts } = useCommunityFeedResource(viewerId, communityId, Boolean(community?.permissions.canView));
  const posts = useMemo(() => postResource.data ?? [], [postResource.data]);
  const categoriesData = useResourceStore((state) => state.communityCategories.data);
  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);
  const dashboard = useResourceStore((state) => (communityId ? state.communityDashboards[communityId] : undefined)) ?? EMPTY_DASHBOARD;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<CommunityTab>('posts');
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [createPostVisible, setCreatePostVisible] = useState(false);
  const [dashboardVisible, setDashboardVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [managedMember, setManagedMember] = useState<CommunityMember | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(INITIAL_CONFIRMATION);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [eventCreateRequestKey, setEventCreateRequestKey] = useState(0);
  const [pollCreateRequestKey, setPollCreateRequestKey] = useState(0);

  useEffect(() => {
    if (!viewerId) return;
    void authService.getUserProfile(viewerId).then(setProfile).catch(() => setProfile(null));
  }, [viewerId]);

  useEffect(() => {
    if (!communityId || !community?.permissions.canView) return;
    if (activeTab === 'members') void loadMembers();
    if (activeTab === 'events') void loadEvents();
    if (activeTab === 'polls') void loadPolls();
  }, [activeTab, community?.permissions.canView, communityId, loadEvents, loadMembers, loadPolls]);

  const activePost = useMemo(() => posts.find((post) => post.id === activePostId) ?? null, [activePostId, posts]);

  const reconcileCommunity = useCallback(async (): Promise<void> => {
    if (!viewerId || !identifier) return;
    await refreshDetail();
    const latest = useResourceStore.getState().communityDetails[identifier]?.data?.community;
    if (latest) await directoryService.patchCommunity(viewerId, latest);
  }, [identifier, refreshDetail, viewerId]);

  const handleMembershipAction = async (): Promise<void> => {
    if (!community || busy) return;
    setBusy(true);
    try {
      let result: CommunityMutationResult;
      if (community.membershipState === 'pending') {
        result = await communityService.cancelRequest(community.id);
        setFeedback('Your membership request was canceled.');
      } else {
        result = await communityService.joinOrRequestAccess(community);
        setFeedback(result.membershipState === 'member' ? 'You joined the community.' : 'Your request was sent to the community team.');
      }
      const updated: CommunityCardModel = {
        ...community,
        membershipState: result.membershipState,
        memberCount: result.memberCount,
        permissions: {
          ...community.permissions,
          canJoin: result.membershipState === 'none' && !community.isPrivate,
          canRequestAccess: result.membershipState === 'none' && community.isPrivate,
          canCancelRequest: result.membershipState === 'pending',
          canLeave: result.membershipState === 'member',
          canView: result.membershipState === 'member' || !community.isPrivate,
        },
      };
      const state = { ...detail, data: detailData ? { ...detailData, community: updated } : null, status: 'ready' as const, source: 'network' as const, updatedAt: Date.now(), isStale: false, error: null };
      useResourceStore.getState().setCommunityDetail(identifier, state);
      if (community.id && community.id !== identifier) useResourceStore.getState().setCommunityDetail(community.id, state);
      if (community.slug && community.slug !== identifier) useResourceStore.getState().setCommunityDetail(community.slug, state);
      await directoryService.patchCommunity(viewerId, updated);
      await reconcileCommunity();
    } catch (error: unknown) {
      setFeedback(error instanceof Error ? error.message : 'Community membership could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const handleLike = async (): Promise<void> => {
    if (!community || busy) return;
    setBusy(true);
    try {
      const reaction = await communityService.toggleCommunityLike(community.id, !community.isLikedByViewer);
      const updated: CommunityCardModel = { ...community, isLikedByViewer: reaction.liked, likeCount: reaction.likeCount };
      useResourceStore.getState().setCommunityDetail(identifier, { ...detail, data: detailData ? { ...detailData, community: updated } : null, status: 'ready', source: 'network', updatedAt: Date.now(), isStale: false, error: null });
      await directoryService.patchCommunity(viewerId, updated);
    } catch (error: unknown) {
      setFeedback(error instanceof Error ? error.message : 'Community like could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async (): Promise<void> => {
    if (!community) return;
    await Share.share({ title: community.title, message: `Join ${community.title} on Ourlime: ${deepLinkService.getCommunityShareUrl(community.slug || community.id)}` });
  };

  const handleRefresh = async (): Promise<void> => {
    await Promise.all([refreshDetail(), refreshPosts()]);
    if (activeTab === 'members') await loadMembers(true);
    if (activeTab === 'events') await loadEvents(true);
    if (activeTab === 'polls') await loadPolls(true);
  };

  const handlePostUpdate = (post: PostItem): void => { void feedService.patchPost(post); };
  const handlePostDelete = (postId: string): void => { void feedService.removePosts((post) => post.id === postId); };

  const handleCreateEvent = async (draft: CommunityEventDraft): Promise<void> => {
    if (!community || !profile) throw new Error('Your verified profile is still loading.');
    const start = new Date(draft.startDate);
    const end = new Date(draft.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error('Enter valid start and end dates.');
    await eventService.createCommunityEvent({
      title: draft.title.trim(),
      description: draft.summary.trim(),
      summary: draft.summary.trim(),
      startDate: start.toISOString(),
      startTime: start.toLocaleTimeString(),
      endDate: end.toISOString(),
      endTime: end.toLocaleTimeString(),
      location: draft.location.trim() || 'Online',
      recurrence: draft.recurrence,
      creatorId: viewerId,
      userId: viewerId,
      user: { id: viewerId, firstName: profile.firstName, lastName: profile.lastName, userName: profile.userName, profileImage: profile.profilePicture ?? null },
      communityVariantId: community.id,
      image: draft.imageUrl.trim() || undefined,
      media: draft.media,
    });
    await loadEvents(true);
  };

  const handleReviewRequest = async (request: CommunityJoinRequest, action: 'approve' | 'decline'): Promise<void> => {
    if (!community) return;
    await communityService.reviewJoinRequest(community.id, request.requestId, request.userId, action);
    await Promise.all([loadRequests(true), loadMembers(true), reconcileCommunity()]);
  };

  const handleManageMember = (member: CommunityMember): void => {
    setManagedMember(member);
  };

  const refreshMemberResources = async (): Promise<void> => {
    await Promise.all([loadMembers(true), loadRequests(true), reconcileCommunity()]);
  };

  const handleMemberRoleChange = async (member: CommunityMember, role: 'member' | 'moderator' | 'admin'): Promise<void> => {
    if (!community) return;
    await communityService.updateMemberRole(community.id, member.userId, role);
    await refreshMemberResources();
  };

  const handleRemoveMember = async (member: CommunityMember): Promise<void> => {
    if (!community) return;
    await communityService.removeMember(community.id, member.userId);
    await refreshMemberResources();
  };

  const handleBanMember = async (member: CommunityMember): Promise<void> => {
    if (!community) return;
    await communityService.banMember(community.id, member.userId);
    await refreshMemberResources();
  };

  const handleUpdateCommunity = async (updates: UpdateCommunityInput): Promise<void> => {
    if (!community) return;
    const updated = await communityService.updateCommunity(community.id, updates);
    await directoryService.patchCommunity(viewerId, updated);
    await reconcileCommunity();
  };

  const handleLoadDashboard = useCallback((force = false): void => {
    if (!viewerId || !communityId) return;
    void dashboardService.hydrate(viewerId, communityId).then(() => dashboardService.refresh(viewerId, communityId, force));
  }, [communityId, viewerId]);

  const handleLoadDashboardMembers = useCallback((force = false): void => {
    void loadMembers(force);
  }, [loadMembers]);

  const handleLoadDashboardRequests = useCallback((force = false): void => {
    void loadRequests(force);
  }, [loadRequests]);

  const handleOpenDashboard = useCallback((): void => {
    setDashboardVisible(true);
    handleLoadDashboard();
    handleLoadDashboardMembers();
    handleLoadDashboardRequests();
  }, [handleLoadDashboard, handleLoadDashboardMembers, handleLoadDashboardRequests]);

  const handleCloseDashboard = useCallback((): void => {
    setDashboardVisible(false);
  }, []);

  const handleModerateReport = async (report: CommunityReportItem, action: CommunityReportAction): Promise<void> => {
    if (!community) return;
    await dashboardService.moderate(viewerId, { communityId: community.id, reportIds: [report.id], action, targetId: report.targetId, targetType: report.targetType, resolutionNote: action === 'hide' ? 'Content hidden by a community moderator.' : undefined });
    if (action === 'hide' && report.targetType === 'post') await refreshPosts();
    if (action === 'hide' && report.targetType === 'event') await loadEvents(true);
    if (action === 'hide' && report.targetType === 'poll') await loadPolls(true);
  };

  const handleConfirm = async (): Promise<void> => {
    if (!community || !confirmation.action || busy) return;
    setBusy(true);
    try {
      if (confirmation.action === 'leave') {
        const result = await communityService.leaveCommunity(community.id);
        const updated: CommunityCardModel = {
          ...community,
          membershipState: 'none',
          memberCount: result.memberCount,
          permissions: {
            ...community.permissions,
            canJoin: !community.isPrivate,
            canRequestAccess: community.isPrivate,
            canCancelRequest: false,
            canLeave: false,
            canView: !community.isPrivate,
          },
        };
        const state = { ...detail, data: detailData ? { ...detailData, community: updated } : null, status: 'ready' as const, source: 'network' as const, updatedAt: Date.now(), isStale: false, error: null };
        useResourceStore.getState().setCommunityDetail(identifier, state);
        if (community.id && community.id !== identifier) useResourceStore.getState().setCommunityDetail(community.id, state);
        if (community.slug && community.slug !== identifier) useResourceStore.getState().setCommunityDetail(community.slug, state);
        await directoryService.patchCommunity(viewerId, updated);
        await reconcileCommunity();
        setFeedback('You left the community.');
      } else if (confirmation.action === 'delete') {
        await communityService.deleteCommunity(community.id);
        await directoryService.removeCommunity(viewerId, community.id);
        setConfirmation(INITIAL_CONFIRMATION);
        router.back();
        return;
      } else if (confirmation.action === 'poll-delete' && confirmation.poll) {
        await detailService.deletePoll(viewerId, community.id, confirmation.poll.id);
      }
      setConfirmation(INITIAL_CONFIRMATION);
    } catch (error: unknown) {
      setFeedback(error instanceof Error ? error.message : 'The community action could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const showConfirmation = (action: ConfirmationAction, title: string, message: string, poll: CommunityPoll | null = null): void => {
    setConfirmation({ visible: true, action, title, message, poll });
  };

  const handleSubmitReport = async (category: ReportReasonCategory, reason: string, details: string): Promise<void> => {
    if (!community || !reportTarget) return;
    if (reportTarget.kind === 'community') {
      await moderationService.reportCommunity({ targetId: community.id, reasonCategory: category, reason, description: details, routePath: `/communities/${community.slug || community.id}` });
      setFeedback('Your report was sent to the Ourlime moderation team.');
    } else {
      const targetId = reportTarget.kind === 'poll' ? reportTarget.poll.id : reportTarget.event.id;
      if (!targetId) throw new Error('The selected community content could not be identified.');
      await communityService.reportContent({ communityId: community.id, targetId, targetType: reportTarget.kind, reason, details });
      setFeedback(`The ${reportTarget.kind} was reported for review.`);
    }
    setReportTarget(null);
  };

  const tabs: { value: CommunityTab; label: string }[] = [
    { value: 'posts', label: 'Posts' },
    { value: 'events', label: 'Events' },
    { value: 'polls', label: 'Polls' },
    { value: 'about', label: 'About' },
    { value: 'members', label: 'Members' },
  ];

  const initialLoading = !detail.data && (detail.status === 'idle' || detail.status === 'hydrating');
  const errorMessage = detail.error?.message ?? 'This community could not be loaded.';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 12, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back" style={{ padding: 8 }}><ChevronLeft size={27} color={colors.icon} /></TouchableOpacity>
        <Text numberOfLines={1} style={{ flex: 1, marginHorizontal: 7, color: colors.text, fontSize: 18, fontWeight: '900' }}>{community?.title ?? 'Community'}</Text>
        {community ? <><TouchableOpacity onPress={() => void handleShare()} accessibilityLabel="Share community" style={{ padding: 8 }}><Share2 size={20} color={colors.icon} /></TouchableOpacity>{community.permissions.canReport ? <TouchableOpacity onPress={() => setReportTarget({ kind: 'community' })} accessibilityLabel="Report community" style={{ padding: 8 }}><Flag size={19} color={colors.icon} /></TouchableOpacity> : null}</> : null}
      </View>

      {initialLoading ? (
        <CommunityDetailSkeleton activeTab={activeTab} />
      ) : !detailData || !community ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ color: colors.destructiveText, textAlign: 'center' }}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => void refreshDetail()} style={{ marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.accent }}>
            <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={detail.status === 'refreshing'} onRefresh={() => void handleRefresh()} tintColor={colors.accent} />} contentContainerStyle={{ paddingBottom: 48 }}>
          <CommunityDetailHeader community={community} busyAction={busy} onMembershipAction={() => void handleMembershipAction()} onLeave={() => showConfirmation('leave', 'Leave community?', `You will stop seeing member-only content from ${community.title}.`)} onLike={() => void handleLike()} onShare={() => void handleShare()} onReport={() => setReportTarget({ kind: 'community' })} onEdit={() => setEditVisible(true)} onDashboard={handleOpenDashboard} />

        {!community.permissions.canView ? <View style={{ margin: 16, padding: 26, alignItems: 'center', borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><Lock size={38} color={colors.icon} /><Text style={{ marginTop: 11, color: colors.text, fontSize: 18, fontWeight: '900' }}>Private community</Text><Text style={{ marginTop: 6, color: colors.mutedText, textAlign: 'center' }}>An approved membership is required to view this community’s workspaces.</Text></View> : <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>{tabs.map((tab) => <TouchableOpacity key={tab.value} onPress={() => setActiveTab(tab.value)} style={{ marginHorizontal: 4, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999, backgroundColor: activeTab === tab.value ? colors.selectedControl : colors.control }}><Text style={{ color: activeTab === tab.value ? colors.selectedText : colors.secondaryText, fontWeight: '900' }}>{tab.label}</Text></TouchableOpacity>)}</ScrollView>

          {(community.permissions.canPost || community.permissions.canHostEvent || community.permissions.canCreatePoll || community.permissions.canInvite) ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 13 }}>{community.permissions.canPost ? <TouchableOpacity onPress={() => { setActiveTab('posts'); setCreatePostVisible(true); }} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 4, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, backgroundColor: colors.accent }}><Plus size={16} color={colors.onAccent} /><Text style={{ marginLeft: 5, color: colors.onAccent, fontWeight: '900' }}>Create Post</Text></TouchableOpacity> : null}{community.permissions.canHostEvent ? <TouchableOpacity onPress={() => { setActiveTab('events'); setEventCreateRequestKey((current) => current + 1); }} style={{ marginHorizontal: 4, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, backgroundColor: colors.control }}><Text style={{ color: colors.secondaryText, fontWeight: '900' }}>Host Event</Text></TouchableOpacity> : null}{community.permissions.canCreatePoll ? <TouchableOpacity onPress={() => { setActiveTab('polls'); setPollCreateRequestKey((current) => current + 1); }} style={{ marginHorizontal: 4, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, backgroundColor: colors.control }}><Text style={{ color: colors.secondaryText, fontWeight: '900' }}>Create Poll</Text></TouchableOpacity> : null}{community.permissions.canInvite ? <TouchableOpacity onPress={() => void handleShare()} style={{ marginHorizontal: 4, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, backgroundColor: colors.control }}><Text style={{ color: colors.secondaryText, fontWeight: '900' }}>Share Invite</Text></TouchableOpacity> : null}</ScrollView> : null}

          {activeTab === 'posts' ? <View style={{ paddingTop: 13 }}>{postResource.data === null && (postResource.status === 'idle' || postResource.status === 'hydrating') ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} /> : postResource.data === null && postResource.error ? <View style={{ margin: 16, padding: 25, alignItems: 'center', borderRadius: 18, backgroundColor: colors.surface }}><Text style={{ color: colors.destructiveText, textAlign: 'center' }}>{postResource.error.message}</Text><TouchableOpacity onPress={() => void refreshPosts()} style={{ marginTop: 12, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '900' }}>Retry</Text></TouchableOpacity></View> : posts.length ? posts.map((post) => <View key={post.id} style={{ marginBottom: 13 }}><PostCardSection post={post} canModerateCommunityPost={community.permissions.canModerate} onCommentClick={setActivePostId} onPostDelete={handlePostDelete} onAuthorBlocked={(blockedUserId) => void feedService.removePosts((item) => item.userId === blockedUserId)} onPostUpdate={handlePostUpdate} /></View>) : <View style={{ margin: 16, padding: 28, alignItems: 'center', borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><MessageCircle size={40} color={colors.accent} /><Text style={{ marginTop: 10, color: colors.text, fontWeight: '900' }}>No posts yet</Text><Text style={{ marginTop: 4, color: colors.mutedText }}>Start the first community conversation.</Text></View>}</View> : null}
          {activeTab === 'events' ? <CommunityEventsWorkspace resource={events} canCreate={community.permissions.canHostEvent} createRequestKey={eventCreateRequestKey} onRetry={() => void loadEvents(true)} onCreate={handleCreateEvent} onToggleAttendance={async (eventId) => { await eventService.toggleCommunityAttendance(community.id, eventId); await loadEvents(true); }} onUpdate={async (eventId, draft) => { await eventService.updateCommunityEvent(community.id, eventId, { title: draft.title, description: draft.summary, summary: draft.summary, startDate: draft.startDate, endDate: draft.endDate, location: draft.location, recurrence: draft.recurrence, image: draft.imageUrl || undefined, media: draft.media }); await loadEvents(true); }} onDelete={async (eventId) => { await eventService.deleteCommunityEvent(community.id, eventId); await loadEvents(true); }} onReport={(event) => setReportTarget({ kind: 'event', event })} /> : null}
          {activeTab === 'polls' ? <CommunityPollsWorkspace resource={polls} canCreate={community.permissions.canCreatePoll} createRequestKey={pollCreateRequestKey} onRetry={() => void loadPolls(true)} onCreate={async (question, options, durationHours, allowMultiple) => detailService.createPoll(viewerId, { communityId: community.id, question, options, durationHours, allowMultiple })} onVote={(pollId, optionIndex) => detailService.votePoll(viewerId, community.id, pollId, optionIndex)} onDelete={(poll) => showConfirmation('poll-delete', 'Delete poll?', 'This poll and its votes will be permanently removed.', poll)} onReport={(poll) => setReportTarget({ kind: 'poll', poll })} /> : null}
          {activeTab === 'about' ? <CommunityAboutWorkspace detail={detailData} /> : null}
          {activeTab === 'members' ? <CommunityMembersWorkspace resource={members} canManage={community.permissions.canManageMembers} onRetry={() => void loadMembers(true)} onLoadMore={() => void loadMoreMembers()} onSearch={(search) => void searchMembers(search)} onOpenProfile={(member) => router.push({ pathname: '/profile/[username]', params: { username: member.userName || member.userId } })} onManageMember={handleManageMember} /> : null}
        </>}
      </ScrollView>
      )}

      {createPostVisible && profile && community ? <CreatePostModal setTogglePostForm={setCreatePostVisible} userProfile={profile} communityId={community.id} communityName={community.title} onCreatePost={(post) => { void Promise.all([communityFeedService.prepend(viewerId, community.id, post), feedService.prependCreated({ userId: viewerId, scope: 'communities', filter: 'all' }, post), feedService.prependCreated({ userId: viewerId, scope: 'home', filter: 'all' }, post)]); useResourceStore.getState().upsertPostEntities([post]); }} /> : null}
      {activePost && profile ? <CommentsModal post={activePost} userId={profile.uid} onClose={() => setActivePostId(null)} onPostUpdate={handlePostUpdate} /> : null}
      {community ? <CommunityDashboardSheet visible={dashboardVisible} community={community} members={members} requests={requests} dashboard={dashboard} onClose={handleCloseDashboard} onLoadMembers={handleLoadDashboardMembers} onLoadRequests={handleLoadDashboardRequests} onLoadDashboard={handleLoadDashboard} onReviewRequest={handleReviewRequest} onManageMember={handleManageMember} onModerateReport={handleModerateReport} /> : null}
      {community && detailData ? <EditCommunityModal visible={editVisible} community={community} categories={categories} rules={detailData.rules} onClose={() => setEditVisible(false)} onSave={handleUpdateCommunity} onDelete={() => { setEditVisible(false); showConfirmation('delete', 'Delete community?', `${community.title} and its community data will be permanently removed.`); }} /> : null}
      <CommunityMemberActionSheet visible={Boolean(managedMember)} member={managedMember} onClose={() => setManagedMember(null)} onRoleChange={handleMemberRoleChange} onRemove={handleRemoveMember} onBan={handleBanMember} />
      <CustomModal visible={Boolean(feedback)} title="Community" message={feedback ?? ''} type="info" onClose={() => setFeedback(null)} />
      <CustomModal visible={confirmation.visible} title={confirmation.title} message={confirmation.message} type={confirmation.action === 'leave' ? 'warning' : 'danger'} confirmText={confirmation.action === 'leave' ? 'Leave community' : 'Delete'} cancelText="Cancel" isLoading={busy} onConfirm={() => void handleConfirm()} onCancel={() => setConfirmation(INITIAL_CONFIRMATION)} onClose={() => setConfirmation(INITIAL_CONFIRMATION)} />
      <CommunityReportModal visible={reportTarget !== null} title={reportTarget?.kind === 'poll' ? 'Report poll' : reportTarget?.kind === 'event' ? 'Report event' : 'Report community'} subjectLabel={reportTarget?.kind === 'poll' ? reportTarget.poll.question : reportTarget?.kind === 'event' ? reportTarget.event.title : community?.title ?? ''} onClose={() => setReportTarget(null)} onSubmit={handleSubmitReport} />
    </SafeAreaView>
  );
}
