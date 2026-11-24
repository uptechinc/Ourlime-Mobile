import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScheduleSheet from '@/components/eLearning/schedule/ScheduleSheet';
import DateTimeField from '@/components/ui/DateTimeField';
import { ELearningButton } from '@/components/eLearning/ELearningParts';
import { ErrorList, FieldMessage, FormField } from '@/components/eLearning/instructor/InstructorForm';
import AssignmentPolicyFields from '@/components/eLearning/instructor/AssignmentPolicyFields';
import RubricEditor from '@/components/eLearning/instructor/RubricEditor';
import { buildPolicyInput, buildRubricInput, NO_LATE_PENALTY, NO_RESUBMISSION, policyDraftFrom, rubricToDraft } from '@/lib/services/AssignmentPolicy';
import { serverMessage, teachingWorkflowService } from '@/lib/services/TeachingWorkflowService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { AssignmentPolicyDraft, InstructorLesson, RubricCriterionDraft } from '@/lib/types/instructor';

type AssignmentSettingsSheetProps = {
  lesson: InstructorLesson | null;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Change an existing assignment's due date, late policy, resubmissions and rubric (update_assignment_settings; the
 * course's instructor only). Grades already published keep the rubric and penalty they were given.
 */
export default function AssignmentSettingsSheet({ lesson, onClose, onSaved }: AssignmentSettingsSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [policy, setPolicy] = useState<AssignmentPolicyDraft>(() => policyDraftFrom(false, NO_LATE_PENALTY, NO_RESUBMISSION));
  const [rubric, setRubric] = useState<RubricCriterionDraft[]>([]);
  const [points, setPoints] = useState('100');
  const [errors, setErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!lesson) return;
    setDueDate(lesson.dueDate ? new Date(lesson.dueDate) : null);
    setPolicy(policyDraftFrom(lesson.allowLateSubmission === true, lesson.latePenalty ?? NO_LATE_PENALTY, lesson.resubmission ?? NO_RESUBMISSION));
    setRubric(rubricToDraft(lesson.rubric));
    setPoints(String(lesson.points ?? 100));
    setErrors([]);
    setSaveError(null);
  }, [lesson]);

  const handleSave = async () => {
    if (!lesson) return;
    const rubricInput = buildRubricInput(rubric);
    const policyInput = buildPolicyInput(policy);
    const pointValue = Number(points);
    const found = [...policyInput.errors, ...rubricInput.errors];
    if (!rubricInput.rubric && (!Number.isInteger(pointValue) || pointValue < 1 || pointValue > 10000)) found.push('Points must be a whole number from 1 to 10000.');
    setErrors(found);
    if (found.length > 0) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await teachingWorkflowService.updateAssignmentSettings(lesson.id, {
        ...(dueDate ? { dueDate: dueDate.toISOString() } : {}),
        allowLateSubmission: policy.allowLateSubmission, latePenalty: policyInput.latePenalty, resubmission: policyInput.resubmission,
        rubric: rubricInput.rubric, ...(rubricInput.rubric ? {} : { points: pointValue }),
      });
      onSaved();
      onClose();
    } catch (error: unknown) {
      console.error('[AssignmentSettingsSheet.handleSave] Error:', error instanceof Error ? error.message : 'Unknown error');
      setSaveError(serverMessage(error, 'The settings could not be saved. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScheduleSheet
      visible={lesson !== null}
      title="Assignment settings"
      description={lesson?.title}
      onClose={() => { if (!isSaving) onClose(); }}
      footer={<>
        <ELearningButton label="Cancel" variant="secondary" isDisabled={isSaving} onPress={onClose} />
        <ELearningButton label="Save settings" busyLabel="Saving…" isBusy={isSaving} onPress={() => void handleSave()} />
      </>}
    >
      <ErrorList errors={errors} title="Fix these to save" />
      <DateTimeField label="Due date" mode="datetime" value={dueDate} onChange={setDueDate} placeholder="Choose the due date and time" />
      <AssignmentPolicyFields draft={policy} onChange={setPolicy} />
      <View style={styles.section}>
        <Text style={styles.heading}>Rubric</Text>
        <Text style={styles.hint}>Changes apply to grading from now on. Published grades keep the rubric they were graded with.</Text>
        <RubricEditor criteria={rubric} onChange={setRubric} />
      </View>
      {rubric.length === 0 ? <FormField label="Points" required value={points} onChange={(value) => setPoints(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={5} /> : null}
      <FieldMessage error={saveError ?? undefined} />
    </ScheduleSheet>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  section: { gap: 8 },
  heading: { color: colors.text, fontSize: 15, fontWeight: '800' },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
});
