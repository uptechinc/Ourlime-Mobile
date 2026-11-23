import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import * as DocumentPicker from 'expo-document-picker';
import { AlertTriangle, Check, Eye, FileText, Link2, Shield, Trash2, X } from 'lucide-react-native';
import { JOBS_ACTION_GREEN } from '@/components/jobs/JobCardParts';
import { jobApplicationService, type JobApplicationAnswers, type ResumeAsset } from '@/lib/services/JobApplicationService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import { useLocalFormDraft } from '@/lib/hooks/useLocalFormDraft';
import { useJobQuestions } from '@/lib/hooks/useJobQuestions';
import { auth } from '@/lib/firebaseConfig';
import { ALLOWED_RESUME_EXTENSIONS, APPLICANT_DISCLAIMER, APPLICANT_DISCLAIMER_VERSION, APPLICANT_SAFETY_GUIDANCE, MAX_RESUME_SIZE_BYTES } from '@/lib/job/JobFormOptions';

type Question = { id: string; question?: string; type?: string; options?: string[] };
/** What's kept as an on-device draft per job (like the website's per-job application draft). */
type ApplicationDraftForm = { coverLetter: string; portfolioLink: string; answers: JobApplicationAnswers; resume: ResumeAsset | null };
type JobApplicationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void;
  job: { id: string; basic_info: { title: string }; category_specific: { name?: string }; questions?: Question[] };
  jobType: 'professional' | 'quicktasks' | 'quickTask';
};

export default function JobApplicationModal({ isOpen, onClose, onApplied, job, jobType }: JobApplicationModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Transparent Modal: Android doesn't resize it for the keyboard, so KeyboardSafeView lifts the sheet above it.
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState(''); const [resume, setResume] = useState<ResumeAsset | null>(null); const [portfolioLink, setPortfolioLink] = useState('');
  const [answers, setAnswers] = useState<JobApplicationAnswers>({}); const [accepted, setAccepted] = useState(false); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(false);
  const isQuickTask = jobType === 'quicktasks' || jobType === 'quickTask';
  // Website: a professional application ends on a "Review your application" step; a quick task is a single
  // "Review & Apply" step without the cover letter, resume or screening questions.
  const [step, setStep] = useState<'form' | 'review'>(isQuickTask ? 'review' : 'form');
  const { questions: loadedQuestions, isLoading: questionsLoading } = useJobQuestions(job.id, job.questions, isOpen && !isQuickTask);
  const questions = isQuickTask ? [] : loadedQuestions;

  // Per-job on-device draft: auto-saved while typing and restored automatically next time (like the website).
  const [wasDraftRestored, setWasDraftRestored] = useState(false);
  const hasFormContent = coverLetter.trim().length > 0 || portfolioLink.trim().length > 0 || Object.keys(answers).length > 0 || Boolean(resume);
  const draft = useLocalFormDraft<ApplicationDraftForm>({
    ownerId: auth.currentUser?.uid,
    kind: 'jobApplication',
    scopeId: job.id,
    data: { coverLetter, portfolioLink, answers, resume },
    hasContent: hasFormContent,
    enabled: isOpen && !success,
  });
  const { savedDraft, restore: restoreDraft } = draft;
  useEffect(() => {
    if (!savedDraft) return;
    const restored = restoreDraft();
    if (!restored) return;
    setCoverLetter(restored.coverLetter);
    setPortfolioLink(restored.portfolioLink);
    setAnswers(restored.answers ?? {});
    setResume(restored.resume ?? null);
    setWasDraftRestored(true);
  }, [restoreDraft, savedDraft]);

  const handleFilePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const extension = asset.name.includes('.') ? asset.name.substring(asset.name.lastIndexOf('.')).toLowerCase() : '';
    if (!ALLOWED_RESUME_EXTENSIONS.includes(extension)) { setError('Invalid file type. Please upload a PDF, DOC, or DOCX file.'); return; }
    if (typeof asset.size === 'number' && asset.size > MAX_RESUME_SIZE_BYTES) { setError(`File is too large (${(asset.size / (1024 * 1024)).toFixed(1)}MB). Maximum size is 5MB.`); return; }
    setError('');
    setResume({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
  };

  const handleAnswer = (questionId: string, value: string) => setAnswers((current) => ({ ...current, [questionId]: value }));
  /** Multiple-choice ('checkbox' / 'multiple') questions keep a list of picked options, like the website. */
  const handleToggleOption = (questionId: string, option: string) => setAnswers((current) => {
    const picked = Array.isArray(current[questionId]) ? current[questionId] as string[] : [];
    return { ...current, [questionId]: picked.includes(option) ? picked.filter((entry) => entry !== option) : [...picked, option] };
  });
  const isMultiSelect = (type: string | undefined): boolean => type === 'checkbox' || type === 'multiple';

  /** The form's own checks; the review step and the submit both rely on them. */
  const validateForm = (): string => {
    if (isQuickTask) return '';
    if (coverLetter.trim().length < 100) return 'Your cover letter must be at least 100 characters.';
    if (!resume) return 'Select a PDF, DOC, or DOCX resume.';
    if (questionsLoading) return 'Screening questions are still loading.';
    const missingQuestion = questions.find((question) => { const answer = answers[question.id]; return !answer || (Array.isArray(answer) ? answer.length === 0 : !answer.trim()); });
    return missingQuestion ? 'Answer every screening question.' : '';
  };

  const handleReview = () => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    setError('');
    setStep('review');
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); setStep('form'); return; }
    if (!accepted) { setError('Accept the applicant disclaimer before submitting.'); return; }
    setSubmitting(true); setError('');
    try {
      await jobApplicationService.createApplication(isQuickTask
        ? { jobId: job.id, jobType: 'quickTask' }
        : { jobId: job.id, jobType: 'professional', coverLetter, resume: resume ?? undefined, portfolioLink, answers });
      setSuccess(true);
      void draft.clear();
      setWasDraftRestored(false);
      onApplied?.();
    } catch (submitError: unknown) {
      console.error('[JobApplicationModal.handleSubmit] Error:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Your application could not be submitted.');
    }
    finally { setSubmitting(false); }
  };

  const handleClose = () => { setSuccess(false); setStep(isQuickTask ? 'review' : 'form'); onClose(); };
  const answeredQuestions = questions.filter((question) => { const answer = answers[question.id]; return Array.isArray(answer) ? answer.length > 0 : Boolean(answer?.trim()); });
  const swipeDismiss = useSwipeDismiss({ visible: isOpen, onDismiss: handleClose, disabled: submitting });
  return <Modal visible={isOpen} transparent animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}><KeyboardSafeView onKeyboardChange={setIsKeyboardOpen} style={[styles.backdrop, { paddingTop: isKeyboardOpen ? insets.top : 0 }]}><Animated.View style={[styles.sheet, isKeyboardOpen ? styles.sheetWithKeyboard : styles.sheetResting, swipeDismiss.animatedStyle]}>
    <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.border} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close job application" />
    <View style={styles.header}><View style={styles.headerCopy}><Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{success ? 'Application sent' : `Apply for ${job.basic_info.title}`}</Text><Text numberOfLines={1} style={styles.subtitle}>{job.category_specific.name || (isQuickTask ? 'Quick task' : 'Professional job')}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close application" disabled={submitting} onPress={swipeDismiss.dismissWithAnimation} hitSlop={4} style={styles.closeButton}><X size={22} color={colors.icon} /></TouchableOpacity></View>
    {!success && !isQuickTask ? <View accessible accessibilityLabel={`Step ${step === 'form' ? 1 : 2} of 2, ${step === 'form' ? 'your application' : 'review and submit'}`} style={styles.steps}>
      <View style={styles.stepBars}><View style={[styles.stepBar, styles.stepBarDone]} /><View style={[styles.stepBar, step === 'review' && styles.stepBarDone]} /></View>
      <Text style={styles.stepText}><Text style={styles.stepCount}>Step {step === 'form' ? 1 : 2} of 2</Text> · {step === 'form' ? 'Your application' : 'Review & submit'}</Text>
    </View> : null}
    {success ? <View style={[styles.success, { paddingBottom: 24 + insets.bottom }]}>
      <View style={styles.successIcon}><Check size={32} color="#ffffff" /></View>
      <Text style={styles.successTitle}>Application submitted</Text>
      <Text style={styles.successBody}>What happens next: the {isQuickTask ? 'task owner' : 'employer'} reviews your application. Its status moves from Submitted to In review and then to a decision, and you can follow it in My applications.</Text>
      <View style={styles.successActions}>
        <TouchableOpacity accessibilityRole="button" onPress={() => { handleClose(); setTimeout(() => router.push('/jobs/applications' as Href), 300); }} style={styles.cancel}><Text numberOfLines={1} style={styles.cancelText}>My applications</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={handleClose} style={styles.submit}><Text numberOfLines={1} style={styles.submitText}>Back to jobs</Text></TouchableOpacity>
      </View>
    </View> : <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'form' ? <>
        {wasDraftRestored ? <Text style={[styles.hint, { color: colors.accentText, marginBottom: 8 }]}>Draft restored. Your answers are saved on this device as you type.</Text> : null}
        {!isQuickTask ? <><Text style={styles.label}>Cover letter</Text><TextInput value={coverLetter} onChangeText={setCoverLetter} placeholder="Explain why you're a strong fit…" placeholderTextColor={colors.mutedText} multiline style={[styles.input, styles.textArea]} /><Text style={[styles.hint, coverLetter.trim().length >= 100 && { color: colors.successText }]}>{coverLetter.trim().length >= 100 ? `${coverLetter.trim().length} characters · minimum reached` : `${coverLetter.trim().length}/100 characters minimum`}</Text>
        <Text style={styles.label}>Resume</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={resume ? `Resume ${resume.name}. Replace resume` : 'Choose a resume file'} onPress={() => void handleFilePick()} style={styles.upload}><FileText size={27} color={resume ? colors.accent : colors.icon} /><Text style={styles.uploadText}>{resume?.name || 'Choose PDF, DOC, or DOCX'}</Text><Text style={styles.hint}>{resume ? 'Tap to replace' : 'PDF, DOC or DOCX, up to 5MB'}</Text></TouchableOpacity>{resume ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove resume" onPress={() => setResume(null)} style={styles.removeResume}><Trash2 size={15} color={colors.destructiveText} /><Text style={styles.removeResumeText}>Remove resume</Text></TouchableOpacity> : null}
        <Text style={styles.label}>Portfolio link (optional)</Text><TextInput value={portfolioLink} onChangeText={setPortfolioLink} autoCapitalize="none" keyboardType="url" placeholder="https://…" placeholderTextColor={colors.mutedText} style={styles.input} /></> : null}
        {questionsLoading ? <ActivityIndicator color={colors.accent} style={styles.questionsLoader} accessibilityLabel="Loading screening questions" /> : null}
        {questions.map((question) => { const answer = answers[question.id]; const textAnswer = typeof answer === 'string' ? answer : ''; return <View key={question.id} style={styles.question}><Text style={styles.label}>{question.question || 'Screening question'}</Text>{question.options?.length ? <View style={styles.options}>{isMultiSelect(question.type) ? <Text style={styles.hint}>Select all that apply.</Text> : null}{question.options.map((option) => { const isPicked = Array.isArray(answer) ? answer.includes(option) : answer === option; return <TouchableOpacity key={option} accessibilityRole={isMultiSelect(question.type) ? 'checkbox' : 'radio'} accessibilityState={{ checked: isPicked }} onPress={() => (isMultiSelect(question.type) ? handleToggleOption(question.id, option) : handleAnswer(question.id, option))} style={[styles.option, isPicked && styles.optionSelected]}><Text style={[styles.optionText, isPicked && styles.optionTextSelected]}>{option}</Text></TouchableOpacity>; })}</View> : <TextInput value={textAnswer} onChangeText={(value) => handleAnswer(question.id, value)} placeholder="Your answer" placeholderTextColor={colors.mutedText} style={styles.input} />}</View>; })}
        </> : <>
        <Text style={styles.reviewHeading}>{isQuickTask ? 'Review & Apply' : 'Review your application'}</Text>
        {isQuickTask ? <Text style={styles.hint}>Quick tasks use a short application: accept the applicant disclaimer and submit.</Text> : <>
          <View style={styles.reviewCard}><View style={styles.reviewLabelRow}><FileText size={13} color={colors.mutedText} /><Text style={styles.reviewLabel}>Cover letter</Text></View><Text numberOfLines={4} style={styles.reviewBody}>{coverLetter.trim()}</Text></View>
          {resume ? <View style={styles.reviewCard}><View style={styles.reviewLabelRow}><FileText size={13} color={colors.mutedText} /><Text style={styles.reviewLabel}>Resume</Text></View><Text style={styles.reviewBody}>{resume.name}</Text></View> : null}
          {portfolioLink.trim() ? <View style={styles.reviewCard}><View style={styles.reviewLabelRow}><Link2 size={13} color={colors.mutedText} /><Text style={styles.reviewLabel}>Portfolio</Text></View><Text numberOfLines={1} style={styles.reviewBody}>{portfolioLink.trim()}</Text></View> : null}
          {answeredQuestions.length ? <View style={styles.reviewCard}><View style={styles.reviewLabelRow}><Eye size={13} color={colors.mutedText} /><Text style={styles.reviewLabel}>Screening answers</Text></View>{answeredQuestions.map((question) => { const answer = answers[question.id]; return <View key={question.id} style={styles.reviewAnswer}><Text style={styles.hint}>{question.question || 'Screening question'}</Text><Text style={styles.reviewBody}>{Array.isArray(answer) ? answer.join(', ') : answer}</Text></View>; })}</View> : null}
        </>}
        <View style={styles.disclaimerCard}>
          <View style={styles.disclaimerHeader}><AlertTriangle size={16} color={colors.warningText} /><Text style={styles.disclaimerTitle}>Applicant disclaimer</Text><Text style={styles.disclaimerVersion}>v{APPLICANT_DISCLAIMER_VERSION}</Text></View>
          <Text style={styles.disclaimerBody}>{APPLICANT_DISCLAIMER}</Text>
          <Text style={styles.safetyHeading}>Safety guidance</Text>
          {APPLICANT_SAFETY_GUIDANCE.map((item) => <View key={item} style={styles.safetyRow}><Shield size={12} color={colors.warningText} /><Text style={styles.disclaimerBody}>{item}</Text></View>)}
          <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((current) => !current)} style={styles.disclaimer}><View style={[styles.checkbox, accepted && styles.checkboxSelected]}>{accepted ? <Check size={14} color="#ffffff" /> : null}</View><Text style={styles.disclaimerText}>I have read and agree to the Applicant Disclaimer (v{APPLICANT_DISCLAIMER_VERSION}), Jobs Terms, Privacy Policy, and Community Guidelines.</Text></TouchableOpacity>
        </View>
        </>}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: isKeyboardOpen ? 12 : 12 + insets.bottom }]}>{step === 'review' && !isQuickTask ? <TouchableOpacity accessibilityRole="button" disabled={submitting} onPress={() => { setError(''); setStep('form'); }} style={styles.cancel}><Text style={styles.cancelText}>Back</Text></TouchableOpacity> : <TouchableOpacity accessibilityRole="button" onPress={handleClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>}{step === 'form' ? <TouchableOpacity accessibilityRole="button" disabled={questionsLoading} onPress={handleReview} style={[styles.submit, questionsLoading && styles.disabled]}><Text numberOfLines={1} style={styles.submitText}>Continue</Text></TouchableOpacity> : <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: submitting }} disabled={submitting} onPress={() => void handleSubmit()} style={[styles.submit, (submitting || !accepted) && styles.disabled]}>{submitting ? <ActivityIndicator color="#ffffff" /> : <Text numberOfLines={1} style={styles.submitText}>Submit</Text>}</TouchableOpacity>}</View>
    </>}
  </Animated.View></KeyboardSafeView></Modal>;
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, sheetResting: { maxHeight: '92%', flexShrink: 0 }, sheetWithKeyboard: { maxHeight: '100%', flexShrink: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, headerCopy: { flex: 1, minWidth: 0 }, closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  steps: { paddingHorizontal: 16, paddingTop: 12, gap: 8 }, stepBars: { flexDirection: 'row', gap: 4 }, stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.control }, stepBarDone: { backgroundColor: colors.accent }, stepText: { color: colors.mutedText, fontSize: 12 }, stepCount: { color: colors.text, fontWeight: '800' }, title: { color: colors.text, fontSize: 18, fontWeight: '900' }, subtitle: { color: colors.mutedText, marginTop: 3 }, content: { padding: 16, gap: 12 }, label: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: colors.text, backgroundColor: colors.input }, textArea: { minHeight: 130, textAlignVertical: 'top' }, hint: { color: colors.mutedText, fontSize: 12, lineHeight: 18 }, upload: { minHeight: 92, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center', gap: 7 }, uploadText: { color: colors.secondaryText, fontWeight: '700' }, question: { gap: 8, paddingTop: 8 }, questionsLoader: { paddingTop: 8 }, options: { gap: 7 }, option: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, optionSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface }, optionText: { color: colors.secondaryText }, optionTextSelected: { color: colors.successText, fontWeight: '700' }, disclaimer: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8, paddingVertical: 4 }, checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, checkboxSelected: { backgroundColor: colors.accent, borderColor: colors.accent }, disclaimerText: { flex: 1, color: colors.secondaryText, fontSize: 12, lineHeight: 18 }, error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, padding: 10, borderRadius: 10 }, footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, cancel: { flex: 1, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.secondaryText, fontWeight: '800' }, submit: { flex: 1, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN, alignItems: 'center', justifyContent: 'center' }, submitText: { color: '#ffffff', fontSize: 15, fontWeight: '800' }, disabled: { opacity: 0.5 }, success: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, gap: 12 }, successBody: { color: colors.secondaryText, fontSize: 14, lineHeight: 21, textAlign: 'center' }, successActions: { alignSelf: 'stretch', flexDirection: 'row', gap: 8, marginTop: 8 }, successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, successTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
  removeResume: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }, removeResumeText: { color: colors.destructiveText, fontWeight: '700', fontSize: 12 },
  reviewHeading: { color: colors.text, fontSize: 15, fontWeight: '900' },
  reviewCard: { gap: 6, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  reviewLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  reviewBody: { color: colors.text, fontSize: 13, lineHeight: 19 },
  reviewAnswer: { gap: 2, marginTop: 4 },
  disclaimerCard: { gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.warningText, backgroundColor: colors.warningSurface, marginTop: 8 },
  disclaimerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 }, disclaimerTitle: { flex: 1, color: colors.warningText, fontWeight: '900', fontSize: 14 }, disclaimerVersion: { color: colors.warningText, fontSize: 11 },
  disclaimerBody: { flex: 1, color: colors.warningText, fontSize: 12, lineHeight: 18 }, safetyHeading: { color: colors.warningText, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 4 }, safetyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
});
