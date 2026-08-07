import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

export type FeedFilter = 'All' | 'Photos' | 'Videos' | 'Sound' | 'Polls' | 'Events';

type FeedsFilterSectionProps = {
  activeFilter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
};

type FilterOption = {
  name: FeedFilter;
  icon: 'grid' | 'image' | 'video' | 'music' | 'bar-chart-2' | 'calendar';
};

const filterOptions: FilterOption[] = [
  { name: 'All', icon: 'grid' },
  { name: 'Photos', icon: 'image' },
  { name: 'Videos', icon: 'video' },
  { name: 'Sound', icon: 'music' },
  { name: 'Polls', icon: 'bar-chart-2' },
  { name: 'Events', icon: 'calendar' },
];

export function FeedsFilterSection({ activeFilter, onFilterChange }: FeedsFilterSectionProps) {
  return (
    <View>
      <Text style={{ marginBottom: 10, color: '#111827', fontSize: 15, fontWeight: '600' }}>Filters</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {filterOptions.map((filter) => {
          const isActive = activeFilter === filter.name;
          return (
            <TouchableOpacity key={filter.name} onPress={() => onFilterChange(filter.name)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, borderWidth: 1, borderColor: isActive ? '#10b981' : '#e5e7eb', backgroundColor: isActive ? '#10b981' : '#ffffff' }}>
              <Icon name={filter.icon} size={16} color={isActive ? '#ffffff' : '#6b7280'} />
              <Text style={{ marginLeft: 7, color: isActive ? '#ffffff' : '#374151', fontWeight: '600' }}>{filter.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
