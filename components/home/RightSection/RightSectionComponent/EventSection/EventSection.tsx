import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

type Event = {
    id: string;
    title: string;
    startDate: string;
    image?: string;
};

type EventWithAttendees = Event & { attendees: number };

export const EventsSection = () => {
    const [events, setEvents] = useState<EventWithAttendees[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const loadPopularEvents = async () => {
            try {
                setIsLoading(true);
                // Mock data for now - replace with actual API call
                const mockEvents: EventWithAttendees[] = [
                    {
                        id: '1',
                        title: 'Tech Meetup 2024',
                        startDate: '2024-01-15',
                        attendees: 45,
                        image: 'https://example.com/event1.jpg'
                    },
                    {
                        id: '2',
                        title: 'Design Workshop',
                        startDate: '2024-01-20',
                        attendees: 32,
                        image: 'https://example.com/event2.jpg'
                    },
                    {
                        id: '3',
                        title: 'Startup Networking',
                        startDate: '2024-01-25',
                        attendees: 28
                    }
                ];
                setEvents(mockEvents);
            } catch (err) {
                console.error('Error loading popular events:', err);
                setError('Failed to load events');
            } finally {
                setIsLoading(false);
            }
        };

        loadPopularEvents();
    }, []);

    const formatEventDate = (startDate: string) => {
        const date = new Date(startDate);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
        });
    };

    if (isLoading) {
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
                    }}>Upcoming Events</Text>
                    <TouchableOpacity onPress={() => router.push('/events/page')}>
                        <Text style={{
                            fontSize: 14,
                            color: '#22c55e',
                        }}>View All</Text>
                    </TouchableOpacity>
                </View>
                <View style={{
                    gap: 16,
                }}>
                    {[1, 2, 3].map((i) => (
                        <View key={i} style={{
                            flexDirection: 'row',
                            gap: 12,
                            alignItems: 'center',
                            padding: 8,
                            borderRadius: 8,
                        }}>
                            <View style={{
                                width: 60,
                                height: 60,
                                backgroundColor: '#e5e7eb',
                                borderRadius: 8,
                            }} />
                            <View style={{
                                flex: 1,
                            }}>
                                <View style={{
                                    height: 16,
                                    backgroundColor: '#e5e7eb',
                                    borderRadius: 4,
                                    marginBottom: 8,
                                }} />
                                <View style={{
                                    height: 12,
                                    backgroundColor: '#e5e7eb',
                                    borderRadius: 4,
                                    width: 64,
                                }} />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    if (error) {
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
                    }}>Upcoming Events</Text>
                    <TouchableOpacity onPress={() => router.push('/events/page')}>
                        <Text style={{
                            fontSize: 14,
                            color: '#22c55e',
                        }}>View All</Text>
                    </TouchableOpacity>
                </View>
                <View style={{
                    alignItems: 'center',
                    paddingVertical: 16,
                }}>
                    <Text style={{
                        color: '#6b7280',
                        fontSize: 14,
                    }}>{error}</Text>
                </View>
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
                }}>Popular Events</Text>
                <TouchableOpacity onPress={() => router.push('/events/page')}>
                    <Text style={{
                        fontSize: 14,
                        color: '#22c55e',
                    }}>View All</Text>
                </TouchableOpacity>
            </View>
            <View style={{
                gap: 16,
            }}>
                {events.length === 0 ? (
                    <View style={{
                        alignItems: 'center',
                        paddingVertical: 16,
                    }}>
                        <Text style={{
                            color: '#6b7280',
                            fontSize: 14,
                        }}>No events available</Text>
                    </View>
                ) : (
                    events.map((event) => (
                        <TouchableOpacity 
                            key={event.id} 
                            onPress={() => router.push(`/events/page?id=${event.id}`)}
                            activeOpacity={0.7}
                        >
                            <View style={{
                                flexDirection: 'row',
                                gap: 12,
                                alignItems: 'center',
                                padding: 8,
                                borderRadius: 8,
                            }}>
                                <View style={{
                                    position: 'relative',
                                    width: 60,
                                    height: 60,
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                }}>
                                    {event.image ? (
                                        <Image
                                            source={{ uri: event.image }}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                            }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={{
                                            width: '100%',
                                            height: '100%',
                                            backgroundColor: '#22c55e',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Text style={{
                                                color: '#fff',
                                                fontSize: 12,
                                                fontWeight: '500',
                                                textAlign: 'center',
                                                paddingHorizontal: 4,
                                            }}>
                                                {event.title.substring(0, 2).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    {/* Attendance badge */}
                                    <View style={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -4,
                                        backgroundColor: '#22c55e',
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 12,
                                    }}>
                                        <Text style={{
                                            color: '#000',
                                            fontSize: 12,
                                            fontWeight: '500',
                                        }}>
                                            {event.attendees}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{
                                    flex: 1,
                                    minWidth: 0,
                                }}>
                                    <Text style={{
                                        fontWeight: '500',
                                        fontSize: 14,
                                        color: '#000',
                                        marginBottom: 4,
                                    }} numberOfLines={1}>
                                        {event.title}
                                    </Text>
                                    <Text style={{
                                        color: '#6b7280',
                                        fontSize: 12,
                                        marginBottom: 2,
                                    }}>
                                        {formatEventDate(event.startDate)}
                                    </Text>
                                    <Text style={{
                                        color: '#9ca3af',
                                        fontSize: 12,
                                    }}>
                                        {event.attendees} attending
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </View>
        </View>
    );
};
