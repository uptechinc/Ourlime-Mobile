import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import { Check, FileText, X } from 'lucide-react-native';
import { jobApplicationService, type JobApplicationAnswers, type ResumeAsset } from '@/lib/services/JobApplicationService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';

type Question = { id: string; question?: string; type?: string; options?: string[] };
type JobApplicationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  job: { id: string; basic_info: { title: string }; category_specific: { name?: string }; questions?: Question[] };
  jobType: 'professional' | 'quicktasks' | 'quickTask';
};

export default function JobApplicationModal({ isOpen, onClose, job, jobType }: JobApplicationModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [coverLetter, setCoverLetter] = useState(''); const [resume, setResume] = useState<ResumeAsset | null>(null); const [portfolioLink, setPortfolioLink] = useState('');
  const [answers, setAnswers] = useState<JobApplicationAnswers>({}); const [accepted, setAccepted] = useState(false); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(false);
  const isQuickTask = jobType === 'quicktasks' || jobType === 'quickTask';

  const handleFilePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true, multiple: false });
    if (!result.canceled && result.assets[0]) { const asset = result.assets[0]; setResume({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType }); }
  };

  const handleAnswer = (questionId: string, value: string) => setAnswers((current) => ({ ...current, [questionId]: value }));

  const handleSubmit = async () => {
    if (!isQuickTask && coverLetter.trim().length < 100) { setError('Your cover letter must be at least 100 characters.'); return; }
    if (!isQuickTask && !resume) { setError('Select a PDF, DOC, or DOCX resume.'); return; }
    const missingQuestion = job.questions?.find((question) => { const answer = answers[question.id]; return !answer || (Array.isArray(answer) ? answer.length === 0 : !answer.trim()); });
    if (missingQuestion) { setError('Answer every screening question.'); return; }
    if (!accepted) { setError('Accept the applicant disclaimer before submitting.'); return; }
    setSubmitting(true); setError('');
    try {
      await jobApplicationService.createApplication({ jobId: job.id, jobType: isQuickTask ? 'quickTask' : 'professional', coverLetter, resume: resume ?? undefined, portfolioLink, answers });
      setSuccess(true);
    } catch (submitError: unknown) { setError(submitError instanceof Error ? submitError.message : 'Your application could not be submitted.'); }
    finally { setSubmitting(false); }
  };

  const handleClose = () => { setSuccess(false); onClose(); };
  const swipeDismiss = useSwipeDismiss({ visible: isOpen, onDismiss: handleClose, disabled: submitting });
  return <Modal visible={isOpen} transparent animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}><View style={styles.backdrop}><Animated.View style={[styles.sheet, swipeDismiss.animatedStyle]}>
    <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.border} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close job application" />
    <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.title}>{success ? 'Application sent' : `Apply for ${job.basic_info.title}`}</Text><Text style={styles.subtitle}>{job.category_specific.name || (isQuickTask ? 'Quick Task' : 'Professional Job')}</Text></View><TouchableOpacity onPress={swipeDismiss.dismissWithAnimation}><X size={22} color={colors.icon} /></TouchableOpacity></View>
    {success ? <View style={styles.success}><View style={styles.successIcon}><Check size={32} color="#ffffff" /></View><Text style={styles.successTitle}>Application submitted</Text><Text style={styles.hint}>The employer can now review your application from their Jobs workspace.</Text><TouchableOpacity onPress={handleClose} style={styles.submit}><Text style={styles.submitText}>Done</Text></TouchableOpacity></View> : <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!isQuickTask ? <><Text style={styles.label}>Cover letter</Text><TextInput value={coverLetter} onChangeText={setCoverLetter} placeholder="Explain why you're a strong fit…" placeholderTextColor={colors.mutedText} multiline style={[styles.input, styles.textArea]} /><Text style={styles.hint}>{coverLetter.trim().length}/100 minimum characters</Text>
        <Text style={styles.label}>Resume</Text><TouchableOpacity onPress={() => void handleFilePick()} style={styles.upload}><FileText size={27} color={resume ? colors.accent : colors.icon} /><Text style={styles.uploadText}>{resume?.name || 'Choose PDF, DOC, or DOCX'}</Text></TouchableOpacity>
        <Text style={styles.label}>Portfolio link (optional)</Text><TextInput value={portfolioLink} onChangeText={setPortfolioLink} autoCapitalize="none" keyboardType="url" placeholder="https://…" placeholderTextColor={colors.mutedText} style={styles.input} /></> : <Text style={styles.hint}>Quick tasks use a short application. Answer the questions below, if any, and submit.</Text>}
        {(job.questions ?? []).map((question) => { const answer = answers[question.id]; const textAnswer = typeof answer === 'string' ? answer : ''; return <View key={question.id} style={styles.question}><Text style={styles.label}>{question.question || 'Screening question'}</Text>{question.options?.length ? <View style={styles.options}>{question.options.map((option) => <TouchableOpacity key={option} onPress={() => handleAnswer(question.id, option)} style={[styles.option, answer === option && styles.optionSelected]}><Text style={[styles.optionText, answer === option && styles.optionTextSelected]}>{option}</Text></TouchableOpacity>)}</View> : <TextInput value={textAnswer} onChangeText={(value) => handleAnswer(question.id, value)} placeholder="Your answer" placeholderTextColor={colors.mutedText} style={styles.input} />}</View>; })}
        <TouchableOpacity onPress={() => setAccepted((current) => !current)} style={styles.disclaimer}><View style={[styles.checkbox, accepted && styles.checkboxSelected]}>{accepted ? <Check size={14} color="#ffffff" /> : null}</View><Text style={styles.disclaimerText}>I confirm this information is accurate and agree it may be shared with the employer for this application.</Text></TouchableOpacity>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}><TouchableOpacity onPress={handleClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={submitting} onPress={() => void handleSubmit()} style={[styles.submit, submitting && styles.disabled]}>{submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitText}>Submit application</Text>}</TouchableOpacity></View>
    </>}
  </Animated.View></View></Modal>;
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.surface, maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, header: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }, headerCopy: { flex: 1 }, title: { color: colors.text, fontSize: 18, fontWeight: '900' }, subtitle: { color: colors.mutedText, marginTop: 3 }, content: { padding: 18, gap: 12 }, label: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: colors.text, backgroundColor: colors.input }, textArea: { minHeight: 130, textAlignVertical: 'top' }, hint: { color: colors.mutedText, fontSize: 12, lineHeight: 18 }, upload: { minHeight: 92, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center', gap: 7 }, uploadText: { color: colors.secondaryText, fontWeight: '700' }, question: { gap: 8, paddingTop: 8 }, options: { gap: 7 }, option: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, borderRadius: 10, padding: 10 }, optionSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface }, optionText: { color: colors.secondaryText }, optionTextSelected: { color: colors.successText, fontWeight: '700' }, disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 }, checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, checkboxSelected: { backgroundColor: colors.accent, borderColor: colors.accent }, disclaimerText: { flex: 1, color: colors.secondaryText, fontSize: 12, lineHeight: 18 }, error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, padding: 10, borderRadius: 10 }, footer: { flexDirection: 'row', gap: 10, padding: 18, borderTopWidth: 1, borderTopColor: colors.border }, cancel: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.secondaryText, fontWeight: '800' }, submit: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, submitText: { color: colors.onAccent, fontWeight: '900' }, disabled: { opacity: 0.5 }, success: { alignItems: 'center', padding: 30, gap: 14 }, successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, successTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
});
