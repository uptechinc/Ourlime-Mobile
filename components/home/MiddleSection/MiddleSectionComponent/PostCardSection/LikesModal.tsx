import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import UserAvatar from '@/components/ui/UserAvatar';
import { PostService, type PostOrigin, type PostUser } from '@/lib/services/PostService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { AuthService } from '@/lib/services/AuthService';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';

type LikesModalProps = { visible: boolean; postId: string; origin: PostOrigin; onClose: () => void };

const postService = PostService.getInstance();
const relationshipService = RelationshipService.getInstance();
const authService = AuthService.getInstance();

export default function LikesModal({ visible, postId, origin, onClose }: LikesModalProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [users, setUsers] = useState<PostUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actingUserId, setActingUserId] = useState<string>();
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [friendRequestedIds, setFriendRequestedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);
  const swipeDismiss = useSwipeDismiss({ visible, onDismiss: onClose, disabled: loading || Boolean(actingUserId) });

  const handleNavigateProfile = (user: PostUser) => {
    onClose();
    const currentUserId = authService.getCurrentUser()?.uid;
    if (currentUserId && user.id === currentUserId) {
      router.push('/(tabs)/Profile');
      return;
    }
    if (user.userName) {
      router.push({ pathname: '/profile/[username]', params: { username: user.userName } });
    }
  };

  const load = useCallback(async (nextCursor?: string | null) => {
    setLoading(true);
    try {
      const page = await postService.fetchPostLikes(postId, origin, nextCursor);
      setUsers((current) => nextCursor ? [...current, ...page.users.filter((user) => !current.some((item) => item.id === user.id))] : page.users);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (error: unknown) {
      setFeedback({ title: 'Likes unavailable', message: error instanceof Error ? error.message : 'Please try again' });
    } finally {
      setLoading(false);
    }
  }, [origin, postId]);

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
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}>
      <Animated.View style={[styles.safeArea, swipeDismiss.animatedStyle]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.border} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close likes" />
        <View style={styles.header}>
          <Text style={styles.title}>Likes</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}><Icon name="x" size={23} color={colors.icon} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {users.map((user) => (
            <View key={user.id} style={styles.userRow}>
              <TouchableOpacity onPress={() => handleNavigateProfile(user)} style={styles.userTouchable}>
                <UserAvatar profileImage={user.profileImage} firstName={user.firstName || user.userName} size={46} />
                <View style={styles.userCopy}>
                  <View style={styles.nameRow}><Text style={styles.name}>{user.firstName} {user.lastName}</Text>{user.emailVerified ? <Icon name="check-circle" size={14} color={colors.accent} style={styles.verifiedIcon} /> : null}</View>
                  <Text style={styles.username}>@{user.userName}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleFollow(user.id)} disabled={followedIds.has(user.id) || actingUserId === user.id} style={[styles.followButton, followedIds.has(user.id) && styles.followingButton]}>
                {actingUserId === user.id ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={[styles.followText, followedIds.has(user.id) && styles.followingText]}>{followedIds.has(user.id) ? 'Following' : 'Follow'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleFriendRequest(user.id)} disabled={friendRequestedIds.has(user.id) || actingUserId === user.id} style={[styles.friendButton, friendRequestedIds.has(user.id) && styles.friendRequestedButton]}><Icon name={friendRequestedIds.has(user.id) ? 'check' : 'user-plus'} size={17} color={friendRequestedIds.has(user.id) ? colors.successText : colors.icon} /></TouchableOpacity>
            </View>
          ))}
          {!loading && users.length === 0 ? <View style={styles.empty}><Icon name="heart" size={38} color={colors.disabledText} /><Text style={styles.emptyText}>No likes yet</Text></View> : null}
          {loading ? <ActivityIndicator style={styles.loader} color={colors.accent} /> : null}
          {hasMore && !loading ? <TouchableOpacity onPress={() => void load(cursor)} style={styles.loadMore}><Text style={styles.loadMoreText}>Load more</Text></TouchableOpacity> : null}
        </ScrollView>
      </SafeAreaView>
      </Animated.View>
    </Modal>
    <CustomModal visible={feedback !== null} type="danger" title={feedback?.title ?? ''} message={feedback?.message ?? ''} onClose={() => setFeedback(null)} />
    </>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  closeButton: { padding: 7 },
  content: { padding: 16, flexGrow: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  userTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  userCopy: { flex: 1, marginLeft: 11 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.text, fontWeight: '800' },
  verifiedIcon: { marginLeft: 4 },
  username: { color: colors.mutedText, fontSize: 13 },
  followButton: { minWidth: 82, paddingHorizontal: 13, paddingVertical: 8, alignItems: 'center', borderRadius: 16, backgroundColor: colors.accent },
  followingButton: { backgroundColor: colors.control },
  followText: { color: colors.onAccent, fontWeight: '700' },
  followingText: { color: colors.mutedText },
  friendButton: { marginLeft: 7, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  friendRequestedButton: { backgroundColor: colors.successSurface },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 10, color: colors.mutedText },
  loader: { margin: 20 },
  loadMore: { alignItems: 'center', padding: 14 },
  loadMoreText: { color: colors.accentText, fontWeight: '800' },
});
