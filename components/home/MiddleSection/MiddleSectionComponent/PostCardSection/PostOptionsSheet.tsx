import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { PostService, type PostItem } from '@/lib/services/PostService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { adminAccessService } from '@/lib/services/AdminAccessService';
import ReportPostModal from './ReportPostModal';
import DeletePostModal from './DeletePostModal';
import AdminDeletionModal from '@/components/moderation/AdminDeletionModal';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';

type ActionFeedback = {
  title: string;
  message: string;
  type: CustomModalType;
};

type PostOptionsSheetProps = {
  visible: boolean;
  post: PostItem;
  currentUserId: string | null;
  canModerateCommunityPost?: boolean;
  onClose: () => void;
  onDelete: (postId: string) => void;
  onBlock: (userId: string) => void;
  onPostUpdate: (post: PostItem) => void;
};

const postService = PostService.getInstance();
const relationshipService = RelationshipService.getInstance();

export default function PostOptionsSheet({ visible, post, currentUserId, canModerateCommunityPost = false, onClose, onDelete, onBlock, onPostUpdate }: PostOptionsSheetProps) {
  const { colors } = useAppTheme();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [following, setFollowing] = useState(post.relationshipStatus?.isFollowing === true);
  const [friendshipStatus, setFriendshipStatus] = useState(post.relationshipStatus?.friendshipStatus ?? 'none');
  const [reportVisible, setReportVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [adminDeleteVisible, setAdminDeleteVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [blockConfirmationVisible, setBlockConfirmationVisible] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const isOwner = Boolean(currentUserId && currentUserId === post.userId);
  const canDelete = isOwner || (post.origin === 'community' && canModerateCommunityPost);

  useEffect(() => {
    adminAccessService.requireAdmin()
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false));
  }, []);

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
        {isBusy ? <ActivityIndicator size="small" color={options?.destructive ? colors.destructive : colors.accent} /> : <Icon name={icon} size={20} color={options?.destructive ? colors.destructive : colors.icon} />}
        <Text style={{ marginLeft: 13, color: options?.destructive ? colors.destructiveText : colors.secondaryText, fontSize: 15, fontWeight: '700' }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal visible={visible && !reportVisible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}>
        <ModalBackdrop onPress={onClose} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <ModalMotionSurface variant="dialog" style={{ width: '85%', maxWidth: 320 }}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={{ backgroundColor: colors.elevated, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10 }}>
              {!isOwner ? (
                <>
                  {/* 1. Add Friend */}
                  <TouchableOpacity
                    disabled={friendshipStatus !== 'none' || Boolean(busyAction)}
                    onPress={handleFriendRequest}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, opacity: friendshipStatus !== 'none' ? 0.5 : 1 }}
                  >
                    <Icon name="user-plus" size={20} color={colors.icon} />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: colors.text }}>
                      {friendshipStatus === 'accepted' ? 'Friends' : friendshipStatus === 'pending' ? 'Request Pending' : 'Add Friend'}
                    </Text>
                  </TouchableOpacity>

                  {/* 2. Follow */}
                  <TouchableOpacity
                    disabled={Boolean(busyAction)}
                    onPress={handleFollow}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12 }}
                  >
                    <Icon name={following ? 'user-check' : 'user'} size={20} color={colors.icon} />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: colors.text }}>
                      {following ? 'Unfollow' : 'Follow'}
                    </Text>
                  </TouchableOpacity>

                  {/* 3. Report Post */}
                  <TouchableOpacity
                    onPress={() => setReportVisible(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12 }}
                  >
                    <Icon name="flag" size={20} color={colors.destructive} />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: colors.destructiveText }}>
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

                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
                </>
              ) : null}

              {/* 5. Delete Post / Remove Repost */}
              {canDelete ? (
                <>
                  {isOwner && !post.communityId ? renderRow(
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
                    <Icon name="trash-2" size={20} color={colors.destructive} />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: colors.destructiveText }}>
                      {isOwner ? 'Delete Post' : 'Remove Community Post'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {/* 6. Admin Delete Option (Visible to Admins) */}
              {isAdmin ? (
                <TouchableOpacity
                  onPress={() => setAdminDeleteVisible(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    marginTop: 4,
                  }}
                >
                  <Ionicons name="shield-checkmark" size={18} color="#ef4444" />
                  <Text style={{ marginLeft: 12, fontSize: 14, fontWeight: '800', color: '#ef4444' }}>
                    Admin Delete Post
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Close Button */}
              <TouchableOpacity
                onPress={onClose}
                style={{ marginTop: 8, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: colors.control }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.secondaryText }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
          </ModalMotionSurface>
        </ModalBackdrop>
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
      <AdminDeletionModal
        visible={adminDeleteVisible}
        contentType="post"
        contentId={post.id}
        contentTitle={post.caption || post.description}
        authorName={[post.user?.firstName, post.user?.lastName].filter(Boolean).join(' ') || post.user?.userName}
        onClose={() => {
          setAdminDeleteVisible(false);
          onClose();
        }}
        onDeleted={() => {
          setAdminDeleteVisible(false);
          onDelete(post.id);
          onClose();
        }}
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
