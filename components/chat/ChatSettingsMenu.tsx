import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { relationshipResourceService } from '@/lib/services/RelationshipResourceService';
import { relationshipRequestResourceService } from '@/lib/services/RelationshipRequestResourceService';
import { conversationResourceService } from '@/lib/services/ConversationResourceService';
import { messagingService } from '@/lib/messaging/MessagingService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';

const relationshipService = RelationshipService.getInstance();

type MuteDuration = '1 hour' | '8 hours' | '24 hours' | '1 week' | 'Always';

const MUTE_DURATIONS: MuteDuration[] = ['1 hour', '8 hours', '24 hours', '1 week', 'Always'];

const MUTE_MS: Record<MuteDuration, number> = {
  '1 hour': 60 * 60 * 1000,
  '8 hours': 8 * 60 * 60 * 1000,
  '24 hours': 24 * 60 * 60 * 1000,
  '1 week': 7 * 24 * 60 * 60 * 1000,
  'Always': Number.MAX_SAFE_INTEGER,
};

type ChatModalState = {
  visible: boolean;
  type: CustomModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
};

type ChatSettingsMenuProps = {
  visible: boolean;
  onClose: () => void;
  userName: string;
  friendId: string;
  currentUserId: string;
  onDeleteChat: () => void;
  onOpenChatMedia?: () => void;
  onUploadWallpaper?: (wallpaperUri: string) => void;
  onResetWallpaper?: () => void;
  hasCustomWallpaper?: boolean;
};

export function ChatSettingsMenu({
  visible,
  onClose,
  userName,
  friendId,
  currentUserId,
  onDeleteChat,
  onOpenChatMedia,
  onUploadWallpaper,
  onResetWallpaper,
  hasCustomWallpaper,
}: ChatSettingsMenuProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [showMuteOptions, setShowMuteOptions] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [isArchived, setIsArchived] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalState, setModalState] = useState<ChatModalState>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  // Load mute & block state from Firestore
  useEffect(() => {
    if (!visible || !currentUserId || !friendId) return;
    setIsLoading(true);
    setShowMuteOptions(false);

    const loadState = async () => {
      try {
        const [muteDoc, blockStatus, archiveStatus] = await Promise.all([
          messagingService.getMuteUntil(currentUserId, friendId),
          relationshipService.checkBlockStatus(currentUserId, friendId),
          messagingService.getArchiveStatus(currentUserId, friendId),
        ]);

        setIsBlockedByMe(blockStatus.isBlockedByMe);
        setMutedUntil(muteDoc);
        setIsArchived(archiveStatus);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    void loadState();
  }, [visible, currentUserId, friendId]);

  const handleMute = async (duration: MuteDuration) => {
    const until = duration === 'Always' ? Number.MAX_SAFE_INTEGER : Date.now() + MUTE_MS[duration];
    setMutedUntil(until);
    try {
      await messagingService.setMuteUntil(currentUserId, friendId, until);
      const mutedKey = `ourlime_muted_chats_${currentUserId}`;
      const val = await AsyncStorage.getItem(mutedKey);
      const list = val ? (JSON.parse(val) as string[]) : [];
      const set = new Set(list);
      set.add(friendId);
      await AsyncStorage.setItem(mutedKey, JSON.stringify(Array.from(set)));
      onClose();
      setModalState({
        visible: true,
        type: 'success',
        title: 'Notifications Muted',
        message: `Notifications for @${userName} have been muted for ${duration}.`,
        confirmText: 'OK',
      });
    } catch (e) {
      console.error('[ChatSettingsMenu.handleMute]', e);
      onClose();
      setModalState({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to mute notifications.',
        confirmText: 'OK',
      });
    }
  };

  const handleUnmute = async () => {
    setMutedUntil(null);
    try {
      await messagingService.setMuteUntil(currentUserId, friendId, null);
      const mutedKey = `ourlime_muted_chats_${currentUserId}`;
      const val = await AsyncStorage.getItem(mutedKey);
      const list = val ? (JSON.parse(val) as string[]) : [];
      const set = new Set(list);
      set.delete(friendId);
      await AsyncStorage.setItem(mutedKey, JSON.stringify(Array.from(set)));
      onClose();
      setModalState({
        visible: true,
        type: 'success',
        title: 'Notifications Unmuted',
        message: `You will now receive notifications for messages from @${userName}.`,
        confirmText: 'OK',
      });
    } catch (e) {
      console.error('[ChatSettingsMenu.handleUnmute]', e);
      onClose();
      setModalState({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to unmute notifications.',
        confirmText: 'OK',
      });
    }
  };

  const handleToggleArchive = async () => {
    const nextArchived = !isArchived;
    setIsArchived(nextArchived);
    try {
      await messagingService.setArchiveStatus(friendId, nextArchived);
      const archivedKey = `ourlime_archived_chats_${currentUserId}`;
      const val = await AsyncStorage.getItem(archivedKey);
      const list = val ? (JSON.parse(val) as string[]) : [];
      const set = new Set(list);
      if (nextArchived) {
        set.add(friendId);
      } else {
        set.delete(friendId);
      }
      await AsyncStorage.setItem(archivedKey, JSON.stringify(Array.from(set)));
      onClose();
      setModalState({
        visible: true,
        type: 'success',
        title: nextArchived ? 'Chat Archived' : 'Chat Unarchived',
        message: nextArchived
          ? 'This conversation has been moved to Archived.'
          : 'This conversation has been unarchived.',
        confirmText: 'OK',
      });
    } catch (e) {
      console.error('[ChatSettingsMenu.handleToggleArchive]', e);
      setIsArchived(!nextArchived);
      onClose();
      setModalState({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to update archive status.',
        confirmText: 'OK',
      });
    }
  };

  const handleToggleBlock = () => {
    onClose();
    if (isBlockedByMe) {
      setModalState({
        visible: true,
        type: 'info',
        title: 'Unblock User',
        message: `Are you sure you want to unblock @${userName}?`,
        confirmText: 'Unblock',
        cancelText: 'Cancel',
        onConfirm: async () => {
          try {
            await relationshipService.unblockUserFirestore(currentUserId, friendId);
            setModalState({
              visible: true,
              type: 'success',
              title: 'User Unblocked',
              message: `@${userName} has been unblocked.`,
              confirmText: 'OK',
            });
          } catch {
            setModalState({
              visible: true,
              type: 'error',
              title: 'Error',
              message: 'Failed to unblock user.',
              confirmText: 'OK',
            });
          }
        },
      });
    } else {
      setModalState({
        visible: true,
        type: 'danger',
        title: 'Block User',
        message: `Are you sure you want to block @${userName}? They will no longer be able to message or call you.`,
        confirmText: 'Block',
        cancelText: 'Cancel',
        onConfirm: async () => {
          try {
            await relationshipService.blockUserFirestore(currentUserId, friendId);
            relationshipResourceService.removeUserFromCachedRelationships(currentUserId, friendId);
            relationshipRequestResourceService.removeUserFromCachedRequests(friendId);
            void conversationResourceService.removeConversation(currentUserId, friendId);
            setModalState({
              visible: true,
              type: 'success',
              title: 'User Blocked',
              message: `@${userName} has been blocked.`,
              confirmText: 'OK',
            });
          } catch {
            setModalState({
              visible: true,
              type: 'error',
              title: 'Error',
              message: 'Failed to block user.',
              confirmText: 'OK',
            });
          }
        },
      });
    }
  };

  const handleRemoveFriend = () => {
    onClose();
    setModalState({
      visible: true,
      type: 'danger',
      title: 'Remove Friend',
      message: `Are you sure you want to remove @${userName} from your friends list?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await relationshipService.removeFriendFirestore(currentUserId, friendId);
          relationshipResourceService.removeUserFromCachedRelationships(currentUserId, friendId);
          relationshipRequestResourceService.removeUserFromCachedRequests(friendId);
          void conversationResourceService.removeConversation(currentUserId, friendId);
          setModalState({
            visible: true,
            type: 'success',
            title: 'Friend Removed',
            message: `@${userName} was removed from your friends list.`,
            confirmText: 'OK',
          });
        } catch {
          setModalState({
            visible: true,
            type: 'error',
            title: 'Error',
            message: 'Failed to remove friend.',
            confirmText: 'OK',
          });
        }
      },
    });
  };

  const handlePickWallpaper = async () => {
    onClose();
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      onUploadWallpaper?.(result.assets[0].uri);
    }
  };

  const handleDeleteChat = () => {
    onClose();
    setModalState({
      visible: true,
      type: 'danger',
      title: 'Delete Chat',
      message: 'This will clear all messages in this conversation. Are you sure?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        setModalState((prev) => ({ ...prev, visible: false }));
        void conversationResourceService.removeConversation(currentUserId, friendId);
        onDeleteChat();
      },
    });
  };

  const isMuted = mutedUntil !== null && mutedUntil > Date.now();

  return (
    <>
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}>
        <ModalBackdrop style={{ flex: 1, backgroundColor: colors.modalScrim }} onPress={onClose} />

        {/* Dropdown panel */}
        <ModalMotionSurface
          variant="dialog"
          style={{
            position: 'absolute',
            top: 90,
            right: 12,
            width: 240,
            backgroundColor: colors.elevated,
            borderRadius: 16,
            paddingVertical: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.14,
            shadowRadius: 20,
            elevation: 14,
            borderWidth: 1,
            borderColor: colors.border,
            zIndex: 999,
          }}
        >
          {showMuteOptions ? (
            <>
              <TouchableOpacity onPress={() => setShowMuteOptions(false)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
                <Icon name="chevron-left" size={16} color={colors.icon} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: 8 }}>
                  Mute Notifications
                </Text>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} />
              {MUTE_DURATIONS.map((duration) => (
                <TouchableOpacity key={duration} onPress={() => void handleMute(duration)} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.text }}>{duration}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <>
              {/* View Profile */}
              <MenuItem
                icon="user"
                label="View Profile"
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/profile/[username]', params: { username: userName } });
                }}
              />

              {/* Chat media */}
              {onOpenChatMedia && (
                <MenuItem
                  icon="image"
                  label="Chat media"
                  onPress={() => {
                    onClose();
                    onOpenChatMedia();
                  }}
                />
              )}

              {/* Change Wallpaper */}
              <MenuItem
                icon="layout"
                label="Change Wallpaper"
                onPress={() => void handlePickWallpaper()}
              />

              {/* Reset Wallpaper */}
              {hasCustomWallpaper && onResetWallpaper && (
                <MenuItem
                  icon="rotate-ccw"
                  label="Reset Wallpaper"
                  onPress={() => {
                    onClose();
                    onResetWallpaper();
                  }}
                />
              )}

              {/* Archive / Unarchive Chat */}
              <MenuItem
                icon={isArchived ? 'inbox' : 'archive'}
                label={isArchived ? 'Unarchive Chat' : 'Archive Chat'}
                onPress={() => void handleToggleArchive()}
              />

              {/* Mute / Unmute */}
              {isLoading ? (
                <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              ) : isMuted ? (
                <MenuItem
                  icon="bell"
                  label="Unmute Notifications"
                  onPress={() => void handleUnmute()}
                />
              ) : (
                <MenuItem
                  icon="bell-off"
                  label="Mute Notifications"
                  onPress={() => setShowMuteOptions(true)}
                  chevron
                />
              )}

              {/* Block / Unblock User */}
              <MenuItem
                icon="user-x"
                label={isBlockedByMe ? 'Unblock User' : 'Block User'}
                danger={!isBlockedByMe}
                onPress={handleToggleBlock}
              />

              {/* Remove Friend */}
              <MenuItem
                icon="user-minus"
                label="Remove Friend"
                danger
                onPress={handleRemoveFriend}
              />

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12, marginVertical: 4 }} />

              {/* Delete Chat */}
              <MenuItem
                icon="trash-2"
                label="Delete Chat"
                onPress={handleDeleteChat}
                danger
              />
            </>
          )}
        </ModalMotionSurface>
      </Modal>

      <CustomModal
        visible={modalState.visible}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={modalState.onConfirm}
        onClose={() => setModalState((prev) => ({ ...prev, visible: false }))}
      />
    </>
  );
}

type MenuItemProps = {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  chevron?: boolean;
};

function MenuItem({ icon, label, onPress, danger, chevron }: MenuItemProps) {
  const { colors } = useAppTheme();
  const color = danger ? colors.destructiveText : colors.text;
  const iconColor = danger ? colors.destructive : colors.icon;

  return (
    <AnimatedActionButton
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
      accessibilityLabel={label}
      feedback={danger ? 'warning' : 'selection'}
      pressScale={0.97}
      playful={false}
    >
      <Icon name={icon} size={16} color={iconColor} />
      <Text style={{ flex: 1, fontSize: 14, color, marginLeft: 12, fontWeight: '500' }}>
        {label}
      </Text>
      {chevron && (
        <Icon name="chevron-right" size={14} color={colors.mutedText} />
      )}
    </AnimatedActionButton>
  );
}
