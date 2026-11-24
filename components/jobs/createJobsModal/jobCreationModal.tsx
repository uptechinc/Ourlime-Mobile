import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, ArrowRight, Eye, ImagePlus, Pencil, Send, Trash2 } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { auth } from '@/lib/firebaseConfig';
import { JobsService, type JobCompanyDetails } from '@/lib/job/JobsService';
import {
  ANSWER_TYPES, COMPANY_SIZES, CONTACT_OPTIONS, CURRENCIES, EDUCATION_OPTIONS, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, INDUSTRIES,
  JOB_CATEGORIES, JOB_POSTER_AGREEMENT, JOB_POSTER_DISCLAIMER, LOCATION_TYPES, PAYMENT_PERIODS, labelFor,
  type ContactPreference, type EducationRequirement, type PaymentPeriod, type ScreeningAnswerType, type WorkLocationType,
} from '@/lib/job/JobFormOptions';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useLocalFormDraft } from '@/lib/hooks/useLocalFormDraft';
import SavedDraftBanner from '@/components/drafts/SavedDraftBanner';
import DraftDiscardSheet from '@/components/drafts/DraftDiscardSheet';
import DateTimeField from '@/components/ui/DateTimeField';
import { JOBS_ACTION_GREEN } from '@/components/jobs/JobCardParts';
import JobFormShell, { FooterButton, HeaderTextAction } from './JobFormShell';
import { AddRowButton, AgreementCheckbox, ChipInput, ChoiceCards, ChoicePills, DisclaimerBox, FieldError, FormField, FormSection, RemovableRow, SummaryRow } from './JobFormParts';
import { endOfLocalDay } from '@/lib/job/JobRules';

type JobCreationModalProps = { isOpen: boolean; onClose: () => void; onCreated?: () => void };
type TextRow = { id: string; text: string };
type ScreeningQuestion = { id: string; question: string; answerType: ScreeningAnswerType; options: string[] };

/** Everything typed in the form, kept as an on-device draft (web AUTOSAVE_KEY 'ourlime_job_draft'). */
type JobDraftForm = {
  title: string; description: string; category: string; contactPreference: ContactPreference;
  companyDetails: JobCompanyDetails; priceFrom: string; priceTo: string; currency: string; paymentPeriod: PaymentPeriod;
  skills: string[]; requirements: TextRow[]; deliverables: TextRow[];
  locationDetails: { type: WorkLocationType; address: string; city: string; country: string };
  employmentType: string; experienceLevel: string; educationRequirement: EducationRequirement; closingDate: string | null;
  questions: ScreeningQuestion[];
};

/** The steps of the form; each validation problem belongs to one, so Next only checks what is on screen. */
const JOB_STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'company', label: 'Company' },
  { key: 'pay', label: 'Pay & terms' },
  { key: 'role', label: 'Role details' },
  { key: 'publish', label: 'Review & submit' },
] as const;
type JobStepIndex = 0 | 1 | 2 | 3 | 4;
const LAST_STEP: JobStepIndex = 4;

type JobFormField =
  | 'title' | 'description' | 'category' | 'companyName' | 'authorized' | 'pay' | 'closingDate' | 'location'
  | 'deliverables' | 'requirements' | 'skills';
type JobFormError = { field: JobFormField; message: string };

const FIELD_STEP: { [field in JobFormField]: JobStepIndex } = {
  title: 0, description: 0, category: 0, companyName: 1, authorized: 1, pay: 2, closingDate: 2, location: 2,
  deliverables: 3, requirements: 3, skills: 3,
};

const jobsService = JobsService.getInstance();
const generateId = (): string => Math.random().toString(36).substring(2, 11);
const keepAmount = (value: string): string => value.replace(/[^0-9.]/g, '');
const EMPTY_COMPANY: JobCompanyDetails = { name: '', size: '', industry: '', website: '', logo: '', description: '', benefits: [], isAuthorizedRepresentative: false };
const createEmptyForm = (): JobDraftForm => ({
  title: '', description: '', category: '', contactPreference: 'in_app', companyDetails: EMPTY_COMPANY, priceFrom: '', priceTo: '',
  currency: 'USD', paymentPeriod: 'fixed', skills: [], requirements: [{ id: generateId(), text: '' }], deliverables: [{ id: generateId(), text: '' }],
  locationDetails: { type: 'remote', address: '', city: '', country: '' }, employmentType: '', experienceLevel: '', educationRequirement: 'none',
  closingDate: null, questions: [],
});

/** Restores a saved draft, including ones saved by the app's older single-page job form. */
const normalizeDraft = (saved: Partial<JobDraftForm>): JobDraftForm => {
  const empty = createEmptyForm();
  const rows = (value: unknown, fallback: TextRow[]): TextRow[] => (Array.isArray(value) && value.length ? value.filter((row): row is TextRow => Boolean(row) && typeof row === 'object' && typeof (row as TextRow).text === 'string') : fallback);
  return {
    ...empty,
    ...saved,
    companyDetails: { ...EMPTY_COMPANY, ...(saved.companyDetails && typeof saved.companyDetails === 'object' ? saved.companyDetails : {}), benefits: Array.isArray(saved.companyDetails?.benefits) ? saved.companyDetails.benefits : [] },
    skills: Array.isArray(saved.skills) ? saved.skills.filter((skill): skill is string => typeof skill === 'string') : empty.skills,
    requirements: rows(saved.requirements, empty.requirements),
    deliverables: rows(saved.deliverables, empty.deliverables),
    locationDetails: { ...empty.locationDetails, ...(saved.locationDetails && typeof saved.locationDetails === 'object' ? saved.locationDetails : {}) },
    questions: Array.isArray(saved.questions) ? saved.questions : [],
    closingDate: typeof saved.closingDate === 'string' ? saved.closingDate : null,
  };
};

/**
 * Every problem with the form, in the order (and with the wording) the single-page form reported them, so the first
 * one is exactly what it used to say.
 */
const collectJobFormErrors = (form: JobDraftForm): JobFormError[] => {
  const errors: JobFormError[] = [];
  if (!form.title.trim()) errors.push({ field: 'title', message: 'Job title is required.' });
  if (!form.description.trim()) errors.push({ field: 'description', message: 'Description is required.' });
  if (!form.category) errors.push({ field: 'category', message: 'Category is required.' });
  if (!form.companyDetails.name.trim()) errors.push({ field: 'companyName', message: 'Company name is required.' });
  if (!form.companyDetails.isAuthorizedRepresentative) errors.push({ field: 'authorized', message: 'You must confirm authorization to represent the company.' });
  const from = Number(form.priceFrom);
  const to = Number(form.priceTo);
  if (!form.priceFrom || !form.priceTo) errors.push({ field: 'pay', message: 'Compensation range is required.' });
  else if (!(from > 0) || !(to > 0)) errors.push({ field: 'pay', message: 'Compensation amounts must be greater than zero.' });
  else if (from > to) errors.push({ field: 'pay', message: 'Minimum compensation cannot exceed maximum compensation.' });
  if (form.closingDate && new Date(form.closingDate) <= new Date()) errors.push({ field: 'closingDate', message: 'Closing date must be in the future.' });
  if ((form.locationDetails.type === 'onsite' || form.locationDetails.type === 'hybrid') && (!form.locationDetails.address.trim() || !form.locationDetails.city.trim() || !form.locationDetails.country.trim())) {
    errors.push({ field: 'location', message: 'Location details are required for onsite or hybrid jobs.' });
  }
  if (!form.deliverables.some((row) => row.text.trim())) errors.push({ field: 'deliverables', message: 'At least one responsibility or deliverable is required.' });
  if (!form.requirements.some((row) => row.text.trim())) errors.push({ field: 'requirements', message: 'At least one requirement is required.' });
  if (form.skills.length === 0) errors.push({ field: 'skills', message: 'At least one required skill is needed.' });
  return errors;
};

/** Create Professional Job (web components/jobs/createJobsModel/jobCreationModal.tsx), as five short steps. */
export default function JobCreationModal({ isOpen, onClose, onCreated }: JobCreationModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [form, setForm] = useState<JobDraftForm>(createEmptyForm);
  const [newSkill, setNewSkill] = useState('');
  const [newBenefit, setNewBenefit] = useState('');
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');
  const [step, setStep] = useState<JobStepIndex>(0);
  const [checkedSteps, setCheckedSteps] = useState<JobStepIndex[]>([]);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'pending_review' | 'draft' | null>(null);
  const [isLogoLoading, setIsLogoLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDiscardSheetVisible, setIsDiscardSheetVisible] = useState(false);
  const isSubmitting = pendingStatus !== null;

  const update = <K extends keyof JobDraftForm>(key: K, value: JobDraftForm[K]): void => setForm((current) => ({ ...current, [key]: value }));
  const updateCompany = <K extends keyof JobCompanyDetails>(key: K, value: JobCompanyDetails[K]): void => setForm((current) => ({ ...current, companyDetails: { ...current.companyDetails, [key]: value } }));

  const hasFormContent = Boolean(form.title.trim() || form.description.trim() || form.category || form.companyDetails.name.trim() || form.priceFrom || form.priceTo || form.skills.length);
  const draft = useLocalFormDraft<JobDraftForm>({ ownerId: auth.currentUser?.uid, kind: 'job', data: form, hasContent: hasFormContent, enabled: isOpen });

  const formErrors = collectJobFormErrors(form);
  /** A field's problem, shown once its step has been checked (Next, Preview or Submit) and until it is fixed. */
  const fieldError = (field: JobFormField): string | null => (checkedSteps.includes(FIELD_STEP[field]) ? formErrors.find((entry) => entry.field === field)?.message ?? null : null);
  const disclaimerError = isDisclaimerChecked && !isDisclaimerAccepted ? 'Accept the Job Poster Disclaimer to submit.' : null;

  const resetForm = (): void => {
    setForm(createEmptyForm()); setNewSkill(''); setNewBenefit(''); setIsDisclaimerAccepted(false); setViewMode('form'); setError('');
    setStep(0); setCheckedSteps([]); setIsDisclaimerChecked(false);
  };

  const closeForm = (): void => { resetForm(); onClose(); };
  const handleRequestClose = (): void => {
    if (isSubmitting) return;
    if (!hasFormContent) { closeForm(); return; }
    setIsDiscardSheetVisible(true);
  };

  const markChecked = (steps: JobStepIndex[]): void => setCheckedSteps((current) => [...new Set([...current, ...steps])]);
  const allSteps = (): JobStepIndex[] => JOB_STEPS.map((_entry, index) => index as JobStepIndex);

  /** Full check before Preview or Submit: on a problem, jumps to its step and highlights it. */
  const validateForm = (): string | null => {
    const firstError = formErrors[0];
    if (!firstError) return null;
    markChecked(allSteps());
    setStep(FIELD_STEP[firstError.field]);
    setViewMode('form');
    return firstError.message;
  };

  const handleSubmit = async (status: 'pending_review' | 'draft'): Promise<void> => {
    const userId = auth.currentUser?.uid;
    if (!userId) { setError('Please log in to create a job.'); return; }
    if (status === 'pending_review') {
      const validationError = validateForm();
      if (validationError) { setError(validationError); toast.error(validationError); return; }
      if (!isDisclaimerAccepted) {
        setIsDisclaimerChecked(true); setStep(LAST_STEP); setViewMode('form');
        setError('Please accept the Job Poster Disclaimer before submitting.');
        return;
      }
    } else if (!form.title.trim()) {
      setError('Add a title to save a draft.');
      toast.error('Add a title to save a draft.');
      markChecked([0]); setStep(0); setViewMode('form');
      return;
    }
    setPendingStatus(status);
    setError('');
    try {
      await jobsService.createJob({
        userId,
        jobTitle: form.title.trim(),
        jobDescription: form.description.trim(),
        jobCategory: 'professional',
        category: form.category,
        contactPreference: form.contactPreference,
        priceRange: { from: Number(form.priceFrom) || 0, to: Number(form.priceTo) || 0 },
        currency: form.currency,
        paymentPeriod: form.paymentPeriod,
        location: form.locationDetails,
        skills: form.skills,
        requirements: form.requirements.map((row) => row.text.trim()).filter(Boolean),
        deliverables: form.deliverables.map((row) => row.text.trim()).filter(Boolean),
        employmentType: form.employmentType || undefined,
        experienceLevel: form.experienceLevel || undefined,
        educationRequirement: form.educationRequirement !== 'none' ? form.educationRequirement : undefined,
        closingDate: form.closingDate ?? undefined,
        questions: form.questions
          .filter((question) => question.question.trim())
          .map((question) => ({ question: question.question, answerType: question.answerType, options: question.options })),
        category_specific: { companyDetails: form.companyDetails },
        publicationStatus: status,
        disclaimerAccepted: status === 'draft' ? false : isDisclaimerAccepted,
      });
      toast.success(status === 'draft' ? 'Job saved as draft.' : 'Job submitted for review!');
      void draft.clear();
      closeForm();
      onCreated?.();
    } catch (submitError: unknown) {
      console.error('[JobCreationModal.handleSubmit] Error:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Failed to save job. Please try again.');
    } finally {
      setPendingStatus(null);
    }
  };

  const handlePreview = (): void => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    if (!isDisclaimerAccepted) { setIsDisclaimerChecked(true); setError('Please accept the disclaimer before previewing.'); return; }
    setError('');
    setViewMode('preview');
  };

  const handleNext = (): void => {
    const stepErrors = formErrors.filter((entry) => FIELD_STEP[entry.field] === step);
    markChecked([step]);
    if (stepErrors.length) {
      setError(stepErrors.length === 1 ? stepErrors[0].message : `Fix the ${stepErrors.length} highlighted fields to continue.`);
      return;
    }
    setError('');
    setStep((current) => (current < LAST_STEP ? ((current + 1) as JobStepIndex) : current));
  };

  const handleBack = (): void => {
    setError('');
    setStep((current) => (current > 0 ? ((current - 1) as JobStepIndex) : current));
  };

  const handleAddSkill = (): void => {
    const skill = newSkill.trim();
    if (skill && !form.skills.includes(skill)) update('skills', [...form.skills, skill]);
    setNewSkill('');
  };

  const handleAddBenefit = (): void => {
    const benefit = newBenefit.trim();
    if (benefit) updateCompany('benefits', [...form.companyDetails.benefits, benefit]);
    setNewBenefit('');
  };

  const handlePickLogo = async (): Promise<void> => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setIsLogoLoading(true);
    try { updateCompany('logo', await jobsService.prepareCompanyLogo(asset.uri)); }
    catch (logoError: unknown) {
      console.error('[JobCreationModal.handlePickLogo] Error:', logoError);
      setError(logoError instanceof Error ? logoError.message : 'The logo could not be added.');
    }
    finally { setIsLogoLoading(false); }
  };

  const updateRow = (key: 'requirements' | 'deliverables', id: string, text: string): void =>
    update(key, form[key].map((row) => (row.id === id ? { ...row, text } : row)));
  const removeRow = (key: 'requirements' | 'deliverables', id: string): void => {
    if (form[key].length <= 1) return;
    update(key, form[key].filter((row) => row.id !== id));
  };
  const updateQuestion = (id: string, changes: Partial<ScreeningQuestion>): void =>
    update('questions', form.questions.map((question) => (question.id === id ? { ...question, ...changes } : question)));

  const isRangeInvalid = Boolean(form.priceFrom && form.priceTo && Number(form.priceFrom) > Number(form.priceTo));
  const isPhysical = form.locationDetails.type === 'onsite' || form.locationDetails.type === 'hybrid';
  const locationError = fieldError('location');
  const payLabel = form.priceFrom || form.priceTo ? `${form.currency} ${form.priceFrom || '?'} – ${form.priceTo || '?'} · ${labelFor(PAYMENT_PERIODS, form.paymentPeriod)}` : 'Not set yet';

  const saveDraftAction = <HeaderTextAction label={pendingStatus === 'draft' ? 'Saving…' : 'Save draft'} accessibilityLabel="Save draft on Ourlime" isLoading={pendingStatus === 'draft'} disabled={isSubmitting} onPress={() => void handleSubmit('draft')} />;
  const submitButton = <FooterButton flex={2} label={pendingStatus === 'pending_review' ? 'Submitting…' : 'Submit for review'} isLoading={pendingStatus === 'pending_review'} disabled={isSubmitting} onPress={() => void handleSubmit('pending_review')} icon={<Send size={18} color="#ffffff" />} />;

  if (viewMode === 'preview') {
    const deliverables = form.deliverables.filter((row) => row.text.trim());
    const requirements = form.requirements.filter((row) => row.text.trim());
    const questions = form.questions.filter((question) => question.question.trim());
    return (
      <JobFormShell
        visible={isOpen}
        title="Preview listing"
        description="This is how applicants will see your listing."
        onClose={() => setViewMode('form')}
        headerAction={saveDraftAction}
        contentKey="preview"
        errorMessage={error}
        footer={<><FooterButton label="Edit" variant="secondary" disabled={isSubmitting} onPress={() => setViewMode('form')} icon={<Pencil size={16} color={colors.text} />} />{submitButton}</>}
      >
        <View style={styles.previewCard}>
          <View style={styles.previewHeaderRow}>
            {form.companyDetails.logo ? <Image source={{ uri: form.companyDetails.logo }} style={styles.previewLogo} resizeMode="cover" accessibilityLabel={`${form.companyDetails.name} logo`} /> : <View style={[styles.previewLogo, styles.previewLogoFallback]}><Text style={styles.previewLogoLetter}>{(form.companyDetails.name.trim().charAt(0) || '?').toUpperCase()}</Text></View>}
            <View style={styles.flex}>
              <Text style={styles.previewTitle}>{form.title || 'Untitled job'}</Text>
              <Text numberOfLines={1} style={styles.muted}>{form.companyDetails.name || 'Company not set'}</Text>
            </View>
          </View>
          {form.category ? <View style={styles.categoryBadge}><Text numberOfLines={1} style={styles.categoryBadgeText}>{form.category}</Text></View> : null}
          <Text style={styles.previewBody}>{form.description || 'No description provided.'}</Text>
        </View>
        <View style={styles.previewCard}>
          <Text style={styles.previewHeading}>At a glance</Text>
          <SummaryRow label="Pay" value={payLabel} />
          <SummaryRow label="Location" value={isPhysical ? `${labelFor(LOCATION_TYPES, form.locationDetails.type)} · ${[form.locationDetails.address, form.locationDetails.city, form.locationDetails.country].filter(Boolean).join(', ')}` : labelFor(LOCATION_TYPES, form.locationDetails.type)} />
          {form.employmentType ? <SummaryRow label="Employment" value={labelFor(EMPLOYMENT_TYPES, form.employmentType)} /> : null}
          {form.experienceLevel ? <SummaryRow label="Experience" value={labelFor(EXPERIENCE_LEVELS, form.experienceLevel)} /> : null}
          {form.educationRequirement !== 'none' ? <SummaryRow label="Education" value={labelFor(EDUCATION_OPTIONS, form.educationRequirement)} /> : null}
          <SummaryRow label="Closes" value={form.closingDate ? new Date(form.closingDate).toLocaleDateString() : 'Stays open'} />
          <SummaryRow label="Contact" value={labelFor(CONTACT_OPTIONS, form.contactPreference)} />
        </View>
        <View style={styles.previewCard}>
          <Text style={styles.previewHeading}>Company</Text>
          {form.companyDetails.industry ? <SummaryRow label="Industry" value={form.companyDetails.industry} /> : null}
          {form.companyDetails.size ? <SummaryRow label="Size" value={labelFor(COMPANY_SIZES, form.companyDetails.size)} /> : null}
          {form.companyDetails.website ? <SummaryRow label="Website" value={form.companyDetails.website} /> : null}
          {form.companyDetails.description ? <Text style={styles.previewBody}>{form.companyDetails.description}</Text> : null}
          {form.companyDetails.benefits.length ? <View style={styles.chipRow}>{form.companyDetails.benefits.map((benefit, index) => <View key={`${benefit}-${index}`} style={styles.neutralChip}><Text numberOfLines={1} style={styles.neutralChipText}>{benefit}</Text></View>)}</View> : null}
        </View>
        {form.skills.length ? <View style={styles.previewCard}><Text style={styles.previewHeading}>Required skills</Text><View style={styles.chipRow}>{form.skills.map((skill) => <View key={skill} style={styles.greenChip}><Text numberOfLines={1} style={styles.greenChipText}>{skill}</Text></View>)}</View></View> : null}
        {deliverables.length ? <View style={styles.previewCard}><Text style={styles.previewHeading}>Responsibilities</Text>{deliverables.map((row) => <Text key={row.id} style={styles.previewBody}>• {row.text}</Text>)}</View> : null}
        {requirements.length ? <View style={styles.previewCard}><Text style={styles.previewHeading}>Requirements</Text>{requirements.map((row) => <Text key={row.id} style={styles.previewBody}>• {row.text}</Text>)}</View> : null}
        {questions.length ? <View style={styles.previewCard}><Text style={styles.previewHeading}>Screening questions</Text>{questions.map((question, index) => <Text key={question.id} style={styles.previewBody}>{index + 1}. {question.question} <Text style={styles.muted}>({labelFor(ANSWER_TYPES, question.answerType)})</Text></Text>)}</View> : null}
      </JobFormShell>
    );
  }

  const nextStep = step < LAST_STEP ? JOB_STEPS[step + 1] : null;
  const footer = step === LAST_STEP
    ? <><FooterButton label="Back" variant="secondary" disabled={isSubmitting} onPress={handleBack} icon={<ArrowLeft size={16} color={colors.text} />} />{submitButton}</>
    : <>
      {step > 0 ? <FooterButton label="Back" variant="secondary" disabled={isSubmitting} onPress={handleBack} icon={<ArrowLeft size={16} color={colors.text} />} /> : null}
      <FooterButton flex={2} label="Next" accessibilityLabel={nextStep ? `Next: ${nextStep.label}` : 'Next'} disabled={isSubmitting} onPress={handleNext} icon={<ArrowRight size={18} color="#ffffff" />} />
    </>;

  return (
    <JobFormShell
      visible={isOpen}
      title="Post a job"
      description="Fields marked * are required. Progress is kept on this device."
      onClose={handleRequestClose}
      headerAction={saveDraftAction}
      progress={{ current: step + 1, total: JOB_STEPS.length, label: JOB_STEPS[step].label, nextLabel: nextStep?.label }}
      contentKey={`step-${step}`}
      errorMessage={error}
      footer={footer}
    >
      {step === 0 ? <>
        {draft.savedDraft ? <SavedDraftBanner title="A saved draft of this job is available" savedAt={draft.savedAt} onRestore={() => { const restored = draft.restore(); if (restored) setForm(normalizeDraft(restored)); }} onDiscard={() => void draft.discard()} /> : null}
        <FormSection title="About the job" description="A clear title and description get more of the right applicants.">
          <FormField label="Job title" required value={form.title} onChangeText={(value) => update('title', value)} placeholder="e.g., Junior IT Support Technician" maxLength={300} error={fieldError('title')} />
          <ChoicePills label="Category" required options={JOB_CATEGORIES.map((category) => ({ value: category, label: category }))} value={form.category} onChange={(value) => update('category', value)} error={fieldError('category')} />
          <FormField label="Description" required multiline value={form.description} onChangeText={(value) => update('description', value)} placeholder="What the role involves, who it suits and what a typical week looks like" hint="Plain sentences work best; you'll list responsibilities in step 4." error={fieldError('description')} />
        </FormSection>
        <FormSection title="How applicants reach you">
          <ChoiceCards options={CONTACT_OPTIONS} value={form.contactPreference} onChange={(value) => update('contactPreference', value)} />
        </FormSection>
      </> : null}

      {step === 1 ? <>
        <FormSection title="Company" description="Only the company name is required.">
          <FormField label="Company name" required autoCapitalize="words" value={form.companyDetails.name} onChangeText={(value) => updateCompany('name', value)} placeholder="e.g., Acme Corp" error={fieldError('companyName')} />
          <View style={styles.logoField}>
            <Text style={styles.label}>Company logo <Text style={styles.optional}>(optional)</Text></Text>
            {form.companyDetails.logo ? (
              <View style={styles.logoRow}>
                <Image source={{ uri: form.companyDetails.logo }} style={styles.logoImage} resizeMode="cover" accessibilityLabel="Company logo" />
                <View style={styles.flex}><Text style={styles.logoTitle}>Logo added</Text><Text style={styles.muted}>Shown next to your listing.</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Replace logo" onPress={() => void handlePickLogo()} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={styles.logoAction}><Text style={styles.logoActionText}>Replace</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Remove logo" onPress={() => updateCompany('logo', '')} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={[styles.logoAction, styles.logoRemove]}><Trash2 size={18} color={colors.destructiveText} /></Pressable>
              </View>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="Upload company logo" accessibilityState={{ busy: isLogoLoading }} disabled={isLogoLoading} onPress={() => void handlePickLogo()} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={styles.logoUpload}>
                {isLogoLoading ? <ActivityIndicator color={JOBS_ACTION_GREEN} /> : <ImagePlus size={24} color={colors.icon} />}
                <Text style={styles.logoTitle}>{isLogoLoading ? 'Adding logo…' : 'Upload company logo'}</Text>
                <Text style={styles.muted}>PNG or JPG. A square image works best.</Text>
              </Pressable>
            )}
          </View>
          <ChoicePills label="Company size" optional allowClear options={COMPANY_SIZES} value={form.companyDetails.size} onChange={(value) => updateCompany('size', value)} hint="Tap a selected option again to clear it." />
          <ChoicePills label="Industry" optional allowClear options={INDUSTRIES.map((industry) => ({ value: industry, label: industry }))} value={form.companyDetails.industry} onChange={(value) => updateCompany('industry', value)} />
          <FormField label="Website" optional keyboardType="url" value={form.companyDetails.website} onChangeText={(value) => updateCompany('website', value)} placeholder="https://example.com" />
          <FormField label="About the company" optional multiline value={form.companyDetails.description} onChangeText={(value) => updateCompany('description', value)} placeholder="A few lines about what the company does" />
          <ChipInput label="Benefits" items={form.companyDetails.benefits} inputValue={newBenefit} onInputChange={setNewBenefit} onAdd={handleAddBenefit} onRemove={(index) => updateCompany('benefits', form.companyDetails.benefits.filter((_, benefitIndex) => benefitIndex !== index))} placeholder="e.g., Health insurance" hint="Add one at a time." />
        </FormSection>
        <AgreementCheckbox tone="warning" checked={form.companyDetails.isAuthorizedRepresentative} onChange={(checked) => updateCompany('isAuthorizedRepresentative', checked)} error={fieldError('authorized')}>
          I confirm that I am authorized to represent this company and post jobs on its behalf. I understand that posting unauthorized listings may result in account suspension. *
        </AgreementCheckbox>
      </> : null}

      {step === 2 ? <>
        <FormSection title="Compensation" description="The pay range applicants will see on the listing." required>
          <View style={styles.row}>
            <View style={styles.flex}><FormField label="From" required keyboardType="decimal-pad" value={form.priceFrom} onChangeText={(value) => update('priceFrom', keepAmount(value))} placeholder="Min" /></View>
            <View style={styles.flex}><FormField label="To" required keyboardType="decimal-pad" value={form.priceTo} onChangeText={(value) => update('priceTo', keepAmount(value))} placeholder="Max" /></View>
          </View>
          <FieldError message={fieldError('pay') ?? (isRangeInvalid ? 'The minimum is higher than the maximum.' : null)} />
          <ChoicePills label="Currency" options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))} value={form.currency} onChange={(value) => update('currency', value)} />
          <ChoicePills label="Paid" options={PAYMENT_PERIODS} value={form.paymentPeriod} onChange={(value) => update('paymentPeriod', value)} />
        </FormSection>
        <FormSection title="Work location" error={locationError}>
          <ChoiceCards options={LOCATION_TYPES} value={form.locationDetails.type} onChange={(type) => update('locationDetails', { ...form.locationDetails, type })} />
          {isPhysical ? <>
            <FormField label="Address" required autoCapitalize="words" value={form.locationDetails.address} onChangeText={(address) => update('locationDetails', { ...form.locationDetails, address })} placeholder="Street address" error={locationError && !form.locationDetails.address.trim() ? 'Add the street address.' : null} />
            <View style={styles.row}>
              <View style={styles.flex}><FormField label="City" required autoCapitalize="words" value={form.locationDetails.city} onChangeText={(city) => update('locationDetails', { ...form.locationDetails, city })} placeholder="City" error={locationError && !form.locationDetails.city.trim() ? 'Add the city.' : null} /></View>
              <View style={styles.flex}><FormField label="Country" required autoCapitalize="words" value={form.locationDetails.country} onChangeText={(country) => update('locationDetails', { ...form.locationDetails, country })} placeholder="Country" error={locationError && !form.locationDetails.country.trim() ? 'Add the country.' : null} /></View>
            </View>
          </> : null}
        </FormSection>
        <FormSection title="Employment & experience" description="Optional, but they help applicants filter.">
          <ChoicePills label="Employment type" optional allowClear options={EMPLOYMENT_TYPES} value={form.employmentType} onChange={(value) => update('employmentType', value)} />
          <ChoicePills label="Experience level" optional allowClear options={EXPERIENCE_LEVELS} value={form.experienceLevel} onChange={(value) => update('experienceLevel', value)} />
          <ChoicePills label="Education" options={EDUCATION_OPTIONS} value={form.educationRequirement} onChange={(value) => update('educationRequirement', value)} />
          <View style={styles.field}>
            <DateTimeField label="Closing date" mode="date" value={form.closingDate ? new Date(form.closingDate) : null} onChange={(date) => update('closingDate', endOfLocalDay(date).toISOString())} onClear={() => update('closingDate', null)} placeholder="No closing date" minimumDate={new Date()} />
            {fieldError('closingDate') ? <FieldError message={fieldError('closingDate')} /> : <Text style={styles.muted}>Leave empty to keep the job open until you close it.</Text>}
          </View>
        </FormSection>
      </> : null}

      {step === 3 ? <>
        <FormSection title="Responsibilities" description="What the hire will be responsible for, one per line." required error={fieldError('deliverables')} action={<AddRowButton label="Add" accessibilityLabel="Add a responsibility" onPress={() => update('deliverables', [...form.deliverables, { id: generateId(), text: '' }])} />}>
          {form.deliverables.map((row, index) => <RemovableRow key={row.id} multiline value={row.text} onChangeText={(text) => updateRow('deliverables', row.id, text)} placeholder="e.g., Design the landing page mockups" accessibilityLabel={`Responsibility ${index + 1}`} canRemove={form.deliverables.length > 1} onRemove={() => removeRow('deliverables', row.id)} removeLabel={`Remove responsibility ${index + 1}`} />)}
        </FormSection>
        <FormSection title="Requirements" description="Experience or qualifications applicants should have." required error={fieldError('requirements')} action={<AddRowButton label="Add" accessibilityLabel="Add a requirement" onPress={() => update('requirements', [...form.requirements, { id: generateId(), text: '' }])} />}>
          {form.requirements.map((row, index) => <RemovableRow key={row.id} multiline value={row.text} onChangeText={(text) => updateRow('requirements', row.id, text)} placeholder="e.g., 3+ years of experience in React" accessibilityLabel={`Requirement ${index + 1}`} canRemove={form.requirements.length > 1} onRemove={() => removeRow('requirements', row.id)} removeLabel={`Remove requirement ${index + 1}`} />)}
        </FormSection>
        <FormSection title="Required skills" required>
          <ChipInput label="Skills" required items={form.skills} inputValue={newSkill} onInputChange={setNewSkill} onAdd={handleAddSkill} onRemove={(index) => update('skills', form.skills.filter((_, skillIndex) => skillIndex !== index))} placeholder="e.g., Customer support" hint="Type a skill, then tap + or Done. Add as many as you need." emptyText="No skills added yet." error={fieldError('skills')} />
        </FormSection>
      </> : null}

      {step === LAST_STEP ? <>
        <FormSection title="Screening questions" description="Optional questions applicants answer when they apply." action={<AddRowButton label="Add" accessibilityLabel="Add a screening question" onPress={() => update('questions', [...form.questions, { id: generateId(), question: '', answerType: 'input', options: [] }])} />}>
          {form.questions.length === 0 ? <Text style={styles.emptyQuestions}>No screening questions. Applicants just send their application.</Text> : form.questions.map((question, questionIndex) => (
            <View key={question.id} style={styles.questionCard}>
              <Text style={styles.questionLabel}>Question {questionIndex + 1}</Text>
              <RemovableRow multiline value={question.question} onChangeText={(text) => updateQuestion(question.id, { question: text })} placeholder="e.g., Are you available on weekends?" accessibilityLabel={`Question ${questionIndex + 1}`} onRemove={() => update('questions', form.questions.filter((entry) => entry.id !== question.id))} removeLabel={`Remove question ${questionIndex + 1}`} />
              <ChoicePills label="Answer type" options={ANSWER_TYPES} value={question.answerType} onChange={(answerType) => updateQuestion(question.id, { answerType, options: answerType === 'input' ? [] : question.options })} />
              {question.answerType !== 'input' ? (
                <View style={styles.optionsBlock}>
                  <Text style={styles.questionLabel}>Choices</Text>
                  {question.options.length === 0 ? <Text style={styles.muted}>Add the choices applicants pick from.</Text> : null}
                  {question.options.map((option, optionIndex) => (
                    <RemovableRow key={`${question.id}-${optionIndex}`} value={option} onChangeText={(text) => updateQuestion(question.id, { options: question.options.map((entry, index) => (index === optionIndex ? text : entry)) })} placeholder={`Choice ${optionIndex + 1}`} onRemove={() => updateQuestion(question.id, { options: question.options.filter((_, index) => index !== optionIndex) })} removeLabel={`Remove choice ${optionIndex + 1}`} />
                  ))}
                  <View style={styles.alignStart}><AddRowButton label="Add choice" onPress={() => updateQuestion(question.id, { options: [...question.options, ''] })} /></View>
                </View>
              ) : null}
            </View>
          ))}
        </FormSection>

        <FormSection title="Summary">
          <SummaryRow label="Title" value={form.title || 'Not set'} />
          <SummaryRow label="Company" value={form.companyDetails.name || 'Not set'} />
          <SummaryRow label="Pay" value={payLabel} />
          <SummaryRow label="Location" value={labelFor(LOCATION_TYPES, form.locationDetails.type)} />
          <Pressable accessibilityRole="button" accessibilityLabel="Preview how applicants will see your listing" disabled={isSubmitting} onPress={handlePreview} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={styles.previewButton}>
            <Eye size={18} color={colors.accentText} />
            <Text numberOfLines={1} style={styles.previewButtonText}>Preview listing</Text>
          </Pressable>
        </FormSection>

        <FormSection title="Job poster disclaimer" description="Read and accept before submitting." required>
          <DisclaimerBox text={JOB_POSTER_DISCLAIMER} />
          <AgreementCheckbox checked={isDisclaimerAccepted} onChange={setIsDisclaimerAccepted} error={disclaimerError}>{JOB_POSTER_AGREEMENT}</AgreementCheckbox>
          <Text style={styles.muted}>Ourlime reviews new listings before they go live. You can follow its status in Manage jobs.</Text>
        </FormSection>
      </> : null}

      <DraftDiscardSheet
        visible={isDiscardSheetVisible}
        title="Leave this job?"
        message="Save a draft on this device to finish it later, or discard what you've entered."
        onSaveDraft={() => { void draft.saveNow().then(() => { setIsDiscardSheetVisible(false); resetForm(); onClose(); }); }}
        onDiscard={() => { setIsDiscardSheetVisible(false); void draft.clear(); closeForm(); }}
        onContinue={() => setIsDiscardSheetVisible(false)}
      />
    </JobFormShell>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  field: { gap: 6 },
  alignStart: { alignSelf: 'flex-start' },
  label: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  optional: { color: colors.mutedText, fontWeight: '600' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  logoField: { gap: 6 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.input },
  logoImage: { width: 56, height: 56, borderRadius: 12 },
  logoTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  logoAction: { minHeight: 44, minWidth: 44, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.control },
  logoRemove: { paddingHorizontal: 0, backgroundColor: colors.destructiveSurface },
  logoActionText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  logoUpload: { alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', paddingVertical: 22, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.input },
  emptyQuestions: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingVertical: 16, paddingHorizontal: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 12 },
  questionCard: { gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  questionLabel: { color: colors.secondaryText, fontSize: 12, fontWeight: '900' },
  optionsBlock: { gap: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border },
  previewButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface, paddingHorizontal: 12 },
  previewButtonText: { flexShrink: 1, color: colors.accentText, fontSize: 15, fontWeight: '800' },
  previewCard: { gap: 8, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  previewHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewTitle: { color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '900' },
  previewHeading: { color: colors.text, fontSize: 15, fontWeight: '900' },
  previewBody: { color: colors.secondaryText, fontSize: 14, lineHeight: 20 },
  previewLogo: { width: 52, height: 52, borderRadius: 14 },
  previewLogoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface },
  previewLogoLetter: { color: colors.successText, fontSize: 20, fontWeight: '900' },
  categoryBadge: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  categoryBadgeText: { color: colors.successText, fontSize: 12, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  neutralChip: { maxWidth: '100%', backgroundColor: colors.control, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  neutralChipText: { color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
  greenChip: { maxWidth: '100%', backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  greenChipText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
});
