import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import ScheduleSheet from '@/components/eLearning/schedule/ScheduleSheet';
import { ELearningButton } from '@/components/eLearning/ELearningParts';
import { FieldMessage, Segmented } from '@/components/eLearning/instructor/InstructorForm';
import GradeEntryFields, { gradeEntryFrom, readGradeEntry, type GradeEntry } from '@/components/eLearning/instructor/GradeEntryFields';
import { APPEAL_NOTE_MAX } from '@/lib/services/AssignmentPolicy';
import { serverMessage, teachingWorkflowService } from '@/lib/services/TeachingWorkflowService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { GradeAppeal } from '@/lib/types/course';
import type { InstructorLesson, InstructorSubmission } from '@/lib/types/instructor';

type ReviewResponseSheetProps = {
  appeal: GradeAppeal | null;
  lesson: InstructorLesson | undefined;
  submission: InstructorSubmission | undefined;
  onClose: () => void;
  onAnswered: () => void;
};

type Stage = 'idle' | 'sending' | 'done';
type Decision = 'uphold' | 'adjust';
const DECISIONS: readonly { value: Decision; label: string }[] = [{ value: 'uphold', label: 'Keep the grade' }, { value: 'adjust', label: 'Change the grade' }];

/**
 * Answer a learner's review request: keep the grade or change it (scored like any grade), always with a note the learner
 * reads. Three stages: decide, sending, done. Every answer is kept in the grade history and the audit log.
 */
export default function ReviewResponseSheet({ appeal, lesson, submission, onClose, onAnswered }: ReviewResponseSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stage, setStage] = useState<Stage>('idle');
  const [decision, setDecision] = useState<Decision>('uphold');
  const [note, setNote] = useState('');
  const [entry, setEntry] = useState<GradeEntry>({ score: '', rubric: { levels: {}, feedback: {} }, waive: false });
  const [error, setError] = useState<string | null>(null);
  const maximum = lesson?.rubric?.totalPoints ?? submission?.maxScore ?? appeal?.maxScore ?? 100;

  useEffect(() => {
    if (!appeal) return;
    setStage('idle');
    setDecision('uphold');
    setNote('');
    setError(null);
    setEntry(submission ? gradeEntryFrom(submission) : { score: String(appeal.originalScore), rubric: { levels: {}, feedback: {} }, waive: false });
  }, [appeal, submission]);

  const handleSend = async () => {
    if (!appeal) return;
    if (!note.trim()) { setError('Write a note explaining your decision; the learner reads it.'); return; }
    const grade = decision === 'adjust' ? readGradeEntry(entry, lesson, maximum) : null;
    if (grade && !grade.ok) { setError(grade.error); return; }
    setStage('sending');
    setError(null);
    try {
      await teachingWorkflowService.respondToReview({
        appealId: appeal.id, decision, note, waiveLatePenalty: entry.waive,
        ...(grade && grade.ok ? (grade.rubricScores ? { rubricScores: grade.rubricScores } : { score: grade.score }) : {}),
      });
      setStage('done');
      onAnswered();
    } catch (sendError: unknown) {
      console.error('[ReviewResponseSheet.handleSend] Error:', sendError instanceof Error ? sendError.message : 'Unknown error');
      setError(serverMessage(sendError, 'Your answer could not be saved. Please try again.'));
      setStage('idle');
    }
  };

  const close = () => { if (stage !== 'sending') onClose(); };

  return (
    <ScheduleSheet
      visible={appeal !== null}
      title={stage === 'done' ? 'Answer sent' : 'Review request'}
      description={appeal && stage === 'idle' ? `${appeal.studentName} · ${appeal.lessonTitle || 'Assignment'} · version ${appeal.version}` : undefined}
      onClose={close}
      footer={stage === 'idle' ? (
        <>
          <ELearningButton label="Cancel" variant="secondary" onPress={close} />
          <ELearningButton label={decision === 'adjust' ? 'Change grade' : 'Keep grade'} onPress={() => void handleSend()} isDisabled={!note.trim()} />
        </>
      ) : stage === 'done' ? <ELearningButton label="Close" onPress={onClose} /> : null}
    >
      {appeal && stage === 'idle' ? (
        <View style={styles.body}>
          <View style={styles.quote}>
            <Text style={styles.label}>Learner's reason</Text>
            <Text selectable style={styles.text}>{appeal.reason}</Text>
            <Text style={styles.muted}>Current grade: {appeal.originalScore} / {appeal.maxScore}</Text>
          </View>
          <Segmented label="Decision" options={DECISIONS} value={decision} onChange={setDecision} />
          {decision === 'adjust' ? (
            <GradeEntryFields lesson={lesson} maximum={maximum} lateDays={submission?.lateDays ?? 0} value={entry} onChange={setEntry} />
          ) : null}
          <View style={styles.field}>
            <Text style={styles.label}>Note to the learner <Text style={styles.required}>*</Text></Text>
            <TextInput accessibilityLabel="Note to the learner" value={note} onChangeText={setNote} multiline maxLength={APPEAL_NOTE_MAX} placeholder="Explain what you checked and why the grade stays or changes." placeholderTextColor={colors.mutedText} style={styles.input} />
          </View>
          <FieldMessage error={error ?? undefined} />
        </View>
      ) : stage === 'sending' ? (
        <View accessibilityLiveRegion="polite" style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.stageTitle}>Saving your answer…</Text>
          <Text style={styles.muted}>Please wait while we record it.</Text>
        </View>
      ) : stage === 'done' ? (
        <View accessibilityLiveRegion="polite" style={styles.center}>
          <View style={styles.successBadge}><CheckCircle2 size={30} color="#10b981" /></View>
          <Text style={styles.stageTitle}>{decision === 'adjust' ? 'Done, the grade was changed' : 'Done, the grade was kept'}</Text>
          <Text style={styles.muted}>The learner sees your note with the outcome on the assignment.</Text>
        </View>
      ) : null}
    </ScheduleSheet>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  body: { gap: 14 },
  quote: { padding: 12, gap: 6, borderRadius: 12, backgroundColor: colors.control },
  field: { gap: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  required: { color: colors.destructiveText },
  text: { color: colors.text, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  input: { minHeight: 110, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15, textAlignVertical: 'top' },
  center: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  stageTitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  successBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface },
});
