import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, Search, Send, Share2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '@/components/ui/UserAvatar';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { contentShareService } from '@/lib/services/ContentShareService';
import type { ConversationEntry } from '@/lib/messaging/MessagingService';

type ShareContentSheetProps = {
  visible: boolean;
  currentUserId: string;
  contentLabel: string;
  title: string;
  message: string;
  url: string;
  onClose: () => void;
  onShared?: (destination: 'chat' | 'external') => void;
};

export default function ShareContentSheet({
  visible,
  currentUserId,
  contentLabel,
  title,
  message,
  url,
  onClose,
  onShared,
}: ShareContentSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [recipients, setRecipients] = useState<ConversationEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sharingExternally, setSharingExternally] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSelectedIds(new Set());
    setSearch('');
    setFeedback(null);
    setLoading(true);
    void contentShareService.loadRecipients(currentUserId)
      .then(setRecipients)
      .catch(() => setFeedback('Could not load your chats. Try again.'))
      .finally(() => setLoading(false));
  }, [currentUserId, visible]);

  const filteredRecipients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return recipients;
    return recipients.filter((recipient) =>
      `${recipient.firstName} ${recipient.lastName} ${recipient.userName}`.toLowerCase().includes(normalizedSearch),
    );
  }, [recipients, search]);

  const handleToggleRecipient = (recipientId: string): void => {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(recipientId)) nextIds.delete(recipientId);
      else nextIds.add(recipientId);
      return nextIds;
    });
    setFeedback(null);
  };

  const handleSendToChats = async (): Promise<void> => {
    if (selectedIds.size === 0 || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      const result = await contentShareService.sendToChats(currentUserId, Array.from(selectedIds), url);
      if (result.sentCount === 0) {
        setFeedback('The share could not be sent. Try again.');
        return;
      }
      onShared?.('chat');
      onClose();
    } catch (error: unknown) {
      setFeedback(error instanceof Error ? error.message : 'The share could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const handleExternalShare = async (): Promise<void> => {
    if (sharingExternally) return;
    setSharingExternally(true);
    setFeedback(null);
    try {
      const didShare = await contentShareService.shareExternally({ title, message, url });
      if (didShare) {
        onShared?.('external');
        onClose();
      }
    } catch {
      setFeedback('Could not open your phone’s share menu.');
    } finally {
      setSharingExternally(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.modalScrim }]} onPress={onClose} />
      <SwipeDismissSurface
        visible={visible}
        onDismiss={onClose}
        handleColor={colors.mutedText}
        accessibilityLabel={`Swipe down to close ${contentLabel} sharing`}
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Share {contentLabel}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedText }]}>Send it in Ourlime or share through another app.</Text>
          </View>
          <TouchableOpacity accessibilityLabel="Close sharing" onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.control }]}>
            <X size={19} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => void handleExternalShare()}
          disabled={sharingExternally}
          style={[styles.externalButton, { backgroundColor: colors.successSurface, borderColor: colors.accent }]}
        >
          {sharingExternally ? <ActivityIndicator color={colors.accent} /> : <Share2 size={20} color={colors.accentText} />}
          <View style={styles.externalCopy}>
            <Text style={[styles.externalTitle, { color: colors.text }]}>Share outside Ourlime</Text>
            <Text style={[styles.externalDescription, { color: colors.mutedText }]}>Messages, social apps, email, and more</Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>Send to a chat</Text>
        <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Search size={18} color={colors.mutedText} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search people"
            placeholderTextColor={colors.mutedText}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        {feedback ? <Text style={[styles.feedback, { color: colors.destructiveText }]}>{feedback}</Text> : null}

        {loading ? (
          <View style={styles.centerState}><ActivityIndicator size="large" color={colors.accent} /></View>
        ) : filteredRecipients.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No chats found</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedText }]}>Start a conversation first, then it will appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredRecipients}
            keyExtractor={(recipient) => recipient.uid}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: recipient }) => {
              const selected = selectedIds.has(recipient.uid);
              return (
                <TouchableOpacity
                  onPress={() => handleToggleRecipient(recipient.uid)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={[styles.recipientRow, { borderBottomColor: colors.border }]}
                >
                  <UserAvatar profileImage={recipient.profilePicture} firstName={recipient.firstName || 'U'} size={44} />
                  <View style={styles.recipientCopy}>
                    <Text style={[styles.recipientName, { color: colors.text }]} numberOfLines={1}>{recipient.firstName} {recipient.lastName}</Text>
                    <Text style={[styles.recipientHandle, { color: colors.mutedText }]} numberOfLines={1}>@{recipient.userName}</Text>
                  </View>
                  <View style={[styles.checkbox, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.control }]}>
                    {selected ? <Check size={16} color={colors.onAccent} /> : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <TouchableOpacity
          onPress={() => void handleSendToChats()}
          disabled={selectedIds.size === 0 || sending}
          style={[
            styles.sendButton,
            { backgroundColor: selectedIds.size === 0 || sending ? colors.disabled : colors.accent },
          ]}
        >
          {sending ? <ActivityIndicator color={colors.onAccent} /> : <Send size={19} color={selectedIds.size === 0 ? colors.disabledText : colors.onAccent} />}
          <Text style={[styles.sendButtonText, { color: selectedIds.size === 0 ? colors.disabledText : colors.onAccent }]}>
            {selectedIds.size > 0 ? `Send to ${selectedIds.size}` : 'Choose people'}
          </Text>
        </TouchableOpacity>
      </SwipeDismissSurface>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 18, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 14 },
  headerCopy: { flex: 1, paddingRight: 12 },
  title: { fontSize: 21, fontWeight: '900' },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  externalButton: { minHeight: 68, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  externalCopy: { flex: 1, marginLeft: 12 },
  externalTitle: { fontSize: 15, fontWeight: '800' },
  externalDescription: { fontSize: 11, marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '800', marginTop: 18, marginBottom: 8 },
  searchBox: { height: 46, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 9, paddingVertical: 0 },
  feedback: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  centerState: { minHeight: 150, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptyCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  list: { flexGrow: 0, maxHeight: 310, marginTop: 6 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth },
  recipientCopy: { flex: 1, marginLeft: 12 },
  recipientName: { fontSize: 14, fontWeight: '800' },
  recipientHandle: { fontSize: 12, marginTop: 2 },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sendButton: { height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 },
  sendButtonText: { fontSize: 15, fontWeight: '900' },
});
