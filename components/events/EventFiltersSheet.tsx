import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LocateFixed, RotateCcw, SlidersHorizontal, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import {
  ACCESSIBILITY_OPTIONS, DATE_OPTIONS, DEFAULT_EVENT_FILTERS, FORMAT_OPTIONS, PRICE_OPTIONS, RADIUS_OPTIONS, SORT_LABELS,
  type EventFilters, type EventSort, type EventViewMode,
} from './eventPresentation';

type EventFiltersSheetProps = {
  visible: boolean;
  filters: EventFilters;
  sort: EventSort;
  view: EventViewMode;
  categories: string[];
  tags: string[];
  /** The upcoming page only offers sort, view (grid/list) and category, like the website. */
  simple?: boolean;
  hasLocation: boolean;
  isLocating: boolean;
  onUseLocation: () => void;
  onClearLocation: () => void;
  onApply: (filters: EventFilters, sort: EventSort, view: EventViewMode) => void;
  onClose: () => void;
};

/** The website's phone "Filters" sheet for events: sort, view, category, tags, when, format, price, accessibility and distance. */
export default function EventFiltersSheet({ visible, filters, sort, view, categories, tags, simple, hasLocation, isLocating, onUseLocation, onClearLocation, onApply, onClose }: EventFiltersSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [draft, setDraft] = useState<EventFilters>(filters);
  const [draftSort, setDraftSort] = useState<EventSort>(sort);
  const [draftView, setDraftView] = useState<EventViewMode>(view);

  useEffect(() => {
    if (!visible) return;
    setDraft(filters);
    setDraftSort(sort);
    setDraftView(view);
  }, [filters, sort, view, visible]);

  const pill = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity key={key} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.pill, selected && styles.pillSelected]}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
  const toggle = (list: string[], value: string): string[] => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  const viewOptions: { value: EventViewMode; label: string }[] = simple
    ? [{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }]
    : [{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }, { value: 'calendar', label: 'Calendar' }];

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <SwipeDismissSurface visible={visible} onDismiss={onClose} handleColor={colors.border} accessibilityLabel="Swipe down to close event filters" style={styles.surface}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.surface}>
          <View style={styles.header}>
            <SlidersHorizontal size={21} color={colors.accent} />
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Filter events</Text>
              <Text style={styles.subtitle}>Refine what you discover</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close event filters" hitSlop={12} style={styles.close}><X size={22} color={colors.icon} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.section}>SORT BY</Text>
            <View style={styles.wrap}>{(Object.keys(SORT_LABELS) as EventSort[]).map((value) => pill(value, SORT_LABELS[value], draftSort === value, () => {
              setDraftSort(value);
              if (value === 'distance' && !hasLocation) onUseLocation();
            }))}</View>
            {draftSort === 'distance' && !hasLocation ? <Text style={styles.hint}>{isLocating ? 'Finding your location…' : 'Distance sorting needs your location.'}</Text> : null}

            <Text style={styles.section}>VIEW</Text>
            <View style={styles.wrap}>{viewOptions.map((option) => pill(option.value, option.label, draftView === option.value, () => setDraftView(option.value)))}</View>

            <Text style={styles.section}>CATEGORY</Text>
            <View style={styles.wrap}>
              {pill('All', 'All events', draft.category === 'All', () => setDraft((current) => ({ ...current, category: 'All' })))}
              {categories.map((category) => pill(category, category, draft.category === category, () => setDraft((current) => ({ ...current, category }))))}
            </View>

            {!simple ? (
              <>
                {tags.length ? (
                  <>
                    <Text style={styles.section}>POPULAR TAGS</Text>
                    <View style={styles.wrap}>{tags.map((tag) => pill(`tag-${tag}`, tag, draft.tags.includes(tag), () => setDraft((current) => ({ ...current, tags: toggle(current.tags, tag) }))))}</View>
                  </>
                ) : null}
                <Text style={styles.section}>WHEN</Text>
                <View style={styles.wrap}>{DATE_OPTIONS.map((option) => pill(option.value, option.label, draft.date === option.value, () => setDraft((current) => ({ ...current, date: option.value }))))}</View>
                <Text style={styles.section}>FORMAT</Text>
                <View style={styles.wrap}>{FORMAT_OPTIONS.map((option) => pill(option.value, option.label, draft.format === option.value, () => setDraft((current) => ({ ...current, format: option.value }))))}</View>
                <Text style={styles.section}>PRICE</Text>
                <View style={styles.wrap}>{PRICE_OPTIONS.map((option) => pill(option.value, option.label, draft.price === option.value, () => setDraft((current) => ({ ...current, price: option.value }))))}</View>
                <Text style={styles.section}>ACCESSIBILITY</Text>
                <View style={styles.wrap}>{ACCESSIBILITY_OPTIONS.map((option) => pill(option.value, option.label, draft.accessibility.includes(option.value), () => setDraft((current) => ({ ...current, accessibility: toggle(current.accessibility, option.value) }))))}</View>
                <Text style={styles.section}>DISTANCE</Text>
                <View style={styles.wrap}>{RADIUS_OPTIONS.map((option) => pill(String(option.value), option.label, draft.radiusKm === option.value, () => {
                  setDraft((current) => ({ ...current, radiusKm: option.value }));
                  if (option.value != null && !hasLocation) onUseLocation();
                }))}</View>
                {hasLocation ? (
                  <View style={styles.locationRow}>
                    <Text style={styles.hint}>Using your device location.</Text>
                    <TouchableOpacity onPress={() => { onClearLocation(); setDraft((current) => ({ ...current, radiusKm: null })); }}><Text style={styles.link}>Clear</Text></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity disabled={isLocating} onPress={onUseLocation} style={styles.locationRow}>
                    <LocateFixed size={16} color={colors.accentText} />
                    <Text style={styles.link}>{isLocating ? 'Locating…' : 'Use my location for distance'}</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => { setDraft({ ...DEFAULT_EVENT_FILTERS, search: draft.search }); setDraftSort('soonest'); }} style={styles.reset}>
              <RotateCcw size={17} color={colors.icon} /><Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onApply(draft, draftSort, draftView); onClose(); }} style={styles.apply}>
              <Text style={styles.applyText}>Show events</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SwipeDismissSurface>
    </Modal>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  surface: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 62, paddingHorizontal: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCopy: { flex: 1, marginLeft: 9 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  subtitle: { color: colors.mutedText, fontSize: 11 },
  close: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  content: { padding: 16, paddingBottom: 28 },
  section: { marginTop: 16, marginBottom: 9, color: colors.secondaryText, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  pillSelected: { borderColor: colors.accent, backgroundColor: colors.selectedControl },
  pillText: { color: colors.secondaryText, fontWeight: '800', fontSize: 13 },
  pillTextSelected: { color: colors.selectedText },
  hint: { marginTop: 8, color: colors.mutedText, fontSize: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  link: { color: colors.accentText, fontWeight: '800', fontSize: 13, textDecorationLine: 'underline', marginTop: 8 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  reset: { flex: 1, minHeight: 50, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.control },
  resetText: { color: colors.secondaryText, fontWeight: '900' },
  apply: { flex: 1.7, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  applyText: { color: colors.onAccent, fontWeight: '900' },
});
