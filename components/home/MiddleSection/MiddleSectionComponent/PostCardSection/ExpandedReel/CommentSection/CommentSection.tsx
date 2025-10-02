import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, ActivityIndicator } from 'react-native';
// import { auth } from '@/lib/firebaseConfig';
// import toast from 'react-hot-toast';
import Icon from 'react-native-vector-icons/Feather';

interface CommentsSectionProps {
    reelId: string;
    onClose: () => void;
    onCommentAdded?: () => void;
}

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
    replies?: Reply[];
}

interface Reply {
    id: string;
    content: string;
    userId: string;
    commentId: string;
    createdAt: any;
    user: {
        id: string;
        userName: string;
        profileImage?: string;
    };
}

const CommentsSection = ({ reelId, onClose, onCommentAdded }: CommentsSectionProps) => {
    const [comment, setComment] = useState('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const commentInputRef = useRef<TextInput>(null);
    // const currentUser = auth.currentUser;
    const currentUser = { uid: 'TODO_USER_ID', photoURL: undefined }; // TODO: Replace with actual user

    useEffect(() => {
        if (commentInputRef.current) {
            commentInputRef.current.focus();
        }
        // TODO: Fetch comments from API for React Native
        setLoading(false);
    }, [reelId]);

    const handleSubmitComment = async () => {
        if (!comment.trim() || !currentUser) {
            // TODO: Show error feedback
            return;
        }
        setSubmitting(true);
        try {
            // TODO: Implement comment submission logic for React Native
            setComments(prev => [{
                id: Math.random().toString(),
                content: comment.trim(),
                userId: currentUser.uid,
                reelId,
                createdAt: new Date(),
                user: { id: currentUser.uid, userName: 'You', profileImage: currentUser.photoURL },
                replies: [],
            }, ...prev]);
            setComment('');
            onCommentAdded?.();
        } catch (error) {
            // TODO: Show error feedback
        } finally {
            setSubmitting(false);
        }
    };

    const formatTimeAgo = (timestamp: any) => {
        if (!timestamp) return 'Just now';
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        if (isNaN(date.getTime())) {
            return 'Just now';
        }
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

    return (
        <View style={{ flex: 1, backgroundColor: '#fff', borderTopRightRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#f0fdf4' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>Comments</Text>
                <TouchableOpacity onPress={onClose} style={{ padding: 8, borderRadius: 9999 }}>
                    <Icon name="x" size={24} color="#6b7280" />
                </TouchableOpacity>
            </View>
            {/* Comments List */}
            <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
                {loading ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', height: 128 }}>
                        <ActivityIndicator size="large" color="#10b981" />
                    </View>
                ) : comments.length === 0 ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
                        <Text style={{ color: '#6b7280', fontSize: 15 }}>No comments yet</Text>
                        <Text style={{ color: '#9ca3af', fontSize: 13 }}>Be the first to comment!</Text>
                    </View>
                ) : (
                    comments.map(commentItem => (
                        <View key={commentItem.id} style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#e5e7eb', marginRight: 8 }}>
                                {commentItem.user.profileImage ? (
                                    <Image source={{ uri: commentItem.user.profileImage }} style={{ width: 40, height: 40, borderRadius: 20 }} resizeMode="cover" />
                                ) : (
                                    <View style={{ width: 40, height: 40, backgroundColor: '#e5e7eb', borderRadius: 20 }} />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={{ backgroundColor: '#f3f4f6', borderRadius: 20, padding: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#111827' }}>{commentItem.user.userName}</Text>
                                        <TouchableOpacity style={{ opacity: 0.7 }}>
                                            <Icon name="more-horizontal" size={18} color="#6b7280" />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={{ fontSize: 14, color: '#374151', marginTop: 4 }}>{commentItem.content}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 }}>
                                    <Text style={{ fontSize: 12, color: '#6b7280' }}>{formatTimeAgo(commentItem.createdAt)}</Text>
                                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Icon name="heart" size={14} color="#6b7280" />
                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Like</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setReplyingTo(replyingTo === commentItem.id ? null : commentItem.id)}>
                                        <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 'bold' }}>Reply</Text>
                                    </TouchableOpacity>
                                </View>
                                {/* Reply Input */}
                                {replyingTo === commentItem.id && (
                                    <View style={{ marginTop: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#bbf7d0' }}>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e5e7eb', marginRight: 4 }}>
                                                {currentUser?.photoURL ? (
                                                    <Image source={{ uri: currentUser.photoURL }} style={{ width: 24, height: 24, borderRadius: 12 }} resizeMode="cover" />
                                                ) : (
                                                    <View style={{ width: 24, height: 24, backgroundColor: '#e5e7eb', borderRadius: 12 }} />
                                                )}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <TextInput
                                                    value={replyText}
                                                    onChangeText={setReplyText}
                                                    placeholder={`Reply to ${commentItem.user.userName}...`}
                                                    style={{ width: '100%', paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#fff', marginBottom: 4 }}
                                                    multiline
                                                    numberOfLines={2}
                                                />
                                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setReplyingTo(null);
                                                            setReplyText('');
                                                        }}
                                                        style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#f3f4f6' }}
                                                    >
                                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Cancel</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={async () => {
                                                            if (!replyText.trim() || !currentUser) return;
                                                            // TODO: Implement reply submission logic for React Native
                                                            setReplyingTo(null);
                                                            setReplyText('');
                                                            onCommentAdded?.();
                                                        }}
                                                        disabled={!replyText.trim()}
                                                        style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#10b981', opacity: !replyText.trim() ? 0.5 : 1 }}
                                                    >
                                                        <Text style={{ fontSize: 12, color: '#fff' }}>Reply</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                )}
                                {/* Display Replies */}
                                {commentItem.replies && commentItem.replies.length > 0 && (
                                    <View style={{ marginTop: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#e5e7eb' }}>
                                        {commentItem.replies.map((reply: Reply) => (
                                            <View key={reply.id} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                                                <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e5e7eb', marginRight: 4 }}>
                                                    {reply.user.profileImage ? (
                                                        <Image source={{ uri: reply.user.profileImage }} style={{ width: 24, height: 24, borderRadius: 12 }} resizeMode="cover" />
                                                    ) : (
                                                        <View style={{ width: 24, height: 24, backgroundColor: '#e5e7eb', borderRadius: 12 }} />
                                                    )}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, padding: 8 }}>
                                                        <Text style={{ fontWeight: 'bold', fontSize: 12, color: '#111827' }}>{reply.user.userName}</Text>
                                                        <Text style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{reply.content}</Text>
                                                    </View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                                                        <Text style={{ fontSize: 11, color: '#6b7280' }}>{formatTimeAgo(reply.createdAt)}</Text>
                                                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <Icon name="heart" size={12} color="#6b7280" />
                                                            <Text style={{ fontSize: 11, color: '#6b7280' }}>Like</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
            {/* Comment Input */}
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f3f4f6', borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <TextInput
                        ref={commentInputRef}
                        value={comment}
                        onChangeText={setComment}
                        placeholder={currentUser ? 'Write a comment...' : 'Please log in to comment'}
                        style={{ flex: 1, backgroundColor: 'transparent', fontSize: 14 }}
                        editable={!!currentUser && !submitting}
                        onSubmitEditing={handleSubmitComment}
                        returnKeyType="send"
                    />
                    <TouchableOpacity
                        style={{ padding: 4 }}
                        disabled={!currentUser}
                    >
                        <Icon name="smile" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleSubmitComment}
                        style={{ padding: 4, opacity: (!comment.trim() || !currentUser || submitting) ? 0.5 : 1 }}
                        disabled={!comment.trim() || !currentUser || submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#10b981" />
                        ) : (
                            <Icon name="send" size={20} color="#10b981" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

export default CommentsSection;
