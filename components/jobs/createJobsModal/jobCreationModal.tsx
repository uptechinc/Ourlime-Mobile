import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Eye, ImagePlus, Save, Send, Trash2 } from 'lucide-react-native';
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
import JobFormShell, { FooterButton } from './JobFormShell';
import { AddRowButton, AgreementCheckbox, ChipInput, ChoiceCards, ChoicePills, DisclaimerBox, FormField, FormSection, RemovableRow } from './JobFormParts';

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

const jobsService = JobsService.getInstance();
const generateId = (): string => Math.random().toString(36).substring(2, 11);
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

/** Create Professional Job (web components/jobs/createJobsModel/jobCreationModal.tsx). */
export default function JobCreationModal({ isOpen, onClose, onCreated }: JobCreationModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [form, setForm] = useState<JobDraftForm>(createEmptyForm);
  const [newSkill, setNewSkill] = useState('');
  const [newBenefit, setNewBenefit] = useState('');
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');
  const [pendingStatus, setPendingStatus] = useState<'pending_review' | 'draft' | null>(null);
  const [isLogoLoading, setIsLogoLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDiscardSheetVisible, setIsDiscardSheetVisible] = useState(false);
  const isSubmitting = pendingStatus !== null;

  const update = <K extends keyof JobDraftForm>(key: K, value: JobDraftForm[K]): void => setForm((current) => ({ ...current, [key]: value }));
  const updateCompany = <K extends keyof JobCompanyDetails>(key: K, value: JobCompanyDetails[K]): void => setForm((current) => ({ ...current, companyDetails: { ...current.companyDetails, [key]: value } }));

  const hasFormContent = Boolean(form.title.trim() || form.description.trim() || form.category || form.companyDetails.name.trim() || form.priceFrom || form.priceTo || form.skills.length);
  const draft = useLocalFormDraft<JobDraftForm>({ ownerId: auth.currentUser?.uid, kind: 'job', data: form, hasContent: hasFormContent, enabled: isOpen });

  const resetForm = (): void => {
    setForm(createEmptyForm()); setNewSkill(''); setNewBenefit(''); setIsDisclaimerAccepted(false); setViewMode('form'); setError('');
  };

  const closeForm = (): void => { resetForm(); onClose(); };
  const handleRequestClose = (): void => {
    if (isSubmitting) return;
    if (!hasFormContent) { closeForm(); return; }
    setIsDiscardSheetVisible(true);
  };

  const validateForm = (): string | null => {
    if (!form.title.trim()) return 'Job title is required.';
    if (!form.description.trim()) return 'Description is required.';
    if (!form.category) return 'Category is required.';
    if (!form.companyDetails.name.trim()) return 'Company name is required.';
    if (!form.companyDetails.isAuthorizedRepresentative) return 'You must confirm authorization to represent the company.';
    if (!form.priceFrom || !form.priceTo) return 'Compensation range is required.';
    const from = Number(form.priceFrom);
    const to = Number(form.priceTo);
    if (!(from > 0) || !(to > 0)) return 'Compensation amounts must be greater than zero.';
    if (from > to) return 'Minimum compensation cannot exceed maximum compensation.';
    if (form.closingDate && new Date(form.closingDate) <= new Date()) return 'Closing date must be in the future.';
    if ((form.locationDetails.type === 'onsite' || form.locationDetails.type === 'hybrid') && (!form.locationDetails.address.trim() || !form.locationDetails.city.trim() || !form.locationDetails.country.trim())) {
      return 'Location details are required for onsite or hybrid jobs.';
    }
    if (!form.deliverables.some((row) => row.text.trim())) return 'At least one responsibility or deliverable is required.';
    if (!form.requirements.some((row) => row.text.trim())) return 'At least one requirement is required.';
    if (form.skills.length === 0) return 'At least one required skill is needed.';
    return null;
  };

  const handleSubmit = async (status: 'pending_review' | 'draft'): Promise<void> => {
    const userId = auth.currentUser?.uid;
    if (!userId) { setError('Please log in to create a job.'); return; }
    if (status === 'pending_review') {
      const validationError = validateForm();
      if (validationError) { setError(validationError); toast.error(validationError); return; }
      if (!isDisclaimerAccepted) { setError('Please accept the Job Poster Disclaimer before submitting.'); return; }
    } else if (!form.title.trim()) {
      setError('Add a title to save a draft.');
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
    if (!isDisclaimerAccepted) { setError('Please accept the disclaimer before previewing.'); return; }
    setError('');
    setViewMode('preview');
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
    catch (logoError: unknown) { setError(logoError instanceof Error ? logoError.message : 'The logo could not be added.'); }
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

  const saveDraftButton = <FooterButton label={pendingStatus === 'draft' ? 'Saving…' : 'Save draft'} variant="secondary" disabled={isSubmitting} onPress={() => void handleSubmit('draft')} icon={<Save size={16} color={colors.text} />} />;
  const submitButton = <FooterButton label={pendingStatus === 'pending_review' ? 'Submitting…' : 'Submit for review'} disabled={isSubmitting || !isDisclaimerAccepted} onPress={() => void handleSubmit('pending_review')} icon={pendingStatus === 'pending_review' ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Send size={16} color={colors.onAccent} />} />;

  if (viewMode === 'preview') {
    const deliverables = form.deliverables.filter((row) => row.text.trim());
    const requirements = form.requirements.filter((row) => row.text.trim());
    const questions = form.questions.filter((question) => question.question.trim());
    return (
      <JobFormShell
        visible={isOpen}
        title="Preview job listing"
        description="This is how applicants will see your listing."
        onClose={() => setViewMode('form')}
        footer={<><FooterButton label="Edit" variant="ghost" disabled={isSubmitting} onPress={() => setViewMode('form')} icon={<ArrowLeft size={16} color={colors.mutedText} />} />{saveDraftButton}{submitButton}</>}
      >
        <View style={styles.previewCard}>
          {form.category ? <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{form.category}</Text></View> : null}
          <Text style={styles.previewTitle}>{form.title || 'Untitled Job'}</Text>
          <Text style={styles.previewBody}>{form.description || 'No description provided.'}</Text>
        </View>
        <View style={styles.previewCard}>
          <Text style={styles.previewHeading}>Company</Text>
          {form.companyDetails.logo ? <Image source={{ uri: form.companyDetails.logo }} style={styles.previewLogo} /> : null}
          <PreviewRow label="Name" value={form.companyDetails.name || 'Not specified'} />
          {form.companyDetails.industry ? <PreviewRow label="Industry" value={form.companyDetails.industry} /> : null}
          {form.companyDetails.size ? <PreviewRow label="Size" value={form.companyDetails.size} /> : null}
          {form.companyDetails.website ? <PreviewRow label="Website" value={form.companyDetails.website} /> : null}
          {form.companyDetails.description ? <Text style={styles.previewBody}>{form.companyDetails.description}</Text> : null}
          {form.companyDetails.benefits.length ? <View style={styles.chipRow}>{form.companyDetails.benefits.map((benefit, index) => <View key={`${benefit}-${index}`} style={styles.neutralChip}><Text style={styles.neutralChipText}>{benefit}</Text></View>)}</View> : null}
        </View>
        <View style={styles.previewCard}>
          <Text style={styles.previewHeading}>Compensation</Text>
          <Text style={styles.previewBody}>{form.currency} {form.priceFrom || '?'} - {form.priceTo || '?'} ({labelFor(PAYMENT_PERIODS, form.paymentPeriod)})</Text>
          <Text style={[styles.previewHeading, styles.previewSpacer]}>Details</Text>
          <PreviewRow label="Location" value={labelFor(LOCATION_TYPES, form.locationDetails.type)} />
          {isPhysical ? <PreviewRow label="Address" value={[form.locationDetails.address, form.locationDetails.city, form.locationDetails.country].filter(Boolean).join(', ')} /> : null}
          {form.employmentType ? <PreviewRow label="Employment" value={labelFor(EMPLOYMENT_TYPES, form.employmentType)} /> : null}
          {form.experienceLevel ? <PreviewRow label="Experience" value={labelFor(EXPERIENCE_LEVELS, form.experienceLevel)} /> : null}
          {form.educationRequirement !== 'none' ? <PreviewRow label="Education" value={labelFor(EDUCATION_OPTIONS, form.educationRequirement)} /> : null}
          {form.closingDate ? <PreviewRow label="Closes" value={new Date(form.closingDate).toLocaleDateString()} /> : null}
          <PreviewRow label="Contact" value={labelFor(CONTACT_OPTIONS, form.contactPreference)} />
        </View>
        {form.skills.length ? <View style={styles.previewCard}><Text style={styles.previewHeading}>Required skills</Text><View style={styles.chipRow}>{form.skills.map((skill) => <View key={skill} style={styles.greenChip}><Text style={styles.greenChipText}>{skill}</Text></View>)}</View></View> : null}
        {deliverables.length ? <View style={styles.previewCard}><Text style={styles.previewHeading}>Responsibilities / Deliverables</Text>{deliverables.map((row) => <Text key={row.id} style={styles.previewBody}>• {row.text}</Text>)}</View> : null}
        {requirements.length ? <View style={styles.previewCard}><Text style={styles.previewHeading}>Requirements</Text>{requirements.map((row) => <Text key={row.id} style={styles.previewBody}>• {row.text}</Text>)}</View> : null}
        {questions.length ? <View style={styles.previewCard}><Text style={styles.previewHeading}>Screening questions</Text>{questions.map((question, index) => <Text key={question.id} style={styles.previewBody}>{index + 1}. {question.question} <Text style={styles.muted}>({labelFor(ANSWER_TYPES, question.answerType)})</Text></Text>)}</View> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </JobFormShell>
    );
  }

  return (
    <JobFormShell
      visible={isOpen}
      title="Create Professional Job"
      description="Fields marked * are required. Your progress is saved as a draft on this device."
      onClose={handleRequestClose}
      footer={<>{saveDraftButton}<FooterButton label="Preview" variant="secondary" disabled={isSubmitting} onPress={handlePreview} icon={<Eye size={16} color={colors.text} />} />{submitButton}</>}
    >
      {draft.savedDraft ? <SavedDraftBanner title="A saved draft of this job is available" savedAt={draft.savedAt} onRestore={() => { const restored = draft.restore(); if (restored) setForm(normalizeDraft(restored)); }} onDiscard={() => void draft.discard()} /> : null}

      <FormSection title="Basic information">
        <FormField label="Job title" required value={form.title} onChangeText={(value) => update('title', value)} placeholder="Enter a clear title for your job" maxLength={300} />
        <ChoicePills label="Category" required scrollable options={JOB_CATEGORIES.map((category) => ({ value: category, label: category }))} value={form.category} onChange={(value) => update('category', value)} />
        <FormField label="Description" required multiline value={form.description} onChangeText={(value) => update('description', value)} placeholder="Provide a detailed description of the job" />
        <ChoiceCards label="Contact preferences" options={CONTACT_OPTIONS} value={form.contactPreference} onChange={(value) => update('contactPreference', value)} />
      </FormSection>

      <FormSection title="Company details" description="Required for professional job listings. Only the company name is mandatory.">
        <FormField label="Company name" required value={form.companyDetails.name} onChangeText={(value) => updateCompany('name', value)} placeholder="e.g., Acme Corp" />
        <ChoicePills label="Company size" allowClear scrollable options={COMPANY_SIZES} value={form.companyDetails.size} onChange={(value) => updateCompany('size', value)} />
        <ChoicePills label="Industry" allowClear scrollable options={INDUSTRIES.map((industry) => ({ value: industry, label: industry }))} value={form.companyDetails.industry} onChange={(value) => updateCompany('industry', value)} />
        <FormField label="Website" keyboardType="url" value={form.companyDetails.website} onChangeText={(value) => updateCompany('website', value)} placeholder="https://example.com" />
        <View style={styles.logoField}>
          <Text style={styles.label}>Company logo</Text>
          {form.companyDetails.logo ? (
            <View style={styles.logoRow}>
              <Image source={{ uri: form.companyDetails.logo }} style={styles.logoImage} />
              <View style={styles.flex}><Text style={styles.logoTitle}>Logo added</Text><Text style={styles.muted}>Shown next to your listing.</Text></View>
              <TouchableOpacity onPress={() => void handlePickLogo()} style={styles.logoAction}><Text style={styles.logoActionText}>Replace</Text></TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Remove logo" onPress={() => updateCompany('logo', '')} style={styles.logoAction}><Trash2 size={16} color={colors.destructiveText} /></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity accessibilityRole="button" onPress={() => void handlePickLogo()} style={styles.logoUpload}>
              {isLogoLoading ? <ActivityIndicator color={colors.accent} /> : <ImagePlus size={22} color={colors.icon} />}
              <Text style={styles.logoTitle}>Upload company logo</Text>
              <Text style={styles.muted}>PNG or JPG. A square image works best.</Text>
            </TouchableOpacity>
          )}
        </View>
        <FormField label="Company description" multiline value={form.companyDetails.description} onChangeText={(value) => updateCompany('description', value)} placeholder="Brief description of your company..." />
        <ChipInput label="Benefits" items={form.companyDetails.benefits} inputValue={newBenefit} onInputChange={setNewBenefit} onAdd={handleAddBenefit} onRemove={(index) => updateCompany('benefits', form.companyDetails.benefits.filter((_, benefitIndex) => benefitIndex !== index))} placeholder="Add a benefit (e.g., Health Insurance)" />
        <AgreementCheckbox tone="warning" checked={form.companyDetails.isAuthorizedRepresentative} onChange={(checked) => updateCompany('isAuthorizedRepresentative', checked)}>
          I confirm that I am authorized to represent this company and post jobs on its behalf. I understand that posting unauthorized listings may result in account suspension. *
        </AgreementCheckbox>
      </FormSection>

      <FormSection title="Compensation" description="The pay range applicants will see on the listing.">
        <View style={styles.row}>
          <View style={styles.flex}><FormField label="Salary from" required keyboardType="decimal-pad" value={form.priceFrom} onChangeText={(value) => update('priceFrom', value)} placeholder="Min" /></View>
          <View style={styles.flex}><FormField label="Salary to" required keyboardType="decimal-pad" value={form.priceTo} onChangeText={(value) => update('priceTo', value)} placeholder="Max" error={isRangeInvalid ? 'Min cannot exceed max' : null} /></View>
        </View>
        <ChoicePills label="Currency" scrollable options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))} value={form.currency} onChange={(value) => update('currency', value)} />
        <ChoicePills label="Payment period" options={PAYMENT_PERIODS} value={form.paymentPeriod} onChange={(value) => update('paymentPeriod', value)} />
      </FormSection>

      <FormSection title="Responsibilities / Deliverables" description="What the hire will be responsible for." required action={<AddRowButton label="Add" onPress={() => update('deliverables', [...form.deliverables, { id: generateId(), text: '' }])} />}>
        {form.deliverables.map((row) => <RemovableRow key={row.id} value={row.text} onChangeText={(text) => updateRow('deliverables', row.id, text)} placeholder="e.g., Design the landing page mockups" onRemove={() => removeRow('deliverables', row.id)} removeLabel="Remove deliverable" />)}
      </FormSection>

      <FormSection title="Requirements" description="Experience or qualifications applicants should have." required action={<AddRowButton label="Add" onPress={() => update('requirements', [...form.requirements, { id: generateId(), text: '' }])} />}>
        {form.requirements.map((row) => <RemovableRow key={row.id} value={row.text} onChangeText={(text) => updateRow('requirements', row.id, text)} placeholder="e.g., 3+ years of experience in React" onRemove={() => removeRow('requirements', row.id)} removeLabel="Remove requirement" />)}
      </FormSection>

      <FormSection title="Required skills" description="Tap Add after each skill." required>
        <ChipInput items={form.skills} inputValue={newSkill} onInputChange={setNewSkill} onAdd={handleAddSkill} onRemove={(index) => update('skills', form.skills.filter((_, skillIndex) => skillIndex !== index))} placeholder="Add a required skill" emptyText="No skills added yet." />
      </FormSection>

      <FormSection title="Work location">
        <ChoicePills options={LOCATION_TYPES} value={form.locationDetails.type} onChange={(type) => update('locationDetails', { ...form.locationDetails, type })} />
        {isPhysical ? <>
          <FormField label="Address" required value={form.locationDetails.address} onChangeText={(address) => update('locationDetails', { ...form.locationDetails, address })} placeholder="Street address" />
          <View style={styles.row}>
            <View style={styles.flex}><FormField label="City" required value={form.locationDetails.city} onChangeText={(city) => update('locationDetails', { ...form.locationDetails, city })} placeholder="City" /></View>
            <View style={styles.flex}><FormField label="Country" required value={form.locationDetails.country} onChangeText={(country) => update('locationDetails', { ...form.locationDetails, country })} placeholder="Country" /></View>
          </View>
        </> : null}
      </FormSection>

      <FormSection title="Employment & experience">
        <ChoicePills label="Employment type" allowClear options={EMPLOYMENT_TYPES} value={form.employmentType} onChange={(value) => update('employmentType', value)} />
        <ChoicePills label="Experience level" allowClear options={EXPERIENCE_LEVELS} value={form.experienceLevel} onChange={(value) => update('experienceLevel', value)} />
        <ChoicePills label="Education requirement" scrollable options={EDUCATION_OPTIONS} value={form.educationRequirement} onChange={(value) => update('educationRequirement', value)} />
        <DateTimeField label="Closing date" mode="date" value={form.closingDate ? new Date(form.closingDate) : null} onChange={(date) => update('closingDate', date.toISOString())} onClear={() => update('closingDate', null)} placeholder="Optional. Leave empty to keep the job open" minimumDate={new Date()} />
      </FormSection>

      <FormSection title="Screening questions" description="Optional questions applicants answer when they apply." action={<AddRowButton label="Add question" onPress={() => update('questions', [...form.questions, { id: generateId(), question: '', answerType: 'input', options: [] }])} />}>
        {form.questions.length === 0 ? <Text style={styles.emptyQuestions}>No screening questions yet.</Text> : form.questions.map((question, questionIndex) => (
          <View key={question.id} style={styles.questionCard}>
            <RemovableRow value={question.question} onChangeText={(text) => updateQuestion(question.id, { question: text })} placeholder={`Question ${questionIndex + 1}`} onRemove={() => update('questions', form.questions.filter((entry) => entry.id !== question.id))} removeLabel="Remove question" />
            <ChoicePills options={ANSWER_TYPES} value={question.answerType} onChange={(answerType) => updateQuestion(question.id, { answerType, options: answerType === 'input' ? [] : question.options })} />
            {question.answerType !== 'input' ? (
              <View style={styles.optionsBlock}>
                {question.options.map((option, optionIndex) => (
                  <RemovableRow key={`${question.id}-${optionIndex}`} value={option} onChangeText={(text) => updateQuestion(question.id, { options: question.options.map((entry, index) => (index === optionIndex ? text : entry)) })} placeholder="Enter option" onRemove={() => updateQuestion(question.id, { options: question.options.filter((_, index) => index !== optionIndex) })} removeLabel="Remove option" />
                ))}
                <AddRowButton label="Add option" onPress={() => updateQuestion(question.id, { options: [...question.options, ''] })} />
              </View>
            ) : null}
          </View>
        ))}
      </FormSection>

      <FormSection title="Job poster disclaimer" description="Read and accept before publishing." required>
        <DisclaimerBox text={JOB_POSTER_DISCLAIMER} />
        <AgreementCheckbox checked={isDisclaimerAccepted} onChange={setIsDisclaimerAccepted}>{JOB_POSTER_AGREEMENT}</AgreementCheckbox>
      </FormSection>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

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

function PreviewRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Text style={styles.previewBody}><Text style={styles.previewLabel}>{label}: </Text>{value}</Text>;
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: 10 },
  label: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 12 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 },
  logoField: { gap: 6 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  logoImage: { width: 56, height: 56, borderRadius: 12 },
  logoTitle: { color: colors.text, fontWeight: '800', fontSize: 13 },
  logoAction: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.control },
  logoActionText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  logoUpload: { alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 20, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.input },
  emptyQuestions: { color: colors.mutedText, textAlign: 'center', paddingVertical: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 12 },
  questionCard: { gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  optionsBlock: { gap: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.border },
  previewCard: { gap: 6, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  previewTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  previewHeading: { color: colors.text, fontSize: 14, fontWeight: '900' },
  previewSpacer: { marginTop: 8 },
  previewBody: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  previewLabel: { color: colors.text, fontWeight: '800' },
  previewLogo: { width: 52, height: 52, borderRadius: 12 },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  categoryBadgeText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  neutralChip: { backgroundColor: colors.control, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  neutralChipText: { color: colors.secondaryText, fontSize: 12 },
  greenChip: { backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  greenChipText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
});
