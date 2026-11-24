import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ArrowRight, CreditCard, ShieldAlert, X, Zap } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { auth } from '@/lib/firebaseConfig';
import { JobsService } from '@/lib/job/JobsService';
import {
  CANCELLATION_TRIGGERS, COMPLEXITY_OPTIONS, CURRENCIES, DELIVERABLE_UNITS, DURATION_UNITS, LOCATION_TYPES, PAYMENT_TIMING_EXPLANATIONS,
  PAYMENT_TIMING_NOTES, PAYMENT_TIMING_OPTIONS, QUICK_TASK_CATEGORIES, TASK_POSTER_AGREEMENT, TASK_POSTER_DISCLAIMER, URGENCY_OPTIONS, labelFor,
  type DeliverableUnit, type DurationUnit, type PaymentTiming, type TaskComplexity, type TaskUrgency, type WorkLocationType,
} from '@/lib/job/JobFormOptions';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import DateTimeField from '@/components/ui/DateTimeField';
import CustomModal from '@/components/ui/CustomModal';
import JobFormShell, { FooterButton } from './JobFormShell';
import { AddRowButton, AgreementCheckbox, ChoiceCards, ChoicePills, DisclaimerBox, FieldError, FormField, FormSection, RemovableRow, SummaryRow } from './JobFormParts';

type QuickTaskCreationModalProps = { isOpen: boolean; onClose: () => void; onCreated?: () => void };
type Deliverable = { id: string; description: string; quantity: string; unit: DeliverableUnit };
type TextRow = { id: string; text: string };
type CancellationTerm = { id: string; trigger: string; refundPercentage: string; description: string };

const TASK_STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'pay', label: 'Pay & timing' },
  { key: 'location', label: 'Location & terms' },
  { key: 'review', label: 'Review & post' },
] as const;
type TaskStepIndex = 0 | 1 | 2 | 3 | 4;
const LAST_STEP: TaskStepIndex = 4;

type TaskFormField = 'title' | 'description' | 'category' | 'amount' | 'duration' | 'deadline' | 'deliverables' | 'acceptance' | 'safety' | 'safetyAck' | 'disclaimer';
/** `message` is the wording the single-page form used (banner and toast); `inline` is the shorter text under the field. */
type TaskFormError = { field: TaskFormField; message: string; inline: string };

const FIELD_STEP: { [field in TaskFormField]: TaskStepIndex } = {
  title: 0, description: 0, category: 0, deliverables: 1, acceptance: 1, amount: 2, duration: 2, deadline: 2, safety: 3, safetyAck: 3, disclaimer: 4,
};

const jobsService = JobsService.getInstance();
const generateId = (): string => Math.random().toString(36).substring(2, 11);
const PAYMENT_TYPES = [{ value: 'fixed', label: 'Fixed price' }, { value: 'hourly', label: 'Hourly rate' }] as const;
const BASICS_MESSAGE = 'Please fill in all required basic fields.';

/** Create Quick Task (web components/jobs/createJobsModel/QuickTaskCreationModal.tsx), as five short steps. */
export default function QuickTaskCreationModal({ isOpen, onClose, onCreated }: QuickTaskCreationModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [step, setStep] = useState<TaskStepIndex>(0);
  const [checkedSteps, setCheckedSteps] = useState<TaskStepIndex[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [deliverables, setDeliverables] = useState<Deliverable[]>([{ id: generateId(), description: '', quantity: '', unit: 'piece' }]);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<TextRow[]>([{ id: generateId(), text: '' }]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('USD');
  const [paymentType, setPaymentType] = useState<'fixed' | 'hourly'>('fixed');
  const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>('on_completion');
  const [expectedDuration, setExpectedDuration] = useState('');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [completionDeadline, setCompletionDeadline] = useState<Date | null>(null);
  const [urgency, setUrgency] = useState<TaskUrgency>('medium');
  const [complexity, setComplexity] = useState<TaskComplexity>('moderate');
  const [locationType, setLocationType] = useState<WorkLocationType>('remote');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [cancellationTerms, setCancellationTerms] = useState<CancellationTerm[]>([{ id: generateId(), trigger: '', refundPercentage: '100', description: '' }]);
  const [safetyRequirements, setSafetyRequirements] = useState<TextRow[]>([]);
  const [safetyAcknowledgment, setSafetyAcknowledgment] = useState(false);
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);

  const isPhysicalTask = locationType === 'onsite' || locationType === 'hybrid';
  const hasContent = Boolean(title.trim() || description.trim() || paymentAmount || expectedDuration || deliverables.some((row) => row.description.trim()));

  const resetForm = (): void => {
    setTitle(''); setDescription(''); setCategory('');
    setDeliverables([{ id: generateId(), description: '', quantity: '', unit: 'piece' }]);
    setAcceptanceCriteria([{ id: generateId(), text: '' }]);
    setPaymentAmount(''); setPaymentCurrency('USD'); setPaymentType('fixed'); setPaymentTiming('on_completion');
    setExpectedDuration(''); setDurationUnit('days'); setCompletionDeadline(null); setUrgency('medium'); setComplexity('moderate');
    setLocationType('remote'); setLocationAddress(''); setLocationCity(''); setLocationCountry(''); setLocationNotes('');
    setCancellationTerms([{ id: generateId(), trigger: '', refundPercentage: '100', description: '' }]);
    setSafetyRequirements([]); setSafetyAcknowledgment(false); setIsDisclaimerAccepted(false); setError('');
    setStep(0); setCheckedSteps([]);
  };

  const closeForm = (): void => { resetForm(); onClose(); };
  const handleRequestClose = (): void => {
    if (isSubmitting) return;
    if (hasContent) { setIsLeaveConfirmOpen(true); return; }
    closeForm();
  };

  /** Every problem, in the order (and wording) the single-page form checked them. */
  const collectErrors = (): TaskFormError[] => {
    const errors: TaskFormError[] = [];
    if (!title.trim()) errors.push({ field: 'title', message: BASICS_MESSAGE, inline: 'Add a task title.' });
    if (!description.trim()) errors.push({ field: 'description', message: BASICS_MESSAGE, inline: 'Describe what needs to be done.' });
    if (!category) errors.push({ field: 'category', message: BASICS_MESSAGE, inline: 'Pick a category.' });
    if (!(Number(paymentAmount) > 0)) errors.push({ field: 'amount', message: 'Please enter a valid payment amount.', inline: 'Enter an amount above zero.' });
    if (!(Number(expectedDuration) > 0)) errors.push({ field: 'duration', message: 'Please enter a valid expected duration.', inline: 'Enter a duration above zero.' });
    if (!completionDeadline) errors.push({ field: 'deadline', message: 'Please choose a completion deadline.', inline: 'Choose when the task must be done.' });
    else if (completionDeadline <= new Date()) errors.push({ field: 'deadline', message: 'The completion deadline must be in the future.', inline: 'The deadline must be in the future.' });
    if (!deliverables.some((row) => row.description.trim())) errors.push({ field: 'deliverables', message: 'Please add at least one deliverable.', inline: 'Add at least one deliverable.' });
    if (!acceptanceCriteria.some((row) => row.text.trim())) errors.push({ field: 'acceptance', message: 'Please add at least one acceptance criterion.', inline: 'Add at least one acceptance criterion.' });
    if (isPhysicalTask && !safetyRequirements.some((row) => row.text.trim())) errors.push({ field: 'safety', message: 'Please add at least one safety requirement for physical tasks.', inline: 'Physical tasks need at least one safety requirement.' });
    if (isPhysicalTask && !safetyAcknowledgment) errors.push({ field: 'safetyAck', message: 'Please acknowledge the safety requirements.', inline: 'Tick to acknowledge the safety requirements.' });
    if (!isDisclaimerAccepted) errors.push({ field: 'disclaimer', message: 'Please accept the Task Poster Disclaimer.', inline: 'Accept the Task Poster Disclaimer to post.' });
    return errors;
  };

  const formErrors = collectErrors();
  const fieldError = (field: TaskFormField): string | null => (checkedSteps.includes(FIELD_STEP[field]) ? formErrors.find((entry) => entry.field === field)?.inline ?? null : null);
  const markChecked = (steps: TaskStepIndex[]): void => setCheckedSteps((current) => [...new Set([...current, ...steps])]);

  const handleSubmit = async (): Promise<void> => {
    const userId = auth.currentUser?.uid;
    if (!userId) { setError('Please log in to create a task.'); return; }
    const firstError = formErrors[0];
    if (firstError) {
      markChecked(TASK_STEPS.map((_entry, index) => index as TaskStepIndex));
      setStep(FIELD_STEP[firstError.field]);
      setError(firstError.message);
      toast.error(firstError.message);
      return;
    }
    setIsSubmitting(true);
    setError('');
    const duration = `${expectedDuration} ${durationUnit}`;
    try {
      await jobsService.createJob({
        userId,
        jobTitle: title.trim(),
        jobDescription: description.trim(),
        jobCategory: 'quickTask',
        category,
        priceRange: { from: Number(paymentAmount), to: Number(paymentAmount) },
        currency: paymentCurrency,
        location: { type: locationType, address: locationAddress.trim(), city: locationCity.trim(), country: locationCountry.trim(), notes: locationNotes.trim() },
        skills: [],
        questions: [],
        closingDate: completionDeadline?.toISOString(),
        category_specific: {
          type: 'request',
          deliverables: deliverables.filter((row) => row.description.trim()).map((row) => ({ description: row.description.trim(), quantity: row.quantity, unit: row.unit })),
          acceptanceCriteria: acceptanceCriteria.map((row) => row.text.trim()).filter(Boolean),
          expectedDuration: duration,
          durationValue: Number(expectedDuration),
          durationUnit,
          urgency,
          complexity,
          paymentType,
          paymentTiming,
          cancellationTerms: cancellationTerms.filter((term) => term.trigger && term.description.trim()).map((term) => ({ trigger: term.trigger, refundPercentage: Number(term.refundPercentage) || 0, description: term.description.trim() })),
          safetyRequirements: isPhysicalTask ? safetyRequirements.map((row) => row.text.trim()).filter(Boolean) : [],
          safetyAcknowledged: isPhysicalTask ? safetyAcknowledgment : false,
          paymentProcessing: { method: 'platform_escrow', timing: paymentTiming, note: PAYMENT_TIMING_NOTES[paymentTiming] },
          proposals: 0,
          timeline: duration,
        },
        publicationStatus: 'published',
        disclaimerAccepted: isDisclaimerAccepted,
      });
      toast.success('Quick task created successfully!');
      closeForm();
      onCreated?.();
    } catch (submitError: unknown) {
      console.error('[QuickTaskCreationModal.handleSubmit] Error:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Failed to create task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = (): void => {
    const stepErrors = formErrors.filter((entry) => FIELD_STEP[entry.field] === step);
    markChecked([step]);
    if (stepErrors.length) {
      setError(stepErrors.length === 1 ? stepErrors[0].message : `Fix the ${stepErrors.length} highlighted fields to continue.`);
      return;
    }
    setError('');
    setStep((current) => (current < LAST_STEP ? ((current + 1) as TaskStepIndex) : current));
  };

  const handleBack = (): void => {
    setError('');
    setStep((current) => (current > 0 ? ((current - 1) as TaskStepIndex) : current));
  };

  const updateDeliverable = (id: string, changes: Partial<Deliverable>): void => setDeliverables((rows) => rows.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  const updateTerm = (id: string, changes: Partial<CancellationTerm>): void => setCancellationTerms((rows) => rows.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  const nextStep = step < LAST_STEP ? TASK_STEPS[step + 1] : null;
  const backButton = <FooterButton label="Back" variant="secondary" disabled={isSubmitting} onPress={handleBack} icon={<ArrowLeft size={16} color={colors.text} />} />;
  const footer = step === LAST_STEP
    ? <>{backButton}<FooterButton flex={2} label={isSubmitting ? 'Posting…' : 'Post task'} accessibilityLabel="Post quick task" isLoading={isSubmitting} onPress={() => void handleSubmit()} icon={<Zap size={18} color="#ffffff" />} /></>
    : <>{step > 0 ? backButton : null}<FooterButton flex={2} label="Next" accessibilityLabel={nextStep ? `Next: ${nextStep.label}` : 'Next'} disabled={isSubmitting} onPress={handleNext} icon={<ArrowRight size={18} color="#ffffff" />} /></>;

  const filledDeliverables = deliverables.filter((row) => row.description.trim());

  return (
    <JobFormShell
      visible={isOpen}
      title="Post a quick task"
      description="Clear deliverables and terms get faster, better offers. * = required."
      onClose={handleRequestClose}
      progress={{ current: step + 1, total: TASK_STEPS.length, label: TASK_STEPS[step].label, nextLabel: nextStep?.label }}
      contentKey={`step-${step}`}
      errorMessage={error}
      footer={footer}
    >
      {step === 0 ? (
        <FormSection title="About the task">
          <FormField label="Task title" required value={title} onChangeText={setTitle} placeholder="e.g., Fix a leaky kitchen faucet" maxLength={300} error={fieldError('title')} />
          <ChoicePills label="Category" required options={QUICK_TASK_CATEGORIES.map((entry) => ({ value: entry, label: entry }))} value={category} onChange={setCategory} error={fieldError('category')} />
          <FormField label="Description" required multiline value={description} onChangeText={setDescription} placeholder="What needs to be done, and anything the tasker should know before offering" error={fieldError('description')} />
        </FormSection>
      ) : null}

      {step === 1 ? <>
        <FormSection title="Deliverables" description="Exactly what the tasker must produce or complete." required error={fieldError('deliverables')} action={<AddRowButton label="Add" accessibilityLabel="Add a deliverable" onPress={() => setDeliverables((rows) => [...rows, { id: generateId(), description: '', quantity: '', unit: 'piece' }])} />}>
          {deliverables.map((deliverable, index) => (
            <View key={deliverable.id} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>Deliverable {index + 1}</Text>
                {deliverables.length > 1 ? <RemoveIconButton label={`Remove deliverable ${index + 1}`} onPress={() => setDeliverables((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== deliverable.id)))} /> : null}
              </View>
              <FormField label="What" multiline value={deliverable.description} onChangeText={(text) => updateDeliverable(deliverable.id, { description: text })} placeholder="e.g., High-resolution logo in PNG and SVG" />
              <View style={styles.qtyField}><FormField label="Quantity" optional keyboardType="number-pad" value={deliverable.quantity} onChangeText={(quantity) => updateDeliverable(deliverable.id, { quantity: quantity.replace(/[^0-9]/g, '') })} placeholder="e.g., 3" /></View>
              <ChoicePills label="Unit" options={DELIVERABLE_UNITS} value={deliverable.unit} onChange={(unit) => updateDeliverable(deliverable.id, { unit })} />
            </View>
          ))}
        </FormSection>
        <FormSection title="Acceptance criteria" description="How you'll check the task was done right." required error={fieldError('acceptance')} action={<AddRowButton label="Add" accessibilityLabel="Add an acceptance criterion" onPress={() => setAcceptanceCriteria((rows) => [...rows, { id: generateId(), text: '' }])} />}>
          {acceptanceCriteria.map((criterion, index) => <RemovableRow key={criterion.id} multiline value={criterion.text} onChangeText={(text) => setAcceptanceCriteria((rows) => rows.map((row) => (row.id === criterion.id ? { ...row, text } : row)))} placeholder="e.g., Logo comes in vector format with 3 colour variations" accessibilityLabel={`Acceptance criterion ${index + 1}`} canRemove={acceptanceCriteria.length > 1} onRemove={() => setAcceptanceCriteria((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== criterion.id)))} removeLabel={`Remove criterion ${index + 1}`} />)}
        </FormSection>
      </> : null}

      {step === 2 ? <>
        <FormSection title="Payment">
          <FormField label="Amount" required keyboardType="decimal-pad" value={paymentAmount} onChangeText={(value) => setPaymentAmount(value.replace(/[^0-9.]/g, ''))} placeholder="0.00" error={fieldError('amount')} />
          <ChoicePills label="Currency" options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))} value={paymentCurrency} onChange={setPaymentCurrency} />
          <ChoicePills label="Payment type" options={PAYMENT_TYPES} value={paymentType} onChange={setPaymentType} />
          <ChoiceCards label="Payment timing" options={PAYMENT_TIMING_OPTIONS} value={paymentTiming} onChange={setPaymentTiming} />
          <View style={styles.infoBox}>
            <CreditCard size={18} color={colors.accentText} />
            <View style={styles.flex}>
              <Text style={styles.infoTitle}>How payment processing works</Text>
              <Text style={styles.infoText}>{PAYMENT_TIMING_EXPLANATIONS[paymentTiming]}</Text>
            </View>
          </View>
        </FormSection>
        <FormSection title="Duration & deadline">
          <View style={styles.qtyField}><FormField label="Expected duration" required keyboardType="number-pad" value={expectedDuration} onChangeText={(value) => setExpectedDuration(value.replace(/[^0-9]/g, ''))} placeholder="e.g., 3" error={fieldError('duration')} /></View>
          <ChoicePills label="Unit" options={DURATION_UNITS} value={durationUnit} onChange={setDurationUnit} />
          <View style={styles.field}>
            <DateTimeField label="Completion deadline" required mode="datetime" value={completionDeadline} onChange={setCompletionDeadline} placeholder="Pick a date and time" minimumDate={new Date()} />
            {fieldError('deadline') ? <FieldError message={fieldError('deadline')} /> : <Text style={styles.hint}>The task expires automatically after this deadline.</Text>}
          </View>
        </FormSection>
        <FormSection title="Urgency & complexity">
          <ChoiceCards label="Urgency" options={URGENCY_OPTIONS} value={urgency} onChange={setUrgency} />
          <ChoiceCards label="Complexity" options={COMPLEXITY_OPTIONS} value={complexity} onChange={setComplexity} />
        </FormSection>
      </> : null}

      {step === 3 ? <>
        <FormSection title="Task location">
          <ChoiceCards options={LOCATION_TYPES} value={locationType} onChange={setLocationType} />
          {isPhysicalTask ? <>
            <FormField label="Address" optional autoCapitalize="words" value={locationAddress} onChangeText={setLocationAddress} placeholder="Street address" />
            <View style={styles.row}>
              <View style={styles.flex}><FormField label="City" autoCapitalize="words" value={locationCity} onChangeText={setLocationCity} placeholder="City" /></View>
              <View style={styles.flex}><FormField label="Country" autoCapitalize="words" value={locationCountry} onChangeText={setLocationCountry} placeholder="Country" /></View>
            </View>
            <FormField label="Location notes" optional value={locationNotes} onChangeText={setLocationNotes} placeholder="e.g., Ring the bell, use the side entrance" />
          </> : null}
        </FormSection>

        {isPhysicalTask ? (
          <FormSection tone="warning" title="Safety requirements" description="Physical tasks need safety details to protect taskers: PPE, tools or safety steps." required error={fieldError('safety')} action={<AddRowButton label="Add" accessibilityLabel="Add a safety requirement" onPress={() => setSafetyRequirements((rows) => [...rows, { id: generateId(), text: '' }])} />}>
            {safetyRequirements.length === 0 ? (
              <View style={styles.safetyEmpty}>
                <ShieldAlert size={18} color={colors.warningText} />
                <Text style={[styles.infoText, styles.flex]}>No safety requirements yet. Tap Add to list at least one.</Text>
              </View>
            ) : null}
            {safetyRequirements.map((requirement, index) => <RemovableRow key={requirement.id} value={requirement.text} onChangeText={(text) => setSafetyRequirements((rows) => rows.map((row) => (row.id === requirement.id ? { ...row, text } : row)))} placeholder="e.g., Wear a hard hat, bring your own ladder" accessibilityLabel={`Safety requirement ${index + 1}`} onRemove={() => setSafetyRequirements((rows) => rows.filter((row) => row.id !== requirement.id))} removeLabel={`Remove safety requirement ${index + 1}`} />)}
            {safetyRequirements.length > 0 ? (
              <AgreementCheckbox tone="warning" checked={safetyAcknowledgment} onChange={setSafetyAcknowledgment} error={fieldError('safetyAck')}>
                I acknowledge that I am responsible for communicating all safety requirements to the tasker and ensuring a safe working environment.
              </AgreementCheckbox>
            ) : null}
          </FormSection>
        ) : null}

        <FormSection title="Cancellation terms" description="Optional. Refunds for different cancellation cases; a term needs a case and notes to be saved." action={<AddRowButton label="Add" accessibilityLabel="Add a cancellation term" onPress={() => setCancellationTerms((rows) => [...rows, { id: generateId(), trigger: '', refundPercentage: '100', description: '' }])} />}>
          {cancellationTerms.map((term, index) => (
            <View key={term.id} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>Term {index + 1}</Text>
                {cancellationTerms.length > 1 ? <RemoveIconButton label={`Remove cancellation term ${index + 1}`} onPress={() => setCancellationTerms((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== term.id)))} /> : null}
              </View>
              <ChoiceCards layout="list" label="When" options={CANCELLATION_TRIGGERS.map((trigger) => ({ value: trigger, label: trigger }))} value={term.trigger} onChange={(trigger) => updateTerm(term.id, { trigger })} />
              <View style={styles.qtyField}><FormField label="Refund" keyboardType="number-pad" suffix="%" value={term.refundPercentage} onChangeText={(refundPercentage) => updateTerm(term.id, { refundPercentage: refundPercentage.replace(/[^0-9]/g, '').slice(0, 3) })} placeholder="100" /></View>
              <FormField label="Notes" multiline value={term.description} onChangeText={(text) => updateTerm(term.id, { description: text })} placeholder="Anything else about this term" />
            </View>
          ))}
        </FormSection>
      </> : null}

      {step === LAST_STEP ? <>
        <FormSection title="Summary">
          <SummaryRow label="Task" value={title || 'Not set'} />
          <SummaryRow label="Category" value={category || 'Not set'} />
          <SummaryRow label="Pay" value={paymentAmount ? `${paymentCurrency} ${paymentAmount} · ${paymentType === 'hourly' ? 'per hour' : 'fixed'} · ${labelFor(PAYMENT_TIMING_OPTIONS, paymentTiming)}` : 'Not set'} />
          <SummaryRow label="Duration" value={expectedDuration ? `${expectedDuration} ${durationUnit}` : 'Not set'} />
          <SummaryRow label="Deadline" value={completionDeadline ? completionDeadline.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not set'} />
          <SummaryRow label="Location" value={labelFor(LOCATION_TYPES, locationType)} />
          <SummaryRow label="Deliverables" value={filledDeliverables.length ? filledDeliverables.map((row) => row.description.trim()).join('; ') : 'None yet'} />
          <Text style={styles.hint}>Quick tasks go live as soon as you post them.</Text>
        </FormSection>
        <FormSection title="Task poster disclaimer" description="Read and accept before posting." required>
          <DisclaimerBox text={TASK_POSTER_DISCLAIMER} />
          <AgreementCheckbox checked={isDisclaimerAccepted} onChange={setIsDisclaimerAccepted} error={fieldError('disclaimer')}>{TASK_POSTER_AGREEMENT}</AgreementCheckbox>
        </FormSection>
      </> : null}

      <CustomModal
        visible={isLeaveConfirmOpen}
        type="warning"
        title="Discard this task?"
        message="Quick tasks aren't saved as drafts, so everything you've entered will be lost."
        confirmText="Discard"
        cancelText="Keep editing"
        onConfirm={() => { setIsLeaveConfirmOpen(false); closeForm(); }}
        onCancel={() => setIsLeaveConfirmOpen(false)}
        onClose={() => setIsLeaveConfirmOpen(false)}
      />
    </JobFormShell>
  );
}

type RemoveIconButtonProps = { label: string; onPress: () => void };

function RemoveIconButton({ label, onPress }: RemoveIconButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={styles.removeIcon}>
    <X size={18} color={colors.destructiveText} />
  </Pressable>;
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  field: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  qtyField: { width: 150, maxWidth: '100%' },
  groupCard: { gap: 14, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 40 },
  groupTitle: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '900' },
  removeIcon: { width: 40, height: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.destructiveSurface },
  infoBox: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.control },
  infoTitle: { color: colors.text, fontWeight: '800', fontSize: 13, marginBottom: 3 },
  infoText: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  safetyEmpty: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.surface },
});
