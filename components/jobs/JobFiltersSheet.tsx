import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import DateTimeField from '@/components/ui/DateTimeField';
import { JOBS_ACTION_GREEN, JobChip, formatShortDate } from '@/components/jobs/JobCardParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

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
/** Fits the Sort button above the list on a 360dp phone. */
export const JOB_SORT_SHORT_LABELS: { [sort in JobSortOption]: string } = {
  newest: 'Newest',
  relevance: 'Relevance',
  compensation: 'Highest pay',
  deadline: 'Closing soon',
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
    ...(filters.postingDate ? [{ key: 'postingDate', label: `Posted since ${formatShortDate(new Date(`${filters.postingDate}T00:00:00`).getTime())}`, onRemove: clear('postingDate') }] : []),
    ...(filters.closingDate ? [{ key: 'closingDate', label: `Closes by ${formatShortDate(new Date(`${filters.closingDate}T00:00:00`).getTime())}`, onRemove: clear('closingDate') }] : []),
    ...(sort !== 'newest' ? [{ key: 'sort', label: `Sort: ${JOB_SORT_SHORT_LABELS[sort]}`, onRemove: () => onSortChange('newest') }] : []),
  ];
}

const toDateValue = (value: string): Date | null => (value ? new Date(`${value}T00:00:00`) : null);
const fromDate = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

type JobFiltersSheetProps = {
  visible: boolean;
  filters: JobFiltersState;
  sort: JobSortOption;
  totalResults: number | null;
  /** "Show 4 jobs" / "Show 4 tasks". */
  unit?: 'job' | 'task';
  onFiltersChange: (filters: JobFiltersState) => void;
  onSortChange: (sort: JobSortOption) => void;
  onClose: () => void;
};

/**
 * "Filters" sheet (web components/jobs/JobFilters.tsx phone layout): filters apply as they change; the footer keeps
 * "Clear all" and "Show n jobs" within reach, and the header says how many filters are on.
 */
export default function JobFiltersSheet({ visible, filters, sort, totalResults, unit = 'job', onFiltersChange, onSortChange, onClose }: JobFiltersSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const update = (key: keyof JobFiltersState, value: string): void => onFiltersChange({ ...filters, [key]: value });
  const toggle = (key: keyof JobFiltersState, value: string): void => update(key, filters[key] === value ? '' : value);
  const activeCount = Object.values(filters).filter(Boolean).length + (sort !== 'newest' ? 1 : 0);

  const chips = (key: keyof JobFiltersState, options: string[]) => (
    <View style={styles.chipRow}>
      {options.map((option) => <JobChip key={option} label={option} isSelected={filters[key] === option} onPress={() => toggle(key, option)} />)}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={styles.title}>Filters</Text>
            <Text style={styles.subtitle}>{activeCount ? `${activeCount} applied` : 'Nothing applied yet'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} hitSlop={4} android_ripple={{ color: colors.control, borderless: true }} style={styles.close}><X size={22} color={colors.icon} /></Pressable>
        </View>
        <KeyboardSafeView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>Sort by</Text>
            <View style={styles.chipRow}>
              {(Object.keys(JOB_SORT_LABELS) as JobSortOption[]).map((option) => <JobChip key={option} label={JOB_SORT_SHORT_LABELS[option]} accessibilityLabel={`Sort by ${JOB_SORT_LABELS[option]}`} isSelected={sort === option} onPress={() => onSortChange(option)} />)}
            </View>
            <Text style={styles.heading}>Employment type</Text>
            {chips('employmentType', EMPLOYMENT_TYPES)}
            <Text style={styles.heading}>Experience level</Text>
            {chips('experienceLevel', EXPERIENCE_LEVELS)}
            <Text style={styles.heading}>Location type</Text>
            {chips('locationType', LOCATION_TYPES)}
            <Text style={styles.heading}>Category</Text>
            <TextInput value={filters.category} onChangeText={(value) => update('category', value)} placeholder="e.g. Engineering, Design" placeholderTextColor={colors.mutedText} style={styles.input} accessibilityLabel="Category" />
            <Text style={styles.heading}>Pay range</Text>
            <View style={styles.salaryRow}>
              <TextInput value={filters.salaryMin} onChangeText={(value) => update('salaryMin', value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="Min" placeholderTextColor={colors.mutedText} style={[styles.input, styles.flex]} accessibilityLabel="Minimum pay" />
              <Text style={styles.dash}>–</Text>
              <TextInput value={filters.salaryMax} onChangeText={(value) => update('salaryMax', value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="Max" placeholderTextColor={colors.mutedText} style={[styles.input, styles.flex]} accessibilityLabel="Maximum pay" />
            </View>
            <DateTimeField label="Posted on or after" mode="date" value={toDateValue(filters.postingDate)} onChange={(date) => update('postingDate', fromDate(date))} onClear={() => update('postingDate', '')} placeholder="Any date" />
            <DateTimeField label="Closes on or before" mode="date" value={toDateValue(filters.closingDate)} onChange={(date) => update('closingDate', fromDate(date))} onClear={() => update('closingDate', '')} placeholder="Any date" />
          </ScrollView>
        </KeyboardSafeView>
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: activeCount === 0 }} disabled={activeCount === 0} onPress={() => { onFiltersChange(EMPTY_JOB_FILTERS); onSortChange('newest'); }} android_ripple={{ color: colors.control }} style={[styles.resetButton, activeCount === 0 && styles.disabled]}><Text numberOfLines={1} style={styles.resetText}>Clear all</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.doneButton}>
            <Text numberOfLines={1} style={styles.doneText}>{totalResults !== null ? `Show ${totalResults} ${totalResults === 1 ? unit : `${unit}s`}` : 'Show results'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
    flex: { flex: 1, minWidth: 0 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
    title: { color: colors.text, fontSize: 18, fontWeight: '900' },
    subtitle: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
    close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    content: { padding: 16, gap: 8, paddingBottom: 32 },
    heading: { color: colors.secondaryText, fontSize: 13, fontWeight: '800', marginTop: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.input, fontSize: 14 },
    salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dash: { color: colors.mutedText },
    footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
    resetButton: { flex: 1, minHeight: 48, overflow: 'hidden', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    resetText: { color: colors.text, fontWeight: '800' },
    disabled: { opacity: 0.5 },
    doneButton: { flex: 2, minHeight: 48, overflow: 'hidden', borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    doneText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  });
}

