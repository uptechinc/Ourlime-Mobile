import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from "react-native";
import Icon from 'react-native-vector-icons/Feather';
import { CreatePostSection } from "./MiddleSectionComponent/CreatePostSection/CreatePostSection";
import { FeedsFilterSection } from "./MiddleSectionComponent/FeedsFilterSection/FeedsFilterSection";
import MemoriesSection from "./MiddleSectionComponent/MemoriesSection/MemoriesSection";
import PostCardSection from "./MiddleSectionComponent/PostCardSection/PostCardSection";
import PollCardSection from "./MiddleSectionComponent/PostCardSection/PollCardSection";
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
    userId: string; // Added userId
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
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilters, setActiveFilters] = useState<string[]>(['All']);
    const [visibleItems, setVisibleItems] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const filterRef = useRef<any>(null);
    const lastItemIndex = visibleItems - 1;
    const profileImage = null; // Fix: should be null or { imageURL?: string }
    const userId = 'TODO_USER_ID'; // Omit profile store for now

    useEffect(() => {
        // Simulate fetching posts
        setTimeout(() => {
            setPosts([
                {
                    id: '1',
                    userId: 'u1', // Fix: add userId
                    user: {
                        id: 'u1',
                        firstName: 'John',
                        lastName: 'Doe',
                        userName: 'johndoe',
                        profileImage: undefined,
                    },
                    type: 'regular',
                    caption: 'Sample post',
                    description: 'This is a sample post description.',
                    hashtags: ['sample', 'post'],
                    media: [],
                    stats: { likes: 5, comments: 2, shares: 1 }, // Ensure all fields are present
                    likedUsers: [],
                    mentions: [],
                    friendReferences: [],
                },
                {
                    id: '2',
                    userId: 'u2', // Fix: add userId
                    user: {
                        id: 'u2',
                        firstName: 'Alice',
                        lastName: 'Smith',
                        userName: 'alicesmith',
                        profileImage: undefined,
                    },
                    type: 'poll',
                    caption: 'Sample poll',
                    description: 'This is a sample poll description.',
                    hashtags: ['poll'],
                    media: [],
                    stats: { likes: 3, comments: 1, shares: 0 }, // Ensure all fields are present
                    likedUsers: [],
                    mentions: [],
                    friendReferences: [],
                },
            ]);
            setIsLoading(false);
        }, 500);
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

    const scroll = (direction: 'left' | 'right') => {
        // Omit scroll logic for now
    };

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
        <ScrollView style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16 }} contentContainerStyle={{ paddingBottom: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <TouchableOpacity
                    onPress={() => scroll('left')}
                    style={{ padding: 8, borderRadius: 9999, backgroundColor: '#f3f4f6', marginRight: 8 }}
                >
                    <Icon name="chevron-left" size={20} color="#10b981" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <FeedsFilterSection
                        ref={filterRef}
                        activeFilters={activeFilters}
                        onFilterChange={handleFilterChange}
                    />
                </View>
                <TouchableOpacity
                    onPress={() => scroll('right')}
                    style={{ padding: 8, borderRadius: 9999, backgroundColor: '#f3f4f6', marginLeft: 8 }}
                >
                    <Icon name="chevron-right" size={20} color="#10b981" />
                </TouchableOpacity>
            </View>
            <CreatePostSection onCreatePost={onCreatePost || (() => {})} />
            <MemoriesSection profileImage={profileImage} />
            <View style={{ marginTop: 16 }}>
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, backgroundColor: '#f3f4f6', borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8 }}>
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
                            <View key={content.id}>
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
