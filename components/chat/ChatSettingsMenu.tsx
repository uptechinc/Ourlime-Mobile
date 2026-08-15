import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { messagingService } from '@/lib/messaging/MessagingService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

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
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load mute & block state from Firestore
  useEffect(() => {
    if (!visible || !currentUserId || !friendId) return;
    setIsLoading(true);
    setShowMuteOptions(false);

    const loadState = async () => {
      try {
        const [muteDoc, blockStatus] = await Promise.all([
          messagingService.getMuteUntil(currentUserId, friendId),
          relationshipService.checkBlockStatus(currentUserId, friendId),
        ]);

        setIsBlockedByMe(blockStatus.isBlockedByMe);

        setMutedUntil(muteDoc);
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
    } catch (e) {
      console.error('[ChatSettingsMenu.handleMute]', e);
    }
    onClose();
  };

  const handleUnmute = async () => {
    setMutedUntil(null);
    try {
      await messagingService.setMuteUntil(currentUserId, friendId, null);
    } catch (e) {
      console.error('[ChatSettingsMenu.handleUnmute]', e);
    }
    onClose();
  };

  const handleToggleBlock = () => {
    onClose();
    if (isBlockedByMe) {
      Alert.alert('Unblock User', `Are you sure you want to unblock @${userName}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            await relationshipService.unblockUserFirestore(currentUserId, friendId);
            Alert.alert('User Unblocked', `@${userName} has been unblocked.`);
          },
        },
      ]);
    } else {
      Alert.alert('Block User', `Are you sure you want to block @${userName}? They will no longer be able to message or call you.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await relationshipService.blockUserFirestore(currentUserId, friendId);
            Alert.alert('User Blocked', `@${userName} has been blocked.`);
          },
        },
      ]);
    }
  };

  const handleRemoveFriend = () => {
    onClose();
    Alert.alert('Remove Friend', `Are you sure you want to remove @${userName} from your friends list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await relationshipService.removeFriendFirestore(currentUserId, friendId);
          Alert.alert('Friend Removed', `@${userName} was removed from your friends list.`);
        },
      },
    ]);
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
    Alert.alert('Delete Chat', 'This will clear all messages in this conversation. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDeleteChat },
    ]);
  };

  const isMuted = mutedUntil !== null && mutedUntil > Date.now();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.modalScrim }} onPress={onClose} />

      {/* Dropdown panel */}
      <View
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
      </View>
    </Modal>
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
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
      activeOpacity={0.65}
    >
      <Icon name={icon} size={16} color={iconColor} />
      <Text style={{ flex: 1, fontSize: 14, color, marginLeft: 12, fontWeight: '500' }}>
        {label}
      </Text>
      {chevron && (
        <Icon name="chevron-right" size={14} color={colors.mutedText} />
      )}
    </TouchableOpacity>
  );
}
