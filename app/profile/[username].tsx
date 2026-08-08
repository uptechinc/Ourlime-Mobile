import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Image,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { PostService, type PostItem } from '@/lib/services/PostService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import TimelineTab from '@/components/profile/TimelineTab';
import AboutTab from '@/components/profile/AboutTab';
import GalleryTab from '@/components/profile/GalleryTab';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';
import { SkeletonPostCard } from '@/components/home/SkeletonLoaders';

const authService = AuthService.getInstance();
const postService = PostService.getInstance();
const relationshipService = RelationshipService.getInstance();

type PublicProfileTab = 'timeline' | 'friends' | 'communities' | 'about' | 'gallery';

export default function UserProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<PublicProfileTab>('timeline');

  const [isFollowing, setIsFollowing] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [actionLoading, setActionLoading] = useState(false);

  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?.uid;

  const loadData = useCallback(async () => {
    if (!username) return;
    try {
      const userProf = await authService.getUserProfileByUsername(username);
      if (userProf) {
        setProfile(userProf);
        const feedPage = await postService.fetchFeedPage({ limit: 50 });
        const filtered = feedPage.posts.filter((p) => p.userId === userProf.uid || p.user.userName?.toLowerCase() === username.toLowerCase());
        setUserPosts(filtered);
      } else {
        setProfile({
          uid: username,
          firstName: username,
          lastName: '',
          userName: username,
          email: '',
          accountType: 'regular',
        });
      }
    } catch (error) {
      console.error('[UserProfileScreen.loadData]', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [username]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const handleFollowToggle = async () => {
    if (!currentUserId || !profile) return Alert.alert('Sign in required', 'Please sign in to follow users.');
    setActionLoading(true);
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    try {
      await relationshipService.setFollowing(currentUserId, profile.uid, nextState);
    } catch {
      setIsFollowing(!nextState);
      Alert.alert('Action failed', 'Could not update follow status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFriendRequest = async () => {
    if (!currentUserId || !profile) return Alert.alert('Sign in required', 'Please sign in.');
    setActionLoading(true);
    setFriendshipStatus('pending');
    try {
      await relationshipService.sendFriendRequest(currentUserId, profile.uid);
    } catch {
      setFriendshipStatus('none');
      Alert.alert('Action failed', 'Could not send friend request.');
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
    router.push(`/chat/${profile.uid}` as any);
  };

  const isOwnProfile = profile && currentUserId && profile.uid === currentUserId;
  const displayName = profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || profile.userName : username || 'User';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

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
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#f8fafc' }}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
      >
        {isLoading ? (
          <View style={{ padding: 16 }}>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 16 }}>
              <SkeletonCircle size={84} />
              <SkeletonText width={160} height={20} style={{ marginTop: 12 }} />
              <SkeletonText width={100} height={14} style={{ marginTop: 6 }} />
              <SkeletonBox width={120} height={36} borderRadius={16} style={{ marginTop: 16 }} />
            </View>
            <SkeletonPostCard />
          </View>
        ) : (
          <>
            {/* ── Cover Photo Banner ── */}
            <View style={{ height: 130, width: '100%', position: 'relative' }}>
              {(profile as any)?.coverImage || (profile as any)?.coverPicture ? (
                <Image source={{ uri: (profile as any).coverImage || (profile as any).coverPicture }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
                      disabled={actionLoading || friendshipStatus !== 'none'}
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
              {(profile as any)?.bio ? <Text style={{ fontSize: 14, color: '#334155', marginTop: 8, lineHeight: 20 }}>{(profile as any).bio}</Text> : null}

              {/* Stats Bar */}
              <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                <View style={{ marginRight: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{userPosts.length}</Text>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>Posts</Text>
                </View>
                <View style={{ marginRight: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{(profile as any)?.followersCount ?? 0}</Text>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>Followers</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{(profile as any)?.friendsCount ?? 0}</Text>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>Friends</Text>
                </View>
              </View>
            </View>

            {/* ── Public Tab Selection Bar ── */}
            <View style={{ flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingHorizontal: 12 }}>
              {(['timeline', 'friends', 'communities', 'about', 'gallery'] as const).map((tab) => {
                const isActive = activeTab === tab;
                const label = tab === 'timeline' ? 'Posts' : tab.charAt(0).toUpperCase() + tab.slice(1);
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      alignItems: 'center',
                      borderBottomWidth: 3,
                      borderBottomColor: isActive ? '#10b981' : 'transparent',
                    }}
                  >
                    <Text style={{ color: isActive ? '#10b981' : '#64748b', fontWeight: isActive ? '800' : '600', fontSize: 13 }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Tab Content Views ── */}
            <View style={{ marginTop: 12 }}>
              {activeTab === 'timeline' && (
                <TimelineTab userId={profile ? profile.uid : username} />
              )}

              {activeTab === 'friends' && (
                <View style={{ padding: 16, backgroundColor: '#ffffff', borderRadius: 16, marginHorizontal: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>Friends</Text>
                  <Text style={{ fontSize: 13, color: '#64748b' }}>User's friends list will appear here.</Text>
                </View>
              )}

              {activeTab === 'communities' && (
                <View style={{ padding: 16, backgroundColor: '#ffffff', borderRadius: 16, marginHorizontal: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>Joined Communities</Text>
                  <Text style={{ fontSize: 13, color: '#64748b' }}>Communities joined by this user will appear here.</Text>
                </View>
              )}

              {activeTab === 'about' && (
                <AboutTab profile={profile ?? ({ uid: username, firstName: username, lastName: '', userName: username, email: '', accountType: 'regular' } as UserProfile)} />
              )}

              {activeTab === 'gallery' && (
                <GalleryTab userId={profile ? profile.uid : username} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
