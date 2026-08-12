import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import type { Articles, Categories as CategoryItem } from '@/types/global';
// TODO: Comment out Firebase setup for later implementation
// import { useRouter, useSearchParams } from 'next/navigation';
// import { Spinner } from "@nextui-org/react";

type CategoriesProps = {
    categories: CategoryItem[];
    filteredArticles?: Articles[];
    onCategoryChange?: (categories: string[]) => void;
    selectedCategories?: string[];
};

export default function Categories({ 
    categories, 
    filteredArticles, 
    onCategoryChange,
    selectedCategories: initialSelectedCategories = ['All']
}: CategoriesProps) {
    // TODO: Replace with React Native navigation when Firebase is implemented
    // const router = useRouter();
    // const searchParams = useSearchParams();
    
    const [categoriesWithData, setCategoriesWithData] = useState<Set<string>>(new Set());
    const [selectedCategories, setSelectedCategories] = useState<string[]>(initialSelectedCategories);

    useEffect(() => {
        const availableCategories = new Set(filteredArticles?.map(article => article.category) || []);
        setCategoriesWithData(availableCategories);
    }, [filteredArticles]);

    const handleCategoryClick = (category: string) => {
        let newCategories: string[];
        
        if (category === "All") {
            newCategories = ["All"];
        } else {
            // Remove "All" when selecting other categories
            newCategories = selectedCategories
                .filter(cat => cat !== "All")
                .filter(cat => cat !== category);
                
            if (!selectedCategories.includes(category)) {
                newCategories.push(category);
            }
            
            // If no categories selected, default back to "All"
            if (newCategories.length === 0) {
                newCategories = ["All"];
            }
        }
        
        // TODO: Replace with React Native navigation when Firebase is implemented
        // const currentParams = new URLSearchParams(searchParams.toString());
        // const currentSearch = currentParams.get('search');
        
        // // Update URL with current search and new categories
        // if (newCategories.includes("All")) {
        //     if (currentSearch) {
        //         router.push(`?search=${currentSearch}`);
        //     } else {
        //         router.push('/articles');
        //     }
        // } else {
        //     const categoryParam = `categories=${newCategories.join(',')}`;
        //     const searchParam = currentSearch ? `&search=${currentSearch}` : '';
        //     router.push(`?${categoryParam}${searchParam}`);
        // }
        
        setSelectedCategories(newCategories);
        
        // Call parent callback if provided
        if (onCategoryChange) {
            onCategoryChange(newCategories);
        }
    };
    
    return (
        <View style={{
            marginBottom: 32,
            borderRadius: 8,
            backgroundColor: '#ffffff',
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3
        }}>
            {/* Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: '#e5e7eb',
                paddingBottom: 8
            }}>
                <View style={{
                    marginRight: 8,
                    height: 24,
                    width: 24,
                    borderRadius: 12,
                    backgroundColor: '#ef4444',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <Text style={{ color: '#ffffff', fontSize: 12 }}>🏷️</Text>
                </View>
                <Text style={{
                    fontSize: 20,
                    fontWeight: '600',
                    color: '#111827'
                }}>
                    Categories
                </Text>
            </View>

            {/* Categories List */}
            <View style={{ marginTop: 8 }}>
                {categories ? (
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' }}
                    >
                        {categories.map((category) => (
                            <TouchableOpacity
                                key={category.id}
                                onPress={() => handleCategoryClick(category.name)}
                                style={{
                                    marginBottom: 8,
                                    marginRight: 8,
                                    borderRadius: 20,
                                    paddingHorizontal: 12,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: selectedCategories.includes(category.name)
                                        ? categoriesWithData.has(category.name) || category.name === 'All'
                                            ? '#10b981'  // Green for available categories
                                            : '#ef4444'  // Red for unavailable categories
                                        : '#f3f4f6',    // Gray for unselected
                                    borderWidth: selectedCategories.includes(category.name) ? 0 : 1,
                                    borderColor: '#d1d5db'
                                }}
                            >
                                <Text style={{
                                    fontSize: 14,
                                    color: selectedCategories.includes(category.name) 
                                        ? '#ffffff' 
                                        : '#374151',
                                    fontWeight: '500'
                                }}>
                                    {category.name}
                                </Text>
                                
                                {selectedCategories.includes(category.name) && (
                                    <View style={{ marginLeft: 4 }}>
                                        {categoriesWithData.has(category.name) || category.name === 'All' ? (
                                            // Checkmark for available categories
                                            <Text style={{ color: '#ffffff', fontSize: 16 }}>✓</Text>
                                        ) : (
                                            // X mark for unavailable categories
                                            <Text style={{ color: '#ffffff', fontSize: 16 }}>✗</Text>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : (
                    <View style={{
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 20
                    }}>
                        <Text style={{ color: '#6b7280' }}>Loading categories...</Text>
                    </View>
                )}
            </View>
        </View>
    );
}
