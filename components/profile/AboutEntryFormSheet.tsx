import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import DateTimeField from '@/components/ui/DateTimeField';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/** Shared shape of a work-experience or education row as edited in the form. */
export type AboutEntryFormValues = {
  title: string;
  organization: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
};

export type AboutEntryFormKind = 'work' | 'education';

type AboutEntryFormSheetProps = {
  visible: boolean;
  kind: AboutEntryFormKind;
  initialValues: AboutEntryFormValues | null;
  onClose: () => void;
  onSubmit: (values: AboutEntryFormValues) => Promise<void>;
};

const EMPTY_VALUES: AboutEntryFormValues = { title: '', organization: '', startDate: '', endDate: null, current: false, description: '' };

// Same field labels as the website's WorkExperienceSection and EducationSection forms.
const LABELS: Record<AboutEntryFormKind, { heading: string; title: string; organization: string; current: string; titlePlaceholder: string; organizationPlaceholder: string }> = {
  work: { heading: 'Work Experience', title: 'Job Title', organization: 'Company', current: 'I currently work here', titlePlaceholder: 'e.g. Software Engineer', organizationPlaceholder: 'e.g. Ourlime' },
  education: { heading: 'Education', title: 'Degree', organization: 'School', current: 'I currently study here', titlePlaceholder: 'e.g. BSc Computer Science', organizationPlaceholder: 'e.g. University of the West Indies' },
};

const toDate = (value: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function AboutEntryFormSheet({ visible, kind, initialValues, onClose, onSubmit }: AboutEntryFormSheetProps) {
  const { colors } = useAppTheme();
  const [values, setValues] = useState<AboutEntryFormValues>(EMPTY_VALUES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const labels = LABELS[kind];
  const isEditing = initialValues !== null;

  useEffect(() => {
    if (!visible) return;
    setValues(initialValues ?? EMPTY_VALUES);
    setError('');
  }, [initialValues, visible]);

  const handleSubmit = async (): Promise<void> => {
    if (saving) return;
    if (!values.title.trim() || !values.organization.trim()) return setError(`${labels.title} and ${labels.organization.toLowerCase()} are required.`);
    if (!values.startDate) return setError('Start date is required.');
    if (!values.current && values.endDate && new Date(values.endDate) < new Date(values.startDate)) return setError('End date must be after the start date.');
    setSaving(true);
    setError('');
    try {
      await onSubmit(values);
      onClose();
    } catch (submitError: unknown) {
      console.error('[AboutEntryFormSheet.handleSubmit] Error:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 } as const;
  const labelStyle = { color: colors.secondaryText, fontWeight: '700', fontSize: 13, marginBottom: 6 } as const;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={onClose} disabled={saving} accessibilityLabel="Close" style={{ padding: 6 }}><X size={22} color={colors.text} /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '900' }}>{isEditing ? `Edit ${labels.heading}` : `Add ${labels.heading}`}</Text>
          <View style={{ width: 34 }} />
        </View>
        <KeyboardSafeView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={labelStyle}>{labels.title}</Text>
              <TextInput value={values.title} onChangeText={(title) => setValues((current) => ({ ...current, title }))} placeholder={labels.titlePlaceholder} placeholderTextColor={colors.mutedText} style={inputStyle} />
            </View>
            <View>
              <Text style={labelStyle}>{labels.organization}</Text>
              <TextInput value={values.organization} onChangeText={(organization) => setValues((current) => ({ ...current, organization }))} placeholder={labels.organizationPlaceholder} placeholderTextColor={colors.mutedText} style={inputStyle} />
            </View>
            <DateTimeField label="Start Date" mode="date" required placeholder="Choose start date" value={toDate(values.startDate)} onChange={(date) => setValues((current) => ({ ...current, startDate: date.toISOString() }))} />
            {values.current ? null : (
              <DateTimeField label="End Date" mode="date" placeholder="Choose end date" value={toDate(values.endDate)} minimumDate={toDate(values.startDate) ?? undefined} onChange={(date) => setValues((current) => ({ ...current, endDate: date.toISOString() }))} onClear={() => setValues((current) => ({ ...current, endDate: null }))} />
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{labels.current}</Text>
              <Switch value={values.current} onValueChange={(current) => setValues((previous) => ({ ...previous, current, endDate: current ? null : previous.endDate }))} trackColor={{ true: colors.accent }} />
            </View>
            <View>
              <Text style={labelStyle}>Description</Text>
              <TextInput value={values.description} onChangeText={(description) => setValues((current) => ({ ...current, description }))} placeholder="Describe what you did or learned" placeholderTextColor={colors.mutedText} multiline style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]} />
            </View>
            {error ? <Text style={{ color: colors.destructiveText, fontWeight: '700' }}>{error}</Text> : null}
            <TouchableOpacity onPress={() => void handleSubmit()} disabled={saving} style={{ minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }}>
              {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>{isEditing ? 'Save Changes' : 'Add'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardSafeView>
      </SafeAreaView>
    </Modal>
  );
}
