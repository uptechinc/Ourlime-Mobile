import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Event } from '@/types/eventTypes';
import {fetchEvents, fetchCommentsForEvent} from '@/helpers/Events';

// ---------------------------------------------------------------------------
// NOTE: The following Firebase imports and any references to them are commented out.
//       Uncomment (and adapt) them to your React Native Firebase setup.
// ---------------------------------------------------------------------------
// import { auth, db } from '@/lib/firebaseConfig';
// import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
// import { fetchEvents, fetchCommentsForEvent } from '@/helpers/Events';
// ---------------------------------------------------------------------------

// Example of your Event type – adapt as needed


// The shape of each comment in your array – adjust as needed
// interface CommentType {
//   id: string;
//   profileImage?: string;
//   userData?: {
//     firstName?: string;
//     lastName?: string;
//     userName?: string;
//   };
//   comment: string;
//   timestamp: Date;
// }

// Props for EventCommentModal
interface EventCommentModalProps {
  onClose: () => void;
  eventId: string;
}

const EventCommentModal: React.FC<EventCommentModalProps> = ({ onClose, eventId }) => {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, fetch event details
  useEffect(() => {
    const loadEventDetails = async () => {
      try {
        // ---------------------------------------------------------------------
        // Example logic if you have a fetchEvents() function:
        //
        // const fetchedEvents = await fetchEvents();
        // const selectedEvent = fetchedEvents.find(e => e.id === eventId);
        // setEvent(selectedEvent || null);
        // ---------------------------------------------------------------------
      } catch (error) {
        console.error('Error fetching event details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEventDetails();
  }, [eventId]);

  // Load event comments
  useEffect(() => {
    const loadComments = async () => {
      try {
        // ---------------------------------------------------------------------
        // If you have a fetchCommentsForEvent helper:
        //
        // const fetchedComments = await fetchCommentsForEvent(eventId);
        // setComments(fetchedComments);
        // console.log(`Event comments for: ${eventId} `, fetchedComments);
        // ---------------------------------------------------------------------
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    };

    loadComments();
  }, [eventId]);

  // Submit a comment
  const handleCommentSubmit = async () => {
    // if (!auth.currentUser) {
    //   console.error("User is not logged in");
    //   return;
    // }
    if (!comment.trim()) return;

    try {
      // -----------------------------------------------------------------------
      // Example Firestore logic:
      //
      // await addDoc(collection(db, 'eventVariantComments'), {
      //   eventVariantId: eventId,
      //   comment,
      //   userId: auth.currentUser.uid,
      //   timestamp: serverTimestamp(),
      // });
      //
      // // Clear the input
      // setComment('');
      //
      // // Re-fetch comments
      // const updatedComments = await fetchCommentsForEvent(eventId);
      // setComments(updatedComments);
      // -----------------------------------------------------------------------

      Alert.alert('Comment posted', `Your comment: "${comment}"`);
      setComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Error adding comment. Please try again.');
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Overlay */}
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 }}>
        {/* Modal container */}
        <View style={{ backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' }}>
          {/* Close button */}
          <TouchableOpacity style={{ position: 'absolute', right: 12, top: 12, zIndex: 10 }} onPress={onClose}>
            <Text style={{ fontSize: 20, color: '#666' }}>✕</Text>
          </TouchableOpacity>

          {/* Main content layout */}
          <View style={{ flexDirection: 'row', maxHeight: '90%' }}>
            {/* Left side image (only in wide layouts or you can conditionally hide in RN) */}
            {event?.image ? (
              <View style={{ display: 'none', flex: 1 }}>
                <Image
                  source={{ uri: event.image }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* Right side: details & comments */}
            <View style={{ flex: 1, padding: 16 }}>
              {/* Event details */}
              {loading ? (
                <Text style={{ color: '#999' }}>Loading event details...</Text>
              ) : event ? (
                <View style={{ marginBottom: 16 }}>
                  {/* If you want to show the image for mobile widths, you can conditionally render again here */}
                  {event?.image && (
                    <View style={{ display: 'none', marginBottom: 8 }}>
                      <Image
                        source={{ uri: event.image }}
                        style={{ width: '100%', height: 200, borderRadius: 8 }}
                        resizeMode="cover"
                      />
                    </View>
                  )}
                  <Text style={{ fontWeight: '600', fontSize: 16, marginBottom: 4 }}>{event.title}</Text>
                  {event.startDate && event.endDate && (
                    <Text style={{ color: '#555', fontSize: 12 }}>
                      {new Date(event.startDate).toLocaleDateString()} -{' '}
                      {new Date(event.endDate).toLocaleDateString()}
                    </Text>
                  )}
                  {event.location && <Text style={{ color: '#555', fontSize: 12 }}>{event.location}</Text>}
                  {event.summary && <Text style={{ marginTop: 8, color: '#333', fontSize: 14 }}>{event.summary}</Text>}
                </View>
              ) : (
                <Text style={{ color: '#999' }}>Event not found</Text>
              )}

              {/* Comments list */}
              <ScrollView style={{ flex: 1, marginVertical: 8 }}>
                {comments.map((c) => (
                  <View key={c.id} style={{ borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Image
                        source={{ uri: c.profileImage || 'https://via.placeholder.com/40' }}
                        style={{ width: 40, height: 40, borderRadius: 20, marginRight: 8, backgroundColor: '#ccc' }}
                        resizeMode="cover"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14 }}>
                          {c.userData?.firstName} {c.userData?.lastName}{' '}
                          <Text style={{ color: '#999', fontSize: 12 }}>
                            @{c.userData?.userName}
                          </Text>
                        </Text>
                        <Text style={{ color: '#333', fontSize: 14, marginTop: 4 }}>{c.comment}</Text>
                        <Text style={{ color: '#999', fontSize: 10, marginTop: 2 }}>
                          {c.timestamp?.toLocaleString?.()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {/* Input area for new comment */}
              <View style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, marginTop: 8 }}>
                <TextInput
                  style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8, minHeight: 40 }}
                  placeholder="Write your comment..."
                  value={comment}
                  onChangeText={setComment}
                  multiline
                />
                <TouchableOpacity style={{ backgroundColor: '#4CAF50', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 }} onPress={handleCommentSubmit}>
                  <Text style={{ color: '#fff', fontSize: 14 }}>Post</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default EventCommentModal;
