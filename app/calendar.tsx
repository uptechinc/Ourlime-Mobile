import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PageHeader from '@/components/ui/PageHeader';
import EventsCalendar from '@/components/events/EventsCalendar';
import { EventsCalendarSkeleton } from '@/components/events/EventSkeletons';
import { eventService } from '@/lib/services/EventService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { Event } from '@/types/eventTypes';

/** The website's /calendar: a month of events (Prev / Next), each day opening its events. */
export default function CalendarPage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEvents(await eventService.fetchEvents());
    } catch (loadError: unknown) {
      console.error('[CalendarPage.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Events could not be loaded. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Calendar" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.accent} />}>
        {loading ? <EventsCalendarSkeleton /> : error ? (
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        ) : events.length === 0 ? (
          <View style={styles.empty}>
            <CalendarDays size={40} color={colors.mutedText} />
            <Text style={styles.emptyText}>No events found.</Text>
            <TouchableOpacity onPress={() => router.push('/events')} style={styles.button}><Text style={styles.buttonText}>Explore events</Text></TouchableOpacity>
          </View>
        ) : (
          <EventsCalendar events={events} onOpenEvent={(eventId) => router.push({ pathname: '/events/[id]', params: { id: eventId } })} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 14, paddingBottom: 48 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyText: { color: colors.mutedText, fontSize: 15 },
  button: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.accent },
  buttonText: { color: colors.onAccent, fontWeight: '900' },
});
