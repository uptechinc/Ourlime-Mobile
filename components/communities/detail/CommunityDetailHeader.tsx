import { CalendarDays, Edit3, Flag, Heart, Lock, Settings2, Share2, ShieldCheck, Users } from 'lucide-react-native';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityCardModel } from '@/lib/types/community';

type CommunityDetailHeaderProps = {
  community: CommunityCardModel;
  busyAction: boolean;
  onMembershipAction: () => void;
  onLeave: () => void;
  onLike: () => void;
  onShare: () => void;
  onReport: () => void;
  onEdit: () => void;
  onDashboard: () => void;
};

const membershipLabel = (community: CommunityCardModel): string => {
  if (community.membershipState === 'owner') return 'Owner';
  if (community.membershipState === 'member') return 'Joined';
  if (community.membershipState === 'pending') return 'Cancel request';
  if (community.membershipState === 'declined') return 'Request again';
  if (community.membershipState === 'banned') return 'Banned';
  return community.isPrivate ? 'Request access' : 'Join community';
};

export default function CommunityDetailHeader({ community, busyAction, onMembershipAction, onLeave, onLike, onShare, onReport, onEdit, onDashboard }: CommunityDetailHeaderProps) {
  const { colors } = useAppTheme();
  const isOwner = community.membershipState === 'owner';
  const isMember = community.membershipState === 'member';
  const isPending = community.membershipState === 'pending';
  const isBanned = community.membershipState === 'banned';
  const createdDate = community.createdAt ? new Date(community.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date unavailable';

  return (
    <View>
      <View style={{ height: 220, backgroundColor: colors.successSurface }}>
        {community.imageUrl ? (
          <CachedImage uri={community.imageUrl} recyclingKey={`community-detail-${community.id}-${community.imageUrl}`} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Users size={58} color={colors.accent} />
          </View>
        )}
      </View>
      <View style={{ backgroundColor: colors.surface, padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 25, lineHeight: 30, fontWeight: '900', color: colors.text }}>{community.title}</Text>
              {community.isVerified ? <ShieldCheck size={21} color="#3b82f6" style={{ marginLeft: 6 }} /> : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
              {community.categoryName ? (
                <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.control }}>
                  <Text style={{ color: colors.secondaryText, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{community.categoryName}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: community.isPrivate ? colors.warningSurface : colors.successSurface }}>
                <Lock size={11} color={community.isPrivate ? colors.warningText : colors.successText} />
                <Text style={{ marginLeft: 4, color: community.isPrivate ? colors.warningText : colors.successText, fontSize: 10, fontWeight: '900' }}>
                  {community.isPrivate ? 'PRIVATE' : 'PUBLIC'}
                </Text>
              </View>
              {community.verifiedMembersOnly ? (
                <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.control }}>
                  <Text style={{ color: colors.secondaryText, fontSize: 10, fontWeight: '900' }}>VERIFIED MEMBERS</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <Text style={{ marginTop: 13, color: colors.secondaryText, lineHeight: 21 }}>{community.description || 'This community has not added a description yet.'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 13 }}>
          {community.creatorProfilePicture ? (
            <CachedImage uri={community.creatorProfilePicture} recyclingKey={`community-owner-${community.creatorId}-${community.creatorProfilePicture}`} style={{ width: 34, height: 34, borderRadius: 17 }} contentFit="cover" />
          ) : (
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface }}>
              <Text style={{ color: colors.accentText, fontWeight: '900' }}>{community.creatorName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ marginLeft: 9, flex: 1 }}>
            <Text style={{ color: colors.mutedText, fontSize: 11 }}>Created by</Text>
            <Text style={{ color: colors.accentText, fontWeight: '800' }}>{community.creatorName}</Text>
          </View>
          <CalendarDays size={15} color={colors.icon} />
          <Text style={{ marginLeft: 5, color: colors.mutedText, fontSize: 11 }}>{createdDate}</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 17, padding: 13, borderRadius: 15, backgroundColor: colors.control }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{community.memberCount.toLocaleString()}</Text>
            <Text style={{ color: colors.mutedText, fontSize: 11 }}>Members</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{community.likeCount.toLocaleString()}</Text>
            <Text style={{ color: colors.mutedText, fontSize: 11 }}>Likes</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{community.postCount.toLocaleString()}</Text>
            <Text style={{ color: colors.mutedText, fontSize: 11 }}>Posts</Text>
          </View>
        </View>

        {/* ── Action Buttons matching Web ── */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <TouchableOpacity onPress={onLike} disabled={busyAction} style={{ width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: community.isLikedByViewer ? colors.destructiveSurface : colors.control }}>
            <Heart size={20} color={community.isLikedByViewer ? '#ef4444' : colors.icon} fill={community.isLikedByViewer ? '#ef4444' : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onShare} style={{ width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>
            <Share2 size={20} color={colors.icon} />
          </TouchableOpacity>
          {!isOwner && community.permissions.canReport ? (
            <TouchableOpacity onPress={onReport} style={{ width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>
              <Flag size={19} color={colors.icon} />
            </TouchableOpacity>
          ) : null}

          {isOwner ? (
            <>
              <TouchableOpacity onPress={onDashboard} style={{ flex: 1, minHeight: 44, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}>
                <Settings2 size={16} color={colors.text} />
                <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '900' }}>Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onEdit} style={{ flex: 1, minHeight: 44, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}>
                <Edit3 size={16} color={colors.text} />
                <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '900' }}>Edit</Text>
              </TouchableOpacity>
            </>
          ) : isMember ? (
            <>
              {community.permissions.canModerate ? (
                <TouchableOpacity onPress={onDashboard} style={{ flex: 1, minHeight: 44, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}>
                  <Settings2 size={16} color={colors.text} />
                  <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '900' }}>Moderation</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity disabled={busyAction} onPress={onLeave} style={{ flex: community.permissions.canModerate ? undefined : 1, minHeight: 44, paddingHorizontal: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.destructiveSurface }}>
                <Text style={{ color: colors.destructiveText, fontWeight: '900' }}>Leave</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              disabled={busyAction || isBanned}
              onPress={onMembershipAction}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isPending ? colors.warningSurface : isBanned ? colors.disabled : colors.accent,
              }}
            >
              {busyAction ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={{ color: isPending ? colors.warningText : isBanned ? colors.disabledText : colors.onAccent, fontWeight: '900' }}>
                  {membershipLabel(community)}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
