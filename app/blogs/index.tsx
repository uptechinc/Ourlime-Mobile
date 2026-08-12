import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
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
} from 'react-native';
// TODO: Comment out Firebase setup for later implementation
// import { useRouter } from 'next/navigation';
// import Image from 'next/image';
// import {
//     Search, Clock, Heart, Bookmark, ChevronRight, TrendingUp,
//     Grid, List, Filter, ArrowUp, Share2, MessageSquare, Plus
// } from 'lucide-react';
// import { motion } from 'framer-motion';
// import { Input, Button, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import CreateBlogModal from '@/components/blogs/CreateBlogModal';
import { useProfileStore } from '@/src/store/useProfileStore';
import PageHeader from '@/components/ui/PageHeader';

// Sample data for static display
const SAMPLE_BLOGS = [
    {
        id: '1',
        title: 'The Future of Sustainable Technology in Urban Environments',
        excerpt: 'Exploring how green tech innovations are reshaping our cities and creating more sustainable urban spaces for future generations.',
        coverImage: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
        author: {
            id: 'author1',
            name: 'Alex Morgan',
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80'
        },
        category: 'Technology',
        tags: ['Sustainability', 'Urban Planning', 'Innovation'],
        readTime: 8,
        publishedDate: '2023-10-15T10:30:00Z',
        likes: 342,
        comments: 56,
        isFeatured: true,
        isTrending: true
    },
    {
        id: '2',
        title: 'Mindfulness Practices for the Modern Professional',
        excerpt: 'Discover practical mindfulness techniques that can be integrated into your busy work schedule to reduce stress and increase productivity.',
        coverImage: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
        author: {
            id: 'author2',
            name: 'Samantha Lee',
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80'
        },
        category: 'Wellness',
        tags: ['Mindfulness', 'Productivity', 'Mental Health'],
        readTime: 6,
        publishedDate: '2023-10-12T14:45:00Z',
        likes: 287,
        comments: 42,
        isFeatured: true,
        isTrending: false
    },
    {
        id: '3',
        title: 'The Art of Storytelling in Digital Marketing',
        excerpt: 'How crafting compelling narratives can transform your brand messaging and create deeper connections with your audience.',
        coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
        author: {
            id: 'author3',
            name: 'Marcus Johnson',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80'
        },
        category: 'Marketing',
        tags: ['Digital Marketing', 'Storytelling', 'Branding'],
        readTime: 7,
        publishedDate: '2023-10-10T09:15:00Z',
        likes: 215,
        comments: 38,
        isFeatured: true,
        isTrending: true
    },
    {
        id: '4',
        title: 'Decoding Cryptocurrency: A Beginner\'s Guide',
        excerpt: 'Understanding the basics of blockchain technology and how cryptocurrencies are changing the financial landscape.',
        coverImage: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
        author: {
            id: 'author4',
            name: 'Priya Patel',
            avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1488&q=80'
        },
        category: 'Finance',
        tags: ['Cryptocurrency', 'Blockchain', 'Investing'],
        readTime: 10,
        publishedDate: '2023-10-08T16:20:00Z',
        likes: 198,
        comments: 45,
        isFeatured: false,
        isTrending: true
    },
    {
        id: '5',
        title: 'The Science of Sleep: Why Quality Rest Matters',
        excerpt: 'Exploring the latest research on sleep patterns and how proper rest affects your physical health, cognitive function, and emotional wellbeing.',
        coverImage: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1460&q=80',
        author: {
            id: 'author5',
            name: 'Dr. James Wilson',
            avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1374&q=80'
        },
        category: 'Health',
        tags: ['Sleep', 'Wellness', 'Neuroscience'],
        readTime: 9,
        publishedDate: '2023-10-05T11:30:00Z',
        likes: 276,
        comments: 31,
        isFeatured: false,
        isTrending: false
    },
    {
        id: '6',
        title: 'Remote Work Revolution: Building Effective Virtual Teams',
        excerpt: 'Strategies for creating cohesive, productive remote teams in the post-pandemic workplace landscape.',
        coverImage: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
        author: {
            id: 'author6',
            name: 'Olivia Chen',
            avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&q=80'
        },
        category: 'Business',
        tags: ['Remote Work', 'Team Management', 'Productivity'],
        readTime: 7,
        publishedDate: '2023-10-03T13:45:00Z',
        likes: 234,
        comments: 47,
        isFeatured: false,
        isTrending: true
    },
    {
        id: '7',
        title: 'Ethical AI: Navigating the Future of Artificial Intelligence',
        excerpt: 'Examining the ethical considerations and challenges in developing responsible AI systems that benefit humanity.',
        coverImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
        author: {
            id: 'author7',
            name: 'Dr. Aiden Kim',
            avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1480&q=80'
        },
        category: 'Technology',
        tags: ['Artificial Intelligence', 'Ethics', 'Future Tech'],
        readTime: 11,
        publishedDate: '2023-10-01T10:15:00Z',
        likes: 312,
        comments: 63,
        isFeatured: false,
        isTrending: false
    },
    {
        id: '8',
        title: 'Sustainable Fashion: The Rise of Eco-Conscious Clothing',
        excerpt: 'How the fashion industry is transforming to address environmental concerns and meet consumer demand for sustainable options.',
        coverImage: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
        author: {
            id: 'author8',
            name: 'Isabella Martinez',
            avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1374&q=80'
        },
        category: 'Lifestyle',
        tags: ['Sustainable Fashion', 'Eco-Friendly', 'Ethical Consumption'],
        readTime: 8,
        publishedDate: '2023-09-28T15:30:00Z',
        likes: 245,
        comments: 39,
        isFeatured: false,
        isTrending: false
    }
];

const CATEGORIES = [
    'All', 'Technology', 'Wellness', 'Marketing', 'Finance',
    'Health', 'Business', 'Lifestyle', 'Education', 'Travel'
];

const POPULAR_TAGS = [
    'Technology', 'Wellness', 'Sustainability', 'Marketing',
    'Finance', 'Productivity', 'Innovation', 'Mental Health',
    'Remote Work', 'Artificial Intelligence'
];

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest First', icon: '🕒' },
    { value: 'oldest', label: 'Oldest First', icon: '📅' },
    { value: 'popular', label: 'Most Popular', icon: '🔥' },
    { value: 'comments', label: 'Most Comments', icon: '💬' }
];

export default function Blogs() {
    // TODO: Replace with React Native navigation when Firebase is implemented
    const router = useRouter();
    const { id: userId } = useProfileStore();
    const scrollViewRef = useRef<ScrollView>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [viewMode] = useState<'grid' | 'list'>('list');
    const [sortBy, setSortBy] = useState('newest');
    const [showBackToTop] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [blogs, setBlogs] = useState<{
        id: string;
        title: string;
        excerpt?: string;
        coverImage?: string;
        author?: { id?: string; name?: string; avatar?: string };
        category?: string;
        categories?: { name: string }[];
        tags?: (string | { name?: string })[];
        readTime?: number;
        publishedDate?: string;
        createdAt?: { seconds?: number; toDate?: () => Date } | string | Date;
        likes?: number;
        comments?: number;
        engagement?: { likes?: number; comments?: number; shares?: number };
        isFeatured?: boolean;
        isTrending?: boolean;
    }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(6);
    const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

    // Fetch blogs from database
    const fetchBlogs = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // TODO: Replace with actual API call when Firebase is implemented
            // const service = BlogsAndArticlesService.getInstance();
            // const data = await service.getPosts();
            // setBlogs(data);

            // Mock data for now
            setBlogs(SAMPLE_BLOGS);
        } catch {
            setError('Failed to load blogs');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBlogs();
    }, []);

    // Handle scroll for back to top button
    useEffect(() => {
        // TODO: Implement scroll handling for React Native
        // const handleScroll = () => {
        //     setShowBackToTop(window.scrollY > 300);
        // };
        // window.addEventListener('scroll', handleScroll);
        // return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Filter blogs based on search and category
    const filteredBlogs = blogs.filter(blog => {
        const matchesSearch = searchQuery === '' ||
            (blog.title && blog.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (blog.excerpt && blog.excerpt.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (blog.tags && blog.tags.some((tag) => (typeof tag === 'string' ? tag : tag.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())));

        const matchesCategory = selectedCategory === 'All' || blog.category === selectedCategory || (blog.categories && blog.categories.some((cat: { name?: string }) => cat.name === selectedCategory));

        return matchesSearch && matchesCategory;
    });

    const getTime = (val: unknown): number => {
        if (!val) return 0;
        if (typeof val === 'object' && 'toDate' in (val as object) && typeof (val as { toDate: () => Date }).toDate === 'function') {
            return (val as { toDate: () => Date }).toDate().getTime();
        }
        if (typeof val === 'string' || typeof val === 'number' || val instanceof Date) {
            return new Date(val).getTime();
        }
        return 0;
    };

    // Sort blogs
    const sortedBlogs = [...filteredBlogs].sort((a, b) => {
        if (sortBy === 'newest') {
            return getTime(b.createdAt) - getTime(a.createdAt);
        } else if (sortBy === 'oldest') {
            return getTime(a.createdAt) - getTime(b.createdAt);
        } else if (sortBy === 'popular') {
            return (b.engagement?.likes || b.likes || 0) - (a.engagement?.likes || a.likes || 0);
        } else if (sortBy === 'comments') {
            return (b.engagement?.comments || b.comments || 0) - (a.engagement?.comments || a.comments || 0);
        }
        return 0;
    });

    // Get featured blogs based on popularity (likes + comments)
    const featuredBlogs = [...blogs]
        .sort((a, b) => {
            const aPopularity = (a.likes || 0) + (a.comments || 0);
            const bPopularity = (b.likes || 0) + (b.comments || 0);
            return bPopularity - aPopularity;
        })
        .slice(0, 3); // Show top 3 most popular blogs

    // Get trending blogs for sidebar based on recent popularity
    const trendingBlogs = [...blogs]
        .sort((a, b) => {
            const aPopularity = (a.likes || 0) + (a.comments || 0);
            const bPopularity = (b.likes || 0) + (b.comments || 0);
            return bPopularity - aPopularity;
        })
        .slice(0, 4);

    // Format date
    const formatDate = (date: unknown) => {
        if (!date) return '';
        let d: Date | null = null;
        if (typeof date === 'object' && date !== null && 'toDate' in date && typeof (date as { toDate: () => Date }).toDate === 'function') {
            d = (date as { toDate: () => Date }).toDate();
        } else if (date instanceof Date) {
            d = date;
        } else if (typeof date === 'string' || typeof date === 'number') {
            d = new Date(date);
        }
        const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', options) : '';
    };

    // Pagination logic
    const totalPages = Math.ceil(sortedBlogs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedBlogs = sortedBlogs.slice(startIndex, endIndex);

    // Generate page numbers for pagination
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    // Handle page change
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        // Scroll to show first blog of the new page
        scrollToFirstBlog();
    };

    // Handle previous page
    const handlePreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            scrollToFirstBlog();
        }
    };

    // Handle next page
    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            scrollToFirstBlog();
        }
    };

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCategory, sortBy]);

    // Reset featured blog index when blogs change
    useEffect(() => {
        setCurrentFeaturedIndex(0);
    }, [blogs]);

    // Auto-advance featured blogs carousel
    useEffect(() => {
        if (featuredBlogs.length > 1) {
            const interval = setInterval(() => {
                setCurrentFeaturedIndex((prev) =>
                    prev === featuredBlogs.length - 1 ? 0 : prev + 1
                );
            }, 5000); // Change every 5 seconds

            return () => clearInterval(interval);
        }
    }, [featuredBlogs.length]);

    // Navigate to next featured blog
    const nextFeaturedBlog = () => {
        if (featuredBlogs.length > 1) {
            setCurrentFeaturedIndex((prev) =>
                prev === featuredBlogs.length - 1 ? 0 : prev + 1
            );
        }
    };

    // Navigate to previous featured blog
    const prevFeaturedBlog = () => {
        if (featuredBlogs.length > 1) {
            setCurrentFeaturedIndex((prev) =>
                prev === 0 ? featuredBlogs.length - 1 : prev - 1
            );
        }
    };

    // Scroll to top function
    const scrollToTop = () => {
        scrollViewRef.current?.scrollTo({
            x: 0,
            y: 0,
            animated: true
        });
    };

    // Scroll to show first blog of current page
    const scrollToFirstBlog = () => {
        // Calculate the approximate position of the first blog on the current page
        // This includes hero section, category navigation, controls, and some spacing
        const heroHeight = 400; // Hero section height
        const categoryHeight = 80; // Category navigation height
        const controlsHeight = 100; // Controls section height
        const spacing = 100; // Additional spacing

        const scrollPosition = heroHeight + categoryHeight + controlsHeight + spacing;

        scrollViewRef.current?.scrollTo({
            x: 0,
            y: scrollPosition,
            animated: true
        });
    };

    // Navigate to blog detail
    const navigateToBlog = (blogId: string) => {
        // TODO: Replace with React Native navigation when Firebase is implemented
        // router.push(`/blogs/${blogId}`);
        router.push({ pathname: '/blogs/[id]', params: { id: blogId } });
        Alert.alert('Navigation', `Navigating to blog ${blogId} - functionality coming soon!`);
    };

    const screenWidth = Dimensions.get('window').width;

    return (
        <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
            <PageHeader
                title="Blogs"
                onBackPress={() => router.back()}
            />
            <ScrollView
                ref={scrollViewRef}
                style={{ flex: 1, paddingTop: 48, paddingHorizontal: 8 }}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Hero Section with Featured Blogs */}
                <View style={{ marginBottom: 48 }}>
                    <View style={{
                        flexDirection: 'column',
                        marginBottom: 24,
                        alignItems: 'flex-start'
                    }}>
                        <View>
                            <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#111827' }}>
                                Explore Our Popular Blogs
                            </Text>
                            <Text style={{ color: '#6b7280', marginTop: 8 }}>
                                Discover trending insights, stories, and knowledge based on community engagement
                            </Text>
                        </View>
                        <View style={{
                            marginTop: 16,
                            flexDirection: 'row',
                            gap: 12,
                            width: '100%'
                        }}>
                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#10b981',
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                    borderRadius: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8
                                }}
                                onPress={() => setIsCreateModalOpen(true)}
                            >
                                <Text style={{ fontSize: 16, color: '#ffffff' }}>➕</Text>
                                <Text style={{ color: '#ffffff', fontWeight: '500' }}>
                                    Create Blog
                                </Text>
                            </TouchableOpacity>
                            <TextInput
                                placeholder="Search blogs..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                style={{
                                    flex: 1,
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 12,
                                    backgroundColor: '#ffffff',
                                    fontSize: 16
                                }}
                            />
                        </View>
                    </View>

                    {isLoading ? (
                        <View style={{
                            height: 320,
                            backgroundColor: '#e5e7eb',
                            borderRadius: 12,
                            opacity: 0.7
                        }} />
                    ) : error ? (
                        <View style={{
                            backgroundColor: '#fef2f2',
                            padding: 16,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#fecaca'
                        }}>
                            <Text style={{ color: '#dc2626' }}>{error}</Text>
                        </View>
                    ) : (
                        <View style={{
                            position: 'relative',
                            height: 320,
                            borderRadius: 12,
                            overflow: 'hidden'
                        }}>
                            {/* For simplicity, just showing the first featured blog */}
                            {featuredBlogs.length > 0 && (
                                <>
                                    <Image
                                        source={{ uri: featuredBlogs[currentFeaturedIndex].coverImage || '<https://via.placeholder.com/400x200>' }}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            width: '100%',
                                            height: '100%'
                                        }}
                                        resizeMode="cover"
                                    />

                                    {/* Navigation arrows for multiple featured blogs */}
                                    {featuredBlogs.length > 1 && (
                                        <>
                                            <TouchableOpacity
                                                style={{
                                                    position: 'absolute',
                                                    left: 16,
                                                    top: '50%',
                                                    transform: [{ translateY: -20 }],
                                                    backgroundColor: 'rgba(0,0,0,0.5)',
                                                    borderRadius: 20,
                                                    width: 40,
                                                    height: 40,
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onPress={prevFeaturedBlog}
                                            >
                                                <Text style={{ color: '#ffffff', fontSize: 18 }}>‹</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={{
                                                    position: 'absolute',
                                                    right: 16,
                                                    top: '50%',
                                                    transform: [{ translateY: -20 }],
                                                    backgroundColor: 'rgba(0,0,0,0.5)',
                                                    borderRadius: 20,
                                                    width: 40,
                                                    height: 40,
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onPress={nextFeaturedBlog}
                                            >
                                                <Text style={{ color: '#ffffff', fontSize: 18 }}>›</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    {/* Featured blog indicators */}
                                    {featuredBlogs.length > 1 && (
                                        <View style={{
                                            position: 'absolute',
                                            top: 16,
                                            right: 16,
                                            flexDirection: 'row',
                                            gap: 8
                                        }}>
                                            {featuredBlogs.map((_, index) => (
                                                <View
                                                    key={index}
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: 4,
                                                        backgroundColor: index === currentFeaturedIndex
                                                            ? '#ffffff'
                                                            : 'rgba(255,255,255,0.3)'
                                                    }}
                                                />
                                            ))}
                                        </View>
                                    )}

                                    <View style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        padding: 24,
                                        backgroundColor: 'rgba(0,0,0,0.7)'
                                    }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                            <View style={{
                                                backgroundColor: '#3b82f6',
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                borderRadius: 12,
                                                marginRight: 8
                                            }}>
                                                <Text style={{ color: '#ffffff', fontSize: 12 }}>
                                                    {featuredBlogs[currentFeaturedIndex].categories?.[0]?.name || featuredBlogs[currentFeaturedIndex].category || 'General'}
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={{ color: '#ffffff', fontSize: 14, marginRight: 4 }}>🕒</Text>
                                                <Text style={{ color: '#ffffff', fontSize: 14 }}>
                                                    {featuredBlogs[currentFeaturedIndex].readTime || 0} min read
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={{
                                            fontSize: 24,
                                            fontWeight: 'bold',
                                            color: '#ffffff',
                                            marginBottom: 12
                                        }}>
                                            {featuredBlogs[currentFeaturedIndex].title}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Image
                                                source={{ uri: featuredBlogs[currentFeaturedIndex].author?.avatar || '<https://via.placeholder.com/40x40>' }}
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 20,
                                                    marginRight: 12
                                                }}
                                            />
                                            <View>
                                                <Text style={{ color: '#ffffff', fontWeight: '500' }}>
                                                    {featuredBlogs[currentFeaturedIndex].author?.name || 'Unknown Author'}
                                                </Text>
                                                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                                                    {formatDate(featuredBlogs[currentFeaturedIndex].createdAt)}
                                                </Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: '#10b981',
                                                paddingHorizontal: 16,
                                                paddingVertical: 8,
                                                borderRadius: 6,
                                                marginTop: 16,
                                                alignSelf: 'flex-start'
                                            }}
                                            onPress={() => navigateToBlog(featuredBlogs[currentFeaturedIndex].id)}
                                        >
                                            <Text style={{ color: '#ffffff', fontWeight: '500' }}>
                                                Read Article
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    )}
                </View>

                {/* Category Navigation */}
                <View style={{ marginBottom: 32 }}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 8 }}
                    >
                        {CATEGORIES.map((category) => (
                            <TouchableOpacity
                                key={category}
                                style={{
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    marginRight: 8,
                                    backgroundColor: selectedCategory === category
                                        ? '#10b981'
                                        : '#ffffff'
                                }}
                                onPress={() => setSelectedCategory(category)}
                            >
                                <Text style={{
                                    color: selectedCategory === category
                                        ? '#ffffff'
                                        : '#374151',
                                    fontWeight: '500'
                                }}>
                                    {category}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Main Content Area */}
                <View style={{ flexDirection: 'column', gap: 32 }}>
                    {/* Blog Listing */}
                    <View style={{ flex: 1 }}>
                        {/* Controls */}
                        <View style={{
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 24,
                            backgroundColor: '#ffffff',
                            padding: 16,
                            borderRadius: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                            elevation: 2
                        }}>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                width: '100%',
                                justifyContent: 'space-between'
                            }}>
                                <Text style={{ color: '#6b7280', marginRight: 8 }}>
                                    {filteredBlogs.length} {filteredBlogs.length === 1 ? 'blog' : 'blogs'} found
                                </Text>

                                {/* Sort Button */}
                                <TouchableOpacity
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 8,
                                        borderRadius: 6,
                                        backgroundColor: 'transparent',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                        minWidth: 120
                                    }}
                                    onPress={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                                >
                                    <Text style={{ color: '#6b7280', fontSize: 16 }}>🔧</Text>
                                    <Text style={{ color: '#374151', fontSize: 14 }}>
                                        {sortBy === 'newest' ? 'Newest' :
                                            sortBy === 'oldest' ? 'Oldest' :
                                                sortBy === 'popular' ? 'Most Popular' : 'Most Comments'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Blog Grid/List */}
                        {isLoading ? (
                            <View style={{ gap: 16 }}>
                                {[1, 2, 3, 4].map((item) => (
                                    <View key={item} style={{
                                        backgroundColor: '#e5e7eb',
                                        borderRadius: 12,
                                        height: 120,
                                        width: '100%'
                                    }} />
                                ))}
                            </View>
                        ) : error ? (
                            <View style={{
                                backgroundColor: '#fef2f2',
                                padding: 16,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: '#fecaca'
                            }}>
                                <Text style={{ color: '#dc2626' }}>{error}</Text>
                            </View>
                        ) : filteredBlogs.length === 0 ? (
                            <View style={{
                                backgroundColor: '#ffffff',
                                borderRadius: 12,
                                padding: 32,
                                alignItems: 'center'
                            }}>
                                <Text style={{ fontSize: 40, marginBottom: 16 }}>🔍</Text>
                                <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>
                                    No blogs found
                                </Text>
                                <Text style={{ color: '#6b7280', marginBottom: 16, textAlign: 'center' }}>
                                    We couldn't find any blogs matching your search criteria.
                                </Text>
                                <TouchableOpacity
                                    style={{
                                        backgroundColor: '#10b981',
                                        paddingHorizontal: 16,
                                        paddingVertical: 12,
                                        borderRadius: 8
                                    }}
                                    onPress={() => {
                                        setSearchQuery('');
                                        setSelectedCategory('All');
                                    }}
                                >
                                    <Text style={{ color: '#ffffff', fontWeight: '500' }}>
                                        Clear Filters
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{
                                flexDirection: viewMode === 'grid' ? 'row' : 'column',
                                flexWrap: 'wrap',
                                gap: viewMode === 'grid' ? 24 : 16
                            }}>
                                {paginatedBlogs.map((blog) => (
                                    <TouchableOpacity
                                        key={blog.id}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            borderRadius: 12,
                                            overflow: 'hidden',
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 2,
                                            elevation: 2,
                                            width: viewMode === 'grid' ? (screenWidth - 64) / 2 : '100%'
                                        }}
                                        onPress={() => navigateToBlog(blog.id)}
                                    >
                                        {/* Blog Card Content */}
                                        <View style={{
                                            position: 'relative',
                                            height: viewMode === 'list' ? 120 : 192
                                        }}>
                                            <Image
                                                source={{ uri: blog.coverImage || '<https://via.placeholder.com/300x200>' }}
                                                style={{
                                                    width: '100%',
                                                    height: '100%'
                                                }}
                                                resizeMode="cover"
                                            />
                                            {((blog.likes || 0) + (blog.comments || 0)) > 200 && (
                                                <View style={{
                                                    position: 'absolute',
                                                    top: 8,
                                                    left: 8,
                                                    backgroundColor: '#ef4444',
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 4,
                                                    borderRadius: 12,
                                                    flexDirection: 'row',
                                                    alignItems: 'center'
                                                }}>
                                                    <Text style={{ color: '#ffffff', fontSize: 12, marginRight: 4 }}>📈</Text>
                                                    <Text style={{ color: '#ffffff', fontSize: 12 }}>Trending</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={{ padding: 16 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                                <View style={{
                                                    backgroundColor: '#3b82f6',
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 4,
                                                    borderRadius: 12,
                                                    marginRight: 8
                                                }}>
                                                    <Text style={{ color: '#ffffff', fontSize: 12 }}>
                                                        {blog.categories?.[0]?.name || blog.category || 'General'}
                                                    </Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Text style={{ color: '#6b7280', fontSize: 14, marginRight: 4 }}>🕒</Text>
                                                    <Text style={{ color: '#6b7280', fontSize: 14 }}>
                                                        {blog.readTime || 0} min read
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={{
                                                fontSize: 18,
                                                fontWeight: '600',
                                                marginBottom: 8,
                                                color: '#111827'
                                            }} numberOfLines={2}>
                                                {blog.title}
                                            </Text>
                                            <Text style={{
                                                color: '#6b7280',
                                                fontSize: 14,
                                                marginBottom: 12
                                            }} numberOfLines={2}>
                                                {blog.excerpt}
                                            </Text>
                                            <View style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Image
                                                        source={{ uri: blog.author?.avatar || '<https://via.placeholder.com/32x32>' }}
                                                        style={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: 16,
                                                            marginRight: 8
                                                        }}
                                                    />
                                                    <View>
                                                        <Text style={{ fontSize: 14, fontWeight: '500' }}>
                                                            {blog.author?.name || 'Unknown Author'}
                                                        </Text>
                                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                                            {formatDate(blog.createdAt)}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Text style={{ color: '#6b7280', fontSize: 14, marginRight: 4 }}>❤️</Text>
                                                        <Text style={{ color: '#6b7280', fontSize: 12 }}>
                                                            {blog.engagement?.likes || blog.likes || 0}
                                                        </Text>
                                                    </View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Text style={{ color: '#6b7280', fontSize: 14, marginRight: 4 }}>💬</Text>
                                                        <Text style={{ color: '#6b7280', fontSize: 12 }}>
                                                            {blog.engagement?.comments || blog.comments || 0}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Pagination - Moved below blog listing */}
                        {!isLoading && filteredBlogs.length > 0 && (
                            <View style={{ marginTop: 32, alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <TouchableOpacity
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 6,
                                            borderWidth: 1,
                                            borderColor: currentPage > 1 ? '#d1d5db' : '#e5e7eb',
                                            backgroundColor: currentPage > 1 ? '#ffffff' : '#f9fafb'
                                        }}
                                        onPress={handlePreviousPage}
                                        disabled={currentPage <= 1}
                                    >
                                        <Text style={{
                                            color: currentPage > 1 ? '#374151' : '#9ca3af',
                                            fontWeight: currentPage > 1 ? '500' : '400'
                                        }}>
                                            Previous
                                        </Text>
                                    </TouchableOpacity>

                                    {getPageNumbers().map((page, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={{
                                                paddingHorizontal: 16,
                                                paddingVertical: 8,
                                                borderRadius: 6,
                                                backgroundColor: page === currentPage ? '#10b981' : '#ffffff',
                                                borderWidth: 1,
                                                borderColor: page === currentPage ? '#10b981' : '#d1d5db',
                                                minWidth: 40,
                                                alignItems: 'center'
                                            }}
                                            onPress={() => typeof page === 'number' ? handlePageChange(page) : null}
                                            disabled={page === '...'}
                                        >
                                            <Text style={{
                                                color: page === currentPage ? '#ffffff' : '#374151',
                                                fontWeight: page === currentPage ? '600' : '500'
                                            }}>
                                                {page}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}

                                    <TouchableOpacity
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 6,
                                            borderWidth: 1,
                                            borderColor: currentPage < totalPages ? '#d1d5db' : '#e5e7eb',
                                            backgroundColor: currentPage < totalPages ? '#ffffff' : '#f9fafb'
                                        }}
                                        onPress={handleNextPage}
                                        disabled={currentPage >= totalPages}
                                    >
                                        <Text style={{
                                            color: currentPage < totalPages ? '#374151' : '#9ca3af',
                                            fontWeight: currentPage < totalPages ? '500' : '400'
                                        }}>
                                            Next
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Page info */}
                                <Text style={{
                                    marginTop: 12,
                                    color: '#6b7280',
                                    fontSize: 14
                                }}>
                                    Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(endIndex, filteredBlogs.length)} of {filteredBlogs.length} blogs
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Sidebar */}
                    <View style={{ width: '100%', gap: 24 }}>
                        {/* Newsletter Signup */}
                        <View style={{
                            backgroundColor: '#ffffff',
                            borderRadius: 12,
                            padding: 20,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                            elevation: 2
                        }}>
                            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
                                Subscribe to Our Newsletter
                            </Text>
                            <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
                                Get the latest blogs delivered right to your inbox.
                            </Text>
                            <TextInput
                                placeholder="Your email address"
                                style={{
                                    borderWidth: 1,
                                    borderColor: '#d1d5db',
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 12,
                                    marginBottom: 12,
                                    fontSize: 16,
                                    backgroundColor: '#ffffff'
                                }}
                            />
                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#10b981',
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderRadius: 8,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ color: '#ffffff', fontWeight: '500' }}>
                                    Subscribe
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Trending Blogs */}
                        <View style={{
                            backgroundColor: '#ffffff',
                            borderRadius: 12,
                            padding: 20,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                            elevation: 2
                        }}>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 16
                            }}>
                                <Text style={{ fontSize: 18, fontWeight: '600' }}>Trending Now</Text>
                                <Text style={{ fontSize: 18, color: '#ef4444' }}>📈</Text>
                            </View>
                            <View style={{ gap: 16 }}>
                                {trendingBlogs.map((blog) => (
                                    <TouchableOpacity
                                        key={blog.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'flex-start',
                                            gap: 12
                                        }}
                                        onPress={() => navigateToBlog(blog.id)}
                                    >
                                        <Image
                                            source={{ uri: blog.coverImage || '<https://via.placeholder.com/64x64>' }}
                                            style={{
                                                width: 64,
                                                height: 64,
                                                borderRadius: 8,
                                                flexShrink: 0
                                            }}
                                            resizeMode="cover"
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{
                                                fontWeight: '500',
                                                fontSize: 14,
                                                marginBottom: 4
                                            }} numberOfLines={2}>
                                                {blog.title}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={{ color: '#6b7280', fontSize: 12, marginRight: 4 }}>🕒</Text>
                                                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                                    {blog.readTime || 0} min read
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity
                                style={{
                                    width: '100%',
                                    marginTop: 16,
                                    paddingVertical: 12,
                                    borderWidth: 1,
                                    borderColor: '#10b981',
                                    borderRadius: 8,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ color: '#10b981', fontWeight: '500' }}>
                                    View All Trending →
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Popular Tags */}
                        <View style={{
                            backgroundColor: '#ffffff',
                            borderRadius: 12,
                            padding: 20,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                            elevation: 2
                        }}>
                            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
                                Popular Tags
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {POPULAR_TAGS.map((tag) => (
                                    <TouchableOpacity
                                        key={tag}
                                        style={{
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            backgroundColor: '#f3f4f6',
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: '#e5e7eb'
                                        }}
                                        onPress={() => setSearchQuery(tag)}
                                    >
                                        <Text style={{ color: '#374151', fontSize: 14 }}>{tag}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Call to Action */}
                        <View style={{
                            backgroundColor: '#10b981',
                            borderRadius: 12,
                            padding: 20
                        }}>
                            <Text style={{
                                fontSize: 18,
                                fontWeight: '600',
                                marginBottom: 8,
                                color: '#ffffff'
                            }}>
                                Share Your Knowledge
                            </Text>
                            <Text style={{
                                color: 'rgba(255,255,255,0.9)',
                                fontSize: 14,
                                marginBottom: 16
                            }}>
                                Have insights to share? Write your own blog and join our community of writers.
                            </Text>
                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#ffffff',
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderRadius: 8,
                                    alignSelf: 'flex-start'
                                }}
                            >
                                <Text style={{ color: '#10b981', fontWeight: '500' }}>
                                    Start Writing
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Create Blog Modal */}
            <CreateBlogModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                userId={userId || ''}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    fetchBlogs(); // Refetch blogs after creating a new one
                }}
            />

            {/* Back to Top Button */}
            {showBackToTop && (
                <TouchableOpacity
                    onPress={scrollToTop}
                    style={{
                        position: 'absolute',
                        bottom: 24,
                        right: 24,
                        padding: 12,
                        backgroundColor: '#10b981',
                        borderRadius: 24,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 4,
                        elevation: 5
                    }}
                >
                    <Text style={{ color: '#ffffff', fontSize: 16 }}>↑</Text>
                </TouchableOpacity>
            )}

            {/* Sort Options Modal */}
            <Modal
                visible={isSortDropdownOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsSortDropdownOpen(false)}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                    activeOpacity={1}
                    onPress={() => setIsSortDropdownOpen(false)}
                >
                    <View
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: 8,
                            minWidth: 220,
                            maxWidth: 300,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 5
                        }}
                    >
                        <View style={{
                            paddingVertical: 8,
                            paddingHorizontal: 4
                        }}>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: '#374151',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                textAlign: 'center'
                            }}>
                                Sort Options
                            </Text>

                            {SORT_OPTIONS.map((option, index) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 12,
                                        marginHorizontal: 4,
                                        borderRadius: 4,
                                        backgroundColor: sortBy === option.value ? '#f0f9ff' : 'transparent'
                                    }}
                                    onPress={() => {
                                        setSortBy(option.value);
                                        setIsSortDropdownOpen(false);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={{ fontSize: 16 }}>
                                            {option.icon}
                                        </Text>
                                        <Text style={{
                                            color: sortBy === option.value ? '#0369a1' : '#374151',
                                            fontWeight: sortBy === option.value ? '500' : '400',
                                            flex: 1,
                                            fontSize: 14
                                        }}>
                                            {option.label}
                                        </Text>
                                        {sortBy === option.value && (
                                            <Text style={{ color: '#0369a1', fontSize: 16 }}>✓</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}