import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import type { PublicProfileResult } from '@/lib/services/ProfileService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { ModerationService } from '@/lib/services/ModerationService';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import TimelineTab from '@/components/profile/TimelineTab';
import AboutTab from '@/components/profile/AboutTab';
import GalleryTab from '@/components/profile/GalleryTab';
import ProfileSkeleton from '@/components/profile/ProfileSkeleton';
import CachedImage from '@/components/ui/CachedImage';
import { useProfileResource } from '@/lib/hooks/useProfileResource';
import { profileResourceService } from '@/lib/services/ProfileResourceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const authService = AuthService.getInstance();
const relationshipService = RelationshipService.getInstance();
const moderationService = ModerationService.getInstance();

type ProfileModalState = {
  visible: boolean;
  type: CustomModalType;
  title: string;
  message: string;
  action?: 'block' | 'unblock' | 'report';
};

type PublicProfileTab = 'timeline' | 'friends' | 'communities' | 'about' | 'gallery';

export default function UserProfileScreen() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const { username } = useLocalSearchParams<{ username: string }>();

  const [activeTab, setActiveTab] = useState<PublicProfileTab>('timeline');

  const [isFollowing, setIsFollowing] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [actionLoading, setActionLoading] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ProfileModalState>({ visible: false, type: 'info', title: '', message: '' });

  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?.uid;
  const { resource: publicProfileResource, refresh: refreshProfile } = useProfileResource({ kind: 'public', viewerId: currentUserId ?? 'anonymous', username: username ?? '' });
  const profile = publicProfileResource.data?.profile ?? null;
  const profileDetails = { friends: publicProfileResource.data?.friends ?? [], communities: publicProfileResource.data?.communities ?? [] };
  const isLoading = !publicProfileResource.data && (publicProfileResource.status === 'idle' || publicProfileResource.status === 'hydrating');
  const refreshing = publicProfileResource.status === 'refreshing' && Boolean(publicProfileResource.data);
  const profileError = error ?? publicProfileResource.error?.message ?? null;

  const loadRelationshipState = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
        setIsBlockedByMe(publicProfileResource.data?.isBlockedByMe === true);
        setIsBlockedByOther(publicProfileResource.data?.isBlockedByOther === true);
        if (currentUserId && currentUserId !== profile.uid) {
          const [isFol, fStatus, blockStatus] = await Promise.all([
            relationshipService.checkFollowStatus(currentUserId, profile.uid).catch(() => false),
            relationshipService.checkFriendshipStatus(currentUserId, profile.uid).catch(() => 'none' as const),
            relationshipService.checkBlockStatus(currentUserId, profile.uid),
          ]);
          setIsFollowing(isFol);
          setFriendshipStatus(fStatus);
          setIsBlockedByMe(publicProfileResource.data?.isBlockedByMe === true || blockStatus.isBlockedByMe);
          setIsBlockedByOther(publicProfileResource.data?.isBlockedByOther === true || blockStatus.isBlockedByOther);
        }
    } catch (loadError: unknown) {
      console.error('[UserProfileScreen.loadRelationshipState]', loadError);
    }
  }, [currentUserId, profile, publicProfileResource.data]);

  useEffect(() => {
    void loadRelationshipState();
  }, [loadRelationshipState]);

  const onRefresh = useCallback(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const handleFollowToggle = async () => {
    if (!currentUserId || !profile) return;
    setActionLoading(true);
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    try {
      await relationshipService.setFollowing(currentUserId, profile.uid, nextState);
      await profileResourceService.adjustOwnStats(currentUserId, { following: nextState ? 1 : -1 });
      void refreshProfile();
    } catch {
      setIsFollowing(!nextState);
      setModal({ visible: true, type: 'danger', title: 'Action failed', message: 'Could not update follow status.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleFriendRequest = async () => {
    if (!currentUserId || !profile) return;
    if (friendshipStatus !== 'none') {
      setActionLoading(true);
      try {
        await relationshipService.cancelOrRemoveFriend(currentUserId, profile.uid, friendshipStatus);
        setFriendshipStatus('none');
        if (friendshipStatus === 'accepted') await profileResourceService.adjustOwnStats(currentUserId, { friends: -1 });
        void refreshProfile();
      } catch (friendError: unknown) {
        console.error('[UserProfileScreen.handleFriendRequest:remove]', friendError);
        setModal({ visible: true, type: 'danger', title: 'Action failed', message: 'Could not update this friendship.' });
      } finally {
        setActionLoading(false);
      }
      return;
    }
    setActionLoading(true);
    setFriendshipStatus('pending');
    try {
      await relationshipService.sendFriendRequest(currentUserId, profile.uid);
      void refreshProfile();
    } catch {
      setFriendshipStatus('none');
      setModal({ visible: true, type: 'danger', title: 'Action failed', message: 'Could not send friend request.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = async () => {
    if (!profile) return;
    try {
      await Share.share({
        message: `Check out @${profile.userName}'s profile on Ourlime: https://ourlime.com/profile/${profile.userName}`,
      });
    } catch {
      // ignore
    }
  };

  const handleMessage = () => {
    if (!profile) return;
    router.push({ pathname: '/chat/[id]', params: { id: profile.uid } });
  };

  const handleProfileModeration = async () => {
    if (!profile || !modal.action) return setModal((previous) => ({ ...previous, visible: false }));
    setActionLoading(true);
    try {
      if (modal.action === 'block') {
        await relationshipService.blockUser(profile.uid);
        setIsBlockedByMe(true);
        setIsFollowing(false);
        setFriendshipStatus('none');
      } else if (modal.action === 'unblock') {
        await relationshipService.unblockUser(profile.uid);
        setIsBlockedByMe(false);
      } else {
        await moderationService.reportUser({ targetId: profile.uid, reasonCategory: 'account', reason: 'Suspicious account activity', routePath: `/profile/${profile.userName}` });
      }
      setModal({ visible: true, type: 'success', title: modal.action === 'report' ? 'Report submitted' : 'Profile updated', message: modal.action === 'report' ? 'Thank you. Our moderation team will review this report.' : 'Your block settings were updated.' });
    } catch (moderationError: unknown) {
      console.error('[UserProfileScreen.handleProfileModeration]', moderationError);
      setModal({ visible: true, type: 'danger', title: 'Action failed', message: 'The request could not be completed. Please try again.' });
    } finally {
      setActionLoading(false);
    }
  };

  const isOwnProfile = profile && currentUserId && profile.uid === currentUserId;
  const displayName = profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || profile.userName : username || 'User';
  const canViewPrivateContent = !profile || profile.visibility !== 'private' || isOwnProfile || friendshipStatus === 'accepted';
  const coverImage = profile?.coverPhoto || profile?.coverImage || profile?.coverPicture;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0f172a' : '#ffffff'} />

      {/* Header Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, marginRight: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#111827" />
        </TouchableOpacity>
        <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '800', color: '#111827', flex: 1 }}>
          {displayName}
        </Text>
        <TouchableOpacity onPress={() => void handleShare()} style={{ padding: 6 }}>
          <Ionicons name="share-outline" size={22} color="#475569" />
        </TouchableOpacity>
        {!isOwnProfile && profile ? (
          <TouchableOpacity onPress={() => setModal({ visible: true, type: 'warning', title: isBlockedByMe ? 'Unblock user?' : 'Block user?', message: isBlockedByMe ? `Allow @${profile.userName} to interact with you again?` : `@${profile.userName} will no longer be able to interact with you.`, action: isBlockedByMe ? 'unblock' : 'block' })} style={{ padding: 6 }}>
            <Ionicons name={isBlockedByMe ? 'person-add-outline' : 'ban-outline'} size={21} color="#475569" />
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <ProfileSkeleton />
      ) : !profile ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Ionicons name="person-circle-outline" size={52} color="#94a3b8" />
          <Text style={{ color: '#475569', textAlign: 'center', lineHeight: 21, marginTop: 12 }}>{profileError || 'This profile is unavailable.'}</Text>
          <TouchableOpacity onPress={() => void refreshProfile()} style={{ backgroundColor: '#10b981', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, marginTop: 16 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text></TouchableOpacity>
        </View>
      ) : isBlockedByOther ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}><Text style={{ color: '#475569' }}>This profile is unavailable.</Text></View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: '#f8fafc' }}
          contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
        >
          {profileError ? <TouchableOpacity onPress={() => void refreshProfile()} style={{ marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#fff7ed' }}><Text style={{ color: '#9a3412', textAlign: 'center', fontSize: 12, fontWeight: '700' }}>Showing saved profile · Tap to retry</Text></TouchableOpacity> : null}
          {/* ── Cover Photo Banner ── */}
          <View style={{ height: 130, width: '100%', position: 'relative' }}>
            {coverImage ? (
              <CachedImage uri={coverImage} style={{ width: '100%', height: '100%' }} recyclingKey={`profile-cover:${profile.uid}`} />
            ) : (
              <LinearGradient colors={['#059669', '#10b981', '#34d399']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%' }} />
            )}
          </View>

          {/* ── Profile Header Body ── */}
          <View style={{ backgroundColor: '#ffffff', paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -40, marginBottom: 12 }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#ffffff', padding: 3, elevation: 4 }}>
                <UserAvatar profileImage={profile?.profilePicture} firstName={profile?.firstName || username} size={78} />
              </View>

              {/* Public Actions (Follow, Add Friend, Message) */}
              {!isOwnProfile && (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => void handleFollowToggle()}
                    disabled={actionLoading}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: isFollowing ? '#f1f5f9' : '#10b981',
                      borderWidth: 1,
                      borderColor: isFollowing ? '#cbd5e1' : '#10b981',
                    }}
                  >
                    <Text style={{ color: isFollowing ? '#475569' : '#ffffff', fontWeight: '800', fontSize: 13 }}>
                      {isFollowing ? 'Following' : '+ Follow'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => void handleFriendRequest()}
                  disabled={actionLoading}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: friendshipStatus === 'accepted' ? '#ecfdf5' : friendshipStatus === 'pending' ? '#fef3c7' : '#047857',
                    }}
                  >
                    <Text style={{ color: friendshipStatus === 'accepted' ? '#047857' : friendshipStatus === 'pending' ? '#b45309' : '#ffffff', fontWeight: '700', fontSize: 13 }}>
                      {friendshipStatus === 'accepted' ? 'Friends' : friendshipStatus === 'pending' ? 'Pending' : 'Add Friend'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleMessage}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#f1f5f9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color="#334155" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a' }}>{displayName}</Text>
            <Text style={{ fontSize: 14, color: '#64748b', marginTop: 2 }}>@{profile?.userName || username}</Text>
            {profile.bio ? <Text style={{ fontSize: 14, color: '#334155', marginTop: 8, lineHeight: 20 }}>{profile.bio}</Text> : null}

            {/* Stats Bar */}
            <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
              <View style={{ marginRight: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{profile.postsCount ?? 0}</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>Posts</Text>
              </View>
              <View style={{ marginRight: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{profile.followersCount ?? 0}</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>Followers</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{profile.friendsCount ?? 0}</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>Friends</Text>
              </View>
            </View>
          </View>

          {/* ── Public Sliding Tab Selection Bar ── */}
          {canViewPrivateContent ? <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
          >
            {(['timeline', 'friends', 'communities', 'about', 'gallery'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const label = tab === 'timeline' ? 'Posts' : tab.charAt(0).toUpperCase() + tab.slice(1);
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isActive ? '#10b981' : '#f1f5f9',
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: isActive ? '#ffffff' : '#64748b', fontWeight: isActive ? '800' : '600', fontSize: 13 }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView> : <View style={{ padding: 22, alignItems: 'center', backgroundColor: '#fff' }}><Ionicons name="lock-closed-outline" size={26} color="#64748b" /><Text style={{ color: '#475569', marginTop: 8 }}>This account is private.</Text></View>}

          {/* ── Tab Content Views ── */}
          {canViewPrivateContent ? <View style={{ marginTop: 12 }}>
            {activeTab === 'timeline' && (
              <TimelineTab userId={profile ? profile.uid : username} />
            )}

            {activeTab === 'friends' && (
              <View style={{ padding: 16, backgroundColor: '#ffffff', borderRadius: 16, marginHorizontal: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>Friends</Text>
                {profileDetails.friends.length ? profileDetails.friends.map((friend: PublicProfileResult['friends'][number]) => <TouchableOpacity key={friend.id} onPress={() => router.push({ pathname: '/profile/[username]', params: { username: friend.userName } })} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}><Text style={{ fontWeight: '700', color: '#0f172a' }}>{friend.name}</Text><Text style={{ color: '#64748b', marginTop: 2 }}>@{friend.userName}</Text></TouchableOpacity>) : <Text style={{ fontSize: 13, color: '#64748b' }}>No visible friends.</Text>}
              </View>
            )}

            {activeTab === 'communities' && (
              <View style={{ padding: 16, backgroundColor: '#ffffff', borderRadius: 16, marginHorizontal: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>Joined Communities</Text>
                {profileDetails.communities.length ? profileDetails.communities.map((community: PublicProfileResult['communities'][number]) => <TouchableOpacity key={community.id} onPress={() => router.push({ pathname: '/communities/[id]', params: { id: community.id } })} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}><Text style={{ fontWeight: '700', color: '#0f172a' }}>{community.title}</Text><Text style={{ color: '#64748b', marginTop: 2 }}>{community.membershipCount.toLocaleString()} members</Text></TouchableOpacity>) : <Text style={{ fontSize: 13, color: '#64748b' }}>No visible communities.</Text>}
              </View>
            )}

            {activeTab === 'about' && (
              <AboutTab profile={profile ?? ({ uid: username, firstName: username, lastName: '', userName: username, email: '', accountType: 'regular' } as UserProfile)} />
            )}

            {activeTab === 'gallery' && (
              <GalleryTab userId={profile ? profile.uid : username} />
            )}
          </View> : null}
        </ScrollView>
      )}
      {!isOwnProfile && profile ? <TouchableOpacity onPress={() => setModal({ visible: true, type: 'warning', title: 'Report this profile?', message: 'Submit this profile to Ourlime moderation for suspicious account activity.', action: 'report' })} style={{ position: 'absolute', right: 18, bottom: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fecaca', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ color: '#b91c1c', fontWeight: '700' }}>Report</Text></TouchableOpacity> : null}
      <CustomModal visible={modal.visible} type={modal.type} title={modal.title} message={modal.message} confirmText={modal.action ? 'Confirm' : 'OK'} cancelText={modal.action ? 'Cancel' : undefined} isLoading={actionLoading} onConfirm={modal.action ? () => void handleProfileModeration() : undefined} onClose={() => setModal((previous) => ({ ...previous, visible: false, action: undefined }))} />
    </SafeAreaView>
  );
}
