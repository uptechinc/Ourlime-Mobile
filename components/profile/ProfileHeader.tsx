import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import type { UserProfile } from '@/lib/services/AuthService';
import CachedImage from '@/components/ui/CachedImage';
import UserAvatar from '@/components/ui/UserAvatar';
import { DeepLinkService } from '@/lib/services/DeepLinkService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import ShareContentSheet from '@/components/sharing/ShareContentSheet';

const deepLinkService = DeepLinkService.getInstance();

type ProfileHeaderProps = {
  profile: UserProfile;
  postsCount?: number;
  friendsCount?: number;
  followingCount?: number;
  onEditProfile?: () => void;
  onCustomize?: () => void;
  onFriendsPress?: () => void;
};

export default function ProfileHeader({
  profile,
  postsCount = 0,
  friendsCount = 0,
  followingCount = 0,
  onEditProfile,
  onCustomize,
  onFriendsPress,
}: ProfileHeaderProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeUserId: currentUserId } = useAppData();
  const [shareVisible, setShareVisible] = useState(false);
  const displayName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || profile.userName || 'Ourlime User';
  const handle = `@${profile.userName || 'user'}`;
  const isAdmin = profile.accountType === 'admin' || profile.isAdmin === true;
  const isVerified = profile.identityVerificationStatus === 'verified' || profile.verificationStatus === 'verified';
  const coverImage = profile.coverPhoto || profile.coverImage || profile.coverPicture;

  return (
    <>
    <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      {/* ── Cover Photo Banner ── */}
      <View style={{ height: 140, width: '100%', position: 'relative' }}>
        {coverImage ? (
          <CachedImage
            uri={coverImage}
            recyclingKey={`cover-${profile.uid}-${coverImage}`}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <LinearGradient
            colors={['#059669', '#10b981', '#34d399']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </View>

      {/* ── Profile Header Body ── */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        {/* Avatar overlapping cover */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: -40,
          marginBottom: 12,
        }}>
          <View style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: colors.surface,
            padding: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}>
            <UserAvatar profileImage={profile.profilePicture} firstName={profile.firstName} size={78} />
          </View>

          {/* Action buttons row */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onEditProfile ? <TouchableOpacity
              onPress={onEditProfile}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 14,
                backgroundColor: colors.accent,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 13 }}>Edit Profile</Text>
            </TouchableOpacity> : null}

            {onCustomize ? <TouchableOpacity
              onPress={onCustomize}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: colors.control,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="color-palette-outline" size={18} color={colors.icon} />
            </TouchableOpacity> : null}

            <TouchableOpacity
              onPress={() => setShareVisible(true)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: colors.control,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Name & Handle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{displayName}</Text>
          {isVerified && (
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          )}
          {isAdmin && (
            <TouchableOpacity
              onPress={() => router.push('/admin' as Href)}
              style={{
                backgroundColor: '#fee2e2',
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ionicons name="shield-checkmark" size={13} color="#dc2626" />
              <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '800' }}>ADMIN PORTAL</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={{ fontSize: 14, color: colors.mutedText, marginTop: 2 }}>{handle}</Text>

        {/* Bio */}
        {profile.bio ? (
          <Text style={{ fontSize: 14, color: colors.secondaryText, marginTop: 8, lineHeight: 20 }}>
            {profile.bio}
          </Text>
        ) : null}

        {/* ── Key Metrics Bar ── */}
        <View style={{
          flexDirection: 'row',
          marginTop: 16,
          paddingVertical: 12,
          paddingHorizontal: 16,
          backgroundColor: colors.control,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          justifyContent: 'space-around',
        }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{postsCount}</Text>
            <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 1, fontWeight: '500' }}>Posts</Text>
          </View>
          <View style={{ width: 1, height: '80%', backgroundColor: colors.border, alignSelf: 'center' }} />
          <TouchableOpacity onPress={onFriendsPress} disabled={!onFriendsPress} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{friendsCount}</Text>
            <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 1, fontWeight: '500' }}>Friends</Text>
          </TouchableOpacity>
          <View style={{ width: 1, height: '80%', backgroundColor: colors.border, alignSelf: 'center' }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{followingCount}</Text>
            <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 1, fontWeight: '500' }}>Following</Text>
          </View>
        </View>
      </View>
    </View>
    <ShareContentSheet
      visible={shareVisible}
      currentUserId={currentUserId ?? ''}
      contentLabel="profile"
      title={`${displayName} on Ourlime`}
      message={`Check out ${displayName}'s profile on Ourlime:\n\n${deepLinkService.getProfileShareUrl(profile.userName)}`}
      url={deepLinkService.getProfileShareUrl(profile.userName)}
      onClose={() => setShareVisible(false)}
    />
    </>
  );
}
