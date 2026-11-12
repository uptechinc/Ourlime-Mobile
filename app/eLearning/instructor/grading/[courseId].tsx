import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, ChevronDown, ChevronRight, ClipboardCheck, FileText, HelpCircle, PencilLine } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import { InstructorGradingSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService, type InstructorLesson, type InstructorSubmission } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 820;
const OTHER_GROUP = '__other__';

type AssessmentGroup = { key: string; title: string; kind: 'quiz' | 'assignment' | 'other'; points?: number; submissions: InstructorSubmission[] };

/** The score the server accepts: the lesson's points (as on the website), never above the submission's own maximum. */
const maximumFor = (submission: InstructorSubmission, lesson: InstructorLesson | undefined): number =>
  lesson?.points !== undefined && lesson.points > 0 ? Math.min(lesson.points, submission.maxScore) : submission.maxScore;

/**
 * Grade one course's submissions, grouped by quiz and assignment like the website's grading page. "Save draft" keeps
 * the score and feedback private (draft: true); "Publish grade" releases them to the student and records progress.
 */
export default function InstructorGradingScreen() {
  const router = useRouter();
  const { courseId, title } = useLocalSearchParams<{ courseId: string; title?: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [submissions, setSubmissions] = useState<InstructorSubmission[]>([]);
  const [assessments, setAssessments] = useState<InstructorLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [items, lessons] = await Promise.all([instructorService.getSubmissions(id), instructorService.getAssessments(id)]);
      setSubmissions(items);
      setAssessments(lessons);
    } catch (loadError: unknown) {
      console.error('[InstructorGradingScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Submissions could not be loaded. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const lessonsById = useMemo(() => new Map(assessments.map((lesson) => [lesson.id, lesson])), [assessments]);

  const groups = useMemo((): AssessmentGroup[] => {
    const byLesson = new Map<string, InstructorSubmission[]>();
    submissions.forEach((submission) => {
      const key = lessonsById.has(submission.lessonId) ? submission.lessonId : OTHER_GROUP;
      byLesson.set(key, [...(byLesson.get(key) ?? []), submission]);
    });
    const ordered = [...assessments].sort((left, right) => (left.type === right.type ? left.order - right.order : left.type === 'quiz' ? -1 : 1));
    const built: AssessmentGroup[] = ordered.map((lesson) => ({
      key: lesson.id, title: lesson.title, kind: lesson.type === 'quiz' ? 'quiz' : 'assignment', points: lesson.points, submissions: byLesson.get(lesson.id) ?? [],
    }));
    const other = byLesson.get(OTHER_GROUP);
    if (other && other.length > 0) built.push({ key: OTHER_GROUP, title: 'Other submissions', kind: 'other', submissions: other });
    return built;
  }, [assessments, lessonsById, submissions]);

  const handleOpen = (submission: InstructorSubmission) => {
    setOpenId(openId === submission.id ? null : submission.id);
    setScore(submission.score !== undefined ? String(submission.score) : '');
    setFeedback(submission.feedback ?? '');
    setFormError(null);
    setFormNotice(null);
  };

  const handleGrade = async (submission: InstructorSubmission, draft: boolean) => {
    const maximum = maximumFor(submission, lessonsById.get(submission.lessonId));
    const value = Number(score);
    if (score.trim() === '' || !Number.isFinite(value) || value < 0 || value > maximum) {
      setFormError(`Enter a score from 0 to ${maximum}.`);
      return;
    }
    setSaving(draft ? 'draft' : 'publish');
    setFormError(null);
    setFormNotice(null);
    try {
      await instructorService.grade(submission.id, value, feedback, draft);
      setSubmissions((current) => current.map((item) => (item.id === submission.id ? { ...item, status: draft ? 'submitted' : 'graded', score: value, feedback: feedback.trim() || undefined } : item)));
      if (draft) setFormNotice('Draft saved. The student sees it once you publish the grade.');
      else setOpenId(null);
    } catch (saveError: unknown) {
      console.error('[InstructorGradingScreen.handleGrade] Error:', saveError instanceof Error ? saveError.message : 'Unknown error');
      setFormError('The grade could not be saved. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const pending = submissions.filter((submission) => submission.status !== 'graded').length;

  const renderSubmission = (submission: InstructorSubmission) => {
    const isOpen = openId === submission.id;
    const maximum = maximumFor(submission, lessonsById.get(submission.lessonId));
    const hasDraft = submission.status !== 'graded' && submission.score !== undefined;
    const percent = score.trim() !== '' && Number.isFinite(Number(score)) && maximum > 0 ? Math.round((Number(score) / maximum) * 100) : null;
    return (
      <View key={submission.id} style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => handleOpen(submission)} style={styles.cardHeader}>
          {submission.status === 'graded' ? <Award size={20} color="#2563eb" /> : hasDraft ? <PencilLine size={20} color={colors.mutedText} /> : <ClipboardCheck size={20} color={colors.warningText} />}
          <View style={styles.flex}>
            <Text style={styles.student}>{submission.studentName}</Text>
            <Text style={styles.muted} numberOfLines={1}>{submission.submittedAt ? `Submitted ${new Date(submission.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Submitted'}</Text>
          </View>
          <Text style={[styles.result, submission.status === 'graded' && styles.resultGraded]}>
            {submission.status === 'graded' ? `${submission.score ?? 0}/${maximum}` : hasDraft ? `Draft ${submission.score}/${maximum}` : 'To grade'}
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
            <Text style={styles.label}>Score (out of {maximum}){percent !== null ? <Text style={styles.muted}>  {percent}%</Text> : null}</Text>
            <TextInput accessibilityLabel={`Score out of ${maximum}`} value={score} onChangeText={setScore} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedText} style={styles.input} />
            <Text style={styles.label}>Feedback</Text>
            <TextInput accessibilityLabel="Feedback" value={feedback} onChangeText={setFeedback} multiline placeholder="What went well, and what to improve" placeholderTextColor={colors.mutedText} style={[styles.input, styles.multiline]} />
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            {formNotice ? <Text style={styles.notice}>{formNotice}</Text> : null}
            <View style={styles.buttonRow}>
              <Pressable accessibilityRole="button" disabled={saving !== null} onPress={() => void handleGrade(submission, true)} style={[styles.secondaryButton, saving !== null && styles.disabled]}>
                <Text style={styles.secondaryButtonText}>{saving === 'draft' ? 'Saving…' : 'Save draft'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={saving !== null} onPress={() => void handleGrade(submission, false)} style={[styles.primaryButton, saving !== null && styles.disabled]}>
                <Text style={styles.primaryButtonText}>{saving === 'publish' ? 'Publishing…' : submission.status === 'graded' ? 'Update grade' : 'Publish grade'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Grade submissions" onBackPress={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><InstructorGradingSkeleton /></ScrollView>
      ) : (
        <KeyboardSafeView style={styles.flex}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
            <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
              <Text style={styles.title} numberOfLines={2}>{typeof title === 'string' && title ? title : 'Course'}</Text>
              <Text style={styles.muted}>
                {`${assessments.filter((lesson) => lesson.type === 'quiz').length} quizzes · ${assessments.filter((lesson) => lesson.type === 'assignment').length} assignments · `}
                {submissions.length ? `${pending} waiting for a grade of ${submissions.length}` : 'nothing handed in yet'}
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {!error && groups.length === 0 ? <Text style={styles.empty}>No quizzes or assignments yet. Add them from the course's instructor page.</Text> : null}
              {groups.map((group) => {
                const isOpen = openGroup === group.key;
                const waiting = group.submissions.filter((submission) => submission.status !== 'graded').length;
                return (
                  <View key={group.key} style={styles.group}>
                    <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpenGroup(isOpen ? null : group.key)} style={styles.groupHeader}>
                      {group.kind === 'quiz' ? <HelpCircle size={20} color="#8b5cf6" /> : <FileText size={20} color="#f97316" />}
                      <View style={styles.flex}>
                        <Text style={styles.groupTitle} numberOfLines={2}>{group.title}</Text>
                        <Text style={styles.muted}>
                          {group.kind === 'quiz' ? 'Quiz' : group.kind === 'assignment' ? 'Assignment' : 'Lessons not listed'}
                          {group.points !== undefined ? ` · max ${group.points}` : ''} · {group.submissions.length} submission{group.submissions.length === 1 ? '' : 's'}
                        </Text>
                      </View>
                      {waiting > 0 ? <Text style={styles.waiting}>{waiting}</Text> : null}
                      {isOpen ? <ChevronDown size={18} color={colors.mutedText} /> : <ChevronRight size={18} color={colors.mutedText} />}
                    </Pressable>
                    {isOpen ? (
                      <View style={styles.groupBody}>
                        {group.submissions.length === 0 ? <Text style={styles.muted}>{group.kind === 'quiz' ? 'Quizzes are scored automatically; nothing to grade here yet.' : 'No submissions yet.'}</Text> : group.submissions.map(renderSubmission)}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </KeyboardSafeView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 12 },
  empty: { color: colors.mutedText, fontSize: 14, paddingVertical: 12 },
  error: { color: colors.destructiveText, fontSize: 13 },
  notice: { color: colors.successText, fontSize: 13 },
  group: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  groupHeader: { minHeight: 62, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  groupBody: { padding: 10, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.canvas },
  waiting: { minWidth: 24, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 12, overflow: 'hidden', textAlign: 'center', color: colors.warningText, backgroundColor: colors.warningSurface, fontSize: 12, fontWeight: '900' },
  card: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
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
  buttonRow: { flexDirection: 'row', gap: 8 },
  primaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  secondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
