import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import {useRouter} from 'expo-router';

type Community = {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    categoryId: string;
    creatorProfileImage?: string | null;
    creatorName?: string;
    isMember?: boolean;
    requestStatus?: 'pending' | 'declined' | null;
    membershipCount?: number;
    membershipLikes?: number;
    isPrivate?: boolean;
    topMembers?: string[];
};

export const CommunitiesSection = () => {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const { width } = Dimensions.get('window');
    const cardWidth = (width - 80) / 2; // 48 = container padding + gap
    const cardHeight = 120;

    useEffect(() => {
        const fetchCommunities = async () => {
            try {
                 // Using the same dummy data from communities page.tsx
                 const dummyCommunities: Community[] = [
                    {
                        id: '123',
                        title: 'React Native Fans',
                        description: 'All about React Native, Expo & Tailwind.',
                        imageUrl: 'https://picsum.photos/id/1025/300/100',
                        categoryId: 'cat1',
                        creatorName: 'John Doe',
                        isPrivate: false,
                        requestStatus: null,
                        membershipCount: 777,
                        membershipLikes: 99
                    },
                    {
                        id: '456',
                        title: 'Music Lovers',
                        description: 'Join and jam together',
                        imageUrl: 'https://picsum.photos/id/100/300/100',
                        categoryId: 'cat2',
                        creatorName: 'Jane Smith',
                        isPrivate: true,
                        requestStatus: null,
                        membershipCount: 225,
                        membershipLikes: 24
                    },
                    {
                        id: '789',
                        title: 'Entertainment Central',
                        description: 'Movies, TV shows, memes & celebrity drama!',
                        imageUrl: 'https://picsum.photos/id/237/300/100',
                        categoryId: 'cat3',
                        creatorName: 'Ava Blaze',
                        isPrivate: false,
                        requestStatus: null,
                        membershipCount: 512,
                        membershipLikes: 64
                    }
                ];
                setCommunities(dummyCommunities);
                // const response = await fetch('/api/home/RightSection');
                // const data = await response.json();

                // if (data.success) {
                //     setCommunities(data.data.communities);
            } catch (error) {
                console.error('Error fetching communities:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCommunities();
    }, []);

    if (isLoading) {
        return (
            <View style={{
                marginBottom: 32,
                paddingHorizontal: 16,
            }}>
                <Text style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#000',
                    marginBottom: 16,
                }}>Communities</Text>
                <Text style={{
                    textAlign: 'center',
                    color: '#666',
                    paddingVertical: 20,
                }}>Loading communities...</Text>
            </View>
        );
    }

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
                {communities.slice(0, 4).map((community) => (
                    <TouchableOpacity
                        key={community.id}
                        style={{
                            width: cardWidth,
                            height: cardHeight,
                            marginBottom: 12,
                            borderRadius: 12,
                            overflow: 'hidden',
                            backgroundColor: '#fff',
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2,
                            },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 3,
                        }}
                        activeOpacity={0.8}
                        onPress={() => router.push('/communities/page')}
                    >
                        <Image
                            source={{ uri: community.imageUrl }}
                            style={{
                                width: '100%',
                                height: 70,
                            }}
                            resizeMode="cover"
                        />
                        <View style={{
                            padding: 8,
                            flex: 1,
                            justifyContent: 'space-between',
                        }}>
                            <Text style={{
                                color: '#000',
                                fontSize: 14,
                                fontWeight: '600',
                                marginBottom: 4,
                            }} numberOfLines={1}>
                                {community.title}
                            </Text>
                            <Text style={{
                                color: '#666',
                                fontSize: 12,
                                marginBottom: 4,
                            }} numberOfLines={2}>
                                {community.description}
                            </Text>
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}>
                                <Text style={{
                                    color: '#22c55e',
                                    fontSize: 11,
                                    fontWeight: '500',
                                }}>
                                    {community.membershipCount?.toLocaleString()} members
                                </Text>
                                {community.isPrivate && (
                                    <View style={{
                                        backgroundColor: '#fef3c7',
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 8,
                                    }}>
                                        <Text style={{
                                            color: '#d97706',
                                            fontSize: 10,
                                            fontWeight: '500',
                                        }}>
                                            Private
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};
