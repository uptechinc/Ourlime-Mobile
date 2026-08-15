import { Heart, Lock, MoreHorizontal, ShieldCheck, Users } from 'lucide-react-native';
import { Text, TouchableOpacity, View } from 'react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityCardModel, CommunityDirectoryViewMode } from '@/lib/types/community';

type CommunityCardProps = {
  community: CommunityCardModel;
  viewMode: CommunityDirectoryViewMode;
  busy: boolean;
  onOpen: (community: CommunityCardModel) => void;
  onMembershipAction: (community: CommunityCardModel) => void;
  onLeave: (community: CommunityCardModel) => void;
  onReport: (community: CommunityCardModel) => void;
};

const getActionLabel = (community: CommunityCardModel): string => {
  if (community.membershipState === 'banned') return 'Banned';
  if (community.membershipState === 'owner') return 'Owner';
  if (community.membershipState === 'member') return 'View';
  if (community.membershipState === 'pending') return 'Cancel request';
  if (community.membershipState === 'declined' && community.permissions.canRequestAccess) return 'Request again';
  if (community.permissions.canJoin) return 'Join';
  if (community.permissions.canRequestAccess) return 'Request access';
  if (community.verifiedMembersOnly) return 'Verification required';
  return 'Unavailable';
};

const getRoleLabel = (community: CommunityCardModel): string | null => {
  if (community.viewerRole === 'none') return null;
  return community.viewerRole.charAt(0).toUpperCase() + community.viewerRole.slice(1);
};

export default function CommunityCard({ community, viewMode, busy, onOpen, onMembershipAction, onLeave, onReport }: CommunityCardProps) {
  const { colors } = useAppTheme();
  const isJoined = community.membershipState === 'member' || community.membershipState === 'owner';
  const canUsePrimaryAction = isJoined
    || community.permissions.canJoin
    || community.permissions.canRequestAccess
    || community.permissions.canCancelRequest;
  const isDisabled = busy || !canUsePrimaryAction;
  const actionLabel = getActionLabel(community);
  const roleLabel = getRoleLabel(community);
  const handleAction = (): void => {
    if (isJoined) onOpen(community);
    else onMembershipAction(community);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onOpen(community)}
      style={{ flex: 1, flexDirection: viewMode === 'list' ? 'row' : 'column', backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ width: viewMode === 'list' ? 128 : '100%', height: viewMode === 'list' ? 190 : 142, backgroundColor: colors.control }}>
        {community.imageUrl ? <CachedImage uri={community.imageUrl} recyclingKey={`community-card-${community.id}-${community.imageUrl}`} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface }}><Users size={42} color={colors.accent} /></View>}
        <View style={{ position: 'absolute', top: 9, left: 9, flexDirection: 'row', gap: 5 }}>
          {community.categoryName ? <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.92)' }}><Text style={{ color: '#334155', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>{community.categoryName}</Text></View> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: community.isPrivate ? '#fffbeb' : '#ecfdf5' }}><Lock size={9} color={community.isPrivate ? '#92400e' : '#047857'} /><Text style={{ marginLeft: 3, color: community.isPrivate ? '#92400e' : '#047857', fontSize: 9, fontWeight: '900' }}>{community.isPrivate ? 'Private' : 'Public'}</Text></View>
        </View>
        {community.permissions.canReport ? <TouchableOpacity accessibilityLabel="Community actions" onPress={(event) => { event.stopPropagation(); onReport(community); }} style={{ position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' }}><MoreHorizontal size={18} color="#475569" /></TouchableOpacity> : null}
      </View>
      <View style={{ flex: 1, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}><Text numberOfLines={2} style={{ flexShrink: 1, fontSize: 17, lineHeight: 21, fontWeight: '900', color: colors.text }}>{community.title}</Text>{community.isVerified ? <ShieldCheck size={17} color="#3b82f6" style={{ marginLeft: 5 }} /> : null}{roleLabel ? <View style={{ marginLeft: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.successSurface }}><Text style={{ color: colors.accentText, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>{roleLabel}</Text></View> : null}</View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
              {community.creatorProfilePicture ? <CachedImage uri={community.creatorProfilePicture} recyclingKey={`community-creator-${community.creatorId}-${community.creatorProfilePicture}`} style={{ width: 24, height: 24, borderRadius: 12 }} contentFit="cover" /> : <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface }}><Text style={{ color: colors.accentText, fontWeight: '900', fontSize: 11 }}>{community.creatorName.charAt(0).toUpperCase()}</Text></View>}
              <Text numberOfLines={1} style={{ marginLeft: 7, flex: 1, color: colors.mutedText, fontSize: 11 }}>Created by <Text style={{ color: colors.accentText, fontWeight: '800' }}>{community.creatorName}</Text></Text>
            </View>
          </View>
        </View>
        <Text numberOfLines={viewMode === 'list' ? 3 : 2} style={{ minHeight: 39, marginTop: 10, color: colors.secondaryText, lineHeight: 19, fontSize: 13 }}>{community.description || 'No description has been added yet.'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Users size={14} color="#3b82f6" /><Text style={{ marginLeft: 5, color: colors.secondaryText, fontWeight: '800', fontSize: 12 }}>{community.memberCount.toLocaleString()}</Text>
          <Heart size={14} color="#ec4899" style={{ marginLeft: 15 }} /><Text style={{ marginLeft: 5, color: colors.secondaryText, fontWeight: '800', fontSize: 12 }}>{community.likeCount.toLocaleString()}</Text>
          <Text style={{ marginLeft: 15, color: colors.mutedText, fontSize: 11 }}>{community.postCount.toLocaleString()} posts</Text>
          <View style={{ flex: 1 }} />
          {community.topMembers.slice(0, 3).map((member, index) => member.profilePicture ? <CachedImage key={member.userId} uri={member.profilePicture} recyclingKey={`community-member-${member.userId}-${member.profilePicture}`} style={{ width: 23, height: 23, borderRadius: 12, marginLeft: index === 0 ? 0 : -7, borderWidth: 2, borderColor: colors.surface }} contentFit="cover" /> : <View key={member.userId} style={{ width: 23, height: 23, borderRadius: 12, marginLeft: index === 0 ? 0 : -7, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}><Text style={{ color: colors.mutedText, fontSize: 9, fontWeight: '900' }}>{(member.firstName || member.userName).charAt(0).toUpperCase()}</Text></View>)}
        </View>
        {community.friendMemberCount > 0 ? <Text style={{ marginTop: 8, color: colors.accentText, fontSize: 11, fontWeight: '700' }}>{community.friendMemberCount} {community.friendMemberCount === 1 ? 'friend is' : 'friends are'} here</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {community.permissions.canLeave ? <TouchableOpacity disabled={busy} onPress={(event) => { event.stopPropagation(); onLeave(community); }} style={{ flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.destructive }}><Text style={{ color: colors.destructiveText, fontWeight: '900', fontSize: 12 }}>Leave</Text></TouchableOpacity> : null}
          <TouchableOpacity disabled={isDisabled} onPress={(event) => { event.stopPropagation(); handleAction(); }} style={{ flex: 1.5, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: isDisabled ? colors.disabled : community.membershipState === 'pending' ? colors.warningSurface : colors.accent }}><Text style={{ color: isDisabled ? colors.disabledText : community.membershipState === 'pending' ? colors.warningText : colors.onAccent, fontWeight: '900', fontSize: 12 }}>{busy ? 'Updating…' : actionLabel}</Text></TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
