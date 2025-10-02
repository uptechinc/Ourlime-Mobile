import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import {useRouter} from 'expo-router';
type Community = {
    id: string;
    title: string;
    membershipCount: number;
    imageUrl: string;
};

export const CommunitiesSection = () => {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const { width } = Dimensions.get('window');
    const cardWidth = (width - 48) / 2; // 48 = container padding + gap

    useEffect(() => {
        const fetchCommunities = async () => {
            try {
                const response = await fetch('/api/home/RightSection');
                const data = await response.json();

                if (data.success) {
                    setCommunities(data.data.communities);
                }
            } catch (error) {
                console.error('Error fetching communities:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCommunities();
    }, []);

    return (
        <View style={{
            marginBottom: 32,
            paddingHorizontal: 16,
        }}>
            <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
            }}>
                <Text style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#000',
                }}>Communities</Text>
                <TouchableOpacity
                    onPress={() => {
                        // Navigate to communities screen
                        // You'll need to implement navigation here
                        router.push('/communities/page');
                        console.log('Navigate to communities');
                    }}
                >
                    <Text style={{
                        fontSize: 14,
                        color: '#22c55e', // greenTheme equivalent
                    }}>See All</Text>
                </TouchableOpacity>
            </View>

            <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
            }}>
                {communities.map((community) => (
                    <TouchableOpacity
                        key={community.id}
                        style={{
                            width: cardWidth,
                            height: 96,
                            marginBottom: 12,
                            borderRadius: 8,
                            overflow: 'hidden',
                        }}
                        activeOpacity={0.8}
                    >
                        <Image
                            source={{ uri: community.imageUrl }}
                            style={{
                                width: '100%',
                                height: '100%',
                            }}
                            resizeMode="cover"
                        />
                        <View style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: 8,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        }}>
                            <Text style={{
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: '500',
                                marginBottom: 2,
                            }} numberOfLines={1}>
                                {community.title}
                            </Text>
                            <Text style={{
                                color: '#d1d5db', // gray-300 equivalent
                                fontSize: 12,
                            }}>
                                {community.membershipCount.toLocaleString()} members
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};
