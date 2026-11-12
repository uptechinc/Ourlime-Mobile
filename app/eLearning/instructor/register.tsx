import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Building2, Check, Clock, GraduationCap, Lock, ShieldAlert, ShieldCheck, User } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import IdentityVerificationModal from '@/components/jobs/IdentityVerificationModal';
import { CheckRow, ChoiceChips, ErrorList, FilePickRow, FormButton, FormField, FormSection, Segmented, TagInput, ToggleRow } from '@/components/eLearning/instructor/InstructorForm';
import { InstructorApplicationSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { COURSE_MAIN_CATEGORIES, getUniqueSubcategories } from '@/lib/constants/courseCategories';
import { instructorService, type InstructorStatus } from '@/lib/services/InstructorService';
import type { ApplicationType, CourseAvailability, CourseVisibility, PickedUpload } from '@/lib/types/instructor';

// The website's instructor application (app/eLearning/instructor/register): same steps, choices and checks.
type StepId = 'type' | 'background' | 'teaching' | 'organization' | 'sample' | 'agreements';
const STEPS: { id: StepId; label: string }[] = [
  { id: 'type', label: 'Application type' },
  { id: 'background', label: 'Professional background' },
  { id: 'teaching', label: 'Teaching information' },
  { id: 'organization', label: 'Organization details' },
  { id: 'sample', label: 'Sample lesson (optional)' },
  { id: 'agreements', label: 'Agreements' },
];
const APPLICATION_TYPES: { value: ApplicationType; title: string; description: string }[] = [
  { value: 'individual', title: 'Individual Instructor', description: 'Teach courses directly as a solo educator.' },
  { value: 'school', title: 'School Representative', description: 'Represent an accredited school or university portal.' },
  { value: 'training_company', title: 'Company Representative', description: 'Represent a professional corporate training business.' },
];
const QUALIFICATIONS = ['Associate Degree', "Bachelor's Degree", "Master's Degree", 'PhD / Doctorate', 'Diploma / Certificate', 'Secondary School Cert', 'Other Professional Cert'];
const STUDENT_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];
const DELIVERY_METHODS = [
  { id: 'Self-Paced', description: 'Pre-recorded lectures & assignments' },
  { id: 'Live', description: 'Interactive webinars & scheduled classes' },
  { id: 'Hybrid', description: 'Mix of pre-recorded lectures & live sessions' },
];
const AVAILABILITY: { value: CourseAvailability; label: string }[] = [{ value: 'free', label: 'Free only' }, { value: 'paid', label: 'Paid only' }, { value: 'both', label: 'Free & paid' }];
const ORGANIZATION_TYPES = ['Accredited School', 'University / College', 'Professional Academy', 'Corporate Business', 'Non-Profit Organization', 'Other'];
const VISIBILITY: { value: CourseVisibility; label: string }[] = [{ value: 'private', label: 'Private only' }, { value: 'public', label: 'Public only' }, { value: 'both', label: 'Both' }];
const PORTAL_FEATURES = ['Private Courses', 'Teacher Invitations', 'Student Invitations', 'Classes / Cohorts', 'Assignments', 'Quizzes & Exams', 'Gradebook', 'Attendance', 'Certificates', 'Announcements', 'Messaging', 'School Branding', 'Analytics Dashboard'];
const AGREEMENTS = [
  { id: 'accurate', label: 'I confirm that all information provided in this application is accurate, complete, and truthful.' },
  { id: 'ownership', label: 'I confirm that I own, or have full legal permission to publish and monetize, all course resources or outline materials uploaded.' },
  { id: 'guidelines', label: "I agree to read and adhere to Ourlime's Instructor Guidelines and teaching standards." },
  { id: 'terms', label: "I agree to comply with Ourlime's Platform Terms of Service, Content Policies, and privacy statements." },
] as const;
type AgreementId = (typeof AGREEMENTS)[number]['id'];

// instructors/{uid}/ accepts images, videos, PDF and Word files up to 50 MB (storage.rules).
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
const WORD_AND_PDF = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const DOCUMENTS_AND_IMAGES = [...WORD_AND_PDF, 'image/jpeg', 'image/png', 'image/webp'];
const DOCUMENTS_AND_VIDEO = [...WORD_AND_PDF, 'video/*'];
const CONTENT_MAX_WIDTH = 720;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Gate = { kind: 'loading' } | { kind: 'error' } | { kind: 'existing'; status: Exclude<InstructorStatus, 'none'> } | { kind: 'unverified'; status: string | null } | { kind: 'form' };

const toggleValue = (list: string[], value: string): string[] => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

/** "Become an instructor": the website's multi-step application. Identity-verified members only; an administrator verifies it. */
export default function InstructorRegisterScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [gate, setGate] = useState<Gate>({ kind: 'loading' });
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  // Type
  const [applicationType, setApplicationType] = useState<ApplicationType>('individual');
  // Background
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [qualification, setQualification] = useState('');
  const [expertise, setExpertise] = useState<string[]>([]);
  const [years, setYears] = useState('0');
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [bio, setBio] = useState('');
  const [previousTeaching, setPreviousTeaching] = useState('');
  const [resume, setResume] = useState<PickedUpload | null>(null);
  const [certificates, setCertificates] = useState<PickedUpload[]>([]);
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  // Teaching
  const [subjects, setSubjects] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [availability, setAvailability] = useState<CourseAvailability>('both');
  const [intended, setIntended] = useState('');
  // Organization
  const [orgName, setOrgName] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgType, setOrgType] = useState('');
  const [orgRegistration, setOrgRegistration] = useState('');
  const [proof, setProof] = useState<PickedUpload | null>(null);
  const [teachers, setTeachers] = useState('');
  const [students, setStudents] = useState('');
  const [privatePortal, setPrivatePortal] = useState(false);
  const [portalFeatures, setPortalFeatures] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<CourseVisibility>('both');
  // Sample + agreements
  const [sample, setSample] = useState<PickedUpload | null>(null);
  const [agreed, setAgreed] = useState<AgreementId[]>([]);

  const expertiseSuggestions = useMemo(() => getUniqueSubcategories(), []);
  const hasOrganization = applicationType === 'school' || applicationType === 'training_company';
  const steps = STEPS.filter((step) => step.id !== 'organization' || hasOrganization);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLastStep = stepIndex >= steps.length - 1;

  const loadGate = useCallback(async () => {
    if (!activeUserId) return;
    setGate({ kind: 'loading' });
    try {
      const [status, applicant] = await Promise.all([instructorService.getStatus(activeUserId), instructorService.getApplicant(activeUserId)]);
      setFirstName((current) => current || applicant.firstName);
      setLastName((current) => current || applicant.lastName);
      setEmail((current) => current || applicant.email);
      // Members who already applied see their status instead of the form (as on the website).
      if (status !== 'none') { setGate({ kind: 'existing', status }); return; }
      setGate(applicant.verificationStatus === 'verified' ? { kind: 'form' } : { kind: 'unverified', status: applicant.verificationStatus });
    } catch (error: unknown) {
      console.error('[InstructorRegisterScreen.loadGate] Error:', error instanceof Error ? error.message : 'Unknown error');
      setGate({ kind: 'error' });
    }
  }, [activeUserId]);

  useEffect(() => { void loadGate(); }, [loadGate]);

  const pickDocument = async (types: string[], multiple: boolean): Promise<PickedUpload[]> => {
    const picked = await DocumentPicker.getDocumentAsync({ type: types, multiple, copyToCacheDirectory: true });
    if (picked.canceled) return [];
    const tooLarge = picked.assets.filter((asset) => (asset.size ?? 0) > MAX_DOCUMENT_BYTES);
    if (tooLarge.length > 0) setErrors((current) => ({ ...current, files: `Files must be smaller than 50 MB: ${tooLarge.map((asset) => asset.name).join(', ')}` }));
    return picked.assets.filter((asset) => (asset.size ?? 0) <= MAX_DOCUMENT_BYTES).map((asset) => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size }));
  };

  const validateStep = (id: StepId): Record<string, string> => {
    const next: Record<string, string> = {};
    if (id === 'background') {
      if (!firstName.trim()) next.firstName = 'First name is required';
      if (!lastName.trim()) next.lastName = 'Last name is required';
      if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address';
      if (!jobTitle.trim()) next.jobTitle = 'Current job title is required';
      if (!qualification) next.qualification = 'Highest qualification is required';
      if (expertise.length === 0) next.expertise = 'Select at least one field of expertise';
      if (!/^\d+$/.test(years.trim())) next.years = 'Experience cannot be negative';
      if (bio.trim().length < 50) next.bio = 'Bio is required and must be at least 50 characters';
      if (languages.length === 0) next.languages = 'Add at least one language taught';
      if (!resume) next.resume = 'Resume / CV file upload is required';
    }
    if (id === 'teaching') {
      if (subjects.length === 0) next.subjects = 'Select at least one subject category';
      if (levels.length === 0) next.levels = 'Select at least one student level';
      if (methods.length === 0) next.methods = 'Select at least one delivery method';
      if (intended.trim().length < 50) next.intended = 'Intended courses description is required and must be at least 50 characters';
    }
    if (id === 'organization') {
      if (!orgName.trim()) next.orgName = 'Organization name is required';
      if (!orgEmail.trim()) next.orgEmail = 'Official organization email is required';
      else if (!EMAIL_PATTERN.test(orgEmail.trim())) next.orgEmail = 'Invalid email format';
      if (!orgWebsite.trim()) next.orgWebsite = 'Organization website is required';
      if (!orgType) next.orgType = 'Organization type is required';
      if (!proof) next.proof = 'Proof of authorization is required';
      if (!(Number(teachers) > 0)) next.teachers = 'Estimated teachers must be greater than zero';
      if (!(Number(students) > 0)) next.students = 'Estimated students must be greater than zero';
    }
    if (id === 'agreements' && agreed.length < AGREEMENTS.length) next.agreements = 'Please confirm all agreements before submitting.';
    return next;
  };

  const handleNext = () => {
    const found = validateStep(step.id);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    setErrors({});
    if (stepIndex === 0) router.back();
    else setStepIndex((current) => current - 1);
  };

  const handleSubmit = async () => {
    const found = validateStep('agreements');
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0 || !resume) return;
    try {
      setProgress('Uploading your documents…');
      const resumeUrl = await instructorService.uploadApplicationDocument('resume', resume);
      const certificateUrls: string[] = [];
      for (const certificate of certificates) certificateUrls.push(await instructorService.uploadApplicationDocument('certificate', certificate));
      const sampleLessonUrl = sample ? await instructorService.uploadApplicationDocument('sample', sample) : '';
      const proofUrl = hasOrganization && proof ? await instructorService.uploadApplicationDocument('proof', proof) : '';
      setProgress('Sending your application…');
      await instructorService.apply({
        firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), bio: bio.trim(),
        socialLinks: { ...(website.trim() ? { website: website.trim() } : {}), ...(linkedin.trim() ? { linkedin: linkedin.trim() } : {}) },
        applicationType, jobTitle: jobTitle.trim(), highestQualification: qualification, fieldsOfExpertise: expertise,
        yearsOfExperience: Math.floor(Number(years) || 0), previousTeachingExperience: previousTeaching.trim(), languagesTaught: languages,
        resumeUrl, certificateUrls, subjectCategories: subjects, studentLevels: levels, courseDeliveryMethods: methods, courseAvailability: availability,
        intendedCoursesDescription: intended.trim(), sampleLessonUrl,
        ...(hasOrganization ? {
          schoolDetails: {
            organizationName: orgName.trim(), officialOrganizationEmail: orgEmail.trim(), website: orgWebsite.trim(), organizationType: orgType,
            registrationNumber: orgRegistration.trim(), proofOfAuthorizationUrl: proofUrl, estimatedTeachers: Math.floor(Number(teachers) || 0),
            estimatedStudents: Math.floor(Number(students) || 0), requestPrivatePortal: privatePortal, courseVisibility: visibility,
            privatePortalFeatures: privatePortal ? portalFeatures : [],
          },
        } : {}),
      });
      setIsDone(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      console.error('[InstructorRegisterScreen.handleSubmit] Error:', message || 'Unknown error');
      setSubmitError(message.includes('already') ? 'Your instructor profile is already verified.' : 'Your application could not be sent. Check your connection and try again.');
    } finally {
      setProgress(null);
    }
  };

  const column = { width: Math.min(width, CONTENT_MAX_WIDTH) };

  if (isDone || gate.kind === 'existing') {
    const verified = gate.kind === 'existing' && gate.status === 'verified';
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <PageHeader title="Become an instructor" onBackPress={() => router.back()} />
        <View style={styles.center}>
          {verified ? <ShieldCheck size={44} color={colors.successText} /> : isDone ? <GraduationCap size={44} color={colors.accent} /> : <Clock size={44} color={colors.warningText} />}
          <Text style={styles.centerTitle}>{isDone ? 'Application submitted' : verified ? 'You are a verified instructor' : 'Application under review'}</Text>
          <Text style={styles.centerText}>
            {isDone ? 'An administrator will review your profile. You can prepare courses meanwhile; publishing opens once you are verified.'
              : verified ? 'You already have an instructor profile. Manage your courses from the instructor dashboard.'
                : 'You already applied. An administrator is reviewing your profile; publishing opens once you are verified.'}
          </Text>
          <FormButton label="Go to instructor dashboard" onPress={() => router.replace('/eLearning/instructor' as Href)} />
        </View>
      </SafeAreaView>
    );
  }

  if (gate.kind === 'loading') {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <PageHeader title="Become an instructor" onBackPress={() => router.back()} />
        <InstructorApplicationSkeleton />
      </SafeAreaView>
    );
  }

  if (gate.kind === 'error') {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <PageHeader title="Become an instructor" onBackPress={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.centerText}>The application could not be loaded.</Text>
          <FormButton label="Try again" onPress={() => void loadGate()} />
        </View>
      </SafeAreaView>
    );
  }

  if (gate.kind === 'unverified') {
    const inReview = gate.status === 'pending' || gate.status === 'in_progress';
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <PageHeader title="Become an instructor" onBackPress={() => router.back()} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.column, column]}>
            <View style={styles.gateCard}>
              <ShieldAlert size={40} color={colors.accent} />
              <Text style={styles.centerTitle}>Identity Verification Required</Text>
              <Text style={styles.centerText}>Access to the Instructor Application is restricted to identity-verified accounts. Before you can apply to become an instructor or represent an educational organization, we must verify your details.</Text>
              {inReview ? (
                <View style={styles.reviewBox}>
                  <Clock size={18} color={colors.warningText} />
                  <View style={styles.flex}>
                    <Text style={styles.reviewTitle}>Documents in Review</Text>
                    <Text style={styles.reviewText}>Your verification documents have been received and are being reviewed by our administrators. The form unlocks once approved.</Text>
                  </View>
                </View>
              ) : (
                <>
                  {['Ensures student safety and maintains high educational trust', 'Unlocks course generation and global student enrollment', 'Verifies representative credentials for private custom portals'].map((line) => (
                    <View key={line} style={styles.benefit}><Check size={15} color={colors.successText} /><Text style={[styles.hint, styles.flex]}>{line}</Text></View>
                  ))}
                  <Pressable accessibilityRole="button" onPress={() => setIsVerificationOpen(true)} style={styles.verifyButton}>
                    <Lock size={16} color={colors.onAccent} /><Text style={styles.verifyText}>Verify Identity Now</Text>
                  </Pressable>
                </>
              )}
              <Pressable accessibilityRole="button" onPress={() => void loadGate()} style={styles.linkButton}><Text style={styles.linkText}>I've been verified — check again</Text></Pressable>
            </View>
          </View>
        </ScrollView>
        <IdentityVerificationModal
          isOpen={isVerificationOpen}
          onClose={() => { setIsVerificationOpen(false); void loadGate(); }}
          verificationStatus={gate.status}
          message="Identity verification is required to apply as an instructor."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <PageHeader title="Become an instructor" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.column, column]}>
            <View style={styles.progressRow}>
              {steps.map((item, index) => <View key={item.id} style={[styles.progressBar, index <= stepIndex && styles.progressBarActive]} />)}
            </View>
            <Text style={styles.stepCount}>Step {stepIndex + 1} of {steps.length} · {step.label}</Text>

            {step.id === 'type' ? (
              <FormSection title="Select application type" description="Choose the registration profile that matches your role best.">
                <View accessibilityRole="radiogroup" style={styles.typeList}>
                  {APPLICATION_TYPES.map((option) => {
                    const selected = applicationType === option.value;
                    return (
                      <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setApplicationType(option.value)} style={[styles.typeCard, selected && styles.typeCardSelected]}>
                        {option.value === 'individual' ? <User size={22} color={selected ? colors.accent : colors.mutedText} /> : <Building2 size={22} color={selected ? colors.accent : colors.mutedText} />}
                        <View style={styles.flex}>
                          <Text style={styles.typeTitle}>{option.title}</Text>
                          <Text style={styles.hint}>{option.description}</Text>
                        </View>
                        {selected ? <Check size={18} color={colors.accent} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </FormSection>
            ) : null}

            {step.id === 'background' ? (
              <FormSection title="Professional background" description="Tell learners and our reviewers about your experience.">
                <View style={styles.pair}>
                  <View style={styles.flex}><FormField label="First name" required value={firstName} onChange={setFirstName} error={errors.firstName} /></View>
                  <View style={styles.flex}><FormField label="Last name" required value={lastName} onChange={setLastName} error={errors.lastName} /></View>
                </View>
                <FormField label="Email" required value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
                <FormField label="Current job title" required value={jobTitle} onChange={setJobTitle} placeholder="e.g. Senior Software Engineer" error={errors.jobTitle} />
                <ChoiceChips label="Highest qualification" required single options={QUALIFICATIONS} selected={qualification ? [qualification] : []} onToggle={setQualification} error={errors.qualification} />
                <TagInput label="Fields of expertise" required values={expertise} onChange={setExpertise} placeholder="Add your own" hint="Pick from the list or add your own." suggestions={expertiseSuggestions} maximum={30} error={errors.expertise} />
                <FormField label="Years of professional experience" required value={years} onChange={(value) => setYears(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" error={errors.years} />
                <TagInput label="Languages taught" required values={languages} onChange={setLanguages} placeholder="e.g. Spanish" maximum={20} error={errors.languages} />
                <FormField label="Short bio" required value={bio} onChange={setBio} multiline placeholder="Your teaching style, background and what learners can expect" hint={`${bio.trim().length}/50 characters minimum`} error={errors.bio} />
                <FormField label="Previous teaching experience" value={previousTeaching} onChange={setPreviousTeaching} multiline placeholder="Where and what you have taught (optional)" />
                <FilePickRow label="Resume / CV" required fileName={resume?.name} placeholder="Attach a PDF or Word file" onPick={() => void pickDocument(WORD_AND_PDF, false).then((files) => { if (files[0]) setResume(files[0]); })} onRemove={() => setResume(null)} error={errors.resume} />
                <FilePickRow label="Certificates" fileName={certificates.length > 0 ? `${certificates.length} file${certificates.length === 1 ? '' : 's'}: ${certificates.map((file) => file.name).join(', ')}` : undefined} placeholder="Attach certificates (optional)" onPick={() => void pickDocument(DOCUMENTS_AND_IMAGES, true).then((files) => setCertificates((current) => [...current, ...files].slice(0, 20)))} onRemove={() => setCertificates([])} hint="PDF, Word or images." />
                <FormField label="Website" value={website} onChange={setWebsite} keyboardType="url" autoCapitalize="none" placeholder="https://" />
                <FormField label="LinkedIn" value={linkedin} onChange={setLinkedin} keyboardType="url" autoCapitalize="none" placeholder="https://linkedin.com/in/…" />
                {errors.files ? <Text style={styles.error}>{errors.files}</Text> : null}
              </FormSection>
            ) : null}

            {step.id === 'teaching' ? (
              <FormSection title="Teaching information" description="What and how you plan to teach.">
                <ChoiceChips label="Subject categories" required options={COURSE_MAIN_CATEGORIES} selected={subjects} onToggle={(value) => setSubjects((current) => toggleValue(current, value))} hint="Select all categories you plan to teach." error={errors.subjects} />
                <ChoiceChips label="Target student level(s)" required options={STUDENT_LEVELS} selected={levels} onToggle={(value) => setLevels((current) => toggleValue(current, value))} error={errors.levels} />
                <Text style={styles.label}>Course delivery method <Text style={styles.required}>*</Text></Text>
                {DELIVERY_METHODS.map((method) => (
                  <CheckRow key={method.id} label={method.id} description={method.description} checked={methods.includes(method.id)} onToggle={() => setMethods((current) => toggleValue(current, method.id))} />
                ))}
                {errors.methods ? <Text style={styles.error}>{errors.methods}</Text> : <Text style={styles.hint}>Select every way you plan to teach.</Text>}
                <Segmented label="Course pricing" options={AVAILABILITY} value={availability} onChange={setAvailability} />
                <FormField label="Intended courses" required value={intended} onChange={setIntended} multiline placeholder="Describe the courses you plan to create" hint={`${intended.trim().length}/50 characters minimum`} error={errors.intended} />
              </FormSection>
            ) : null}

            {step.id === 'organization' ? (
              <FormSection title="Organization details" description="Tell us about the school or company you represent.">
                <FormField label="Organization name" required value={orgName} onChange={setOrgName} error={errors.orgName} />
                <FormField label="Official organization email" required value={orgEmail} onChange={setOrgEmail} keyboardType="email-address" autoCapitalize="none" error={errors.orgEmail} />
                <FormField label="Website URL" required value={orgWebsite} onChange={setOrgWebsite} keyboardType="url" autoCapitalize="none" placeholder="https://" error={errors.orgWebsite} />
                <ChoiceChips label="Organization type" required single options={ORGANIZATION_TYPES} selected={orgType ? [orgType] : []} onToggle={setOrgType} error={errors.orgType} />
                <FormField label="Registration number" value={orgRegistration} onChange={setOrgRegistration} placeholder="e.g. REG-12345" hint="If applicable." />
                <FilePickRow label="Proof of authorization" required fileName={proof?.name} placeholder="Letter or document authorizing you to represent it" onPick={() => void pickDocument(DOCUMENTS_AND_IMAGES, false).then((files) => { if (files[0]) setProof(files[0]); })} onRemove={() => setProof(null)} error={errors.proof} />
                <View style={styles.pair}>
                  <View style={styles.flex}><FormField label="Estimated teachers" required value={teachers} onChange={(value) => setTeachers(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" error={errors.teachers} /></View>
                  <View style={styles.flex}><FormField label="Estimated students" required value={students} onChange={(value) => setStudents(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" error={errors.students} /></View>
                </View>
                <ToggleRow label="Request a private portal" description="A private space for your institution's classes." value={privatePortal} onChange={setPrivatePortal} />
                {privatePortal ? <ChoiceChips label="Portal features" options={PORTAL_FEATURES} selected={portalFeatures} onToggle={(value) => setPortalFeatures((current) => toggleValue(current, value))} /> : null}
                <Segmented label="Course visibility" options={VISIBILITY} value={visibility} onChange={setVisibility} />
              </FormSection>
            ) : null}

            {step.id === 'sample' ? (
              <FormSection title="Sample lesson or course outline" description="Optionally upload a course outline, PDF slides, or a short introductory video to show the structure and quality of your lessons.">
                <FilePickRow label="Sample file" fileName={sample?.name} placeholder="Attach a PDF, Word file or video (optional)" onPick={() => void pickDocument(DOCUMENTS_AND_VIDEO, false).then((files) => { if (files[0]) setSample(files[0]); })} onRemove={() => setSample(null)} hint="Up to 50 MB." />
                {errors.files ? <Text style={styles.error}>{errors.files}</Text> : null}
              </FormSection>
            ) : null}

            {step.id === 'agreements' ? (
              <FormSection title="Agreements & submit" description="Check your details, then confirm the statements below.">
                <View style={styles.summary}>
                  <Text style={styles.summaryLine}><Text style={styles.summaryKey}>Type: </Text>{APPLICATION_TYPES.find((option) => option.value === applicationType)?.title}</Text>
                  <Text style={styles.summaryLine}><Text style={styles.summaryKey}>Name: </Text>{`${firstName} ${lastName}`.trim()}</Text>
                  <Text style={styles.summaryLine}><Text style={styles.summaryKey}>Role: </Text>{jobTitle} · {qualification}</Text>
                  <Text style={styles.summaryLine}><Text style={styles.summaryKey}>Subjects: </Text>{subjects.join(', ')}</Text>
                  <Text style={styles.summaryLine}><Text style={styles.summaryKey}>Documents: </Text>{[resume ? 'CV' : '', certificates.length ? `${certificates.length} certificate(s)` : '', sample ? 'sample lesson' : '', hasOrganization && proof ? 'proof of authorization' : ''].filter(Boolean).join(', ')}</Text>
                </View>
                {AGREEMENTS.map((agreement) => (
                  <CheckRow key={agreement.id} label={agreement.label} checked={agreed.includes(agreement.id)} onToggle={() => setAgreed((current) => (current.includes(agreement.id) ? current.filter((item) => item !== agreement.id) : [...current, agreement.id]))} />
                ))}
                {errors.agreements ? <Text accessibilityRole="alert" style={styles.error}>{errors.agreements}</Text> : null}
              </FormSection>
            ) : null}

            {Object.keys(errors).length > 0 && step.id !== 'agreements' ? <ErrorList errors={['Fix the highlighted fields to continue.']} /> : null}
            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
            <View style={styles.navRow}>
              <View style={styles.flex}><FormButton variant="secondary" label={stepIndex === 0 ? 'Cancel' : 'Back'} disabled={Boolean(progress)} onPress={handleBack} /></View>
              <View style={styles.flex}>
                {isLastStep
                  ? <FormButton label={progress ?? 'Submit application'} disabled={Boolean(progress)} onPress={() => void handleSubmit()} />
                  : <FormButton label="Continue" onPress={handleNext} />}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  centerTitle: { color: colors.text, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  centerText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  gateCard: { padding: 20, gap: 12, alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  reviewBox: { padding: 12, flexDirection: 'row', gap: 10, borderRadius: 14, backgroundColor: colors.warningSurface },
  reviewTitle: { color: colors.warningText, fontSize: 14, fontWeight: '800' },
  reviewText: { color: colors.warningText, fontSize: 12, lineHeight: 18 },
  benefit: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifyButton: { minHeight: 48, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: colors.accent },
  verifyText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  linkButton: { minHeight: 40, justifyContent: 'center' },
  linkText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.control },
  progressBarActive: { backgroundColor: colors.accent },
  stepCount: { color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  typeList: { gap: 10 },
  typeCard: { minHeight: 72, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  typeCardSelected: { borderColor: colors.accent, borderWidth: 2 },
  typeTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  pair: { flexDirection: 'row', gap: 10 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  required: { color: colors.destructiveText },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  error: { color: colors.destructiveText, fontSize: 13 },
  summary: { padding: 12, gap: 4, borderRadius: 14, backgroundColor: colors.control },
  summaryLine: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  summaryKey: { color: colors.text, fontWeight: '800' },
  navRow: { marginTop: 6, flexDirection: 'row', gap: 10 },
});
