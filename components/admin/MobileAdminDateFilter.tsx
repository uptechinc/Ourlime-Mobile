import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type MobileDateRangeValue = {
  preset: string;
  startDate: Date | null;
  endDate: Date | null;
  label: string;
};

type MobileAdminDateFilterProps = {
  value: MobileDateRangeValue;
  onChange: (range: MobileDateRangeValue) => void;
};

const PRESETS: { id: string; label: string }[] = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: '24h', label: '24 Hours' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'this_month', label: 'This Month' },
];

export default function MobileAdminDateFilter({
  value,
  onChange,
}: MobileAdminDateFilterProps) {
  const { colors } = useAppTheme();

  const handleSelectPreset = (presetId: string) => {
    const now = new Date();
    if (presetId === 'all') {
      onChange({ preset: 'all', startDate: null, endDate: null, label: 'All Time' });
      return;
    }
    if (presetId === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      onChange({ preset: 'today', startDate: start, endDate: end, label: 'Today' });
      return;
    }
    if (presetId === '24h') {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      onChange({ preset: '24h', startDate: start, endDate: now, label: 'Last 24h' });
      return;
    }
    if (presetId === '7d') {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      onChange({ preset: '7d', startDate: start, endDate: now, label: 'Last 7d' });
      return;
    }
    if (presetId === '30d') {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      onChange({ preset: '30d', startDate: start, endDate: now, label: 'Last 30d' });
      return;
    }
    if (presetId === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      onChange({ preset: 'this_month', startDate: start, endDate: now, label: 'This Month' });
      return;
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="calendar" size={13} color={colors.mutedText} />
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mutedText, textTransform: 'uppercase' }}>
          Date Range: {value.label}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {PRESETS.map((p) => {
          const active = value.preset === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => handleSelectPreset(p.id)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 14,
                backgroundColor: active ? colors.accent : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: active ? '700' : '500',
                  color: active ? '#ffffff' : colors.text,
                }}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
