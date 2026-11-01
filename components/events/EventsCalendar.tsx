import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { Event } from '@/types/eventTypes';

type EventsCalendarProps = {
  events: Event[];
  onOpenEvent: (eventId: string) => void;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const sameDay = (left: Date, right: Date): boolean => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

/** An event runs on a day when it starts before the day ends and ends after the day starts (multi-day events span). */
const isEventOnDay = (event: Event, day: Date): boolean => {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate || event.startDate);
  if (Number.isNaN(start.getTime())) return false;
  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 23, 59, 59, 999);
  return start <= dayEnd && (Number.isNaN(end.getTime()) ? start : end) >= dayStart;
};

/** Month view of events, the app's version of the website's /calendar: dots on days with events, tap a day for its list. */
export default function EventsCalendar({ events, onOpenEvent }: EventsCalendarProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    // Six weeks always, so the grid keeps its height from month to month.
    return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
  }, [month]);

  const eventsByDay = useMemo(() => new Map(days.map((day) => [day.toDateString(), events.filter((event) => isEventOnDay(event, day))])), [days, events]);
  const selectedEvents = eventsByDay.get(selectedDay.toDateString()) ?? events.filter((event) => isEventOnDay(event, selectedDay));

  const handleChangeMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDay(next.getMonth() === today.getMonth() && next.getFullYear() === today.getFullYear() ? today : next);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} onPress={() => handleChangeMonth(-1)} style={styles.navButton}>
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.monthTitle}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} onPress={() => handleChangeMonth(1)} style={styles.navButton}>
            <ChevronRight size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((weekday) => <Text key={weekday} style={styles.weekday}>{weekday}</Text>)}
        </View>
        <View style={styles.grid}>
          {days.map((day) => {
            const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
            const isOtherMonth = day.getMonth() !== month.getMonth();
            const isSelected = sameDay(day, selectedDay);
            const isToday = sameDay(day, today);
            return (
              <Pressable
                key={day.toISOString()}
                accessibilityRole="button"
                accessibilityLabel={`${day.toDateString()}, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedDay(day)}
                style={styles.cell}
              >
                <View style={[styles.dayBubble, isToday && styles.todayBubble, isSelected && styles.selectedBubble]}>
                  <Text style={[styles.dayText, isOtherMonth && styles.otherMonthText, isToday && styles.todayText, isSelected && styles.selectedText]}>{day.getDate()}</Text>
                </View>
                <View style={styles.dots}>
                  {dayEvents.slice(0, 3).map((event) => <View key={event.id ?? event.title} style={[styles.dot, isOtherMonth && styles.dotMuted]} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.dayHeading}>{selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      {selectedEvents.length === 0 ? (
        <View style={styles.empty}>
          <CalendarDays size={28} color={colors.mutedText} />
          <Text style={styles.muted}>No events on this day.</Text>
        </View>
      ) : selectedEvents.map((event) => (
        <Pressable
          key={event.id ?? event.title}
          accessibilityRole="button"
          disabled={!event.id}
          onPress={() => event.id && onOpenEvent(event.id)}
          style={styles.eventRow}
        >
          <View style={styles.eventTime}>
            <Text style={styles.eventTimeText}>{new Date(event.startDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
          </View>
          <View style={styles.eventBody}>
            <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
            <View style={styles.inline}>
              <MapPin size={13} color={colors.mutedText} />
              <Text style={styles.muted} numberOfLines={1}>{event.location || 'Online'}</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.mutedText} />
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 12 },
  card: { padding: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  monthTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: colors.mutedText, fontSize: 11, fontWeight: '800', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4, minHeight: 50 },
  dayBubble: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  todayBubble: { borderWidth: 1.5, borderColor: '#10b981' },
  selectedBubble: { backgroundColor: '#10b981', borderColor: '#10b981' },
  dayText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  otherMonthText: { color: colors.mutedText, opacity: 0.6 },
  todayText: { color: '#10b981' },
  selectedText: { color: '#ffffff' },
  dots: { flexDirection: 'row', gap: 3, height: 8, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#10b981' },
  dotMuted: { opacity: 0.4 },
  dayHeading: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 4 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  muted: { flexShrink: 1, color: colors.mutedText, fontSize: 12 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  eventTime: { minWidth: 64, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.successSurface, alignItems: 'center' },
  eventTimeText: { color: colors.successText, fontSize: 12, fontWeight: '800' },
  eventBody: { flex: 1, gap: 4 },
  eventTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
