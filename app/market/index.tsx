import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, Dimensions, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Heart, Search, LayoutGrid, List } from 'lucide-react-native';
import ProductDetailsSidebar, { type MarketOwnership } from '@/components/market/products/ProductDetailsSidebar';
import ProductFilter from '@/components/market/filters/ProductFilter';
import { Product, Colors, Sizes, ColorVariants, SizeVariants, ProductVariant } from '@/types/productTypes';
import PageHeader from '@/components/ui/PageHeader';
import {useRouter} from 'expo-router';

type OwnershipData = MarketOwnership;

type TabType = 'Featured' | 'New' | 'Deals';

type CategoryCard = {
    id: string;
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    itemCount: number;
    color: string;
}

// Add this dummy data section before the component
const generateDummyMarketData = () => {
    // Dummy Categories
    const dummyCategories: string[] = [
        'Electronics',
        'Fashion',
        'Home & Garden',
        'Sports & Fitness',
        'Books',
        'Toys & Games',
        'Beauty',
        'Automotive',
    ];

    // Dummy Colors
    const dummyColors: Colors[] = [
        { id: 'color1', colorName: 'Red' },
        { id: 'color2', colorName: 'Blue' },
        { id: 'color3', colorName: 'Green' },
        { id: 'color4', colorName: 'Black' },
        { id: 'color5', colorName: 'White' },
        { id: 'color6', colorName: 'Yellow' },
        { id: 'color7', colorName: 'Purple' },
        { id: 'color8', colorName: 'Orange' },
    ];

    // Dummy Sizes
    const dummySizes: Sizes[] = [
        { id: 'size1', sizeName: 'XS' },
        { id: 'size2', sizeName: 'S' },
        { id: 'size3', sizeName: 'M' },
        { id: 'size4', sizeName: 'L' },
        { id: 'size5', sizeName: 'XL' },
        { id: 'size6', sizeName: 'XXL' },
        { id: 'size7', sizeName: 'One Size' },
    ];

    // Dummy Products
    const dummyProducts: Product[] = [
        {
            id: 'prod1',
            title: 'Wireless Bluetooth Headphones',
            shortDescription: 'Premium noise-cancelling wireless headphones with 30-hour battery life',
            longDescription: 'Experience superior sound quality with our premium wireless Bluetooth headphones. Features active noise cancellation, 30-hour battery life, quick charge, and crystal-clear call quality.',
            thumbnailImage: 'https://picsum.photos/400/400?random=1',
            category: 'Electronics',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '1.2k',
        },
        {
            id: 'prod2',
            title: 'Classic Denim Jacket',
            shortDescription: 'Stylish denim jacket perfect for any casual occasion',
            longDescription: 'A timeless classic that never goes out of style. Made from premium denim, this jacket features a comfortable fit and versatile design.',
            thumbnailImage: 'https://picsum.photos/400/400?random=2',
            category: 'Fashion',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '856',
        },
        {
            id: 'prod3',
            title: 'Indoor Plant Set',
            shortDescription: 'Beautiful collection of 5 low-maintenance indoor plants',
            longDescription: 'Transform your living space with this curated set of 5 beautiful indoor plants. Each plant is easy to care for and comes with care instructions.',
            thumbnailImage: 'https://picsum.photos/400/400?random=3',
            category: 'Home & Garden',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '2.3k',
        },
        {
            id: 'prod4',
            title: 'Yoga Mat Pro',
            shortDescription: 'Premium non-slip yoga mat with carrying strap',
            longDescription: 'Practice yoga comfortably with this premium non-slip mat. Features extra cushioning, eco-friendly materials, and includes a carrying strap.',
            thumbnailImage: 'https://picsum.photos/400/400?random=4',
            category: 'Sports & Fitness',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '1.5k',
        },
        {
            id: 'prod5',
            title: 'Smartphone Case - Clear',
            shortDescription: 'Protective clear case compatible with all models',
            longDescription: 'Keep your phone safe with this crystal-clear protective case. Features raised edges for screen protection and wireless charging compatible.',
            thumbnailImage: 'https://picsum.photos/400/400?random=5',
            category: 'Electronics',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '3.1k',
        },
        {
            id: 'prod6',
            title: 'Summer Dress Collection',
            shortDescription: 'Elegant summer dresses in various colors',
            longDescription: 'Stay cool and stylish this summer with our collection of elegant dresses. Available in multiple colors and sizes.',
            thumbnailImage: 'https://picsum.photos/400/400?random=6',
            category: 'Fashion',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '2.8k',
        },
        {
            id: 'prod7',
            title: 'Garden Tools Set',
            shortDescription: 'Complete set of premium gardening tools',
            longDescription: 'Everything you need for your garden. This set includes shovel, rake, pruning shears, and more. Made from durable stainless steel.',
            thumbnailImage: 'https://picsum.photos/400/400?random=7',
            category: 'Home & Garden',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '945',
        },
        {
            id: 'prod8',
            title: 'Dumbbell Set 20kg',
            shortDescription: 'Adjustable dumbbell set for home workouts',
            longDescription: 'Build muscle at home with this adjustable dumbbell set. Includes 20kg total weight, adjustable from 2kg to 10kg per dumbbell.',
            thumbnailImage: 'https://picsum.photos/400/400?random=8',
            category: 'Sports & Fitness',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '1.7k',
        },
        {
            id: 'prod9',
            title: 'Wireless Mouse',
            shortDescription: 'Ergonomic wireless mouse with long battery life',
            longDescription: 'Comfortable and precise wireless mouse perfect for work or gaming. Features ergonomic design and 12-month battery life.',
            thumbnailImage: 'https://picsum.photos/400/400?random=9',
            category: 'Electronics',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '1.9k',
        },
        {
            id: 'prod10',
            title: 'Leather Watch',
            shortDescription: 'Classic leather strap watch with elegant design',
            longDescription: 'Timeless elegance meets modern functionality. This classic leather watch features a genuine leather strap and premium movement.',
            thumbnailImage: 'https://picsum.photos/400/400?random=10',
            category: 'Fashion',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '1.4k',
        },
        {
            id: 'prod11',
            title: 'Essential Oil Diffuser',
            shortDescription: 'Ultrasonic aromatherapy diffuser with LED lights',
            longDescription: 'Create a relaxing atmosphere with this ultrasonic essential oil diffuser. Features 7 color LED lights and automatic shut-off.',
            thumbnailImage: 'https://picsum.photos/400/400?random=11',
            category: 'Home & Garden',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '1.1k',
        },
        {
            id: 'prod12',
            title: 'Running Shoes',
            shortDescription: 'Lightweight running shoes with cushioned sole',
            longDescription: 'Perfect for daily runs and workouts. Features breathable mesh upper, cushioned midsole, and durable outsole for maximum comfort.',
            thumbnailImage: 'https://picsum.photos/400/400?random=12',
            category: 'Sports & Fitness',
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            views: '2.5k',
        },
    ];

    // Generate Color Variants
    const dummyColorVariants: ColorVariants[] = [];
    dummyProducts.forEach((product, index) => {
        const productColors = dummyColors.slice(0, Math.floor(Math.random() * 4) + 2);
        productColors.forEach((color, colorIndex) => {
            dummyColorVariants.push({
                id: `cv_${product.id}_${color.id}`,
                colorVariantName: color.colorName,
                colorId: color.id,
                productId: product.id,
            });
        });
    });

    // Generate Size Variants
    const dummySizeVariants: SizeVariants[] = [];
    dummyProducts.forEach((product) => {
        if (['Fashion', 'Sports & Fitness'].includes(product.category)) {
            const productSizes = dummySizes.slice(0, Math.floor(Math.random() * 4) + 3);
            productSizes.forEach((size) => {
                dummySizeVariants.push({
                    id: `sv_${product.id}_${size.id}`,
                    sizeVariantName: size.sizeName,
                    sizeId: size.id,
                    productId: product.id,
                });
            });
        } else {
            // One size for non-clothing items
            dummySizeVariants.push({
                id: `sv_${product.id}_one`,
                sizeVariantName: 'One Size',
                sizeId: 'size7',
                productId: product.id,
            });
        }
    });

    // Generate Product Variants
    const dummyVariants: ProductVariant[] = [];
    dummyProducts.forEach((product) => {
        const colorVariantsForProduct = dummyColorVariants.filter(cv => cv.productId === product.id);
        const sizeVariantsForProduct = dummySizeVariants.filter(sv => sv.productId === product.id);

        colorVariantsForProduct.forEach((colorVariant) => {
            sizeVariantsForProduct.forEach((sizeVariant) => {
                const basePrice = Math.floor(Math.random() * 200) + 20;
                dummyVariants.push({
                    id: `variant_${product.id}_${colorVariant.id}_${sizeVariant.id}`,
                    productId: product.id,
                    colorVariantId: colorVariant.id,
                    sizeVariantId: sizeVariant.id,
                    price: basePrice,
                    quantity: Math.floor(Math.random() * 50) + 5,
                    status: 'active',
                });
            });
        });
    });

    // Generate Ownership Data
    const dummyOwnership: OwnershipData[] = dummyProducts.map((product, index) => {
        const isBusiness = index % 2 === 0;
        return {
            id: `own_${product.id}`,
            productId: product.id,
            userName: isBusiness ? `Business${index + 1}` : `User${index + 1}`,
            userId: `user_${index + 1}`,
            sellerType: isBusiness ? 'business' : 'personal',
            profileImage: `https://picsum.photos/100/100?random=${index + 100}`,
            businessDetails: isBusiness ? {
                name: `Business ${index + 1}`,
                description: 'Quality products at great prices',
                rating: 4.5,
            } : undefined,
            businessOwner: isBusiness ? {
                name: `Owner ${index + 1}`,
                email: `owner${index + 1}@example.com`,
            } : undefined,
        };
    });

    return {
        categories: dummyCategories,
        colors: dummyColors,
        sizes: dummySizes,
        colorVariants: dummyColorVariants,
        sizeVariants: dummySizeVariants,
        variants: dummyVariants,
        products: dummyProducts,
        ownership: dummyOwnership,
    };
};

export default function MarketPage() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isSidebarProductOpen, setIsSidebarProductOpen] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [colors, setColors] = useState<Colors[]>([]);
    const [sizes, setSizes] = useState<Sizes[]>([]);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
    const [marketData, setMarketData] = useState<ReturnType<typeof generateDummyMarketData> | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [shouldFilter, setShouldFilter] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('Featured');
    const [favorites, setFavorites] = useState<Set<string>>(new Set());

    const router = useRouter();

    const handleContactSeller = (_sellerData: unknown, _productContext: unknown) => {
        router.push('/(tabs)/Profile');
    };

    const handleSearch = () => {
        setSearchTerm(inputValue);
        setShouldFilter(true);
    };

    const toggleFavorite = (productId: string) => {
        const newFavorites = new Set(favorites);
        if (newFavorites.has(productId)) {
            newFavorites.delete(productId);
        } else {
            newFavorites.add(productId);
        }
        setFavorites(newFavorites);
    };

    // Category cards data
    const categoryCards: CategoryCard[] = [
        {
            id: 'electronics',
            name: 'Electronics',
            icon: 'phone-portrait',
            itemCount: 2245,
            color: '#3B82F6',
        },
        {
            id: 'fashion',
            name: 'Fashion',
            icon: 'shirt',
            itemCount: 1852,
            color: '#EC4899',
        },
        {
            id: 'home-garden',
            name: 'Home & Garden',
            icon: 'home',
            itemCount: 1234,
            color: '#14B8A6',
        },
        {
            id: 'sports-fitness',
            name: 'Sports & Fitness',
            icon: 'fitness',
            itemCount: 987,
            color: '#F97316',
        },
    ];

    // useEffect(() => {
    //     const loadInitialData = async () => {
    //         const defaultMax = 100000;
    //         const midPoint = Math.floor(defaultMax / 2);
    //         setPriceRange([0, midPoint]);

    //         try {
    //             const response = await fetch('/api/market/fetch');
    //             const result = await response.json();

    //             if (result.status === 'success') {
    //                 const marketData = result.data.data;
    //                 console.log("product data found was: ", marketData);
    //                 setCategories(marketData.categories);
    //                 setColors(marketData.colors);
    //                 setSizes(marketData.sizes);
    //                 setColorVariants(marketData.colorVariants);
    //                 setSizeVariants(marketData.sizeVariants);
    //                 setVariants(marketData.variants);
    //                 setProducts(marketData.products);
    //                 setOwnership(marketData.ownership);
    //                 setMarketData(marketData);
    //             } else {
    //                 throw new Error('Api returned unsuccessful status')
    //             }
    //         } catch (error) {
    //             console.error('Error loading market data:', error);
    //             // Use dummy data as fallback 
    //             const dummyData = generateDummyMarketData();
    //             setCategories(dummyData.categories);
    //             setColors(dummyData.colors);
    //             setSizes(dummyData.sizes);
    //             setColorVariants(dummyData.colorVariants);
    //             setSizeVariants(dummyData.sizeVariants);
    //             setVariants(dummyData.variants);
    //             setProducts(dummyData.products);
    //             setOwnership(dummyData.ownership);
    //             setMarketData(dummyData);
    //         }
    //         setIsLoading(false);
    //     };

    //     loadInitialData();
    // }, []);

    // useEffect for testing the dummy data
    useEffect(() => {
        const loadInitialData = async () => {
            const defaultMax = 100000;
            const midPoint = Math.floor(defaultMax / 2);
            setPriceRange([0, midPoint]);

            // For testing: Use dummy data immediately
            // Uncomment the line below to force dummy data
            // const useDummyData = true;
            const useDummyData = true;

            if (useDummyData) {
                const dummyData = generateDummyMarketData();
                setCategories(dummyData.categories);
                setColors(dummyData.colors);
                setSizes(dummyData.sizes);
                setVariants(dummyData.variants);
                setProducts(dummyData.products);
                setMarketData(dummyData);
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/market/fetch');
                
                // Check if response is ok
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();

                // Check if result has valid structure
                if (result.status === 'success' && result.data && result.data.data) {
                    const marketData = result.data.data;
                    console.log("product data found was: ", marketData);
                    
                    // Validate that we have products
                    if (marketData.products && marketData.products.length > 0) {
                        setCategories(marketData.categories || []);
                        setColors(marketData.colors || []);
                        setSizes(marketData.sizes || []);
                        setVariants(marketData.variants || []);
                        setProducts(marketData.products);
                        setMarketData(marketData);
                    } else {
                        throw new Error('No products found in API response');
                    }
                } else {
                    throw new Error('API returned unsuccessful status or invalid structure');
                }
            } catch (error) {
                console.error('Error loading market data, using dummy data:', error);
                // Use dummy data as fallback 
                const dummyData = generateDummyMarketData();
                console.log('Dummy data generated:', dummyData);
                setCategories(dummyData.categories);
                setColors(dummyData.colors);
                setSizes(dummyData.sizes);
                setVariants(dummyData.variants);
                setProducts(dummyData.products);
                setMarketData(dummyData);
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
                } else {
                    //Fallback: Filter dummy data locally
                    filterDummyDataLocally();
                }
            } catch (error) {
                console.error('Error applying filters:', error);
                //Fallback: Filter dummy data locally
                filterDummyDataLocally();
            }
        };

        const filterDummyDataLocally = () => {
            const dummyData = marketData || generateDummyMarketData();
            let filteredProducts = [...dummyData.products];

            // Filter by category
            if (selectedCategories.length > 0) {
                // Map category IDs to category names
                const categoryMap: { [key: string]: string } = {
                    'electronics': 'Electronics',
                    'fashion': 'Fashion',
                    'home-applicances': 'Home Appliances',
                    'sports-fitness': 'Sports & Fitness',
                };
                const categoryNames = selectedCategories.map(id => categoryMap[id] || id);
                filteredProducts = filteredProducts.filter(p => 
                    categoryNames.includes(p.category)
                );
            }

            // Filter by search term
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                filteredProducts = filteredProducts.filter(p =>
                    p.title.toLowerCase().includes(searchLower) ||
                    p.shortDescription.toLowerCase().includes(searchLower)
                );
            }

            // Filter by price range
            const filteredVariants = dummyData.variants.filter((v: ProductVariant) =>
                v.price >= priceRange[0] && v.price <= priceRange[1]
            );
            const productIdsWithPrice = new Set(filteredVariants.map((v: ProductVariant) => v.productId));
            filteredProducts = filteredProducts.filter(p => productIdsWithPrice.has(p.id));

            setProducts(filteredProducts);
            if (!marketData) {
                setMarketData(dummyData);
            }
        };


        handleFilters();
        setShouldFilter(false);
    }, [shouldFilter, selectedCategories, selectedColors, selectedSizes, priceRange, searchTerm, marketData]);

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

    const handleCategorySelect = (categoryId: string) => {
        // Map category card IDs to actual category names
        const categoryMap: { [key: string]: string } = {
            'electronics': 'Electronics',
            'fashion': 'Fashion',
            'home-garden': 'Home & Garden',
            'sports-fitness': 'Sports & Fitness',
        };
        const categoryName = categoryMap[categoryId] || categoryId;
        setSelectedCategories([categoryName]);
        setShouldFilter(true);
        // setSelectedCategories([categoryId]);
        // setShouldFilter(true);
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

    const renderCategoryCard = (category: CategoryCard) => {
        return (
            <TouchableOpacity
                key={category.id}
                onPress={() => handleCategorySelect(category.id)}
                style={{
                    flex: 1,
                    backgroundColor: category.color,
                    borderRadius: 16,
                    padding: 20,
                    margin: 6,
                    minHeight: 140,
                    justifyContent: 'space-between',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                }}
            >
                <View>
                    <View style={{ marginBottom: 12 }}>
                        <Ionicons name={category.icon} size={32} color="#FFFFFF" />
                    </View>
                    <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#FFFFFF',
                        marginBottom: 4,
                    }}>
                        {category.name}
                    </Text>
                    <Text style={{
                        fontSize: 12,
                        color: 'rgba(255, 255, 255, 0.9)',
                    }}>
                        {category.itemCount.toLocaleString()} items
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderProductCard = ({ item: product }: { item: Product }) => {
        const isFavorite = favorites.has(product.id);
        const isBestseller = Math.random() > 0.7;
        const discount = Math.random() > 0.8 ? 25 : 0;
        const priceDisplay = getProductPriceDisplay(product.id);
        const priceValue = parseFloat(priceDisplay.replace(/[^0-9.]/g, '')) || 0;
        const originalPrice = discount > 0 ? (priceValue * 1.33).toFixed(2) : null;

        return (
            <TouchableOpacity
                key={product.id}
                style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 16,
                    overflow: 'hidden',
                    width: isGrid ? (screenWidth - 48) / 2 : '100%',
                    marginBottom: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                }}
                onPress={() => {
                    setSelectedProduct(product);
                    setIsSidebarProductOpen(true);
                }}
            >
                <View style={{ position: 'relative', width: '100%', height: 200 }}>
                    <Image
                        source={{ uri: product.thumbnailImage }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                    
                    <View style={{ position: 'absolute', top: 8, left: 8, flexDirection: 'column', gap: 4 }}>
                        {isBestseller && (
                            <View style={{
                                backgroundColor: '#3B82F6',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                            }}>
                                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>
                                    Bestseller
                                </Text>
                            </View>
                        )}
                        {discount > 0 && (
                            <View style={{
                                backgroundColor: '#EF4444',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                            }}>
                                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>
                                    {discount}% OFF
                                </Text>
                            </View>
                        )}
                    </View>
                    
                    <TouchableOpacity
                        style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: 20,
                            padding: 8,
                        }}
                        onPress={(e) => {
                            e.stopPropagation();
                            toggleFavorite(product.id);
                        }}
                    >
                        <Heart 
                            size={18} 
                            color="#EF4444" 
                            fill={isFavorite ? "#EF4444" : "none"} 
                        />
                    </TouchableOpacity>
                </View>

                <View style={{ padding: 12 }}>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: 4,
                    }} numberOfLines={1}>
                        {product.title}
                    </Text>
                    
                    <Text style={{
                        fontSize: 12,
                        color: '#6B7280',
                        marginBottom: 8,
                    }} numberOfLines={2}>
                        {product.shortDescription?.length > 60
                            ? `${product.shortDescription.substring(0, 60)}...`
                            : product.shortDescription}
                    </Text>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: '#111827',
                        }}>
                            {priceDisplay}
                        </Text>
                        {originalPrice && (
                            <Text style={{
                                fontSize: 12,
                                color: '#6B7280',
                                textDecorationLine: 'line-through',
                            }}>
                                ${originalPrice}
                            </Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            <PageHeader title="Market" onBackPress={() => router.back()} />
            <ScrollView 
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Shop by Category Section */}
                <View style={{ 
                    paddingTop: 50, 
                    paddingBottom: 24, 
                    backgroundColor: '#FFFFFF',
                    borderBottomWidth: 1,
                    borderBottomColor: '#E5E7EB',
                }}>
                    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 4 }}>
                            Shop by Category
                        </Text>
                        <Text style={{ fontSize: 14, color: '#6B7280' }}>
                            Browse our collections
                        </Text>
                    </View>

                    <View style={{ 
                        flexDirection: 'row', 
                        flexWrap: 'wrap', 
                        paddingHorizontal: 10,
                    }}>
                        {categoryCards.map((category) => (
                            <View key={category.id} style={{ width: '48%', margin: '1%' }}>
                                {renderCategoryCard(category)}
                            </View>
                        ))}
                    </View>
                </View>

                {/* Navigation Tabs */}
                <View style={{
                    flexDirection: 'row',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: '#FFFFFF',
                    borderBottomWidth: 1,
                    borderBottomColor: '#E5E7EB',
                }}>
                    {(['Featured', 'New', 'Deals'] as TabType[]).map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            style={{
                                flex: 1,
                                paddingVertical: 8,
                                alignItems: 'center',
                                borderBottomWidth: activeTab === tab ? 2 : 0,
                                borderBottomColor: '#10B981',
                                marginHorizontal: 4,
                            }}
                        >
                            <Text style={{
                                fontSize: 16,
                                fontWeight: activeTab === tab ? '600' : '400',
                                color: activeTab === tab ? '#111827' : '#6B7280',
                            }}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Search and Filter Section */}
                <View style={{
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    backgroundColor: '#FFFFFF',
                    borderBottomWidth: 1,
                    borderBottomColor: '#E5E7EB',
                }}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <View style={{ flex: 1, position: 'relative' }}>
                            <TextInput
                                placeholder="Search products..."
                                value={inputValue}
                                onChangeText={setInputValue}
                                onSubmitEditing={handleSearch}
                                style={{
                                    paddingLeft: 40,
                                    paddingRight: 16,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#D1D5DB',
                                    backgroundColor: '#F9FAFB',
                                    fontSize: 14,
                                }}
                            />
                            <View style={{
                                position: 'absolute',
                                left: 12,
                                top: '50%',
                                marginTop: -10,
                            }}>
                                <Search size={20} color="#9CA3AF" />
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => setIsSidebarOpen(true)}
                            style={{
                                padding: 12,
                                borderRadius: 12,
                                backgroundColor: '#10B981',
                            }}
                        >
                            <Ionicons name="filter" size={20} color="#FFFFFF" />
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity
                                onPress={() => setViewMode('grid')}
                                style={{
                                    padding: 12,
                                    borderRadius: 12,
                                    backgroundColor: viewMode === 'grid' ? '#10B981' : '#F3F4F6',
                                }}
                            >
                                <LayoutGrid 
                                    size={18} 
                                    color={viewMode === 'grid' ? '#FFFFFF' : '#6B7280'} 
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setViewMode('list')}
                                style={{
                                    padding: 12,
                                    borderRadius: 12,
                                    backgroundColor: viewMode === 'list' ? '#10B981' : '#F3F4F6',
                                }}
                            >
                                <List 
                                    size={18} 
                                    color={viewMode === 'list' ? '#FFFFFF' : '#6B7280'} 
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Products Grid */}
                <View style={{ padding: 16, backgroundColor: '#F9FAFB' }}>
                    {products.length > 0 ? (
                        <FlatList
                            data={products}
                            renderItem={renderProductCard}
                            numColumns={isGrid ? 2 : 1}
                            key={viewMode}
                            scrollEnabled={false}
                            columnWrapperStyle={isGrid ? { justifyContent: 'space-between' } : undefined}
                            keyExtractor={(item) => item.id}
                        />
                    ) : (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <Text style={{ fontSize: 16, color: '#6B7280' }}>
                                No products found
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

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

            {selectedProduct && (
                <ProductDetailsSidebar
                    isOpen={isSidebarProductOpen}
                    onClose={() => {
                        setIsSidebarProductOpen(false);
                        setSelectedProduct(null);
                    }}
                    product={selectedProduct}
                    marketData={marketData ?? { colorVariants: [], sizeVariants: [], variants: [], subImages: [], ownership: [] }}
                    onContactSeller={handleContactSeller}
                />
            )}
        </View>
    );
}