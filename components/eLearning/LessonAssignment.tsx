import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { AlertCircle, Award, CheckCircle2, Clock, FileText, History, MessageSquareWarning, Paperclip, X } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import { LessonAssignmentSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courseService } from '@/lib/services/CourseService';
import { serverMessage } from '@/lib/services/TeachingWorkflowService';
import {
  APPEAL_STATUS_LABELS,
  describeLatePolicy,
  handInGate,
  lateDaysBetween,
  NO_LATE_PENALTY,
  NO_RESUBMISSION,
  resubmissionsRemaining,
  resubmitGate,
  reviewRequestGate,
} from '@/lib/services/AssignmentPolicy';
import { ELEARNING_ACTION_GREEN, StatusPill } from '@/components/eLearning/ELearningParts';
import { openCourseFile } from '@/components/eLearning/course/workspaceHelpers';
import RubricView from '@/components/eLearning/assignment/RubricView';
import GradeBreakdown from '@/components/eLearning/assignment/GradeBreakdown';
import SubmissionHistoryList from '@/components/eLearning/assignment/SubmissionHistoryList';
import ReviewRequestSheet from '@/components/eLearning/assignment/ReviewRequestSheet';
import type { AssignmentFile, AssignmentSubmission, CourseLesson, SubmissionHistory } from '@/lib/types/course';

type LessonAssignmentProps = {
  userId: string;
  courseId: string;
  lesson: CourseLesson;
  /** Called after a successful hand-in so the lesson screen can refresh progress. */
  onSubmitted: () => void;
  /** Reports the learner's current submission (or null) after each load, e.g. for the overdue badge. */
  onSubmissionChange?: (submission: AssignmentSubmission | null) => void;
};

type PendingFile = { uri: string; name: string; mimeType?: string; size?: number };
/** replace: changing an ungraded hand-in; resubmit: a new version after a published grade. */
type EditMode = 'first' | 'replace' | 'resubmit';

const MAX_FILES = 20;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

const formatSize = (bytes: number): string => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Hand in an assignment lesson and follow it through grading: the rubric before handing in, the late policy the server
 * enforces, the published grade with its rubric scores and any late penalty, new versions when the assignment accepts
 * resubmissions, every earlier version and grade, and a review request with its outcome.
 */
export default function LessonAssignment({ userId, courseId, lesson, onSubmitted, onSubmissionChange }: LessonAssignmentProps) {
  const onSubmissionChangeRef = useRef(onSubmissionChange);
  onSubmissionChangeRef.current = onSubmissionChange;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const lessonId = lesson.id;
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState<EditMode | null>(null);
  const [response, setResponse] = useState('');
  const [keptFiles, setKeptFiles] = useState<AssignmentFile[]>([]);
  const [newFiles, setNewFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<SubmissionHistory | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [openError, setOpenError] = useState(false);

  const resubmission = lesson.resubmission ?? NO_RESUBMISSION;
  const latePenalty = lesson.latePenalty ?? NO_LATE_PENALTY;
  const allowLate = lesson.allowLateSubmission === true;

  const loadHistory = useCallback(async (submissionId: string) => {
    setIsHistoryLoading(true);
    try {
      setHistory(await courseService.getSubmissionHistory(submissionId));
    } catch (historyError: unknown) {
      console.error('[LessonAssignment.loadHistory] Error:', historyError instanceof Error ? historyError.message : 'Unknown error');
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const existing = await courseService.getMySubmission(userId, lessonId);
      setSubmission(existing);
      onSubmissionChangeRef.current?.(existing);
      setEditMode(existing ? null : 'first');
      setResponse(existing?.textResponse ?? '');
      setKeptFiles(existing?.files ?? []);
      setNewFiles([]);
      // A review request's answer (and its note) lives in the history; load it so the outcome shows without a tap.
      if (existing?.appealStatus) void loadHistory(existing.id);
    } catch (loadError: unknown) {
      console.error('[LessonAssignment.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setEditMode('first');
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, loadHistory, userId]);

  useEffect(() => { void load(); }, [load]);

  const now = new Date();
  const gateInput = { now, dueDate: lesson.dueDate, allowLateSubmission: allowLate, resubmission, submission };
  const handIn = handInGate(gateInput);
  const resubmit = resubmitGate(gateInput);
  const review = reviewRequestGate(submission, now);
  const isPastDue = lateDaysBetween(lesson.dueDate, now) > 0;
  const currentAppeal = history?.appeals.find((appeal) => appeal.version === (submission?.version ?? 1));

  const startEditing = (mode: EditMode) => {
    setEditMode(mode);
    setError(null);
    setNotice(null);
    setResponse(submission?.textResponse ?? '');
    setKeptFiles(submission?.files ?? []);
    setNewFiles([]);
  };

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
      const result = await courseService.submitAssignment(courseId, lessonId, response, [...keptFiles, ...uploaded]);
      setNotice(editMode === 'resubmit' ? `Version ${result.version} handed in. Your instructor will grade it.` : result.isLate ? 'Handed in late. Your instructor will grade it.' : 'Handed in. Your instructor will grade it.');
      setHistory(null);
      setIsHistoryOpen(false);
      await load();
      onSubmitted();
    } catch (submitError: unknown) {
      console.error('[LessonAssignment.handleSubmit] Error:', submitError instanceof Error ? submitError.message : 'Unknown error');
      setError(serverMessage(submitError, 'Your assignment could not be submitted. Check your connection and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!currentAppeal) return;
    setIsWithdrawing(true);
    try {
      await courseService.withdrawGradeReview(currentAppeal.id);
      setIsWithdrawOpen(false);
      await load();
    } catch (withdrawError: unknown) {
      console.error('[LessonAssignment.handleWithdraw] Error:', withdrawError instanceof Error ? withdrawError.message : 'Unknown error');
      setIsWithdrawOpen(false);
      setError(serverMessage(withdrawError, 'The request could not be withdrawn. Please try again.'));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const toggleHistory = () => {
    if (!submission) return;
    const next = !isHistoryOpen;
    setIsHistoryOpen(next);
    if (next && !history) void loadHistory(submission.id);
  };

  if (isLoading) return <LessonAssignmentSkeleton />;

  const rubricBeforeHandIn = lesson.rubric && (!submission || submission.status !== 'graded' || editMode === 'resubmit')
    ? <RubricView rubric={lesson.rubric} /> : null;

  const policyLine = lesson.dueDate ? describeLatePolicy(allowLate, latePenalty) : null;

  if (submission && !editMode) {
    const isGraded = submission.status === 'graded';
    const version = submission.version ?? 1;
    const remaining = resubmissionsRemaining(resubmission, submission.resubmissionsUsed ?? 0);
    return (
      <View style={styles.stack}>
        {rubricBeforeHandIn}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <StatusPill label={isGraded ? 'Graded' : 'Submitted'} tone="success" icon={isGraded ? <Award size={13} color={colors.successText} /> : <CheckCircle2 size={13} color={colors.successText} />} />
            {version > 1 ? <StatusPill label={`Version ${version}`} tone="info" /> : null}
            {submission.isLate ? <StatusPill label={`Late · ${submission.lateDays ?? 1} ${submission.lateDays === 1 ? 'day' : 'days'}`} tone="warning" icon={<Clock size={13} color={colors.warningText} />} /> : null}
          </View>
          <Text style={styles.statusTitle}>Your submission</Text>
          {submission.submittedAt ? <Text style={styles.muted}>Handed in {new Date(submission.submittedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text> : null}
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
          {isGraded && submission.score !== undefined ? (
            <GradeBreakdown score={submission.score} maxScore={submission.maxScore} rawScore={submission.rawScore} latePenalty={submission.latePenalty} feedback={submission.feedback} />
          ) : null}
          {!isGraded ? <Text style={styles.muted}>Your instructor will grade it. Grades appear here and under Grades once published.</Text> : null}
          {submission.textResponse ? <Text style={styles.body}>{submission.textResponse}</Text> : null}
          {submission.files.map((file, index) => (
            <Pressable key={file.url} accessibilityRole="link" accessibilityLabel={`Open ${file.name}`} android_ripple={RIPPLE} onPress={() => void openCourseFile({ kind: 'submission_file', submissionId: submission.id, index }, file.url).then((opened) => setOpenError(!opened))} style={styles.fileRow}>
              <FileText size={18} color={colors.accentText} />
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              {file.size ? <Text style={styles.muted}>{formatSize(file.size)}</Text> : null}
            </Pressable>
          ))}
          {openError ? <Text style={styles.error}>This file could not be opened on this device.</Text> : null}

          {!isGraded ? (
            handIn.allowed
              ? <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => startEditing('replace')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Change submission</Text></Pressable>
              : <Text style={styles.muted}>{handIn.reason}</Text>
          ) : null}
          {isGraded && resubmit.allowed ? (
            <Pressable accessibilityRole="button" accessibilityHint={`${remaining} ${remaining === 1 ? 'resubmission' : 'resubmissions'} left`} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} onPress={() => startEditing('resubmit')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Hand in a new version ({remaining} left)</Text>
            </Pressable>
          ) : null}
          {isGraded && !resubmit.allowed && resubmission.allowed && resubmit.reason ? <Text style={styles.muted}>{resubmit.reason}</Text> : null}
          {review.allowed ? (
            <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => setIsReviewSheetOpen(true)} style={styles.secondaryButton}>
              <MessageSquareWarning size={16} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Ask for a review of this grade</Text>
            </Pressable>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {isGraded && submission.rubricScores && submission.rubricScores.length > 0 ? <RubricView rubric={lesson.rubric} scores={submission.rubricScores} /> : null}

        {submission.appealStatus ? (
          <View style={[styles.card, submission.appealStatus === 'open' && { borderColor: colors.warningText }]}>
            <View style={styles.statusRow}>
              <MessageSquareWarning size={18} color={submission.appealStatus === 'open' ? colors.warningText : colors.text} />
              <Text style={styles.statusTitle}>{APPEAL_STATUS_LABELS[submission.appealStatus]}</Text>
            </View>
            {isHistoryLoading && !currentAppeal ? <ActivityIndicator color={colors.accent} /> : null}
            {currentAppeal?.reason ? <Text style={styles.muted}>Your reason: {currentAppeal.reason}</Text> : null}
            {submission.appealStatus === 'open' ? <Text style={styles.body}>Your instructor will keep or change the grade and explain why. You cannot hand in a new version while the request is open.</Text> : null}
            {currentAppeal?.responseNote ? <Text style={styles.body}>{currentAppeal.status === 'adjusted' ? 'Changed' : 'Kept'}: {currentAppeal.responseNote}</Text> : null}
            {submission.appealStatus === 'open' && currentAppeal ? (
              <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => setIsWithdrawOpen(true)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Withdraw request</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {isGraded || (submission.version ?? 1) > 1 ? (
          <View style={styles.card}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: isHistoryOpen }} android_ripple={RIPPLE} onPress={toggleHistory} style={styles.historyToggle}>
              <History size={18} color={colors.text} />
              <Text style={styles.statusTitle}>Versions and grade history</Text>
              <Text style={styles.link}>{isHistoryOpen ? 'Hide' : 'Show'}</Text>
            </Pressable>
            {isHistoryOpen ? (isHistoryLoading && !history ? <ActivityIndicator color={colors.accent} /> : history ? <SubmissionHistoryList history={history} currentVersion={submission.version} onOpenError={() => setOpenError(true)} /> : <Text style={styles.muted}>The history could not load.</Text>) : null}
          </View>
        ) : null}

        <ReviewRequestSheet visible={isReviewSheetOpen} submissionId={submission.id} assignmentTitle={lesson.title} onClose={() => setIsReviewSheetOpen(false)} onRequested={() => void load()} />
        <CustomModal
          visible={isWithdrawOpen}
          type="warning"
          title="Withdraw your review request?"
          message="Your grade stays as it is and you cannot ask for a review of this version again."
          confirmText="Withdraw"
          cancelText="Keep request"
          isLoading={isWithdrawing}
          onConfirm={() => void handleWithdraw()}
          onClose={() => { if (!isWithdrawing) setIsWithdrawOpen(false); }}
        />
      </View>
    );
  }

  // No submission yet (or changing one): the due date and late policy decide whether the server accepts it.
  const formAllowed = editMode === 'resubmit' ? resubmit.allowed : handIn.allowed;
  if (!formAllowed) {
    return (
      <View style={styles.stack}>
        {rubricBeforeHandIn}
        <View style={[styles.card, { borderColor: colors.destructiveText }]}>
          <View style={styles.statusRow}>
            <AlertCircle size={18} color={colors.destructiveText} />
            <Text style={styles.statusTitle}>Hand-ins are closed</Text>
          </View>
          <Text style={styles.body}>{(editMode === 'resubmit' ? resubmit.reason : handIn.reason) || 'This assignment is not accepting work right now.'}</Text>
          {submission ? <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => void load()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Back to my submission</Text></Pressable> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {rubricBeforeHandIn}
      <View style={styles.card}>
        <Text style={styles.heading}>{editMode === 'resubmit' ? `Version ${(submission?.version ?? 1) + 1}` : editMode === 'replace' ? 'Change your submission' : 'Your submission'}</Text>
        {editMode === 'resubmit' ? <Text style={styles.muted}>Your graded version and its feedback stay in your history. This new version is graded separately.</Text> : null}
        {editMode === 'replace' ? <Text style={styles.muted}>Saving replaces what you handed in. Keep or remove the files below.</Text> : null}
        {isPastDue && editMode !== 'resubmit' && policyLine ? (
          <View style={styles.warning}><Clock size={16} color={colors.warningText} /><Text style={styles.warningText}>The due date has passed. {policyLine}</Text></View>
        ) : null}
        <TextInput
          accessibilityLabel="Your response"
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
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} style={styles.removeButton} onPress={() => setKeptFiles((current) => current.filter((item) => item.url !== file.url))}><X size={18} color={colors.mutedText} /></Pressable>
          </View>
        ))}
        {newFiles.map((file, index) => (
          <View key={`${file.uri}-${index}`} style={styles.fileRow}>
            <Paperclip size={18} color={colors.accentText} />
            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
            {file.size ? <Text style={styles.muted}>{formatSize(file.size)}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} style={styles.removeButton} onPress={() => setNewFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={18} color={colors.mutedText} /></Pressable>
          </View>
        ))}
        {keptFiles.length + newFiles.length < MAX_FILES ? (
          <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => void handleAddFile()} style={styles.secondaryButton}>
            <Paperclip size={16} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Attach files</Text>
          </Pressable>
        ) : null}
        <Text style={styles.muted}>Documents, images, audio, text or zip files up to 20 MB each.</Text>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          {submission ? (
            <Pressable accessibilityRole="button" disabled={isSubmitting} android_ripple={RIPPLE} onPress={() => { setEditMode(null); setError(null); }} style={[styles.secondaryButton, styles.flex]}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }} disabled={isSubmitting} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} onPress={() => void handleSubmit()} style={[styles.primaryButton, styles.flex, isSubmitting && styles.disabled]}>
            <Text style={styles.primaryButtonText}>{isSubmitting ? 'Submitting…' : editMode === 'resubmit' ? 'Hand in new version' : editMode === 'replace' ? 'Save changes' : 'Submit assignment'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  stack: { gap: 12 },
  card: { padding: 16, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  heading: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  removeButton: { width: 44, height: 44, marginRight: -12, alignItems: 'center', justifyContent: 'center' },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  notice: { color: colors.successText, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 140, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15, textAlignVertical: 'top' },
  fileRow: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  fileName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  link: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  error: { color: colors.destructiveText, fontSize: 13 },
  warning: { padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, backgroundColor: colors.warningSurface },
  warningText: { flex: 1, color: colors.warningText, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  historyToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  primaryButton: { minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
