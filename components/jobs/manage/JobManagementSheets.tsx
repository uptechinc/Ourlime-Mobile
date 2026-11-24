import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, CalendarClock, Check, History, Plus, RotateCcw, StickyNote, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import CustomModal from '@/components/ui/CustomModal';
import { JOBS_ACTION_GREEN, JOBS_CARD_RADIUS } from '@/components/jobs/JobCardParts';
import { FooterButton, JobSheetHeader } from '@/components/jobs/createJobsModal/JobFormShell';
import { AddRowButton, AgreementCheckbox, ChoicePills, DisclaimerBox, FieldError, FormField, FormSection, RemovableRow, type ChoiceOption } from '@/components/jobs/createJobsModal/JobFormParts';
import DateTimeField from '@/components/ui/DateTimeField';
import { endOfLocalDay } from '@/lib/job/JobRules';
import {
  ANSWER_TYPES, COMPANY_SIZES, COMPLEXITY_OPTIONS, CONTACT_OPTIONS, CURRENCIES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, JOB_POSTER_DISCLAIMER,
  LOCATION_TYPES, PAYMENT_PERIODS, URGENCY_OPTIONS,
} from '@/lib/job/JobFormOptions';
import {
  JOB_MAJOR_CHANGE_LABELS,
  jobManagementService,
  type EmployerNote,
  type InterviewType,
  type JobAuditEntry,
  type ManagedJob,
  type ManagedJobApplication,
  type ManagedJobQuestion,
  type ScheduleInterviewInput,
  type UpdateManagedJobInput,
} from '@/lib/services/JobManagementService';

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const NOTE_MAX_LENGTH = 1200;

type ManagementSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Close or swipe down; the sheet decides whether to confirm first. */
  onRequestClose: () => void;
  isBusy: boolean;
  swipeLabel: string;
  children: ReactNode;
};

/** The full-height, swipe-to-close sheet every management tool uses, with the shared Jobs header. */
function ManagementSheet({ visible, title, subtitle, onRequestClose, isBusy, swipeLabel, children }: ManagementSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={onRequestClose}>
      <SwipeDismissSurface visible={visible} onDismiss={onRequestClose} handleColor={colors.border} disabled={isBusy} accessibilityLabel={swipeLabel} style={styles.safeArea}>
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
          <JobSheetHeader title={title} subtitle={subtitle} onClose={onRequestClose} closeDisabled={isBusy} />
          {children}
        </SafeAreaView>
      </SwipeDismissSurface>
    </Modal>
  );
}

type SheetStateProps = { kind: 'loading' | 'empty' | 'error'; icon?: 'notes' | 'history'; title: string; message?: string; onRetry?: () => void };

/** Loading, empty and error states for the sheets: centred icon, a title, one line of help and an optional retry. */
function SheetState({ kind, icon = 'notes', title, message, onRetry }: SheetStateProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const Icon = icon === 'notes' ? StickyNote : History;
  return (
    <View accessibilityLiveRegion="polite" style={styles.state}>
      {kind === 'loading'
        ? <ActivityIndicator color={JOBS_ACTION_GREEN} />
        : <View style={[styles.stateIcon, kind === 'error' && styles.stateIconError]}>{kind === 'error' ? <AlertTriangle size={26} color={colors.destructiveText} /> : <Icon size={26} color={colors.mutedText} />}</View>}
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={styles.retryButton}>
          <RotateCcw size={16} color={colors.text} />
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type JobManagementNotesSheetProps = {
  application: ManagedJobApplication | null;
  jobId: string;
  onClose: () => void;
};

export function JobManagementNotesSheet({ application, jobId, onClose }: JobManagementNotesSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notes, setNotes] = useState<EmployerNote[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<EmployerNote | null>(null);

  const loadNotes = useCallback(async () => {
    if (!application) return;
    setLoading(true);
    setLoadError('');
    try {
      setNotes(await jobManagementService.listNotes(application.id));
    } catch (loadFailure: unknown) {
      console.error('[JobManagementNotesSheet.loadNotes] Error:', loadFailure);
      setLoadError(loadFailure instanceof Error ? loadFailure.message : 'Notes could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [application]);

  useEffect(() => {
    if (application) void loadNotes();
    else {
      setNotes([]);
      setContent('');
      setError('');
      setLoadError('');
      setNoteToDelete(null);
    }
  }, [application, loadNotes]);

  const handleAdd = async () => {
    if (!application || !content.trim()) return;
    setSaving(true);
    setError('');
    try {
      await jobManagementService.addNote(jobId, application.id, content);
      setContent('');
      await loadNotes();
    } catch (saveError: unknown) {
      console.error('[JobManagementNotesSheet.handleAdd] Error:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'The note could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!application) return;
    setSaving(true);
    setError('');
    try {
      await jobManagementService.deleteNote(jobId, application.id, noteId);
      setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId));
    } catch (deleteError: unknown) {
      console.error('[JobManagementNotesSheet.handleDelete] Error:', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'The note could not be deleted.');
    } finally {
      setSaving(false);
      setNoteToDelete(null);
    }
  };

  const canAdd = !saving && content.trim().length > 0;

  return (
    <ManagementSheet visible={Boolean(application)} title="Private notes" subtitle={application?.applicant.name ?? ''} onRequestClose={onClose} isBusy={saving} swipeLabel="Swipe down to close private notes">
      <KeyboardSafeView style={styles.keyboardArea}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          {loading && notes.length === 0 ? <SheetState kind="loading" title="Loading notes…" />
            : loadError ? <SheetState kind="error" title="Notes didn't load" message={loadError} onRetry={() => void loadNotes()} />
              : notes.length === 0 ? <SheetState kind="empty" icon="notes" title="No notes yet" message="Jot down impressions, calls or next steps for this applicant below." />
                : notes.map((note) => (
                  <View key={note.id} style={styles.noteCard}>
                    <Text style={styles.bodyText}>{note.content}</Text>
                    <View style={styles.cardFooter}>
                      <Text style={styles.timestamp}>{formatTime(note.createdAtMs)}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel="Delete note" disabled={saving} onPress={() => setNoteToDelete(note)} android_ripple={{ color: 'rgba(15,23,42,0.12)', borderless: true }} style={styles.noteDelete}>
                        <Trash2 size={18} color={colors.destructiveText} />
                      </Pressable>
                    </View>
                  </View>
                ))}
        </ScrollView>
        <View style={styles.composer}>
          <FieldError message={error} />
          <View style={styles.composerRow}>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Add a private note…"
              placeholderTextColor={colors.mutedText}
              multiline
              maxLength={NOTE_MAX_LENGTH}
              accessibilityLabel="New private note"
              style={styles.composerInput}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Add note" accessibilityState={{ disabled: !canAdd, busy: saving }} disabled={!canAdd} onPress={() => void handleAdd()} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={[styles.composerSend, !canAdd && styles.disabled]}>
              {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Plus size={22} color="#ffffff" />}
            </Pressable>
          </View>
          {content.length > NOTE_MAX_LENGTH * 0.8 ? <Text style={styles.count}>{content.length} / {NOTE_MAX_LENGTH}</Text> : null}
        </View>
      </KeyboardSafeView>
      <CustomModal
        visible={noteToDelete !== null}
        type="danger"
        title="Delete this note?"
        message="The note will be removed for good. This can't be undone."
        confirmText="Delete note"
        cancelText="Keep"
        isLoading={saving}
        onConfirm={() => { if (noteToDelete) void handleDelete(noteToDelete.id); }}
        onCancel={() => setNoteToDelete(null)}
        onClose={() => setNoteToDelete(null)}
      />
    </ManagementSheet>
  );
}

type JobManagementAuditSheetProps = {
  job: ManagedJob | null;
  onClose: () => void;
};

export function JobManagementAuditSheet({ job, onClose }: JobManagementAuditSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entries, setEntries] = useState<JobAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!job) {
      setEntries([]);
      setError('');
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    void jobManagementService
      .listAuditHistory(job.id, 50)
      .then((history) => {
        if (active) setEntries(history);
      })
      .catch((loadError: unknown) => {
        console.error('[JobManagementAuditSheet.load] Error:', loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : 'Activity could not be loaded.');
      })
      // No .finally: the runtime Promise can lack it (see lib/shims/promiseFinally.ts).
      .then(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [job, reloadKey]);

  return (
    <ManagementSheet visible={Boolean(job)} title="Activity" subtitle={job?.title ?? ''} onRequestClose={onClose} isBusy={false} swipeLabel="Swipe down to close job activity">
      <ScrollView style={styles.flex} contentContainerStyle={styles.sheetContent}>
        {loading ? <SheetState kind="loading" title="Loading activity…" />
          : error ? <SheetState kind="error" title="Activity didn't load" message={error} onRetry={() => setReloadKey((key) => key + 1)} />
            : entries.length === 0 ? <SheetState kind="empty" icon="history" title="No activity yet" message="Status changes, edits and applicant updates on this listing will show here." />
              : entries.map((entry) => (
                <View key={entry.id} style={styles.auditCard}>
                  <View style={styles.auditHeader}>
                    <Text numberOfLines={2} style={styles.auditAction}>{entry.action.replaceAll('_', ' ')}</Text>
                    <Text style={styles.timestamp}>{formatTime(entry.createdAtMs)}</Text>
                  </View>
                  <Text style={styles.bodyText}>{entry.details}</Text>
                  {entry.previousValue && entry.newValue ? <Text style={styles.changeText}>{entry.previousValue} → {entry.newValue}</Text> : null}
                </View>
              ))}
      </ScrollView>
    </ManagementSheet>
  );
}

type JobManagementInterviewSheetProps = {
  application: ManagedJobApplication | null;
  job: ManagedJob | null;
  onClose: () => void;
  onScheduled: () => Promise<void>;
};

const INTERVIEW_TYPE_OPTIONS: ChoiceOption<InterviewType>[] = [
  { value: 'video', label: 'Video call' },
  { value: 'phone', label: 'Phone' },
  { value: 'in-person', label: 'In person' },
];
const INTERVIEW_DURATION_OPTIONS: ChoiceOption<string>[] = [15, 30, 45, 60, 90].map((minutes) => ({ value: String(minutes), label: `${minutes} min` }));

export function JobManagementInterviewSheet({ application, job, onClose, onScheduled }: JobManagementInterviewSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState<InterviewType>('video');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    if (!application) {
      setScheduledAt(null);
      setDuration(30);
      setType('video');
      setLocation('');
      setNotes('');
      setError('');
      setHasAttempted(false);
    }
  }, [application]);

  const dateError = !hasAttempted ? null : !scheduledAt ? 'Pick the interview date and time.' : scheduledAt.getTime() <= Date.now() ? 'Interview time must be in the future.' : null;
  const locationError = hasAttempted && type === 'in-person' && !location.trim() ? 'Add a location for an in-person interview.' : null;

  const handleSchedule = async () => {
    if (!application || !job) return;
    setHasAttempted(true);
    if (!scheduledAt) {
      setError('Pick the interview date and time.');
      return;
    }
    const scheduledDate = scheduledAt;
    if (scheduledDate.getTime() <= Date.now()) {
      setError('Interview time must be in the future.');
      return;
    }
    if (type === 'in-person' && !location.trim()) {
      setError('Add a location for an in-person interview.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input: ScheduleInterviewInput = {
        applicationId: application.id,
        jobId: job.id,
        applicantId: application.userId,
        applicantName: application.applicant.name,
        jobTitle: job.title,
        scheduledAt: scheduledDate.toISOString(),
        duration,
        type,
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      await jobManagementService.scheduleInterview(input);
      await onScheduled();
      onClose();
    } catch (scheduleError: unknown) {
      console.error('[JobManagementInterviewSheet.handleSchedule] Error:', scheduleError);
      setError(scheduleError instanceof Error ? scheduleError.message : 'The interview could not be scheduled.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagementSheet visible={Boolean(application && job)} title="Schedule interview" subtitle={`${application?.applicant.name ?? ''} · ${job?.title ?? ''}`} onRequestClose={onClose} isBusy={saving} swipeLabel="Swipe down to close interview scheduling">
      <KeyboardSafeView style={styles.keyboardArea}>
        <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.formContent}>
          <FormSection title="When">
            <View style={styles.field}>
              <DateTimeField label="Date and time" required mode="datetime" value={scheduledAt} onChange={setScheduledAt} placeholder="Pick a date and time" minimumDate={new Date()} />
              <FieldError message={dateError} />
            </View>
            <ChoicePills label="Length" options={INTERVIEW_DURATION_OPTIONS} value={String(duration)} onChange={(value) => setDuration(Number(value))} />
          </FormSection>
          <FormSection title="How">
            <ChoicePills label="Interview type" options={INTERVIEW_TYPE_OPTIONS} value={type} onChange={setType} />
            {type === 'in-person' ? <FormField label="Location" required autoCapitalize="words" value={location} onChangeText={setLocation} placeholder="Address or meeting point" error={locationError} /> : null}
            <FormField label="Notes for the interview" optional multiline maxLength={1000} value={notes} onChangeText={setNotes} placeholder="e.g., Bring your portfolio. Ask at reception when you arrive." />
          </FormSection>
        </ScrollView>
        <View style={styles.footer}>
          {error && !dateError && !locationError ? <FieldError message={error} /> : null}
          <View style={styles.footerRow}>
            <FooterButton label="Cancel" variant="secondary" disabled={saving} onPress={onClose} />
            <FooterButton flex={2} label={saving ? 'Scheduling…' : 'Schedule'} accessibilityLabel="Schedule interview" isLoading={saving} onPress={() => void handleSchedule()} icon={<CalendarClock size={18} color="#ffffff" />} />
          </View>
        </View>
      </KeyboardSafeView>
    </ManagementSheet>
  );
}

type JobManagementEditSheetProps = {
  job: ManagedJob | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

/** A screening question in the editor; `id` is the stored question's id ('' for a new one), `rowKey` is local. */
type EditableQuestion = ManagedJobQuestion & { rowKey: string };
const createRowKey = (): string => Math.random().toString(36).substring(2, 11);
const answerTypeOptions = (current: ManagedJobQuestion['answerType']): ChoiceOption<ManagedJobQuestion['answerType']>[] => {
  const options: ChoiceOption<ManagedJobQuestion['answerType']>[] = [...ANSWER_TYPES];
  // Older listings can use 'single' / 'multiple'; keep them selectable so the stored type is visible.
  if (!options.some((option) => option.value === current)) options.push({ value: current, label: current === 'single' ? 'Single Choice' : 'Multiple Choice' });
  return options;
};

export function JobManagementEditSheet({ job, onClose, onSaved }: JobManagementEditSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [locationType, setLocationType] = useState('remote');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [skills, setSkills] = useState('');
  const [requirements, setRequirements] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [duration, setDuration] = useState('');
  const [address, setAddress] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [urgency, setUrgency] = useState('');
  const [complexity, setComplexity] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [currency, setCurrency] = useState('');
  const [paymentPeriod, setPaymentPeriod] = useState('');
  const [contactPreference, setContactPreference] = useState('');
  const [closingDate, setClosingDate] = useState<Date | null>(null);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasAttempted, setHasAttempted] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  /** The job whose values fill the fields, and those values as saved, to tell whether anything was edited. */
  const [loadedJobId, setLoadedJobId] = useState('');
  const [baseline, setBaseline] = useState<string | null>(null);

  useEffect(() => {
    if (!job) {
      setLoadedJobId('');
      setBaseline(null);
      setIsDiscardConfirmOpen(false);
      return;
    }
    setTitle(job.title);
    setDescription(job.description);
    setCategory(job.category);
    setPriceFrom(String(job.priceRange.from));
    setPriceTo(String(job.priceRange.to));
    setLocationType(job.locationDetails.type);
    setCity(job.locationDetails.city);
    setCountry(job.locationDetails.country);
    setSkills(job.skills.join(', '));
    // One requirement or qualification per line: they are sentences that can contain commas.
    setRequirements(job.requirements.join('\n'));
    setQualifications(job.qualifications.join('\n'));
    setCompanyName(job.categoryDetails.name);
    setIndustry(job.categoryDetails.industry);
    setDuration(job.categoryDetails.duration);
    setAddress(job.locationDetails.address);
    setCompanySize(job.categoryDetails.size);
    setUrgency(job.categoryDetails.urgency);
    setComplexity(job.categoryDetails.complexity);
    setEmploymentType(job.listingDetails.employmentType);
    setExperienceLevel(job.listingDetails.experienceLevel);
    setCurrency(job.listingDetails.currency || 'USD');
    setPaymentPeriod(job.listingDetails.paymentPeriod);
    setContactPreference(job.listingDetails.contactPreference);
    setClosingDate(job.listingDetails.closingDateMs ? new Date(job.listingDetails.closingDateMs) : null);
    setQuestions(job.questions.map((question) => ({ ...question, rowKey: question.id || createRowKey() })));
    setDisclaimerAccepted(false);
    setError('');
    setHasAttempted(false);
    setBaseline(null);
    setLoadedJobId(job.id);
  }, [job]);

  const splitValues = (value: string): string[] =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const splitLines = (value: string): string[] =>
    value
      .split('\n')
      .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
      .filter(Boolean);

  const buildInput = (): UpdateManagedJobInput | null => {
    if (!job) return null;
    return {
      title,
      description,
      category,
      priceRange: { from: Number(priceFrom), to: Number(priceTo) },
      location: {
        type: locationType.trim() || 'remote',
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
      },
      skills: splitValues(skills),
      requirements: splitLines(requirements),
      qualifications: splitLines(qualifications),
      categoryDetails: {
        ...job.categoryDetails,
        name: companyName.trim(),
        industry: industry.trim(),
        size: companySize,
        duration: duration.trim(),
        urgency,
        complexity,
      },
      listingDetails: {
        employmentType,
        experienceLevel,
        currency,
        paymentPeriod,
        contactPreference,
        closingDateMs: closingDate ? closingDate.getTime() : null,
      },
      questions: questions.map((question) => ({ id: question.id, question: question.question, answerType: question.answerType, options: question.options })),
    };
  };

  const draftInput = buildInput();
  const draftSnapshot = draftInput ? JSON.stringify(draftInput) : '';
  const majorChanges = job && draftInput ? jobManagementService.detectMajorChanges(job, draftInput) : [];
  const activeApplicantCount = job ? job.applications.filter((application) => application.status !== 'withdrawn' && application.status !== 'job_withdrawn' && application.status !== 'rejected').length : 0;
  const isDirty = baseline !== null && draftSnapshot !== baseline;

  // Record the loaded values once they are in state (the render after the job's fields were set).
  useEffect(() => {
    if (job && loadedJobId === job.id && baseline === null) setBaseline(draftSnapshot);
  }, [baseline, draftSnapshot, job, loadedJobId]);

  const updateQuestion = (rowKey: string, changes: Partial<ManagedJobQuestion>): void => {
    setQuestions((current) => current.map((question) => (question.rowKey === rowKey ? { ...question, ...changes } : question)));
  };

  const isPhysical = locationType === 'onsite' || locationType === 'hybrid';
  const locationRequiredError = (value: string): string | null => (hasAttempted && isPhysical && !value.trim() ? 'Required for on-site or hybrid jobs.' : null);
  const priceError = hasAttempted && draftInput && (!Number.isFinite(draftInput.priceRange.from) || !Number.isFinite(draftInput.priceRange.to)) ? 'Enter numbers only, e.g. 4000.' : null;
  const disclaimerError = hasAttempted && majorChanges.length > 0 && !disclaimerAccepted ? 'Confirm the disclaimer to save major changes.' : null;
  const questionChoicesError = (question: EditableQuestion): string | null => (hasAttempted && question.question.trim() && question.answerType !== 'input' && question.options.filter((option) => option.trim()).length < 2 ? 'Add at least two choices.' : null);

  const handleSave = async () => {
    const input = buildInput();
    if (!job || !input) return;
    setHasAttempted(true);
    // Website job editor: the disclaimer is confirmed again only for material (major) changes.
    if (majorChanges.length > 0 && !disclaimerAccepted) {
      setError('Confirm the Job Poster Disclaimer before saving these major changes.');
      return;
    }
    if (isPhysical && (!address.trim() || !city.trim() || !country.trim())) {
      setError('Location details are required for onsite or hybrid jobs.');
      return;
    }
    if (!Number.isFinite(input.priceRange.from) || !Number.isFinite(input.priceRange.to)) {
      setError('Enter a valid compensation range.');
      return;
    }
    const incompleteQuestion = input.questions.find((question) => question.question.trim() && question.answerType !== 'input' && question.options.filter((option) => option.trim()).length < 2);
    if (incompleteQuestion) {
      setError('Give every choice question at least two options.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await jobManagementService.updateJob(job.id, input);
      jobManagementService.notifyApplicantsOfMajorChanges(job, majorChanges);
      await onSaved();
      onClose();
    } catch (saveError: unknown) {
      console.error('[JobManagementEditSheet.handleSave] Error:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'The job could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestClose = (): void => {
    if (saving) return;
    if (isDirty) { setIsDiscardConfirmOpen(true); return; }
    onClose();
  };

  const isQuickTask = job?.type === 'quickTask';

  return (
    <ManagementSheet visible={Boolean(job)} title="Edit listing" subtitle={job ? `${isQuickTask ? 'Quick task' : 'Professional job'} · ${job.title}` : ''} onRequestClose={handleRequestClose} isBusy={saving} swipeLabel="Swipe down to close job editor">
      <KeyboardSafeView style={styles.keyboardArea}>
        <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.formContent}>
          {job?.applications.length ? (
            <View style={styles.notice}>
              <AlertTriangle size={16} color={colors.warningText} />
              <Text style={styles.noticeText}>
                {job.applications.length} {job.applications.length === 1 ? 'person has' : 'people have'} applied, so this listing stays a {isQuickTask ? 'quick task' : 'professional job'}.
              </Text>
            </View>
          ) : null}

          <FormSection title="Basics">
            <FormField label="Title" value={title} onChangeText={setTitle} placeholder="Listing title" maxLength={300} />
            <FormField label="Description" multiline maxLength={5000} value={description} onChangeText={setDescription} placeholder="Describe the opportunity" />
            <FormField label="Category" autoCapitalize="words" value={category} onChangeText={setCategory} placeholder="e.g., Design" />
          </FormSection>

          <FormSection title="Pay">
            <View style={styles.twoColumn}>
              <View style={styles.flex}><FormField label="From" keyboardType="decimal-pad" value={priceFrom} onChangeText={setPriceFrom} placeholder="0" /></View>
              <View style={styles.flex}><FormField label="To" keyboardType="decimal-pad" value={priceTo} onChangeText={setPriceTo} placeholder="0" /></View>
            </View>
            <FieldError message={priceError} />
            <ChoicePills label="Currency" options={CURRENCIES.map((entry) => ({ value: entry, label: entry }))} value={currency} onChange={setCurrency} />
            {!isQuickTask ? <ChoicePills label="Paid" allowClear options={PAYMENT_PERIODS} value={paymentPeriod} onChange={setPaymentPeriod} /> : null}
          </FormSection>

          <FormSection title="Location">
            <ChoicePills label="Work location" options={LOCATION_TYPES} value={locationType === 'on-site' ? 'onsite' : (locationType as 'remote' | 'onsite' | 'hybrid')} onChange={setLocationType} />
            {locationType !== 'remote' ? <FormField label="Address" required={isPhysical} autoCapitalize="words" value={address} onChangeText={setAddress} placeholder="Street address" error={locationRequiredError(address)} /> : null}
            <View style={styles.twoColumn}>
              <View style={styles.flex}><FormField label="City" required={isPhysical} autoCapitalize="words" value={city} onChangeText={setCity} placeholder="City" error={locationRequiredError(city)} /></View>
              <View style={styles.flex}><FormField label="Country" required={isPhysical} autoCapitalize="words" value={country} onChangeText={setCountry} placeholder="Country" error={locationRequiredError(country)} /></View>
            </View>
          </FormSection>

          <FormSection title="Skills & requirements">
            <FormField label="Skills" value={skills} onChangeText={setSkills} placeholder="TypeScript, Design" hint="Separate skills with commas." />
            <FormField label="Requirements" multiline value={requirements} onChangeText={setRequirements} placeholder={'2 years of support experience\nFamiliar with Windows, Microsoft 365'} hint="One per line. Commas are fine inside a line." />
            <FormField label="Qualifications" multiline value={qualifications} onChangeText={setQualifications} placeholder={'Diploma in IT\nA+ certification'} hint="One per line." />
          </FormSection>

          {!isQuickTask ? (
            <FormSection title="Company">
              <FormField label="Company name" autoCapitalize="words" value={companyName} onChangeText={setCompanyName} placeholder="Company" />
              <FormField label="Industry" autoCapitalize="words" value={industry} onChangeText={setIndustry} placeholder="e.g., Technology" />
              <ChoicePills label="Company size" allowClear options={COMPANY_SIZES} value={companySize} onChange={setCompanySize} />
            </FormSection>
          ) : null}

          <FormSection title={isQuickTask ? 'Task details' : 'Listing details'} description="Tap a selected option again to clear it.">
            {isQuickTask ? <>
              <FormField label="Expected duration" value={duration} onChangeText={setDuration} placeholder="e.g., 2 days" />
              <ChoicePills label="Urgency" allowClear options={URGENCY_OPTIONS} value={urgency} onChange={setUrgency} />
              <ChoicePills label="Complexity" allowClear options={COMPLEXITY_OPTIONS} value={complexity} onChange={setComplexity} />
            </> : <>
              <ChoicePills label="Employment type" allowClear options={EMPLOYMENT_TYPES} value={employmentType} onChange={setEmploymentType} />
              <ChoicePills label="Experience level" allowClear options={EXPERIENCE_LEVELS} value={experienceLevel} onChange={setExperienceLevel} />
              <ChoicePills label="Contact preference" allowClear options={CONTACT_OPTIONS} value={contactPreference} onChange={setContactPreference} />
            </>}
            <View style={styles.field}>
              <DateTimeField label={isQuickTask ? 'Completion deadline' : 'Closing date'} mode="date" value={closingDate} onChange={(date) => setClosingDate(endOfLocalDay(date))} onClear={() => setClosingDate(null)} placeholder={isQuickTask ? 'No deadline' : 'No closing date'} minimumDate={new Date()} />
              <Text style={styles.hint}>{isQuickTask ? 'Leave empty for no deadline.' : 'Leave empty to keep the listing open until you close it.'}</Text>
            </View>
          </FormSection>

          <FormSection title="Screening questions" description="Questions applicants answer when they apply." action={<AddRowButton label="Add" accessibilityLabel="Add a screening question" onPress={() => setQuestions((current) => [...current, { rowKey: createRowKey(), id: '', question: '', answerType: 'input', options: [] }])} />}>
            {questions.length === 0 ? (
              <Text style={styles.emptyQuestions}>No screening questions. Applicants just send their application.</Text>
            ) : questions.map((question, questionIndex) => (
              <View key={question.rowKey} style={styles.questionCard}>
                <Text style={styles.questionLabel}>Question {questionIndex + 1}</Text>
                <RemovableRow
                  multiline
                  value={question.question}
                  onChangeText={(text) => updateQuestion(question.rowKey, { question: text })}
                  placeholder="e.g., Are you available on weekends?"
                  accessibilityLabel={`Question ${questionIndex + 1}`}
                  onRemove={() => setQuestions((current) => current.filter((entry) => entry.rowKey !== question.rowKey))}
                  removeLabel={`Remove question ${questionIndex + 1}`}
                />
                <ChoicePills
                  label="Answer type"
                  options={answerTypeOptions(question.answerType)}
                  value={question.answerType}
                  onChange={(answerType) => updateQuestion(question.rowKey, { answerType, options: answerType === 'input' ? [] : question.options })}
                />
                {question.answerType !== 'input' ? (
                  <View style={styles.optionsBlock}>
                    <Text style={styles.questionLabel}>Choices</Text>
                    {question.options.map((option, optionIndex) => (
                      <RemovableRow
                        key={`${question.rowKey}-${optionIndex}`}
                        value={option}
                        onChangeText={(text) => updateQuestion(question.rowKey, { options: question.options.map((entry, entryIndex) => (entryIndex === optionIndex ? text : entry)) })}
                        placeholder={`Choice ${optionIndex + 1}`}
                        onRemove={() => updateQuestion(question.rowKey, { options: question.options.filter((_entry, entryIndex) => entryIndex !== optionIndex) })}
                        removeLabel={`Remove choice ${optionIndex + 1}`}
                      />
                    ))}
                    <FieldError message={questionChoicesError(question)} />
                    <View style={styles.alignStart}><AddRowButton label="Add choice" onPress={() => updateQuestion(question.rowKey, { options: [...question.options, ''] })} /></View>
                  </View>
                ) : null}
              </View>
            ))}
          </FormSection>

          {majorChanges.length > 0 ? (
            <FormSection tone="warning" title="Major changes" description={majorChanges.map((change) => JOB_MAJOR_CHANGE_LABELS[change]).join(', ')}>
              <Text style={styles.majorChangesText}>
                {activeApplicantCount > 0
                  ? `${activeApplicantCount} ${activeApplicantCount === 1 ? 'applicant' : 'applicants'} will be emailed about these changes when you save.`
                  : 'No current applicants will need to be told about these changes.'}
              </Text>
              <DisclaimerBox text={JOB_POSTER_DISCLAIMER} />
              <AgreementCheckbox checked={disclaimerAccepted} onChange={setDisclaimerAccepted} error={disclaimerError}>
                I have read the Job Poster Disclaimer and confirm these changes.
              </AgreementCheckbox>
            </FormSection>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          {error ? <FieldError message={error} /> : null}
          <View style={styles.footerRow}>
            <FooterButton label="Cancel" variant="secondary" disabled={saving} onPress={handleRequestClose} />
            <FooterButton flex={2} label={saving ? 'Saving…' : 'Save changes'} isLoading={saving} disabled={!isDirty && baseline !== null} onPress={() => void handleSave()} icon={<Check size={18} color="#ffffff" />} />
          </View>
        </View>
      </KeyboardSafeView>
      <CustomModal
        visible={isDiscardConfirmOpen}
        type="warning"
        title="Discard your changes?"
        message="Your edits to this listing haven't been saved and will be lost."
        confirmText="Discard"
        cancelText="Keep editing"
        onConfirm={() => { setIsDiscardConfirmOpen(false); onClose(); }}
        onCancel={() => setIsDiscardConfirmOpen(false)}
        onClose={() => setIsDiscardConfirmOpen(false)}
      />
    </ManagementSheet>
  );
}

function formatTime(timestampMs: number): string {
  if (!timestampMs) return 'Just now';
  return new Date(timestampMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    flex: { flex: 1, minWidth: 0 },
    keyboardArea: { flex: 1 },
    field: { gap: 6 },
    alignStart: { alignSelf: 'flex-start' },
    disabled: { opacity: 0.45 },
    hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
    count: { alignSelf: 'flex-end', color: colors.mutedText, fontSize: 12 },
    sheetContent: { flexGrow: 1, padding: 16, paddingBottom: 24, gap: 10 },
    formContent: { padding: 16, paddingBottom: 32, gap: 16 },
    footer: { gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
    footerRow: { flexDirection: 'row', gap: 8 },
    state: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 40 },
    stateIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, marginBottom: 4 },
    stateIconError: { backgroundColor: colors.destructiveSurface },
    stateTitle: { color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
    stateMessage: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    retryButton: { marginTop: 8, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden', paddingHorizontal: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    retryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
    composer: { gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
    composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    composerInput: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 140, textAlignVertical: 'top', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text, fontSize: 15, paddingHorizontal: 12, paddingTop: 13, paddingBottom: 12 },
    composerSend: { width: 48, height: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN },
    noteCard: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.warningText, borderRadius: JOBS_CARD_RADIUS, backgroundColor: colors.warningSurface, paddingLeft: 14, paddingRight: 4, paddingTop: 12, paddingBottom: 4 },
    noteDelete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    auditCard: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: JOBS_ACTION_GREEN, borderRadius: 12, backgroundColor: colors.surface, padding: 14 },
    auditHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
    auditAction: { flex: 1, color: colors.successText, fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
    bodyText: { color: colors.text, fontSize: 14, lineHeight: 20, paddingRight: 10 },
    changeText: { color: colors.mutedText, fontSize: 12, marginTop: 6 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    timestamp: { flex: 1, color: colors.mutedText, fontSize: 12 },
    twoColumn: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.warningText, backgroundColor: colors.warningSurface },
    noticeText: { flex: 1, color: colors.warningText, fontSize: 13, lineHeight: 18, fontWeight: '600' },
    emptyQuestions: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingVertical: 16, paddingHorizontal: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 12 },
    questionCard: { gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.canvas, padding: 12 },
    questionLabel: { color: colors.secondaryText, fontSize: 12, fontWeight: '900' },
    optionsBlock: { gap: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border },
    majorChangesText: { color: colors.warningText, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  });
