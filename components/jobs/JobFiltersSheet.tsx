import { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SlidersHorizontal, X } from 'lucide-react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import DateTimeField from '@/components/ui/DateTimeField';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type JobSortOption = 'newest' | 'relevance' | 'compensation' | 'deadline';
export type JobFiltersState = {
  employmentType: string;
  experienceLevel: string;
  locationType: string;
  category: string;
  salaryMin: string;
  salaryMax: string;
  /** yyyy-mm-dd */
  postingDate: string;
  /** yyyy-mm-dd */
  closingDate: string;
};

export const EMPTY_JOB_FILTERS: JobFiltersState = { employmentType: '', experienceLevel: '', locationType: '', category: '', salaryMin: '', salaryMax: '', postingDate: '', closingDate: '' };

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'];
const EXPERIENCE_LEVELS = ['Entry', 'Mid', 'Senior', 'Executive'];
const LOCATION_TYPES = ['Remote', 'Hybrid', 'On-site'];
export const JOB_SORT_LABELS: { [sort in JobSortOption]: string } = {
  newest: 'Newest',
  relevance: 'Relevance',
  compensation: 'Compensation (High to Low)',
  deadline: 'Deadline (Soonest)',
};

export type ActiveJobFilterChip = { key: string; label: string; onRemove: () => void };

/** The removable chips under the Filters button (web ActiveFilterChips). */
export function getActiveJobFilterChips(filters: JobFiltersState, sort: JobSortOption, onFiltersChange: (filters: JobFiltersState) => void, onSortChange: (sort: JobSortOption) => void): ActiveJobFilterChip[] {
  const clear = (key: keyof JobFiltersState) => () => onFiltersChange({ ...filters, [key]: '' });
  return [
    ...(filters.employmentType ? [{ key: 'employmentType', label: filters.employmentType, onRemove: clear('employmentType') }] : []),
    ...(filters.experienceLevel ? [{ key: 'experienceLevel', label: filters.experienceLevel, onRemove: clear('experienceLevel') }] : []),
    ...(filters.locationType ? [{ key: 'locationType', label: filters.locationType, onRemove: clear('locationType') }] : []),
    ...(filters.category ? [{ key: 'category', label: filters.category, onRemove: clear('category') }] : []),
    ...(filters.salaryMin ? [{ key: 'salaryMin', label: `Min $${filters.salaryMin}`, onRemove: clear('salaryMin') }] : []),
    ...(filters.salaryMax ? [{ key: 'salaryMax', label: `Max $${filters.salaryMax}`, onRemove: clear('salaryMax') }] : []),
    ...(filters.postingDate ? [{ key: 'postingDate', label: `Posted ${filters.postingDate}`, onRemove: clear('postingDate') }] : []),
    ...(filters.closingDate ? [{ key: 'closingDate', label: `Closes ${filters.closingDate}`, onRemove: clear('closingDate') }] : []),
    ...(sort !== 'newest' ? [{ key: 'sort', label: JOB_SORT_LABELS[sort], onRemove: () => onSortChange('newest') }] : []),
  ];
}

const toDateValue = (value: string): Date | null => (value ? new Date(`${value}T00:00:00`) : null);
const fromDate = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

type JobFiltersSheetProps = {
  visible: boolean;
  filters: JobFiltersState;
  sort: JobSortOption;
  totalResults: number | null;
  onFiltersChange: (filters: JobFiltersState) => void;
  onSortChange: (sort: JobSortOption) => void;
  onClose: () => void;
};

/** "Filter jobs" sheet (web components/jobs/JobFilters.tsx phone layout): filters apply as they change. */
export default function JobFiltersSheet({ visible, filters, sort, totalResults, onFiltersChange, onSortChange, onClose }: JobFiltersSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const update = (key: keyof JobFiltersState, value: string): void => onFiltersChange({ ...filters, [key]: value });
  const toggle = (key: keyof JobFiltersState, value: string): void => update(key, filters[key] === value ? '' : value);

  const pills = (key: keyof JobFiltersState, options: string[]) => (
    <View style={styles.pillRow}>
      {options.map((option) => {
        const isActive = filters[key] === option;
        return <TouchableOpacity key={option} accessibilityRole="button" accessibilityState={{ selected: isActive }} onPress={() => toggle(key, option)} style={[styles.pill, isActive && styles.pillActive]}><Text style={[styles.pillText, isActive && styles.pillTextActive]}>{option}</Text></TouchableOpacity>;
      })}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <SlidersHorizontal size={20} color={colors.text} />
          <Text style={styles.title}>Filter jobs</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} style={styles.close}><X size={22} color={colors.icon} /></TouchableOpacity>
        </View>
        <KeyboardSafeView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>Sort by</Text>
            <View style={styles.pillRow}>
              {(Object.keys(JOB_SORT_LABELS) as JobSortOption[]).map((option) => (
                <TouchableOpacity key={option} accessibilityRole="button" accessibilityState={{ selected: sort === option }} onPress={() => onSortChange(option)} style={[styles.pill, sort === option && styles.pillActive]}>
                  <Text style={[styles.pillText, sort === option && styles.pillTextActive]}>{JOB_SORT_LABELS[option]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.heading}>Employment Type</Text>
            {pills('employmentType', EMPLOYMENT_TYPES)}
            <Text style={styles.heading}>Experience Level</Text>
            {pills('experienceLevel', EXPERIENCE_LEVELS)}
            <Text style={styles.heading}>Location Type</Text>
            {pills('locationType', LOCATION_TYPES)}
            <Text style={styles.heading}>Category</Text>
            <TextInput value={filters.category} onChangeText={(value) => update('category', value)} placeholder="e.g. Engineering, Design" placeholderTextColor={colors.mutedText} style={styles.input} accessibilityLabel="Category" />
            <Text style={styles.heading}>Salary Range</Text>
            <View style={styles.salaryRow}>
              <TextInput value={filters.salaryMin} onChangeText={(value) => update('salaryMin', value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="$ Min" placeholderTextColor={colors.mutedText} style={[styles.input, styles.flex]} accessibilityLabel="Minimum salary" />
              <Text style={styles.dash}>–</Text>
              <TextInput value={filters.salaryMax} onChangeText={(value) => update('salaryMax', value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="$ Max" placeholderTextColor={colors.mutedText} style={[styles.input, styles.flex]} accessibilityLabel="Maximum salary" />
            </View>
            <DateTimeField label="Posting Date" mode="date" value={toDateValue(filters.postingDate)} onChange={(date) => update('postingDate', fromDate(date))} onClear={() => update('postingDate', '')} placeholder="Posted on or after" />
            <DateTimeField label="Closing Date" mode="date" value={toDateValue(filters.closingDate)} onChange={(date) => update('closingDate', fromDate(date))} onClear={() => update('closingDate', '')} placeholder="Closes on or before" />
          </ScrollView>
        </KeyboardSafeView>
        <View style={styles.footer}>
          <TouchableOpacity accessibilityRole="button" onPress={() => { onFiltersChange(EMPTY_JOB_FILTERS); onSortChange('newest'); }} style={styles.resetButton}><Text style={styles.resetText}>Reset</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneText}>{totalResults !== null ? `Show ${totalResults} ${totalResults === 1 ? 'result' : 'results'}` : 'Show results'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' },
  close: { padding: 4 },
  content: { padding: 18, gap: 10, paddingBottom: 30 },
  heading: { color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  pillActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  pillText: { color: colors.secondaryText, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: colors.onAccent },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: colors.text, backgroundColor: colors.input },
  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dash: { color: colors.mutedText },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  resetButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' },
  resetText: { color: colors.text, fontWeight: '800' },
  doneButton: { flex: 2, minHeight: 46, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: colors.onAccent, fontWeight: '900' },
});
