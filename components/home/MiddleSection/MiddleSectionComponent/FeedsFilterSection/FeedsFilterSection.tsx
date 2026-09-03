import { useCallback } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type FeedFilter =
  | 'All'
  | 'Photos'
  | 'Videos'
  | 'Sound'
  | 'Documents'
  | 'Links'
  | 'Events'
  | 'Polls'
  | 'Trending'
  | 'Saved';
export type FeedSource = 'home' | 'friends' | 'communities';

type FeedsFilterSectionProps = {
  activeFilter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  activeFeedSource?: FeedSource;
  onFeedSourceChange?: (source: FeedSource) => void;
};

type FilterOption = {
  name: FeedFilter;
  icon: 'grid' | 'image' | 'video' | 'music' | 'file-text' | 'link' | 'calendar' | 'bar-chart-2' | 'trending-up' | 'bookmark';
  comingSoon?: boolean;
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
  { name: 'Sound', icon: 'music', comingSoon: true },
  { name: 'Documents', icon: 'file-text' },
  { name: 'Links', icon: 'link' },
  { name: 'Events', icon: 'calendar' },
  { name: 'Polls', icon: 'bar-chart-2' },
  { name: 'Trending', icon: 'trending-up' },
  { name: 'Saved', icon: 'bookmark' },
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
  const { colors, isDark } = useAppTheme();

  const handleFilterPress = useCallback((filter: FilterOption) => {
    if (filter.comingSoon) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    void Haptics.selectionAsync().catch(() => {});
    onFilterChange(filter.name);
  }, [onFilterChange]);

  return (
    <View>
      {/* ── Feed Source Toggle ── */}
      {onFeedSourceChange ? (
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.control,
            borderRadius: 14,
            padding: 3,
            marginBottom: 14,
          }}
        >
          {feedSourceOptions.map((src) => {
            const isActive = activeFeedSource === src.value;
            return (
              <TouchableOpacity
                key={src.value}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => {});
                  onFeedSourceChange(src.value);
                }}
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
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? '#ffffff' : colors.mutedText,
                  }}
                >
                  {src.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* ── Content-type Filter Chips ── */}
      <Text style={{ marginBottom: 10, color: colors.text, fontSize: 15, fontWeight: '600' }}>
        Filters
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {filterOptions.map((filter) => {
          const isActive = activeFilter === filter.name && !filter.comingSoon;
          const isComingSoon = filter.comingSoon === true;

          return (
            <TouchableOpacity
              key={filter.name}
              onPress={() => handleFilterPress(filter)}
              activeOpacity={isComingSoon ? 0.6 : 0.75}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginRight: 10,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isActive ? '#10b981' : isComingSoon ? (isDark ? '#334155' : '#e2e8f0') : colors.border,
                backgroundColor: isActive
                  ? '#10b981'
                  : isComingSoon
                    ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f1f5f9')
                    : colors.surface,
                opacity: isComingSoon ? 0.75 : 1,
              }}
            >
              <Icon
                name={filter.icon}
                size={16}
                color={isActive ? '#ffffff' : isComingSoon ? (isDark ? '#64748b' : '#94a3b8') : colors.icon}
              />
              <Text
                style={{
                  marginLeft: 7,
                  color: isActive ? '#ffffff' : isComingSoon ? (isDark ? '#94a3b8' : '#64748b') : colors.text,
                  fontWeight: '600',
                }}
              >
                {filter.name}
              </Text>
              {isComingSoon ? (
                <View
                  style={{
                    marginLeft: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      color: isDark ? '#94a3b8' : '#64748b',
                    }}
                  >
                    Soon
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
