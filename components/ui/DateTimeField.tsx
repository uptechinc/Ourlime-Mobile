import { useState } from 'react';
import { Modal, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type DateTimeFieldProps = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  mode: 'date' | 'datetime';
  placeholder: string;
  minimumDate?: Date;
  required?: boolean;
  onClear?: () => void;
};

type AndroidStep = 'date' | 'time' | null;

/** Readable value, e.g. "Sun, Nov 1, 2026 · 6:00 PM" (or just the date for date-only fields). */
export function formatDateTimeFieldValue(date: Date, mode: DateTimeFieldProps['mode']): string {
  const datePart = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (mode === 'date') return datePart;
  return `${datePart} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/**
 * Tap-to-pick date / date-and-time field on the native picker (no typing). Empty fields show the placeholder in the
 * muted colour so it can't be mistaken for a value. Android opens the date dialog, then the time dialog.
 */
export default function DateTimeField({ label, value, onChange, mode, placeholder, minimumDate, required = false, onClear }: DateTimeFieldProps) {
  const { colors, isDark } = useAppTheme();
  const [androidStep, setAndroidStep] = useState<AndroidStep>(null);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(value ?? minimumDate ?? new Date());

  const startingValue = (): Date => value ?? (minimumDate && minimumDate > new Date() ? minimumDate : new Date());

  const handleOpen = (): void => {
    if (Platform.OS === 'ios') {
      setIosDraft(startingValue());
      setIosOpen(true);
      return;
    }
    setPendingDate(startingValue());
    setAndroidStep('date');
  };

  const handleAndroidChange = (event: DateTimePickerEvent, picked?: Date): void => {
    const step = androidStep;
    setAndroidStep(null);
    if (event.type !== 'set' || !picked || !step) return;
    if (step === 'date') {
      const base = pendingDate ?? startingValue();
      const next = new Date(picked);
      next.setHours(base.getHours(), base.getMinutes(), 0, 0);
      if (mode === 'date') {
        onChange(next);
        return;
      }
      setPendingDate(next);
      setAndroidStep('time');
      return;
    }
    const base = pendingDate ?? startingValue();
    const next = new Date(base);
    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    onChange(next);
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>
        {label}{required ? <Text style={{ color: '#ef4444' }}> *</Text> : null}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }}>
        <Pressable
          onPress={handleOpen}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatDateTimeFieldValue(value, mode) : 'not set'}`}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 11 }}
        >
          <CalendarDays size={17} color={colors.accent} />
          <Text style={{ flex: 1, color: value ? colors.text : colors.mutedText, fontWeight: value ? '700' : '500' }}>
            {value ? formatDateTimeFieldValue(value, mode) : placeholder}
          </Text>
        </Pressable>
        {value && onClear ? (
          <TouchableOpacity onPress={onClear} accessibilityLabel={`Clear ${label}`} hitSlop={8} style={{ paddingHorizontal: 12 }}>
            <X size={16} color={colors.mutedText} />
          </TouchableOpacity>
        ) : null}
      </View>

      {androidStep ? (
        <DateTimePicker
          value={pendingDate ?? startingValue()}
          mode={androidStep}
          minimumDate={androidStep === 'date' ? minimumDate : undefined}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable onPress={() => setIosOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(2,6,23,0.55)' }} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}>
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{label}</Text>
              <TouchableOpacity
                onPress={() => { onChange(iosDraft); setIosOpen(false); }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accent }}
              >
                <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={iosDraft}
              mode={mode === 'datetime' ? 'datetime' : 'date'}
              display="inline"
              themeVariant={isDark ? 'dark' : 'light'}
              minimumDate={minimumDate}
              onChange={(_event, picked) => { if (picked) setIosDraft(picked); }}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
