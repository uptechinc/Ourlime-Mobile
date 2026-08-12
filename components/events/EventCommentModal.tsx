import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { X, Send, MessageCircle, Reply } from 'lucide-react-native';
import { Event } from '@/types/eventTypes';

type Comment = {
  id: string;
  profileImage?: string;
  userData?: {
    firstName?: string;
    lastName?: string;
    userName?: string;
  };
  comment: string;
  timestamp: Date;
  replies: Comment[];
};

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
type EventCommentModalProps = {
  onClose: () => void;
  eventId: string;
};

  const EventCommentModal = ({ onClose, eventId }: EventCommentModalProps) => {
    const [comment, setComment] = useState('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
  
    const { width, height } = Dimensions.get('window');
    const modalWidth = Math.min(width * 0.9, 400);
    const modalHeight = height * 0.8;
  
    // Load dummy event data
    useEffect(() => {
      const loadEventDetails = async () => {
        try {
          // Mock event data
          const mockEvent: Event = {
            id: eventId,
            title: 'Tech Conference 2024',
            summary: 'Join us for an exciting tech conference featuring the latest innovations in AI, blockchain, and web development.',
            startDate: '2024-03-15',
            endDate: '2024-03-17',
            location: 'Convention Center, Downtown',
            userId: 'user1',
            likeCount: 0,
            recurrence: 'once',
          };
          setEvent(mockEvent);
        } catch (error) {
          console.error('Error fetching event details:', error);
        } finally {
          setLoading(false);
        }
      };
  
      loadEventDetails();
    }, [eventId]);
  
    // Load dummy comments
    useEffect(() => {
      const loadComments = async () => {
        try {
          // Mock comments with replies
          const mockComments: Comment[] = [
            {
              id: '1',
              comment: 'This looks like an amazing event! Can\'t wait to attend and learn about the latest tech trends.',
              timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
              userData: {
                firstName: 'Sarah',
                lastName: 'Johnson',
                userName: 'sarahj'
              },
              replies: [
                {
                  id: '1-1',
                  comment: 'Same here! The speaker lineup looks incredible.',
                  timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                  userData: {
                    firstName: 'Mike',
                    lastName: 'Chen',
                    userName: 'mikec'
                  },
                  replies: []
                },
                {
                  id: '1-2',
                  comment: 'I\'m particularly excited about the AI sessions!',
                  timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
                  userData: {
                    firstName: 'Alex',
                    lastName: 'Rodriguez',
                    userName: 'alexr'
                  },
                  replies: []
                }
              ]
            },
            {
              id: '2',
              comment: 'I\'ve been to similar events before. Highly recommended! The networking opportunities are fantastic.',
              timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
              userData: {
                firstName: 'David',
                lastName: 'Wilson',
                userName: 'davidw'
              },
              replies: [
                {
                  id: '2-1',
                  comment: 'What was your favorite part of the previous events?',
                  timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                  userData: {
                    firstName: 'Emma',
                    lastName: 'Brown',
                    userName: 'emmab'
                  },
                  replies: []
                }
              ]
            },
            {
              id: '3',
              comment: 'Is there a student discount available for this event?',
              timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
              userData: {
                firstName: 'Lisa',
                lastName: 'Garcia',
                userName: 'lisag'
              },
              replies: []
            },
            {
              id: '4',
              comment: 'The venue is perfect! Easy to reach by public transport.',
              timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
              userData: {
                firstName: 'Tom',
                lastName: 'Anderson',
                userName: 'toma'
              },
              replies: []
            }
          ];
          setComments(mockComments);
        } catch (error) {
          console.error('Error fetching comments:', error);
        }
      };
  
      loadComments();
    }, [eventId]);
  
    const handleCommentSubmit = async () => {
      if (!comment.trim()) return;
  
      try {
        const newComment: Comment = {
          id: Date.now().toString(),
          comment: comment.trim(),
          timestamp: new Date(),
          userData: {
            firstName: 'You',
            lastName: '',
            userName: 'currentuser'
          },
          replies: []
        };
        
        setComments(prev => [newComment, ...prev]);
        setComment('');
      } catch (error) {
        console.error('Error adding comment:', error);
        Alert.alert('Error', 'Failed to post comment. Please try again.');
      }
    };
  
    const handleReplySubmit = async (parentCommentId: string) => {
      if (!replyText.trim()) return;
  
      try {
        const newReply: Comment = {
          id: `${parentCommentId}-${Date.now()}`,
          comment: replyText.trim(),
          timestamp: new Date(),
          userData: {
            firstName: 'You',
            lastName: '',
            userName: 'currentuser'
          },
          replies: []
        };
  
        setComments(prev => 
          prev.map(comment => 
            comment.id === parentCommentId 
              ? { ...comment, replies: [...comment.replies, newReply] }
              : comment
          )
        );
        
        setReplyText('');
        setReplyingTo(null);
      } catch (error) {
        console.error('Error adding reply:', error);
        Alert.alert('Error', 'Failed to post reply. Please try again.');
      }
    };
  
    const renderComment = (comment: Comment, isReply = false) => (
      <View
        key={comment.id}
        style={{
          flexDirection: 'row',
          marginBottom: isReply ? 8 : 16,
          paddingBottom: isReply ? 8 : 16,
          borderBottomWidth: isReply ? 0 : 1,
          borderBottomColor: '#F3F4F6',
          marginLeft: isReply ? 20 : 0,
          paddingLeft: isReply ? 12 : 0,
          borderLeftWidth: isReply ? 2 : 0,
          borderLeftColor: '#E5E7EB',
        }}
      >
        <View
          style={{
            width: isReply ? 32 : 40,
            height: isReply ? 32 : 40,
            borderRadius: isReply ? 16 : 20,
            backgroundColor: '#E5E7EB',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ 
            color: '#6B7280', 
            fontWeight: '600', 
            fontSize: isReply ? 12 : 16 
          }}>
            {comment.userData?.firstName?.[0] || 'U'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ 
              fontSize: isReply ? 12 : 14, 
              fontWeight: '600', 
              color: '#1F2937' 
            }}>
              {comment.userData?.firstName} {comment.userData?.lastName}
            </Text>
            {comment.userData?.userName && (
              <Text style={{ 
                fontSize: 10, 
                color: '#6B7280', 
                marginLeft: 6 
              }}>
                @{comment.userData.userName}
              </Text>
            )}
          </View>
          <Text style={{ 
            fontSize: isReply ? 12 : 14, 
            color: '#374151', 
            lineHeight: isReply ? 16 : 20 
          }}>
            {comment.comment}
          </Text>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            marginTop: 4 
          }}>
            <Text style={{ 
              fontSize: isReply ? 10 : 12, 
              color: '#9CA3AF' 
            }}>
              {comment.timestamp.toLocaleString()}
            </Text>
            {!isReply && (
              <TouchableOpacity
                onPress={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                style={{ marginLeft: 12, flexDirection: 'row', alignItems: 'center' }}
              >
                <Reply size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                <Text style={{ 
                  fontSize: 12, 
                  color: '#3B82F6', 
                  fontWeight: '500' 
                }}>
                  {replyingTo === comment.id ? 'Cancel' : 'Reply'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
  
          {/* Reply Input */}
          {replyingTo === comment.id && (
            <View style={{ 
              marginTop: 8, 
              backgroundColor: '#F8FAFC', 
              borderRadius: 8, 
              padding: 8 
            }}>
              <TextInput
                style={{
                  fontSize: 12,
                  color: '#374151',
                  backgroundColor: '#fff',
                  borderRadius: 6,
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  marginBottom: 6,
                }}
                placeholder="Write a reply..."
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  onPress={() => {
                    setReplyingTo(null);
                    setReplyText('');
                  }}
                  style={{ marginRight: 8 }}
                >
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleReplySubmit(comment.id)}
                  disabled={!replyText.trim()}
                  style={{
                    backgroundColor: replyText.trim() ? '#3B82F6' : '#9CA3AF',
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#fff' }}>Reply</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
  
          {/* Render Replies */}
          {comment.replies.map((reply) => renderComment(reply, true))}
        </View>
      </View>
    );
  
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        {/* Overlay */}
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: 20
        }}>
          {/* Modal container */}
          <View style={{ 
            width: modalWidth,
            height: modalHeight,
            backgroundColor: '#fff', 
            borderRadius: 16, 
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
              backgroundColor: '#F8FAFC',
            }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
                  Comments
                </Text>
                {event && (
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    {event.title}
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                onPress={onClose}
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: 20,
                  padding: 6,
                }}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
  
            {/* Comments List */}
            <ScrollView 
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {loading ? (
                <View style={{ alignItems: 'center', padding: 40 }}>
                  <Text style={{ color: '#6B7280' }}>Loading comments...</Text>
                </View>
              ) : comments.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 40 }}>
                  <MessageCircle size={48} color="#9CA3AF" />
                  <Text style={{ color: '#6B7280', marginTop: 8, fontSize: 16 }}>
                    No comments yet
                  </Text>
                  <Text style={{ color: '#9CA3AF', marginTop: 4, fontSize: 14 }}>
                    Be the first to comment!
                  </Text>
                </View>
              ) : (
                <View style={{ padding: 16 }}>
                  {comments.map((comment) => renderComment(comment))}
                </View>
              )}
            </ScrollView>
  
            {/* Comment Input */}
            <View style={{
              backgroundColor: '#F8FAFC',
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
              padding: 16,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: '#D1D5DB',
              }}>
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: '#374151',
                    maxHeight: 80,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                  placeholder="Write a comment..."
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  onPress={handleCommentSubmit}
                  disabled={!comment.trim()}
                  style={{
                    marginLeft: 8,
                    backgroundColor: comment.trim() ? '#3B82F6' : '#9CA3AF',
                    borderRadius: 8,
                    padding: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Send size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

export default EventCommentModal;
