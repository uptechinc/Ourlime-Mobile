import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import type { UserProfile } from '@/lib/services/AuthService';
import { messagingService, type FullMessage } from '@/lib/messaging/MessagingService';
import UserAvatar from '@/components/ui/UserAvatar';

type ForwardMessageModalProps = {
  visible: boolean;
  onClose: () => void;
  messageToForward: FullMessage | null;
  currentUserId: string;
  onForwardSuccess: (friendName: string) => void;
};

export function ForwardMessageModal({
  visible,
  onClose,
  messageToForward,
  currentUserId,
  onForwardSuccess,
}: ForwardMessageModalProps) {
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sendingToId, setSendingToId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !currentUserId) return;
    setIsLoading(true);

    const loadFriends = async () => {
      try {
        setFriends(await messagingService.fetchConversations(currentUserId));
      } catch (e) {
        console.error('[ForwardMessageModal] Error loading friends:', e);
      } finally {
        setIsLoading(false);
      }
    };
    void loadFriends();
  }, [visible, currentUserId]);

  const handleForwardTo = async (friend: UserProfile) => {
    if (!messageToForward || !currentUserId) return;
    setSendingToId(friend.uid);

    try {
      await messagingService.sendMessage(
        friend.uid,
        messageToForward.message ?? '',
        currentUserId,
        undefined,
        messageToForward.attachment,
        messageToForward.stickerData,
        messageToForward.voiceNoteData,
        true // isForwarded = true
      );
      onForwardSuccess(`${friend.firstName} ${friend.lastName}`);
      onClose();
    } catch (e) {
      console.error('[ForwardMessageModal] Error forwarding message:', e);
    } finally {
      setSendingToId(null);
    }
  };

  const filteredFriends = friends.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return `${f.firstName} ${f.lastName} ${f.userName}`.toLowerCase().includes(q);
  });

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />

      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '75%',
        paddingTop: 12,
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', flex: 1 }}>Forward Message</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Icon name="x" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Icon name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: '#0f172a' }}
              placeholder="Search friends..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Friends list */}
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : filteredFriends.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>No friends found</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
            {filteredFriends.map((friend) => {
              const isSending = sendingToId === friend.uid;
              return (
                <TouchableOpacity
                  key={friend.uid}
                  onPress={() => void handleForwardTo(friend)}
                  disabled={isSending}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f1f5f9',
                  }}
                >
                  <UserAvatar profileImage={friend.profilePicture} firstName={friend.firstName ?? 'U'} size={44} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b' }}>
                      {friend.firstName} {friend.lastName}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>@{friend.userName}</Text>
                  </View>

                  <View style={{ backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 }}>
                    {isSending ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>Send</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
