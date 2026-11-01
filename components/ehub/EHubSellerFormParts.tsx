import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Check, Clock3, ImagePlus, X } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { EHubSaveStatus } from '@/lib/hooks/useEHubSellerCenter';

export function formatSavedTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() === 0 ? '' : `${date.toDateString()} · ${date.toTimeString().slice(0, 5)}`;
}

function useFormStyles() {
  const { colors } = useAppTheme();
  return { colors, styles: useMemo(() => createStyles(colors), [colors]) };
}

type FieldProps = { label: string; required?: boolean; hint?: string; children: ReactNode };

export function SellerField({ label, required, hint, children }: FieldProps) {
  const { styles } = useFormStyles();
  return <View style={styles.field}>
    <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    {children}
  </View>;
}

type TextFieldProps = { label: string; value: string; onChangeText: (value: string) => void; required?: boolean; hint?: string; multiline?: boolean; maxLength?: number; placeholder?: string };

export function SellerTextField({ label, value, onChangeText, required, hint, multiline, maxLength, placeholder }: TextFieldProps) {
  const { colors, styles } = useFormStyles();
  return <SellerField label={label} required={required} hint={hint}>
    <TextInput value={value} onChangeText={onChangeText} multiline={multiline} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={colors.mutedText}
      textAlignVertical={multiline ? 'top' : 'center'} accessibilityLabel={label} style={[styles.input, multiline ? styles.multiline : null]} />
  </SellerField>;
}

type NumberFieldProps = { label: string; value: number | null; onChangeValue: (value: number | null) => void; required?: boolean; isInteger?: boolean; allowEmpty?: boolean };

/** Keeps the typed text (so "12." can become "12.50") and reports the parsed number; empty is null when allowed. */
export function SellerNumberField({ label, value, onChangeValue, required, isInteger, allowEmpty }: NumberFieldProps) {
  const { colors, styles } = useFormStyles();
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text);
    if (parsed !== null && Number.isNaN(parsed)) return;
    if (parsed !== value && !(parsed === null && value === 0 && !allowEmpty)) setText(value === null ? '' : String(value));
  }, [allowEmpty, text, value]);
  const handleChange = (nextText: string) => {
    const cleaned = nextText.replace(isInteger ? /[^0-9]/g : /[^0-9.]/g, '');
    setText(cleaned);
    if (cleaned.trim() === '') { onChangeValue(allowEmpty ? null : 0); return; }
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) onChangeValue(isInteger ? Math.floor(parsed) : parsed);
  };
  const keyboardType: KeyboardTypeOptions = isInteger ? 'number-pad' : 'decimal-pad';
  return <SellerField label={label} required={required}>
    <TextInput value={text} onChangeText={handleChange} keyboardType={keyboardType} placeholderTextColor={colors.mutedText} accessibilityLabel={label} style={styles.input} />
  </SellerField>;
}

type ChipFieldProps = { label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string };

export function SellerChipField({ label, values, onChange, placeholder }: ChipFieldProps) {
  const { colors, styles } = useFormStyles();
  const [input, setInput] = useState('');
  const handleAdd = () => {
    const value = input.trim();
    if (!value || values.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
    setInput('');
  };
  return <SellerField label={label}>
    <View style={styles.chipBox}>
      {values.length ? <View style={styles.chips}>{values.map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Remove ${value}`} onPress={() => onChange(values.filter((item) => item !== value))} style={styles.chip}>
        <Text style={styles.chipText}>{value}</Text><X size={13} color={colors.accentText} />
      </Pressable>)}</View> : null}
      <View style={styles.chipInputRow}>
        <TextInput value={input} onChangeText={setInput} onSubmitEditing={handleAdd} blurOnSubmit={false} returnKeyType="done" placeholder={placeholder} placeholderTextColor={colors.mutedText} accessibilityLabel={label} style={styles.chipInput} />
        <Pressable accessibilityRole="button" onPress={handleAdd} style={styles.addButton}><Text style={styles.addText}>Add</Text></Pressable>
      </View>
    </View>
  </SellerField>;
}

type StepHeaderProps = { steps: string[]; currentStep: number; onStepChange: (step: number) => void };

export function SellerStepHeader({ steps, currentStep, onStepChange }: StepHeaderProps) {
  const { colors, styles } = useFormStyles();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.steps}>
    {steps.map((step, index) => {
      const isCurrent = index === currentStep;
      const isDone = index < currentStep;
      return <Pressable key={step} accessibilityRole="button" accessibilityState={{ selected: isCurrent }} onPress={() => onStepChange(index)} style={[styles.step, isCurrent ? styles.stepCurrent : isDone ? styles.stepDone : null]}>
        <View style={[styles.stepNumber, isCurrent ? styles.stepNumberCurrent : null]}>{isDone ? <Check size={12} color={colors.accentText} /> : <Text style={[styles.stepNumberText, isCurrent ? styles.stepTextCurrent : null]}>{index + 1}</Text>}</View>
        <Text style={[styles.stepText, isCurrent ? styles.stepTextCurrent : isDone ? styles.stepTextDone : null]}>{step}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

export function SellerSaveIndicator({ status, savedAt }: { status: EHubSaveStatus; savedAt: string | null }) {
  const { colors, styles } = useFormStyles();
  const savedTime = savedAt ? formatSavedTime(savedAt) : '';
  const labels: { [key in EHubSaveStatus]: string } = { idle: 'Changes autosave', saving: 'Saving…', saved: savedTime ? `Saved ${savedTime}` : 'Saved', error: 'Unable to save' };
  const color = status === 'error' ? colors.destructiveText : status === 'saving' ? colors.warningText : colors.mutedText;
  return <View accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.saveIndicator}><Clock3 size={13} color={color} /><Text style={[styles.saveText, { color }]}>{labels[status]}</Text></View>;
}

type ImageFieldProps = { label: string; imageUrl: string; isUploading: boolean; aspect: [number, number]; onPick: (localUri: string) => void };

export function SellerImageField({ label, imageUrl, isUploading, aspect, onPick }: ImageFieldProps) {
  const { colors, styles } = useFormStyles();
  const [error, setError] = useState<string | null>(null);
  const handlePick = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Allow photo access to choose an image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.9 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) onPick(asset.uri);
  };
  return <SellerField label={label}>
    <Pressable accessibilityRole="button" accessibilityLabel={imageUrl ? `Change ${label}` : `Choose ${label}`} disabled={isUploading} onPress={() => void handlePick()} style={styles.imagePicker}>
      {imageUrl ? <CachedImage uri={imageUrl} style={styles.imagePreview} accessibilityLabel={`${label} preview`} /> : <View style={styles.imageEmpty}>
        <ImagePlus size={30} color={colors.mutedText} />
        <Text style={styles.imageTitle}>Choose an image</Text>
        <Text style={styles.hint}>PNG, JPG or WebP up to 8 MB</Text>
      </View>}
      {isUploading ? <View style={styles.imageOverlay}><ActivityIndicator color="#ffffff" /><Text style={styles.overlayText}>Uploading…</Text></View> : null}
    </Pressable>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </SellerField>;
}

type ToggleRowProps = { label: string; description: string; value: boolean; onChange: (value: boolean) => void };

export function SellerToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  const { colors, styles } = useFormStyles();
  return <View style={styles.toggleRow}>
    <View style={styles.flex}><Text style={styles.toggleLabel}>{label}</Text><Text style={styles.hint}>{description}</Text></View>
    <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colors.accent, false: colors.disabled }} thumbColor="#ffffff" />
  </View>;
}

type CheckRowProps = { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; accessibilityLabel: string };

export function SellerCheckRow({ checked, onChange, children, accessibilityLabel }: CheckRowProps) {
  const { styles } = useFormStyles();
  return <View style={styles.checkRow}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={accessibilityLabel} hitSlop={8} onPress={() => onChange(!checked)} style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
      {checked ? <Check size={14} color="#ffffff" /> : null}
    </Pressable>
    <View style={styles.flex}>{children}</View>
  </View>;
}

type ButtonProps = { label: string; onPress: () => void; icon?: ReactNode; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; isLoading?: boolean; compact?: boolean };

export function SellerButton({ label, onPress, icon, variant = 'primary', disabled, isLoading, compact }: ButtonProps) {
  const { colors, styles } = useFormStyles();
  const isDisabled = disabled || isLoading;
  const textColor = variant === 'primary' ? '#ffffff' : variant === 'danger' ? colors.destructiveText : colors.text;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(isDisabled) }} disabled={isDisabled} onPress={onPress}
    style={[styles.button, compact ? styles.buttonCompact : null, variant === 'primary' ? styles.buttonPrimary : variant === 'danger' ? styles.buttonDanger : styles.buttonSecondary, isDisabled ? styles.disabled : null]}>
    {isLoading ? <ActivityIndicator size="small" color={textColor} /> : icon}
    <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
  </Pressable>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  field: { gap: 7 },
  label: { color: colors.text, fontSize: 14, fontWeight: '800' },
  required: { color: colors.destructiveText },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
  multiline: { minHeight: 120 },
  chipBox: { padding: 8, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 32, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: colors.successSurface },
  chipText: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
  chipInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipInput: { flex: 1, minWidth: 0, minHeight: 42, paddingHorizontal: 8, color: colors.text, fontSize: 15 },
  addButton: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.control },
  addText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  steps: { gap: 8, paddingVertical: 2 },
  step: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.control },
  stepCurrent: { backgroundColor: '#059669' },
  stepDone: { backgroundColor: colors.successSurface },
  stepNumber: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.surface },
  stepNumberCurrent: { backgroundColor: 'rgba(255,255,255,0.22)' },
  stepNumberText: { color: colors.mutedText, fontSize: 11, fontWeight: '900' },
  stepText: { color: colors.mutedText, fontSize: 12, fontWeight: '800' },
  stepTextCurrent: { color: '#ffffff' },
  stepTextDone: { color: colors.accentText },
  saveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  saveText: { fontSize: 12, fontWeight: '800' },
  imagePicker: { minHeight: 190, overflow: 'hidden', borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.control },
  imagePreview: { width: '100%', height: 200 },
  imageEmpty: { flex: 1, minHeight: 186, alignItems: 'center', justifyContent: 'center', gap: 5, padding: 16 },
  imageTitle: { marginTop: 4, color: colors.text, fontSize: 14, fontWeight: '800' },
  imageOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(15,23,42,0.55)' },
  overlayText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  errorText: { color: colors.destructiveText, fontSize: 12, fontWeight: '700' },
  toggleRow: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  toggleLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: { width: 24, height: 24, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  checkboxChecked: { borderColor: '#059669', backgroundColor: '#059669' },
  button: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13 },
  buttonCompact: { minHeight: 40, paddingHorizontal: 12, borderRadius: 11 },
  buttonPrimary: { backgroundColor: '#059669' },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  buttonDanger: { borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.destructiveSurface },
  buttonText: { fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
