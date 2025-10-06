import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    TextInput,
    Modal,
    Alert,
    Dimensions,
    ActivityIndicator
} from 'react-native';
// import { MessageSquare, User, Clock, Calendar, Eye, Bookmark, Heart, Share2 } from 'lucide-react-native';
// TODO: Comment out Firebase setup for later implementation
// import { useParams, useRouter } from 'next/navigation';
// import Image from 'next/image';
// import Link from 'next/link';
// import {
//     ArrowLeft, Clock, Heart, Bookmark, Share2, MessageSquare,
//     Facebook, Twitter, Linkedin, Link2, ChevronDown, ChevronUp,
//     User, Calendar, Eye, ThumbsUp, Send
// } from 'lucide-react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { Avatar, Button, Chip, Tooltip, Textarea, Divider, Dropdown, DropdownTrigger, DropdownItem, DropdownMenu } from "@nextui-org/react";
// import { db } from '@/lib/firebaseConfig';
// import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

export default function BlogDetail() {
    // TODO: Replace with React Native navigation when Firebase is implemented
    // const router = useRouter();
    // const params = useParams();
    // const blogId = params.id as string;
    const blogId = 'mock-blog-id'; // Mock for now

    const [blog, setBlog] = useState<any>(null);
    const [author, setAuthor] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [showSources, setShowSources] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [showCommentForm, setShowCommentForm] = useState(false);

    useEffect(() => {
        const fetchBlogAndAuthor = async () => {
            setIsLoading(true);
            try {
                // TODO: Replace with actual API call when Firebase is implemented
                // const blogRef = doc(db, 'blogsAndArticles', blogId);
                // const blogSnap = await getDoc(blogRef);
                // if (!blogSnap.exists()) {
                //     setBlog(null);
                //     setIsLoading(false);
                //     return;
                // }
                // const blogData: any = { id: blogSnap.id, ...blogSnap.data() };
                // setBlog(blogData);
                // setLikesCount(blogData.likes || 0);

                // Mock data for now
                const mockBlog = {
                    id: '1',
                    title: 'Sample Blog Post',
                    content: 'This is a sample blog post content for demonstration purposes.',
                    category: 'Technology',
                    readTime: 5,
                    publishedDate: new Date().toISOString(),
                    viewCount: 1250,
                    coverImage: 'https://via.placeholder.com/800x400',
                    tags: ['React Native', 'Mobile Development', 'JavaScript'],
                    sources: [
                        {
                            title: 'React Native Documentation',
                            author: 'Meta',
                            publisher: 'Meta',
                            year: 2024,
                            url: 'https://reactnative.dev'
                        }
                    ],
                    relatedBlogs: [
                        {
                            id: '2',
                            title: 'Getting Started with React Native',
                            excerpt: 'Learn the basics of React Native development',
                            coverImage: 'https://via.placeholder.com/300x200',
                            author: { name: 'John Doe', avatar: 'https://via.placeholder.com/50x50' },
                            readTime: 3
                        }
                    ],
                    comments: [
                        {
                            id: '1',
                            user: { name: 'Jane Smith', avatar: 'https://via.placeholder.com/40x40' },
                            content: 'Great article! Very helpful.',
                            timestamp: new Date(Date.now() - 86400000).toISOString(),
                            likes: 5,
                            replies: []
                        }
                    ]
                };

                setBlog(mockBlog);
                setLikesCount(0);

                // Mock author data
                setAuthor({
                    name: 'John Doe',
                    avatar: 'https://via.placeholder.com/100x100',
                    bio: 'Experienced developer with passion for mobile development',
                    role: 'Senior Developer',
                    company: 'Tech Corp',
                    followersCount: 1250
                });
            } catch (e) {
                setBlog(null);
                setAuthor(null);
            }
            setIsLoading(false);
        };
        fetchBlogAndAuthor();
    }, [blogId]);

    // Handle like action
    const handleLike = () => {
        setIsLiked(!isLiked);
        setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
    };

    // Handle bookmark action
    const handleBookmark = () => {
        setIsBookmarked(!isBookmarked);
    };

    // Handle share action
    const handleShare = (platform: string) => {
        // In a real app, implement sharing functionality
        console.log(`Sharing on ${platform}`);
        Alert.alert('Share', `Sharing on ${platform} - functionality coming soon!`);
    };

    // Format date
    const formatDate = (dateString: string) => {
        const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    // Format time ago
    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
        return `${Math.floor(diffInSeconds / 31536000)} years ago`;
    };

    // Handle comment submission
    const handleSubmitComment = () => {
        if (!commentText.trim()) return;

        // In a real app, you would send this to your API
        console.log('Submitting comment:', commentText);
        setCommentText('');
        setShowCommentForm(false);

        // For demo purposes, we'll just show a success message
        Alert.alert('Success', 'Comment submitted successfully!');
    };

    // Render different content blocks
    const renderContentBlock = (block: any, index: number) => {
        switch (block.type) {
            case 'paragraph':
                return (
                    <Text key={index} style={{ color: '#374151', marginBottom: 24, lineHeight: 24 }}>
                        {block.content}
                    </Text>
                );

            case 'heading':
                if (block.level === 2) {
                    return (
                        <Text key={index} style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 32, marginBottom: 16 }}>
                            {block.content}
                        </Text>
                    );
                } else if (block.level === 3) {
                    return (
                        <Text key={index} style={{ fontSize: 20, fontWeight: '600', color: '#111827', marginTop: 24, marginBottom: 12 }}>
                            {block.content}
                        </Text>
                    );
                }
                return (
                    <Text key={index} style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 }}>
                        {block.content}
                    </Text>
                );

            case 'image':
                return (
                    <View key={index} style={{ marginVertical: 32 }}>
                        <Image
                            source={{ uri: 'https://imgv3.fotor.com/images/videoImage/wonderland-girl-generated-by-Fotor-ai-art-generator.jpg' }}
                            style={{
                                width: '100%',
                                height: block.position === 'center' ? 400 : 300,
                                borderRadius: 8
                            }}
                            resizeMode="cover"
                        />
                        {block.caption && (
                            <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 8, fontStyle: 'italic', textAlign: 'center' }}>
                                {block.caption}
                            </Text>
                        )}
                    </View>
                );

            case 'list':
                if (block.style === 'ordered') {
                    return (
                        <View key={index} style={{ marginBottom: 24 }}>
                            {block.items.map((item: any, i: number) => (
                                <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
                                    <Text style={{ color: '#374151', marginRight: 8 }}>{i + 1}.</Text>
                                    <Text style={{ color: '#374151', flex: 1 }}>
                                        {item.title && <Text style={{ fontWeight: '600' }}>{item.title}: </Text>}
                                        {item.content || item}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    );
                }
                return (
                    <View key={index} style={{ marginBottom: 24 }}>
                        {block.items.map((item: any, i: number) => (
                            <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
                                <Text style={{ color: '#374151', marginRight: 8 }}>•</Text>
                                <Text style={{ color: '#374151', flex: 1 }}>
                                    {item.title && <Text style={{ fontWeight: '600' }}>{item.title}: </Text>}
                                    {item.content || item}
                                </Text>
                            </View>
                        ))}
                    </View>
                );

            case 'quote':
                return (
                    <View key={index} style={{ borderLeftWidth: 4, borderLeftColor: '#10b981', paddingLeft: 16, marginVertical: 24 }}>
                        <Text style={{ marginBottom: 8, fontStyle: 'italic', color: '#374151' }}>{block.content}</Text>
                        {block.author && (
                            <Text style={{ fontSize: 14, color: '#6b7280' }}>— {block.author}</Text>
                        )}
                    </View>
                );

            case 'callout':
                return (
                    <View key={index} style={{
                        padding: 16,
                        borderRadius: 8,
                        marginVertical: 24,
                        backgroundColor: block.style === 'info' ? '#eff6ff' :
                            block.style === 'warning' ? '#fef3c7' :
                                block.style === 'success' ? '#ecfdf5' : '#f9fafb',
                        borderLeftWidth: 4,
                        borderLeftColor: block.style === 'info' ? '#3b82f6' :
                            block.style === 'warning' ? '#f59e0b' :
                                block.style === 'success' ? '#10b981' : '#6b7280'
                    }}>
                        {block.title && (
                            <Text style={{
                                fontWeight: '600',
                                marginBottom: 8,
                                color: block.style === 'info' ? '#1e40af' :
                                    block.style === 'warning' ? '#92400e' :
                                        block.style === 'success' ? '#065f46' : '#374151'
                            }}>
                                {block.title}
                            </Text>
                        )}
                        <Text style={{ color: '#374151' }}>{block.content}</Text>
                    </View>
                );

            case 'conclusion':
                return (
                    <View key={index} style={{ backgroundColor: '#f9fafb', padding: 24, borderRadius: 8, marginVertical: 32, borderTopWidth: 2, borderTopColor: '#10b981' }}>
                        <Text style={{ fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 12 }}>Conclusion</Text>
                        <Text style={{ color: '#374151' }}>{block.content}</Text>
                    </View>
                );

            default:
                return null;
        }
    };

    if (isLoading || !blog) {
        return (
            <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
                <ScrollView style={{ flex: 1, paddingTop: 48, paddingHorizontal: 8 }}>
                    <View style={{ maxWidth: 800, alignSelf: 'center', width: '100%' }}>
                        <View style={{ height: 32, width: 128, backgroundColor: '#e5e7eb', borderRadius: 4, marginBottom: 16 }} />
                        <View style={{ height: 48, backgroundColor: '#e5e7eb', borderRadius: 4, marginBottom: 24 }} />
                        <View style={{ height: 320, backgroundColor: '#e5e7eb', borderRadius: 4, marginBottom: 32 }} />
                        <View style={{ gap: 16 }}>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <View key={i} style={{ height: 16, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
            <ScrollView style={{ flex: 1, paddingTop: 48, paddingHorizontal: 8, paddingBottom: 64 }}>
                {/* Back button */}
                <View style={{ maxWidth: 800, alignSelf: 'center', width: '100%', marginBottom: 24 }}>
                    <TouchableOpacity
                        onPress={() => {
                            // TODO: Replace with React Native navigation when Firebase is implemented
                            // router.push('/blogs');
                            Alert.alert('Navigation', 'Back navigation coming soon!');
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                        <Text style={{ fontSize: 18, marginRight: 8 }}>←</Text>
                        <Text style={{ color: '#6b7280' }}>Back to Blogs</Text>
                    </TouchableOpacity>
                </View>

                {/* Article Header */}
                <View style={{ maxWidth: 800, alignSelf: 'center', width: '100%', backgroundColor: '#ffffff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, overflow: 'hidden' }}>
                    {/* Category and metadata */}
                    <View style={{ padding: 24, paddingTop: 24 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <View style={{ backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                                <Text style={{ color: '#005bc4', fontSize: 12, fontWeight: '400' }}>{blog.category}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 14, marginRight: 4 }}>🕒</Text>
                                <Text style={{ color: '#6b7280', fontSize: 14 }}>{blog.readTime} min read</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 14, marginRight: 4 }}>📅</Text>
                                <Text style={{ color: '#6b7280', fontSize: 14 }}>{formatDate(blog.publishedDate)}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 14, marginRight: 4 }}>👁️</Text>
                                <Text style={{ color: '#6b7280', fontSize: 14 }}>{(blog.viewCount || 0).toLocaleString()} views</Text>
                            </View>
                        </View>

                        {/* Title */}
                        <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#111827', marginBottom: 24, lineHeight: 36 }}>
                            {blog.title}
                        </Text>

                        {/* Author info */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Image
                                    source={{ uri: 'https://www.w3schools.com/w3images/avatar2.png' }}
                                    style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                                />
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ fontWeight: '600', color: '#111827' }}>{author?.name}</Text>
                                        <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#e1effe', borderRadius: 12 }}>
                                            <Text style={{ color: '#1e429f', fontSize: 12 }}>Author</Text>
                                        </View>
                                    </View>
                                    {(author?.role || author?.company) && (
                                        <Text style={{ color: '#cfd1d4', marginTop: 3 }}>
                                            {author?.role}{author?.role && author?.company ? ' at ' : ''}{author?.company}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity
                                style={{ backgroundColor: '#cfd1d4', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 14, marginRight: 4 }}>👤</Text>
                                    <Text style={{ color: '#005bc4', fontSize: 14, fontWeight: '400' }}> Follow</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Cover Image */}
                    <View style={{ height: 320, width: '100%', marginBottom: 32 }}>
                        <Image
                            source={{ uri: 'https://imgv3.fotor.com/images/videoImage/wonderland-girl-generated-by-Fotor-ai-art-generator.jpg' }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                    </View>

                    {/* Content */}
                    <View style={{ padding: 24, paddingTop: 0, paddingBottom: 32 }}>
                        {/* Tags */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                            {blog.tags?.map((tag: string) => (
                                <View key={tag} style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                                    <Text style={{ color: '#374151', fontSize: 14 }}>{tag}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Article content */}
                        <View style={{ maxWidth: '100%' }}>
                            {Array.isArray(blog.content)
                                ? blog.content.map((block: any, index: number) => renderContentBlock(block, index))
                                : blog.content
                                    ? <Text style={{ color: '#374151', marginBottom: 24, lineHeight: 24 }}>{blog.content}</Text>
                                    : null
                            }
                        </View>

                        {/* Sources/References */}
                        <View style={{ marginTop: 48 }}>
                            <TouchableOpacity
                                onPress={() => setShowSources(!showSources)}
                                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
                            >
                                <Text style={{ fontSize: 18, marginRight: 8 }}>
                                    {showSources ? '▲' : '▼'}
                                </Text>
                                <Text style={{ color: '#374151', fontWeight: '500' }}>
                                    Sources & References ({blog.sources?.length || 0})
                                </Text>
                            </TouchableOpacity>

                            {showSources && (
                                <View style={{ backgroundColor: '#f9fafb', padding: 16, borderRadius: 8 }}>
                                    <View style={{ gap: 12 }}>
                                        {blog.sources?.map((source: any, index: number) => (
                                            <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                                <Text style={{ color: '#6b7280', marginRight: 8, marginTop: 2 }}>{index + 1}.</Text>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontWeight: '200', color: '#374151' }}>{source.title}</Text>
                                                    <Text style={{ color: '#6b7280' }}> by {source.author}. </Text>
                                                    <Text style={{ color: '#6b7280' }}>{source.publisher}, {source.year}. </Text>
                                                    {source.url && (
                                                        <TouchableOpacity>
                                                            <Text style={{ color: '#3b82f6', textDecorationLine: 'underline' }}>
                                                                View source
                                                            </Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Action bar */}
                        <View style={{ marginTop: 40, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                                    <TouchableOpacity
                                        onPress={handleLike}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            backgroundColor: isLiked ? '#01eb53' : 'transparent',
                                            borderWidth: 1,
                                            borderColor: isLiked ? '#01eb53' : '#d1d5db',
                                            justifyContent: 'center',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text style={{ fontSize: 20, color: isLiked ? '#01eb53' : '#6b7280' }}>❤️</Text>

                                    </TouchableOpacity>
                                    <Text style={{ color: '#374151' }}>{likesCount}</Text>

                                    <TouchableOpacity
                                        onPress={handleBookmark}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            backgroundColor: isBookmarked ? '#01eb53' : 'transparent',
                                            borderWidth: 1,
                                            borderColor: isBookmarked ? '#01eb53' : '#d1d5db',
                                            justifyContent: 'center',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text style={{ fontSize: 20, color: isBookmarked ? '#01eb53' : '#6b7280' }}>🔖</Text>

                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            Alert.alert(
                                                'Share',
                                                'Choose sharing platform',
                                                [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    { text: 'Facebook', onPress: () => handleShare('facebook') },
                                                    { text: 'Twitter', onPress: () => handleShare('twitter') },
                                                    { text: 'LinkedIn', onPress: () => handleShare('linkedin') },
                                                    { text: 'Copy Link', onPress: () => handleShare('copy') }
                                                ]
                                            );
                                        }}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            borderWidth: 1,
                                            borderColor: '#d1d5db',
                                            justifyContent: 'center',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text style={{ fontSize: 16 }}>📤</Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={{ backgroundColor: '#cfd1d4', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
                                    onPress={() => setShowCommentForm(!showCommentForm)}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, color: '#01eb53', marginRight: 4 }}>💬</Text>
                                        <Text style={{ color: '#01eb53', fontSize: 14, fontWeight: '200', flexDirection: 'row' }}> Add Comment</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Comment form */}
                            {showCommentForm && (
                                <View style={{ marginTop: 24, backgroundColor: '#f9fafb', padding: 16, borderRadius: 8 }}>
                                    <TextInput
                                        placeholder="Share your thoughts..."
                                        value={commentText}
                                        onChangeText={setCommentText}
                                        multiline
                                        numberOfLines={3}
                                        style={{
                                            borderWidth: 1,
                                            borderColor: '#d1d5db',
                                            borderRadius: 8,
                                            padding: 12,
                                            fontSize: 16,
                                            marginBottom: 12,
                                            backgroundColor: '#ffffff'
                                        }}
                                    />
                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                                        <TouchableOpacity
                                            style={{ paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}
                                            onPress={() => setShowCommentForm(false)}
                                        >
                                            <Text style={{ color: '#374151', fontSize: 16 }}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={{
                                                paddingVertical: 12,
                                                paddingHorizontal: 16,
                                                backgroundColor: '#01eb53',
                                                opacity: commentText.trim() ? 1 : 0.5,
                                                borderRadius: 8
                                            }}
                                            onPress={handleSubmitComment}
                                            disabled={!commentText.trim()}
                                        >
                                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '400' }}>Post Comment</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Author Bio */}
                <View style={{ maxWidth: 800, alignSelf: 'center', width: '100%', marginTop: 32, backgroundColor: '#ffffff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, padding: 24 }}>
                    <Text style={{ fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 16 }}>About the Author</Text>
                    <View style={{ flexDirection: 'row', gap: 24 }}>
                        <Image
                            source={{ uri: 'https://www.w3schools.com/w3images/avatar2.png' }}
                            style={{ width: 96, height: 96, borderRadius: 48 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8 }}>{author?.name}</Text>
                            <Text style={{ color: '#6b7280', marginBottom: 12 }}>{author?.role} at {author?.company}</Text>
                            <Text style={{ color: '#374151', marginBottom: 16, lineHeight: 20 }}>{author?.bio}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                <Text style={{ fontSize: 14, color: '#6b7280' }}>
                                    <Text style={{ fontWeight: '600', color: '#111827' }}>{author?.followersCount}</Text> followers
                                </Text>
                                <TouchableOpacity
                                    style={{ backgroundColor: '#01eb53', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
                                >
                                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '200' }}>Follow</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Related Blogs */}
                <View style={{ maxWidth: 800, alignSelf: 'center', width: '100%', marginTop: 32 }}>
                    <Text style={{ fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 24 }}>You Might Also Like</Text>
                    <View style={{ gap: 24 }}>
                        {blog.relatedBlogs?.map((relatedBlog: any) => (
                            <TouchableOpacity
                                key={relatedBlog.id}
                                style={{ backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
                                onPress={() => {
                                    // TODO: Replace with React Native navigation when Firebase is implemented
                                    // router.push(`/blogs/${relatedBlog.id}`);
                                    Alert.alert('Navigation', 'Blog navigation coming soon!');
                                }}
                            >
                                <Image
                                    source={{ uri: relatedBlog.coverImage || 'https://via.placeholder.com/300x200' }}
                                    style={{ width: '100%', height: 160 }}
                                    resizeMode="cover"
                                />
                                <View style={{ padding: 16 }}>
                                    <Text style={{ fontWeight: '600', color: '#111827', marginBottom: 8, fontSize: 16 }} numberOfLines={2}>{relatedBlog.title}</Text>
                                    <Text style={{ color: '#6b7280', marginBottom: 12, fontSize: 14 }} numberOfLines={2}>{relatedBlog.excerpt}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Image
                                                source={{ uri: relatedBlog.author?.avatar || 'https://via.placeholder.com/50x50' }}
                                                style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8 }}
                                            />
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>{relatedBlog.author?.name}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, marginRight: 4 }}>🕒</Text>
                                            <Text style={{ fontSize: 12, color: '#6b7280' }}>{relatedBlog.readTime} min</Text>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Comments Section */}
                <View style={{ maxWidth: 800, alignSelf: 'center', width: '100%', marginTop: 32, backgroundColor: '#ffffff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, padding: 24 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <Text style={{ fontSize: 20, fontWeight: '600', color: '#111827' }}>
                            Comments ({blog.comments?.length || 0})
                        </Text>
                        <TouchableOpacity
                            style={{ backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
                            onPress={() => setShowCommentForm(!showCommentForm)}
                        >
                            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>💬 Add Comment</Text>
                        </TouchableOpacity>
                    </View>

                    {blog.comments?.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
                            <Text style={{ color: '#6b7280', textAlign: 'center' }}>No comments yet. Be the first to share your thoughts!</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 24 }}>
                            {blog.comments?.map((comment: any) => (
                                <View key={comment.id} style={{ borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 24 }}>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <Image
                                            source={{ uri: comment.user?.avatar }}
                                            style={{ width: 40, height: 40, borderRadius: 20 }}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <Text style={{ fontWeight: '600', color: '#111827' }}>{comment.user?.name}</Text>
                                                <Text style={{ fontSize: 12, color: '#6b7280' }}>{formatTimeAgo(comment.timestamp)}</Text>
                                            </View>
                                            <Text style={{ color: '#374151', marginBottom: 8, lineHeight: 20 }}>{comment.content}</Text>
                                            <View style={{ flexDirection: 'row', gap: 16 }}>
                                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Text style={{ fontSize: 14, marginRight: 4 }}>👍</Text>
                                                    <Text style={{ fontSize: 14, color: '#6b7280' }}>{comment.likes}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity>
                                                    <Text style={{ fontSize: 14, color: '#6b7280' }}>Reply</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {/* Replies */}
                                            {comment.replies && comment.replies.length > 0 && (
                                                <View style={{ marginTop: 16, gap: 16, paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: '#f3f4f6' }}>
                                                    {comment.replies.map((reply: any) => (
                                                        <View key={reply.id} style={{ flexDirection: 'row', gap: 12 }}>
                                                            <Image
                                                                source={{ uri: reply.user?.avatar }}
                                                                style={{ width: 32, height: 32, borderRadius: 16 }}
                                                            />
                                                            <View>
                                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                                    <Text style={{ fontWeight: '600', color: '#111827' }}>{reply.user?.name}</Text>
                                                                    <Text style={{ fontSize: 12, color: '#6b7280' }}>{formatTimeAgo(reply.timestamp)}</Text>
                                                                </View>
                                                                <Text style={{ color: '#374151', marginBottom: 8, lineHeight: 20 }}>{reply.content}</Text>
                                                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <Text style={{ fontSize: 14, marginRight: 4 }}>👍</Text>
                                                                    <Text style={{ fontSize: 14, color: '#6b7280' }}>{reply.likes}</Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView >
        </View >
    );
}