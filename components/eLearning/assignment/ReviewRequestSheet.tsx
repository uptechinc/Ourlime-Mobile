import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2, MessageSquareWarning } from 'lucide-react-native';
import ScheduleSheet from '@/components/eLearning/schedule/ScheduleSheet';
import { ELearningButton } from '@/components/eLearning/ELearningParts';
import { FieldMessage } from '@/components/eLearning/instructor/InstructorForm';
import { APPEAL_REASON_MAX } from '@/lib/services/AssignmentPolicy';
import { courseService } from '@/lib/services/CourseService';
import { serverMessage } from '@/lib/services/TeachingWorkflowService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

type ReviewRequestSheetProps = {
  visible: boolean;
  submissionId: string;
  assignmentTitle: string;
  onClose: () => void;
  /** Called once the request is recorded, so the screen can show its status. */
  onRequested: () => void;
};

type Stage = 'idle' | 'sending' | 'done';

/**
 * Ask for a review of a published grade, in three stages: write the reason, sending, done. The instructor (or the
 * class's assistant) answers by keeping or changing the grade with a note; the learner sees the outcome on the assignment.
 */
export default function ReviewRequestSheet({ visible, submissionId, assignmentTitle, onClose, onRequested }: ReviewRequestSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stage, setStage] = useState<Stage>('idle');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setStage('idle'); setError(null); }
  }, [visible]);

  const handleSend = async () => {
    if (!reason.trim()) { setError('Say what you would like reviewed and why.'); return; }
    setStage('sending');
    setError(null);
    try {
      await courseService.requestGradeReview(submissionId, reason);
      setStage('done');
      setReason('');
      onRequested();
    } catch (sendError: unknown) {
      console.error('[ReviewRequestSheet.handleSend] Error:', sendError instanceof Error ? sendError.message : 'Unknown error');
      setError(serverMessage(sendError, 'Your request could not be sent. Check your connection and try again.'));
      setStage('idle');
    }
  };

  const close = () => { if (stage !== 'sending') onClose(); };

  return (
    <ScheduleSheet
      visible={visible}
      title={stage === 'done' ? 'Review requested' : 'Ask for a review'}
      description={stage === 'idle' ? `of your grade for ${assignmentTitle}` : undefined}
      onClose={close}
      footer={stage === 'idle' ? (
        <>
          <ELearningButton label="Cancel" variant="secondary" onPress={close} />
          <ELearningButton label="Send request" onPress={() => void handleSend()} isDisabled={!reason.trim()} />
        </>
      ) : stage === 'done' ? <ELearningButton label="Close" onPress={onClose} /> : null}
    >
      {stage === 'idle' ? (
        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: colors.warningSurface }]}><MessageSquareWarning size={22} color={colors.warningText} /></View>
            <Text style={styles.copy}>Explain what you think was missed or scored wrongly. You can ask once per graded version; your instructor keeps or changes the grade and tells you why.</Text>
          </View>
          <TextInput
            accessibilityLabel="Reason for the review"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={APPEAL_REASON_MAX}
            placeholder="e.g. My second source is cited on page 2, but the rubric says sources are missing."
            placeholderTextColor={colors.mutedText}
            style={styles.input}
          />
          <FieldMessage error={error ?? undefined} hint={`${reason.trim().length}/${APPEAL_REASON_MAX}`} />
        </View>
      ) : stage === 'sending' ? (
        <View accessibilityLiveRegion="polite" style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.stageTitle}>Sending your request…</Text>
          <Text style={styles.copy}>Please wait while we record it.</Text>
        </View>
      ) : (
        <View accessibilityLiveRegion="polite" style={styles.center}>
          <View style={[styles.badge, styles.successBadge]}><CheckCircle2 size={30} color="#10b981" /></View>
          <Text style={styles.stageTitle}>Done, your request was sent</Text>
          <Text style={styles.copy}>You will see the answer on this assignment. While it is open you can withdraw it, but you cannot hand in a new version.</Text>
        </View>
      )}
    </ScheduleSheet>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  body: { gap: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  successBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successSurface },
  copy: { flex: 1, color: colors.secondaryText, fontSize: 14, lineHeight: 20, textAlign: 'left' },
  input: { minHeight: 130, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15, textAlignVertical: 'top' },
  center: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  stageTitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
});
