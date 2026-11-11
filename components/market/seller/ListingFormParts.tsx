import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { SellerField } from '@/components/ehub/EHubSellerFormParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

export function useListingStyles() {
  const { colors } = useAppTheme();
  return { colors, styles: useMemo(() => createListingStyles(colors), [colors]) };
}

type ListingInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  counter?: boolean;
};

/** A labelled text input matching the seller editor's fields, with keyboard type and an optional character counter. */
export function ListingInput({ label, value, onChangeText, required, hint, multiline, maxLength, placeholder, keyboardType, autoCapitalize, counter }: ListingInputProps) {
  const { colors, styles } = useListingStyles();
  return <SellerField label={label} required={required} hint={hint}>
    <TextInput value={value} onChangeText={onChangeText} multiline={multiline} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={colors.mutedText}
      keyboardType={keyboardType} autoCapitalize={autoCapitalize} autoCorrect={keyboardType ? false : undefined} textAlignVertical={multiline ? 'top' : 'center'}
      accessibilityLabel={label} style={[styles.input, multiline ? styles.multiline : null]} />
    {counter && maxLength ? <Text style={styles.counter}>{value.length}/{maxLength}</Text> : null}
  </SellerField>;
}

type OptionChipsProps<TValue extends string> = { options: readonly { value: TValue; label: string }[]; value: TValue | ''; onChange: (value: TValue) => void; accessibilityLabel: string };

/** A wrapping row of single-choice chips (category, condition, units). */
export function OptionChips<TValue extends string>({ options, value, onChange, accessibilityLabel }: OptionChipsProps<TValue>) {
  const { styles } = useListingStyles();
  return <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.chipWrap}>
    {options.map((option) => {
      const selected = option.value === value;
      return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onChange(option.value)} style={[styles.chip, selected ? styles.chipActive : null]}>
        <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

export function ListingSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const { styles } = useListingStyles();
  return <View style={styles.section}>
    <View style={{ gap: 3 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.hint}>{description}</Text> : null}
    </View>
    {children}
  </View>;
}

/** The web's amber "Complete the following" callout. */
export function ListingIssues({ title, issues }: { title: string; issues: string[] }) {
  const { colors, styles } = useListingStyles();
  if (!issues.length) return null;
  return <View accessibilityRole="alert" style={styles.issues}>
    <View style={styles.issuesHeading}><AlertTriangle size={16} color={colors.warningText} /><Text style={styles.issuesTitle}>{title}</Text></View>
    {issues.map((issue) => <Text key={issue} style={styles.issueText}>• {issue}</Text>)}
  </View>;
}

export const createListingStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
  multiline: { minHeight: 120, maxHeight: 220 },
  counter: { alignSelf: 'flex-end', color: colors.mutedText, fontSize: 11 },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.onAccent },
  section: { padding: 16, gap: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  issues: { padding: 14, gap: 5, borderRadius: 16, borderWidth: 1, borderColor: colors.warningText, backgroundColor: colors.warningSurface },
  issuesHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  issuesTitle: { flex: 1, color: colors.warningText, fontSize: 13, fontWeight: '900' },
  issueText: { color: colors.warningText, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', gap: 10 },
});
