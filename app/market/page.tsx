import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, Dimensions } from 'react-native';
import ProductDetailsSidebar from '@/components/market/products/ProductDetailsSidebar';
import PromotionSlider from '@/components/market/promotion/PromotionSlider';
import ProductFilter from '@/components/market/filters/ProductFilter';
import { Product, Colors, Sizes, ColorVariants, SizeVariants, ProductVariant } from '@/types/productTypes';
import { User } from '@/types/global';

interface OwnershipData {
    id: string;
    productId: string;
    userName: string;
    userId: string;
    sellerType: 'business' | 'personal';
    profileImage?: string;
    businessDetails?: any;
    businessOwner?: {
        name: string;
        email: string;
    };
}

export default function MarketPage() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isSidebarProductOpen, setIsSidebarProductOpen] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [colors, setColors] = useState<Colors[]>([]);
    const [sizes, setSizes] = useState<Sizes[]>([]);
    const [colorVariants, setColorVariants] = useState<ColorVariants[]>([]);
    const [sizeVariants, setSizeVariants] = useState<SizeVariants[]>([]);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
    const [ownership, setOwnership] = useState<OwnershipData[]>([]);
    const [marketData, setMarketData] = useState<any>(null);
    const [inputValue, setInputValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [shouldFilter, setShouldFilter] = useState(false);
    const [user, setUser] = useState<User | null>(null);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [selectedSeller, setSelectedSeller] = useState(null);
    const [selectedProductContext, setSelectedProductContext] = useState(null);

    const handleContactSeller = (sellerData: any, productContext: any) => {
        setSelectedSeller(sellerData);
        setSelectedProductContext(productContext);
        setIsChatOpen(true);
    };

    const handleSearch = () => {
            setSearchTerm(inputValue);
            setShouldFilter(true);
    };

    useEffect(() => {
        const loadInitialData = async () => {
            // Set default price range
            const defaultMax = 100000;
                const midPoint = Math.floor(defaultMax / 2);
                setPriceRange([0, midPoint]);

            try {
            const response = await fetch('/api/market/fetch');
            const result = await response.json();

            if (result.status === 'success') {
                const marketData = result.data.data;
                console.log("product data found was: ", marketData);
                setCategories(marketData.categories);
                setColors(marketData.colors);
                setSizes(marketData.sizes);
                setColorVariants(marketData.colorVariants);
                setSizeVariants(marketData.sizeVariants);
                setVariants(marketData.variants);
                setProducts(marketData.products);
                setOwnership(marketData.ownership);
                setMarketData(marketData);
                }
            } catch (error) {
                console.error('Error loading market data:', error);
            }
            setIsLoading(false);
        };

        loadInitialData();
    }, []);

    useEffect(() => {
        if (!shouldFilter) return;

        const handleFilters = async () => {
            try {
            const params = new URLSearchParams();

            if (selectedCategories.length > 0) {
                selectedCategories.forEach(cat => params.append('categories', cat));
            }
            if (selectedColors.length > 0) {
                selectedColors.forEach(color => params.append('colors', color));
            }
            if (selectedSizes.length > 0) {
                selectedSizes.forEach(size => params.append('sizes', size));
            }

            params.set('minPrice', priceRange[0].toString());
            params.set('maxPrice', priceRange[1].toString());
            if (searchTerm) params.set('q', searchTerm);

            const endpoint = params.toString()
                ? `/api/market/search_and_filter?${params.toString()}`
                : '/api/market/fetch';

            const response = await fetch(endpoint);
            const result = await response.json();

            if (result.status === 'success') {
                const filteredData = result.data.data;
                setProducts(filteredData.products);
                setMarketData(filteredData);
                }
            } catch (error) {
                console.error('Error applying filters:', error);
            }
        };

        handleFilters();
        setShouldFilter(false);
    }, [shouldFilter, selectedCategories, selectedColors, selectedSizes, priceRange, searchTerm]);

    const getProductPriceDisplay = (productId: string) => {
        const productVariants = (variants || []).filter(v => v.productId === productId);
        
        if (!productVariants || productVariants.length === 0) {
            return 'Price unavailable';
        }
        
        const prices = productVariants.map(v => v.price);
        if (prices.length === 0) {
            return 'Price unavailable';
        }
        
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        return minPrice === maxPrice ? `$${minPrice.toFixed(2)}` : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
    };

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Loading...</Text>
            </View>
        );
    }

    const screenWidth = Dimensions.get('window').width;
    const isGrid = viewMode === 'grid';
    const numColumns = isGrid ? 2 : 1;

    return (
        <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
            <ScrollView style={{ flex: 1, paddingTop: 16 }}>
                <View style={{ paddingHorizontal: 8 }}>
                    <PromotionSlider />

                    <View style={{ flexDirection: 'column', gap: 24, marginTop: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => setIsSidebarOpen(true)}
                                style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    gap: 8, 
                                    padding: 12, 
                                    backgroundColor: '#ffffff', 
                                    borderRadius: 8, 
                                    marginBottom: 16,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 2,
                                    elevation: 2
                                }}
                            >
                                <Text style={{ fontSize: 16 }}>🔍</Text>
                                <Text>Filters</Text>
                            </TouchableOpacity>
                        </View>

                        <ProductFilter
                            isMobileOpen={isSidebarOpen}
                            onMobileClose={() => setIsSidebarOpen(false)}
                            selectedCategories={selectedCategories}
                            setSelectedCategories={(cats) => {
                                setSelectedCategories(cats);
                                setShouldFilter(true);
                            }}
                            selectedColors={selectedColors}
                            setSelectedColors={(colors) => {
                                setSelectedColors(colors);
                                setShouldFilter(true);
                            }}
                            selectedSizes={selectedSizes}
                            setSelectedSizes={(sizes) => {
                                setSelectedSizes(sizes);
                                setShouldFilter(true);
                            }}
                            priceRange={priceRange}
                            setPriceRange={(newRange) => {
                                setPriceRange(newRange);
                                setShouldFilter(true);
                            }}
                            categories={categories}
                            colors={colors}
                            sizes={sizes}
                        />

                        <View style={{ flex: 1, marginBottom: 40 }}>
                            <View style={{ 
                                backgroundColor: '#ffffff', 
                                borderRadius: 12, 
                                padding: 16, 
                                marginBottom: 24,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.1,
                                shadowRadius: 2,
                                elevation: 2
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                    <View style={{ flex: 1, position: 'relative' }}>
                                        <TextInput
                                            placeholder="Search products..."
                                            value={inputValue}
                                            onChangeText={setInputValue}
                                            onSubmitEditing={handleSearch}
                                            style={{
                                                width: '100%',
                                                paddingLeft: 40,
                                                paddingRight: 16,
                                                paddingVertical: 8,
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: '#d1d5db',
                                                fontSize: 16
                                            }}
                                        />
                                        <Text style={{ 
                                            position: 'absolute', 
                                            left: 12, 
                                            top: '50%', 
                                            marginTop: -8, 
                                            fontSize: 16, 
                                            color: '#9ca3af' 
                                        }}>
                                            🔍
                                        </Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => setViewMode('grid')}
                                            style={{
                                                padding: 10,
                                                borderRadius: 8,
                                                backgroundColor: viewMode === 'grid' ? '#10b981' : '#f3f4f6'
                                            }}
                                        >
                                            <Text style={{ 
                                                fontSize: 16, 
                                                color: viewMode === 'grid' ? '#ffffff' : '#6b7280' 
                                            }}>
                                                ⬜
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setViewMode('list')}
                                            style={{
                                                padding: 10,
                                                borderRadius: 8,
                                                backgroundColor: viewMode === 'list' ? '#10b981' : '#f3f4f6'
                                            }}
                                        >
                                            <Text style={{ 
                                                fontSize: 16, 
                                                color: viewMode === 'list' ? '#ffffff' : '#6b7280' 
                                            }}>
                                                ⬛
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            <View style={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                gap: isGrid ? 12 : 16,
                                justifyContent: isGrid ? 'space-between' : 'flex-start'
                            }}>
                                    {(products || []).map((product) => (
                                    <View
                                            key={product.id}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            borderRadius: 12,
                                            overflow: 'hidden',
                                            width: isGrid ? (screenWidth - 48) / 2 : '100%',
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 3.84,
                                            elevation: 5,
                                            marginBottom: 16
                                        }}
                                    >
                                            {/* Image Section */}
                                        <View style={{
                                            position: 'relative',
                                            width: '100%',
                                            height: isGrid ? 192 : 192
                                        }}>
                                                <Image
                                                source={{ uri: product.thumbnailImage }}
                                                style={{ width: '100%', height: '100%' }}
                                                resizeMode="cover"
                                                />
                                                {/* Company Logo */}
                                                {ownership?.find(o => o.productId === product.id)?.sellerType === 'business' && (
                                                <View style={{
                                                    position: 'absolute',
                                                    bottom: 8,
                                                    left: 8,
                                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                    padding: 6,
                                                    borderRadius: 8,
                                                    shadowColor: '#000',
                                                    shadowOffset: { width: 0, height: 2 },
                                                    shadowOpacity: 0.25,
                                                    shadowRadius: 3.84,
                                                    elevation: 5
                                                }}>
                                                        <Image
                                                        source={{ uri: ownership?.find(o => o.productId === product.id)?.profileImage || "https://via.placeholder.com/28" }}
                                                        style={{ width: 28, height: 28, borderRadius: 4 }}
                                                        resizeMode="contain"
                                                    />
                                                </View>
                                            )}
                                        </View>

                                            {/* Content Section */}
                                        <View style={{
                                            padding: 16,
                                            flexDirection: 'column',
                                            flex: 1
                                        }}>
                                            <View style={{ gap: 8 }}>
                                                    {/* Title */}
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Text style={{ 
                                                        fontWeight: '600', 
                                                        fontSize: 14, 
                                                        color: '#111827',
                                                        flex: 1,
                                                        marginRight: 8
                                                    }} numberOfLines={1}>
                                                            {product.title}
                                                    </Text>
                                                    <View style={{ 
                                                        paddingHorizontal: 8, 
                                                        paddingVertical: 2, 
                                                        backgroundColor: '#ecfdf5', 
                                                        borderRadius: 50 
                                                    }}>
                                                        <Text style={{ 
                                                            color: '#10b981', 
                                                            fontSize: 12, 
                                                            fontWeight: '500' 
                                                        }}>
                                                            {product.category}
                                                        </Text>
                                                    </View>
                                                </View>

                                                    {/* Description */}
                                                <Text style={{ 
                                                    color: '#6b7280', 
                                                    fontSize: 12,
                                                    lineHeight: 16
                                                }} numberOfLines={2}>
                                                        {product.shortDescription.length > 60
                                                            ? `${product.shortDescription.substring(0, 60)}...`
                                                            : product.shortDescription
                                                        }
                                                </Text>

                                                    {/* Variants */}
                                                <View style={{ gap: 8, height: 40 }}>
                                                        {(colorVariants || []).filter(cv => 
                                                                cv.productId === product.id && 
                                                                (variants || []).some(v => 
                                                                    v.productId === product.id && 
                                                                    v.colorVariantId === cv.id && 
                                                                    v.quantity > 0
                                                                )
                                                            ).length > 0 && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>Colors:</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                        {(colorVariants || [])
                                                                            .filter(cv => 
                                                                                cv.productId === product.id && 
                                                                                (variants || []).some(v => 
                                                                                    v.productId === product.id && 
                                                                                    v.colorVariantId === cv.id && 
                                                                                    v.quantity > 0
                                                                                )
                                                                            )
                                                                            .map((variant) => (
                                                                        <View
                                                                                    key={variant.id}
                                                                                    style={{
                                                                                width: 20,
                                                                                height: 20,
                                                                                borderRadius: 10,
                                                                                borderWidth: 1,
                                                                                borderColor: '#d1d5db',
                                                                                backgroundColor: variant.colorVariantName
                                                                            }}
                                                                        />
                                                                    ))
                                                                }
                                                            </View>
                                                        </View>
                                                            )}
                                                        {/* Size Variants */}
                                                        {(sizeVariants || []).filter(sv => sv.productId === product.id).length > 0 && (
                                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>Sizes:</Text>
                                                                {(sizeVariants || [])
                                                                    .filter(sv => sv.productId === product.id)
                                                                    .map((variant) => (
                                                                    <View
                                                                            key={variant.id}
                                                                        style={{
                                                                            paddingHorizontal: 8,
                                                                            paddingVertical: 2,
                                                                            backgroundColor: '#f3f4f6',
                                                                            borderRadius: 50
                                                                        }}
                                                                    >
                                                                        <Text style={{ fontSize: 12, color: '#374151' }}>
                                                                            {variant.sizeVariantName}
                                                                        </Text>
                                                                    </View>
                                                                    ))}
                                                        </View>
                                                        )}
                                                </View>
                                            </View>

                                                {/* Sold By section */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                                                <Text style={{ fontSize: 12, color: '#6b7280' }}>Sold by:</Text>
                                                <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151' }}>
                                                        {ownership?.find(o => o.productId === product.id)?.businessDetails?.name ||
                                                         ownership?.find(o => o.productId === product.id)?.userName || 
                                                         'Unknown Seller'}
                                                </Text>
                                            </View>

                                                {/* Price and Action */}
                                            <View style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginTop: 8
                                            }}>
                                                <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}>
                                                        Price: {getProductPriceDisplay(product.id)}
                                                </Text>
                                            </View>

                                            <TouchableOpacity
                                                onPress={() => {
                                                            setSelectedProduct(product);
                                                            setIsSidebarProductOpen(true);
                                                        }}
                                                style={{
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 6,
                                                    backgroundColor: '#10b981',
                                                    borderRadius: 8,
                                                    marginTop: 12,
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <Text style={{
                                                    color: '#000000',
                                                    fontSize: 12,
                                                    fontWeight: '500'
                                                }}>
                                                        View Details
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {selectedProduct && (
                <ProductDetailsSidebar
                    isOpen={isSidebarProductOpen}
                    onClose={() => {
                        setIsSidebarProductOpen(false);
                        setSelectedProduct(null);
                    }}
                    product={selectedProduct}
                    marketData={marketData}
                    onContactSeller={handleContactSeller}
                />
            )}
        </View>
    );
}

