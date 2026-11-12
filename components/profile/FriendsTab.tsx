import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import ReportPostModal, { type ReportTarget } from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/ReportPostModal';
import { FriendRowsSkeleton } from '@/components/profile/ProfileTabSkeletons';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { relationshipResourceService } from '@/lib/services/RelationshipResourceService';
import { useRelationshipHub } from '@/lib/hooks/useRelationshipHub';
import { useRelationshipRequests } from '@/lib/hooks/useRelationshipRequests';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { RelationshipHubSection, RelationshipHubUser, RelationshipRequestDirection } from '@/lib/types/relationshipHub';
import { relationshipRequestResourceService } from '@/lib/services/RelationshipRequestResourceService';
import { conversationResourceService } from '@/lib/services/ConversationResourceService';
import { profileResourceService } from '@/lib/services/ProfileResourceService';
import { feedResourceService } from '@/lib/services/FeedResourceService';
import { auth } from '@/lib/firebaseConfig';

type FriendsTabProps = { userId: string; initialSection?: RelationshipHubSection };
type RelationshipFilter = 'all' | 'online' | 'recent' | 'mutual';
type RowAction = 'accept' | 'decline' | 'cancel' | 'remove' | 'follow' | 'unfollow' | 'addFriend';
type ConfirmState = { item: RelationshipHubUser; action: 'remove' | 'unfollow' | 'block' } | null;
type IconName = ComponentProps<typeof Ionicons>['name'];

const sections: { key: RelationshipHubSection; label: string }[] = [
  { key: 'friends', label: 'Friends' }, { key: 'requests', label: 'Requests' }, { key: 'active', label: 'Active' },
  { key: 'following', label: 'Following' }, { key: 'followers', label: 'Followers' }, { key: 'suggestions', label: 'Suggestions' },
];
// Website friends page filter menu.
const FILTERS: { key: RelationshipFilter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'online', label: 'Online' }, { key: 'recent', label: 'Recently Added' }, { key: 'mutual', label: 'Most Mutual Friends' },
];
// Website empty-state copy per tab.
const EMPTY_MESSAGES: Partial<Record<RelationshipHubSection, string>> = {
  friends: "You haven't added any friends yet. Explore suggestions to find people you may know.",
  following: "You're not following anyone yet. Explore suggestions to find people to follow.",
  followers: 'No one is following you yet.',
  requests: 'No pending friend requests.',
  suggestions: "We don't have any friend suggestions for you at the moment. Check back later!",
  active: 'None of your friends are active right now.',
};
const relationshipService = RelationshipService.getInstance();

export default function FriendsTab({ userId, initialSection = 'friends' }: FriendsTabProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [section, setSection] = useState<RelationshipHubSection>(initialSection);
  const [requestDirection, setRequestDirection] = useState<RelationshipRequestDirection>('incoming');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<RelationshipFilter>('all');
  const [actingId, setActingId] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<RelationshipHubUser | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ type: 'success' | 'danger'; title: string; message: string } | null>(null);
  const isOwnAccount = auth.currentUser?.uid === userId;
  const visibleSections = useMemo(
    () => isOwnAccount ? sections : sections.filter((item) => item.key !== 'requests' && item.key !== 'suggestions'),
    [isOwnAccount],
  );
  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);
  useEffect(() => {
    if (!isOwnAccount && (section === 'requests' || section === 'suggestions')) setSection('friends');
  }, [isOwnAccount, section]);
  const hub = useRelationshipHub(userId, section, section !== 'requests');
  const requests = useRelationshipRequests(
    userId,
    requestDirection,
    section === 'requests' ? debouncedSearch : '',
    section === 'requests',
  );
  // Website shows the pending-request count as a badge on the Requests tab.
  const incomingRequests = useRelationshipRequests(userId, 'incoming', '', isOwnAccount);
  const incomingCount = incomingRequests.resource.data?.items.length ?? 0;
  const resource = section === 'requests' ? requests.resource : hub.resource;
  const refresh = section === 'requests' ? requests.refresh : hub.refresh;
  const loadMore = section === 'requests' ? requests.loadMore : hub.loadMore;
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);
  const items = useMemo(() => resource.data?.items ?? [], [resource.data?.items]);
  const visibleItems = useMemo(() => {
    const term = section === 'requests' ? '' : search.trim().toLowerCase();
    const searched = items
      .filter((item) => !hiddenIds.has(item.id))
      .filter((item) => !term || `${item.firstName} ${item.lastName} ${item.userName}`.toLowerCase().includes(term));
    if (filter === 'online') return searched.filter((item) => item.presence.status === 'online');
    if (filter === 'mutual') return [...searched].sort((first, second) => second.mutualCount - first.mutualCount);
    // 'recent' keeps the server order, which lists the newest relationships first.
    return searched;
  }, [filter, hiddenIds, items, search, section]);

  const afterRelationshipChange = (item: RelationshipHubUser): void => {
    relationshipRequestResourceService.removeUserFromCachedRequests(item.id);
    relationshipResourceService.removeUserFromCachedRelationships(userId, item.id);
    void conversationResourceService.removeConversation(userId, item.id);
    relationshipResourceService.invalidateAll();
    relationshipRequestResourceService.invalidate();
    void profileResourceService.refresh({ kind: 'own', userId }, true);
    void feedResourceService.reconcileCachedFeeds(userId);
  };

  const handleAction = async (item: RelationshipHubUser, action: RowAction): Promise<void> => {
    setActingId(item.id);
    try {
      if (action === 'addFriend') {
        await relationshipService.sendFriendRequest(userId, item.id);
        setSentRequestIds((current) => new Set(current).add(item.id));
        relationshipRequestResourceService.invalidate();
        return;
      }
      if (action === 'cancel' && sentRequestIds.has(item.id) && section === 'suggestions') {
        await relationshipService.cancelPendingFriendRequest(userId, item.id);
        setSentRequestIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
        relationshipRequestResourceService.invalidate();
        return;
      }
      if (action === 'remove' || action === 'cancel' || action === 'decline') {
        relationshipResourceService.removeUserFromCachedRelationships(userId, item.id);
        relationshipRequestResourceService.removeUserFromCachedRequests(item.id);
        void conversationResourceService.removeConversation(userId, item.id);
      }
      if (action === 'accept' || action === 'decline') await relationshipService.respondToFriendRequest(item.id, userId, action);
      else if (action === 'cancel' || action === 'remove') await relationshipService.cancelOrRemoveFriend(userId, item.id, action === 'cancel' ? 'pending' : 'accepted');
      else await relationshipService.setFollowing(userId, item.id, action === 'follow');
      afterRelationshipChange(item);
    } catch (actionError: unknown) {
      console.error('[FriendsTab.handleAction] Error:', actionError);
      setNotice({ type: 'danger', title: 'Action failed', message: actionError instanceof Error ? actionError.message : 'Please try again.' });
    } finally {
      setActingId(null);
    }
  };

  const handleConfirm = async (): Promise<void> => {
    if (!confirm) return;
    const { item, action } = confirm;
    if (action !== 'block') {
      setConfirm(null);
      await handleAction(item, action);
      return;
    }
    setActingId(item.id);
    try {
      relationshipResourceService.removeUserFromCachedRelationships(userId, item.id);
      relationshipRequestResourceService.removeUserFromCachedRequests(item.id);
      void conversationResourceService.removeConversation(userId, item.id);
      await relationshipService.blockUser(item.id);
      setHiddenIds((current) => new Set(current).add(item.id));
      afterRelationshipChange(item);
      setConfirm(null);
      setNotice({ type: 'success', title: 'User blocked', message: `@${item.userName} has been blocked.` });
    } catch (blockError: unknown) {
      console.error('[FriendsTab.handleConfirm] Error:', blockError);
      setConfirm(null);
      setNotice({ type: 'danger', title: 'Block failed', message: blockError instanceof Error ? blockError.message : 'Failed to block user' });
    } finally {
      setActingId(null);
    }
  };

  const openProfile = (item: RelationshipHubUser): void => {
    router.push({ pathname: '/profile/[username]', params: { username: item.userName || item.id } });
  };

  const openChat = (item: RelationshipHubUser): void => {
    router.push({ pathname: '/chat/[id]', params: { id: item.id } });
  };

  const renderAction = (item: RelationshipHubUser) => {
    if (actingId === item.id) return <ActivityIndicator color={colors.accent} />;
    if (item.permissions.accept) return <View style={{ flexDirection: 'row', gap: 7 }}><Action label="Accept" primary onPress={() => void handleAction(item, 'accept')} /><Action label="Decline" onPress={() => void handleAction(item, 'decline')} /></View>;
    if (item.permissions.cancel) return <Action label="Cancel" onPress={() => void handleAction(item, 'cancel')} />;
    if (isOwnAccount && section === 'friends') return <Action label="Message" primary onPress={() => openChat(item)} />;
    if (isOwnAccount && section === 'suggestions') {
      return sentRequestIds.has(item.id)
        ? <Action label="Cancel Request" onPress={() => void handleAction(item, 'cancel')} />
        : <Action label="Add Friend" primary onPress={() => void handleAction(item, 'addFriend')} />;
    }
    if (item.permissions.remove) return <Action label="Remove" onPress={() => setConfirm({ item, action: 'remove' })} />;
    if (item.permissions.unfollow) return <Action label="Unfollow" onPress={() => setConfirm({ item, action: 'unfollow' })} />;
    if (item.permissions.follow) return <Action label="Follow" primary onPress={() => void handleAction(item, 'follow')} />;
    return <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />;
  };

  const menuActions = (item: RelationshipHubUser): { key: string; label: string; icon: IconName; destructive?: boolean; onPress: () => void }[] => {
    const actions: { key: string; label: string; icon: IconName; destructive?: boolean; onPress: () => void }[] = [
      { key: 'profile', label: 'View profile', icon: 'person-circle-outline', onPress: () => openProfile(item) },
    ];
    if (section !== 'requests' && section !== 'suggestions') actions.push({ key: 'message', label: 'Message', icon: 'chatbubble-ellipses-outline', onPress: () => openChat(item) });
    if (item.permissions.follow && section === 'suggestions') actions.push({ key: 'follow', label: 'Follow', icon: 'star-outline', onPress: () => void handleAction(item, 'follow') });
    if (item.permissions.remove) actions.push({ key: 'remove', label: section === 'followers' ? 'Remove Friend' : 'Unfriend', icon: 'person-remove-outline', destructive: true, onPress: () => setConfirm({ item, action: 'remove' }) });
    if (item.permissions.unfollow) actions.push({ key: 'unfollow', label: 'Unfollow', icon: 'star-half-outline', onPress: () => setConfirm({ item, action: 'unfollow' }) });
    if (section === 'suggestions') {
      actions.push({ key: 'dismiss', label: 'Remove Suggestion', icon: 'close-circle-outline', onPress: () => {
        setHiddenIds((current) => new Set(current).add(item.id));
        setNotice({ type: 'success', title: 'Suggestion removed', message: `@${item.userName} won't show in this list.` });
      } });
    }
    actions.push({ key: 'block', label: 'Block', icon: 'ban-outline', destructive: true, onPress: () => setConfirm({ item, action: 'block' }) });
    if (section !== 'suggestions') {
      actions.push({ key: 'report', label: section === 'requests' ? 'Report Spam' : 'Report', icon: 'flag-outline', destructive: true, onPress: () => setReportTarget({
        contentType: 'user',
        targetId: item.id,
        reportedUserId: item.id,
        routePath: `/profile/viewOtherProfile/${item.userName}`,
        previewText: `@${item.userName}`,
        label: 'Profile',
      }) });
    }
    return actions;
  };

  const confirmCopy = confirm ? {
    remove: { title: 'Remove friend?', message: `Are you sure you want to remove @${confirm.item.userName} as a friend?`, confirmText: 'Remove Friend' },
    unfollow: { title: 'Unfollow?', message: `Stop following @${confirm.item.userName}?`, confirmText: 'Unfollow' },
    block: { title: `Block @${confirm.item.userName}?`, message: "You will no longer be friends or follow each other, and neither of you will be able to view the other's profile.", confirmText: 'Block' },
  }[confirm.action] : null;

  return (
    <View style={{ paddingVertical: 14, gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {visibleSections.map((item) => {
          const active = section === item.key;
          return (
            <TouchableOpacity key={item.key} onPress={() => setSection(item.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999, backgroundColor: active ? colors.selectedControl : colors.elevated, borderWidth: 1, borderColor: active ? colors.selectedControl : colors.border }}>
              <Text style={{ color: active ? colors.selectedText : colors.text, fontWeight: '800' }}>{item.label}</Text>
              {item.key === 'requests' && incomingCount > 0 ? (
                <View style={{ minWidth: 20, paddingHorizontal: 5, height: 20, borderRadius: 10, backgroundColor: colors.destructive, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '900' }}>{incomingCount > 99 ? '99+' : incomingCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
        {isOwnAccount && section !== 'suggestions' ? (
          <TouchableOpacity onPress={() => setSection('suggestions')} accessibilityLabel="Find Friends" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.successSurface }}>
            <Ionicons name="person-add-outline" size={15} color={colors.successText} />
            <Text style={{ color: colors.successText, fontWeight: '800' }}>Find Friends</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      {section === 'requests' ? <View style={{ marginHorizontal: 16, padding: 4, borderRadius: 14, backgroundColor: colors.control, flexDirection: 'row' }}>{(['incoming', 'outgoing'] as const).map((direction) => <TouchableOpacity key={direction} onPress={() => { setRequestDirection(direction); setSearch(''); setDebouncedSearch(''); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', backgroundColor: requestDirection === direction ? colors.selectedControl : 'transparent' }}><Text style={{ color: requestDirection === direction ? colors.selectedText : colors.secondaryText, fontWeight: '800', textTransform: 'capitalize' }}>{direction}</Text></TouchableOpacity>)}</View> : null}
      <View style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 13 }}>
        <Ionicons name="search-outline" size={18} color={colors.mutedText} />
        <TextInput value={search} onChangeText={setSearch} placeholder={`Search ${section}...`} placeholderTextColor={colors.mutedText} style={{ flex: 1, color: colors.text, paddingVertical: 12 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, alignItems: 'center' }}>
        <Ionicons name="funnel-outline" size={15} color={colors.mutedText} />
        {FILTERS.map((option) => (
          <TouchableOpacity key={option.key} onPress={() => setFilter(option.key)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: filter === option.key ? colors.accent : colors.border, backgroundColor: filter === option.key ? colors.successSurface : colors.surface }}>
            <Text style={{ color: filter === option.key ? colors.successText : colors.secondaryText, fontWeight: '700', fontSize: 12 }}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {resource.data === null && (resource.status === 'hydrating' || resource.status === 'idle') ? <FriendRowsSkeleton count={5} /> : resource.error && resource.data === null ? <View style={{ margin: 16, alignItems: 'center', padding: 20, borderRadius: 18, backgroundColor: colors.surface }}><Text style={{ color: colors.destructiveText, textAlign: 'center', fontWeight: '700' }}>{resource.error.message}</Text><Action label="Retry" primary onPress={() => void refresh()} /></View> : visibleItems.length > 0 ? <View style={{ paddingHorizontal: 16, gap: 9 }}>{visibleItems.map((item) => {
        const displayName = `${item.firstName} ${item.lastName}`.trim() || item.userName || 'Ourlime user';
        const detail = section === 'suggestions'
          ? 'Suggested for you'
          : section === 'followers'
          ? 'Follower'
          : item.mutualCount > 0 ? `${item.mutualCount} mutual friend${item.mutualCount === 1 ? '' : 's'}` : '';
        return <TouchableOpacity key={`${section}-${item.id}`} onPress={() => openProfile(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View><UserAvatar profileImage={item.profileImage} firstName={item.firstName || displayName} size={48} />{item.presence.status === 'online' ? <View style={{ position: 'absolute', right: 0, bottom: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2, borderColor: colors.surface }} /> : null}</View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{displayName}</Text>
            {item.userName ? <Text numberOfLines={1} style={{ color: colors.mutedText, marginTop: 2 }}>@{item.userName}{item.direction !== 'none' ? ` · ${item.direction}` : ''}</Text> : null}
            {detail ? <Text numberOfLines={1} style={{ color: section === 'suggestions' ? colors.accentText : colors.mutedText, fontSize: 12, marginTop: 2, fontWeight: '600' }}>{detail}</Text> : null}
          </View>
          {renderAction(item)}
          {isOwnAccount ? (
            <TouchableOpacity onPress={() => setMenuItem(item)} hitSlop={8} accessibilityRole="button" accessibilityLabel="More options" style={{ padding: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.icon} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>;
      })}{resource.data?.hasMore ? <TouchableOpacity onPress={() => void loadMore()} style={{ alignSelf: 'center', marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.control }}><Text style={{ color: colors.text, fontWeight: '800' }}>Load more</Text></TouchableOpacity> : null}</View> : <View style={{ margin: 16, alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: colors.surface }}><Ionicons name="people-outline" size={36} color={colors.accent} /><Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 10, textAlign: 'center' }}>{search ? `No matches for "${search.trim()}"` : `No ${section} to show`}</Text><Text style={{ color: colors.mutedText, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{search ? 'Try a different name or username.' : filter === 'online' ? 'No one in this list is online right now.' : isOwnAccount ? EMPTY_MESSAGES[section] ?? '' : ''}</Text></View>}

      <Modal visible={menuItem !== null} transparent animationType="fade" onRequestClose={() => setMenuItem(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setMenuItem(null)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' }}>
          <SafeAreaView edges={['bottom', 'left', 'right']} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }} />
            {menuItem ? <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '900', fontSize: 16, marginBottom: 8 }}>@{menuItem.userName}</Text> : null}
            {menuItem ? menuActions(menuItem).map((action) => (
              <TouchableOpacity key={action.key} onPress={() => { setMenuItem(null); action.onPress(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
                <Ionicons name={action.icon} size={20} color={action.destructive ? colors.destructive : colors.icon} />
                <Text style={{ color: action.destructive ? colors.destructiveText : colors.text, fontWeight: '700', fontSize: 15 }}>{action.label}</Text>
              </TouchableOpacity>
            )) : null}
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
      <CustomModal
        visible={confirm !== null}
        type={confirm?.action === 'unfollow' ? 'warning' : 'danger'}
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message ?? ''}
        confirmText={confirmCopy?.confirmText}
        cancelText="Cancel"
        isLoading={confirm !== null && actingId === confirm.item.id}
        onConfirm={() => void handleConfirm()}
        onClose={() => setConfirm(null)}
      />
      <CustomModal
        visible={notice !== null}
        type={notice?.type ?? 'info'}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        onClose={() => setNotice(null)}
      />
      {reportTarget ? <ReportPostModal visible target={reportTarget} onClose={() => setReportTarget(null)} /> : null}
    </View>
  );
}

type ActionProps = { label: string; primary?: boolean; onPress: () => void };
function Action({ label, primary = false, onPress }: ActionProps) {
  const { colors } = useAppTheme();
  return <TouchableOpacity onPress={onPress} style={{ borderRadius: 12, backgroundColor: primary ? colors.accent : colors.control, paddingHorizontal: 11, paddingVertical: 8 }}><Text style={{ color: primary ? colors.onAccent : colors.text, fontWeight: '800', fontSize: 12 }}>{label}</Text></TouchableOpacity>;
}
