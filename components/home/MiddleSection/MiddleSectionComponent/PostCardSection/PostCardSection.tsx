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
      <View
        style={{
            backgroundColor: '#fff', 
            borderRadius: 20, 
            padding: 20, 
            marginBottom: 20, 
            marginHorizontal: 0,
            shadowColor: '#000', 
            shadowOffset: {
                width: 0,
                height: 4,
            },
            shadowOpacity: 0.08, 
            shadowRadius: 12,
            elevation: 8,
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ 
                        width: 48, 
                        height: 48, 
                        borderRadius: 24, 
                        overflow: 'hidden', 
                        backgroundColor: '#f3f4f6', 
                        marginRight: 12, 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: '#fff',
                        shadowColor: '#000',
                        shadowOffset: {
                            width: 0,
                            height: 2,
                        },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                    }}>
                        {post.user.profileImage ? (
                            <Image
                                source={{ uri: post.user.profileImage }}
                                style={{ width: 48, height: 48, borderRadius: 24 }}
                                resizeMode="cover"
                            />
                        ) : (
                            <Text style={{ fontSize: 20, color: '#6b7280', fontWeight: 'bold' }}>
                                {post.user.firstName?.charAt(0)}
                            </Text>
                        )}
                    </View>
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#111827' }}>
                                {post.user.firstName} {post.user.lastName}
                            </Text>
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
                {/* Three Dots Menu */}
                <TouchableOpacity 
                    onPress={() => setIsMenuOpen(!isMenuOpen)} 
                    style={{ 
                        padding: 8, 
                        borderRadius: 20,
                        backgroundColor: '#f8f9fa',
                    }}
                >
                    <Icon name="more-horizontal" size={22} color="#6b7280" />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={{ gap: 12 }}>
                {post.caption ? (
                    <Text style={{ 
                        fontSize: 18, 
                        fontWeight: '600', 
                        color: '#111827', 
                        lineHeight: 24,
                        marginBottom: 4 
                    }}>
                        {post.caption}
                    </Text>
                ) : null}
                {post.description ? (
                    <Text style={{ 
                        color: '#374151', 
                        fontSize: 15,
                        lineHeight: 22,
                        marginBottom: 4 
                    }}>
                        {post.description}
                    </Text>
                ) : null}
                {post.hashtags && post.hashtags.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                        {post.hashtags.map((tag, index) => (
                            <Text key={index} style={{ 
                                color: '#10b981', 
                                fontSize: 14,
                                fontWeight: '500',
                            }}>
                                #{tag}
                            </Text>
                        ))}
                    </View>
                )}
                {post.media && post.media.length > 0 && (
                    <View style={{ borderRadius: 16, overflow: 'hidden', marginVertical: 8 }}>
                        <ImageAndVideoPostSection media={post.media} />
                    </View>
                )}
            </View>

            {/* Interaction Bar */}
            <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginTop: 20,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6',
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                    <TouchableOpacity
                        onPress={directHeartClick}
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            gap: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 20,
                            backgroundColor: isLiked ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        }}
                        activeOpacity={0.7}
                    >
                        <Icon name="heart" size={24} color={isLiked ? '#ef4444' : '#6b7280'} />
                        <Text style={{ 
                            fontSize: 14, 
                            color: isLiked ? '#ef4444' : '#6b7280', 
                            fontWeight: '600' 
                        }}>
                            {localLikeCount}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onCommentClick(post.id)}
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            gap: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 20,
                        }}
                        activeOpacity={0.7}
                    >
                        <Icon name="message-circle" size={24} color="#6b7280" />
                        <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '600' }}>
                            {post.stats?.comments || 0}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setIsShareMenuOpen(!isShareMenuOpen)}
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            gap: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 20,
                        }}
                        activeOpacity={0.7}
                    >
                        <Icon name="share" size={24} color="#6b7280" />
                        <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '600' }}>
                            {post.stats?.shares || 0}
                        </Text>
                    </TouchableOpacity>
                </View>
                {/* Liked Users Display */}
                {/* {localLikedUsers.length > 0 && (
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
                                        shadowColor: '#000',
                                        shadowOffset: {
                                            width: 0,
                                            height: 1,
                                        },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 2,
                                        elevation: 2,
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
                        <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '500' }}>
                            {localLikedUsers.length === 1 ? '1 like' : `${localLikedUsers.length} likes`}
                        </Text>
                    </TouchableOpacity>
                )} */}
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