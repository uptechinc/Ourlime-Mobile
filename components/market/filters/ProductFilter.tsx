import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Sizes } from '@/types/productTypes';

interface ProductFilterProps {
    isMobileOpen: boolean;
    onMobileClose: () => void;
    selectedCategories: string[];
    setSelectedCategories: Dispatch<SetStateAction<string[]>>;
    selectedColors: string[];
    setSelectedColors: Dispatch<SetStateAction<string[]>>;
    selectedSizes: string[];
    setSelectedSizes: Dispatch<SetStateAction<string[]>>;
    priceRange: [number, number];
    setPriceRange: (range: [number, number]) => void;
    categories: string[];
    colors: Colors[];
    sizes: Sizes[];
}

export default function ProductFilter({
    isMobileOpen,
    onMobileClose,
    selectedCategories,
    setSelectedCategories,
    selectedColors,
    setSelectedColors,
    selectedSizes,
    setSelectedSizes,
    setPriceRange,
    categories = [],
    colors = [],
    sizes = []
}: ProductFilterProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [newPercentage, setNewPercentage] = useState(0.5);
    const [initialPrice, setInitialPrice] = useState(50000);

    useEffect(() => {
        // Set default to 50% for React Native
        setNewPercentage(0.5);
        setInitialPrice(50000);
    }, []);

    const handleSliderChange = (percentage: number) => {
        const newPrice = Math.round(percentage * 100000);
        setNewPercentage(percentage);
        setPriceRange([0, newPrice]);
    };

    const resetFilters = () => {
        setSelectedCategories([]);
        setSelectedColors([]);
        setSelectedSizes([]);
        setPriceRange([0, 100000]);
        setNewPercentage(0.5);
    };

    const handleCategoryChange = (category: string) => {
        if (category === 'all') {
            setSelectedCategories([]);
        } else {
            const newCategories = selectedCategories.includes(category)
                ? selectedCategories.filter(c => c !== category)
                : [...selectedCategories, category];
            setSelectedCategories(newCategories);
        }
    };

    const handleColorChange = (colorId: string) => {
        const newColors = selectedColors.includes(colorId)
            ? selectedColors.filter(c => c !== colorId)
            : [...selectedColors, colorId];
        setSelectedColors(newColors);
    };

    const handleSizeChange = (sizeId: string) => {
        const newSizes = selectedSizes.includes(sizeId)
            ? selectedSizes.filter(s => s !== sizeId)
            : [...selectedSizes, sizeId];
        setSelectedSizes(newSizes);
    };

    const FilterContent = () => (
        <View style={{ paddingVertical: 24 }}>
            {/* Categories */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 16 }}>
                <Text style={{ fontWeight: '500', marginBottom: 12, fontSize: 16 }}>Categories</Text>
                <View style={{ paddingVertical: 8 }}>
                    <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                        onPress={() => handleCategoryChange('all')}
                    >
                        <View style={{
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: selectedCategories.length === 0 ? '#10b981' : '#d1d5db',
                            backgroundColor: selectedCategories.length === 0 ? '#10b981' : 'transparent',
                            marginRight: 8
                        }} />
                        <Text style={{ fontSize: 14 }}>All Categories</Text>
                    </TouchableOpacity>
                    {categories.map((category) => (
                        <TouchableOpacity 
                            key={category} 
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                            onPress={() => handleCategoryChange(category)}
                        >
                            <View style={{
                                width: 16,
                                height: 16,
                                borderRadius: 8,
                                borderWidth: 2,
                                borderColor: selectedCategories.includes(category) ? '#10b981' : '#d1d5db',
                                backgroundColor: selectedCategories.includes(category) ? '#10b981' : 'transparent',
                                marginRight: 8
                            }} />
                            <Text style={{ fontSize: 14 }}>{category}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Price Range Slider */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 16 }}>
                <Text style={{ fontWeight: '500', marginBottom: 12, fontSize: 16 }}>Price Range</Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 16 }}>
                    <View style={{ position: 'relative', width: '100%' }}>
                        <View style={{
                            position: 'relative',
                            width: '100%',
                            height: 12,
                            backgroundColor: '#e5e7eb',
                            borderRadius: 6
                        }}>
                            <View style={{
                                position: 'absolute',
                                height: '100%',
                                backgroundColor: '#10b981',
                                borderRadius: 6,
                                width: `${newPercentage * 100}%`
                            }} />
                            <TouchableOpacity
                                style={{
                                    position: 'absolute',
                                    left: `${newPercentage * 100}%`,
                                    top: '50%',
                                    transform: [{ translateX: -10 }, { translateY: -10 }],
                                    width: 20,
                                    height: 20,
                                    backgroundColor: '#ffffff',
                                    borderWidth: 2,
                                    borderColor: '#10b981',
                                    borderRadius: 10,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 3.84,
                                    elevation: 5,
                                }}
                                onPressIn={() => setIsDragging(true)}
                                onPressOut={() => setIsDragging(false)}
                            />
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                        <Text style={{ fontSize: 14 }}>${Math.round(newPercentage * 100000).toLocaleString()}</Text>
                        <Text style={{ fontSize: 14 }}>$100,000</Text>
                    </View>
                </View>
            </View>

            {/* Colors */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 16 }}>
                <Text style={{ fontWeight: '500', marginBottom: 12, fontSize: 16 }}>Colors</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {colors.map((color) => (
                        <TouchableOpacity 
                            key={color.id} 
                            style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                paddingVertical: 4,
                                width: '48%'
                            }}
                            onPress={() => handleColorChange(color.id)}
                        >
                            <View style={{
                                width: 16,
                                height: 16,
                                borderRadius: 8,
                                borderWidth: 2,
                                borderColor: selectedColors.includes(color.id) ? '#10b981' : '#d1d5db',
                                backgroundColor: selectedColors.includes(color.id) ? '#10b981' : 'transparent',
                                marginRight: 8
                            }} />
                            <Text style={{ fontSize: 14 }}>{color.colorName}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Sizes */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 16 }}>
                <Text style={{ fontWeight: '500', marginBottom: 12, fontSize: 16 }}>Sizes</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {sizes.map((size) => (
                        <TouchableOpacity
                            key={size.id}
                            style={{
                                minWidth: 120,
                                width: '48%',
                                maxWidth: 200,
                                paddingVertical: 4
                            }}
                            onPress={() => handleSizeChange(size.id)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    borderWidth: 2,
                                    borderColor: selectedSizes.includes(size.id) ? '#10b981' : '#d1d5db',
                                    backgroundColor: selectedSizes.includes(size.id) ? '#10b981' : 'transparent',
                                    marginRight: 8
                                }} />
                                <Text style={{ fontSize: 14, color: '#374151' }} numberOfLines={1}>
                                    {size.sizeName}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </View>
    );

    return (
        <>
            {/* Mobile Filter */}
            <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
                display: isMobileOpen ? 'flex' : 'none'
            }}>
                <TouchableOpacity 
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)'
                    }} 
                    onPress={onMobileClose} 
                />
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 320,
                    backgroundColor: '#ffffff',
                    padding: 24,
                    paddingTop: 32
                }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Filters</Text>
                        <TouchableOpacity
                            onPress={onMobileClose}
                            style={{ padding: 8 }}
                        >
                            <Text style={{ fontSize: 20 }}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        onPress={resetFilters}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            backgroundColor: '#ffffff',
                            borderRadius: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                            elevation: 2,
                            marginBottom: 16,
                            width: '100%'
                        }}
                    >
                        <Text style={{ fontSize: 20, color: '#ef4444', marginRight: 8 }}>✕</Text>
                        <Text style={{ fontSize: 14, color: '#374151' }}>Reset Filters</Text>
                    </TouchableOpacity>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FilterContent />
                    </ScrollView>
                </View>
            </View>

            {/* Desktop Filter - Hidden on mobile */}
            <View style={{ display: 'none' }}>
                <View style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 12,
                    padding: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                    width: 256,
                    flexShrink: 0
                }}>
                    <Text style={{ fontWeight: '600', marginBottom: 24, fontSize: 16 }}>Filters</Text>
                    <TouchableOpacity
                        onPress={resetFilters}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            backgroundColor: '#ffffff',
                            borderRadius: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                            elevation: 2,
                            marginBottom: 16,
                            width: '100%'
                        }}
                    >
                        <Text style={{ fontSize: 20, color: '#ef4444', marginRight: 8 }}>✕</Text>
                        <Text style={{ fontSize: 14, color: '#374151' }}>Reset Filters</Text>
                    </TouchableOpacity>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <FilterContent />
                    </ScrollView>
                </View>
            </View>
        </>
    );
}
