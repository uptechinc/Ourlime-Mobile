import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import type { Reel } from '@/types/userTypes';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { adminAccessService } from '@/lib/services/AdminAccessService';
import AdminDeletionModal from '@/components/moderation/AdminDeletionModal';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import UserAvatar from '@/components/ui/UserAvatar';

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
  onDeleted?: (reelId: string) => void;
  onFollowToggle: (userId: string, currentlyFollowing: boolean) => void;
  onReport: (reelId: string, reportedUserId: string, reportType: 'lime' | 'user') => void;
  onBlock?: (userId: string) => void;
  onEditRequest?: () => void;
};

const relationshipService = RelationshipService.getInstance();

export default function LimeOptionsSheet({
  visible,
  reel,
  currentUserId,
  isFollowing,
  onClose,
  onDeleteRequest,
  onDeleted,
  onFollowToggle,
  onReport,
  onBlock,
  onEditRequest,
}: LimeOptionsSheetProps) {
  const insets = useSafeAreaInsets();
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
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={onClose}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: colors.modalScrim }]} onPress={onClose} />
        <SwipeDismissSurface
          visible={visible && !adminDeleteVisible}
          onDismiss={onClose}
          handleColor={colors.mutedText}
          accessibilityLabel="Swipe down to close Lime options"
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.creatorInfo}>
              <UserAvatar
                profileImage={reel.user?.profileImage}
                firstName={reel.user?.firstName || 'Lime'}
                size={40}
              />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={[styles.creatorName, { color: colors.text }]} numberOfLines={1}>
                  {reel.user?.firstName} {reel.user?.lastName}
                </Text>
                <Text style={[styles.creatorUsername, { color: colors.mutedText }]} numberOfLines={1}>
                  @{reel.user?.userName || 'user'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close Lime options"
              style={[styles.closeButton, { backgroundColor: colors.control }]}
            >
              <Icon name="x" size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Options List */}
          <View style={styles.optionsList}>
            {!isOwner ? (
              <>
                {/* 1. Add Friend */}
                <TouchableOpacity
                  disabled={friendshipStatus !== 'none' || Boolean(busyAction)}
                  onPress={handleFriendRequest}
                  style={[styles.optionItem, { backgroundColor: colors.control }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: colors.elevated }]}>
                    <Icon
                      name={friendshipStatus === 'accepted' ? 'check' : friendshipStatus === 'pending' ? 'clock' : 'user-plus'}
                      size={18}
                      color={colors.accentText}
                    />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>
                      {friendshipStatus === 'accepted'
                        ? 'Friends'
                        : friendshipStatus === 'pending'
                        ? 'Friend Request Pending'
                        : 'Add Friend'}
                    </Text>
                    <Text style={[styles.optionSubtitle, { color: colors.mutedText }]}>
                      {friendshipStatus === 'accepted'
                        ? 'You are connected with this creator'
                        : friendshipStatus === 'pending'
                        ? 'Waiting for creator to accept request'
                        : 'Connect and see each other’s updates'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Follow / Unfollow */}
                <TouchableOpacity
                  disabled={Boolean(busyAction)}
                  onPress={handleFollowToggle}
                  style={[styles.optionItem, { backgroundColor: colors.control }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: colors.elevated }]}>
                    <Icon name={following ? 'user-minus' : 'user-check'} size={18} color={colors.accentText} />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>
                      {following ? 'Unfollow Creator' : 'Follow Creator'}
                    </Text>
                    <Text style={[styles.optionSubtitle, { color: colors.mutedText }]}>
                      {following ? 'Stop seeing Limes from this creator in Following' : 'Follow to see latest Limes in Following feed'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 3. Report Lime */}
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onReport(reel.id, reel.userId, 'lime');
                  }}
                  style={[styles.optionItem, { backgroundColor: colors.control }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                    <Icon name="flag" size={18} color="#ef4444" />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: '#ef4444' }]}>Report Lime</Text>
                    <Text style={[styles.optionSubtitle, { color: colors.mutedText }]}>
                      Report inappropriate content, violence, or spam
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 4. Report User */}
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onReport(reel.id, reel.userId, 'user');
                  }}
                  style={[styles.optionItem, { backgroundColor: colors.control }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                    <Icon name="user-x" size={18} color="#ef4444" />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: '#ef4444' }]}>Report Creator</Text>
                    <Text style={[styles.optionSubtitle, { color: colors.mutedText }]}>
                      Report this account for abusive or harmful behavior
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 5. Block User */}
                <TouchableOpacity
                  disabled={Boolean(busyAction)}
                  onPress={handleBlock}
                  style={[styles.optionItem, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: '#ef4444' }]}>
                    <Icon name="slash" size={18} color="#ffffff" />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: '#ef4444' }]}>Block User</Text>
                    <Text style={[styles.optionSubtitle, { color: colors.mutedText }]}>
                      Prevent interactions, messages, and visibility
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : null}

            {/* Owner Delete Lime */}
            {isOwner ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onEditRequest?.();
                  }}
                  style={[styles.optionItem, { backgroundColor: colors.control }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: colors.elevated }]}>
                    <Icon name="edit-2" size={18} color={colors.accentText} />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>Edit Lime</Text>
                    <Text style={[styles.optionSubtitle, { color: colors.mutedText }]}>Change caption, category, or visibility</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={Boolean(busyAction)}
                  onPress={() => {
                    onClose();
                    onDeleteRequest(reel);
                  }}
                  style={[styles.optionItem, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: '#ef4444' }]}>
                    <Icon name="trash-2" size={18} color="#ffffff" />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: '#ef4444' }]}>Delete Lime</Text>
                    <Text style={[styles.optionSubtitle, { color: colors.mutedText }]}>
                      Permanently delete this Lime and all comments
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : null}

            {/* Admin Delete Lime (Only visible to verified platform admins) */}
            {isAdmin ? (
              <TouchableOpacity
                onPress={() => setAdminDeleteVisible(true)}
                style={[
                  styles.optionItem,
                  { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: '#ef4444', borderWidth: 1 },
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: '#ef4444' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, { color: '#ef4444', fontWeight: '800' }]}>
                    Admin Delete Lime
                  </Text>
                  <Text style={[styles.optionSubtitle, { color: colors.mutedText }]}>
                    Platform admin moderation deletion with mandatory reason & audit log
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </SwipeDismissSurface>
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
            if (onDeleted) {
              onDeleted(reel.id);
            }
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

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '800',
  },
  creatorUsername: {
    fontSize: 12,
    marginTop: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    marginTop: 12,
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});
