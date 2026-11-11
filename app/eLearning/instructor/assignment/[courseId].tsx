import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { FileText, Trash2, Upload } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import DateTimeField from '@/components/ui/DateTimeField';
import { ErrorList, FormButton, FormField, ToggleRow } from '@/components/eLearning/instructor/InstructorForm';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService } from '@/lib/services/InstructorService';
import type { AssignmentFile } from '@/lib/types/course';
import type { PickedUpload } from '@/lib/types/instructor';

const CONTENT_MAX_WIDTH = 760;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 20;
// Types storage.rules accepts in courseFiles/{courseId}/{uid}/.
const ATTACHMENT_TYPES = [
  'application/pdf', 'application/zip', 'application/msword', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/*', 'audio/*',
];

const defaultDueDate = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(23, 59, 0, 0);
  return date;
};

const formatSize = (bytes?: number): string => (bytes && bytes > 0 ? (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`) : '');

/** Create an assignment for one of the instructor's courses (the website's assignment editor). */
export default function CreateAssignmentScreen() {
  const router = useRouter();
  const { courseId, title: courseTitle } = useLocalSearchParams<{ courseId: string; title?: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(defaultDueDate());
  const [points, setPoints] = useState('100');
  const [allowLate, setAllowLate] = useState(false);
  const [attachments, setAttachments] = useState<PickedUpload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const handlePickAttachments = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: ATTACHMENT_TYPES, multiple: true, copyToCacheDirectory: true });
    if (picked.canceled) return;
    const tooLarge = picked.assets.filter((asset) => (asset.size ?? 0) > MAX_ATTACHMENT_BYTES).map((asset) => asset.name);
    const accepted = picked.assets.filter((asset) => (asset.size ?? 0) <= MAX_ATTACHMENT_BYTES).map((asset): PickedUpload => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size }));
    setAttachments((current) => [...current, ...accepted].slice(0, MAX_ATTACHMENTS));
    setErrors(tooLarge.length > 0 ? [`Larger than 10 MB, not added: ${tooLarge.join(', ')}`] : []);
  };

  const validate = (): string[] => {
    const found: string[] = [];
    if (!title.trim()) found.push('Enter an assignment title.');
    if (!instructions.trim()) found.push('Add instructions for students.');
    if (!dueDate) found.push('Choose a due date and time.');
    const value = Number(points);
    if (!Number.isInteger(value) || value < 1 || value > 10000) found.push('Points must be a whole number from 1 to 10000.');
    return found;
  };

  const handleSave = async () => {
    const found = validate();
    setErrors(found);
    setSaveError(null);
    if (found.length > 0 || !id || !dueDate) return;
    try {
      const uploaded: AssignmentFile[] = [];
      for (const [index, file] of attachments.entries()) {
        setProgress(`Uploading ${index + 1} of ${attachments.length}…`);
        uploaded.push(await instructorService.uploadAssignmentAttachment(id, file));
      }
      setProgress('Saving…');
      await instructorService.createAssignment({
        courseId: id, title, description, instructions, dueDate, points: Number(points), allowLateSubmission: allowLate, attachments: uploaded,
      });
      setIsDone(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      console.error('[CreateAssignmentScreen.handleSave] Error:', message || 'Unknown error');
      setSaveError(message.includes('instructor') ? 'Only the course instructor can add assignments to this course.' : 'The assignment could not be created. Please try again.');
    } finally {
      setProgress(null);
    }
  };

  if (isDone) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <PageHeader title="Assignment created" onBackPress={() => router.back()} />
        <View style={styles.done}>
          <FileText size={44} color={colors.accent} />
          <Text style={styles.doneTitle}>Assignment added</Text>
          <Text style={styles.doneText}>Students see it in the course's quizzes and assignments. Grade their work from your instructor dashboard.</Text>
          <FormButton label="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <PageHeader title="New assignment" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            {typeof courseTitle === 'string' && courseTitle ? <Text style={styles.course} numberOfLines={2}>{courseTitle}</Text> : null}
            <FormField label="Assignment title" required value={title} onChange={setTitle} placeholder="e.g. Financial Planning Project" maxLength={200} />
            <FormField label="Description" value={description} onChange={setDescription} multiline placeholder="Brief overview of the assignment" />
            <FormField label="Instructions" required value={instructions} onChange={setInstructions} multiline placeholder="Detailed instructions for students…" />
            <DateTimeField label="Due date" mode="datetime" required value={dueDate} onChange={setDueDate} placeholder="Choose the due date and time" minimumDate={new Date()} />
            <FormField label="Points" required value={points} onChange={(value) => setPoints(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" hint="The maximum score you can give." />
            <ToggleRow label="Allow late submissions" description="Late work is accepted with a penalty." value={allowLate} onChange={setAllowLate} />

            <Text style={styles.label}>Attachments (optional)</Text>
            <Pressable accessibilityRole="button" onPress={() => void handlePickAttachments()} style={styles.dropZone}>
              <Upload size={22} color={colors.mutedText} />
              <Text style={styles.dropTitle}>Upload attachments</Text>
              <Text style={styles.hint}>PDF, Word, ZIP, images and more (max 10 MB per file)</Text>
            </Pressable>
            {attachments.map((file, index) => (
              <View key={`${file.uri}-${index}`} style={styles.fileRow}>
                <FileText size={18} color={colors.accentText} />
                <View style={styles.flex}>
                  <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                  {file.size ? <Text style={styles.hint}>{formatSize(file.size)}</Text> : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} hitSlop={8} onPress={() => setAttachments((current) => current.filter((_entry, position) => position !== index))}>
                  <Trash2 size={16} color={colors.mutedText} />
                </Pressable>
              </View>
            ))}

            <ErrorList errors={errors} />
            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
            <FormButton label={progress ?? 'Save assignment'} disabled={Boolean(progress)} onPress={() => void handleSave()} />
          </View>
        </ScrollView>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 12 },
  course: { color: colors.mutedText, fontSize: 13, fontWeight: '700' },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.mutedText, fontSize: 12 },
  dropZone: { paddingVertical: 20, paddingHorizontal: 14, alignItems: 'center', gap: 6, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  dropTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  fileRow: { minHeight: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  error: { color: colors.destructiveText, fontSize: 13 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  doneText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
