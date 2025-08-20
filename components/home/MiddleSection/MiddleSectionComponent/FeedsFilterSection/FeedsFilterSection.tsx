import React, { forwardRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

interface FeedFilterProps {
    activeFilters: string[];
    onFilterChange: (filter: string) => void;
}

const feedFilters = [
    { name: '', icon: 'menu' },
    { name: 'All', icon: 'grid' },
    { name: 'Photos', icon: 'image' },
    { name: 'Videos', icon: 'video' },
    { name: 'Sound', icon: 'music' },
    { name: 'Documents', icon: 'file-text' },
    { name: 'Links', icon: 'link-2' },
    { name: 'Events', icon: 'calendar' },
    { name: 'Polls', icon: 'bar-chart' },
    { name: 'Stories', icon: 'book-open' },
    { name: 'Groups', icon: 'users' },
    { name: 'Blogs', icon: 'file-text' },
    { name: 'News', icon: 'file-text' },
    { name: 'Trending', icon: 'trending-up' },
    { name: 'Favorites', icon: 'star' },
    { name: 'Saved', icon: 'bookmark' },
];

export const FeedsFilterSection = forwardRef<any, FeedFilterProps>(({ activeFilters, onFilterChange }, ref) => {
    return (
        <View
            ref={ref}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#fff',
                paddingBottom: 12,
                paddingHorizontal: 16,
                marginHorizontal: -16,
            }}
        >
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
            >
                {feedFilters.map((filter) => {
                    const isActive = activeFilters.includes(filter.name);
                    return (
                        <TouchableOpacity
                            key={filter.name || 'menu'}
                            onPress={() => filter.name && onFilterChange(filter.name)}
                            activeOpacity={0.8}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 9999,
                                marginRight: 8,
                                backgroundColor: isActive ? '#10b981' : '#f3f4f6',
                                shadowColor: isActive ? '#000' : undefined,
                                shadowOpacity: isActive ? 0.1 : 0,
                                shadowRadius: isActive ? 4 : 0,
                                transform: [{ scale: isActive ? 1.0 : 1.0 }],
                            }}
                        >
                            <Icon
                                name={filter.icon as any}
                                size={16}
                                color={isActive ? '#000' : '#4b5563'}
                                style={{ marginRight: filter.name ? 4 : 0 }}
                            />
                            {filter.name ? (
                                <Text style={{ color: isActive ? '#000' : '#4b5563', fontSize: 13, fontWeight: isActive ? 'bold' : 'normal' }}>
                                    {filter.name}
                                </Text>
                            ) : null}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
});

FeedsFilterSection.displayName = 'FeedsFilterSection';
