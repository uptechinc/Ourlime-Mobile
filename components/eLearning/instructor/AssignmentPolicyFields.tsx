import { View } from 'react-native';
import DateTimeField from '@/components/ui/DateTimeField';
import { FormField, Segmented, ToggleRow } from '@/components/eLearning/instructor/InstructorForm';
import { describeLatePolicy, MAX_RESUBMISSIONS } from '@/lib/services/AssignmentPolicy';
import type { LatePenaltyPolicy } from '@/lib/types/course';
import type { AssignmentPolicyDraft } from '@/lib/types/instructor';

type AssignmentPolicyFieldsProps = {
  draft: AssignmentPolicyDraft;
  onChange: (draft: AssignmentPolicyDraft) => void;
};

const PENALTY_OPTIONS: readonly { value: LatePenaltyPolicy['type']; label: string }[] = [
  { value: 'none', label: 'No penalty' },
  { value: 'percent', label: 'Fixed %' },
  { value: 'percent_per_day', label: '% per day' },
];

const digits = (value: string): string => value.replace(/[^0-9]/g, '');

/** The penalty the draft describes, for the live sentence under the fields (numbers that do not parse count as 0). */
function previewPolicy(draft: AssignmentPolicyDraft): LatePenaltyPolicy {
  const percent = Number(draft.penaltyPercent) || 0;
  if (draft.penaltyType === 'none' || percent <= 0) return { type: 'none', percent: 0, maxPercent: 0 };
  return { type: draft.penaltyType, percent, maxPercent: draft.penaltyType === 'percent' ? percent : Number(draft.penaltyMaxPercent) || 100 };
}

/**
 * Late work (accepted or not, and an optional penalty the server applies when grading) and resubmissions (allowed,
 * how many, until when). The sentence under the late fields is exactly what learners read.
 */
export default function AssignmentPolicyFields({ draft, onChange }: AssignmentPolicyFieldsProps) {
  const update = (change: Partial<AssignmentPolicyDraft>) => onChange({ ...draft, ...change });
  return (
    <View style={{ gap: 14 }}>
      <ToggleRow
        label="Accept late work"
        description={describeLatePolicy(draft.allowLateSubmission, previewPolicy(draft))}
        value={draft.allowLateSubmission}
        onChange={(allowLateSubmission) => update({ allowLateSubmission })}
      />
      {draft.allowLateSubmission ? (
        <>
          <Segmented label="Late penalty" options={PENALTY_OPTIONS} value={draft.penaltyType} onChange={(penaltyType) => update({ penaltyType })} hint="Taken off the points earned when you grade; you can waive it for a learner." />
          {draft.penaltyType !== 'none' ? (
            <FormField label={draft.penaltyType === 'percent' ? 'Penalty (%)' : 'Penalty per day late (%)'} required value={draft.penaltyPercent} onChange={(penaltyPercent) => update({ penaltyPercent: digits(penaltyPercent) })} keyboardType="number-pad" maxLength={3} />
          ) : null}
          {draft.penaltyType === 'percent_per_day' ? (
            <FormField label="Largest penalty (%)" required value={draft.penaltyMaxPercent} onChange={(penaltyMaxPercent) => update({ penaltyMaxPercent: digits(penaltyMaxPercent) })} keyboardType="number-pad" maxLength={3} hint="The penalty stops growing here." />
          ) : null}
        </>
      ) : null}
      <ToggleRow
        label="Allow resubmissions"
        description={draft.resubmissionAllowed ? 'After you publish a grade, learners can hand in a new version. Every version and grade is kept.' : 'A grade is final once published (learners can still ask for a review).'}
        value={draft.resubmissionAllowed}
        onChange={(resubmissionAllowed) => update({ resubmissionAllowed })}
      />
      {draft.resubmissionAllowed ? (
        <>
          <FormField label="Resubmissions allowed" required value={draft.maxResubmissions} onChange={(maxResubmissions) => update({ maxResubmissions: digits(maxResubmissions) })} keyboardType="number-pad" maxLength={2} hint={`From 1 to ${MAX_RESUBMISSIONS}.`} />
          <DateTimeField label="Resubmit until" mode="datetime" value={draft.resubmissionUntil} onChange={(resubmissionUntil) => update({ resubmissionUntil })} onClear={() => update({ resubmissionUntil: null })} placeholder="No deadline" minimumDate={new Date()} />
        </>
      ) : null}
    </View>
  );
}
