import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
// import { auth } from '@/lib/firebaseConfig'; // TODO: Setup Firebase later
// import toast from 'react-hot-toast'; // TODO: Setup toast notifications later
import { X, Send, Smile } from 'lucide-react-native';

interface Comment {
    id: string;
    content: string;
    userId: string;
    reelId: string;
    createdAt: any;
    user: {
        id: string;
        userName: string;
        profileImage?: string;
    };
}

interface CommentModalProps {
    reelId: string;
    isOpen: boolean;
    onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: 'white',
    width: '100%',
    maxHeight: screenHeight * 0.8,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
  },
  debugInfo: {
    padding: 8,
    backgroundColor: '#fef3c7',
  },
  debugText: {
    fontSize: 12,
    color: '#374151',
  },
  commentsContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 128,
  },
  emptyContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  commentUsername: {
    fontWeight: '600',
    marginRight: 8,
  },
  commentTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  commentText: {
    color: '#1f2937',
    marginTop: 4,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  commentAction: {
    fontSize: 12,
    color: '#6b7280',
  },
  debugButtons: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    gap: 8,
  },
  debugButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  debugButtonText: {
    fontSize: 12,
    color: 'white',
  },
  inputContainer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: 14,
  },
  emojiButton: {
    marginRight: 8,
  },
  submitButton: {
    padding: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  loginPrompt: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  spinner: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderTopColor: 'transparent',
    borderRadius: 10,
  },
});

export default function CommentModal({ reelId, isOpen, onClose }: CommentModalProps) {
    console.log('🔥 CommentModal component loaded!', { reelId, isOpen });
    
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userProfileImage, setUserProfileImage] = useState<string>('');
    const commentInputRef = useRef<TextInput>(null);
    const commentsContainerRef = useRef<ScrollView>(null);

    // TODO: Monitor auth state changes when Firebase is setup
    // useEffect(() => {
    //     const unsubscribe = auth.onAuthStateChanged((user) => {
    //         setCurrentUser(user);
    //         if (user) {
    //             // Fetch user profile image from Firestore
    //             fetchUserProfileImage(user.uid);
    //         }
    //     });

    //     return () => unsubscribe();
    // }, []);

    // TODO: Implement when Firebase is setup
    // const fetchUserProfileImage = async (userId: string) => {
    //     try {
    //         const response = await fetch(`/api/profile/header?userId=${userId}`);
    //         const data = await response.json();
    //         if (data.success && data.profileImage) {
    //             setUserProfileImage(data.profileImage);
    //         }
    //     } catch (error) {
    //         console.error('Error fetching user profile image:', error);
    //     }
    // };

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && commentInputRef.current) {
            setTimeout(() => {
                commentInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    const fetchComments = useCallback(async () => {
        if (!reelId) return;
        
        try {
            setLoading(true);
            console.log('Fetching comments for reel:', reelId);
            
            const response = await fetch(`/api/reels/${reelId}/comments`);
            const data = await response.json();
            
            console.log('Comments API response:', data);
            
            if (data.success) {
                setComments(data.comments || []);
            } else {
                console.error('Failed to fetch comments:', data.message);
                Alert.alert('Error', 'Failed to load comments');
            }
        } catch (error) {
            console.error('Error fetching comments:', error);
            Alert.alert('Error', 'Failed to load comments');
        } finally {
            setLoading(false);
        }
    }, [reelId]);

    // Fetch comments when modal opens
    useEffect(() => {
        if (isOpen && reelId) {
            fetchComments();
        }
    }, [isOpen, reelId, fetchComments]);

    // Scroll to bottom when new comments are added
    useEffect(() => {
        if (commentsContainerRef.current) {
            commentsContainerRef.current.scrollToEnd({ animated: true });
        }
    }, [comments]);

    const handleSubmit = async (e: React.FormEvent) => {
        console.log('🔥 FORM SUBMIT TRIGGERED!'); // This should always show if form submit works
        e.preventDefault();
        
        console.log('🚀 Submitting comment...', { 
            currentUser: !!currentUser, 
            currentUserUid: currentUser?.uid,
            newComment: newComment.trim(), 
            reelId,
            commentLength: newComment.trim().length
        });
        
        if (!currentUser) {
            console.error('❌ No current user');
            Alert.alert('Error', 'Please log in to comment');
            return;
        }

        if (!newComment.trim()) {
            console.error('❌ Empty comment');
            Alert.alert('Error', 'Please enter a comment');
            return;
        }

        if (!reelId) {
            console.error('❌ No reel ID');
            Alert.alert('Error', 'Invalid reel ID');
            return;
        }

        setSubmitting(true);

        try {
            const apiUrl = `/api/reels/${reelId}/comments`;
            const payload = {
                content: newComment.trim(),
                userId: currentUser.uid,
            };

            console.log('📡 Making API request to:', apiUrl);
            console.log('📦 Request payload:', payload);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            console.log('📬 API response status:', response.status);
            console.log('📬 API response ok:', response.ok);
            
            let data;
            try {
                data = await response.json();
                console.log('📄 API response data:', data);
            } catch (parseError) {
                console.error('❌ Failed to parse response JSON:', parseError);
                throw new Error('Invalid response format from server');
            }

            if (!response.ok) {
                console.error('❌ API response not ok:', response.status, data);
                throw new Error(data.message || `Failed to add comment (${response.status})`);
            }

            if (!data.success) {
                console.error('❌ API returned success: false:', data);
                throw new Error(data.message || 'Server returned success: false');
            }

            console.log('✅ Comment added successfully');
            setNewComment('');
            Alert.alert('Success', 'Comment added!');
            
            // Refresh comments to get the latest data
            await fetchComments();

        } catch (error) {
            console.error('❌ Error adding comment:', error);
            
            // More specific error messages
            if (error instanceof TypeError && error.message.includes('fetch')) {
                Alert.alert('Error', 'Network error: Unable to connect to server');
            } else if (error instanceof Error) {
                Alert.alert('Error', `Failed to add comment: ${error.message}`);
            } else {
                Alert.alert('Error', 'Unknown error occurred while adding comment');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const formatTimeAgo = (timestamp: any) => {
        if (!timestamp) return 'Just now';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    if (!isOpen) return null;

    return (
        <Modal
            visible={isOpen}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Comments</Text>
                        <TouchableOpacity 
                            onPress={onClose}
                            style={styles.closeButton}
                        >
                            <X size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>
                
                    {/* Debug Info - ALWAYS SHOW FOR TESTING */}
                    <View style={styles.debugInfo}>
                        <Text style={styles.debugText}>
                            User: {currentUser ? 'Logged in' : 'Not logged in'} |
                            UID: {currentUser?.uid} |
                            Email: {currentUser?.email} |
                            Reel ID: {reelId} | 
                            Comments: {comments.length} |
                            Modal Version: 2.0
                        </Text>
                    </View>
                
                    {/* Comments List */}
                    <ScrollView 
                        ref={commentsContainerRef}
                        style={styles.commentsContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#10b981" />
                            </View>
                        ) : comments.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No comments yet</Text>
                                <Text style={styles.emptySubtext}>Be the first to comment!</Text>
                            </View>
                        ) : (
                            comments.map((comment) => (
                                <View key={comment.id} style={styles.commentItem}>
                                    {/* <Image 
                                        source={{ uri: comment.user.profileImage || '/images/avatar.jpg' }} 
                                        style={styles.commentAvatar}
                                        defaultSource={require('@/assets/images/avatar.jpg')}
                                    /> */}
                                    <View style={styles.commentContent}>
                                        <View style={styles.commentHeader}>
                                            <Text style={styles.commentUsername}>
                                                {comment.user.userName || 'Anonymous'}
                                            </Text>
                                            <Text style={styles.commentTime}>
                                                {formatTimeAgo(comment.createdAt)}
                                            </Text>
                                        </View>
                                        <Text style={styles.commentText}>{comment.content}</Text>
                                        
                                        {/* Like and Reply buttons */}
                                        <View style={styles.commentActions}>
                                            <TouchableOpacity>
                                                <Text style={styles.commentAction}>Like</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity>
                                                <Text style={styles.commentAction}>Reply</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>

                    {/* Debug Test Button - ALWAYS SHOW FOR TESTING */}
                    <View style={styles.debugButtons}>
                        <TouchableOpacity
                            onPress={() => {
                                console.log('🧪 Simple click test works!');
                                Alert.alert('Success', 'JavaScript click handler working!');
                            }}
                            style={[styles.debugButton, { backgroundColor: '#10b981' }]}
                        >
                            <Text style={styles.debugButtonText}>Test Click</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={async () => {
                                try {
                                    console.log('🧪 Testing API endpoint...');
                                    const response = await fetch(`/api/reels/${reelId}/comments`);
                                    const data = await response.json();
                                    console.log('🧪 API test result:', data);
                                    Alert.alert('Success', 'API test completed - check console');
                                } catch (error) {
                                    console.error('🧪 API test failed:', error);
                                    Alert.alert('Error', 'API test failed - check console');
                                }
                            }}
                            style={[styles.debugButton, { backgroundColor: '#3b82f6' }]}
                        >
                            <Text style={styles.debugButtonText}>Test API</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                console.log('🧪 Testing handleSubmit directly...');
                                const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                                handleSubmit(fakeEvent);
                            }}
                            style={[styles.debugButton, { backgroundColor: '#ef4444' }]}
                        >
                            <Text style={styles.debugButtonText}>Test Submit</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Comment Input */}
                    <View style={styles.inputContainer}>
                        <View style={styles.inputRow}>
                            {/* <Image 
                                source={{ uri: userProfileImage || currentUser?.photoURL || '/images/avatar.jpg' }} 
                                style={styles.inputAvatar}
                                defaultSource={require('@/assets/images/avatar.jpg')}
                            /> */}
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    ref={commentInputRef}
                                    value={newComment}
                                    onChangeText={setNewComment}
                                    placeholder={currentUser ? "Add a comment..." : "Please log in to comment"}
                                    style={styles.textInput}
                                    editable={!loading && !submitting && !!currentUser}
                                    multiline={false}
                                />
                                <TouchableOpacity 
                                    style={styles.emojiButton}
                                    disabled={!currentUser}
                                >
                                    <Smile size={20} color="#6b7280" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        console.log('🔍 Button clicked!', {
                                            disabled: loading || !newComment.trim() || submitting || !currentUser,
                                            loading,
                                            hasComment: !!newComment.trim(),
                                            submitting,
                                            hasUser: !!currentUser,
                                        });
                                        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                                        handleSubmit(fakeEvent);
                                    }}
                                    disabled={loading || !newComment.trim() || submitting || !currentUser}
                                    style={[
                                        styles.submitButton,
                                        (loading || !newComment.trim() || submitting || !currentUser) && styles.submitButtonDisabled
                                    ]}
                                >
                                    {submitting ? (
                                        <ActivityIndicator size="small" color="#3b82f6" />
                                    ) : (
                                        <Send size={20} color="#3b82f6" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                        {!currentUser && (
                            <Text style={styles.loginPrompt}>
                                Please log in to post comments
                            </Text>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
} 