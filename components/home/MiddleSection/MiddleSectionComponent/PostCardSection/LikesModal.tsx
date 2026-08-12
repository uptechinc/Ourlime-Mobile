import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import UserAvatar from '@/components/ui/UserAvatar';
import { PostService, type PostUser } from '@/lib/services/PostService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { AuthService } from '@/lib/services/AuthService';
import CustomModal from '@/components/ui/CustomModal';

type LikesModalProps = { visible: boolean; postId: string; onClose: () => void };

const postService = PostService.getInstance();
const relationshipService = RelationshipService.getInstance();
const authService = AuthService.getInstance();

export default function LikesModal({ visible, postId, onClose }: LikesModalProps) {
  const [users, setUsers] = useState<PostUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actingUserId, setActingUserId] = useState<string>();
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [friendRequestedIds, setFriendRequestedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);

  const load = useCallback(async (nextCursor?: string | null) => {
    setLoading(true);
    try {
      const page = await postService.fetchPostLikes(postId, nextCursor);
      setUsers((current) => nextCursor ? [...current, ...page.users.filter((user) => !current.some((item) => item.id === user.id))] : page.users);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (error: unknown) {
      setFeedback({ title: 'Likes unavailable', message: error instanceof Error ? error.message : 'Please try again' });
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const handleFriendRequest = async (userId: string) => {
    const currentUserId = authService.getCurrentUser()?.uid;
    if (!currentUserId) return setFeedback({ title: 'Sign in required', message: 'Sign in to add friends.' });
    setActingUserId(userId);
    try {
      await relationshipService.sendFriendRequest(currentUserId, userId);
      setFriendRequestedIds((current) => new Set(current).add(userId));
    } catch (error: unknown) {
      setFeedback({ title: 'Request not sent', message: error instanceof Error ? error.message : 'Please try again' });
    } finally {
      setActingUserId(undefined);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setUsers([]);
    setCursor(null);
    setHasMore(false);
    void load();
  }, [visible, postId, load]);

  const handleFollow = async (userId: string) => {
    const currentUserId = authService.getCurrentUser()?.uid;
    if (!currentUserId) return setFeedback({ title: 'Sign in required', message: 'Sign in to follow people.' });
    setActingUserId(userId);
    try {
      await relationshipService.setFollowing(currentUserId, userId, true);
      setFollowedIds((current) => new Set(current).add(userId));
    } catch (error: unknown) {
      setFeedback({ title: 'Could not follow', message: error instanceof Error ? error.message : 'Please try again' });
    } finally {
      setActingUserId(undefined);
    }
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' }}>Likes</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 7 }}><Icon name="x" size={23} color="#374151" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
          {users.map((user) => (
            <View key={user.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
              <UserAvatar profileImage={user.profileImage} firstName={user.firstName || user.userName} size={46} />
              <View style={{ flex: 1, marginLeft: 11 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: '#111827', fontWeight: '800' }}>{user.firstName} {user.lastName}</Text>{user.emailVerified ? <Icon name="check-circle" size={14} color="#10b981" style={{ marginLeft: 4 }} /> : null}</View>
                <Text style={{ color: '#6b7280', fontSize: 13 }}>@{user.userName}</Text>
              </View>
              <TouchableOpacity onPress={() => void handleFollow(user.id)} disabled={followedIds.has(user.id) || actingUserId === user.id} style={{ minWidth: 82, paddingHorizontal: 13, paddingVertical: 8, alignItems: 'center', borderRadius: 16, backgroundColor: followedIds.has(user.id) ? '#f3f4f6' : '#10b981' }}>
                {actingUserId === user.id ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={{ color: followedIds.has(user.id) ? '#6b7280' : '#ffffff', fontWeight: '700' }}>{followedIds.has(user.id) ? 'Following' : 'Follow'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleFriendRequest(user.id)} disabled={friendRequestedIds.has(user.id) || actingUserId === user.id} style={{ marginLeft: 7, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: friendRequestedIds.has(user.id) ? '#d1fae5' : '#f3f4f6' }}><Icon name={friendRequestedIds.has(user.id) ? 'check' : 'user-plus'} size={17} color={friendRequestedIds.has(user.id) ? '#047857' : '#4b5563'} /></TouchableOpacity>
            </View>
          ))}
          {!loading && users.length === 0 ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="heart" size={38} color="#d1d5db" /><Text style={{ marginTop: 10, color: '#6b7280' }}>No likes yet</Text></View> : null}
          {loading ? <ActivityIndicator style={{ margin: 20 }} color="#10b981" /> : null}
          {hasMore && !loading ? <TouchableOpacity onPress={() => void load(cursor)} style={{ alignItems: 'center', padding: 14 }}><Text style={{ color: '#10b981', fontWeight: '800' }}>Load more</Text></TouchableOpacity> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
    <CustomModal visible={feedback !== null} type="danger" title={feedback?.title ?? ''} message={feedback?.message ?? ''} onClose={() => setFeedback(null)} />
    </>
  );
}
