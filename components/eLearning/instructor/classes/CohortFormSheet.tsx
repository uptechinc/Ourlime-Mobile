import { useEffect, useRef, useState } from 'react';
import ScheduleSheet from '@/components/eLearning/schedule/ScheduleSheet';
import DateTimeField from '@/components/ui/DateTimeField';
import { ELearningButton } from '@/components/eLearning/ELearningParts';
import { ErrorList, FieldMessage, FormField } from '@/components/eLearning/instructor/InstructorForm';
import { newOperationId } from '@/lib/services/AssignmentPolicy';
import { serverMessage, teachingWorkflowService } from '@/lib/services/TeachingWorkflowService';
import type { CourseCohort } from '@/lib/types/course';

type CohortFormSheetProps = {
  visible: boolean;
  courseId: string;
  /** The class being edited, or null to create one. */
  cohort: CourseCohort | null;
  onClose: () => void;
  onSaved: (cohort: CourseCohort) => void;
};

const toDate = (iso: string | null): Date | null => (iso ? new Date(iso) : null);

/** Create or edit a class: name, description, dates, capacity and the window in which learners can join it. */
export default function CohortFormSheet({ visible, courseId, cohort, onClose, onSaved }: CohortFormSheetProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [capacity, setCapacity] = useState('');
  const [opensAt, setOpensAt] = useState<Date | null>(null);
  const [closesAt, setClosesAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // One operation id per new class, so a retry after a lost connection returns the same class instead of a second one.
  const operationRef = useRef(newOperationId('cohort'));

  useEffect(() => {
    if (!visible) return;
    operationRef.current = newOperationId('cohort');
    setName(cohort?.name ?? '');
    setDescription(cohort?.description ?? '');
    setStartsAt(toDate(cohort?.startsAt ?? null));
    setEndsAt(toDate(cohort?.endsAt ?? null));
    setCapacity(cohort?.capacity ? String(cohort.capacity) : '');
    setOpensAt(toDate(cohort?.enrollmentOpensAt ?? null));
    setClosesAt(toDate(cohort?.enrollmentClosesAt ?? null));
    setErrors([]);
    setSaveError(null);
  }, [cohort, visible]);

  const handleSave = async () => {
    const found: string[] = [];
    if (!name.trim()) found.push('Name the class.');
    const capacityValue = capacity.trim() ? Number(capacity) : null;
    if (capacityValue !== null && (!Number.isInteger(capacityValue) || capacityValue < 1 || capacityValue > 10000)) found.push('Capacity must be a whole number from 1 to 10000, or empty for no limit.');
    if (cohort && capacityValue !== null && capacityValue < cohort.memberCount) found.push(`This class already has ${cohort.memberCount} learners; set a capacity of at least ${cohort.memberCount}.`);
    if (startsAt && endsAt && endsAt < startsAt) found.push('The class cannot end before it starts.');
    if (opensAt && closesAt && closesAt < opensAt) found.push('Enrollment cannot close before it opens.');
    setErrors(found);
    if (found.length > 0) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await teachingWorkflowService.saveCohort(courseId, {
        name, description, startsAt, endsAt, capacity: capacityValue, enrollmentOpensAt: opensAt, enrollmentClosesAt: closesAt,
      }, cohort?.id, operationRef.current);
      onSaved(saved);
      onClose();
    } catch (error: unknown) {
      console.error('[CohortFormSheet.handleSave] Error:', error instanceof Error ? error.message : 'Unknown error');
      setSaveError(serverMessage(error, 'The class could not be saved. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScheduleSheet
      visible={visible}
      title={cohort ? 'Edit class' : 'New class'}
      description="A class groups learners with dates, a capacity and assistants. Learners who are not in a class keep studying at their own pace."
      onClose={() => { if (!isSaving) onClose(); }}
      footer={<>
        <ELearningButton label="Cancel" variant="secondary" isDisabled={isSaving} onPress={onClose} />
        <ELearningButton label={cohort ? 'Save class' : 'Create class'} busyLabel="Saving…" isBusy={isSaving} onPress={() => void handleSave()} />
      </>}
    >
      <ErrorList errors={errors} title="Fix these to save" />
      <FormField label="Class name" required value={name} onChange={setName} placeholder="e.g. January evening class" maxLength={120} />
      <FormField label="Description" value={description} onChange={setDescription} multiline placeholder="Who it is for, how often it meets" maxLength={1000} />
      <DateTimeField label="Starts" mode="date" value={startsAt} onChange={setStartsAt} onClear={() => setStartsAt(null)} placeholder="No start date" />
      <DateTimeField label="Ends" mode="date" value={endsAt} onChange={setEndsAt} onClear={() => setEndsAt(null)} placeholder="No end date" />
      <FormField label="Capacity" value={capacity} onChange={(value) => setCapacity(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={5} hint="Leave empty for no limit." />
      <DateTimeField label="Enrollment opens" mode="datetime" value={opensAt} onChange={setOpensAt} onClear={() => setOpensAt(null)} placeholder="Open now" />
      <DateTimeField label="Enrollment closes" mode="datetime" value={closesAt} onChange={setClosesAt} onClear={() => setClosesAt(null)} placeholder="No closing date" />
      <FieldMessage error={saveError ?? undefined} />
    </ScheduleSheet>
  );
}
