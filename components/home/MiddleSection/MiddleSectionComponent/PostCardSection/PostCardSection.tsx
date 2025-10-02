import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import ImageAndVideoPostSection from './ImageAndVideoPostSection/ImageAndVideoPostSection';
import LikesModal from './LikesModal/LikesModal';

interface User {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
    userName: string;
    emailVerified?: boolean;
    isAdmin?: boolean;
}

interface Post {
    id: string;
    user: User;
    userId: string;
    caption?: string;
    description?: string;
    hashtags?: string[];
    media?: { type: 'image' | 'video'; typeUrl: string; id?: string }[];
    stats?: { likes?: number; comments?: number; shares?: number };
    likedUsers?: User[];
    mentions?: string[];
    friendReferences?: string[];
}

interface PostCardSectionProps {
    post: Post;
    onCommentClick: (postId: string) => void;
}

const PostCardSection = ({ post, onCommentClick }: PostCardSectionProps) => {
    const [isLiked, setIsLiked] = useState(false);
    const [localLikeCount, setLocalLikeCount] = useState(post.stats?.likes || 0);
    const [isLikesModalOpen, setIsLikesModalOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
    const [localLikedUsers, setLocalLikedUsers] = useState<User[]>(post.likedUsers || []);

    // Placeholder for follow/friendship status
    const [isFollowingCreator, setIsFollowingCreator] = useState(false);
    const [friendshipStatus, setFriendshipStatus] = useState<{ [key: string]: 'none' | 'pending' | 'accepted' | 'declined' }>({});
    const [followingStatus, setFollowingStatus] = useState<{ [key: string]: boolean }>({});

    // Placeholder for current user id
    const currentUserId = 'TODO_USER_ID';

    const directHeartClick = () => {
        const wasLiked = isLiked;
        setIsLiked(!wasLiked);
        setLocalLikeCount(wasLiked ? localLikeCount - 1 : localLikeCount + 1);
    };

    const handleFollowClick = (userId: string) => {
        setFollowingStatus(prev => ({ ...prev, [userId]: !prev[userId] }));
    };

    const handleFriendRequestClick = (userId: string) => {
        setFriendshipStatus(prev => ({ ...prev, [userId]: 'pending' }));
    };

    return (
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#e5e7eb', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                            {post.user.profileImage ? (
                                <Image
                                source={{ uri: post.user.profileImage }}
                                style={{ width: 48, height: 48, borderRadius: 24 }}
                                resizeMode="cover"
                                />
                            ) : (
                            <Text style={{ fontSize: 20, color: '#6b7280', fontWeight: 'bold' }}>{post.user.firstName?.charAt(0)}</Text>
                            )}
                    </View>
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#111827' }}>{post.user.firstName} {post.user.lastName}</Text>
                            {post.user.emailVerified && (
                                <Icon name="check-circle" size={16} color="#10b981" style={{ marginLeft: 4 }} />
                            )}
                            {post.user.isAdmin && (
                                <Icon name="shield" size={16} color="#3b82f6" style={{ marginLeft: 4 }} />
                            )}
                        </View>
                        <Text style={{ fontSize: 13, color: '#6b7280' }}>@{post.user.userName}</Text>
                    </View>
                </View>
                {/* Three Dots Menu (stubbed) */}
                <TouchableOpacity onPress={() => setIsMenuOpen(!isMenuOpen)} style={{ padding: 8, borderRadius: 9999 }}>
                    <Icon name="more-horizontal" size={22} color="#6b7280" />
                </TouchableOpacity>
                {/* TODO: Implement menu actions */}
            </View>
            {/* Content */}
            <View style={{ gap: 8 }}>
                {post.caption ? (
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 }}>{post.caption}</Text>
                ) : null}
                {post.description ? (
                    <Text style={{ color: '#374151', marginBottom: 4 }}>{post.description}</Text>
                ) : null}
                {post.hashtags && post.hashtags.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                        {post.hashtags.map((tag, index) => (
                            <Text key={index} style={{ color: '#10b981', fontSize: 13 }}>#{tag}</Text>
                        ))}
                    </View>
                )}
                {post.media && post.media.length > 0 && (
                    <ImageAndVideoPostSection media={post.media} />
                )}
            </View>
            {/* Interaction Bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                    <TouchableOpacity
                        onPress={directHeartClick}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        activeOpacity={0.7}
                    >
                        <Icon name="heart" size={24} color={isLiked ? '#ef4444' : '#6b7280'} />
                        <Text style={{ fontSize: 14, color: isLiked ? '#ef4444' : '#6b7280', fontWeight: 'bold' }}>{localLikeCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onCommentClick(post.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        activeOpacity={0.7}
                    >
                        <Icon name="message-circle" size={24} color="#6b7280" />
                        <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: 'bold' }}>{post.stats?.comments || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setIsShareMenuOpen(!isShareMenuOpen)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        activeOpacity={0.7}
                    >
                        <Icon name="share" size={24} color="#6b7280" />
                        <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: 'bold' }}>{post.stats?.shares || 0}</Text>
                    </TouchableOpacity>
                </View>
                {/* Liked Users Display */}
                {localLikedUsers.length > 0 && (
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        onPress={() => setIsLikesModalOpen(true)}
                        activeOpacity={0.7}
                    >
                        <View style={{ flexDirection: 'row', marginRight: 4 }}>
                            {localLikedUsers.slice(0, 3).map((user, idx) => (
                                <View
                                    key={user.id}
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        borderWidth: 2,
                                        borderColor: '#fff',
                                        marginLeft: idx === 0 ? 0 : -10,
                                        backgroundColor: '#e5e7eb',
                                    }}
                                >
                                    <Image
                                        source={{ uri: user.profileImage || 'https://ui-avatars.com/api/?name=User' }}
                                        style={{ width: 32, height: 32, borderRadius: 16 }}
                                        resizeMode="cover"
                                    />
                                </View>
                            ))}
                        </View>
                        <Text style={{ color: '#6b7280', fontSize: 13 }}>
                            {localLikedUsers.length === 1 ? '1 like' : `${localLikedUsers.length} likes`}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
            <LikesModal
                isOpen={isLikesModalOpen}
                onClose={() => setIsLikesModalOpen(false)}
                likedUsers={localLikedUsers}
                onFollowClick={handleFollowClick}
                onFriendRequestClick={handleFriendRequestClick}
                followingStatus={followingStatus}
                friendshipStatus={friendshipStatus}
            />
        </View>
    );
};

export default PostCardSection;