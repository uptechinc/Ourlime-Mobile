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
    const currentUserId = 'TODO_USER_ID'; // Omit Firebase setup for now
    const [isLiked, setIsLiked] = useState<boolean>(() => {
        return post.likedUsers.some((user: User) => user.id === currentUserId);
    });
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [pollEnded, setPollEnded] = useState<boolean>(false);

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
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
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
                    </View>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>@{post.user.userName}</Text>
                </View>
            </View>
            {/* Poll Content */}
            <View style={{ gap: 8 }}>
                {post.caption ? (
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 }}>{post.caption}</Text>
                ) : null}
                {post.media && post.media.length > 0 && (
                    <ImageAndVideoPostSection media={post.media} />
                )}
                {/* Poll Timer */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 8, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="clock" size={16} color="#6b7280" />
                        <Text style={{ color: '#6b7280', fontSize: 13 }}>{timeRemaining}</Text>
                    </View>
                    <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13 }}>{post.pollOptions?.length || 0} options</Text>
                </View>
                {/* Poll Options */}
                <View style={{ gap: 8 }}>
                    {post.pollOptions?.map((option: PollOption, index: number) => {
                        const percentage = 0; // This would come from actual votes
                        return (
                            <TouchableOpacity
                                key={option.id}
                                onPress={() => handleVote(option.id)}
                                disabled={pollEnded}
                                style={{
                                    padding: 16,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#e5e7eb',
                                    marginBottom: 4,
                                    backgroundColor: '#fff',
                                    opacity: pollEnded ? 0.7 : 1,
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
                                    borderRadius: 12,
                                }} />
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{option.text}</Text>
                                    <Text style={{ color: '#6b7280', fontSize: 13 }}>0 votes</Text>
                                </View>
                                {percentage > 0 && (
                                    <Text style={{ color: '#10b981', fontSize: 12, marginTop: 4, textAlign: 'right', fontWeight: 'bold' }}>{percentage}%</Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
                {/* Poll Info */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ color: '#6b7280', fontSize: 13 }}>0 total votes</Text>
                    {pollEnded ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 4 }} />
                            <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>Poll ended</Text>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 4 }} />
                            <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13 }}>Poll active</Text>
                        </View>
                    )}
                </View>
            </View>
            {/* Interaction Bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                    <TouchableOpacity
                        onPress={handleLike}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        activeOpacity={0.7}
                    >
                        <Icon name="heart" size={24} color={isLiked ? '#10b981' : '#6b7280'} />
                        <Text style={{ fontSize: 14, color: isLiked ? '#10b981' : '#6b7280', fontWeight: 'bold' }}>{localLikeCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onCommentClick(post.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        activeOpacity={0.7}
                    >
                        <Icon name="message-circle" size={24} color="#6b7280" />
                        <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: 'bold' }}>{post.stats.comments || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        activeOpacity={0.7}
                    >
                        <Icon name="share" size={24} color="#6b7280" />
                        <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: 'bold' }}>{post.stats.shares || 0}</Text>
                    </TouchableOpacity>
                </View>
                {/* Liked Users Display */}
                {localLikedUsers.length > 0 && (
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
                                    }}
                                >
                                    {user.profileImage ? (
                                        <Image
                                            source={{ uri: user.profileImage }}
                                            style={{ width: 32, height: 32, borderRadius: 16 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: 'bold' }}>{user.firstName?.charAt(0)}</Text>
                                    )}
                                </View>
                            ))}
                        </View>
                        {localLikedUsers.length > 3 && (
                            <Text style={{ color: '#6b7280', fontSize: 13 }}>+{localLikedUsers.length - 3} more</Text>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
};

export default PollCardSection;
