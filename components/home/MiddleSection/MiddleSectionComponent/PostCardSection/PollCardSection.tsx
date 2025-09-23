import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import ImageAndVideoPostSection from './ImageAndVideoPostSection/ImageAndVideoPostSection';

interface User {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
    userName: string;
    emailVerified?: boolean;
}

interface PollOption {
    id: string;
    text: string;
}

interface Post {
    id: string;
    user: User;
    userId: string;
    caption?: string;
    createdAt?: string;
    pollDuration?: number;
    pollOptions?: PollOption[];
    media?: { type: 'image' | 'video'; typeUrl: string; id?: string }[];
    stats: { likes: number; comments: number; shares: number };
    likedUsers: User[];
}

interface PollCardSectionProps {
    post: Post;
    onCommentClick: (postId: string) => void;
}

const PollCardSection = ({ post, onCommentClick }: PollCardSectionProps) => {
    const [localLikeCount, setLocalLikeCount] = useState<number>(post.stats.likes);
    const [localLikedUsers, setLocalLikedUsers] = useState<User[]>(post.likedUsers);
    const currentUserId = 'TODO_USER_ID';
    const [isLiked, setIsLiked] = useState<boolean>(() => {
        return post.likedUsers.some((user: User) => user.id === currentUserId);
    });
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [pollEnded, setPollEnded] = useState<boolean>(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const calculateTimeRemaining = () => {
            if (!post.createdAt || !post.pollDuration) {
                setTimeRemaining('Time unknown');
                return;
            }
            const creationDate = new Date(post.createdAt);
            const endTime = new Date(creationDate.getTime() + post.pollDuration * 60 * 60 * 1000);
            const now = new Date();
            if (now >= endTime) {
                setPollEnded(true);
                setTimeRemaining('Poll ended');
                return;
            }
            const diffMs = endTime.getTime() - now.getTime();
            const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            if (diffHrs > 0) {
                setTimeRemaining(`${diffHrs}h ${diffMins}m remaining`);
            } else {
                setTimeRemaining(`${diffMins}m remaining`);
            }
        };
        calculateTimeRemaining();
        const timerId = setInterval(calculateTimeRemaining, 60000);
        return () => clearInterval(timerId);
    }, [post.createdAt, post.pollDuration]);

    const handleLike = () => {
        const wasLiked = isLiked;
        setIsLiked(!wasLiked);
        setLocalLikeCount((prev: number) => (wasLiked ? prev - 1 : prev + 1));
        if (wasLiked) {
            setLocalLikedUsers((prev: User[]) => prev.filter((user: User) => user.id !== currentUserId));
        } else {
            const currentUserData: User = {
                id: currentUserId,
                firstName: 'You',
                lastName: '',
                userName: 'you',
                profileImage: undefined,
            };
            setLocalLikedUsers((prev: User[]) => [currentUserData, ...prev]);
        }
    };

    const handleVote = (optionId: string) => {
        if (pollEnded || !currentUserId) return;
        // Would implement actual voting functionality here
    };

    return (
        <View style={{ 
            backgroundColor: '#fff', 
            borderRadius: 20, 
            padding: 20, 
            marginBottom: 20, 
            marginHorizontal: 4,
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
        }}>
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

            {/* Poll Content */}
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
                {post.media && post.media.length > 0 && (
                    <View style={{ borderRadius: 16, overflow: 'hidden', marginVertical: 8 }}>
                        <ImageAndVideoPostSection media={post.media} />
                    </View>
                )}
                
                {/* Poll Timer */}
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    borderBottomWidth: 1, 
                    borderBottomColor: '#f3f4f6', 
                    paddingBottom: 12, 
                    marginBottom: 12 
                }}>
                    <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        gap: 6,
                        backgroundColor: '#f8f9fa',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                    }}>
                        <Icon name="clock" size={16} color="#6b7280" />
                        <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '500' }}>
                            {timeRemaining}
                        </Text>
                    </View>
                    <View style={{
                        backgroundColor: '#10b981',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                    }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                            {post.pollOptions?.length || 0} options
                        </Text>
                    </View>
                </View>

                {/* Poll Options */}
                <View style={{ gap: 12 }}>
                    {post.pollOptions?.map((option: PollOption, index: number) => {
                        const percentage = 0; // This would come from actual votes
                        return (
                            <TouchableOpacity
                                key={option.id}
                                onPress={() => handleVote(option.id)}
                                disabled={pollEnded}
                                style={{
                                    padding: 16,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: '#e5e7eb',
                                    marginBottom: 4,
                                    backgroundColor: '#fff',
                                    opacity: pollEnded ? 0.7 : 1,
                                    shadowColor: '#000',
                                    shadowOffset: {
                                        width: 0,
                                        height: 2,
                                    },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 4,
                                    elevation: 2,
                                }}
                                activeOpacity={pollEnded ? 1 : 0.8}
                            >
                                {/* Progress bar background */}
                                <View style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: `${percentage}%`,
                                    backgroundColor: 'rgba(16,185,129,0.1)',
                                    borderRadius: 16,
                                }} />
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{ fontWeight: '600', fontSize: 15, color: '#111827' }}>
                                        {option.text}
                                    </Text>
                                    <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '500' }}>
                                        0 votes
                                    </Text>
                                </View>
                                {percentage > 0 && (
                                    <Text style={{ 
                                        color: '#10b981', 
                                        fontSize: 12, 
                                        marginTop: 4, 
                                        textAlign: 'right', 
                                        fontWeight: 'bold' 
                                    }}>
                                        {percentage}%
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Poll Info */}
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: '#f3f4f6',
                }}>
                    <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '500' }}>
                        0 total votes
                    </Text>
                    {pollEnded ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ 
                                width: 8, 
                                height: 8, 
                                borderRadius: 4, 
                                backgroundColor: '#ef4444',
                            }} />
                            <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>
                                Poll ended
                            </Text>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ 
                                width: 8, 
                                height: 8, 
                                borderRadius: 4, 
                                backgroundColor: '#10b981',
                            }} />
                            <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13 }}>
                                Poll active
                            </Text>
                        </View>
                    )}
                </View>
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
                        onPress={handleLike}
                        style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            gap: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 20,
                            backgroundColor: isLiked ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        }}
                        activeOpacity={0.7}
                    >
                        <Icon name="heart" size={24} color={isLiked ? '#10b981' : '#6b7280'} />
                        <Text style={{ 
                            fontSize: 14, 
                            color: isLiked ? '#10b981' : '#6b7280', 
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
                            {post.stats.comments || 0}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
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
                            {post.stats.shares || 0}
                        </Text>
                    </TouchableOpacity>
                </View>
                {/* Liked Users Display */}
                {/* {localLikedUsers.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ flexDirection: 'row', marginRight: 4 }}>
                            {localLikedUsers.slice(0, 3).map((user: User, idx: number) => (
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
                                    {user.profileImage ? (
                                        <Image
                                            source={{ uri: user.profileImage }}
                                            style={{ width: 32, height: 32, borderRadius: 16 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: 'bold' }}>
                                            {user.firstName?.charAt(0)}
                                        </Text>
                                    )}
                                </View>
                            ))}
                        </View>
                        {localLikedUsers.length > 3 && (
                            <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '500' }}>
                                +{localLikedUsers.length - 3} more
                            </Text>
                        )}
                    </View>
                )} */}
            </View>
        </View>
    );
};

export default PollCardSection;