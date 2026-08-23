import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { auth } from '@/lib/firebaseConfig';
import { JobsService } from '@/lib/job/JobsService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';

type JobCreationModalProps = { isOpen: boolean; onClose: () => void; onCreated?: () => void };
type CreateJobType = 'professional' | 'quickTask';
const jobsService = JobsService.getInstance();

export default function JobCreationModal({ isOpen, onClose, onCreated }: JobCreationModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [jobType, setJobType] = useState<CreateJobType>('professional');
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [category, setCategory] = useState('');
  const [priceFrom, setPriceFrom] = useState(''); const [priceTo, setPriceTo] = useState(''); const [skills, setSkills] = useState('');
  const [companyName, setCompanyName] = useState(''); const [industry, setIndustry] = useState(''); const [duration, setDuration] = useState('');
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState('');
  const swipeDismiss = useSwipeDismiss({ visible: isOpen, onDismiss: onClose, disabled: submitting });

  const handleSubmit = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) { setError('You must be signed in to create a job.'); return; }
    if (!title.trim() || !description.trim() || !category.trim()) { setError('Title, description, and category are required.'); return; }
    const from = Number(priceFrom); const to = Number(priceTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from) { setError('Enter a valid price range.'); return; }
    setSubmitting(true); setError('');
    try {
      await jobsService.createJob({
        jobTitle: title, jobDescription: description, jobCategory: jobType, category, userId,
        priceRange: { from, to }, location: { type: 'remote' }, skills: skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        category_specific: jobType === 'professional' ? { name: companyName.trim(), industry: industry.trim() } : { urgency: 'medium', duration: duration.trim(), complexity: 'moderate' },
      });
      setTitle(''); setDescription(''); setCategory(''); setPriceFrom(''); setPriceTo(''); setSkills(''); setCompanyName(''); setIndustry(''); setDuration('');
      onClose(); onCreated?.();
    } catch (submitError: unknown) { setError(submitError instanceof Error ? submitError.message : 'The job could not be created.'); }
    finally { setSubmitting(false); }
  };

  return <Modal visible={isOpen} transparent animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}><View style={styles.backdrop}><Animated.View style={[styles.sheet, swipeDismiss.animatedStyle]}>
    <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.border} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close job creation" />
    <View style={styles.header}><Text style={styles.title}>Create an Opportunity</Text><TouchableOpacity onPress={onClose} style={styles.close}><X size={22} color={colors.icon} /></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Opportunity type</Text><View style={styles.typeRow}>{([{ id: 'professional', label: 'Professional Job' }, { id: 'quickTask', label: 'Quick Task' }] as const).map(({ id, label }) => <TouchableOpacity key={id} onPress={() => setJobType(id)} style={[styles.typeButton, jobType === id && styles.typeButtonActive]}><Text style={[styles.typeText, jobType === id && styles.typeTextActive]}>{label}</Text></TouchableOpacity>)}</View>
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="Role or task title" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Describe the work and expectations" multiline />
      <Field label="Category" value={category} onChangeText={setCategory} placeholder="Development, Design, Marketing…" />
      <Field label="Skills (comma separated)" value={skills} onChangeText={setSkills} placeholder="React Native, TypeScript" />
      {jobType === 'professional' ? <><Field label="Company name" value={companyName} onChangeText={setCompanyName} placeholder="Company or organization" /><Field label="Industry" value={industry} onChangeText={setIndustry} placeholder="Technology" /></> : <Field label="Expected duration" value={duration} onChangeText={setDuration} placeholder="2 days" />}
      <View style={styles.priceRow}><View style={styles.priceField}><Field label="Budget from" value={priceFrom} onChangeText={setPriceFrom} placeholder="0" keyboardType="decimal-pad" /></View><View style={styles.priceField}><Field label="Budget to" value={priceTo} onChangeText={setPriceTo} placeholder="0" keyboardType="decimal-pad" /></View></View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
    <View style={styles.footer}><TouchableOpacity onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={submitting} onPress={() => void handleSubmit()} style={[styles.submit, submitting && styles.disabled]}>{submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitText}>Publish</Text>}</TouchableOpacity></View>
  </Animated.View></View></Modal>;
}

type FieldProps = { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; keyboardType?: 'default' | 'decimal-pad' };
function Field({ label, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' }: FieldProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedText} multiline={multiline} keyboardType={keyboardType} style={[styles.input, multiline && styles.textArea]} /></View>;
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' }, sheet: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, header: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }, title: { flex: 1, color: colors.text, fontSize: 19, fontWeight: '900' }, close: { padding: 4 }, content: { padding: 18, gap: 14 }, label: { color: colors.secondaryText, fontSize: 13, fontWeight: '800', marginBottom: 6 }, typeRow: { flexDirection: 'row', gap: 10 }, typeButton: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, alignItems: 'center' }, typeButtonActive: { backgroundColor: colors.successSurface, borderColor: colors.accent }, typeText: { color: colors.mutedText, fontWeight: '800', fontSize: 12 }, typeTextActive: { color: colors.successText }, field: { flex: 1 }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: colors.text, backgroundColor: colors.input }, textArea: { minHeight: 110, textAlignVertical: 'top' }, priceRow: { flexDirection: 'row', gap: 10 }, priceField: { flex: 1 }, error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 }, footer: { flexDirection: 'row', gap: 10, padding: 18, borderTopWidth: 1, borderTopColor: colors.border }, cancel: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.secondaryText, fontWeight: '800' }, submit: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, submitText: { color: colors.onAccent, fontWeight: '900' }, disabled: { opacity: 0.5 },
});
