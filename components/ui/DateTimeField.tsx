import { useState } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import { CalendarDays, X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import DateTimePickerSheet from '@/components/ui/DateTimePickerSheet';

type DateTimeFieldProps = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  mode: 'date' | 'datetime';
  placeholder: string;
  minimumDate?: Date;
  maximumDate?: Date;
  required?: boolean;
  onClear?: () => void;
};

/** Readable value, e.g. "Sun, Nov 1, 2026 · 6:00 PM" (or just the date for date-only fields). */
export function formatDateTimeFieldValue(date: Date, mode: DateTimeFieldProps['mode']): string {
  const datePart = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (mode === 'date') return datePart;
  return `${datePart} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/**
 * Tap-to-pick date / date-and-time field (no typing). It opens Ourlime's own calendar sheet on both platforms. Empty
 * fields show the placeholder in the muted colour so it can't be mistaken for a value.
 */
export default function DateTimeField({ label, value, onChange, mode, placeholder, minimumDate, maximumDate, required = false, onClear }: DateTimeFieldProps) {
  const { colors } = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = (date: Date): void => {
    setIsOpen(false);
    onChange(date);
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>
        {label}{required ? <Text style={{ color: '#ef4444' }}> *</Text> : null}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }}>
        <Pressable
          onPress={() => setIsOpen(true)}
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

      {isOpen ? (
        <DateTimePickerSheet
          visible
          title={label}
          mode={mode}
          value={value}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onConfirm={handleConfirm}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </View>
  );
}
