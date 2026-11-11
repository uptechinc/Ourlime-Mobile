import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Award, CheckCircle2, FileText, Paperclip, X } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courseService } from '@/lib/services/CourseService';
import type { AssignmentFile, AssignmentSubmission } from '@/lib/types/course';

type LessonAssignmentProps = {
  userId: string;
  courseId: string;
  lessonId: string;
  /** Called after a successful hand-in so the lesson screen can refresh progress. */
  onSubmitted: () => void;
  /** Reports the learner's current submission (or null) after each load, e.g. for the overdue badge. */
  onSubmissionChange?: (submission: AssignmentSubmission | null) => void;
};

type PendingFile = { uri: string; name: string; mimeType?: string; size?: number };

const MAX_FILES = 20;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const formatSize = (bytes: number): string => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Hand in an assignment lesson: a written response and/or files, then see the grade and feedback (website parity). */
export default function LessonAssignment({ userId, courseId, lessonId, onSubmitted, onSubmissionChange }: LessonAssignmentProps) {
  const onSubmissionChangeRef = useRef(onSubmissionChange);
  onSubmissionChangeRef.current = onSubmissionChange;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [response, setResponse] = useState('');
  const [keptFiles, setKeptFiles] = useState<AssignmentFile[]>([]);
  const [newFiles, setNewFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const existing = await courseService.getMySubmission(userId, lessonId);
      setSubmission(existing);
      onSubmissionChangeRef.current?.(existing);
      setIsEditing(!existing);
      setResponse(existing?.textResponse ?? '');
      setKeptFiles(existing?.files ?? []);
      setNewFiles([]);
    } catch (loadError: unknown) {
      console.error('[LessonAssignment.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setIsEditing(true);
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, userId]);

  useEffect(() => { void load(); }, [load]);

  const handleAddFile = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    const picked = result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size }));
    const tooLarge = picked.find((file) => (file.size ?? 0) > MAX_FILE_BYTES);
    if (tooLarge) { setError(`${tooLarge.name} is larger than 20 MB.`); return; }
    setNewFiles((current) => [...current, ...picked].slice(0, MAX_FILES - keptFiles.length));
  };

  const handleSubmit = async () => {
    if (!response.trim() && keptFiles.length === 0 && newFiles.length === 0) { setError('Write a response or attach a file.'); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const uploaded: AssignmentFile[] = [];
      for (const file of newFiles) uploaded.push(await courseService.uploadAssignmentFile(lessonId, file));
      await courseService.submitAssignment(courseId, lessonId, response, [...keptFiles, ...uploaded]);
      await load();
      onSubmitted();
    } catch (submitError: unknown) {
      const message = submitError instanceof Error ? submitError.message : '';
      setError(message.includes('graded') ? 'This assignment has already been graded.' : message.includes('enrollment') ? 'Enroll in this course to hand in assignments.' : 'Your assignment could not be submitted. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <View style={styles.card}><Text style={styles.muted}>Loading your submission…</Text></View>;

  if (submission && !isEditing) {
    const isGraded = submission.status === 'graded';
    return (
      <View style={styles.card}>
        <View style={styles.statusRow}>
          {isGraded ? <Award size={20} color="#2563eb" /> : <CheckCircle2 size={20} color="#16a34a" />}
          <Text style={styles.statusTitle}>{isGraded ? 'Graded' : 'Submitted'}</Text>
          {submission.submittedAt ? <Text style={styles.muted}>{new Date(submission.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text> : null}
        </View>
        {isGraded && submission.score !== undefined ? <Text style={styles.score}>{submission.score}{submission.maxScore ? ` / ${submission.maxScore}` : ''}</Text> : null}
        {submission.feedback ? <View style={styles.feedback}><Text style={styles.feedbackLabel}>Instructor feedback</Text><Text style={styles.body}>{submission.feedback}</Text></View> : null}
        {submission.textResponse ? <Text style={styles.body}>{submission.textResponse}</Text> : null}
        {submission.files.map((file) => (
          <Pressable key={file.url} accessibilityRole="link" onPress={() => void Linking.openURL(file.url)} style={styles.fileRow}>
            <FileText size={18} color={colors.accentText} />
            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
            {file.size ? <Text style={styles.muted}>{formatSize(file.size)}</Text> : null}
          </Pressable>
        ))}
        {!isGraded ? (
          <Pressable accessibilityRole="button" onPress={() => setIsEditing(true)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Edit submission</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Your submission</Text>
      <TextInput
        value={response}
        onChangeText={setResponse}
        placeholder="Write your response…"
        placeholderTextColor={colors.mutedText}
        multiline
        maxLength={50000}
        style={styles.input}
      />
      {keptFiles.map((file) => (
        <View key={file.url} style={styles.fileRow}>
          <FileText size={18} color={colors.accentText} />
          <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} hitSlop={8} onPress={() => setKeptFiles((current) => current.filter((item) => item.url !== file.url))}><X size={18} color={colors.mutedText} /></Pressable>
        </View>
      ))}
      {newFiles.map((file, index) => (
        <View key={`${file.uri}-${index}`} style={styles.fileRow}>
          <Paperclip size={18} color={colors.accentText} />
          <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
          {file.size ? <Text style={styles.muted}>{formatSize(file.size)}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} hitSlop={8} onPress={() => setNewFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={18} color={colors.mutedText} /></Pressable>
        </View>
      ))}
      {keptFiles.length + newFiles.length < MAX_FILES ? (
        <Pressable accessibilityRole="button" onPress={() => void handleAddFile()} style={styles.secondaryButton}>
          <Paperclip size={16} color={colors.text} />
          <Text style={styles.secondaryButtonText}>Attach files</Text>
        </Pressable>
      ) : null}
      <Text style={styles.muted}>Documents, images, audio, text or zip files up to 20 MB each.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        {submission ? (
          <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void load()} style={[styles.secondaryButton, styles.flex]}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void handleSubmit()} style={[styles.primaryButton, styles.flex, isSubmitting && styles.disabled]}>
          <Text style={styles.primaryButtonText}>{isSubmitting ? 'Submitting…' : submission ? 'Resubmit' : 'Submit assignment'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { marginTop: 14, padding: 16, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  heading: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  score: { color: colors.text, fontSize: 30, fontWeight: '900' },
  feedback: { padding: 12, gap: 4, borderRadius: 12, backgroundColor: colors.control },
  feedbackLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  input: { minHeight: 140, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15, textAlignVertical: 'top' },
  fileRow: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  fileName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  muted: { color: colors.mutedText, fontSize: 12 },
  error: { color: colors.destructiveText, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
