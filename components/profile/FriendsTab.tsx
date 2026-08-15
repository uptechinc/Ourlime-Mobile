import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from '@/components/ui/UserAvatar';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { relationshipResourceService } from '@/lib/services/RelationshipResourceService';
import { useRelationshipHub } from '@/lib/hooks/useRelationshipHub';
import { useRelationshipRequests } from '@/lib/hooks/useRelationshipRequests';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { RelationshipHubSection, RelationshipHubUser, RelationshipRequestDirection } from '@/lib/types/relationshipHub';
import { relationshipRequestResourceService } from '@/lib/services/RelationshipRequestResourceService';
import { profileResourceService } from '@/lib/services/ProfileResourceService';
import { feedResourceService } from '@/lib/services/FeedResourceService';
import { auth } from '@/lib/firebaseConfig';

type FriendsTabProps = { userId: string };
const sections: { key: RelationshipHubSection; label: string }[] = [
  { key: 'friends', label: 'Friends' }, { key: 'requests', label: 'Requests' }, { key: 'active', label: 'Active' },
  { key: 'following', label: 'Following' }, { key: 'followers', label: 'Followers' }, { key: 'suggestions', label: 'Suggestions' },
];
const relationshipService = RelationshipService.getInstance();

export default function FriendsTab({ userId }: FriendsTabProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [section, setSection] = useState<RelationshipHubSection>('friends');
  const [requestDirection, setRequestDirection] = useState<RelationshipRequestDirection>('incoming');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const isOwnAccount = auth.currentUser?.uid === userId;
  const visibleSections = useMemo(
    () => isOwnAccount ? sections : sections.filter((item) => item.key !== 'requests' && item.key !== 'suggestions'),
    [isOwnAccount],
  );
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
    return term ? items.filter((item) => `${item.firstName} ${item.lastName} ${item.userName}`.toLowerCase().includes(term)) : items;
  }, [items, search, section]);

  const handleAction = async (item: RelationshipHubUser, action: 'accept' | 'decline' | 'cancel' | 'remove' | 'follow' | 'unfollow') => {
    setActingId(item.id);
    try {
      if (action === 'accept' || action === 'decline') await relationshipService.respondToFriendRequest(item.id, userId, action);
      else if (action === 'cancel' || action === 'remove') await relationshipService.cancelOrRemoveFriend(userId, item.id, action === 'cancel' ? 'pending' : 'accepted');
      else await relationshipService.setFollowing(userId, item.id, action === 'follow');
      relationshipRequestResourceService.removeUserFromCachedRequests(item.id);
      relationshipResourceService.invalidateAll();
      relationshipRequestResourceService.invalidate();
      void profileResourceService.refresh({ kind: 'own', userId }, true);
      void feedResourceService.reconcileCachedFeeds(userId);
      await refresh();
    } finally {
      setActingId(null);
    }
  };

  const renderAction = (item: RelationshipHubUser) => {
    if (actingId === item.id) return <ActivityIndicator color="#10b981" />;
    if (item.permissions.accept) return <View style={{ flexDirection: 'row', gap: 7 }}><Action label="Accept" primary onPress={() => void handleAction(item, 'accept')} /><Action label="Decline" onPress={() => void handleAction(item, 'decline')} /></View>;
    if (item.permissions.cancel) return <Action label="Cancel" onPress={() => void handleAction(item, 'cancel')} />;
    if (item.permissions.remove) return <Action label="Remove" onPress={() => void handleAction(item, 'remove')} />;
    if (item.permissions.unfollow) return <Action label="Unfollow" onPress={() => void handleAction(item, 'unfollow')} />;
    if (item.permissions.follow) return <Action label="Follow" primary onPress={() => void handleAction(item, 'follow')} />;
    return <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />;
  };

  return (
    <View style={{ paddingVertical: 14, gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {visibleSections.map((item) => <TouchableOpacity key={item.key} onPress={() => setSection(item.key)} style={{ paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999, backgroundColor: section === item.key ? colors.selectedControl : colors.elevated, borderWidth: 1, borderColor: section === item.key ? colors.selectedControl : colors.border }}><Text style={{ color: section === item.key ? colors.selectedText : colors.text, fontWeight: '800' }}>{item.label}</Text></TouchableOpacity>)}
      </ScrollView>
      {section === 'requests' ? <View style={{ marginHorizontal: 16, padding: 4, borderRadius: 14, backgroundColor: colors.control, flexDirection: 'row' }}>{(['incoming', 'outgoing'] as const).map((direction) => <TouchableOpacity key={direction} onPress={() => { setRequestDirection(direction); setSearch(''); setDebouncedSearch(''); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', backgroundColor: requestDirection === direction ? colors.selectedControl : 'transparent' }}><Text style={{ color: requestDirection === direction ? colors.selectedText : colors.secondaryText, fontWeight: '800', textTransform: 'capitalize' }}>{direction}</Text></TouchableOpacity>)}</View> : null}
      <View style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 13 }}>
        <Ionicons name="search-outline" size={18} color={colors.mutedText} />
        <TextInput value={search} onChangeText={setSearch} placeholder={`Search ${section}`} placeholderTextColor={colors.mutedText} style={{ flex: 1, color: colors.text, paddingVertical: 12 }} />
      </View>
      {resource.data === null && (resource.status === 'hydrating' || resource.status === 'idle') ? <View style={{ alignItems: 'center', paddingVertical: 28 }}><ActivityIndicator color="#10b981" /></View> : resource.error && resource.data === null ? <View style={{ margin: 16, alignItems: 'center', padding: 20, borderRadius: 18, backgroundColor: colors.surface }}><Text style={{ color: '#ef4444', textAlign: 'center', fontWeight: '700' }}>{resource.error.message}</Text><Action label="Retry" primary onPress={() => void refresh()} /></View> : visibleItems.length > 0 ? <View style={{ paddingHorizontal: 16, gap: 9 }}>{visibleItems.map((item) => {
        const displayName = `${item.firstName} ${item.lastName}`.trim() || item.userName || 'Ourlime user';
        return <TouchableOpacity key={`${section}-${item.id}`} onPress={() => router.push({ pathname: '/profile/[username]', params: { username: item.userName || item.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View><UserAvatar profileImage={item.profileImage} firstName={item.firstName || displayName} size={48} />{item.presence.status === 'online' ? <View style={{ position: 'absolute', right: 0, bottom: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2, borderColor: colors.surface }} /> : null}</View>
          <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{displayName}</Text>{item.userName ? <Text style={{ color: colors.mutedText, marginTop: 2 }}>@{item.userName}{item.direction !== 'none' ? ` · ${item.direction}` : ''}</Text> : null}</View>
          {renderAction(item)}
        </TouchableOpacity>;
      })}{resource.data?.hasMore ? <TouchableOpacity onPress={() => void loadMore()} style={{ alignSelf: 'center', marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.control }}><Text style={{ color: colors.text, fontWeight: '800' }}>Load more</Text></TouchableOpacity> : null}</View> : <View style={{ margin: 16, alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: colors.surface }}><Ionicons name="people-outline" size={36} color="#10b981" /><Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 10 }}>{search ? 'No matches' : `No ${section} to show`}</Text></View>}
    </View>
  );
}

type ActionProps = { label: string; primary?: boolean; onPress: () => void };
function Action({ label, primary = false, onPress }: ActionProps) {
  const { colors } = useAppTheme();
  return <TouchableOpacity onPress={onPress} style={{ marginTop: 8, borderRadius: 12, backgroundColor: primary ? colors.accent : colors.control, paddingHorizontal: 11, paddingVertical: 8 }}><Text style={{ color: primary ? colors.onAccent : colors.text, fontWeight: '800', fontSize: 12 }}>{label}</Text></TouchableOpacity>;
}
