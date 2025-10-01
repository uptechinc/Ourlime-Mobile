import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from "react-native";
import Icon from 'react-native-vector-icons/Feather';
import { CreatePostSection } from "./MiddleSectionComponent/CreatePostSection/CreatePostSection";
import { FeedsFilterSection } from "./MiddleSectionComponent/FeedsFilterSection/FeedsFilterSection";
import MemoriesSection from "./MiddleSectionComponent/MemoriesSection/MemoriesSection";
import PostCardSection from "./MiddleSectionComponent/PostCardSection/PostCardSection";
import PollCardSection from "./MiddleSectionComponent/PostCardSection/PollCardSection";
import ReelCardSection from "./MiddleSectionComponent/PostCardSection/ReelCardSection";
import CommentsModal from './MiddleSectionComponent/CommentsModal/CommentsModal';
import { Reel } from '@/types/userTypes';

interface LocalUser {
    id: string;
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
    emailVerified?: boolean;
    isAdmin?: boolean;
}

interface LocalPost {
    id: string;
    userId: string;
    user: LocalUser;
    type?: string;
    caption?: string;
    description?: string;
    hashtags?: string[];
    media?: { type: 'image' | 'video'; typeUrl: string; id?: string }[];
    stats: { likes: number; comments: number; shares: number };
    likedUsers: LocalUser[];
    mentions?: string[];
    friendReferences?: string[];
    createdAt?: string;
    pollDuration?: number;
    pollOptions?: { id: string; text: string }[];
}

interface MiddleSectionProps {
    onCommentClick: (postId: string) => void;
    isCommentModalOpen: boolean;
    activePostId: string | null;
    currentUserId: string;
    onCloseModal: () => void;
    onCreatePost: () => void;
    setSelectedReel: (reel: Reel | null) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function MiddleSection({
    onCommentClick,
    onCreatePost,
    setSelectedReel,
}: Partial<MiddleSectionProps>) {
    const [posts, setPosts] = useState<LocalPost[]>([]);
    const [reels, setReels] = useState<Reel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilters, setActiveFilters] = useState<string[]>(['All']);
    const [visibleItems, setVisibleItems] = useState(3);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const filterRef = useRef<any>(null);
    const lastItemIndex = visibleItems - 1;
    const profileImage = null;
    const userId = 'TODO_USER_ID';

    useEffect(() => {
        // Simulate fetching posts and reels
        setTimeout(() => {
            // Sample users
            const users: LocalUser[] = [
                {
                    id: 'u1',
                    firstName: 'John',
                    lastName: 'Doe',
                    userName: 'johndoe',
                    profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
                    emailVerified: true,
                },
                {
                    id: 'u2',
                    firstName: 'Alice',
                    lastName: 'Smith',
                    userName: 'alicesmith',
                    profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
                    emailVerified: true,
                },
                {
                    id: 'u3',
                    firstName: 'Mike',
                    lastName: 'Johnson',
                    userName: 'mikej',
                    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
                    emailVerified: false,
                },
                {
                    id: 'u4',
                    firstName: 'Sarah',
                    lastName: 'Wilson',
                    userName: 'sarahw',
                    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
                    emailVerified: true,
                },
                {
                    id: 'u5',
                    firstName: 'David',
                    lastName: 'Brown',
                    userName: 'davidb',
                    profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
                    emailVerified: false,
                },
                {
                    id: 'u6',
                    firstName: 'Emma',
                    lastName: 'Davis',
                    userName: 'emmad',
                    profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
                    emailVerified: true,
                },
            ];

            // Sample posts
            const samplePosts: LocalPost[] = [
                {
                    id: '1',
                    userId: 'u1',
                    user: users[0],
                    type: 'regular',
                    caption: 'What an amazing sunset! 🌅',
                    description: 'Nature never fails to inspire me. This view from the mountain top was absolutely breathtaking. Sometimes you just need to step away from the hustle and bustle to appreciate the simple beauty around us. ✨',
                    hashtags: ['sunset', 'nature', 'inspiration', 'photography'],
                    media: [{
                        type: 'image',
                        typeUrl: 'https://images.unsplash.com/photo-1506905925346-14bda2d4c4c3?w=800&h=600&fit=crop',
                        id: 'img1'
                    }],
                    stats: { likes: 125, comments: 42, shares: 8 },
                    likedUsers: [users[1], users[2], users[3]],
                    mentions: [],
                    friendReferences: [],
                },
                {
                    id: '2',
                    userId: 'u2',
                    user: users[1],
                    type: 'poll',
                    caption: 'What\'s your favorite programming language?',
                    description: 'I\'m curious about the community\'s preferences. Let me know what you think!',
                    hashtags: ['programming', 'tech', 'poll'],
                    media: [],
                    stats: { likes: 89, comments: 67, shares: 12 },
                    likedUsers: [users[0], users[4]],
                    mentions: [],
                    friendReferences: [],
                    createdAt: new Date().toISOString(),
                    pollDuration: 24, // 24 hours
                    pollOptions: [
                        { id: 'opt1', text: 'JavaScript' },
                        { id: 'opt2', text: 'Python' },
                        { id: 'opt3', text: 'TypeScript' },
                        { id: 'opt4', text: 'Go' },
                        { id: 'opt5', text: 'Rust' },
                    ],
                },
                {
                    id: '3',
                    userId: 'u3',
                    user: users[2],
                    type: 'regular',
                    caption: 'Coffee and code ☕️',
                    description: 'Perfect way to start the day. Working on some exciting new features for our app!',
                    hashtags: ['coffee', 'coding', 'morning', 'work'],
                    media: [{
                        type: 'image',
                        typeUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&h=600&fit=crop',
                        id: 'img2'
                    }],
                    stats: { likes: 67, comments: 23, shares: 5 },
                    likedUsers: [users[1], users[5]],
                    mentions: [],
                    friendReferences: [],
                },
                {
                    id: '4',
                    userId: 'u4',
                    user: users[3],
                    type: 'regular',
                    caption: 'New recipe experiment! 🍳',
                    description: 'Tried making homemade pasta today. It was messier than expected but totally worth it! The taste is incredible.',
                    hashtags: ['cooking', 'pasta', 'homemade', 'food'],
                    media: [{
                        type: 'image',
                        typeUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop',
                        id: 'img3'
                    }],
                    stats: { likes: 156, comments: 34, shares: 15 },
                    likedUsers: [users[0], users[1], users[2], users[5]],
                    mentions: [],
                    friendReferences: [],
                },
                {
                    id: '5',
                    userId: 'u5',
                    user: users[4],
                    type: 'poll',
                    caption: 'Best way to stay productive?',
                    description: 'I\'m trying to optimize my daily routine. What works best for you?',
                    hashtags: ['productivity', 'routine', 'lifestyle'],
                    media: [],
                    stats: { likes: 78, comments: 45, shares: 9 },
                    likedUsers: [users[1], users[3]],
                    mentions: [],
                    friendReferences: [],
                    createdAt: new Date().toISOString(),
                    pollDuration: 48, // 48 hours
                    pollOptions: [
                        { id: 'opt1', text: 'Early morning workout' },
                        { id: 'opt2', text: 'Pomodoro technique' },
                        { id: 'opt3', text: 'Meditation' },
                        { id: 'opt4', text: 'Music while working' },
                    ],
                },
                {
                    id: '6',
                    userId: 'u6',
                    user: users[5],
                    type: 'regular',
                    caption: 'Weekend adventure! ��️',
                    description: 'Hiking in the mountains was exactly what I needed. Fresh air, beautiful views, and great company.',
                    hashtags: ['hiking', 'weekend', 'adventure', 'nature'],
                    media: [{
                        type: 'image',
                        typeUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&h=600&fit=crop',
                        id: 'img4'
                    }],
                    stats: { likes: 203, comments: 56, shares: 22 },
                    likedUsers: [users[0], users[1], users[2], users[3], users[4]],
                    mentions: [],
                    friendReferences: [],
                },
                {
                    id: '7',
                    userId: 'u1',
                    user: users[0],
                    type: 'regular',
                    caption: 'Tech stack update 📱',
                    description: 'Just migrated our frontend to React Native. The performance improvements are incredible!',
                    hashtags: ['reactnative', 'mobile', 'tech', 'development'],
                    media: [{
                        type: 'image',
                        typeUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop',
                        id: 'img5'
                    }],
                    stats: { likes: 134, comments: 78, shares: 18 },
                    likedUsers: [users[2], users[3], users[4], users[5]],
                    mentions: [],
                    friendReferences: [],
                },
                {
                    id: '8',
                    userId: 'u2',
                    user: users[1],
                    type: 'poll',
                    caption: 'Favorite mobile app category?',
                    description: 'What type of apps do you use most frequently?',
                    hashtags: ['mobile', 'apps', 'technology'],
                    media: [],
                    stats: { likes: 92, comments: 38, shares: 7 },
                    likedUsers: [users[0], users[4], users[5]],
                    mentions: [],
                    friendReferences: [],
                    createdAt: new Date().toISOString(),
                    pollDuration: 72, // 72 hours
                    pollOptions: [
                        { id: 'opt1', text: 'Social Media' },
                        { id: 'opt2', text: 'Productivity' },
                        { id: 'opt3', text: 'Entertainment' },
                        { id: 'opt4', text: 'Health & Fitness' },
                        { id: 'opt5', text: 'Education' },
                    ],
                },
            ];

            // Sample reels
            const sampleReels: Reel[] = [
                {
                    id: 'reel1',
                    user: {
                        firstName: 'John',
                        lastName: 'Doe',
                        userName: 'johndoe',
                        profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
                    },
                    userId: 'u1',
                    visibility: 'public',
                    caption: 'Amazing sunset view!',
                    media: {
                        typeUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        type: 'video',
                        fileName: 'sunset_video.mp4',
                        duration: 120, // 2 minutes in seconds
                    },
                    likes: ['user1', 'user2', 'user3'],
                    comments: [],
                    //views: 1250,
                    createdAt: new Date(),
                },
            ];

            setPosts(samplePosts);
            setReels(sampleReels);
            setIsLoading(false);
        }, 1000);
    }, [userId]);

    const handleFilterChange = (filter: string) => {
        if (filter === 'All') {
            setActiveFilters(['All']);
            return;
        }
        setActiveFilters(prev => {
            const newFilters = prev.filter(f => f !== 'All');
            const updatedFilters = newFilters.includes(filter)
                ? newFilters.filter(f => f !== filter)
                : [...newFilters, filter];
            return updatedFilters.length === 0 ? ['All'] : updatedFilters;
        });
    };

    // const scroll = (direction: 'left' | 'right') => {
    //     // Omit scroll logic for now
    // };

    const filteredContent = posts.filter(content => {
        if (activeFilters.includes('All')) return true;
        return activeFilters.some(filter => {
            switch (filter) {
                case 'Photos':
                    return Array.isArray(content.media) && content.media.some(media => media.type === 'image');
                case 'Videos':
                    return Array.isArray(content.media) && content.media.some(media => media.type === 'video');
                case 'Polls':
                    return content.type === 'poll';
                default:
                    return false;
            }
        });
    });

    useEffect(() => {
        if (visibleItems < filteredContent.length) {
            setIsLoadingMore(true);
            setTimeout(() => {
                setVisibleItems(prev => prev + 1);
                setIsLoadingMore(false);
            }, 1000);
        }
    }, [visibleItems, filteredContent.length]);

    const handleCommentClick = (postId: string) => {
        setActivePostId(postId);
        setIsCommentModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsCommentModalOpen(false);
        setActivePostId(null);
    };

    return (
        <ScrollView 
            style={{ 
                flex: 1, 
                backgroundColor: '#f8f9fa', 
            }} 
            contentContainerStyle={{ 
                paddingBottom: 50,
                paddingTop: 16,
            }}
            showsVerticalScrollIndicator={false}
        >
            {/* Create Post Section */}
            <View style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                marginHorizontal: 16,
                padding: 20,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: {
                    width: 0,
                    height: 2,
                },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 3,
            }}>
                <CreatePostSection onCreatePost={onCreatePost || (() => {})} />
            </View>
            
            {/* Filter Section */}
            <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginBottom: 16,
                marginHorizontal: 16,
            }}>
                {/* <TouchableOpacity
                    onPress={() => scroll('left')}
                    style={{ 
                        padding: 12, 
                        borderRadius: 25, 
                        backgroundColor: '#fff',
                        marginRight: 12,
                        shadowColor: '#000',
                        shadowOffset: {
                            width: 0,
                            height: 2,
                        },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                    }}
                >
                    <Icon name="chevron-left" size={20} color="#10b981" />
                </TouchableOpacity> */}
                <View style={{ flex: 1 }}>
                    <FeedsFilterSection
                        ref={filterRef}
                        activeFilters={activeFilters}
                        onFilterChange={handleFilterChange}
                    />
                </View>
                {/* <TouchableOpacity
                    onPress={() => scroll('right')}
                    style={{ 
                        padding: 12, 
                        borderRadius: 25, 
                        backgroundColor: '#fff',
                        marginLeft: 12,
                        shadowColor: '#000',
                        shadowOffset: {
                            width: 0,
                            height: 2,
                        },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                    }}
                >
                    <Icon name="chevron-right" size={20} color="#10b981" />
                </TouchableOpacity> */}
            </View>    
            
            {/* Memories Section */}
            <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
                <MemoriesSection profileImage={profileImage} />
            </View>
            
            {/* Reels Section */}
            {/* {reels.length > 0 && (
                <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
                    <ReelCardSection 
                        reels={reels} 
                        onCommentClick={handleCommentClick} 
                        setSelectedReel={setSelectedReel || (() => {})}
                    />
                </View>
            )} */}
            
            {/* Posts Section */}
            <View style={{ marginTop: 8 }}>
                {isLoading ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', height: 128 }}>
                        <ActivityIndicator size="large" color="#10b981" />
                    </View>
                ) : filteredContent.length === 0 ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 400, padding: 32 }}>
                        <Icon name="search" size={64} color="#10b981" style={{ opacity: 0.3, marginBottom: 24 }} />
                        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#10b981', marginBottom: 8 }}>
                            {activeFilters.includes('All')
                                ? 'Your feed is empty'
                                : activeFilters.map(filter => `No ${filter} found`).join(' & ')}
                        </Text>
                        <View style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            gap: 8, 
                            marginTop: 16, 
                            backgroundColor: '#f3f4f6', 
                            borderRadius: 9999, 
                            paddingHorizontal: 16, 
                            paddingVertical: 8 
                        }}>
                            <Icon name="refresh-cw" size={20} color="#10b981" />
                            <Text style={{ color: '#6b7280', fontSize: 15 }}>
                                {activeFilters.includes('All')
                                    ? 'Be the first to create a post!'
                                    : `We couldn't find any ${activeFilters.join(' or ')} content at the moment`}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <>
                        {filteredContent.slice(0, visibleItems).map((content, index) => (
                            <View key={content.id} style={{ marginHorizontal: 16, marginBottom: 16 }}>
                                {content.type === 'poll' ? (
                                    <PollCardSection post={content} onCommentClick={handleCommentClick} />
                                ) : (
                                    <PostCardSection post={content} onCommentClick={handleCommentClick} />
                                )}
                            </View>
                        ))}
                        {isLoadingMore && (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 16 }}>
                                <ActivityIndicator size="large" color="#10b981" />
                            </View>
                        )}
                    </>
                )}
            </View>
            
            {isCommentModalOpen && activePostId && (
                <CommentsModal
                    postId={activePostId}
                    userId={userId}
                    onClose={handleCloseModal}
                />
            )}
        </ScrollView>
    );
}