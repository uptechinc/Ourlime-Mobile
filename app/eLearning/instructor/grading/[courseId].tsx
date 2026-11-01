import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, ClipboardCheck, FileText } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import { CourseDetailSkeleton } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService, type InstructorSubmission } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 820;

/** Grade assignment submissions for one course: ungraded first, score out of the lesson's points, written feedback. */
export default function InstructorGradingScreen() {
  const router = useRouter();
  const { courseId, title } = useLocalSearchParams<{ courseId: string; title?: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [submissions, setSubmissions] = useState<InstructorSubmission[]>([]);
  const [lessonTitles, setLessonTitles] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [items, titles] = await Promise.all([instructorService.getSubmissions(id), instructorService.getLessonTitles(id)]);
      setSubmissions(items);
      setLessonTitles(titles);
    } catch (loadError: unknown) {
      console.error('[InstructorGradingScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Submissions could not be loaded. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const handleOpen = (submission: InstructorSubmission) => {
    setOpenId(openId === submission.id ? null : submission.id);
    setScore(submission.score !== undefined ? String(submission.score) : '');
    setFeedback(submission.feedback ?? '');
    setFormError(null);
  };

  const handleSave = async (submission: InstructorSubmission) => {
    const value = Number(score);
    if (score.trim() === '' || !Number.isFinite(value) || value < 0 || value > submission.maxScore) {
      setFormError(`Enter a score between 0 and ${submission.maxScore}.`);
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await instructorService.grade(submission.id, value, feedback);
      setSubmissions((current) => current.map((item) => (item.id === submission.id ? { ...item, status: 'graded', score: value, feedback: feedback.trim() || undefined } : item)));
      setOpenId(null);
    } catch (saveError: unknown) {
      console.error('[InstructorGradingScreen.handleSave] Error:', saveError instanceof Error ? saveError.message : 'Unknown error');
      setFormError('The grade could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const pending = submissions.filter((submission) => submission.status !== 'graded').length;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Grade submissions" onBackPress={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.padded}><CourseDetailSkeleton /></ScrollView>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
            <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
              <Text style={styles.title} numberOfLines={2}>{typeof title === 'string' && title ? title : 'Course'}</Text>
              <Text style={styles.muted}>{submissions.length ? `${pending} waiting for a grade · ${submissions.length} total` : 'No assignments have been handed in yet.'}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {submissions.map((submission) => {
                const isOpen = openId === submission.id;
                return (
                  <View key={submission.id} style={styles.card}>
                    <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => handleOpen(submission)} style={styles.cardHeader}>
                      {submission.status === 'graded' ? <Award size={20} color="#2563eb" /> : <ClipboardCheck size={20} color={colors.warningText} />}
                      <View style={styles.flex}>
                        <Text style={styles.student}>{submission.studentName}</Text>
                        <Text style={styles.muted} numberOfLines={1}>{lessonTitles.get(submission.lessonId) ?? 'Assignment'}{submission.submittedAt ? ` · ${new Date(submission.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</Text>
                      </View>
                      <Text style={[styles.result, submission.status === 'graded' && styles.resultGraded]}>
                        {submission.status === 'graded' ? `${submission.score ?? 0}/${submission.maxScore}` : 'To grade'}
                      </Text>
                    </Pressable>
                    {isOpen ? (
                      <View style={styles.cardBody}>
                        {submission.textResponse ? <Text style={styles.body}>{submission.textResponse}</Text> : <Text style={styles.muted}>No written response.</Text>}
                        {submission.files.map((file) => (
                          <Pressable key={file.url} accessibilityRole="link" onPress={() => void Linking.openURL(file.url)} style={styles.fileRow}>
                            <FileText size={18} color={colors.accentText} />
                            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                          </Pressable>
                        ))}
                        <Text style={styles.label}>Score (out of {submission.maxScore})</Text>
                        <TextInput value={score} onChangeText={setScore} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedText} style={styles.input} />
                        <Text style={styles.label}>Feedback</Text>
                        <TextInput value={feedback} onChangeText={setFeedback} multiline placeholder="What went well, and what to improve" placeholderTextColor={colors.mutedText} style={[styles.input, styles.multiline]} />
                        {formError ? <Text style={styles.error}>{formError}</Text> : null}
                        <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void handleSave(submission)} style={[styles.primaryButton, isSaving && styles.disabled]}>
                          <Text style={styles.primaryButtonText}>{isSaving ? 'Saving…' : submission.status === 'graded' ? 'Update grade' : 'Save grade'}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  padded: { padding: 16 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 12 },
  error: { color: colors.destructiveText, fontSize: 13 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  cardHeader: { minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  student: { color: colors.text, fontSize: 15, fontWeight: '800' },
  result: { color: colors.warningText, fontSize: 13, fontWeight: '800' },
  resultGraded: { color: colors.text },
  cardBody: { padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  fileRow: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  fileName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
