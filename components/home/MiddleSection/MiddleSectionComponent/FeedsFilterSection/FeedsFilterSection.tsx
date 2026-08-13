import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type FeedFilter = 'All' | 'Photos' | 'Videos' | 'Sound' | 'Polls' | 'Events';
export type FeedSource = 'home' | 'friends' | 'communities';

type FeedsFilterSectionProps = {
  activeFilter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  activeFeedSource?: FeedSource;
  onFeedSourceChange?: (source: FeedSource) => void;
};

type FilterOption = {
  name: FeedFilter;
  icon: 'grid' | 'image' | 'video' | 'music' | 'bar-chart-2' | 'calendar';
};

type FeedSourceOption = {
  label: string;
  value: FeedSource;
  icon: 'home' | 'users' | 'globe';
};

const filterOptions: FilterOption[] = [
  { name: 'All', icon: 'grid' },
  { name: 'Photos', icon: 'image' },
  { name: 'Videos', icon: 'video' },
  { name: 'Sound', icon: 'music' },
  { name: 'Polls', icon: 'bar-chart-2' },
  { name: 'Events', icon: 'calendar' },
];

const feedSourceOptions: FeedSourceOption[] = [
  { label: 'Home', value: 'home', icon: 'home' },
  { label: 'Friends', value: 'friends', icon: 'users' },
  { label: 'Communities', value: 'communities', icon: 'globe' },
];

export function FeedsFilterSection({
  activeFilter,
  onFilterChange,
  activeFeedSource = 'home',
  onFeedSourceChange,
}: FeedsFilterSectionProps) {
  const { colors } = useAppTheme();
  return (
    <View>
      {/* ── Feed Source Toggle ── */}
      {onFeedSourceChange ? <View style={{
        flexDirection: 'row',
        backgroundColor: colors.control,
        borderRadius: 14,
        padding: 3,
        marginBottom: 14,
      }}>
        {feedSourceOptions.map((src) => {
          const isActive = activeFeedSource === src.value;
          return (
            <TouchableOpacity
              key={src.value}
              onPress={() => onFeedSourceChange?.(src.value)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 8,
                borderRadius: 11,
                backgroundColor: isActive ? '#10b981' : 'transparent',
                gap: 5,
              }}
              activeOpacity={0.75}
            >
              <Icon
                name={src.icon}
                size={14}
                color={isActive ? '#ffffff' : colors.icon}
              />
              <Text style={{
                fontSize: 13,
                fontWeight: isActive ? '700' : '500',
                color: isActive ? '#ffffff' : colors.mutedText,
              }}>
                {src.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View> : null}

      {/* ── Content-type Filter Chips ── */}
      <Text style={{ marginBottom: 10, color: colors.text, fontSize: 15, fontWeight: '600' }}>Filters</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {filterOptions.map((filter) => {
          const isActive = activeFilter === filter.name;
          return (
            <TouchableOpacity
              key={filter.name}
              onPress={() => onFilterChange(filter.name)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginRight: 10,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isActive ? '#10b981' : colors.border,
                backgroundColor: isActive ? '#10b981' : colors.surface,
              }}
            >
              <Icon name={filter.icon} size={16} color={isActive ? '#ffffff' : colors.icon} />
              <Text style={{ marginLeft: 7, color: isActive ? '#ffffff' : colors.text, fontWeight: '600' }}>
                {filter.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
