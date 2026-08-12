import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { PostService, type PostItem } from '@/lib/services/PostService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import ReportPostModal from './ReportPostModal';
import DeletePostModal from './DeletePostModal';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';

type ActionFeedback = {
  title: string;
  message: string;
  type: CustomModalType;
};

type PostOptionsSheetProps = {
  visible: boolean;
  post: PostItem;
  currentUserId: string | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
  onBlock: (userId: string) => void;
  onPostUpdate: (post: PostItem) => void;
};

const postService = PostService.getInstance();
const relationshipService = RelationshipService.getInstance();

export default function PostOptionsSheet({ visible, post, currentUserId, onClose, onDelete, onBlock, onPostUpdate }: PostOptionsSheetProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [following, setFollowing] = useState(post.relationshipStatus?.isFollowing === true);
  const [friendshipStatus, setFriendshipStatus] = useState(post.relationshipStatus?.friendshipStatus ?? 'none');
  const [reportVisible, setReportVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [blockConfirmationVisible, setBlockConfirmationVisible] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
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
      setFeedback({ title: 'Done', message: successMessage, type: 'success' });
    } catch (error: unknown) {
      setFeedback({ title: 'Action failed', message: error instanceof Error ? error.message : 'Please try again', type: 'danger' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = () => {
    setDeleteModalVisible(true);
  };

  const handleVisibility = () => {
    const visibility = post.visibility === 'private' ? 'public' : 'private';
    void runAction('visibility', async () => {
      await postService.updateVisibility(post.id, visibility);
      onPostUpdate({ ...post, visibility });
      onClose();
    }, visibility === 'public' ? 'Your post is now public' : 'Your post is now visible to friends only');
  };

  const handleConfirmDelete = async () => {
    await postService.deletePost(post.id);
    onDelete(post.id);
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
    setBlockConfirmationVisible(true);
  };

  const handleConfirmBlock = () => {
    setBlockConfirmationVisible(false);
    void runAction('block', async () => {
      await relationshipService.blockUser(post.userId);
      onBlock(post.userId);
      onClose();
    }, 'User blocked');
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
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => undefined} style={{ width: '85%', maxWidth: 320 }}>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10 }}>
              {!isOwner ? (
                <>
                  {/* 1. Add Friend */}
                  <TouchableOpacity
                    disabled={friendshipStatus !== 'none' || Boolean(busyAction)}
                    onPress={handleFriendRequest}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, opacity: friendshipStatus !== 'none' ? 0.5 : 1 }}
                  >
                    <Icon name="user-plus" size={20} color="#334155" />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: '#1e293b' }}>
                      {friendshipStatus === 'accepted' ? 'Friends' : friendshipStatus === 'pending' ? 'Request Pending' : 'Add Friend'}
                    </Text>
                  </TouchableOpacity>

                  {/* 2. Follow */}
                  <TouchableOpacity
                    disabled={Boolean(busyAction)}
                    onPress={handleFollow}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12 }}
                  >
                    <Icon name={following ? 'user-check' : 'user'} size={20} color="#334155" />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: '#1e293b' }}>
                      {following ? 'Unfollow' : 'Follow'}
                    </Text>
                  </TouchableOpacity>

                  {/* 3. Report Post */}
                  <TouchableOpacity
                    onPress={() => setReportVisible(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12 }}
                  >
                    <Icon name="flag" size={20} color="#ef4444" />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: '#ef4444' }}>
                      Report Post
                    </Text>
                  </TouchableOpacity>

                  {/* 4. Block User (Prominent Red Solid Button) */}
                  <TouchableOpacity
                    disabled={Boolean(busyAction)}
                    onPress={handleBlock}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#dc2626', marginTop: 4, marginBottom: 8 }}
                  >
                    <Icon name="user-x" size={20} color="#ffffff" />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '800', color: '#ffffff' }}>
                      Block User
                    </Text>
                  </TouchableOpacity>

                  <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 4 }} />
                </>
              ) : null}

              {/* 5. Delete Post / Remove Repost */}
              {isOwner ? (
                <>
                  {!post.communityId ? renderRow(
                    post.visibility === 'private' ? 'globe' : 'lock',
                    post.visibility === 'private' ? 'Make Public' : 'Make Private (Friends only)',
                    handleVisibility,
                    { action: 'visibility' }
                  ) : null}
                  <TouchableOpacity
                    disabled={Boolean(busyAction)}
                    onPress={handleDelete}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12 }}
                  >
                    <Icon name="trash-2" size={20} color="#ef4444" />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: '#ef4444' }}>
                      Delete Post
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {/* Close Button */}
              <TouchableOpacity
                onPress={onClose}
                style={{ marginTop: 8, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: '#f8fafc' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748b' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <ReportPostModal visible={reportVisible} post={post} onClose={() => { setReportVisible(false); onClose(); }} />
      <DeletePostModal
        visible={deleteModalVisible}
        onClose={() => {
          setDeleteModalVisible(false);
          onClose();
        }}
        onConfirmDelete={handleConfirmDelete}
      />
      <CustomModal
        visible={blockConfirmationVisible}
        type="danger"
        title="Block this user?"
        message="Their posts will be removed from your feed."
        confirmText="Block"
        cancelText="Cancel"
        isLoading={busyAction === 'block'}
        onConfirm={handleConfirmBlock}
        onClose={() => setBlockConfirmationVisible(false)}
      />
      <CustomModal
        visible={feedback !== null}
        type={feedback?.type}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        onClose={() => setFeedback(null)}
      />
    </>
  );
}
