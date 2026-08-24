import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { childSafetyReportService } from '@/lib/services/ChildSafetyReportService';
import {
  CHILD_SAFETY_CATEGORIES,
  CHILD_SAFETY_CATEGORY_LABELS,
  type ChildSafetyCategory,
  type ChildSafetyDangerAnswer,
  type ChildSafetyReportTarget,
} from '@/lib/types/childSafety';

type ChildSafetyReportFormProps = {
  target: ChildSafetyReportTarget;
  onSubmitted?: (reference: string) => void;
};

export default function ChildSafetyReportForm({ target, onSubmitted }: ChildSafetyReportFormProps) {
  const { colors } = useAppTheme();
  const [category, setCategory] = useState<ChildSafetyCategory | null>(null);
  const [description, setDescription] = useState('');
  const [immediateDanger, setImmediateDanger] = useState<ChildSafetyDangerAnswer>('unsure');
  const [goodFaithAcknowledged, setGoodFaithAcknowledged] = useState(false);
  const [allowContact, setAllowContact] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!category) return Alert.alert('Select a concern', 'Choose the category that best describes the child-safety concern.');
    if (description.trim().length < 20) return Alert.alert('Add details', 'Describe the concern in at least 20 characters. Do not copy or attach suspected harmful material.');
    if (!goodFaithAcknowledged) return Alert.alert('Confirmation required', 'Confirm that you are making this report in good faith.');
    setSubmitting(true);
    try {
      const report = await childSafetyReportService.submit({ category, description, immediateDanger, goodFaithAcknowledged, allowContact, target });
      setReference(report.reference);
      onSubmitted?.(report.reference);
    } catch (error: unknown) {
      Alert.alert('Report not submitted', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return <View style={{ padding: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface }}><Ionicons name="checkmark-circle" size={34} color={colors.accent} /><Text style={{ marginTop: 10, color: colors.text, fontSize: 18, fontWeight: '900' }}>Report securely received</Text><Text style={{ marginTop: 7, color: colors.secondaryText }}>Reference: <Text style={{ fontWeight: '900' }}>{reference}</Text></Text><Text style={{ marginTop: 8, color: colors.mutedText, lineHeight: 20 }}>Keep this reference. Do not download, copy, attach, or redistribute suspected child sexual abuse material.</Text></View>;
  }

  return <View>
    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>Report a child-safety concern</Text>
    <Text style={{ marginTop: 5, color: colors.mutedText, lineHeight: 20 }}>Reports go to a restricted Child Safety queue, separate from ordinary moderation.</Text>
    <Text style={{ marginTop: 17, marginBottom: 8, color: colors.secondaryText, fontWeight: '800' }}>Concern category</Text>
    {CHILD_SAFETY_CATEGORIES.map((categoryOption) => <TouchableOpacity key={categoryOption} onPress={() => setCategory(categoryOption)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 50, marginBottom: 7, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: category === categoryOption ? colors.destructive : colors.border, backgroundColor: category === categoryOption ? colors.destructiveSurface : colors.surface }}><View style={{ width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: category === categoryOption ? colors.destructive : colors.border, alignItems: 'center', justifyContent: 'center' }}>{category === categoryOption ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.destructive }} /> : null}</View><Text style={{ flex: 1, marginLeft: 10, color: category === categoryOption ? colors.destructiveText : colors.secondaryText, fontWeight: '700' }}>{CHILD_SAFETY_CATEGORY_LABELS[categoryOption]}</Text></TouchableOpacity>)}
    <Text style={{ marginTop: 12, marginBottom: 8, color: colors.secondaryText, fontWeight: '800' }}>Is anyone in immediate danger?</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>{(['yes', 'no', 'unsure'] as const).map((answer) => <TouchableOpacity key={answer} onPress={() => setImmediateDanger(answer)} style={{ flex: 1, alignItems: 'center', padding: 11, borderRadius: 13, borderWidth: 1, borderColor: immediateDanger === answer ? colors.destructive : colors.border, backgroundColor: immediateDanger === answer ? colors.destructiveSurface : colors.surface }}><Text style={{ color: immediateDanger === answer ? colors.destructiveText : colors.secondaryText, fontWeight: '800', textTransform: 'capitalize' }}>{answer}</Text></TouchableOpacity>)}</View>
    {immediateDanger === 'yes' ? <View style={{ marginTop: 10, padding: 13, borderRadius: 14, backgroundColor: colors.destructiveSurface }}><Text style={{ color: colors.destructiveText, lineHeight: 20, fontWeight: '700' }}>If a child is in immediate danger, contact local emergency services now. An Ourlime report does not replace emergency assistance.</Text></View> : null}
    <Text style={{ marginTop: 15, marginBottom: 8, color: colors.secondaryText, fontWeight: '800' }}>What happened?</Text>
    <TextInput value={description} onChangeText={setDescription} multiline maxLength={5000} placeholder="Describe the concern and context. Do not paste or attach suspected CSAM." placeholderTextColor={colors.mutedText} style={{ minHeight: 125, borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.input, color: colors.text, padding: 13, textAlignVertical: 'top' }} />
    <View style={{ marginTop: 12, padding: 13, borderRadius: 14, backgroundColor: colors.warningSurface }}><Text style={{ color: colors.warningText, lineHeight: 20, fontWeight: '700' }}>Do not download, copy, forward, email, upload, or redistribute suspected CSAM. Ourlime captures the original target identifier automatically.</Text></View>
    <TouchableOpacity onPress={() => setGoodFaithAcknowledged((current) => !current)} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 14 }}><Ionicons name={goodFaithAcknowledged ? 'checkbox' : 'square-outline'} size={23} color={goodFaithAcknowledged ? colors.accent : colors.icon} /><Text style={{ flex: 1, marginLeft: 9, color: colors.secondaryText, lineHeight: 20 }}>I confirm this report is accurate to the best of my knowledge and is submitted in good faith.</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => setAllowContact((current) => !current)} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 }}><Ionicons name={allowContact ? 'checkbox' : 'square-outline'} size={23} color={allowContact ? colors.accent : colors.icon} /><Text style={{ flex: 1, marginLeft: 9, color: colors.secondaryText, lineHeight: 20 }}>Ourlime may contact me for additional information.</Text></TouchableOpacity>
    <TouchableOpacity disabled={submitting} onPress={() => void handleSubmit()} style={{ minHeight: 52, marginTop: 18, borderRadius: 16, backgroundColor: colors.destructive, alignItems: 'center', justifyContent: 'center', opacity: submitting ? 0.6 : 1 }}>{submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900' }}>Submit restricted report</Text>}</TouchableOpacity>
  </View>;
}
