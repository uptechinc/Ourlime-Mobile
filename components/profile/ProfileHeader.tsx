import { View, Text, TouchableOpacity, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import type { UserProfile } from '@/lib/services/AuthService';
import CachedImage from '@/components/ui/CachedImage';
import UserAvatar from '@/components/ui/UserAvatar';

type ProfileHeaderProps = {
  profile: UserProfile;
  postsCount?: number;
  friendsCount?: number;
  followingCount?: number;
  onEditProfile?: () => void;
  onCustomize?: () => void;
};

export default function ProfileHeader({
  profile,
  postsCount = 0,
  friendsCount = 0,
  followingCount = 0,
  onEditProfile,
  onCustomize,
}: ProfileHeaderProps) {
  const router = useRouter();
  const displayName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || profile.userName || 'Ourlime User';
  const handle = `@${profile.userName || 'user'}`;
  const isAdmin = profile.accountType === 'admin' || profile.isAdmin === true;
  const isVerified = profile.emailVerified === true || profile.verificationStatus === 'verified';
  const coverImage = profile.coverPhoto || profile.coverImage || profile.coverPicture;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${displayName}'s profile on Ourlime: https://ourlime.com/profile/${profile.userName}`,
      });
    } catch {
      // ignore
    }
  };

  return (
    <View style={{ backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
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
            backgroundColor: '#ffffff',
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
                backgroundColor: '#10b981',
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Edit Profile</Text>
            </TouchableOpacity> : null}

            <TouchableOpacity
              onPress={onCustomize}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="color-palette-outline" size={18} color="#475569" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => void handleShare()}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Name & Handle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a' }}>{displayName}</Text>
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

        <Text style={{ fontSize: 14, color: '#64748b', marginTop: 2 }}>{handle}</Text>

        {/* Bio */}
        {profile.bio ? (
          <Text style={{ fontSize: 14, color: '#334155', marginTop: 8, lineHeight: 20 }}>
            {profile.bio}
          </Text>
        ) : null}

        {/* ── Key Metrics Bar ── */}
        <View style={{
          flexDirection: 'row',
          marginTop: 16,
          paddingVertical: 12,
          paddingHorizontal: 16,
          backgroundColor: '#f8fafc',
          borderRadius: 16,
          justifyContent: 'space-around',
        }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#0f172a' }}>{postsCount}</Text>
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1, fontWeight: '500' }}>Posts</Text>
          </View>
          <View style={{ width: 1, height: '80%', backgroundColor: '#e2e8f0', alignSelf: 'center' }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#0f172a' }}>{friendsCount}</Text>
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1, fontWeight: '500' }}>Friends</Text>
          </View>
          <View style={{ width: 1, height: '80%', backgroundColor: '#e2e8f0', alignSelf: 'center' }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#0f172a' }}>{followingCount}</Text>
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1, fontWeight: '500' }}>Following</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
