import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CalendarDays, SlidersHorizontal, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import PageHeader from '@/components/ui/PageHeader';
import EventCard from '@/components/events/EventCard';
import EventFiltersSheet from '@/components/events/EventFiltersSheet';
import { EventListCardsSkeleton } from '@/components/events/EventSkeletons';
import { useEventActions } from '@/components/events/useEventActions';
import { DEFAULT_EVENT_FILTERS, SORT_LABELS, matchesEventFilters, sortEvents, type Coordinates, type EventFilters, type EventSort, type EventViewMode } from '@/components/events/eventPresentation';
import { eventService } from '@/lib/services/EventService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import type { Event } from '@/types/eventTypes';

const EVENTS_PER_PAGE = 9;

/** The website's /events/upcoming: every event that has not started yet, with search, category, sort and grid/list. */
export default function UpcomingEventsPage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeUserId } = useAppData();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  const [sort, setSort] = useState<EventSort>('soonest');
  const [view, setView] = useState<EventViewMode>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(EVENTS_PER_PAGE);
  const actions = useEventActions({ viewerId: activeUserId });
  const { loadStates } = actions;

  const load = useCallback(async () => {
    setError('');
    try {
      const upcoming = (await eventService.fetchEvents())
        .filter((event) => new Date(event.startDate).getTime() > Date.now())
        .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime());
      setEvents(upcoming);
      void loadStates(upcoming.flatMap((event) => (event.id ? [event.id] : [])));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Events could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadStates]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setVisibleCount(EVENTS_PER_PAGE); }, [filters, sort]);

  const handleUseLocation = async () => {
    setIsLocating(true);
    try {
      setLocation(await eventService.getViewerCoordinates());
    } catch (locationError: unknown) {
      toast.error(locationError instanceof Error ? locationError.message : 'Could not access your location');
    } finally {
      setIsLocating(false);
    }
  };

  const attendeeCounts = useMemo(() => Object.fromEntries(Object.entries(actions.attendance).map(([eventId, state]) => [eventId, state.attendeeCount])), [actions.attendance]);
  const categories = useMemo(() => [...new Set(events.map((event) => event.category).filter((value): value is string => Boolean(value)))].sort(), [events]);
  const results = useMemo(() => sortEvents(events.filter((event) => matchesEventFilters(event, filters, location)), sort, location, attendeeCounts), [attendeeCounts, events, filters, location, sort]);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Upcoming Events" onBackPress={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.accent} />}>
        <View>
          <Text style={styles.title}>Upcoming Events</Text>
          <Text style={styles.subtitle}>{loading ? 'Loading events…' : `${results.length} event${results.length !== 1 ? 's' : ''} coming up`}</Text>
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <TextInput value={filters.search} onChangeText={(search) => setFilters((current) => ({ ...current, search }))} placeholder="Search upcoming events..." placeholderTextColor={colors.mutedText} style={styles.searchInput} />
            {filters.search ? <TouchableOpacity accessibilityLabel="Clear search" hitSlop={8} onPress={() => setFilters((current) => ({ ...current, search: '' }))}><X size={16} color={colors.mutedText} /></TouchableOpacity> : null}
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Toggle filters" onPress={() => setFiltersOpen(true)} style={styles.filterButton}>
            <SlidersHorizontal size={19} color={colors.text} />
          </TouchableOpacity>
        </View>
        {filters.category !== 'All' || sort !== 'soonest' ? (
          <View style={styles.chips}>
            {filters.category !== 'All' ? <TouchableOpacity accessibilityLabel="Remove filter" onPress={() => setFilters((current) => ({ ...current, category: 'All' }))} style={styles.chip}><Text style={styles.chipText}>{filters.category}</Text><X size={13} color={colors.successText} /></TouchableOpacity> : null}
            {sort !== 'soonest' ? <TouchableOpacity onPress={() => setSort('soonest')} style={styles.chip}><Text style={styles.chipText}>{SORT_LABELS[sort]}</Text><X size={13} color={colors.successText} /></TouchableOpacity> : null}
          </View>
        ) : null}
        {sort === 'distance' && !location && !isLocating ? <Text style={styles.subtitle}>Allow location access to sort by distance.</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {loading ? <EventListCardsSkeleton /> : results.length === 0 ? (
          <View style={styles.empty}>
            <CalendarDays size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>No upcoming events found</Text>
            <Text style={styles.subtitle}>{filters.search || filters.category !== 'All' ? 'Try adjusting your search or filters.' : 'Check back soon for new events.'}</Text>
            {filters.search || filters.category !== 'All' ? <TouchableOpacity onPress={() => setFilters(DEFAULT_EVENT_FILTERS)} style={styles.clearButton}><Text style={styles.clearButtonText}>Clear filters</Text></TouchableOpacity> : null}
          </View>
        ) : (
          <>
            {results.slice(0, visibleCount).map((event) => {
              const eventId = event.id ?? '';
              return (
                <EventCard
                  key={eventId || event.title}
                  event={event}
                  variant={view === 'list' ? 'list' : 'grid'}
                  attendeeCount={actions.attendance[eventId]?.attendeeCount ?? 0}
                  isAttending={Boolean(actions.attendance[eventId]?.isAttending)}
                  showDaysLeft
                  compactActions
                  onOpen={() => router.push({ pathname: '/events/[id]', params: { id: eventId } })}
                  onReport={() => actions.report(event)}
                />
              );
            })}
            {results.length > visibleCount ? (
              <TouchableOpacity onPress={() => setVisibleCount((count) => count + EVENTS_PER_PAGE)} style={styles.loadMore}>
                <Text style={styles.loadMoreText}>Show more ({results.length - visibleCount} more)</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
      <EventFiltersSheet
        visible={filtersOpen}
        simple
        filters={filters}
        sort={sort}
        view={view}
        categories={categories}
        tags={[]}
        hasLocation={Boolean(location)}
        isLocating={isLocating}
        onUseLocation={() => void handleUseLocation()}
        onClearLocation={() => setLocation(null)}
        onApply={(nextFilters, nextSort, nextView) => { setFilters(nextFilters); setSort(nextSort); setView(nextView === 'calendar' ? 'grid' : nextView); }}
        onClose={() => setFiltersOpen(false)}
      />
      {actions.dialogs}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 14, paddingBottom: 48, gap: 14 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  subtitle: { color: colors.mutedText, fontSize: 13, marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 10, fontSize: 14 },
  filterButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.successSurface },
  chipText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  clearButton: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.accent },
  clearButtonText: { color: colors.onAccent, fontWeight: '900' },
  loadMore: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  loadMoreText: { color: colors.text, fontWeight: '800' },
});
