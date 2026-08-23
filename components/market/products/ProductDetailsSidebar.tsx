import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal } from 'react-native';
import { Product, ColorVariants, SizeVariants, ProductVariant } from '@/types/productTypes';

import { useTempMessages } from '@/src/hooks/useTempMessages';
import { useProfileStore } from '@/src/store/useProfileStore';
import { useChatStore } from '@/src/chatExpand/useChatStore';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

export type MarketOwnership = {
    id: string;
    productId: string;
    userId: string;
    sellerType: 'business' | 'personal';
    profileImage: string;
    businessDetails?: {
        name: string;
        description: string;
        location?: string;
        established?: string;
        rating?: number;
        contact?: {
            email?: string;
            phone?: string;
            website?: string;
        }
    };
    businessProfile?: {
        rating: {
            overall: number;
            service: number;
            delivery: number;
            product: number;
        };
        feedback: {
            satisfaction: number;
            resolution: number;
            responseTime: number;
        };
        reviews: {
            total: number;
            positive: number;
            negative: number;
        };
    };
    businessOwner?: {
        name: string;
        email: string;
    };
};

type ProductDetailsSidebarProps = {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    marketData: {
        colorVariants: ColorVariants[];
        sizeVariants: SizeVariants[];
        variants: ProductVariant[];
        subImages?: { id: string; productId: string; imageName: string }[];
        ownership: MarketOwnership[];
    };
    onContactSeller?: (sellerData: unknown, productContext: unknown) => void;
};

export default function ProductDetailsSidebar({ isOpen, onClose, product, marketData, onContactSeller }: ProductDetailsSidebarProps) {
    const [selectedImage, setSelectedImage] = useState(product?.thumbnailImage);
    const [selectedColor, setSelectedColor] = useState('');
    const [selectedSize, setSelectedSize] = useState('');
    const [selectedVariantPrice, setSelectedVariantPrice] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const ownership = marketData.ownership.find(o => o.productId === product.id);
    const productColorVariants = marketData.colorVariants.filter(cv => cv.productId === product.id);
    const productSizeVariants = marketData.sizeVariants.filter(sv => sv.productId === product.id);
    const productVariants = marketData.variants.filter(v => v.productId === product.id);
    const productSubImages = (marketData.subImages ?? []).filter(si => si.productId === product.id);
    const { setWindowSize } = useChatStore();

    // Inside component:
    const { sendTempMessage } = useTempMessages();

    // Set initial selections
    useEffect(() => {
        if (productColorVariants.length > 0) {
            setSelectedColor(productColorVariants[0].id);
        }
        if (productSizeVariants.length > 0) {
            setSelectedSize(productSizeVariants[0].id);
        }
    }, [productColorVariants, productSizeVariants]);

    // Update price when variants change
    useEffect(() => {
        let variant;

        if (productColorVariants.length > 0 && productSizeVariants.length > 0) {
            variant = productVariants.find(v =>
                v.colorVariantId === selectedColor &&
                v.sizeVariantId === selectedSize
            );
        } else if (productSizeVariants.length > 0) {
            variant = productVariants.find(v =>
                v.sizeVariantId === selectedSize
            );
        } else if (productColorVariants.length > 0) {
            variant = productVariants.find(v =>
                v.colorVariantId === selectedColor
            );
        }

        if (variant) {
            setSelectedVariantPrice(variant.price);
        } else {
            const minPrice = Math.min(...productVariants.map(v => v.price));
            setSelectedVariantPrice(minPrice);
        }
    }, [selectedColor, selectedSize, productVariants, productColorVariants.length, productSizeVariants.length]);

    const renderStars = (rating: number) => {
        return [...Array(5)].map((_, index) => (
            <Text key={index} style={{ fontSize: 16, color: index < Math.floor(rating) ? '#fbbf24' : '#d1d5db' }}>
                ★
            </Text>
        ));
    };

    const handleProductInquiry = async () => {
        setIsSubmitting(true);
    
        const productOwnership = marketData.ownership.find(o => o.productId === product.id);
        
        const selectedColorVariant = productColorVariants.find(cv => cv.id === selectedColor);
        const selectedSizeVariant = productSizeVariants.find(sv => sv.id === selectedSize);
        
        const productContext = {
            productTitle: product.title,
            productImage: product.thumbnailImage,
            price: selectedVariantPrice?.toString() ||
                (productVariants.length > 0 ? productVariants[0].price.toString() : null),
            colorVariant: selectedColorVariant?.colorVariantName || null,
            sizeVariant: selectedSizeVariant?.sizeVariantName || null
        };
    
        try {
            if (productOwnership?.userId) {
            await sendTempMessage(
                    productOwnership.userId,
                `Hi, I'm interested in ${product.title}${selectedColorVariant ? ` in ${selectedColorVariant.colorVariantName}` : ''}${selectedSizeVariant ? `, size ${selectedSizeVariant.sizeVariantName}` : ''}. Is this available?`,
                productContext
            );
            
            // Open chat with business tab and correct conversation
                useChatStore.getState().openBusinessChat(productOwnership.userId);
                setWindowSize('compact');
            onClose(); // Close the product sidebar
            } else {
                console.log('No product ownership found');
                onClose();
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleAddToWishlist = () => {
        const userData = useProfileStore.getState();
        console.log("adding to wishlist:", {
            productTitle: product.title,
            productImage: product.thumbnailImage,
            colorVariant: productColorVariants.find(cv => cv.id === selectedColor)?.colorVariantName || null,
            sizeVariant: productSizeVariants.find(sv => sv.id === selectedSize)?.sizeVariantName || null,
            userId: userData.id
        });
    };

    if (!product) return null;

    const availableColorVariants = productColorVariants.filter(colorVariant => 
                                                    productVariants.some(v => 
                                                        v.colorVariantId === colorVariant.id && 
                                                        v.quantity > 0
                                                    )
                                                );

    return (
        <Modal
            visible={isOpen}
            transparent
            statusBarTranslucent
            navigationBarTranslucent
            animationType="none"
            presentationStyle="overFullScreen"
            onRequestClose={onClose}
        >
            <SwipeDismissSurface visible={isOpen} onDismiss={onClose} handleColor="#d1d5db" disabled={isSubmitting} accessibilityLabel="Swipe down to close product details" style={{ flex: 1, backgroundColor: '#ffffff' }}>
                {/* Header */}
                <View style={{ 
                    height: 56, 
                    borderBottomWidth: 1, 
                    borderBottomColor: '#e5e7eb', 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    paddingHorizontal: 16 
                }}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{ 
                            position: 'absolute', 
                            left: 16, 
                            padding: 6,
                            zIndex: 10
                        }}
                    >
                        <Text style={{ fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                    <Text style={{ 
                        width: '100%', 
                        textAlign: 'center', 
                        fontWeight: '600', 
                        fontSize: 16,
                        paddingHorizontal: 48
                    }} numberOfLines={1}>
                        {product.title}
                    </Text>
                </View>

                {/* Main Content */}
                <ScrollView style={{ flex: 1, paddingBottom: 80 }}>
                    <View style={{ padding: 12, paddingHorizontal: 16 }}>
                        {/* Image Gallery */}
                        <View style={{ flexDirection: 'row', gap: 12, height: 400 }}>
                            <View style={{ width: 64, flexShrink: 0 }}>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    <View style={{ flexDirection: 'column', gap: 6 }}>
                                    {[product.thumbnailImage, ...productSubImages.map(img => img.imageName)].map((image, index) => (
                                            <TouchableOpacity
                                            key={index}
                                                style={{
                                                    width: '100%',
                                                    aspectRatio: 1,
                                                    borderRadius: 8,
                                                    overflow: 'hidden',
                                                    backgroundColor: '#f9fafb',
                                                    borderWidth: selectedImage === image ? 2 : 1,
                                                    borderColor: selectedImage === image ? '#10b981' : '#e5e7eb'
                                                }}
                                                onPress={() => setSelectedImage(image)}
                                        >
                                            {typeof image === 'string' && image.includes('/video/') ? (
                                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 20, color: '#9ca3af' }}>🎬</Text>
                                                    </View>
                                            ) : (
                                                <Image
                                                        source={{ uri: image }}
                                                        style={{ width: '100%', height: '100%' }}
                                                        resizeMode="cover"
                                                    />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>

                            <View style={{ flex: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f9fafb' }}>
                                {typeof selectedImage === 'string' && selectedImage.includes('/video/') ? (
                                    <View style={{ height: '100%', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 24, color: '#9ca3af' }}>🎬 Video</Text>
                                    </View>
                                ) : (
                                    <Image
                                        source={{ uri: selectedImage || product.thumbnailImage }}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode="contain"
                                    />
                                )}
                            </View>
                        </View>

                        {/* Seller Info */}
                        {ownership?.sellerType === 'business' && (
                            <View style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                backgroundColor: '#f9fafb', 
                                padding: 12, 
                                borderRadius: 12, 
                                marginTop: 16 
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#e5e7eb' }}>
                                        <Image
                                            source={{ uri: ownership?.profileImage || "https://via.placeholder.com/40" }}
                                            style={{ width: '100%', height: '100%' }}
                                            resizeMode="cover"
                                        />
                                    </View>
                                    <View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '500' }}>
                                                {ownership?.businessDetails?.name}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                {renderStars(ownership?.businessProfile?.rating?.overall || 0)}
                                            </View>
                                        </View>
                                        <View style={{ marginTop: 4 }}>
                                            {ownership?.businessDetails?.established && (
                                                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                                    Established {ownership.businessDetails.established}
                                                </Text>
                                            )}
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                                {ownership?.businessDetails?.location}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                                {ownership?.businessDetails?.contact?.email}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <TouchableOpacity>
                                    <Text style={{ fontSize: 12, fontWeight: '500', color: '#10b981' }}>
                                    View Shop
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {ownership?.sellerType === 'business' && ownership?.businessDetails?.contact?.website && (
                            <View style={{ backgroundColor: '#f9fafb', padding: 12, borderRadius: 12, marginTop: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '500', marginBottom: 8 }}>Business Website</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={{ fontSize: 16, color: '#6b7280' }}>🌐</Text>
                                        <Text style={{ fontSize: 14, color: '#374151' }}>
                                            {ownership.businessDetails.contact.website}
                                        </Text>
                                    </View>
                                    <TouchableOpacity>
                                        <Text style={{ fontSize: 12, fontWeight: '500', color: '#10b981' }}>
                                        Visit Website
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Product Info */}
                        <View style={{ marginTop: 16 }}>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{product.title}</Text>
                            <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{product.shortDescription}</Text>
                        </View>

                        {/* Contact Information */}
                        {(product.contactInfo || ownership?.businessDetails?.contact) && (
                            <View style={{ backgroundColor: '#f9fafb', padding: 16, borderRadius: 12, marginTop: 16 }}>
                                <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827', marginBottom: 8 }}>Contact Information</Text>
                                <View style={{ gap: 12 }}>
                                    {/* Phone */}
                                    {(product.contactInfo?.find(item => item.type === 'phone')?.value || ownership?.businessDetails?.contact?.phone) && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={{ fontSize: 16, color: '#6b7280' }}>📞</Text>
                                            <Text style={{ fontSize: 14, color: '#374151' }}>
                                                {product.contactInfo?.find(item => item.type === 'phone')?.value || ownership?.businessDetails?.contact?.phone}
                                            </Text>
                                        </View>
                                    )}
                                    
                                    {/* Email */}
                                    {(product.contactInfo?.find(item => item.type === 'email')?.value || ownership?.businessDetails?.contact?.email) && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={{ fontSize: 16, color: '#6b7280' }}>📧</Text>
                                            <Text style={{ fontSize: 14, color: '#374151' }}>
                                                {product.contactInfo?.find(item => item.type === 'email')?.value || ownership?.businessDetails?.contact?.email}
                                            </Text>
                                        </View>
                                    )}
                                    
                                    {/* Website */}
                                    {(product.contactInfo?.find(item => item.type === 'website')?.value || ownership?.businessDetails?.contact?.website) && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={{ fontSize: 16, color: '#6b7280' }}>🌐</Text>
                                                <Text style={{ fontSize: 14, color: '#374151' }}>
                                                    {product.contactInfo?.find(item => item.type === 'website')?.value || ownership?.businessDetails?.contact?.website}
                                                </Text>
                                            </View>
                                            <TouchableOpacity>
                                                <Text style={{ fontSize: 12, fontWeight: '500', color: '#10b981' }}>
                                                Visit
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Price and Stock */}
                        <View style={{ backgroundColor: '#f9fafb', padding: 12, borderRadius: 12, marginTop: 16 }}>
                            {ownership?.sellerType === 'business' ? (
                                <>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 12, fontWeight: '500' }}>Price</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={{ fontSize: 12, color: '#059669', fontWeight: '500' }}>
                                                {productVariants.some(v => v.quantity > 0) ? 'In Stock' : 'Out of Stock'}
                                            </Text>
                                            {productVariants.some(v => v.quantity > 0) && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Qty:</Text>
                                                    <View style={{ 
                                                        borderWidth: 1, 
                                                        borderColor: '#d1d5db', 
                                                        borderRadius: 6, 
                                                        paddingHorizontal: 8, 
                                                        paddingVertical: 4, 
                                                        backgroundColor: '#ffffff' 
                                                    }}>
                                                        <Text style={{ fontSize: 12 }}>1</Text>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827' }}>
                                            {selectedVariantPrice
                                                ? `$${selectedVariantPrice.toFixed(2)}`
                                                : productVariants.length > 0
                                                    ? (() => {
                                                        const minPrice = Math.min(...productVariants.map(v => v.price));
                                                        const maxPrice = Math.max(...productVariants.map(v => v.price));
                                                        return minPrice === maxPrice
                                                            ? `$${minPrice.toFixed(2)}`
                                                            : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
                                                    })()
                                                    : 'Price unavailable'
                                            }
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                            {productVariants[0]?.quantity || 0} units available
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{ fontSize: 12, fontWeight: '500' }}>Price</Text>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827' }}>
                                        {selectedVariantPrice
                                            ? `$${selectedVariantPrice.toFixed(2)}`
                                            : productVariants.length > 0
                                                ? `$${productVariants[0].price.toFixed(2)}`
                                                : 'Price unavailable'
                                        }
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Long Description */}
                        <View style={{ backgroundColor: '#f9fafb', padding: 12, borderRadius: 12, marginTop: 16 }}>
                            <Text style={{ fontSize: 12, fontWeight: '500', marginBottom: 8 }}>Product Description</Text>
                            <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}>
                                {product.longDescription}
                            </Text>
                        </View>

                        {/* Variants Selection */}
                        {availableColorVariants.length > 0 && (
                            <View style={{ marginTop: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '500', marginBottom: 8 }}>Select Color</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {availableColorVariants.map((colorVariant) => (
                                        <TouchableOpacity
                                            key={colorVariant.id}
                                            onPress={() => setSelectedColor(colorVariant.id)}
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 16,
                                                borderWidth: 2,
                                                borderColor: selectedColor === colorVariant.id ? '#10b981' : '#e5e7eb',
                                                backgroundColor: colorVariant.colorVariantName
                                            }}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}

                        {productSizeVariants.length > 0 && (
                            <View style={{ marginTop: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '500', marginBottom: 8 }}>Select Size</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {productSizeVariants.map((sizeVariant) => (
                                        <TouchableOpacity
                                            key={sizeVariant.id}
                                            onPress={() => setSelectedSize(sizeVariant.id)}
                                            style={{
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 8,
                                                borderWidth: 2,
                                                borderColor: selectedSize === sizeVariant.id ? '#10b981' : '#e5e7eb',
                                                backgroundColor: selectedSize === sizeVariant.id ? '#ecfdf5' : 'transparent'
                                            }}
                                        >
                                            <Text style={{ 
                                                fontSize: 12, 
                                                fontWeight: '500',
                                                color: selectedSize === sizeVariant.id ? '#10b981' : '#374151'
                                            }}>
                                            {sizeVariant.sizeVariantName}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {ownership?.sellerType === 'business' && (
                            <>
                                {/* Business Metrics */}
                                <View style={{ backgroundColor: '#f9fafb', padding: 12, borderRadius: 12, marginTop: 16 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '500', marginBottom: 8 }}>Business Performance</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                        <View style={{ width: '48%' }}>
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                                Response Rate: <Text style={{ fontWeight: '500' }}>{ownership?.businessProfile?.feedback?.responseTime || 0}%</Text>
                                            </Text>
                                        </View>
                                        <View style={{ width: '48%' }}>
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                                Satisfaction: <Text style={{ fontWeight: '500' }}>{ownership?.businessProfile?.feedback?.satisfaction || 0}%</Text>
                                            </Text>
                                        </View>
                                        <View style={{ width: '48%' }}>
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                                Total Reviews: <Text style={{ fontWeight: '500' }}>{ownership?.businessProfile?.reviews?.total || 0}</Text>
                                            </Text>
                                        </View>
                                        <View style={{ width: '48%' }}>
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                                Positive Reviews: <Text style={{ fontWeight: '500' }}>{ownership?.businessProfile?.reviews?.positive || 0}</Text>
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Ratings Breakdown */}
                                <View style={{ backgroundColor: '#f9fafb', padding: 12, borderRadius: 12, marginTop: 16 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '500', marginBottom: 8 }}>Rating Breakdown</Text>
                                    <View style={{ gap: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>Overall</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                {renderStars(ownership?.businessProfile?.rating?.overall || 0)}
                                            </View>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>Service</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                {renderStars(ownership?.businessProfile?.rating?.service || 0)}
                                            </View>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>Delivery</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                {renderStars(ownership?.businessProfile?.rating?.delivery || 0)}
                                            </View>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>Product Quality</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                {renderStars(ownership?.businessProfile?.rating?.product || 0)}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                </ScrollView>

                {/* Bottom Actions */}
                <View style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    left: 0, 
                    right: 0, 
                    borderTopWidth: 1, 
                    borderTopColor: '#e5e7eb', 
                    padding: 12, 
                    backgroundColor: '#ffffff' 
                }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {ownership?.sellerType === 'business' && (
                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    backgroundColor: '#ffffff'
                                }}
                                onPress={handleAddToWishlist}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <Text style={{ fontSize: 16 }}>❤️</Text>
                                    <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151' }}>Add to Wishlist</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={{
                                flex: 1,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                backgroundColor: '#6b7280',
                                borderRadius: 8
                            }}
                            onPress={handleProductInquiry}
                            disabled={isSubmitting}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <Text style={{ fontSize: 16 }}>💬</Text>
                                <Text style={{ fontSize: 12, fontWeight: '500', color: '#ffffff' }}>
                                    {isSubmitting ? 'Sending...' : 'Contact Seller'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </SwipeDismissSurface>
        </Modal>
    );
}
