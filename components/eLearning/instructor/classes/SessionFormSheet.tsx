import { useEffect, useRef, useState } from 'react';
import ScheduleSheet from '@/components/eLearning/schedule/ScheduleSheet';
import DateTimeField from '@/components/ui/DateTimeField';
import { ELearningButton } from '@/components/eLearning/ELearningParts';
import { ChoiceChips, ErrorList, FieldMessage, FormField, Segmented } from '@/components/eLearning/instructor/InstructorForm';
import { joinUrlProblem, newOperationId } from '@/lib/services/AssignmentPolicy';
import { serverMessage, teachingWorkflowService } from '@/lib/services/TeachingWorkflowService';
import type { CourseCohort, CourseSession, SessionKind, SessionRecording } from '@/lib/types/course';

type SessionFormSheetProps = {
  visible: boolean;
  courseId: string;
  cohorts: CourseCohort[];
  /** The session being edited, or null to schedule one. */
  session: CourseSession | null;
  onClose: () => void;
  onSaved: () => void;
  /** false for an assistant: sessions only for the classes passed in `cohorts`, never the whole course. */
  allowWholeCourse?: boolean;
};

const KINDS: readonly { value: SessionKind; label: string }[] = [
  { value: 'live_class', label: 'Live class' }, { value: 'office_hours', label: 'Office hours' }, { value: 'deadline', label: 'Deadline' },
];
const RECORDING: readonly { value: SessionRecording; label: string }[] = [{ value: 'not_recorded', label: 'Not recorded' }, { value: 'recorded', label: 'Recorded' }];
const WHOLE_COURSE = 'Whole course';
const MAX_LENGTH_MS = 24 * 60 * 60 * 1000;

/**
 * Schedule or edit a session for the whole course or one class. Live classes and office hours take an external https
 * meeting link (Ourlime hosts no video); a recorded session must say what is recorded and who can watch it.
 */
export default function SessionFormSheet({ visible, courseId, cohorts, session, onClose, onSaved, allowWholeCourse = true }: SessionFormSheetProps) {
  const [kind, setKind] = useState<SessionKind>('live_class');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cohortName, setCohortName] = useState(WHOLE_COURSE);
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [joinUrl, setJoinUrl] = useState('');
  const [recording, setRecording] = useState<SessionRecording>('not_recorded');
  const [recordingNote, setRecordingNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const operationRef = useRef(newOperationId('session'));
  const activeCohorts = cohorts.filter((cohort) => cohort.status === 'active' || cohort.id === session?.cohortId);

  useEffect(() => {
    if (!visible) return;
    operationRef.current = newOperationId('session');
    setKind(session?.kind ?? 'live_class');
    setTitle(session?.title ?? '');
    setDescription(session?.description ?? '');
    // An assistant schedules only for the classes they assist (no whole-course option): their first class by default.
    const fallbackName = allowWholeCourse ? WHOLE_COURSE : cohorts.find((cohort) => cohort.status === 'active')?.name ?? '';
    setCohortName(session?.cohortId ? cohorts.find((cohort) => cohort.id === session.cohortId)?.name ?? fallbackName : fallbackName);
    setStartsAt(session?.startsAt ? new Date(session.startsAt) : null);
    setEndsAt(session?.endsAt ? new Date(session.endsAt) : null);
    setJoinUrl(session?.joinUrl ?? '');
    setRecording(session?.recording ?? 'not_recorded');
    setRecordingNote(session?.recordingNote ?? '');
    setErrors([]);
    setSaveError(null);
  }, [allowWholeCourse, cohorts, session, visible]);

  const handleSave = async () => {
    const found: string[] = [];
    if (!title.trim()) found.push('Give the session a title.');
    if (!startsAt) found.push('Choose when it starts.');
    if (!allowWholeCourse && !activeCohorts.some((cohort) => cohort.name === cohortName)) found.push('Choose one of your classes.');
    if (startsAt && endsAt && (endsAt < startsAt || endsAt.getTime() - startsAt.getTime() > MAX_LENGTH_MS)) found.push('A session ends after it starts and lasts at most 24 hours.');
    const urlProblem = kind === 'deadline' ? null : joinUrlProblem(joinUrl);
    if (urlProblem) found.push(urlProblem);
    if (kind !== 'deadline' && recording === 'recorded' && !recordingNote.trim()) found.push('Say what will be recorded and who can watch the recording.');
    setErrors(found);
    if (found.length > 0 || !startsAt) return;
    const cohortId = cohortName === WHOLE_COURSE ? '' : activeCohorts.find((cohort) => cohort.name === cohortName)?.id ?? '';
    setIsSaving(true);
    setSaveError(null);
    try {
      await teachingWorkflowService.saveSession(courseId, { cohortId, kind, title, description, startsAt, endsAt, joinUrl, recording, recordingNote }, session?.id, operationRef.current);
      onSaved();
      onClose();
    } catch (error: unknown) {
      console.error('[SessionFormSheet.handleSave] Error:', error instanceof Error ? error.message : 'Unknown error');
      setSaveError(serverMessage(error, 'The session could not be saved. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScheduleSheet
      visible={visible}
      title={session ? 'Edit session' : 'Schedule a session'}
      description="Learners see it under Upcoming on the course home, in their own time zone."
      onClose={() => { if (!isSaving) onClose(); }}
      footer={<>
        <ELearningButton label="Cancel" variant="secondary" isDisabled={isSaving} onPress={onClose} />
        <ELearningButton label={session ? 'Save session' : 'Schedule'} busyLabel="Saving…" isBusy={isSaving} onPress={() => void handleSave()} />
      </>}
    >
      <ErrorList errors={errors} title="Fix these to save" />
      <Segmented label="Type" options={KINDS} value={kind} onChange={setKind} />
      <FormField label="Title" required value={title} onChange={setTitle} placeholder={kind === 'deadline' ? 'e.g. Project proposal due' : 'e.g. Week 3 live class'} maxLength={200} />
      <FormField label="Description" value={description} onChange={setDescription} multiline maxLength={2000} />
      <ChoiceChips label="For" options={[...(allowWholeCourse ? [WHOLE_COURSE] : []), ...activeCohorts.map((cohort) => cohort.name)]} selected={[cohortName]} onToggle={setCohortName} single hint="A class's session is shown only to that class." />
      <DateTimeField label={kind === 'deadline' ? 'Due' : 'Starts'} mode="datetime" required value={startsAt} onChange={setStartsAt} placeholder="Choose the date and time" />
      {kind !== 'deadline' ? <DateTimeField label="Ends" mode="datetime" value={endsAt} onChange={setEndsAt} onClear={() => setEndsAt(null)} placeholder="No end time" minimumDate={startsAt ?? undefined} /> : null}
      {kind !== 'deadline' ? (
        <>
          <FormField label="Join link" value={joinUrl} onChange={setJoinUrl} placeholder="https://…" autoCapitalize="none" keyboardType="url" maxLength={500} hint="A meeting link from any video service (Ourlime does not host calls). Only enrolled learners and staff see it." />
          <Segmented label="Recording" options={RECORDING} value={recording} onChange={setRecording} hint="Recording is never assumed. If you record, say so here so learners know before they join." />
          {recording === 'recorded' ? <FormField label="Recording note" required value={recordingNote} onChange={setRecordingNote} multiline maxLength={500} placeholder="What is recorded, who can watch it and for how long" /> : null}
        </>
      ) : null}
      <FieldMessage error={saveError ?? undefined} />
    </ScheduleSheet>
  );
}
