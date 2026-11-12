import { CalendarDays, CheckCircle2, Globe2, Lock, MessageSquareText, Share2, ShieldCheck, Users } from 'lucide-react-native';
import { Text, TouchableOpacity, View } from 'react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityDetailResource, CommunityPersonPreview } from '@/lib/types/community';

type CommunityAboutWorkspaceProps = { detail: CommunityDetailResource; onOpenProfile: (person: CommunityPersonPreview) => void; onInvite: () => void };

export default function CommunityAboutWorkspace({ detail, onOpenProfile, onInvite }: CommunityAboutWorkspaceProps) {
  const { colors } = useAppTheme();
  const { community, rules } = detail;
  const rows = [
    { label: 'Category', value: community.categoryName || 'Uncategorized', icon: Globe2 },
    { label: 'Privacy', value: community.isPrivate ? 'Private community' : 'Public community', icon: community.isPrivate ? Lock : Globe2 },
    { label: 'Verification policy', value: community.verifiedMembersOnly ? 'Verified members only' : 'Verification is not required', icon: ShieldCheck },
    { label: 'Posting permission', value: community.postingPermission, icon: MessageSquareText },
    { label: 'Created', value: community.createdAt ? new Date(community.createdAt).toLocaleDateString() : 'Unavailable', icon: CalendarDays },
    { label: 'Members', value: community.memberCount.toLocaleString(), icon: Users },
  ];
  return <View style={{ margin: 16, padding: 17, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>About & community settings</Text><Text style={{ marginTop: 8, color: colors.secondaryText, lineHeight: 21 }}>{community.description || 'No community description.'}</Text><View style={{ marginTop: 14 }}>{rows.map((row) => <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border }}><View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}><row.icon size={18} color={colors.accent} /></View><View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: colors.mutedText, fontSize: 11 }}>{row.label}</Text><Text style={{ marginTop: 2, color: colors.text, fontWeight: '800', textTransform: row.label === 'Posting permission' ? 'capitalize' : 'none' }}>{row.value}</Text></View></View>)}</View><FriendsHere friends={community.friendMembers} friendCount={community.friendMemberCount} onOpenProfile={onOpenProfile} onInvite={onInvite} /><Text style={{ marginTop: 17, color: colors.text, fontSize: 16, fontWeight: '900' }}>Community rules</Text>{rules.length ? rules.map((rule, index) => <View key={`${index}-${rule}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}><CheckCircle2 size={17} color={colors.accent} /><Text style={{ flex: 1, marginLeft: 8, color: colors.secondaryText, lineHeight: 20 }}>{index + 1}. {rule}</Text></View>) : <Text style={{ marginTop: 8, color: colors.mutedText }}>No additional rules have been published.</Text>}</View>;
}

type FriendsHereProps = { friends: CommunityPersonPreview[]; friendCount: number; onOpenProfile: (person: CommunityPersonPreview) => void; onInvite: () => void };

/** Web CommunityRightSidebar "Friends Here": up to three friends who joined, or an invite prompt. */
function FriendsHere({ friends, friendCount, onOpenProfile, onInvite }: FriendsHereProps) {
  const { colors } = useAppTheme();
  const extra = Math.max(0, friendCount - friends.length);
  return <View style={{ marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><Users size={17} color={colors.accent} /><Text style={{ marginLeft: 7, color: colors.text, fontSize: 16, fontWeight: '900' }}>Friends here</Text></View>
    {friends.length ? <>
      <Text style={{ marginTop: 6, color: colors.mutedText, fontSize: 12 }}>Friends already in this community</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        {friends.map((friend, index) => <TouchableOpacity key={friend.userId} onPress={() => onOpenProfile(friend)} accessibilityRole="button" accessibilityLabel={`View ${friend.firstName || friend.userName}'s profile`} style={{ marginLeft: index === 0 ? 0 : -10, borderRadius: 22, borderWidth: 3, borderColor: colors.surface }}>
          {friend.profilePicture ? <CachedImage uri={friend.profilePicture} recyclingKey={`community-friend-${friend.userId}-${friend.profilePicture}`} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" /> : <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface }}><Text style={{ color: colors.accentText, fontWeight: '900' }}>{(friend.firstName || friend.userName || '?').charAt(0).toUpperCase()}</Text></View>}
        </TouchableOpacity>)}
        {extra > 0 ? <View style={{ marginLeft: -10, width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00D1FF' }}><Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 12 }}>+{extra}</Text></View> : null}
        <Text numberOfLines={1} style={{ flex: 1, marginLeft: 10, color: colors.secondaryText, fontSize: 12 }}>{friends.map((friend) => `@${friend.userName}`).join(', ')}</Text>
      </View>
    </> : <>
      <Text style={{ marginTop: 6, color: colors.mutedText, fontSize: 13 }}>No friends here yet — invite them!</Text>
      <TouchableOpacity onPress={onInvite} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 40, marginTop: 10, borderRadius: 12, backgroundColor: colors.control }}><Share2 size={15} color={colors.secondaryText} /><Text style={{ marginLeft: 6, color: colors.secondaryText, fontWeight: '900' }}>Invite friends</Text></TouchableOpacity>
    </>}
  </View>;
}
