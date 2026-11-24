import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { AlertCircle, Check, FileText, Paperclip, Plus, X } from 'lucide-react-native';
import { ELearningButton, ELEARNING_ACTION_GREEN } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

/**
 * Form pieces shared by the instructor screens (course editor, quiz and assignment editors, instructor application):
 * a label over every field, helper text under it that turns into the error when the field is wrong, and selected
 * states filled with the contrast-safe E-Learning green.
 */

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

export function useInstructorFormStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createInstructorFormStyles(colors), [colors]);
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  const styles = useInstructorFormStyles();
  return <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : <Text style={styles.optional}> (optional)</Text>}</Text>;
}

/** The error (with an icon, announced) or the helper text under a field. */
export function FieldMessage({ error, hint }: { error?: string; hint?: string | null }) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  if (error) {
    return <View accessibilityLiveRegion="polite" style={styles.errorRow}>
      <AlertCircle size={14} color={colors.destructiveText} />
      <Text style={[styles.error, styles.flexText]}>{error}</Text>
    </View>;
  }
  return hint ? <Text style={styles.hint}>{hint}</Text> : null;
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
  /** Shows "N more characters needed" until the text is long enough. */
  minLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** Hides the "(optional)" suffix on fields that are neither required nor optional (e.g. a prefilled number). */
  hideOptional?: boolean;
};

export function FormField({ label, value, onChange, multiline, hint, error, placeholder, keyboardType, required, maxLength, minLength, autoCapitalize, hideOptional }: FormFieldProps) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  const length = value.trim().length;
  const counter = minLength && length < minLength
    ? `${minLength - length} more ${minLength - length === 1 ? 'character' : 'characters'} needed`
    : maxLength && length > maxLength * 0.8 ? `${length}/${maxLength}` : null;
  return (
    <View style={styles.field}>
      {required || hideOptional ? <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text> : <FieldLabel label={label} />}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
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
      {error || hint || counter ? (
        <View style={styles.messageRow}>
          <View style={styles.flexText}><FieldMessage error={error} hint={hint} /></View>
          {counter ? <Text style={styles.counter}>{counter}</Text> : null}
        </View>
      ) : null}
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
  const styles = useInstructorFormStyles();
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text> : null}
      <View accessibilityRole={single ? 'radiogroup' : undefined} style={styles.chips}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Pressable
              key={option}
              accessibilityRole={single ? 'radio' : 'checkbox'}
              accessibilityState={{ checked: isSelected }}
              onPress={() => onToggle(option)}
              android_ripple={RIPPLE}
              style={[styles.chip, isSelected && styles.chipSelected, error && !isSelected ? styles.chipError : null]}
            >
              {isSelected ? <Check size={14} color="#ffffff" strokeWidth={3} /> : null}
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      <FieldMessage error={error} hint={hint} />
    </View>
  );
}

type SegmentOption<Value extends string> = { value: Value; label: string };
type SegmentedProps<Value extends string> = { label?: string; options: readonly SegmentOption<Value>[]; value: Value; onChange: (value: Value) => void; hint?: string };

/** A one-of-N switch. Labels may wrap to two lines so nothing is cut off at 360dp. */
export function Segmented<Value extends string>({ label, options, value, onChange, hint }: SegmentedProps<Value>) {
  const styles = useInstructorFormStyles();
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View accessibilityRole="radiogroup" style={styles.segment}>
        {options.map((option) => (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.value }} onPress={() => onChange(option.value)} android_ripple={RIPPLE} style={[styles.segmentOption, value === option.value && styles.segmentActive]}>
            <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]} numberOfLines={2}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type ToggleRowProps = { label: string; description?: string; value: boolean; onChange: (value: boolean) => void };

export function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={description} accessibilityState={{ checked: value }} onPress={() => onChange(!value)} android_ripple={RIPPLE} style={styles.toggleRow}>
      <View style={styles.flexText}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      <Switch importantForAccessibility="no-hide-descendants" value={value} onValueChange={onChange} trackColor={{ true: ELEARNING_ACTION_GREEN, false: colors.border }} thumbColor="#ffffff" />
    </Pressable>
  );
}

type CheckRowProps = { label: string; checked: boolean; onToggle: () => void; description?: string; hasError?: boolean };

export function CheckRow({ label, checked, onToggle, description, hasError }: CheckRowProps) {
  const styles = useInstructorFormStyles();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} android_ripple={RIPPLE} style={[styles.checkRow, checked && styles.checkRowSelected, hasError && !checked ? styles.inputError : null]}>
      <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>{checked ? <Check size={14} color="#ffffff" strokeWidth={3} /> : null}</View>
      <View style={styles.flexText}>
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
  const isFull = values.length >= maximum;

  return (
    <View style={styles.field}>
      {required ? <Text style={styles.label}>{label}<Text style={styles.required}> *</Text></Text> : <FieldLabel label={label} />}
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={label}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => handleAdd(draft)}
          submitBehavior="submit"
          returnKeyType="done"
          editable={!isFull}
          placeholder={isFull ? `Up to ${maximum}` : placeholder}
          placeholderTextColor={colors.mutedText}
          style={[styles.input, styles.flex, error ? styles.inputError : null]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={`Add to ${label}`} accessibilityState={{ disabled: !draft.trim() || isFull }} disabled={!draft.trim() || isFull} onPress={() => handleAdd(draft)} android_ripple={RIPPLE} style={[styles.squareButton, (!draft.trim() || isFull) && styles.disabled]}>
          <Plus size={20} color={colors.accentText} />
        </Pressable>
      </View>
      {values.length > 0 ? (
        <View style={styles.chips}>
          {values.map((value) => (
            <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Remove ${value}`} onPress={() => onChange(values.filter((entry) => entry !== value))} android_ripple={RIPPLE} style={[styles.chip, styles.chipSelected]}>
              <Text style={[styles.chipText, styles.chipTextSelected]}>{value}</Text>
              <X size={14} color="#ffffff" />
            </Pressable>
          ))}
        </View>
      ) : null}
      {unused.length > 0 && !isFull ? (
        <View style={styles.chips}>
          {unused.slice(0, 18).map((suggestion) => (
            <Pressable key={suggestion} accessibilityRole="button" accessibilityLabel={`Add ${suggestion}`} onPress={() => handleAdd(suggestion)} android_ripple={RIPPLE} style={styles.suggestion}>
              <Plus size={12} color={colors.mutedText} />
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <FieldMessage error={error} hint={hint} />
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
      {required ? <Text style={styles.label}>{label}<Text style={styles.required}> *</Text></Text> : <FieldLabel label={label} />}
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
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label.toLowerCase()} ${index + 1}`} onPress={() => onChange(rows.filter((_entry, position) => position !== index))} android_ripple={RIPPLE} style={styles.squareButton}>
              <X size={18} color={colors.mutedText} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {rows.length < maximum ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Add another ${label.toLowerCase()}`} onPress={() => onChange([...rows, ''])} android_ripple={RIPPLE} style={styles.inlineAdd}>
          <Plus size={16} color={colors.accentText} /><Text style={styles.inlineAddText}>Add another</Text>
        </Pressable>
      ) : null}
      <FieldMessage error={error} hint={hint} />
    </View>
  );
}

type FilePickRowProps = { label: string; fileName?: string; placeholder: string; onPick: () => void; onRemove?: () => void; error?: string; hint?: string; required?: boolean };

export function FilePickRow({ label, fileName, placeholder, onPick, onRemove, error, hint, required }: FilePickRowProps) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  return (
    <View style={styles.field}>
      {required ? <Text style={styles.label}>{label}<Text style={styles.required}> *</Text></Text> : <FieldLabel label={label} />}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={fileName ? `${label}: ${fileName}. Choose another file` : `${label}: ${placeholder}`} onPress={onPick} android_ripple={RIPPLE} style={[styles.fileButton, styles.flex, fileName ? styles.fileButtonFilled : null, error ? styles.inputError : null]}>
          {fileName ? <FileText size={18} color={colors.accentText} /> : <Paperclip size={18} color={colors.mutedText} />}
          <Text style={[styles.fileText, !fileName && styles.fileTextEmpty]} numberOfLines={2}>{fileName ?? placeholder}</Text>
        </Pressable>
        {fileName && onRemove ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${fileName}`} onPress={onRemove} android_ripple={RIPPLE} style={styles.squareButton}><X size={18} color={colors.mutedText} /></Pressable>
        ) : null}
      </View>
      <FieldMessage error={error} hint={hint} />
    </View>
  );
}

/** A titled card that groups related fields. */
export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const styles = useInstructorFormStyles();
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={styles.section}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** "Fix these before you continue" with each problem as its own line. */
export function ErrorList({ errors, title = 'Fix these before you continue' }: { errors: string[]; title?: string }) {
  const { colors } = useAppTheme();
  const styles = useInstructorFormStyles();
  if (errors.length === 0) return null;
  const shown = errors.slice(0, 8);
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorBox}>
      <View style={styles.errorRow}>
        <AlertCircle size={16} color={colors.destructiveText} />
        <Text style={[styles.errorTitle, styles.flexText]}>{title}</Text>
      </View>
      {shown.map((error) => <Text key={error} style={styles.error}>• {error}</Text>)}
      {errors.length > shown.length ? <Text style={styles.error}>…and {errors.length - shown.length} more</Text> : null}
    </View>
  );
}

type PrimaryButtonProps = { label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary'; isBusy?: boolean };

export function FormButton({ label, onPress, disabled, variant = 'primary', isBusy }: PrimaryButtonProps) {
  return <ELearningButton label={label} onPress={onPress} variant={variant} isDisabled={disabled} isBusy={isBusy} />;
}

export const createInstructorFormStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: { gap: 6 },
  sectionCard: { padding: 16, gap: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  sectionHead: { gap: 4 },
  section: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionDescription: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  required: { color: colors.destructiveText },
  optional: { color: colors.mutedText, fontWeight: '500' },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  counter: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  inputError: { borderColor: colors.destructiveText },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, maxWidth: '100%', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  chipSelected: { borderColor: ELEARNING_ACTION_GREEN, backgroundColor: ELEARNING_ACTION_GREEN },
  chipError: { borderColor: colors.destructiveSurface },
  chipText: { flexShrink: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: '#ffffff' },
  suggestion: { minHeight: 36, maxWidth: '100%', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, overflow: 'hidden' },
  suggestionText: { flexShrink: 1, color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.control },
  segmentOption: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 6, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, overflow: 'hidden' },
  segmentActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: ELEARNING_ACTION_GREEN },
  segmentText: { color: colors.mutedText, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  segmentTextActive: { color: colors.text },
  toggleRow: { minHeight: 56, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  checkRow: { minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  checkRowSelected: { borderColor: ELEARNING_ACTION_GREEN },
  checkBox: { width: 22, height: 22, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1.5, borderColor: colors.mutedText, backgroundColor: colors.input },
  checkBoxChecked: { borderColor: ELEARNING_ACTION_GREEN, backgroundColor: ELEARNING_ACTION_GREEN },
  checkLabel: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  squareButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  disabled: { opacity: 0.45 },
  inlineAdd: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  inlineAddText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  fileButton: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  fileButtonFilled: { borderStyle: 'solid' },
  fileText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  fileTextEmpty: { color: colors.mutedText, fontWeight: '500' },
  errorBox: { padding: 12, gap: 4, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  errorTitle: { color: colors.destructiveText, fontSize: 14, fontWeight: '700' },
  error: { color: colors.destructiveText, fontSize: 13, lineHeight: 18 },
});
