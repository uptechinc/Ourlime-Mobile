import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { MAX_DRAFTS_PER_KIND, draftDaysLeft, type CreationDraft, type CreationDraftKind } from '@/lib/services/CreationDraftService';

type DraftsSheetProps = {
  visible: boolean;
  kind: CreationDraftKind;
  drafts: CreationDraft[];
  loading: boolean;
  /** Shown at the top, e.g. after hitting the 5-draft limit while saving. */
  notice?: string | null;
  openingDraftId?: string | null;
  onOpenDraft: (draft: CreationDraft) => void;
  onDeleteDraft: (draft: CreationDraft) => Promise<void>;
  onClose: () => void;
};

/** The user's post or Lime drafts (up to 5): open one to edit and post it, or delete it. Same as the website. */
export default function DraftsSheet({ visible, kind, drafts, loading, notice, openingDraftId, onOpenDraft, onDeleteDraft, onClose }: DraftsSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [pendingDelete, setPendingDelete] = useState<CreationDraft | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteDraft(pendingDelete);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close drafts">
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) + 8 }]} onPress={() => undefined}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{kind === 'lime' ? 'Lime drafts' : 'Post drafts'} ({drafts.length}/{MAX_DRAFTS_PER_KIND})</Text>
              <Text style={[styles.subtitle, { color: colors.mutedText }]}>Drafts are deleted 7 days after they&apos;re created.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.control }]} accessibilityLabel="Close drafts">
              <Icon name="x" size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
            {loading ? (
              <View style={styles.empty}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.mutedText }}>Loading drafts…</Text></View>
            ) : drafts.length === 0 ? (
              <View style={styles.empty}><Text style={{ color: colors.mutedText, textAlign: 'center' }}>No drafts yet. Use “Save draft” to keep something for later.</Text></View>
            ) : drafts.map((draft) => {
              const firstMedia = draft.media[0];
              const thumbnail = firstMedia?.coverUrl ?? (firstMedia?.type === 'image' ? firstMedia.typeUrl : undefined);
              const daysLeft = draftDaysLeft(draft.expiresAtMs);
              const isLastDay = daysLeft <= 1;
              return (
                <View key={draft.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.control }]}>
                  <View style={[styles.thumb, { backgroundColor: colors.elevated }]}>
                    {thumbnail ? <Image source={{ uri: thumbnail }} style={styles.thumbImage} /> : <Icon name={firstMedia?.type === 'video' ? 'video' : 'file-text'} size={22} color={colors.mutedText} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>{draft.title}</Text>
                    <Text style={{ color: colors.mutedText, fontSize: 12 }}>{draft.media.length} {draft.media.length === 1 ? 'item' : 'items'}</Text>
                    <Text style={{ color: isLastDay ? '#ef4444' : colors.mutedText, fontSize: 12, fontWeight: '700' }}>{isLastDay ? 'Expires today' : `Expires in ${daysLeft} days`}</Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity onPress={() => onOpenDraft(draft)} disabled={Boolean(openingDraftId)} style={[styles.openButton, { backgroundColor: colors.accent, opacity: openingDraftId ? 0.6 : 1 }]} accessibilityRole="button">
                      {openingDraftId === draft.id ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 12 }}>Open</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setPendingDelete(draft)} style={[styles.deleteButton, { backgroundColor: colors.destructiveSurface }]} accessibilityRole="button">
                      <Text style={{ color: colors.destructiveText, fontWeight: '800', fontSize: 12 }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
      <CustomModal
        visible={Boolean(pendingDelete)}
        type="danger"
        title="Delete this draft?"
        message={pendingDelete ? `“${pendingDelete.title}” will be deleted for good.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
        onClose={() => setPendingDelete(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.65)' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  notice: { marginHorizontal: 16, marginTop: 12, padding: 10, borderRadius: 12, color: '#b45309', backgroundColor: 'rgba(245,158,11,0.15)', fontWeight: '600' },
  empty: { paddingVertical: 36, alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: '100%', height: '100%' },
  rowTitle: { fontWeight: '700', fontSize: 14 },
  openButton: { minWidth: 64, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  deleteButton: { minWidth: 64, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
});
