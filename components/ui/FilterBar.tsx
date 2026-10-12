import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SlidersHorizontal, X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { FilterGroup } from '@/components/ui/FilterSheet';

type FilterBarProps = {
  groups: FilterGroup[];
  onOpen: () => void;
  onClear: (groupKey: string) => void;
};

/**
 * One compact row: a "Filters" button with a count, followed by a removable chip
 * for each filter that differs from its default.
 */
export default function FilterBar({ groups, onOpen, onClear }: FilterBarProps) {
  const { colors } = useAppTheme();
  const activeGroups = groups.filter((group) => group.value !== group.defaultValue);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={activeGroups.length ? `Filters, ${activeGroups.length} active` : 'Filters'}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: activeGroups.length ? colors.accent : colors.border, backgroundColor: colors.surface }}
      >
        <SlidersHorizontal size={15} color={activeGroups.length ? colors.accent : colors.icon} />
        <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '800', fontSize: 13 }}>Filters</Text>
        {activeGroups.length ? (
          <View style={{ marginLeft: 6, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
            <Text style={{ color: colors.onAccent, fontSize: 11, fontWeight: '900' }}>{activeGroups.length}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      {activeGroups.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginLeft: 8 }} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
          {activeGroups.map((group) => {
            const label = group.options.find((option) => option.value === group.value)?.label ?? group.value;
            return (
              <TouchableOpacity
                key={group.key}
                onPress={() => onClear(group.key)}
                accessibilityLabel={`Remove ${group.label} filter ${label}`}
                style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 11, paddingRight: 8, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.successSurface }}
              >
                <Text style={{ color: colors.accentText, fontWeight: '800', fontSize: 12 }}>{label}</Text>
                <X size={13} color={colors.accentText} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={{ marginLeft: 10, color: colors.mutedText, fontSize: 12 }}>Showing everything</Text>
      )}
    </View>
  );
}
