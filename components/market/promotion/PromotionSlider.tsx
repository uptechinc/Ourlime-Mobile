// components/market/promotion/PromotionSlider.tsx
import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';

type Promotion = {
    id: string;
    name: string;
    count: number;
    image: string;
    description: string;
};

export default function PromotionSlider() {
    const promotions = [
        {
            id: '1',
            name: "Summer Collection",
            count: 24,
            image: "/images/promotions/summer-collection.jpg",
            description: "Discover our latest summer essentials"
        },
        {
            id: '2',
            name: "Best Sellers",
            count: 42,
            image: "/images/promotions/best-sellers.jpg",
            description: "Shop customer favorites and trending items"
        },
        {
            id: '3',
            name: "New Arrivals",
            count: 18,
            image: "/images/promotions/new-arrivals.jpg",
            description: "Fresh drops and latest additions"
        },
        {
            id: '4',
            name: "Special Offers",
            count: 15,
            image: "/images/promotions/special-offers.jpg",
            description: "Limited time deals and discounts"
        }
    ];

    const handlePromotionSelect = (promotionId: string) => {
        // Handle promotion selection logic here
        console.log('Selected promotion:', promotionId);
    };

    const screenWidth = Dimensions.get('window').width;
    const cardWidth = screenWidth * 0.8; // 80% of screen width for mobile

    return (
        <View style={{ marginBottom: 4 }}>
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                snapToInterval={cardWidth + 20}
                decelerationRate="fast"
            >
                {promotions.map((promotion) => (
                    <View key={promotion.id} style={{ marginRight: 20 }}>
                        <PromotionCard
                            promotion={promotion}
                            onSelect={() => handlePromotionSelect(promotion.id)}
                            cardWidth={cardWidth}
                        />
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

function PromotionCard({ promotion, onSelect, cardWidth }: {
    promotion: Promotion;
    onSelect: () => void;
    cardWidth: number;
}) {
    return (
        <TouchableOpacity
            onPress={onSelect}
            style={{ 
                width: cardWidth, 
                height: 256, 
                borderRadius: 16, 
                overflow: 'hidden',
                backgroundColor: '#f3f4f6'
            }}
        >
            <Image
                source={{ uri: promotion.image }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
            />
            <View style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10
            }}>
                <View style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.6)', 
                    paddingHorizontal: 24, 
                    paddingVertical: 12, 
                    borderWidth: 4, 
                    borderColor: '#ffffff', 
                    borderRadius: 50,
                    transform: [{ rotate: '-6deg' }]
                }}>
                    <Text style={{ 
                        fontSize: 24, 
                        fontWeight: 'bold', 
                        color: '#ffffff', 
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        opacity: 0.9
                    }}>
                        Coming Soon
                    </Text>
                </View>
            </View>
            <View style={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                padding: 24 
            }}>
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginBottom: 8 
                }}>
                    <View style={{ 
                        paddingHorizontal: 12, 
                        paddingVertical: 4, 
                        backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                        borderRadius: 50 
                    }}>
                        <Text style={{ 
                            color: '#ffffff', 
                            fontSize: 14 
                        }}>
                            {promotion.count} items
                        </Text>
                    </View>
                </View>
                <Text style={{ 
                    fontSize: 20, 
                    fontWeight: 'bold', 
                    color: '#ffffff', 
                    marginBottom: 4 
                }}>
                    {promotion.name}
                </Text>
                <Text style={{ 
                    color: '#d1d5db', 
                    fontSize: 14, 
                    lineHeight: 20 
                }} numberOfLines={2}>
                    {promotion.description}
                </Text>
                <View style={{ 
                    position: 'absolute', 
                    right: 24, 
                    bottom: 24, 
                    transform: [{ translateX: 32 }], 
                    opacity: 0 
                }}>
                    <View style={{ 
                        backgroundColor: '#ffffff', 
                        borderRadius: 50, 
                        padding: 8 
                    }}>
                        <Text style={{ fontSize: 20, color: '#374151' }}>→</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}
