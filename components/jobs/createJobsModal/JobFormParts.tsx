import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, Plus, X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/** Shared, themed building blocks for the job and quick task forms (web createJobsModel/formParts). */

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export type ChoiceOption<T extends string> = { value: T; label: string; description?: string };

type FormSectionProps = {
  title: string;
  description?: string;
  required?: boolean;
  tone?: 'default' | 'warning';
  action?: ReactNode;
  children: ReactNode;
};

export function FormSection({ title, description, required = false, tone = 'default', action, children }: FormSectionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.section, tone === 'warning' && styles.sectionWarning]}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{title}{required ? <Text style={styles.required}> *</Text> : null}</Text>
          {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
        </View>
        {action}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'url';
  hint?: string;
  error?: string | null;
  maxLength?: number;
};

export function FormField({ label, value, onChangeText, placeholder, required = false, multiline = false, keyboardType = 'default', hint, error, maxLength }: FormFieldProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedText}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
        maxLength={maxLength}
        style={[styles.input, multiline && styles.textArea, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type ChoicePillsProps<T extends string> = {
  label?: string;
  required?: boolean;
  options: readonly ChoiceOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  /** Tapping the selected option clears it (optional fields). */
  allowClear?: boolean;
  scrollable?: boolean;
};

export function ChoicePills<T extends string>({ label, required = false, options, value, onChange, allowClear = false, scrollable = false }: ChoicePillsProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pills = options.map((option) => {
    const isActive = option.value === value;
    return (
      <TouchableOpacity
        key={option.value}
        accessibilityRole="radio"
        accessibilityState={{ selected: isActive }}
        onPress={() => (isActive && allowClear ? onChange('' as T) : onChange(option.value))}
        style={[styles.pill, isActive && styles.pillActive]}
      >
        <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{option.label}</Text>
      </TouchableOpacity>
    );
  });
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text> : null}
      {scrollable
        ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRowScroll}>{pills}</ScrollView>
        : <View style={styles.pillRow}>{pills}</View>}
    </View>
  );
}

type ChoiceCardsProps<T extends string> = {
  label?: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Larger options with a description (web ChoiceCard groups). */
export function ChoiceCards<T extends string>({ label, options, value, onChange }: ChoiceCardsProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.cardGrid}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              onPress={() => onChange(option.value)}
              style={[styles.choiceCard, isActive && styles.choiceCardActive]}
            >
              <Text style={[styles.choiceTitle, isActive && styles.pillTextActive]}>{option.label}</Text>
              {option.description ? <Text style={styles.choiceDescription}>{option.description}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

type ChipInputProps = {
  label?: string;
  items: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  placeholder: string;
  emptyText?: string;
};

export function ChipInput({ label, items, inputValue, onInputChange, onAdd, onRemove, placeholder, emptyText }: ChipInputProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.rowInputLine}>
        <TextInput
          value={inputValue}
          onChangeText={onInputChange}
          onSubmitEditing={onAdd}
          blurOnSubmit={false}
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={colors.mutedText}
          style={[styles.input, styles.flex]}
        />
        <TouchableOpacity accessibilityLabel="Add" onPress={onAdd} style={styles.addInlineButton}><Plus size={18} color={colors.onAccent} /></TouchableOpacity>
      </View>
      {items.length > 0 ? (
        <View style={styles.pillRow}>
          {items.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
              <TouchableOpacity accessibilityLabel={`Remove ${item}`} hitSlop={8} onPress={() => onRemove(index)}><X size={13} color={colors.successText} /></TouchableOpacity>
            </View>
          ))}
        </View>
      ) : emptyText ? <Text style={styles.hint}>{emptyText}</Text> : null}
    </View>
  );
}

type AddRowButtonProps = { label: string; onPress: () => void };

export function AddRowButton({ label, onPress }: AddRowButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.addRowButton}>
      <Plus size={15} color={colors.accentText} />
      <Text style={styles.addRowText}>{label}</Text>
    </TouchableOpacity>
  );
}

type RemovableRowProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onRemove: () => void;
  removeLabel: string;
  accessory?: ReactNode;
};

export function RemovableRow({ value, onChangeText, placeholder, onRemove, removeLabel, accessory }: RemovableRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.rowInputLine}>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedText} style={[styles.input, styles.flex]} />
      {accessory}
      <TouchableOpacity accessibilityLabel={removeLabel} onPress={onRemove} style={styles.removeButton}><X size={17} color={colors.destructiveText} /></TouchableOpacity>
    </View>
  );
}

type AgreementCheckboxProps = { checked: boolean; onChange: (checked: boolean) => void; tone?: 'default' | 'warning'; children: ReactNode };

export function AgreementCheckbox({ checked, onChange, tone = 'default', children }: AgreementCheckboxProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={[styles.agreement, tone === 'warning' && styles.agreementWarning]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Check size={14} color={colors.onAccent} /> : null}</View>
      <Text style={styles.agreementText}>{children}</Text>
    </TouchableOpacity>
  );
}

type DisclaimerBoxProps = { text: string };

export function DisclaimerBox({ text }: DisclaimerBoxProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.disclaimerBox}><Text style={styles.disclaimerText}>{text}</Text></View>;
}

export const createJobFormStyles = (colors: ThemeColors) => createStyles(colors);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 12 },
  sectionWarning: { borderColor: colors.warningText, backgroundColor: colors.warningSurface },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  sectionDescription: { color: colors.mutedText, fontSize: 12, marginTop: 3, lineHeight: 17 },
  sectionBody: { gap: 12 },
  required: { color: colors.destructiveText },
  field: { gap: 6 },
  label: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: colors.text, backgroundColor: colors.input, fontSize: 14 },
  inputError: { borderColor: colors.destructiveText },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  errorText: { color: colors.destructiveText, fontSize: 12, fontWeight: '700' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillRowScroll: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  pill: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  pillActive: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  pillText: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  pillTextActive: { color: colors.successText },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceCard: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, borderRadius: 12, padding: 11, gap: 3 },
  choiceCardActive: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  choiceTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  choiceDescription: { color: colors.mutedText, fontSize: 12 },
  rowInputLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addInlineButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  addRowButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.successSurface },
  addRowText: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
  removeButton: { width: 40, height: 44, borderRadius: 12, backgroundColor: colors.destructiveSurface, alignItems: 'center', justifyContent: 'center' },
  agreement: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.control },
  agreementWarning: { backgroundColor: colors.warningSurface },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.input },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  agreementText: { flex: 1, color: colors.secondaryText, fontSize: 12, lineHeight: 18 },
  disclaimerBox: { borderRadius: 12, backgroundColor: colors.control, padding: 12 },
  disclaimerText: { color: colors.secondaryText, fontSize: 12, lineHeight: 18 },
});
