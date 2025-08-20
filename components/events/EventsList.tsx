import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { Event } from '@/types/eventTypes';
// import { auth, db } from '@/lib/firebaseConfig';
// import { addDoc, collection, doc, getDoc, getDocs, increment, setDoc, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
// import { Heart, MessageCircle, CheckCircle, Users, X } from 'lucide-react';
import EventCommentModal from './EventCommentModal';
// import { Button } from '@nextui-org/react';
// import Slider from '../comm/Slider';
// import Image from 'next/image';

interface EventsListProps {
    communityVariantId?: string;
    userId: string;
}

export default function EventsList({ communityVariantId, userId }: EventsListProps) {
    const [events, setEvents] = useState<Event[]>([]);
    const [likedEvents, setLikedEvents] = useState<{ [key: string]: boolean }>({});
    const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});
    const [registeredEvents, setRegisteredEvents] = useState<{ [key: string]: boolean }>({});
    const [registrationCounts, setRegistrationCounts] = useState<{ [key: string]: number }>({});
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Add a simple counter for debugging re-renders
    const [renderCount, setRenderCount] = useState(0);

    useEffect(() => {
        const loadEvents = async () => {
            try {
                // TODO: Implement API call for React Native
                // const response = await fetch(
                //     `/api/events/fetch/${communityVariantId ? `?communityVariantId=${communityVariantId}` : ""}`
                // );
                // const result = await response.json();
                // if (result.success) {
                //     setEvents(result.data);
                // } else {
                //     console.error("Error fetching events:", result.error);
                // }
                
                // Temporary mock data for development
                const mockEvents = [
                    {
                        id: '1',
                        title: 'Tech Conference 2024',
                        summary: 'Join us for the biggest tech conference of the year featuring industry leaders and cutting-edge innovations.',
                        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
                        startDate: new Date(Date.now() + 86400000 * 7).toISOString(),
                        endDate: new Date(Date.now() + 86400000 * 8).toISOString(),
                        location: 'Convention Center, Downtown',
                        userId: 'user123',
                        recurrence: 'none',
                        likeCount: 42
                    },
                    {
                        id: '2',
                        title: 'Weekly Community Meetup',
                        summary: 'A casual meetup for community members to network, share ideas, and build connections.',
                        image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1469&q=80',
                        startDate: new Date(Date.now() + 86400000 * 3).toISOString(),
                        endDate: new Date(Date.now() + 86400000 * 3 + 7200000).toISOString(),
                        location: 'Community Center',
                        userId: 'user456',
                        recurrence: 'weekly',
                        likeCount: 18
                    },
                    {
                        id: '3',
                        title: 'Art Workshop',
                        summary: 'Explore your creativity in this hands-on art workshop suitable for all skill levels.',
                        image: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
                        startDate: new Date(Date.now() + 86400000 * 14).toISOString(),
                        endDate: new Date(Date.now() + 86400000 * 14 + 14400000).toISOString(),
                        location: 'Art Studio, Main Street',
                        userId: 'user789',
                        recurrence: 'monthly',
                        likeCount: 25
                    }
                ];
                
                setEvents(mockEvents);
                
                // Initialize like counts from mock data
                const initialLikeCounts: { [key: string]: number } = {};
                const initialRegistrationCounts: { [key: string]: number } = {};
                mockEvents.forEach(event => {
                    initialLikeCounts[event.id] = event.likeCount || 0;
                    initialRegistrationCounts[event.id] = Math.floor(Math.random() * 20) + 5; // Random registration count
                });
                console.log('Initial like counts:', initialLikeCounts);
                console.log('Initial registration counts:', initialRegistrationCounts);
                setLikeCounts(initialLikeCounts);
                setRegistrationCounts(initialRegistrationCounts);
            } catch (error) {
                console.error("Failed to fetch events:", error);
            } finally {
                setLoading(false);
            }
        };

        loadEvents();
    }, [communityVariantId]);

    useEffect(() => {
        if (!userId) return;

        // TODO: Implement Firebase setup for React Native
        // const fetchUserEventData = async () => {
        //     try {
        //         const likesQuery = query(collection(db, 'eventVariantLikes'), where('userId', '==', userId));
        //         const registeredQuery = query(collection(db, 'eventSubscription'), where('userId', '==', userId));
        //         const likeCounterQuery = collection(db, 'eventLikeCounter'); 
        //         const registrationCounterQuery = collection(db, 'eventRegistrationCounter'); 

        //         const [likesSnapshot, registeredSnapshot, likeCountsSnapshot, registrationCountsSnapshot] = await Promise.all([
        //             getDocs(likesQuery),
        //             getDocs(registeredQuery),
        //             getDocs(likeCounterQuery),
        //             getDocs(registrationCounterQuery),
        //         ]);

        //         const likedEventIds: { [key: string]: boolean } = {};
        //         likesSnapshot.docs.forEach(doc => {
        //             likedEventIds[doc.data().eventVariantId] = true;
        //         });

        //         const registeredEventIds: { [key: string]: boolean } = {};
        //         registeredSnapshot.docs.forEach(doc => {
        //             registeredEventIds[doc.data().eventId] = true;
        //         });

        //         const likeCounts: { [key: string]: number } = {};
        //         likeCountsSnapshot.docs.forEach(doc => {
        //             likeCounts[doc.id] = doc.data().like || 0;
        //         });

        //         const registrationCounts: { [key: string]: number } = {};
        //         registrationCountsSnapshot.docs.forEach(doc => {
        //             registrationCounts[doc.id] = doc.data().count || 0;
        //         });

        //         setLikedEvents(likedEventIds);
        //         setRegisteredEvents(registeredEventIds);
        //         setLikeCounts(likeCounts);
        //         setRegistrationCounts(registrationCounts);
        //     } catch (error) {
        //         console.error("Error fetching user event data:", error);
        //     }
        // };

        // fetchUserEventData();

        // TODO: Implement real-time listeners for React Native
        // const likeCountsUnsub = onSnapshot(collection(db, 'eventLikeCounter'), (snapshot) => {
        //     const likeCounts: { [key: string]: number } = {};
        //     snapshot.docs.forEach(doc => {
        //         likeCounts[doc.id] = doc.data().like || 0;
        //     });
        //     setLikeCounts(likeCounts);
        // });

        // const registrationCountsUnsub = onSnapshot(collection(db, 'eventRegistrationCounter'), (snapshot) => {
        //     const registrationCounts: { [key: string]: number } = {};
        //     snapshot.docs.forEach(doc => {
        //         registrationCounts[doc.id] = doc.data().count || 0;
        //     });
        //     setRegistrationCounts(registrationCounts);
        // });

        // return () => {
        //     likeCountsUnsub();
        //     registrationCountsUnsub();
        // };
    }, [userId]);

    const handleLike = async (eventId: string) => {
        if (!userId) return;

        try {
            const isCurrentlyLiked = !!likedEvents[eventId];
            const currentCount = likeCounts[eventId] || 0;

            console.log(`\n=== LIKE BUTTON CLICKED ===`);
            console.log(`Event ID: ${eventId}`);
            console.log(`Currently liked: ${isCurrentlyLiked}`);
            console.log(`Current count: ${currentCount}`);
            console.log(`User ID: ${userId}`);

            // Force a re-render counter update
            setRenderCount(prev => prev + 1);

            if (isCurrentlyLiked) {
                // Unlike the event
                console.log(`🔴 UNLIKING event ${eventId}`);
                
                // Update liked state
                setLikedEvents((prev) => {
                    const updated = { ...prev };
                    delete updated[eventId];
                    console.log('📝 New likedEvents state:', updated);
                    return updated;
                });
                
                // Update count
                const newCount = Math.max(0, currentCount - 1);
                setLikeCounts((prev) => {
                    const updated = { ...prev, [eventId]: newCount };
                    console.log('📊 New likeCounts state:', updated);
                    return updated;
                });
                
                console.log(`✅ Unlike completed: ${currentCount} → ${newCount}`);
            } else {
                // Like the event
                console.log(`💖 LIKING event ${eventId}`);
                
                // Update liked state
                setLikedEvents((prev) => {
                    const updated = { ...prev, [eventId]: true };
                    console.log('📝 New likedEvents state:', updated);
                    return updated;
                });
                
                // Update count
                const newCount = currentCount + 1;
                setLikeCounts((prev) => {
                    const updated = { ...prev, [eventId]: newCount };
                    console.log('📊 New likeCounts state:', updated);
                    return updated;
                });
                
                console.log(`✅ Like completed: ${currentCount} → ${newCount}`);
            }

            console.log(`=== END LIKE ACTION ===\n`);

            // TODO: Implement API call to persist likes when Firebase is set up
        } catch (error) {
            console.error("Error liking event:", error);
        }
    };

    const handleRegisterForEvent = async (eventId: string) => {
        if (!userId) return;

        // TODO: Implement Firebase registration functionality for React Native
        try {
            // If already registered, unregister
            if (registeredEvents[eventId]) {
                // Find and delete the subscription document
                // const subscriptionQuery = query(
                //     collection(db, 'eventSubscription'),
                //     where('userId', '==', userId),
                //     where('eventId', '==', eventId)
                // );
                // const subscriptionSnapshot = await getDocs(subscriptionQuery);
                
                // if (!subscriptionSnapshot.empty) {
                //     await deleteDoc(subscriptionSnapshot.docs[0].ref);
                    
                //     // Decrement the registration counter
                //     const registrationCounterRef = doc(db, 'eventRegistrationCounter', eventId);
                //     await updateDoc(registrationCounterRef, { count: increment(-1) });
                    
                    setRegisteredEvents((prev) => {
                        const updated = { ...prev };
                        delete updated[eventId];
                        return updated;
                    });
                // }
            } else {
                // Register for the event
                // await addDoc(collection(db, 'eventSubscription'), {
                //     isAttending: true,
                //     userId: userId,
                //     eventId: eventId,
                // });

                // const registrationCounterRef = doc(db, 'eventRegistrationCounter', eventId);
                // const registrationCounterSnap = await getDoc(registrationCounterRef);

                // if (registrationCounterSnap.exists()) {
                //     await updateDoc(registrationCounterRef, { count: increment(1) });
                // } else {
                //     await setDoc(registrationCounterRef, { count: 1 });
                // }

                setRegisteredEvents((prev) => ({ ...prev, [eventId]: true }));
            }
        } catch (error) {
            console.error("Error managing event registration:", error);
        }
    };

    const openCommentsModal = (eventId: string) => {
        setSelectedEventId(eventId);
        setIsCommentModalOpen(true);
    };

    if (loading) {
        return (
            <View style={{ width: '100%', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, textAlign: 'center', color: '#666' }}>Loading events...</Text>
            </View>
        );
    }

    return (
        <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#000' }}>Community Events</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                {events.map((event) => {
                    if (!event.id) return null; // Skip events without ID
                    
                    return (
                        <View key={event.id} style={{
                            width: 300,
                            marginRight: 16,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            borderRadius: 8,
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2,
                            },
                            shadowOpacity: 0.1,
                            shadowRadius: 3.84,
                            elevation: 5,
                            backgroundColor: '#fff',
                        }}>
                            {event.image && (
                                <Image
                                    source={{ uri: event.image }}
                                    style={{
                                        width: '100%',
                                        height: 192,
                                        borderRadius: 8,
                                        marginBottom: 12,
                                    }}
                                    resizeMode="cover"
                                />
                            )}
                            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#000' }}>{event.title}</Text>
                            <Text style={{ fontSize: 14, color: '#666', marginBottom: 8, lineHeight: 20 }}>{event.summary}</Text>

                            {/* Recurrence Indicator */}
                            {event.recurrence && event.recurrence !== "none" && (
                                <Text style={{ fontSize: 12, fontWeight: '500', color: '#10b981', marginBottom: 8 }}>
                                    🔄 Repeats {event.recurrence.charAt(0).toUpperCase() + event.recurrence.slice(1)}
                                </Text>
                            )}

                            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                                {new Date(event.startDate).toLocaleDateString()} - 
                                {new Date(event.endDate).toLocaleDateString()}
                            </Text>
                            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>{event.location}</Text>

                            {event.userId !== userId && (
                                <View style={{ marginTop: 16 }}>
                                    <TouchableOpacity 
                                        onPress={() => event.id && handleRegisterForEvent(event.id)}
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 6,
                                            backgroundColor: event.id && registeredEvents[event.id] ? '#ef4444' : '#10b981',
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: '500',
                                            textAlign: 'center',
                                            color: event.id && registeredEvents[event.id] ? '#fff' : '#000',
                                        }}>
                                            {event.id && registeredEvents[event.id] ? 'Unregister' : 'Register'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                                <TouchableOpacity 
                                    onPress={() => event.id && handleLike(event.id)}
                                    style={{ 
                                        flex: 1, 
                                        alignItems: 'center',
                                        paddingVertical: 8,
                                        paddingHorizontal: 4,
                                        borderRadius: 4,
                                        backgroundColor: event.id && likedEvents[event.id] ? '#f0f9ff' : 'transparent'
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={{
                                        fontSize: 12,
                                        color: event.id && likedEvents[event.id] ? '#ef4444' : '#6b7280',
                                        fontWeight: event.id && likedEvents[event.id] ? '600' : '400'
                                    }}>
                                        {(() => {
                                            const isLiked = !!(event.id && likedEvents[event.id]);
                                            const count = event.id ? (likeCounts[event.id] ?? 0) : 0;
                                            console.log(`🎨 RENDER #${renderCount} - Event ${event.id}: liked=${isLiked}, count=${count}, likedEvents:`, likedEvents, 'likeCounts:', likeCounts);
                                            return `${isLiked ? '❤️' : '🤍'} ${count} Like${count !== 1 ? 's' : ''}`;
                                        })()}
                                    </Text>
                                </TouchableOpacity>

                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: '#374151' }}>
                                        👥 {event.id ? (registrationCounts[event.id] || 0) : 0} Registered
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => event.id && openCommentsModal(event.id)}
                                    style={{ flex: 1, alignItems: 'center' }}
                                >
                                    <Text style={{ fontSize: 12, color: '#374151' }}>
                                        💬 Comment
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            {isCommentModalOpen && selectedEventId && (
                <EventCommentModal onClose={() => setIsCommentModalOpen(false)} eventId={selectedEventId} />
            )}
        </View>
    );
}

