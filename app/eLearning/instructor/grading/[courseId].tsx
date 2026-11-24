import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, ClipboardCheck, ClipboardList, FileText, HelpCircle, Inbox } from 'lucide-react-native';
import { InstructorGradingSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { FieldMessage } from '@/components/eLearning/instructor/InstructorForm';
import { ELearningButton, ELearningChip, ELearningEmptyState, ELearningHeader, ELEARNING_GUTTER, StatusPill, formatWhen, type ELearningTone } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService, type InstructorLesson, type InstructorSubmission } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 820;
const ALL_ITEMS = '__all__';
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

/** needs: handed in, no score yet; draft: scored privately (not released); graded: released to the student. */
type QueueState = 'needs' | 'draft' | 'graded';
type QueueFilter = QueueState | 'all';
const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: 'needs', label: 'Needs grading' },
  { value: 'draft', label: 'Drafts' },
  { value: 'graded', label: 'Graded' },
  { value: 'all', label: 'All' },
];
const STATE_ORDER: Record<QueueState, number> = { needs: 0, draft: 1, graded: 2 };

/** The score the server accepts: the lesson's points (as on the website), never above the submission's own maximum. */
const maximumFor = (submission: InstructorSubmission, lesson: InstructorLesson | undefined): number =>
  lesson?.points !== undefined && lesson.points > 0 ? Math.min(lesson.points, submission.maxScore) : submission.maxScore;

const stateOf = (submission: InstructorSubmission): QueueState =>
  submission.status === 'graded' ? 'graded' : submission.score !== undefined ? 'draft' : 'needs';

const timeOf = (submission: InstructorSubmission): number => (submission.submittedAt ? Date.parse(submission.submittedAt) || 0 : 0);

/**
 * Grade one course's work as a queue: every submission is a row with the student, the quiz or assignment, when it was
 * handed in and its status in words, oldest first so nothing waits too long. Tap a row to grade it in place. "Save
 * draft" keeps the score and feedback private (draft: true); "Publish grade" releases them and records progress.
 */
export default function InstructorGradingScreen() {
  const router = useRouter();
  const { courseId, title } = useLocalSearchParams<{ courseId: string; title?: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const courseName = typeof title === 'string' && title ? title : undefined;
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [submissions, setSubmissions] = useState<InstructorSubmission[]>([]);
  const [assessments, setAssessments] = useState<InstructorLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter | null>(null);
  const [itemFilter, setItemFilter] = useState<string>(ALL_ITEMS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [publishedNotice, setPublishedNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);

  const load = useCallback(async () => {
    if (!id) { setIsLoading(false); return; }
    setError(null);
    try {
      const [items, lessons] = await Promise.all([instructorService.getSubmissions(id), instructorService.getAssessments(id)]);
      setSubmissions(items);
      setAssessments(lessons);
    } catch (loadError: unknown) {
      console.error('[InstructorGradingScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Submissions could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const lessonsById = useMemo(() => new Map(assessments.map((lesson) => [lesson.id, lesson])), [assessments]);
  const counts = useMemo(() => {
    const scoped = itemFilter === ALL_ITEMS ? submissions : submissions.filter((submission) => submission.lessonId === itemFilter);
    const result: Record<QueueFilter, number> = { needs: 0, draft: 0, graded: 0, all: scoped.length };
    scoped.forEach((submission) => { result[stateOf(submission)] += 1; });
    return result;
  }, [itemFilter, submissions]);
  // Open on the work waiting for a grade when there is any, otherwise on everything.
  const activeFilter: QueueFilter = filter ?? (counts.needs > 0 ? 'needs' : 'all');

  const queue = useMemo(() => submissions
    .filter((submission) => (itemFilter === ALL_ITEMS || submission.lessonId === itemFilter) && (activeFilter === 'all' || stateOf(submission) === activeFilter))
    .sort((left, right) => {
      const leftState = stateOf(left);
      const rightState = stateOf(right);
      if (leftState !== rightState) return STATE_ORDER[leftState] - STATE_ORDER[rightState];
      // Waiting work oldest first (first in, first graded); graded work newest first.
      return leftState === 'graded' ? timeOf(right) - timeOf(left) : timeOf(left) - timeOf(right);
    }), [activeFilter, itemFilter, submissions]);

  const orderedAssessments = useMemo(() => [...assessments].sort((left, right) => (left.type === right.type ? left.order - right.order : left.type === 'quiz' ? -1 : 1)), [assessments]);
  const selectedItem = itemFilter === ALL_ITEMS ? undefined : lessonsById.get(itemFilter);

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
      if (draft) {
        setFormNotice('Draft saved. The student sees it once you publish the grade.');
      } else {
        setOpenId(null);
        setPublishedNotice(`Grade published for ${submission.studentName}: ${value}/${maximum}.`);
      }
    } catch (saveError: unknown) {
      console.error('[InstructorGradingScreen.handleGrade] Error:', saveError instanceof Error ? saveError.message : 'Unknown error');
      setFormError('The grade could not be saved. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const renderSubmission = (submission: InstructorSubmission) => {
    const isOpen = openId === submission.id;
    const lesson = lessonsById.get(submission.lessonId);
    const maximum = maximumFor(submission, lesson);
    const state = stateOf(submission);
    const statusLabel = state === 'graded' ? `Graded · ${submission.score ?? 0}/${maximum}` : state === 'draft' ? `Draft · ${submission.score}/${maximum}` : 'Needs grading';
    const tone: ELearningTone = state === 'graded' ? 'success' : state === 'draft' ? 'neutral' : 'warning';
    const itemKind = lesson?.type === 'quiz' ? 'Quiz' : lesson ? 'Assignment' : 'Lesson';
    const ItemIcon = lesson?.type === 'quiz' ? HelpCircle : FileText;
    const submittedWhen = formatWhen(submission.submittedAt);
    const percent = score.trim() !== '' && Number.isFinite(Number(score)) && maximum > 0 ? Math.round((Number(score) / maximum) * 100) : null;
    return (
      <View key={submission.id} style={[styles.card, isOpen && styles.cardOpen]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${submission.studentName}, ${itemKind}: ${lesson?.title ?? 'not listed'}, ${submittedWhen ? `submitted ${submittedWhen}` : 'submitted'}, ${statusLabel}`}
          accessibilityHint={isOpen ? 'Closes the grading form' : 'Opens the grading form'}
          accessibilityState={{ expanded: isOpen }}
          onPress={() => handleOpen(submission)}
          android_ripple={RIPPLE}
          style={styles.cardHeader}
        >
          <View style={styles.headRow}>
            <Text style={[styles.student, styles.flexText]} numberOfLines={1}>{submission.studentName}</Text>
            <StatusPill label={statusLabel} tone={tone} />
          </View>
          <View style={styles.metaRow}>
            <ItemIcon size={14} color={colors.mutedText} />
            <Text style={[styles.item, styles.flexText]} numberOfLines={1}>{itemKind} · {lesson?.title ?? 'Not in the course outline'}</Text>
          </View>
          <Text style={styles.muted} numberOfLines={1}>{submittedWhen ? `Submitted ${submittedWhen}` : 'Submitted'}{state === 'graded' && submission.gradedAt ? ` · graded ${formatWhen(submission.gradedAt)}` : ''}</Text>
        </Pressable>
        {isOpen ? (
          <View style={styles.cardBody}>
            <Text style={styles.label}>Student's work</Text>
            {submission.textResponse ? <Text selectable style={styles.response}>{submission.textResponse}</Text> : <Text style={styles.muted}>No written response.</Text>}
            {submission.files.map((file) => (
              <Pressable key={file.url} accessibilityRole="link" accessibilityLabel={`Open ${file.name}`} onPress={() => void Linking.openURL(file.url).catch((openError: unknown) => console.error('[InstructorGradingScreen.openFile] Error:', openError instanceof Error ? openError.message : 'Unknown error'))} android_ripple={RIPPLE} style={styles.fileRow}>
                <FileText size={18} color={colors.accentText} />
                <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
              </Pressable>
            ))}
            <View style={styles.field}>
              <Text style={styles.label}>Score</Text>
              <View style={styles.scoreRow}>
                <TextInput accessibilityLabel={`Score out of ${maximum}`} value={score} onChangeText={setScore} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedText} maxLength={7} style={[styles.input, styles.scoreInput, formError ? styles.inputError : null]} />
                <Text style={styles.scoreMax}>/ {maximum}</Text>
                {percent !== null ? <Text style={styles.percent}>{percent}%</Text> : null}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Feedback <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput accessibilityLabel="Feedback" value={feedback} onChangeText={setFeedback} multiline placeholder="What went well, and what to improve" placeholderTextColor={colors.mutedText} style={[styles.input, styles.multiline]} />
            </View>
            <FieldMessage error={formError ?? undefined} />
            {formNotice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{formNotice}</Text> : null}
            <View style={styles.buttonRow}>
              <ELearningButton label="Save draft" variant="secondary" busyLabel="Saving…" isBusy={saving === 'draft'} isDisabled={saving !== null} onPress={() => void handleGrade(submission, true)} style={styles.flex} />
              <ELearningButton label={state === 'graded' ? 'Update grade' : 'Publish grade'} busyLabel="Publishing…" isBusy={saving === 'publish'} isDisabled={saving !== null} onPress={() => void handleGrade(submission, false)} style={styles.flex} />
            </View>
            <Text style={styles.muted}>Drafts stay private. Publishing shows the score and feedback to the student.</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderQueueEmpty = () => {
    if (submissions.length === 0 || counts.all === 0) {
      return <ELearningEmptyState
        icon={<Inbox size={40} color={colors.mutedText} />}
        title="Nothing handed in yet"
        hint={selectedItem?.type === 'quiz' ? 'Quizzes are scored automatically; nothing to grade here yet.' : 'Work appears here as students hand it in. Pull down to check again.'}
      />;
    }
    if (activeFilter === 'needs') {
      return <ELearningEmptyState icon={<CheckCircle2 size={40} color={colors.successText} />} title="All caught up" hint="Nothing is waiting for a grade." actionLabel="Show all work" onAction={() => setFilter('all')} />;
    }
    return <ELearningEmptyState icon={<ClipboardList size={40} color={colors.mutedText} />} title={activeFilter === 'draft' ? 'No drafts' : 'Nothing graded yet'} actionLabel="Show all work" onAction={() => setFilter('all')} />;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title="Grading" subtitle={courseName} onBack={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><InstructorGradingSkeleton /></ScrollView>
      ) : error && submissions.length === 0 ? (
        <View style={styles.centerFill}>
          <ELearningEmptyState icon={<ClipboardCheck size={40} color={colors.mutedText} />} title="Grading could not load" hint={error} actionLabel="Try again" onAction={() => { setIsLoading(true); void load(); }} />
        </View>
      ) : assessments.length === 0 && submissions.length === 0 ? (
        <View style={styles.centerFill}>
          <ELearningEmptyState icon={<ClipboardList size={40} color={colors.mutedText} />} title="No quizzes or assignments yet" hint="Add them from the course's instructor page, then student work shows up here." actionLabel="Back to course" onAction={() => router.back()} />
        </View>
      ) : (
        <KeyboardSafeView style={styles.flex}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
            <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
              <Text style={styles.summary}>
                {counts.needs} need grading · {counts.draft} {counts.draft === 1 ? 'draft' : 'drafts'} · {counts.graded} graded
              </Text>
              {error ? <FieldMessage error={error} /> : null}
              {publishedNotice ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`${publishedNotice} Dismiss`} onPress={() => setPublishedNotice(null)} style={styles.successBanner}>
                  <CheckCircle2 size={16} color={colors.successText} />
                  <Text accessibilityLiveRegion="polite" style={[styles.successText, styles.flexText]}>{publishedNotice}</Text>
                </Pressable>
              ) : null}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
                {FILTERS.map((option) => <ELearningChip key={option.value} label={`${option.label} (${counts[option.value]})`} isSelected={activeFilter === option.value} onPress={() => { setFilter(option.value); setOpenId(null); }} />)}
              </ScrollView>
              {orderedAssessments.length > 1 ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Quiz or assignment</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
                    <ELearningChip label="All" isSelected={itemFilter === ALL_ITEMS} onPress={() => { setItemFilter(ALL_ITEMS); setOpenId(null); }} />
                    {orderedAssessments.map((lesson) => (
                      <View key={lesson.id} style={styles.itemChip}>
                        <ELearningChip label={lesson.title} isSelected={itemFilter === lesson.id} onPress={() => { setItemFilter(lesson.id); setOpenId(null); }} />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {queue.length === 0 ? renderQueueEmpty() : <View style={styles.list}>{queue.map(renderSubmission)}</View>}
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
  flexText: { flex: 1, minWidth: 0 },
  centerFill: { flex: 1, justifyContent: 'center' },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: ELEARNING_GUTTER, gap: 14 },
  summary: { color: colors.text, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  chips: { gap: 8, paddingVertical: 2 },
  itemChip: { maxWidth: 220 },
  field: { gap: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  optional: { color: colors.mutedText, fontWeight: '500' },
  successBanner: { padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, backgroundColor: colors.successSurface },
  successText: { color: colors.successText, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  notice: { color: colors.successText, fontSize: 13, lineHeight: 18 },
  list: { gap: 10 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  cardOpen: { borderWidth: 1, borderColor: colors.accent },
  cardHeader: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  student: { color: colors.text, fontSize: 15, fontWeight: '700' },
  item: { color: colors.secondaryText, fontSize: 13 },
  cardBody: { padding: 14, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  response: { padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.canvas, color: colors.text, fontSize: 15, lineHeight: 22 },
  fileRow: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  fileName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreInput: { width: 104, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  scoreMax: { color: colors.secondaryText, fontSize: 16, fontWeight: '600' },
  percent: { marginLeft: 'auto', color: colors.mutedText, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  inputError: { borderColor: colors.destructiveText },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', gap: 10 },
});
