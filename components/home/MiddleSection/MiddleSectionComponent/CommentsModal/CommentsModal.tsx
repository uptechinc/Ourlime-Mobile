import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, TextInput, Modal, Dimensions } from "react-native";
import Icon from 'react-native-vector-icons/Feather';
import ImageAndVideoPostSection from '../PostCardSection/ImageAndVideoPostSection/ImageAndVideoPostSection';

interface UserData {
    id: string;
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
}

interface Reply {
    id: string;
    reply: string;
    createdAt: string;
    userData: UserData;
}

interface Comment {
    id: string;
    comment: string;
    createdAt: string;
    userData: UserData;
}

interface Post {
    id: string;
    user: UserData;
    caption?: string;
    media?: { type: 'image' | 'video'; typeUrl: string; id?: string }[];
}

interface CommentModalProps {
    postId: string;
    userId: string;
    onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

const CommentsModal: React.FC<CommentModalProps> = ({ postId, userId, onClose }) => {
    const [comment, setComment] = useState("");
    const [reply, setReply] = useState("");
    const [replies, setReplies] = useState<{ [key: string]: Reply[] }>({});
    const [expandedReplies, setExpandedReplies] = useState<{ [key: string]: boolean }>({});
    const [postDetails, setPostDetails] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);

    // TODO: Replace with actual data fetching logic
    useEffect(() => {
        // Simulate loading post details
        setTimeout(() => {
            setPostDetails({
                id: postId,
                user: {
                    id: '1',
                    firstName: 'John',
                    lastName: 'Doe',
                    userName: 'johndoe',
                    profileImage: undefined,
                },
                caption: 'Sample post caption',
                media: [],
            });
            setIsLoading(false);
        }, 500);
    }, [postId]);

    useEffect(() => {
        // Simulate loading comments
        setTimeout(() => {
            setComments([
                {
                    id: 'c1',
                    comment: 'This is a comment!',
                    createdAt: new Date().toISOString(),
                    userData: {
                        id: '2',
                        firstName: 'Alice',
                        lastName: 'Smith',
                        userName: 'alicesmith',
                        profileImage: undefined,
                    },
                },
            ]);
            setReplies({
                c1: [
                    {
                        id: 'r1',
                        reply: 'This is a reply!',
                        createdAt: new Date().toISOString(),
                        userData: {
                            id: '3',
                            firstName: 'Bob',
                            lastName: 'Brown',
                            userName: 'bobbrown',
                            profileImage: undefined,
                        },
                    },
                ],
            });
            setIsLoadingComments(false);
            setHasFetched(true);
        }, 500);
    }, [postId]);

    const handleSubmit = () => {
        if (comment.trim()) {
            // TODO: Implement comment submission logic
            setComment("");
        }
    };

    const handleReply = (commentId: string) => {
        if (reply.trim()) {
            // TODO: Implement reply submission logic
            setReply("");
            setReplyingTo(null);
        }
    };

    return (
        <Modal
            visible={true}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 8 }}>
                <View style={{ width: '100%', maxWidth: 800, height: SCREEN_HEIGHT * 0.9, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', flexDirection: 'row' }}>
                    {/* Close Button */}
                    <TouchableOpacity
                        onPress={onClose}
                        style={{ position: 'absolute', right: 12, top: 12, zIndex: 10, padding: 8, borderRadius: 9999, backgroundColor: 'rgba(0,0,0,0.08)' }}
                    >
                        <Icon name="x" size={20} color="#6b7280" />
                    </TouchableOpacity>
                    {/* Media Section */}
                    {postDetails?.media && postDetails.media.length > 0 && (
                        <View style={{ width: '60%', height: '100%', backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                            <ImageAndVideoPostSection media={postDetails.media} />
                        </View>
                    )}
                    {/* Comments Section */}
                    <View style={{ flex: 1, backgroundColor: '#fff', paddingVertical: 0, borderTopRightRadius: 20, borderBottomRightRadius: 20 }}>
                        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#f0fdf4' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: '#bbf7d0', backgroundColor: '#e5e7eb', marginRight: 8 }}>
                                    <Image
                                        source={{ uri: postDetails?.user?.profileImage || 'https://ui-avatars.com/api/?name=User' }}
                                        style={{ width: 36, height: 36, borderRadius: 18 }}
                                        resizeMode="cover"
                                    />
                                </View>
                                <View>
                                    <Text style={{ fontWeight: 'bold', color: '#10b981', fontSize: 15 }}>{postDetails?.user?.firstName} {postDetails?.user?.lastName}</Text>
                                    <Text style={{ color: '#6b7280', fontSize: 12 }}>@{postDetails?.user?.userName}</Text>
                                </View>
                            </View>
                            {postDetails?.caption && (
                                <Text style={{ marginTop: 8, color: '#374151', fontSize: 14 }}>{postDetails.caption}</Text>
                            )}
                        </View>
                        <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 24 }}>
                            {comments.length === 0 ? (
                                <View style={{ alignItems: 'center', justifyContent: 'center', height: 200, padding: 24 }}>
                                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#bbf7d0', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                        <Icon name="message-circle" size={32} color="#10b981" />
                                    </View>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 }}>No comments yet</Text>
                                    <Text style={{ color: '#6b7280', fontSize: 13 }}>Be the first to share your thoughts!</Text>
                                </View>
                            ) : (
                                comments.map((comment) => (
                                    <View key={comment.id} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#bbf7d0', backgroundColor: '#e5e7eb', marginRight: 8 }}>
                                                <Image
                                                    source={{ uri: comment.userData?.profileImage || 'https://ui-avatars.com/api/?name=User' }}
                                                    style={{ width: 32, height: 32, borderRadius: 16 }}
                                                    resizeMode="cover"
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#10b981' }}>{comment.userData?.firstName} {comment.userData?.lastName}</Text>
                                                    <Text style={{ color: '#6b7280', fontSize: 12 }}>@{comment.userData?.userName}</Text>
                                                    {/* <Text style={{ color: '#9ca3af', fontSize: 12 }}>• {formatDate(comment.createdAt)}</Text> */}
                                                </View>
                                                <Text style={{ marginTop: 4, color: '#374151', fontSize: 14 }}>{comment.comment}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                                    <TouchableOpacity
                                                        onPress={() => setReplyingTo(comment.id === replyingTo ? null : comment.id)}
                                                    >
                                                        <Text style={{ color: '#10b981', fontSize: 12 }}>Reply</Text>
                                                    </TouchableOpacity>
                                                    {replies[comment.id]?.length > 0 && (
                                                        <TouchableOpacity
                                                            onPress={() => setExpandedReplies(prev => ({
                                                                ...prev,
                                                                [comment.id]: !prev[comment.id]
                                                            }))}
                                                        >
                                                            <Text style={{ color: '#6b7280', fontSize: 12 }}>
                                                                {expandedReplies[comment.id] ? 'Hide replies' : `View ${replies[comment.id].length} ${replies[comment.id].length === 1 ? 'reply' : 'replies'}`}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                                {replyingTo === comment.id && (
                                                    <View style={{ marginTop: 8 }}>
                                                        <TextInput
                                                            value={reply}
                                                            onChangeText={setReply}
                                                            style={{ width: '100%', paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#fff', marginBottom: 4 }}
                                                            multiline
                                                            numberOfLines={2}
                                                            placeholder="Write a reply..."
                                                        />
                                                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                                                            <TouchableOpacity
                                                                onPress={() => setReplyingTo(null)}
                                                                style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#f3f4f6' }}
                                                            >
                                                                <Text style={{ fontSize: 12, color: '#6b7280' }}>Cancel</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => handleReply(comment.id)}
                                                                disabled={!reply.trim()}
                                                                style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#10b981', opacity: !reply.trim() ? 0.5 : 1 }}
                                                            >
                                                                <Text style={{ fontSize: 12, color: '#fff' }}>Reply</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                )}
                                                {replies[comment.id]?.length > 0 && expandedReplies[comment.id] && (
                                                    <View style={{ marginTop: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#bbf7d0' }}>
                                                        {replies[comment.id].map((reply) => (
                                                            <View key={reply.id} style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
                                                                <View style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e5e7eb', marginRight: 4 }}>
                                                                    <Image
                                                                        source={{ uri: reply.userData?.profileImage || 'https://ui-avatars.com/api/?name=User' }}
                                                                        style={{ width: 28, height: 28, borderRadius: 14 }}
                                                                        resizeMode="cover"
                                                                    />
                                                                </View>
                                                                <View style={{ flex: 1 }}>
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                                                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#10b981' }}>{reply.userData?.firstName} {reply.userData?.lastName}</Text>
                                                                        <Text style={{ color: '#6b7280', fontSize: 11 }}>@{reply.userData?.userName}</Text>
                                                                        {/* <Text style={{ color: '#9ca3af', fontSize: 11 }}>• {formatDate(reply.createdAt)}</Text> */}
                                                                    </View>
                                                                    <Text style={{ marginTop: 2, color: '#374151', fontSize: 13 }}>{reply.reply}</Text>
                                                                </View>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#f0fdf4' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TextInput
                                    value={comment}
                                    onChangeText={setComment}
                                    style={{ flex: 1, backgroundColor: '#fff', fontSize: 14, borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#e5e7eb' }}
                                    placeholder="Write a comment..."
                                    multiline
                                    numberOfLines={1}
                                />
                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    style={{ backgroundColor: '#10b981', borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, marginLeft: 8 }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Post</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default CommentsModal;
