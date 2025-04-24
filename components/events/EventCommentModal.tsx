import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ---------------------------------------------------------------------------
// NOTE: The following Firebase imports and any references to them are commented out.
//       Uncomment (and adapt) them to your React Native Firebase setup.
// ---------------------------------------------------------------------------
// import { auth, db } from '@/lib/firebaseConfig';
// import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
// import { fetchEvents, fetchCommentsForEvent } from '@/helpers/Events';
// ---------------------------------------------------------------------------

// Example of your Event type – adapt as needed
interface EventType {
  id: string;
  title: string;
  image?: string;
  summary?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
}

// The shape of each comment in your array – adjust as needed
interface CommentType {
  id: string;
  profileImage?: string;
  userData?: {
    firstName?: string;
    lastName?: string;
    userName?: string;
  };
  comment: string;
  timestamp: Date;
}

// Props for EventCommentModal
interface EventCommentModalProps {
  onClose: () => void;
  eventId: string;
}

const EventCommentModal: React.FC<EventCommentModalProps> = ({ onClose, eventId }) => {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<CommentType[]>([]);
  const [event, setEvent] = useState<EventType | null>(null);
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
      <View style={styles.overlay}>
        {/* Modal container */}
        <View style={styles.modalContainer}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Main content layout */}
          <View style={styles.contentRow}>
            {/* Left side image (only in wide layouts or you can conditionally hide in RN) */}
            {event?.image ? (
              <View style={[styles.imageContainer, { flex: 1 }]}>
                <Image
                  source={{ uri: event.image }}
                  style={styles.eventImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* Right side: details & comments */}
            <View style={[styles.detailsContainer, { flex: 1 }]}>
              {/* Event details */}
              {loading ? (
                <Text style={styles.loadingText}>Loading event details...</Text>
              ) : event ? (
                <View style={styles.eventDetails}>
                  {/* If you want to show the image for mobile widths, you can conditionally render again here */}
                  {event?.image && (
                    <View style={styles.mobileImageWrapper}>
                      <Image
                        source={{ uri: event.image }}
                        style={styles.mobileEventImage}
                        resizeMode="cover"
                      />
                    </View>
                  )}
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.startDate && event.endDate && (
                    <Text style={styles.eventDates}>
                      {new Date(event.startDate).toLocaleDateString()} -{' '}
                      {new Date(event.endDate).toLocaleDateString()}
                    </Text>
                  )}
                  {event.location && <Text style={styles.eventLocation}>{event.location}</Text>}
                  {event.summary && <Text style={styles.eventSummary}>{event.summary}</Text>}
                </View>
              ) : (
                <Text style={styles.notFoundText}>Event not found</Text>
              )}

              {/* Comments list */}
              <ScrollView style={styles.commentsList}>
                {comments.map((c) => (
                  <View key={c.id} style={styles.commentItem}>
                    <View style={styles.commentHeader}>
                      <Image
                        source={{ uri: c.profileImage || 'https://via.placeholder.com/40' }}
                        style={styles.commentAvatar}
                        resizeMode="cover"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.commentAuthor}>
                          {c.userData?.firstName} {c.userData?.lastName}{' '}
                          <Text style={styles.commentUsername}>
                            @{c.userData?.userName}
                          </Text>
                        </Text>
                        <Text style={styles.commentText}>{c.comment}</Text>
                        <Text style={styles.commentTimestamp}>
                          {c.timestamp?.toLocaleString?.()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {/* Input area for new comment */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Write your comment..."
                  value={comment}
                  onChangeText={setComment}
                  multiline
                />
                <TouchableOpacity style={styles.postButton} onPress={handleCommentSubmit}>
                  <Text style={styles.postButtonText}>Post</Text>
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

// Example styling – customize to fit your design
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  contentRow: {
    flexDirection: 'row',
    maxHeight: '90%',
  },
  imageContainer: {
    display: 'none', // If you want to hide on smaller screens, can do conditionally
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  detailsContainer: {
    padding: 16,
  },
  loadingText: {
    color: '#999',
  },
  eventDetails: {
    marginBottom: 16,
  },
  mobileImageWrapper: {
    display: 'none', // For mobile-only usage, conditionally set this to 'flex'
    marginBottom: 8,
  },
  mobileEventImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  eventTitle: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 4,
  },
  eventDates: {
    color: '#555',
    fontSize: 12,
  },
  eventLocation: {
    color: '#555',
    fontSize: 12,
  },
  eventSummary: {
    marginTop: 8,
    color: '#333',
    fontSize: 14,
  },
  notFoundText: {
    color: '#999',
  },
  commentsList: {
    flex: 1,
    marginVertical: 8,
  },
  commentItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#ccc',
  },
  commentAuthor: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  commentUsername: {
    color: '#999',
    fontSize: 12,
  },
  commentText: {
    color: '#333',
    fontSize: 14,
    marginTop: 4,
  },
  commentTimestamp: {
    color: '#999',
    fontSize: 10,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    minHeight: 40,
  },
  postButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});
