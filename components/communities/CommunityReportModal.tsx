import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCircle, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { REPORT_REASONS, type ReportReasonCategory } from '@/lib/services/ModerationService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type CommunityReportModalProps = {
  visible: boolean;
  title: string;
  subjectLabel: string;
  onClose: () => void;
  onSubmit: (category: ReportReasonCategory, reason: string, details: string) => Promise<void>;
};

export default function CommunityReportModal({ visible, title, subjectLabel, onClose, onSubmit }: CommunityReportModalProps) {
  const { colors } = useAppTheme();
  const [category, setCategory] = useState<ReportReasonCategory | null>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = (): void => {
    setCategory(null);
    setReason('');
    setDetails('');
    setErrorMessage(null);
  };

  const handleClose = (): void => {
    if (submitting) return;
    resetState();
    onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    if (!category || !reason || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onSubmit(category, reason, details.trim());
      resetState();
      onClose();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'The report could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          {category ? <TouchableOpacity accessibilityLabel="Back to report categories" onPress={() => { setCategory(null); setReason(''); }} style={{ padding: 8 }}><ChevronLeft size={24} color={colors.icon} /></TouchableOpacity> : null}
          <View style={{ flex: 1, marginLeft: category ? 2 : 8 }}><Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>{title}</Text><Text numberOfLines={1} style={{ marginTop: 2, color: colors.mutedText, fontSize: 12 }}>{subjectLabel}</Text></View>
          <TouchableOpacity accessibilityLabel="Close report" onPress={handleClose} style={{ padding: 8 }}><X size={23} color={colors.icon} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 42 }}>
          {!category ? <>
            <Text style={{ marginBottom: 13, color: colors.text, fontWeight: '900' }}>What type of issue is this?</Text>
            {(Object.entries(REPORT_REASONS) as [ReportReasonCategory, (typeof REPORT_REASONS)[ReportReasonCategory]][]).map(([categoryKey, group]) => <TouchableOpacity key={categoryKey} onPress={() => setCategory(categoryKey)} style={{ minHeight: 54, marginBottom: 9, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}><AlertCircle size={18} color={colors.destructive} /><Text style={{ flex: 1, marginLeft: 10, color: colors.secondaryText, fontWeight: '800' }}>{group.label}</Text><ChevronRight size={19} color={colors.icon} /></TouchableOpacity>)}
          </> : <>
            <Text style={{ marginBottom: 13, color: colors.text, fontWeight: '900' }}>Why are you reporting this?</Text>
            {REPORT_REASONS[category].reasons.map((reasonOption) => <TouchableOpacity key={reasonOption} onPress={() => setReason(reasonOption)} style={{ minHeight: 50, marginBottom: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: reason === reasonOption ? colors.destructive : colors.border, backgroundColor: reason === reasonOption ? colors.destructiveSurface : colors.surface }}><View style={{ width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: reason === reasonOption ? colors.destructive : colors.border, alignItems: 'center', justifyContent: 'center' }}>{reason === reasonOption ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.destructive }} /> : null}</View><Text style={{ flex: 1, marginLeft: 10, color: reason === reasonOption ? colors.destructiveText : colors.secondaryText, fontWeight: '700' }}>{reasonOption}</Text></TouchableOpacity>)}
            {reason ? <TextInput value={details} onChangeText={setDetails} multiline maxLength={2000} placeholder="Additional details (optional)" placeholderTextColor={colors.mutedText} style={{ minHeight: 110, marginTop: 8, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, textAlignVertical: 'top' }} /> : null}
            {errorMessage ? <Text style={{ marginTop: 10, color: colors.destructiveText, lineHeight: 19 }}>{errorMessage}</Text> : null}
          </>}
        </ScrollView>
        {category ? <View style={{ padding: 15, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}><TouchableOpacity disabled={!reason || submitting} onPress={() => void handleSubmit()} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: reason ? colors.destructive : colors.disabled }}>{submitting ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: reason ? colors.onAccent : colors.disabledText, fontWeight: '900' }}>Submit report</Text>}</TouchableOpacity></View> : null}
      </SafeAreaView>
    </Modal>
  );
}
