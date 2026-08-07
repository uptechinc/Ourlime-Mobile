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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { PostService, type PostItem } from '@/lib/services/PostService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { SkeletonPostCard } from '@/components/home/SkeletonLoaders';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';
import PostCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection';
import PollCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PollCardSection';

const authService = AuthService.getInstance();
const postService = PostService.getInstance();

export default function UserProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted' | 'declined'>('none');
  const [actionLoading, setActionLoading] = useState(false);
  const currentUserId = authService.getCurrentUser()?.uid;

  const loadData = useCallback(async () => {
    if (!username) return;
    try {
      const userProf = await authService.getUserProfileByUsername(username);
      if (userProf) {
        setProfile(userProf);
        const feedPage = await postService.fetchFeedPage({ limit: 20 });
        const filtered = feedPage.posts.filter((p) => p.userId === userProf.uid || p.user.userName === username);
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

  const handleFollow = async () => {
    if (!currentUserId || !profile) return Alert.alert('Sign in required', 'Please sign in.');
    setActionLoading(true);
    try {
      setIsFollowing(!isFollowing);
    } catch (error) {
      console.error('[UserProfileScreen.handleFollow]', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!currentUserId || !profile) return Alert.alert('Sign in required', 'Please sign in.');
    setActionLoading(true);
    try {
      setFriendshipStatus('pending');
    } catch (error) {
      console.error('[UserProfileScreen.handleAddFriend]', error);
    } finally {
      setActionLoading(false);
    }
  };

  const isOwnProfile = profile && currentUserId && profile.uid === currentUserId;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, marginRight: 10 }}>
          <Icon name="chevron-left" size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 }}>
          {profile ? `${profile.firstName} ${profile.lastName}`.trim() : username}
        </Text>
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
            {/* User Profile Card */}
            <View style={{ backgroundColor: '#ffffff', padding: 20, marginBottom: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
              <UserAvatar profileImage={profile?.profilePicture} firstName={profile?.firstName || username} size={84} />
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 12 }}>
                {profile ? `${profile.firstName} ${profile.lastName}`.trim() : username}
              </Text>
              <Text style={{ fontSize: 14, color: '#64748b', marginTop: 2 }}>@{profile?.userName || username}</Text>

              {/* Action Buttons if not own profile */}
              {!isOwnProfile && (
                <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => void handleAddFriend()}
                    disabled={actionLoading || friendshipStatus === 'pending' || friendshipStatus === 'accepted'}
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 9,
                      borderRadius: 20,
                      backgroundColor: friendshipStatus === 'accepted' ? '#e2e8f0' : '#10b981',
                    }}
                  >
                    <Text style={{ color: friendshipStatus === 'accepted' ? '#475569' : '#ffffff', fontWeight: '700' }}>
                      {friendshipStatus === 'accepted' ? 'Friends' : friendshipStatus === 'pending' ? 'Pending' : 'Add Friend'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => void handleFollow()}
                    disabled={actionLoading}
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 9,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: '#10b981',
                      backgroundColor: isFollowing ? '#ffffff' : '#ecfdf5',
                    }}
                  >
                    <Text style={{ color: '#10b981', fontWeight: '700' }}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Posts List */}
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Posts</Text>
              {userPosts.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Text style={{ color: '#64748b' }}>No posts yet.</Text>
                </View>
              ) : (
                userPosts.map((post) => (
                  <View key={post.id} style={{ marginBottom: 16 }}>
                    {post.type === 'poll' ? (
                      <PollCardSection
                        post={post}
                        onCommentClick={() => {}}
                        onPostDelete={() => {}}
                        onAuthorBlocked={() => {}}
                        onPostUpdate={() => {}}
                      />
                    ) : (
                      <PostCardSection
                        post={post}
                        onCommentClick={() => {}}
                        onPostDelete={() => {}}
                        onAuthorBlocked={() => {}}
                        onPostUpdate={() => {}}
                      />
                    )}
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
