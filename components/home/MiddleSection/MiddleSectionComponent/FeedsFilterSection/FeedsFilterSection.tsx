import React, { forwardRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

interface FeedFilterProps {
    activeFilters: string[];
    onFilterChange: (filter: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const feedFilters = [
    { 
        name: 'All', 
        icon: 'grid',
        count: 0
    },
    { 
        name: 'Photos', 
        icon: 'image',
        count: 12
    },
    { 
        name: 'Videos', 
        icon: 'video',
        count: 8
    },
    { 
        name: 'Sound', 
        icon: 'music',
        count: 5
    },
    { 
        name: 'Polls', 
        icon: 'bar-chart-2',
        count: 3
    },
    { 
        name: 'Events', 
        icon: 'calendar',
        count: 7
    },
    { 
        name: 'Trending', 
        icon: 'trending-up',
        count: 15
    },
    { 
        name: 'Favorites', 
        icon: 'star',
        count: 4
    },
    { 
        name: 'Saved', 
        icon: 'bookmark',
        count: 9
    },
];

export const FeedsFilterSection = forwardRef<any, FeedFilterProps>(({ activeFilters, onFilterChange }, ref) => {
    const [scrollX] = useState(new Animated.Value(0));

    const handleFilterPress = (filterName: string) => {
        onFilterChange(filterName);
    };

    const renderFilterButton = (filter: any, index: number) => {
        const isActive = activeFilters.includes(filter.name);
        
        return (
            <TouchableOpacity
                key={filter.name}
                onPress={() => handleFilterPress(filter.name)}
                activeOpacity={0.6}
                style={{
                    marginRight: index === feedFilters.length - 1 ? 0 : 12,
                }}
            >
                <Animated.View
                    style={{
                        transform: [
                            {
                                scale: scrollX.interpolate({
                                    inputRange: [
                                        (index - 1) * 70,
                                        index * 70,
                                        (index + 1) * 70,
                                    ],
                                    outputRange: [0.98, 1.0, 0.98],
                                    extrapolate: 'clamp',
                                }),
                            },
                        ],
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 8,
                            backgroundColor: isActive ? '#10b981' : 'transparent',
                            borderWidth: 1,
                            borderColor: isActive ? '#10b981' : '#e5e7eb',
                        }}
                    >
                        <Icon
                            name={filter.icon as any}
                            size={16}
                            color={isActive ? '#fff' : '#6b7280'}
                            style={{ marginRight: 8 }}
                        />
                        <Text
                            style={{
                                color: isActive ? '#fff' : '#374151',
                                fontSize: 14,
                                fontWeight: isActive ? '600' : '500',
                                letterSpacing: 0.2,
                            }}
                        >
                            {filter.name}
                        </Text>
                        {filter.count > 0 && (
                            <View
                                style={{
                                    marginLeft: 6,
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
                                }}
                            >
                                <Text
                                    style={{
                                        color: isActive ? '#fff' : '#6b7280',
                                        fontSize: 11,
                                        fontWeight: '500',
                                    }}
                                >
                                    {filter.count}
                                </Text>
                            </View>
                        )}
                    </View>
                </Animated.View>
            </TouchableOpacity>
        );
    };

    return (
        <View
            ref={ref}
            style={{
                paddingVertical: 12,
                paddingHorizontal: 20,   
            }}
        >
            {/* Minimal Header */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                }}
            >
                <Text
                    style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: '#111827',
                        letterSpacing: 0.3,
                    }}
                >
                    Filters
                </Text>
                
                {/* Clear Button - Only show when filters are active */}
                {activeFilters.length > 1 || (activeFilters.length === 1 && activeFilters[0] !== 'All') ? (
                    <TouchableOpacity
                        onPress={() => onFilterChange('All')}
                        style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                        }}
                    >
                        <Text
                            style={{
                                color: '#6b7280',
                                fontSize: 13,
                                fontWeight: '500',
                            }}
                        >
                            Clear all
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Filter Buttons */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                    paddingRight: 20,
                }}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                {feedFilters.map((filter, index) => renderFilterButton(filter, index))}
            </ScrollView>

            {/* Minimal Stats - Only show when multiple filters active */}
            {activeFilters.length > 1 && (
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 8,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: '#f3f4f6',
                    }}
                >
                    <View
                        style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: '#10b981',
                            marginRight: 6,
                        }}
                    />
                    <Text
                        style={{
                            color: '#6b7280',
                            fontSize: 12,
                            fontWeight: '400',
                        }}
                    >
                        {activeFilters.length} filters active
                    </Text>
                </View>
            )}
        </View>
    );
});

FeedsFilterSection.displayName = 'FeedsFilterSection';