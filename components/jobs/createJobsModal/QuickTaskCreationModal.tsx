import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { CreditCard, Zap } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { auth } from '@/lib/firebaseConfig';
import { JobsService } from '@/lib/job/JobsService';
import {
  CANCELLATION_TRIGGERS, COMPLEXITY_OPTIONS, CURRENCIES, DELIVERABLE_UNITS, DURATION_UNITS, LOCATION_TYPES, PAYMENT_TIMING_EXPLANATIONS,
  PAYMENT_TIMING_NOTES, PAYMENT_TIMING_OPTIONS, QUICK_TASK_CATEGORIES, TASK_POSTER_AGREEMENT, TASK_POSTER_DISCLAIMER, URGENCY_OPTIONS,
  type DeliverableUnit, type DurationUnit, type PaymentTiming, type TaskComplexity, type TaskUrgency, type WorkLocationType,
} from '@/lib/job/JobFormOptions';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import DateTimeField from '@/components/ui/DateTimeField';
import CustomModal from '@/components/ui/CustomModal';
import JobFormShell, { FooterButton } from './JobFormShell';
import { AddRowButton, AgreementCheckbox, ChoiceCards, ChoicePills, DisclaimerBox, FormField, FormSection, RemovableRow } from './JobFormParts';

type QuickTaskCreationModalProps = { isOpen: boolean; onClose: () => void; onCreated?: () => void };
type Deliverable = { id: string; description: string; quantity: string; unit: DeliverableUnit };
type TextRow = { id: string; text: string };
type CancellationTerm = { id: string; trigger: string; refundPercentage: string; description: string };

const jobsService = JobsService.getInstance();
const generateId = (): string => Math.random().toString(36).substring(2, 11);
const PAYMENT_TYPES = [{ value: 'fixed', label: 'Fixed Price' }, { value: 'hourly', label: 'Hourly Rate' }] as const;

/** Create Quick Task (web components/jobs/createJobsModel/QuickTaskCreationModal.tsx). */
export default function QuickTaskCreationModal({ isOpen, onClose, onCreated }: QuickTaskCreationModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

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
  };

  const closeForm = (): void => { resetForm(); onClose(); };
  const handleRequestClose = (): void => {
    if (isSubmitting) return;
    if (hasContent) { setIsLeaveConfirmOpen(true); return; }
    closeForm();
  };

  const validate = (): string | null => {
    if (!title.trim() || !description.trim() || !category) return 'Please fill in all required basic fields.';
    if (!(Number(paymentAmount) > 0)) return 'Please enter a valid payment amount.';
    if (!(Number(expectedDuration) > 0)) return 'Please enter a valid expected duration.';
    if (!completionDeadline) return 'Please choose a completion deadline.';
    if (completionDeadline <= new Date()) return 'The completion deadline must be in the future.';
    if (!deliverables.some((row) => row.description.trim())) return 'Please add at least one deliverable.';
    if (!acceptanceCriteria.some((row) => row.text.trim())) return 'Please add at least one acceptance criterion.';
    if (isPhysicalTask && !safetyRequirements.some((row) => row.text.trim())) return 'Please add at least one safety requirement for physical tasks.';
    if (isPhysicalTask && !safetyAcknowledgment) return 'Please acknowledge the safety requirements.';
    if (!isDisclaimerAccepted) return 'Please accept the Task Poster Disclaimer.';
    return null;
  };

  const handleSubmit = async (): Promise<void> => {
    const userId = auth.currentUser?.uid;
    if (!userId) { setError('Please log in to create a task.'); return; }
    const validationError = validate();
    if (validationError) { setError(validationError); toast.error(validationError); return; }
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

  const updateDeliverable = (id: string, changes: Partial<Deliverable>): void => setDeliverables((rows) => rows.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  const updateTerm = (id: string, changes: Partial<CancellationTerm>): void => setCancellationTerms((rows) => rows.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  return (
    <JobFormShell
      visible={isOpen}
      title="Create Quick Task"
      description="Define your task with clear deliverables and terms. Fields marked * are required."
      onClose={handleRequestClose}
      footer={<>
        <FooterButton label="Cancel" variant="ghost" disabled={isSubmitting} onPress={handleRequestClose} />
        <FooterButton label={isSubmitting ? 'Creating…' : 'Create task'} disabled={isSubmitting || !isDisclaimerAccepted} onPress={() => void handleSubmit()} icon={isSubmitting ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Zap size={16} color={colors.onAccent} />} />
      </>}
    >
      <FormSection title="Basic information">
        <FormField label="Task title" required value={title} onChangeText={setTitle} placeholder="e.g., Design a company logo, Fix a leaky faucet" maxLength={300} />
        <ChoicePills label="Category" required scrollable options={QUICK_TASK_CATEGORIES.map((entry) => ({ value: entry, label: entry }))} value={category} onChange={setCategory} />
        <FormField label="Description" required multiline value={description} onChangeText={setDescription} placeholder="Provide a detailed description of what needs to be done..." />
      </FormSection>

      <FormSection title="Deliverables" description="List exactly what the tasker must produce or complete." required action={<AddRowButton label="Add" onPress={() => setDeliverables((rows) => [...rows, { id: generateId(), description: '', quantity: '', unit: 'piece' }])} />}>
        {deliverables.map((deliverable, index) => (
          <View key={deliverable.id} style={styles.groupCard}>
            <RemovableRow value={deliverable.description} onChangeText={(text) => updateDeliverable(deliverable.id, { description: text })} placeholder={`Deliverable ${index + 1} (e.g., High-resolution logo in PNG/SVG)`} onRemove={() => setDeliverables((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== deliverable.id)))} removeLabel="Remove deliverable" />
            <View style={styles.row}>
              <TextInput value={deliverable.quantity} onChangeText={(quantity) => updateDeliverable(deliverable.id, { quantity })} placeholder="Qty" keyboardType="number-pad" placeholderTextColor={colors.mutedText} style={[styles.input, styles.qtyInput]} />
              <View style={styles.flex}><ChoicePills scrollable options={DELIVERABLE_UNITS} value={deliverable.unit} onChange={(unit) => updateDeliverable(deliverable.id, { unit })} /></View>
            </View>
          </View>
        ))}
      </FormSection>

      <FormSection title="Acceptance criteria" description="Define how you will verify the task is completed correctly." required action={<AddRowButton label="Add" onPress={() => setAcceptanceCriteria((rows) => [...rows, { id: generateId(), text: '' }])} />}>
        {acceptanceCriteria.map((criterion) => <RemovableRow key={criterion.id} value={criterion.text} onChangeText={(text) => setAcceptanceCriteria((rows) => rows.map((row) => (row.id === criterion.id ? { ...row, text } : row)))} placeholder="e.g., Logo is delivered in vector format with 3 color variations" onRemove={() => setAcceptanceCriteria((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== criterion.id)))} removeLabel="Remove criterion" />)}
      </FormSection>

      <FormSection title="Payment & currency">
        <FormField label="Amount" required keyboardType="decimal-pad" value={paymentAmount} onChangeText={setPaymentAmount} placeholder="0.00" />
        <ChoicePills label="Currency" scrollable options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))} value={paymentCurrency} onChange={setPaymentCurrency} />
        <ChoicePills label="Payment type" options={PAYMENT_TYPES} value={paymentType} onChange={setPaymentType} />
        <ChoiceCards label="Payment timing" options={PAYMENT_TIMING_OPTIONS} value={paymentTiming} onChange={setPaymentTiming} />
        <View style={styles.infoBox}>
          <CreditCard size={16} color={colors.accent} />
          <View style={styles.flex}>
            <Text style={styles.infoTitle}>How payment processing works</Text>
            <Text style={styles.infoText}>{PAYMENT_TIMING_EXPLANATIONS[paymentTiming]}</Text>
          </View>
        </View>
      </FormSection>

      <FormSection title="Duration & deadline">
        <View style={styles.row}>
          <View style={styles.qtyField}><FormField label="Expected duration" required keyboardType="number-pad" value={expectedDuration} onChangeText={setExpectedDuration} placeholder="e.g., 3" /></View>
          <View style={styles.flex}><ChoicePills label="Unit" options={DURATION_UNITS} value={durationUnit} onChange={setDurationUnit} /></View>
        </View>
        <DateTimeField label="Completion deadline" required mode="datetime" value={completionDeadline} onChange={setCompletionDeadline} placeholder="Tasks automatically expire after this deadline" minimumDate={new Date()} />
      </FormSection>

      <FormSection title="Urgency & complexity">
        <ChoiceCards label="Urgency level" options={URGENCY_OPTIONS} value={urgency} onChange={setUrgency} />
        <ChoiceCards label="Complexity" options={COMPLEXITY_OPTIONS} value={complexity} onChange={setComplexity} />
      </FormSection>

      <FormSection title="Task location">
        <ChoiceCards options={LOCATION_TYPES} value={locationType} onChange={setLocationType} />
        {isPhysicalTask ? <>
          <FormField label="Address" value={locationAddress} onChangeText={setLocationAddress} placeholder="Street address" />
          <View style={styles.row}>
            <View style={styles.flex}><FormField label="City" value={locationCity} onChangeText={setLocationCity} placeholder="City" /></View>
            <View style={styles.flex}><FormField label="Country" value={locationCountry} onChangeText={setLocationCountry} placeholder="Country" /></View>
          </View>
          <FormField label="Location notes" value={locationNotes} onChangeText={setLocationNotes} placeholder="e.g., Ring doorbell, use side entrance" />
        </> : null}
      </FormSection>

      <FormSection title="Cancellation terms" description="Define refund policies for different cancellation scenarios." action={<AddRowButton label="Add term" onPress={() => setCancellationTerms((rows) => [...rows, { id: generateId(), trigger: '', refundPercentage: '100', description: '' }])} />}>
        {cancellationTerms.map((term, index) => (
          <View key={term.id} style={styles.groupCard}>
            <ChoicePills label={`Term ${index + 1} trigger`} scrollable options={CANCELLATION_TRIGGERS.map((trigger) => ({ value: trigger, label: trigger }))} value={term.trigger} onChange={(trigger) => updateTerm(term.id, { trigger })} />
            <View style={styles.rowCenter}>
              <TextInput value={term.refundPercentage} onChangeText={(refundPercentage) => updateTerm(term.id, { refundPercentage: refundPercentage.replace(/[^0-9]/g, '').slice(0, 3) })} keyboardType="number-pad" placeholderTextColor={colors.mutedText} style={[styles.input, styles.qtyInput]} accessibilityLabel={`Term ${index + 1} refund percentage`} />
              <Text style={styles.infoText}>% refund</Text>
            </View>
            <RemovableRow value={term.description} onChangeText={(text) => updateTerm(term.id, { description: text })} placeholder="Additional notes about this cancellation term..." onRemove={() => setCancellationTerms((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== term.id)))} removeLabel="Remove cancellation term" />
          </View>
        ))}
      </FormSection>

      {isPhysicalTask ? (
        <FormSection tone="warning" title="Safety requirements" description="Physical tasks require safety details to protect taskers. List any PPE, tools, or safety protocols required." required action={<AddRowButton label="Add requirement" onPress={() => setSafetyRequirements((rows) => [...rows, { id: generateId(), text: '' }])} />}>
          {safetyRequirements.map((requirement) => <RemovableRow key={requirement.id} value={requirement.text} onChangeText={(text) => setSafetyRequirements((rows) => rows.map((row) => (row.id === requirement.id ? { ...row, text } : row)))} placeholder="e.g., Wear hard hat, Bring your own ladder" onRemove={() => setSafetyRequirements((rows) => rows.filter((row) => row.id !== requirement.id))} removeLabel="Remove safety requirement" />)}
          {safetyRequirements.length > 0 ? (
            <AgreementCheckbox tone="warning" checked={safetyAcknowledgment} onChange={setSafetyAcknowledgment}>
              I acknowledge that I am responsible for communicating all safety requirements to the tasker and ensuring a safe working environment.
            </AgreementCheckbox>
          ) : null}
        </FormSection>
      ) : null}

      <FormSection title="Task poster disclaimer" description="Read and accept before creating the task." required>
        <DisclaimerBox text={TASK_POSTER_DISCLAIMER} />
        <AgreementCheckbox checked={isDisclaimerAccepted} onChange={setIsDisclaimerAccepted}>{TASK_POSTER_AGREEMENT}</AgreementCheckbox>
      </FormSection>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <CustomModal
        visible={isLeaveConfirmOpen}
        type="warning"
        title="Discard this task?"
        message="What you've entered will be lost."
        confirmText="Discard"
        cancelText="Keep editing"
        onConfirm={() => { setIsLeaveConfirmOpen(false); closeForm(); }}
        onCancel={() => setIsLeaveConfirmOpen(false)}
        onClose={() => setIsLeaveConfirmOpen(false)}
      />
    </JobFormShell>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowCenter: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: colors.text, backgroundColor: colors.input, fontSize: 14 },
  qtyInput: { width: 76, textAlign: 'center' },
  qtyField: { width: 120 },
  groupCard: { gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  infoBox: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  infoTitle: { color: colors.text, fontWeight: '800', fontSize: 12, marginBottom: 3 },
  infoText: { color: colors.secondaryText, fontSize: 12, lineHeight: 17 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 },
});
