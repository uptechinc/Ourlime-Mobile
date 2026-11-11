import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { Check, FileText, Paperclip, Plus, X } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

/**
 * Form pieces shared by the instructor screens (course editor, quiz and assignment editors, instructor application),
 * styled like the app's existing instructor screens.
 */

export function useInstructorFormStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createInstructorFormStyles(colors), [colors]);
}

type FormFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  hint?: string;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  required?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

export function FormField({ label, value, onChange, multiline, hint, error, placeholder, keyboardType, required, maxLength, autoCapitalize }: FormFieldProps) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={colors.mutedText}
        style={[styles.input, multiline && styles.multiline, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type ChoiceChipsProps = {
  label?: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  /** single: announced as radio buttons (the caller decides what toggling does). */
  single?: boolean;
};

export function ChoiceChips({ label, options, selected, onToggle, error, hint, required, single }: ChoiceChipsProps) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text> : null}
      <View style={styles.chips}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Pressable
              key={option}
              accessibilityRole={single ? 'radio' : 'checkbox'}
              accessibilityState={{ checked: isSelected }}
              onPress={() => onToggle(option)}
              style={[styles.chip, isSelected && styles.chipSelected]}
            >
              {isSelected ? <Check size={14} color={colors.onAccent} /> : null}
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type SegmentOption<Value extends string> = { value: Value; label: string };
type SegmentedProps<Value extends string> = { label?: string; options: readonly SegmentOption<Value>[]; value: Value; onChange: (value: Value) => void };

export function Segmented<Value extends string>({ label, options, value, onChange }: SegmentedProps<Value>) {
  const styles = useInstructorFormStyles();
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.segment}>
        {options.map((option) => (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => onChange(option.value)} style={[styles.segmentOption, value === option.value && styles.segmentActive]}>
            <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]} numberOfLines={1}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type ToggleRowProps = { label: string; description?: string; value: boolean; onChange: (value: boolean) => void };

export function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  return (
    <View style={styles.toggleRow}>
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} thumbColor="#ffffff" />
    </View>
  );
}

type CheckRowProps = { label: string; checked: boolean; onToggle: () => void; description?: string };

export function CheckRow({ label, checked, onToggle, description }: CheckRowProps) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={[styles.checkRow, checked && styles.checkRowSelected]}>
      <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>{checked ? <Check size={14} color={colors.onAccent} strokeWidth={3} /> : null}</View>
      <View style={styles.flex}>
        <Text style={styles.checkLabel}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

type TagInputProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  maximum?: number;
  /** Suggestions shown as tappable chips under the input. */
  suggestions?: readonly string[];
};

/** Type a value and press Add (or return) to add it as a removable chip; commas split several at once. */
export function TagInput({ label, values, onChange, placeholder, hint, error, required, maximum = 20, suggestions }: TagInputProps) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  const [draft, setDraft] = useState('');

  const handleAdd = (raw: string) => {
    const additions = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
    if (additions.length === 0) return;
    const next = [...values];
    additions.forEach((addition) => {
      if (next.length < maximum && !next.some((existing) => existing.toLowerCase() === addition.toLowerCase())) next.push(addition);
    });
    onChange(next);
    setDraft('');
  };

  const unused = (suggestions ?? []).filter((suggestion) => !values.includes(suggestion));

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={label}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => handleAdd(draft)}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={colors.mutedText}
          style={[styles.input, styles.flex, error ? styles.inputError : null]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={`Add to ${label}`} onPress={() => handleAdd(draft)} style={styles.squareButton}>
          <Plus size={18} color={colors.accentText} />
        </Pressable>
      </View>
      {values.length > 0 ? (
        <View style={styles.chips}>
          {values.map((value) => (
            <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Remove ${value}`} onPress={() => onChange(values.filter((entry) => entry !== value))} style={[styles.chip, styles.chipSelected]}>
              <Text style={[styles.chipText, styles.chipTextSelected]}>{value}</Text>
              <X size={13} color={colors.onAccent} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {unused.length > 0 ? (
        <View style={styles.chips}>
          {unused.slice(0, 18).map((suggestion) => (
            <Pressable key={suggestion} accessibilityRole="button" accessibilityLabel={`Add ${suggestion}`} onPress={() => handleAdd(suggestion)} style={styles.suggestion}>
              <Plus size={12} color={colors.mutedText} />
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type ListInputProps = { label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string; hint?: string; error?: string; required?: boolean; maximum?: number };

/** An editable list of short sentences (learning objectives, prerequisites), one row each. */
export function ListInput({ label, values, onChange, placeholder, hint, error, required, maximum = 30 }: ListInputProps) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  const rows = values.length > 0 ? values : [''];
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
      {rows.map((value, index) => (
        <View key={`row-${index}`} style={styles.row}>
          <TextInput
            accessibilityLabel={`${label} ${index + 1}`}
            value={value}
            onChangeText={(text) => onChange(rows.map((entry, position) => (position === index ? text : entry)))}
            placeholder={placeholder}
            placeholderTextColor={colors.mutedText}
            style={[styles.input, styles.flex, error && index === 0 ? styles.inputError : null]}
          />
          {rows.length > 1 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label.toLowerCase()} ${index + 1}`} onPress={() => onChange(rows.filter((_entry, position) => position !== index))} style={styles.squareButton}>
              <X size={16} color={colors.mutedText} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {rows.length < maximum ? (
        <Pressable accessibilityRole="button" onPress={() => onChange([...rows, ''])} style={styles.inlineAdd}>
          <Plus size={14} color={colors.accentText} /><Text style={styles.inlineAddText}>Add another</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type FilePickRowProps = { label: string; fileName?: string; placeholder: string; onPick: () => void; onRemove?: () => void; error?: string; hint?: string; required?: boolean };

export function FilePickRow({ label, fileName, placeholder, onPick, onRemove, error, hint, required }: FilePickRowProps) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onPick} style={[styles.fileButton, styles.flex, error ? styles.inputError : null]}>
          {fileName ? <FileText size={18} color={colors.accentText} /> : <Paperclip size={18} color={colors.mutedText} />}
          <Text style={[styles.fileText, !fileName && styles.fileTextEmpty]} numberOfLines={1}>{fileName ?? placeholder}</Text>
        </Pressable>
        {fileName && onRemove ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${fileName}`} onPress={onRemove} style={styles.squareButton}><X size={16} color={colors.mutedText} /></Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const styles = useInstructorFormStyles();
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.section}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      {children}
    </View>
  );
}

export function ErrorList({ errors }: { errors: string[] }) {
  const styles = useInstructorFormStyles();
  if (errors.length === 0) return null;
  return (
    <View accessibilityRole="alert" style={styles.errorBox}>
      {errors.slice(0, 8).map((error) => <Text key={error} style={styles.error}>• {error}</Text>)}
    </View>
  );
}

type PrimaryButtonProps = { label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' };

export function FormButton({ label, onPress, disabled, variant = 'primary' }: PrimaryButtonProps) {
  const styles = useInstructorFormStyles();
  const isPrimary = variant === 'primary';
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={[styles.button, isPrimary ? styles.buttonPrimary : styles.buttonSecondary, disabled && styles.disabled]}>
      <Text style={isPrimary ? styles.buttonPrimaryText : styles.buttonSecondaryText}>{label}</Text>
    </Pressable>
  );
}

export const createInstructorFormStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: { gap: 6 },
  sectionBlock: { gap: 12 },
  section: { marginTop: 10, color: colors.text, fontSize: 18, fontWeight: '900' },
  sectionDescription: { marginTop: -6, color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  required: { color: colors.destructiveText },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  inputError: { borderColor: colors.destructiveText },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: colors.onAccent },
  suggestion: { minHeight: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 17, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  suggestionText: { color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.control },
  segmentOption: { flex: 1, minHeight: 38, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.mutedText, fontSize: 13, fontWeight: '800' },
  segmentTextActive: { color: colors.text },
  toggleRow: { minHeight: 56, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  checkRow: { padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  checkRowSelected: { borderColor: colors.accent },
  checkBox: { width: 22, height: 22, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.input },
  checkBoxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkLabel: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  squareButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  inlineAdd: { minHeight: 36, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  inlineAddText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
  fileButton: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  fileText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  fileTextEmpty: { color: colors.mutedText },
  errorBox: { padding: 12, gap: 4, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  error: { color: colors.destructiveText, fontSize: 13 },
  button: { minHeight: 50, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  buttonPrimaryText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  buttonSecondaryText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
