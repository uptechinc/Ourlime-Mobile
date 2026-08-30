import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import type { Reel } from '@/types/userTypes';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { adminAccessService } from '@/lib/services/AdminAccessService';
import AdminDeletionModal from '@/components/moderation/AdminDeletionModal';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';

type ActionFeedback = {
  title: string;
  message: string;
  type: CustomModalType;
};

type LimeOptionsSheetProps = {
  visible: boolean;
  reel: Reel;
  currentUserId: string | null;
  isFollowing: boolean;
  onClose: () => void;
  onDeleteRequest: (reel: Reel) => void;
  onFollowToggle: (userId: string, currentlyFollowing: boolean) => void;
  onReport: (reelId: string, reportedUserId: string, reportType: 'lime' | 'user') => void;
  onBlock?: (userId: string) => void;
};

const relationshipService = RelationshipService.getInstance();

export default function LimeOptionsSheet({
  visible,
  reel,
  currentUserId,
  isFollowing,
  onClose,
  onDeleteRequest,
  onFollowToggle,
  onReport,
  onBlock,
}: LimeOptionsSheetProps) {
  const { colors } = useAppTheme();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [following, setFollowing] = useState(isFollowing);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [adminDeleteVisible, setAdminDeleteVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [blockConfirmationVisible, setBlockConfirmationVisible] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const isOwner = Boolean(currentUserId && currentUserId === reel.userId);

  useEffect(() => {
    adminAccessService
      .requireAdmin()
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    setFollowing(isFollowing);
  }, [isFollowing]);

  useEffect(() => {
    if (!currentUserId || !reel.userId || isOwner) return;
    relationshipService
      .checkFriendshipStatus(currentUserId, reel.userId)
      .then((status: 'none' | 'pending' | 'accepted') => {
        if (status === 'accepted' || status === 'pending') {
          setFriendshipStatus(status);
        } else {
          setFriendshipStatus('none');
        }
      })
      .catch(() => setFriendshipStatus('none'));
  }, [currentUserId, isOwner, reel.userId]);

  const runAction = async (action: string, operation: () => Promise<void>, successMessage: string) => {
    if (busyAction) return;
    setBusyAction(action);
    try {
      await operation();
      setFeedback({ title: 'Done', message: successMessage, type: 'success' });
    } catch (error: unknown) {
      setFeedback({
        title: 'Action failed',
        message: error instanceof Error ? error.message : 'Please try again',
        type: 'danger',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleFollowToggle = () => {
    if (!currentUserId) return;
    const nextFollowing = !following;
    onFollowToggle(reel.userId, following);
    setFollowing(nextFollowing);
  };

  const handleFriendRequest = () => {
    if (!currentUserId || friendshipStatus !== 'none') return;
    void runAction(
      'friend',
      async () => {
        await relationshipService.sendFriendRequest(currentUserId, reel.userId);
        setFriendshipStatus('pending');
      },
      'Friend request sent'
    );
  };

  const handleBlock = () => {
    setBlockConfirmationVisible(true);
  };

  const handleConfirmBlock = () => {
    setBlockConfirmationVisible(false);
    void runAction(
      'block',
      async () => {
        await relationshipService.blockUser(reel.userId);
        onBlock?.(reel.userId);
        onClose();
      },
      'User blocked'
    );
  };

  return (
    <>
      <Modal
        visible={visible && !adminDeleteVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={onClose}
      >
        <ModalBackdrop
          onPress={onClose}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <ModalMotionSurface variant="dialog" style={{ width: '85%', maxWidth: 320 }}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View
                style={{
                  backgroundColor: colors.elevated,
                  borderRadius: 20,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.15,
                  shadowRadius: 16,
                  elevation: 10,
                }}
              >
                {!isOwner ? (
                  <>
                    {/* 1. Add Friend */}
                    <TouchableOpacity
                      disabled={friendshipStatus !== 'none' || Boolean(busyAction)}
                      onPress={handleFriendRequest}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        opacity: friendshipStatus !== 'none' ? 0.5 : 1,
                      }}
                    >
                      <Icon name="user-plus" size={20} color={colors.icon} />
                      <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {friendshipStatus === 'accepted'
                          ? 'Friends'
                          : friendshipStatus === 'pending'
                          ? 'Request Pending'
                          : 'Add Friend'}
                      </Text>
                    </TouchableOpacity>

                    {/* 2. Follow / Unfollow */}
                    <TouchableOpacity
                      disabled={Boolean(busyAction)}
                      onPress={handleFollowToggle}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                      }}
                    >
                      <Icon name={following ? 'user-check' : 'user'} size={20} color={colors.icon} />
                      <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {following ? 'Unfollow Creator' : 'Follow Creator'}
                      </Text>
                    </TouchableOpacity>

                    {/* 3. Report Lime */}
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        onReport(reel.id, reel.userId, 'lime');
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                      }}
                    >
                      <Icon name="flag" size={20} color={colors.destructive} />
                      <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: colors.destructiveText }}>
                        Report Lime
                      </Text>
                    </TouchableOpacity>

                    {/* 4. Report User */}
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        onReport(reel.id, reel.userId, 'user');
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                      }}
                    >
                      <Icon name="user-x" size={20} color={colors.destructive} />
                      <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: colors.destructiveText }}>
                        Report Creator
                      </Text>
                    </TouchableOpacity>

                    {/* 5. Block User */}
                    <TouchableOpacity
                      disabled={Boolean(busyAction)}
                      onPress={handleBlock}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 14,
                        backgroundColor: '#dc2626',
                        marginTop: 4,
                        marginBottom: 8,
                      }}
                    >
                      <Icon name="slash" size={18} color="#ffffff" />
                      <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '800', color: '#ffffff' }}>
                        Block User
                      </Text>
                    </TouchableOpacity>

                    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
                  </>
                ) : null}

                {/* Owner Delete Lime */}
                {isOwner ? (
                  <TouchableOpacity
                    disabled={Boolean(busyAction)}
                    onPress={() => {
                      onClose();
                      onDeleteRequest(reel);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Icon name="trash-2" size={20} color={colors.destructive} />
                    <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color: colors.destructiveText }}>
                      Delete Lime
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Admin Delete Lime (Only visible to verified platform admins) */}
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
                      Admin Delete Lime
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Cancel Button */}
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    marginTop: 8,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: 12,
                    backgroundColor: colors.control,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.secondaryText }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </ModalMotionSurface>
        </ModalBackdrop>
      </Modal>

      {/* Admin Deletion Modal */}
      {adminDeleteVisible ? (
        <AdminDeletionModal
          visible={adminDeleteVisible}
          contentType="lime"
          contentId={reel.id}
          contentTitle={reel.caption || `Lime by @${reel.user.userName}`}
          authorName={reel.user.userName ? `@${reel.user.userName}` : 'Lime Creator'}
          onClose={() => {
            setAdminDeleteVisible(false);
            onClose();
          }}
          onDeleted={() => {
            setAdminDeleteVisible(false);
            onClose();
            onDeleteRequest(reel);
          }}
        />
      ) : null}

      {/* Block Confirmation */}
      <CustomModal
        visible={blockConfirmationVisible}
        type="danger"
        title="Block this user?"
        message="They won't be able to see your profile, posts, or Limes, and you won't see theirs."
        confirmText="Block User"
        cancelText="Cancel"
        onConfirm={handleConfirmBlock}
        onClose={() => setBlockConfirmationVisible(false)}
      />

      {/* Action Feedback Toast Modal */}
      {feedback ? (
        <CustomModal
          visible={Boolean(feedback)}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          confirmText="OK"
          onConfirm={() => setFeedback(null)}
          onClose={() => setFeedback(null)}
        />
      ) : null}
    </>
  );
}
