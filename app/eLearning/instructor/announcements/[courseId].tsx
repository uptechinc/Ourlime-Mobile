import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Megaphone, Pencil, Trash2 } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { Skeleton } from '@/components/ui/Skeleton';
import { ELearningButton, ELearningEmptyState, ELearningHeader, ELEARNING_GUTTER, StatusPill, formatWhen } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService, type AnnouncementDraft, type InstructorAnnouncement } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 860;
const TITLE_MAX = 200;
const BODY_MAX = 5000;
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const EMPTY_DRAFT: AnnouncementDraft = { title: '', body: '', important: false };

type DeleteStage = 'idle' | 'deleting' | 'done';
const newOperationId = (): string => `announcement_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * The instructor's course announcements: post news for enrolled learners, edit or delete what was posted. Learners see
 * them on their E-Learning home; nothing is sent by push or email. The server checks that this is the course's
 * instructor (or an administrator); the list is read under the rules.
 */
export default function InstructorAnnouncementsScreen() {
  const router = useRouter();
  const { courseId, title: titleParam } = useLocalSearchParams<{ courseId: string; title?: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<InstructorAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnnouncementDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [deleting, setDeleting] = useState<InstructorAnnouncement | null>(null);
  const [deleteStage, setDeleteStage] = useState<DeleteStage>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // One id per announcement being posted: a retry after a dropped connection returns it instead of posting it twice.
  const operationIdRef = useRef(newOperationId());

  const load = useCallback(async () => {
    if (!id) { setIsLoading(false); setLoadError('This course could not be found.'); return; }
    setLoadError(null);
    try {
      setItems(await instructorService.getAnnouncements(id));
    } catch (error: unknown) {
      console.error('[InstructorAnnouncementsScreen.load] Error:', error instanceof Error ? error.message : 'Unknown error');
      setLoadError('Announcements could not load. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const titleMissing = hasTriedSubmit && !draft.title.trim();
  const bodyMissing = hasTriedSubmit && !draft.body.trim();

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setHasTriedSubmit(false);
    setFormError(null);
  };

  const handleSave = async () => {
    setHasTriedSubmit(true);
    if (!draft.title.trim() || !draft.body.trim() || isSaving) return;
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        const saved = await instructorService.updateAnnouncement(editingId, draft);
        setItems((current) => current.map((item) => (item.id === saved.id ? { ...saved, createdAt: item.createdAt } : item)));
      } else {
        const posted = await instructorService.createAnnouncement(id, draft, operationIdRef.current);
        setItems((current) => [posted, ...current.filter((item) => item.id !== posted.id)]);
        operationIdRef.current = newOperationId();
      }
      resetForm();
    } catch (error: unknown) {
      console.error('[InstructorAnnouncementsScreen.handleSave] Error:', error instanceof Error ? error.message : 'Unknown error');
      setFormError(editingId ? 'The changes were not saved. Your text is still here so you can try again.' : 'The announcement was not posted. Your text is still here so you can try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (announcement: InstructorAnnouncement) => {
    setEditingId(announcement.id);
    setDraft({ title: announcement.title, body: announcement.body, important: announcement.important });
    setHasTriedSubmit(false);
    setFormError(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteStage('deleting');
    setDeleteError(null);
    try {
      await instructorService.deleteAnnouncement(deleting.id);
      setItems((current) => current.filter((item) => item.id !== deleting.id));
      if (editingId === deleting.id) resetForm();
      setDeleteStage('done');
    } catch (error: unknown) {
      console.error('[InstructorAnnouncementsScreen.handleDelete] Error:', error instanceof Error ? error.message : 'Unknown error');
      setDeleteError('The announcement could not be deleted. Check your connection and try again.');
      setDeleteStage('idle');
    }
  };

  const closeDelete = () => {
    if (deleteStage === 'deleting') return;
    setDeleting(null);
    setDeleteStage('idle');
    setDeleteError(null);
  };

  const columnWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const headerSubtitle = typeof titleParam === 'string' && titleParam ? titleParam : 'Your course';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title="Announcements" subtitle={headerSubtitle} onBack={() => router.back()} />
      <KeyboardSafeView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}
        >
          <View style={[styles.column, { width: columnWidth }]}>
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.section}>{editingId ? 'Edit announcement' : 'New announcement'}</Text>
              <Text style={styles.muted}>Enrolled learners see it on their E-Learning home. No notification or email is sent.</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  value={draft.title}
                  onChangeText={(value) => setDraft((current) => ({ ...current, title: value }))}
                  maxLength={TITLE_MAX}
                  editable={!isSaving}
                  placeholder="Week 2 starts Monday"
                  placeholderTextColor={colors.mutedText}
                  accessibilityLabel="Announcement title"
                  style={[styles.input, titleMissing ? styles.inputError : null]}
                />
                {titleMissing ? <Text accessibilityRole="alert" style={styles.errorText}>Add a title.</Text> : null}
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Message</Text>
                <TextInput
                  value={draft.body}
                  onChangeText={(value) => setDraft((current) => ({ ...current, body: value }))}
                  maxLength={BODY_MAX}
                  editable={!isSaving}
                  multiline
                  textAlignVertical="top"
                  placeholder="What should your learners know?"
                  placeholderTextColor={colors.mutedText}
                  accessibilityLabel="Announcement message"
                  style={[styles.input, styles.multiline, bodyMissing ? styles.inputError : null]}
                />
                <Text style={styles.counter}>{draft.body.length}/{BODY_MAX}</Text>
                {bodyMissing ? <Text accessibilityRole="alert" style={styles.errorText}>Write the announcement.</Text> : null}
              </View>
              <View style={styles.switchRow}>
                <View style={styles.flexText}>
                  <Text style={styles.switchLabel}>Mark as important</Text>
                  <Text style={styles.muted}>Shows an Important label so learners notice it.</Text>
                </View>
                <Switch
                  value={draft.important}
                  onValueChange={(value) => setDraft((current) => ({ ...current, important: value }))}
                  disabled={isSaving}
                  accessibilityLabel="Mark as important"
                  trackColor={{ false: colors.control, true: colors.accent }}
                />
              </View>
              {formError ? <Text accessibilityRole="alert" style={styles.formError}>{formError}</Text> : null}
              <View style={styles.actions}>
                {editingId ? <ELearningButton label="Cancel" variant="secondary" isDisabled={isSaving} onPress={resetForm} style={styles.actionButton} /> : null}
                <ELearningButton label={editingId ? 'Save changes' : 'Post announcement'} busyLabel={editingId ? 'Saving…' : 'Posting…'} isBusy={isSaving} onPress={() => void handleSave()} style={styles.actionButton} />
              </View>
            </View>

            <Text accessibilityRole="header" style={styles.sectionTitle}>Posted</Text>
            {isLoading ? (
              <View style={styles.card}>
                <Skeleton width="50%" height={16} borderRadius={8} />
                <Skeleton width="90%" height={14} borderRadius={7} />
                <Skeleton width="70%" height={14} borderRadius={7} />
              </View>
            ) : loadError ? (
              <ELearningEmptyState icon={<Megaphone size={36} color={colors.mutedText} />} title="Announcements unavailable" hint={loadError} actionLabel="Try again" onAction={() => { setIsLoading(true); void load(); }} />
            ) : items.length === 0 ? (
              <ELearningEmptyState icon={<Megaphone size={36} color={colors.mutedText} />} title="No announcements yet" hint="Post news, changes or reminders for your learners above." />
            ) : items.map((announcement) => (
              <View key={announcement.id} style={[styles.card, editingId === announcement.id ? styles.cardEditing : null]}>
                <View style={styles.itemHead}>
                  <Text style={[styles.itemTitle, styles.flexText]}>{announcement.title}</Text>
                  {announcement.important ? <StatusPill label="Important" tone="warning" /> : null}
                </View>
                <Text style={styles.meta}>{[announcement.authorName, formatWhen(announcement.createdAt), announcement.editedAt ? 'edited' : null].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.body}>{announcement.body}</Text>
                <View style={styles.itemActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${announcement.title}`} onPress={() => handleEdit(announcement)} android_ripple={RIPPLE} style={styles.itemButton}>
                    <Pencil size={16} color={colors.text} /><Text style={styles.itemButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${announcement.title}`} onPress={() => { setDeleteStage('idle'); setDeleteError(null); setDeleting(announcement); }} android_ripple={RIPPLE} style={[styles.itemButton, styles.itemButtonDanger]}>
                    <Trash2 size={16} color={colors.destructiveText} /><Text style={[styles.itemButtonText, { color: colors.destructiveText }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardSafeView>
      <CustomModal
        visible={deleting !== null}
        type={deleteStage === 'done' ? 'success' : 'danger'}
        title={deleteStage === 'done' ? 'Done, announcement deleted!' : deleteStage === 'deleting' ? 'Deleting announcement…' : 'Delete this announcement?'}
        message={deleteStage === 'done'
          ? 'Learners no longer see it.'
          : deleteStage === 'deleting'
            ? 'Please wait while we remove this announcement.'
            : deleteError ?? `“${deleting?.title ?? ''}” is removed for every learner. This can't be undone.`}
        confirmText={deleteStage === 'done' ? 'Great!' : 'Delete'}
        cancelText={deleteStage === 'done' ? undefined : 'Cancel'}
        isLoading={deleteStage === 'deleting'}
        onConfirm={() => (deleteStage === 'done' ? closeDelete() : void handleDelete())}
        onCancel={closeDelete}
        onClose={closeDelete}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: ELEARNING_GUTTER, gap: 14 },
  card: { padding: 16, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  cardEditing: { borderColor: colors.accent, borderWidth: 1 },
  section: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
  multiline: { minHeight: 120, maxHeight: 260 },
  inputError: { borderColor: colors.destructiveText },
  counter: { alignSelf: 'flex-end', color: colors.mutedText, fontSize: 12 },
  errorText: { color: colors.destructiveText, fontSize: 13 },
  formError: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, overflow: 'hidden', padding: 12, fontSize: 14, lineHeight: 20 },
  switchRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  meta: { color: colors.mutedText, fontSize: 12 },
  body: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  itemActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  itemButtonDanger: { borderColor: colors.destructiveSurface },
  itemButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
