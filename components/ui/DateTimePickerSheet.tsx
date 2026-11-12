import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type DateTimePickerSheetProps = {
  visible: boolean;
  title: string;
  mode: 'date' | 'datetime';
  value: Date | null;
  minimumDate?: Date;
  maximumDate?: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
};

type Meridiem = 'AM' | 'PM';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const isSameDay = (first: Date, second: Date): boolean =>
  first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();

/** Rounds to the next 5 minutes so the draft always matches a minute chip. */
const roundToFiveMinutes = (date: Date): Date => {
  const next = new Date(date);
  const minutes = Math.ceil(next.getMinutes() / 5) * 5;
  next.setMinutes(minutes, 0, 0);
  return next;
};

/**
 * Ourlime's own calendar and time picker, used instead of the platform dialogs so every date field looks the same on
 * Android and iOS: a month grid with the selected day in the brand green, then hour, minute and AM/PM chips.
 */
export default function DateTimePickerSheet({ visible, title, mode, value, minimumDate, maximumDate, onConfirm, onClose }: DateTimePickerSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Mount the sheet only while it is open, so the starting value is read once here (callers often pass a fresh
  // `new Date()` as the minimum on every render).
  const [draft, setDraft] = useState<Date>(() => {
    const now = new Date();
    const fallback = minimumDate && minimumDate > now ? minimumDate : maximumDate && maximumDate < now ? maximumDate : now;
    return mode === 'datetime' ? roundToFiveMinutes(value ?? fallback) : (value ?? fallback);
  });
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => new Date(draft.getFullYear(), draft.getMonth(), 1));

  const minDay = minimumDate ? startOfDay(minimumDate) : null;
  const maxDay = maximumDate ? startOfDay(maximumDate) : null;
  const today = startOfDay(new Date());

  const days = useMemo(() => {
    const firstWeekday = visibleMonth.getDay();
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [visibleMonth]);

  const isDayDisabled = (day: Date): boolean => Boolean((minDay && day < minDay) || (maxDay && day > maxDay));
  const previousMonthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 0);
  const nextMonthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const canGoBack = !minDay || previousMonthEnd >= minDay;
  const canGoForward = !maxDay || nextMonthStart <= maxDay;

  const hour24 = draft.getHours();
  const meridiem: Meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const handleSelectDay = (day: Date): void => {
    const next = new Date(draft);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    setDraft(next);
  };

  const handleSetTime = (nextHour12: number, nextMinute: number, nextMeridiem: Meridiem): void => {
    const next = new Date(draft);
    const base = nextHour12 % 12;
    next.setHours(nextMeridiem === 'PM' ? base + 12 : base, nextMinute, 0, 0);
    setDraft(next);
  };

  const handleMonthStep = (direction: 1 | -1): void => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const isBeforeMinimum = mode === 'datetime' && minimumDate ? draft < minimumDate : false;

  const handleConfirm = (): void => {
    if (isBeforeMinimum) return;
    onConfirm(new Date(draft));
  };

  const chip = (label: string, isSelected: boolean, onPress: () => void, accessibilityLabel: string) => (
    <TouchableOpacity
      key={accessibilityLabel}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={accessibilityLabel}
      style={{ minWidth: 48, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accent : colors.control }}
    >
      <Text style={{ fontWeight: '800', color: isSelected ? colors.onAccent : colors.text }}>{label}</Text>
    </TouchableOpacity>
  );

  const summary = draft.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    + (mode === 'datetime' ? ` · ${draft.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : '');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable onPress={onClose} accessibilityLabel="Close date picker" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.modalScrim }} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Math.max(insets.bottom, 16) + 8, maxHeight: '92%' }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.mutedText, fontSize: 12, fontWeight: '800' }}>{title}</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 }}>{summary}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>
              <X size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 6 }}>
              <TouchableOpacity onPress={() => handleMonthStep(-1)} disabled={!canGoBack} accessibilityRole="button" accessibilityLabel="Previous month" style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, opacity: canGoBack ? 1 : 0.35 }}>
                <ChevronLeft size={18} color={colors.icon} />
              </TouchableOpacity>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>
                {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => handleMonthStep(1)} disabled={!canGoForward} accessibilityRole="button" accessibilityLabel="Next month" style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, opacity: canGoForward ? 1 : 0.35 }}>
                <ChevronRight size={18} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              {WEEKDAYS.map((weekday) => (
                <Text key={weekday} style={{ flex: 1, textAlign: 'center', color: colors.mutedText, fontSize: 12, fontWeight: '800', paddingVertical: 6 }}>{weekday}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {days.map((day, index) => {
                if (!day) return <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
                const isSelected = isSameDay(day, draft);
                const isToday = isSameDay(day, today);
                const isDisabled = isDayDisabled(day);
                return (
                  <View key={day.toISOString()} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}>
                    <TouchableOpacity
                      onPress={() => handleSelectDay(day)}
                      disabled={isDisabled}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                      accessibilityLabel={day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      style={{ flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? colors.accent : 'transparent', borderWidth: isToday && !isSelected ? 1.5 : 0, borderColor: colors.accent }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: isSelected || isToday ? '900' : '600', color: isSelected ? colors.onAccent : isDisabled ? colors.disabledText : isToday ? colors.accentText : colors.text }}>
                        {day.getDate()}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {mode === 'datetime' ? (
              <View style={{ marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Clock3 size={16} color={colors.accent} />
                  <Text style={{ color: colors.text, fontWeight: '900' }}>Time</Text>
                  <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 6 }}>
                    {(['AM', 'PM'] as const).map((option) => chip(option, meridiem === option, () => handleSetTime(hour12, draft.getMinutes(), option), option))}
                  </View>
                </View>
                <Text style={{ color: colors.mutedText, fontSize: 12, fontWeight: '800' }}>Hour</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {HOURS.map((hour) => chip(String(hour), hour12 === hour, () => handleSetTime(hour, draft.getMinutes(), meridiem), `${hour} o'clock`))}
                </ScrollView>
                <Text style={{ color: colors.mutedText, fontSize: 12, fontWeight: '800' }}>Minute</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {MINUTES.map((minute) => chip(`:${String(minute).padStart(2, '0')}`, draft.getMinutes() === minute, () => handleSetTime(hour12, minute, meridiem), `${minute} minutes`))}
                </ScrollView>
              </View>
            ) : null}

            {isBeforeMinimum ? (
              <Text style={{ marginTop: 10, color: colors.destructiveText, fontWeight: '700', fontSize: 13 }}>Pick a time later than now.</Text>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12 }}>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: colors.control }}>
              <Text style={{ color: colors.secondaryText, fontWeight: '900' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} disabled={isBeforeMinimum} accessibilityRole="button" style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: isBeforeMinimum ? colors.disabled : colors.accent }}>
              <Text style={{ color: isBeforeMinimum ? colors.disabledText : colors.onAccent, fontWeight: '900' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
