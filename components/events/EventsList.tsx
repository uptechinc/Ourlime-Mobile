import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ---------------------------------------------------------------------------
// NOTE: The following Firebase-related imports and references are commented out.
//       Uncomment and adapt to your RN Firebase project if needed.
//
// import { auth, db } from '@/lib/firebaseConfig';
// import { addDoc, collection, doc, getDoc, getDocs, increment, setDoc, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
// ---------------------------------------------------------------------------

// Suppose you have an Event type (adjust as needed).
// Or use the interface from your original code directly.
interface EventType {
  id: string;
  image?: string;
  title: string;
  summary?: string;
  recurrence?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  userId?: string;
}

// For demonstration, let's create a stub for your "EventCommentModal"
const EventCommentModal = ({ onClose, eventId }: { onClose: () => void; eventId: string }) => {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <Text style={{ marginBottom: 10 }}>Comment Modal for eventId: {eventId}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeModalButton}>
          <Text style={{ color: '#fff' }}>Close Modal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface EventsListProps {
  communityVariantId?: string;
  userId: string;
}

export default function EventsList({ communityVariantId, userId }: EventsListProps) {
  const [events, setEvents] = useState<EventType[]>([]);
  const [likedEvents, setLikedEvents] = useState<{ [key: string]: boolean }>({});
  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});
  const [registeredEvents, setRegisteredEvents] = useState<{ [key: string]: boolean }>({});
  const [registrationCounts, setRegistrationCounts] = useState<{ [key: string]: number }>({});
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Example: Load events from an external source
  useEffect(() => {
    const loadEvents = async () => {
      try {
        // In a real RN app, you might do:
        //
        // const response = await fetch(
        //   `/api/events/fetch/${communityVariantId ? `?communityVariantId=${communityVariantId}` : ''}`
        // );
        // const result = await response.json();
        //
        // if (result.success) {
        //   setEvents(result.data);
        // } else {
        //   console.error('Error fetching events:', result.error);
        // }
        //
        // For now, let's just set up some mock data:
        const mockEvents: EventType[] = [
          {
            id: 'evt1',
            image: 'https://picsum.photos/400/200',
            title: 'React Native Expo Event',
            summary: 'Learn all about Expo!',
            recurrence: 'weekly',
            startDate: '2024-01-20T00:00:00Z',
            endDate: '2024-01-20T00:00:00Z',
            location: 'Online',
            userId: 'owner123',
          },
          {
            id: 'evt2',
            image: 'https://picsum.photos/400/200?random=2',
            title: 'Firebase Workshop',
            summary: 'Deep dive into Firebase for RN.',
            recurrence: 'none',
            startDate: '2024-02-10T00:00:00Z',
            endDate: '2024-02-11T00:00:00Z',
            location: 'San Francisco',
            userId: 'owner456',
          },
        ];
        setEvents(mockEvents);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [communityVariantId]);

  // Example: fetch user-specific data (likes, registrations)
  useEffect(() => {
    if (!userId) return;

    const fetchUserEventData = async () => {
      try {
        // ---------------------------------------------------------------------
        // // For example:
        // const likesQuery = query(collection(db, 'eventVariantLikes'), where('userId', '==', userId));
        // const registeredQuery = query(collection(db, 'eventSubscription'), where('userId', '==', userId));
        // const likeCounterQuery = collection(db, 'eventLikeCounter'); 
        // const registrationCounterQuery = collection(db, 'eventRegistrationCounter'); 
        //
        // const [likesSnapshot, registeredSnapshot, likeCountsSnapshot, registrationCountsSnapshot] =
        //   await Promise.all([
        //     getDocs(likesQuery),
        //     getDocs(registeredQuery),
        //     getDocs(likeCounterQuery),
        //     getDocs(registrationCounterQuery),
        //   ]);
        //
        // // ... build up likedEvents, registeredEvents, etc. from Firestore docs ...
        // setLikedEvents(...);
        // setRegisteredEvents(...);
        // setLikeCounts(...);
        // setRegistrationCounts(...);
        // ---------------------------------------------------------------------
      } catch (error) {
        console.error('Error fetching user event data:', error);
      }
    };

    fetchUserEventData();

    // Example real-time listeners can also be hashed out or replaced for RN
    // const likeCountsUnsub = onSnapshot(collection(db, 'eventLikeCounter'), (snapshot) => {
    //   // ...
    //   setLikeCounts(...);
    // });
    // const registrationCountsUnsub = onSnapshot(collection(db, 'eventRegistrationCounter'), (snapshot) => {
    //   // ...
    //   setRegistrationCounts(...);
    // });
    //
    // return () => {
    //   // likeCountsUnsub();
    //   // registrationCountsUnsub();
    // };
  }, [userId]);

  const handleLike = async (eventId: string) => {
    if (!userId) return;
    try {
      // If already liked, unlike; otherwise, like.
      // Similarly, update the likeCounts in local state
      setLikedEvents((prev) => {
        const updated = { ...prev };
        if (updated[eventId]) {
          delete updated[eventId];
          setLikeCounts((prevCounts) => ({ ...prevCounts, [eventId]: (prevCounts[eventId] || 1) - 1 }));
        } else {
          updated[eventId] = true;
          setLikeCounts((prevCounts) => ({ ...prevCounts, [eventId]: (prevCounts[eventId] || 0) + 1 }));
        }
        return updated;
      });

      // ---------------------------------------------------------------------
      // // Firebase logic example:
      // const likeRef = doc(db, 'eventVariantLikes', `${eventId}_${userId}`);
      // const likeCounterRef = doc(db, 'eventLikeCounter', eventId);
      //
      // if (likedEvents[eventId]) {
      //   await deleteDoc(likeRef);
      //   await updateDoc(likeCounterRef, { like: increment(-1) });
      // } else {
      //   await setDoc(likeRef, { eventVariantId: eventId, userId: userId });
      //   const likeCounterSnap = await getDoc(likeCounterRef);
      //   if (likeCounterSnap.exists()) {
      //     await updateDoc(likeCounterRef, { like: increment(1) });
      //   } else {
      //     await setDoc(likeCounterRef, { like: 1, eventVariantId: eventId });
      //   }
      // }
      // ---------------------------------------------------------------------
    } catch (error) {
      console.error('Error liking event:', error);
      Alert.alert('Error', 'Error liking event');
    }
  };

  const handleRegisterForEvent = async (eventId: string) => {
    if (!userId) return;
    try {
      // If user is already registered, unregister; else register
      setRegisteredEvents((prev) => {
        const updated = { ...prev };
        if (updated[eventId]) {
          delete updated[eventId];
          setRegistrationCounts((prevCounts) => ({
            ...prevCounts,
            [eventId]: (prevCounts[eventId] || 1) - 1,
          }));
        } else {
          updated[eventId] = true;
          setRegistrationCounts((prevCounts) => ({
            ...prevCounts,
            [eventId]: (prevCounts[eventId] || 0) + 1,
          }));
        }
        return updated;
      });

      // ---------------------------------------------------------------------
      // // Firebase logic:
      // if (registeredEvents[eventId]) {
      //   // Find and delete the subscription doc...
      //   // decrement the registration counter
      // } else {
      //   // addDoc to eventSubscription
      //   // increment the registration counter
      // }
      // ---------------------------------------------------------------------
    } catch (error) {
      console.error('Error managing event registration:', error);
      Alert.alert('Error', 'Error managing event registration');
    }
  };

  const openCommentsModal = (eventId: string) => {
    setSelectedEventId(eventId);
    setIsCommentModalOpen(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.headerText}>Community Events</Text>

      {/* Horizontal slider approximation */}
      <ScrollView horizontal style={styles.sliderContainer}>
        {events.map((event) => (
          <View key={event.id} style={styles.card}>
            {event.image ? (
              <Image
                source={{ uri: event.image }}
                style={styles.eventImage}
                resizeMode="cover"
              />
            ) : null}

            <Text style={styles.cardTitle}>{event.title}</Text>
            <Text style={styles.cardSummary}>{event.summary}</Text>

            {/* Recurrence Indicator */}
            {event.recurrence && event.recurrence !== 'none' && (
              <Text style={styles.recurrenceText}>
                🔄 Repeats{' '}
                {event.recurrence.charAt(0).toUpperCase() + event.recurrence.slice(1)}
              </Text>
            )}

            <Text style={styles.cardDate}>
              {event.startDate
                ? new Date(event.startDate).toLocaleDateString()
                : 'No start date'}{' '}
              -{' '}
              {event.endDate
                ? new Date(event.endDate).toLocaleDateString()
                : 'No end date'}
            </Text>
            <Text style={styles.cardLocation}>{event.location}</Text>

            {/* Register / Unregister button */}
            {event.userId !== userId && (
              <TouchableOpacity
                style={[
                  styles.registerButton,
                  registeredEvents[event.id] ? styles.unregisterButton : styles.registerButtonStyle,
                ]}
                onPress={() => handleRegisterForEvent(event.id)}
              >
                <Text style={styles.registerButtonText}>
                  {registeredEvents[event.id] ? 'Unregister' : 'Register'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.actionsRow}>
              {/* Like button */}
              <TouchableOpacity
                onPress={() => handleLike(event.id)}
                style={styles.actionItem}
              >
                <Text
                  style={[
                    styles.actionText,
                    { color: likedEvents[event.id] ? 'green' : '#444' },
                  ]}
                >
                  ❤️ {likeCounts[event.id] || 0}
                </Text>
              </TouchableOpacity>

              {/* Registered count */}
              <View style={styles.actionItem}>
                <Text style={styles.actionText}>
                  👥 {registrationCounts[event.id] || 0}
                </Text>
              </View>

              {/* Comment button */}
              <TouchableOpacity
                onPress={() => openCommentsModal(event.id)}
                style={styles.actionItem}
              >
                <Text style={[styles.actionText, { color: '#444' }]}>💬 Comment</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Comment Modal */}
      {isCommentModalOpen && selectedEventId && (
        <EventCommentModal
          onClose={() => setIsCommentModalOpen(false)}
          eventId={selectedEventId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sliderContainer: {
    // Horizontal slider container
  },
  card: {
    width: 250,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    elevation: 2, // Adds a little shadow on Android
  },
  eventImage: {
    width: '100%',
    height: 120,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#ccc',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSummary: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
  },
  recurrenceText: {
    fontSize: 12,
    color: 'green',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#555',
  },
  cardLocation: {
    fontSize: 12,
    color: '#777',
    marginBottom: 8,
  },
  registerButton: {
    marginTop: 8,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  registerButtonStyle: {
    backgroundColor: '#90EE90', // light green
  },
  unregisterButton: {
    backgroundColor: '#ff7373', // light red
  },
  registerButtonText: {
    color: '#000',
    fontSize: 14,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'space-around',
  },
  actionItem: {
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
  },

  // Modal overlay & container for the comment modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  closeModalButton: {
    backgroundColor: '#999',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
    alignSelf: 'flex-end',
  },
});
