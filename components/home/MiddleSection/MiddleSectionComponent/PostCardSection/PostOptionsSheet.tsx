import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { PostService, type PostItem } from '@/lib/services/PostService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import ReportPostModal from './ReportPostModal';

type PostOptionsSheetProps = {
  visible: boolean;
  post: PostItem;
  currentUserId: string | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
  onBlock: (userId: string) => void;
};

const postService = PostService.getInstance();
const relationshipService = RelationshipService.getInstance();

export default function PostOptionsSheet({ visible, post, currentUserId, onClose, onDelete, onBlock }: PostOptionsSheetProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [following, setFollowing] = useState(post.relationshipStatus?.isFollowing === true);
  const [friendshipStatus, setFriendshipStatus] = useState(post.relationshipStatus?.friendshipStatus ?? 'none');
  const [reportVisible, setReportVisible] = useState(false);
  const isOwner = Boolean(currentUserId && currentUserId === post.userId);

  useEffect(() => {
    setFollowing(post.relationshipStatus?.isFollowing === true);
    setFriendshipStatus(post.relationshipStatus?.friendshipStatus ?? 'none');
  }, [post.relationshipStatus]);

  const runAction = async (action: string, operation: () => Promise<void>, successMessage: string) => {
    if (busyAction) return;
    setBusyAction(action);
    try {
      await operation();
      Alert.alert('Done', successMessage);
    } catch (error: unknown) {
      Alert.alert('Action failed', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete this post?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void runAction('delete', async () => {
          await postService.deletePost(post.id);
          onDelete(post.id);
          onClose();
        }, 'Post deleted'),
      },
    ]);
  };

  const handleFollow = () => {
    if (!currentUserId) return;
    const nextFollowing = !following;
    void runAction('follow', async () => {
      await relationshipService.setFollowing(currentUserId, post.userId, nextFollowing);
      setFollowing(nextFollowing);
    }, nextFollowing ? 'You are now following this user' : 'You unfollowed this user');
  };

  const handleFriendRequest = () => {
    if (!currentUserId || friendshipStatus !== 'none') return;
    void runAction('friend', async () => {
      await relationshipService.sendFriendRequest(currentUserId, post.userId);
      setFriendshipStatus('pending');
    }, 'Friend request sent');
  };

  const handleBlock = () => {
    Alert.alert('Block this user?', 'Their posts will be removed from your feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => void runAction('block', async () => {
          await relationshipService.blockUser(post.userId);
          onBlock(post.userId);
          onClose();
        }, 'User blocked'),
      },
    ]);
  };

  const renderRow = (icon: string, label: string, onPress: () => void, options?: { destructive?: boolean; disabled?: boolean; action?: string }) => {
    const isBusy = options?.action === busyAction;
    return (
      <TouchableOpacity disabled={options?.disabled || Boolean(busyAction)} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 15, opacity: options?.disabled ? 0.45 : 1 }}>
        {isBusy ? <ActivityIndicator size="small" color={options?.destructive ? '#dc2626' : '#10b981'} /> : <Icon name={icon} size={20} color={options?.destructive ? '#dc2626' : '#374151'} />}
        <Text style={{ marginLeft: 13, color: options?.destructive ? '#dc2626' : '#374151', fontSize: 15, fontWeight: '700' }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal visible={visible && !reportVisible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => undefined}>
            <SafeAreaView edges={['top', 'left', 'right']} style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#ffffff', paddingTop: 8, paddingBottom: 20 }}>
              <View style={{ alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#d1d5db', marginBottom: 8 }} />
              <View style={{ paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}><Text style={{ color: '#111827', fontSize: 16, fontWeight: '800' }}>{isOwner ? 'Manage post' : `@${post.user.userName}`}</Text></View>
              {isOwner ? renderRow('trash-2', 'Delete Post', handleDelete, { destructive: true, action: 'delete' }) : (
                <>
                  {renderRow(following ? 'user-check' : 'user-plus', following ? 'Unfollow' : 'Follow', handleFollow, { action: 'follow' })}
                  {renderRow('users', friendshipStatus === 'accepted' ? 'Already Friends' : friendshipStatus === 'pending' ? 'Request Pending' : 'Add Friend', handleFriendRequest, { disabled: friendshipStatus !== 'none', action: 'friend' })}
                  {renderRow('flag', 'Report Post', () => setReportVisible(true), { destructive: true })}
                  {renderRow('user-x', 'Block User', handleBlock, { destructive: true, action: 'block' })}
                </>
              )}
              {renderRow('x', 'Cancel', onClose)}
            </SafeAreaView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <ReportPostModal visible={reportVisible} post={post} onClose={() => { setReportVisible(false); onClose(); }} />
    </>
  );
}
