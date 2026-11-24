import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertCircle, Check, CheckCircle2, Plus, X } from 'lucide-react-native';
import { JOBS_ACTION_GREEN } from '@/components/jobs/JobCardParts';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/**
 * Shared, themed building blocks for the job and quick task forms (web createJobsModel/formParts), in the E-Hub style
 * of the job board: hairline borders, 16 radius sections, 48dp inputs, labels above fields and helper or error text
 * below them. Pressables use static styles plus a ripple (NativeWind drops `style` functions).
 */

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

export type ChoiceOption<T extends string> = { value: T; label: string; description?: string };
export type FormKeyboardType = 'default' | 'decimal-pad' | 'number-pad' | 'url' | 'email-address' | 'phone-pad';
export type FormAutoCapitalize = 'none' | 'sentences' | 'words' | 'characters';

type FieldErrorProps = { message?: string | null };

/** Red helper line with an icon, announced politely by screen readers. Renders nothing without a message. */
export function FieldError({ message }: FieldErrorProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!message) return null;
  return <View accessibilityLiveRegion="polite" style={styles.errorRow}>
    <AlertCircle size={14} color={colors.destructiveText} />
    <Text style={styles.errorText}>{message}</Text>
  </View>;
}

type FieldLabelProps = { label: string; required?: boolean; optional?: boolean };

/** "Label *" or "Label (optional)". */
export function FieldLabel({ label, required = false, optional = false }: FieldLabelProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Text style={styles.label}>
    {label}
    {required ? <Text style={styles.required}> *</Text> : null}
    {optional ? <Text style={styles.optional}> (optional)</Text> : null}
  </Text>;
}

type FormSectionProps = {
  title: string;
  description?: string;
  required?: boolean;
  tone?: 'default' | 'warning';
  action?: ReactNode;
  /** A problem with the section as a whole (e.g. "add at least one"). */
  error?: string | null;
  children: ReactNode;
};

export function FormSection({ title, description, required = false, tone = 'default', action, error, children }: FormSectionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.section, tone === 'warning' && styles.sectionWarning, error ? styles.sectionError : null]}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{title}{required ? <Text style={styles.required}> *</Text> : null}</Text>
          {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
        </View>
        {action ? <View style={styles.sectionAction}>{action}</View> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
      <FieldError message={error} />
    </View>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  multiline?: boolean;
  keyboardType?: FormKeyboardType;
  autoCapitalize?: FormAutoCapitalize;
  hint?: string;
  error?: string | null;
  maxLength?: number;
  /** Shows "12 / 300" under the field (on by default for multiline fields with a maxLength). */
  showCount?: boolean;
  /** Text shown inside the field's right edge, e.g. "%". */
  suffix?: string;
};

export function FormField({ label, value, onChangeText, placeholder, required = false, optional = false, multiline = false, keyboardType = 'default', autoCapitalize, hint, error, maxLength, showCount, suffix }: FormFieldProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const capitalize = autoCapitalize ?? (keyboardType === 'url' || keyboardType === 'email-address' ? 'none' : 'sentences');
  const isCountVisible = (showCount ?? multiline) && typeof maxLength === 'number';
  return (
    <View style={styles.field}>
      <FieldLabel label={label} required={required} optional={optional} />
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedText}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={capitalize}
          autoCorrect={keyboardType === 'default'}
          maxLength={maxLength}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          returnKeyType={multiline ? 'default' : 'next'}
          style={[styles.input, multiline && styles.textArea, suffix ? styles.inputWithSuffix : null, error ? styles.inputError : null]}
        />
        {suffix ? <View pointerEvents="none" style={styles.suffixWrap}><Text style={styles.suffix}>{suffix}</Text></View> : null}
      </View>
      {error ? <FieldError message={error} /> : null}
      {!error && (hint || isCountVisible) ? (
        <View style={styles.hintRow}>
          {hint ? <Text style={[styles.hint, styles.flex]}>{hint}</Text> : <View style={styles.flex} />}
          {isCountVisible ? <Text style={styles.count}>{value.length} / {maxLength}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

type ChoicePillsProps<T extends string> = {
  label?: string;
  required?: boolean;
  optional?: boolean;
  options: readonly ChoiceOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  /** Tapping the selected option clears it (optional fields). */
  allowClear?: boolean;
  /** One swipeable row instead of wrapping lines; only for short lists inside tight rows. */
  scrollable?: boolean;
  hint?: string;
  error?: string | null;
};

export function ChoicePills<T extends string>({ label, required = false, optional = false, options, value, onChange, allowClear = false, scrollable = false, hint, error }: ChoicePillsProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pills = options.map((option) => {
    const isActive = option.value === value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="radio"
        accessibilityLabel={label ? `${label}: ${option.label}` : option.label}
        accessibilityState={{ selected: isActive }}
        accessibilityHint={isActive && allowClear ? 'Tap again to clear' : undefined}
        onPress={() => (isActive && allowClear ? onChange('' as T) : onChange(option.value))}
        hitSlop={4}
        android_ripple={RIPPLE}
        style={[styles.pill, isActive && styles.pillActive, error && !value ? styles.pillError : null]}
      >
        {isActive ? <CheckCircle2 size={14} color={colors.successText} /> : null}
        <Text numberOfLines={1} style={[styles.pillText, isActive && styles.pillTextActive]}>{option.label}</Text>
      </Pressable>
    );
  });
  return (
    <View style={styles.field} accessibilityRole="radiogroup">
      {label ? <FieldLabel label={label} required={required} optional={optional} /> : null}
      {scrollable
        ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRowScroll}>{pills}</ScrollView>
        : <View style={styles.pillRow}>{pills}</View>}
      {error ? <FieldError message={error} /> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type ChoiceCardsProps<T extends string> = {
  label?: string;
  options: readonly ChoiceOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  /** 'grid' = two per row (short labels), 'list' = one per row (sentence-length labels). */
  layout?: 'grid' | 'list';
  error?: string | null;
};

/** Larger radio options with a description (web ChoiceCard groups). */
export function ChoiceCards<T extends string>({ label, options, value, onChange, layout = 'grid', error }: ChoiceCardsProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.field} accessibilityRole="radiogroup">
      {label ? <FieldLabel label={label} /> : null}
      <View style={layout === 'grid' ? styles.cardGrid : styles.cardList}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.description ? `${option.label}. ${option.description}` : option.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => onChange(option.value)}
              android_ripple={RIPPLE}
              style={[styles.choiceCard, layout === 'grid' && styles.choiceCardGrid, isActive && styles.choiceCardActive]}
            >
              <View style={[styles.radio, isActive && styles.radioActive]}>{isActive ? <View style={styles.radioDot} /> : null}</View>
              <View style={styles.flex}>
                <Text style={[styles.choiceTitle, isActive && styles.pillTextActive]}>{option.label}</Text>
                {option.description ? <Text style={styles.choiceDescription}>{option.description}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <FieldError message={error} />
    </View>
  );
}

type ChipInputProps = {
  label?: string;
  required?: boolean;
  items: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  placeholder: string;
  emptyText?: string;
  hint?: string;
  error?: string | null;
};

/** Type, then tap + (or the keyboard's Done) to add a chip; each chip has a 44dp remove target. */
export function ChipInput({ label, required = false, items, inputValue, onInputChange, onAdd, onRemove, placeholder, emptyText, hint, error }: ChipInputProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canAdd = inputValue.trim().length > 0;
  return (
    <View style={styles.field}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      <View style={styles.rowInputLine}>
        <TextInput
          value={inputValue}
          onChangeText={onInputChange}
          onSubmitEditing={onAdd}
          blurOnSubmit={false}
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={colors.mutedText}
          accessibilityLabel={label ?? placeholder}
          style={[styles.input, styles.flex, error ? styles.inputError : null]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={label ? `Add to ${label.toLowerCase()}` : 'Add'} accessibilityState={{ disabled: !canAdd }} disabled={!canAdd} onPress={onAdd} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={[styles.addInlineButton, !canAdd && styles.disabled]}>
          <Plus size={20} color="#ffffff" />
        </Pressable>
      </View>
      {error ? <FieldError message={error} /> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {items.length > 0 ? (
        <View style={styles.pillRow}>
          {items.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.chip}>
              <Text numberOfLines={1} style={styles.chipText}>{item}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item}`} hitSlop={10} onPress={() => onRemove(index)} style={styles.chipRemove}>
                <X size={14} color={colors.successText} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : emptyText ? <Text style={styles.hint}>{emptyText}</Text> : null}
    </View>
  );
}

type AddRowButtonProps = { label: string; onPress: () => void; accessibilityLabel?: string };

export function AddRowButton({ label, onPress, accessibilityLabel }: AddRowButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} hitSlop={6} android_ripple={RIPPLE} style={styles.addRowButton}>
      <Plus size={15} color={colors.accentText} />
      <Text numberOfLines={1} style={styles.addRowText}>{label}</Text>
    </Pressable>
  );
}

type RemovableRowProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onRemove: () => void;
  removeLabel: string;
  accessory?: ReactNode;
  /** Hides the remove button (e.g. the last required row). */
  canRemove?: boolean;
  multiline?: boolean;
  accessibilityLabel?: string;
  hasError?: boolean;
};

export function RemovableRow({ value, onChangeText, placeholder, onRemove, removeLabel, accessory, canRemove = true, multiline = false, accessibilityLabel, hasError = false }: RemovableRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.rowInputLine, multiline && styles.rowInputLineTop]}>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedText} multiline={multiline} accessibilityLabel={accessibilityLabel ?? placeholder} style={[styles.input, styles.flex, multiline && styles.rowTextArea, hasError ? styles.inputError : null]} />
      {accessory}
      {canRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={removeLabel} onPress={onRemove} android_ripple={RIPPLE} style={styles.removeButton}>
          <X size={18} color={colors.destructiveText} />
        </Pressable>
      ) : null}
    </View>
  );
}

type AgreementCheckboxProps = { checked: boolean; onChange: (checked: boolean) => void; tone?: 'default' | 'warning'; error?: string | null; children: ReactNode };

export function AgreementCheckbox({ checked, onChange, tone = 'default', error, children }: AgreementCheckboxProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        android_ripple={RIPPLE}
        style={[styles.agreement, tone === 'warning' && styles.agreementWarning, error && !checked ? styles.agreementError : null]}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Check size={15} color="#ffffff" /> : null}</View>
        <Text style={styles.agreementText}>{children}</Text>
      </Pressable>
      {!checked ? <FieldError message={error} /> : null}
    </View>
  );
}

type DisclaimerBoxProps = { text: string };

export function DisclaimerBox({ text }: DisclaimerBoxProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.disclaimerBox}><Text style={styles.disclaimerText}>{text}</Text></View>;
}

type SummaryRowProps = { label: string; value: string };

/** "Label   value" on one line that wraps the value, for review screens. */
export function SummaryRow({ label, value }: SummaryRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>;
}

export const createJobFormStyles = (colors: ThemeColors) => createStyles(colors);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  disabled: { opacity: 0.45 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 14 },
  sectionWarning: { borderColor: colors.warningText, backgroundColor: colors.warningSurface },
  sectionError: { borderColor: colors.destructiveText, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sectionAction: { flexShrink: 0 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  sectionDescription: { color: colors.mutedText, fontSize: 13, marginTop: 3, lineHeight: 18 },
  sectionBody: { gap: 16 },
  required: { color: colors.destructiveText },
  optional: { color: colors.mutedText, fontWeight: '600' },
  field: { gap: 6 },
  label: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  inputWrap: { justifyContent: 'center' },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: colors.text, backgroundColor: colors.input, fontSize: 15 },
  inputWithSuffix: { paddingRight: 36 },
  suffixWrap: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  suffix: { color: colors.mutedText, fontSize: 15, fontWeight: '700' },
  inputError: { borderColor: colors.destructiveText, borderWidth: 1 },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  rowTextArea: { minHeight: 72, textAlignVertical: 'top' },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  count: { color: colors.mutedText, fontSize: 12, fontVariant: ['tabular-nums'] },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  errorText: { flex: 1, color: colors.destructiveText, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillRowScroll: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  pill: { minHeight: 40, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 14 },
  pillActive: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  pillError: { borderColor: colors.destructiveText },
  pillText: { flexShrink: 1, color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  pillTextActive: { color: colors.successText, fontWeight: '800' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardList: { gap: 8 },
  choiceCard: { minHeight: 56, flexDirection: 'row', alignItems: 'flex-start', gap: 10, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, padding: 12 },
  choiceCardGrid: { flexGrow: 1, flexBasis: '45%' },
  choiceCardActive: { borderColor: colors.accent, borderWidth: 1, backgroundColor: colors.successSurface },
  radio: { width: 20, height: 20, marginTop: 1, borderRadius: 10, borderWidth: 1.5, borderColor: colors.mutedText, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: JOBS_ACTION_GREEN },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: JOBS_ACTION_GREEN },
  choiceTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  choiceDescription: { color: colors.mutedText, fontSize: 12, lineHeight: 16, marginTop: 2 },
  rowInputLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowInputLineTop: { alignItems: 'flex-start' },
  addInlineButton: { width: 48, height: 48, overflow: 'hidden', borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN, alignItems: 'center', justifyContent: 'center' },
  chip: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.successSurface, borderRadius: 999, paddingLeft: 12, paddingRight: 4, minHeight: 34 },
  chipText: { flexShrink: 1, color: colors.successText, fontSize: 13, fontWeight: '700' },
  chipRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  addRowButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden', paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.successSurface },
  addRowText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
  removeButton: { width: 44, height: 48, overflow: 'hidden', borderRadius: 12, backgroundColor: colors.destructiveSurface, alignItems: 'center', justifyContent: 'center' },
  agreement: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, overflow: 'hidden', padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.control },
  agreementWarning: { backgroundColor: colors.warningSurface, borderColor: colors.warningText },
  agreementError: { borderColor: colors.destructiveText, borderWidth: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.mutedText, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  checkboxChecked: { backgroundColor: JOBS_ACTION_GREEN, borderColor: JOBS_ACTION_GREEN },
  agreementText: { flex: 1, color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  disclaimerBox: { borderRadius: 12, backgroundColor: colors.control, padding: 14 },
  disclaimerText: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  summaryLabel: { width: 96, color: colors.mutedText, fontSize: 13, fontWeight: '700' },
  summaryValue: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
