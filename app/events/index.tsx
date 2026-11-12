import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, ChevronRight, MapPin, PartyPopper, Plus, Search, Share2, SlidersHorizontal, Users, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import PageHeader from '@/components/ui/PageHeader';
import CreateEventModal from '@/components/events/createEventModal/CreateEventModal';
import EventsCalendar from '@/components/events/EventsCalendar';
import EventCard from '@/components/events/EventCard';
import EventFiltersSheet from '@/components/events/EventFiltersSheet';
import { EventListCardsSkeleton } from '@/components/events/EventSkeletons';
import { useEventActions } from '@/components/events/useEventActions';
import {
  ACCESSIBILITY_OPTIONS, DATE_OPTIONS, DEFAULT_EVENT_FILTERS, FORMAT_OPTIONS, PRICE_OPTIONS, SORT_LABELS, formatEventRange, matchesEventFilters, sortEvents,
  type Coordinates, type EventFilters, type EventSort, type EventViewMode,
} from '@/components/events/eventPresentation';
import { eventService } from '@/lib/services/EventService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import type { Event } from '@/types/eventTypes';

const EVENTS_PER_PAGE = 9;
type FilterChip = { key: string; label: string; onRemove: () => void };

/** The website's /events: featured event, active count, upcoming strip, search + filters, cards or calendar, create. */
export default function EventsPage() {
  const router = useRouter();
  const { targetId } = useLocalSearchParams<{ targetId?: string }>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeUserId } = useAppData();
  const { authorization } = usePageAccess();
  const isStaff = authorization.isAdmin || authorization.isModerator;

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
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const actions = useEventActions({ viewerId: activeUserId, onRemoved: (eventId) => setEvents((current) => current.filter((event) => event.id !== eventId)) });
  const { loadStates } = actions;

  const load = useCallback(async () => {
    setError('');
    try {
      const liveEvents = await eventService.fetchEvents();
      setEvents(liveEvents);
      void loadStates(liveEvents.flatMap((event) => (event.id ? [event.id] : [])));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Events could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadStates]);
  useEffect(() => { void load(); }, [load]);

  const attendeeCounts = useMemo(() => Object.fromEntries(Object.entries(actions.attendance).map(([eventId, state]) => [eventId, state.attendeeCount])), [actions.attendance]);
  const categories = useMemo(() => [...new Set(events.map((event) => event.category).filter((value): value is string => Boolean(value)))].sort(), [events]);
  const tags = useMemo(() => [...new Set(events.flatMap((event) => event.tags ?? []))], [events]);
  const featured = useMemo(() => [...events.filter((event) => event.isFeatured), ...events.filter((event) => !event.isFeatured)][0] ?? null, [events]);
  const upcoming = useMemo(() => events.filter((event) => new Date(event.startDate).getTime() > Date.now()).sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime()).slice(0, 3), [events]);
  const results = useMemo(() => {
    const sorted = sortEvents(events.filter((event) => matchesEventFilters(event, filters, location)), sort, location, attendeeCounts);
    // A shared or notified event opens at the top of the list.
    return targetId ? [...sorted.filter((event) => event.id === targetId), ...sorted.filter((event) => event.id !== targetId)] : sorted;
  }, [attendeeCounts, events, filters, location, sort, targetId]);
  useEffect(() => { setVisibleCount(EVENTS_PER_PAGE); }, [filters, sort]);

  const handleUseLocation = async () => {
    setIsLocating(true);
    try {
      setLocation(await eventService.getViewerCoordinates());
      toast.success('Location set — showing events within your radius');
    } catch (locationError: unknown) {
      toast.error(locationError instanceof Error ? locationError.message : 'Could not access your location');
    } finally {
      setIsLocating(false);
    }
  };

  const chips: FilterChip[] = [
    ...(filters.category !== 'All' ? [{ key: 'category', label: filters.category, onRemove: () => setFilters((current) => ({ ...current, category: 'All' })) }] : []),
    ...filters.tags.map((tag) => ({ key: `tag-${tag}`, label: tag, onRemove: () => setFilters((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) })) })),
    ...(filters.date !== 'all' ? [{ key: 'date', label: DATE_OPTIONS.find((option) => option.value === filters.date)?.label ?? filters.date, onRemove: () => setFilters((current) => ({ ...current, date: 'all' as const })) }] : []),
    ...(filters.format !== 'all' ? [{ key: 'format', label: FORMAT_OPTIONS.find((option) => option.value === filters.format)?.label ?? filters.format, onRemove: () => setFilters((current) => ({ ...current, format: 'all' as const })) }] : []),
    ...(filters.price !== 'all' ? [{ key: 'price', label: PRICE_OPTIONS.find((option) => option.value === filters.price)?.label ?? filters.price, onRemove: () => setFilters((current) => ({ ...current, price: 'all' as const })) }] : []),
    ...filters.accessibility.map((access) => ({ key: `access-${access}`, label: ACCESSIBILITY_OPTIONS.find((option) => option.value === access)?.label ?? access, onRemove: () => setFilters((current) => ({ ...current, accessibility: current.accessibility.filter((item) => item !== access) })) })),
    ...(filters.radiusKm != null ? [{ key: 'radius', label: `≤ ${filters.radiusKm} km`, onRemove: () => setFilters((current) => ({ ...current, radiusKm: null })) }] : []),
    ...(sort !== 'soonest' ? [{ key: 'sort', label: SORT_LABELS[sort], onRemove: () => setSort('soonest') }] : []),
  ];
  const clearFilters = () => { setFilters(DEFAULT_EVENT_FILTERS); setSort('soonest'); };
  const openEvent = (eventId?: string) => { if (eventId) router.push({ pathname: '/events/[id]', params: { id: eventId } }); };
  const featuredState = featured?.id ? actions.attendance[featured.id] : undefined;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Events" onBackPress={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.accent} />}>
        {featured ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => openEvent(featured.id)} style={styles.hero}>
            {featured.image ? <Image source={{ uri: featured.image }} contentFit="cover" style={styles.heroImage} /> : <View style={[styles.heroImage, styles.heroPlaceholder]} />}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)', '#000000']} style={styles.heroImage} />
            <View style={styles.heroBody}>
              <Text style={styles.featuredBadge}>Featured Event</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{featured.title}</Text>
              {featured.description || featured.summary ? <Text style={styles.heroText} numberOfLines={2}>{featured.description || featured.summary}</Text> : null}
              <View style={styles.heroChips}>
                <View style={styles.heroChip}><CalendarDays size={14} color="#e5e7eb" /><Text style={styles.heroChipText}>{formatEventRange(featured.startDate, featured.endDate)}</Text></View>
                <View style={styles.heroChip}><MapPin size={14} color="#e5e7eb" /><Text style={styles.heroChipText} numberOfLines={1}>{featured.location}</Text></View>
                <View style={styles.heroChip}><Users size={14} color="#e5e7eb" /><Text style={styles.heroChipText}>{featuredState?.attendeeCount ?? 0} attending</Text></View>
              </View>
              <View style={styles.heroActions}>
                <TouchableOpacity accessibilityRole="button" disabled={actions.workingEventId === featured.id} onPress={() => actions.requestAttendance(featured)} style={styles.heroAttend}>
                  <Text style={styles.heroAttendText}>{featuredState?.isAttending || featuredState?.waitlistPosition ? 'Cancel Attendance' : 'Attend Event'}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => actions.share(featured)} style={styles.heroShare}>
                  <Share2 size={16} color="#ffffff" /><Text style={styles.heroShareText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.stat}>
          <PartyPopper size={28} color="#ea580c" style={styles.statIcon} />
          <Text style={styles.statValue}>{loading ? '—' : events.length}</Text>
          <Text style={styles.statLabel}>Active Events</Text>
        </View>

        <View style={styles.upcoming}>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              <Text style={styles.sectionSubtitle}>Discover amazing experiences near you</Text>
            </View>
            <TouchableOpacity accessibilityRole="link" onPress={() => router.push('/events/upcoming')} style={styles.viewAll}>
              <Text style={styles.viewAllText}>View All</Text><ChevronRight size={16} color="#000000" />
            </TouchableOpacity>
          </View>
          {loading ? null : upcoming.length === 0 ? <Text style={styles.sectionSubtitle}>No upcoming events yet.</Text> : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingRow}>
              {upcoming.map((event) => (
                <TouchableOpacity key={event.id} activeOpacity={0.85} onPress={() => openEvent(event.id)} style={styles.upcomingCard}>
                  {event.image ? <Image source={{ uri: event.image }} contentFit="cover" style={styles.upcomingImage} /> : <View style={[styles.upcomingImage, styles.heroPlaceholder]}><CalendarDays size={28} color={colors.accent} /></View>}
                  {event.category ? <Text style={styles.upcomingCategory} numberOfLines={1}>{event.category}</Text> : null}
                  <View style={styles.upcomingBody}>
                    <Text style={styles.upcomingTitle} numberOfLines={1}>{event.title}</Text>
                    <View style={styles.meta}><CalendarDays size={13} color={colors.accent} /><Text style={styles.metaText} numberOfLines={1}>{formatEventRange(event.startDate, event.endDate)}</Text></View>
                    <View style={styles.meta}><MapPin size={13} color={colors.accent} /><Text style={styles.metaText} numberOfLines={1}>{event.location}</Text></View>
                    <View style={styles.upcomingFooter}>
                      <Text style={styles.attendingCaps}>{event.id ? actions.attendance[event.id]?.attendeeCount ?? 0 : 0} ATTENDING</Text>
                      <ChevronRight size={15} color={colors.mutedText} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={17} color={colors.mutedText} />
            <TextInput value={filters.search} onChangeText={(search) => setFilters((current) => ({ ...current, search }))} placeholder="Search events" placeholderTextColor={colors.mutedText} returnKeyType="search" style={styles.searchInput} />
            {filters.search ? <TouchableOpacity accessibilityLabel="Clear search" hitSlop={8} onPress={() => setFilters((current) => ({ ...current, search: '' }))}><X size={16} color={colors.mutedText} /></TouchableOpacity> : null}
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Filter events" onPress={() => setFiltersOpen(true)} style={styles.squareButton}>
            <SlidersHorizontal size={19} color={colors.text} />
            {chips.length ? <Text style={styles.countBadge}>{chips.length}</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Create new event" onPress={() => setCreateOpen(true)} style={[styles.squareButton, styles.createButton]}>
            <Plus size={21} color="#000000" />
          </TouchableOpacity>
        </View>

        {chips.length ? (
          <View style={styles.chips}>
            {chips.map((chip) => (
              <TouchableOpacity key={chip.key} accessibilityLabel={`Remove ${chip.label} filter`} onPress={chip.onRemove} style={styles.chip}>
                <Text style={styles.chipText}>{chip.label}</Text><X size={13} color={colors.secondaryText} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={clearFilters}><Text style={styles.clearText}>Clear all</Text></TouchableOpacity>
          </View>
        ) : null}

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {loading ? <EventListCardsSkeleton /> : view === 'calendar' ? (
          <EventsCalendar events={results} onOpenEvent={(eventId) => openEvent(eventId)} />
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <CalendarDays size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>No events found</Text>
            <Text style={styles.sectionSubtitle}>Try adjusting your search or filters.</Text>
            {chips.length || filters.search ? <TouchableOpacity onPress={() => { clearFilters(); setFilters(DEFAULT_EVENT_FILTERS); }} style={styles.clearButton}><Text style={styles.clearButtonText}>Clear all filters</Text></TouchableOpacity> : null}
          </View>
        ) : (
          <>
            {results.slice(0, visibleCount).map((event) => {
              const eventId = event.id ?? '';
              const state = actions.attendance[eventId];
              const canManage = eventService.canManage(event, activeUserId, isStaff);
              return (
                <EventCard
                  key={eventId || event.title}
                  event={event}
                  variant={view === 'list' ? 'list' : 'grid'}
                  attendeeCount={state?.attendeeCount ?? 0}
                  isAttending={Boolean(state?.isAttending)}
                  waitlistPosition={state?.waitlistPosition}
                  isLiked={actions.liked[eventId]}
                  isBookmarked={actions.bookmarked[eventId]}
                  isTargeted={eventId === targetId}
                  isWorking={actions.workingEventId === eventId}
                  canManage={canManage}
                  canEdit={eventService.canEdit(event, activeUserId)}
                  onOpen={() => openEvent(event.id)}
                  onAttend={() => actions.requestAttendance(event)}
                  onLike={() => actions.toggleLike(event)}
                  onBookmark={() => actions.toggleBookmark(event)}
                  onShare={() => actions.share(event)}
                  onReport={() => actions.report(event)}
                  onEdit={() => setEditingEvent(event)}
                  onArchive={() => actions.archive(event)}
                  onCancel={() => actions.cancel(event)}
                />
              );
            })}
            {results.length > visibleCount ? (
              <TouchableOpacity onPress={() => setVisibleCount((count) => count + EVENTS_PER_PAGE)} style={styles.loadMore}>
                <Text style={styles.loadMoreText}>Show more events ({results.length - visibleCount} more)</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>

      <EventFiltersSheet
        visible={filtersOpen}
        filters={filters}
        sort={sort}
        view={view}
        categories={categories}
        tags={tags}
        hasLocation={Boolean(location)}
        isLocating={isLocating}
        onUseLocation={() => void handleUseLocation()}
        onClearLocation={() => setLocation(null)}
        onApply={(nextFilters, nextSort, nextView) => { setFilters(nextFilters); setSort(nextSort); setView(nextView); }}
        onClose={() => setFiltersOpen(false)}
      />
      <CreateEventModal visible={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void load(); }} />
      <CreateEventModal visible={Boolean(editingEvent)} event={editingEvent ?? undefined} onClose={() => setEditingEvent(null)} onCreated={() => { setEditingEvent(null); void load(); }} />
      {actions.dialogs}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 14, paddingBottom: 48, gap: 14 },
  flex: { flex: 1 },
  hero: { height: 380, borderRadius: 20, overflow: 'hidden', backgroundColor: '#111827' },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroPlaceholder: { backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' },
  heroBody: { flex: 1, justifyContent: 'flex-end', padding: 18, gap: 8 },
  featuredBadge: { alignSelf: 'flex-start', backgroundColor: '#01eb53', color: '#000000', fontSize: 12, fontWeight: '700', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 4, overflow: 'hidden' },
  heroTitle: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
  heroText: { color: '#e5e7eb', fontSize: 14, lineHeight: 20 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 4 },
  heroChipText: { color: '#e5e7eb', fontSize: 12, flexShrink: 1 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  heroAttend: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: '#01eb53' },
  heroAttendText: { color: '#000000', fontWeight: '900' },
  heroShare: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)' },
  heroShareText: { color: '#ffffff', fontWeight: '700' },
  stat: { alignSelf: 'flex-start', minWidth: 180, borderRadius: 18, padding: 14, backgroundColor: colors.warningSurface },
  statIcon: { position: 'absolute', right: 12, top: 12, opacity: 0.35 },
  statValue: { color: colors.text, fontSize: 28, fontWeight: '900' },
  statLabel: { color: colors.mutedText, fontSize: 13 },
  upcoming: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { color: '#2FC247', fontSize: 20, fontWeight: '900' },
  sectionSubtitle: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#01eb53', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  viewAllText: { color: '#000000', fontWeight: '900', fontSize: 13 },
  upcomingRow: { gap: 12 },
  upcomingCard: { width: 260, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  upcomingImage: { width: '100%', height: 130 },
  upcomingCategory: { position: 'absolute', top: 10, left: 10, maxWidth: 200, backgroundColor: '#01eb53', color: '#000000', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' },
  upcomingBody: { padding: 12, gap: 6 },
  upcomingTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  upcomingFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  attendingCaps: { color: colors.mutedText, fontSize: 10, fontWeight: '900' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, color: colors.mutedText, fontSize: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 13 },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 10, fontSize: 14 },
  squareButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  createButton: { backgroundColor: '#01eb53', borderColor: '#01eb53' },
  countBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, color: '#ffffff', fontSize: 10, fontWeight: '900', textAlign: 'center', lineHeight: 18, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.successSurface },
  chipText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  clearText: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  clearButton: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.accent },
  clearButtonText: { color: colors.onAccent, fontWeight: '900' },
  loadMore: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  loadMoreText: { color: colors.text, fontWeight: '800' },
});
