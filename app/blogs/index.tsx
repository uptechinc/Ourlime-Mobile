import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Check,
  ChevronLeft,
  Clock,
  Heart,
  MessageCircle,
  PenSquare,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useProfileStore } from '@/src/store/useProfileStore';
import CreateBlogModal from '@/components/blogs/CreateBlogModal';
import {
  BlogsAndArticlesService,
  type BlogListItem,
} from '@/lib/blogs&articles/BlogsAndArticlesService';
import UserAvatar from '@/components/ui/UserAvatar';
import { stripHtml } from '@/lib/utils/htmlUtils';

const CATEGORIES = [
  'All',
  'Technology',
  'Wellness',
  'Marketing',
  'Finance',
  'Health',
  'Business',
  'Lifestyle',
  'Education',
  'Travel',
];

const SORT_OPTIONS: { value: 'newest' | 'oldest' | 'popular' | 'comments'; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'comments', label: 'Most Discussed' },
  { value: 'oldest', label: 'Oldest First' },
];

const SAMPLE_BLOGS: BlogListItem[] = [
  {
    id: '1',
    title: 'The Future of Sustainable Technology in Urban Environments',
    excerpt:
      'Exploring how green tech innovations are reshaping our cities and creating more sustainable urban spaces for future generations.',
    coverImage:
      'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1470&q=80',
    author: {
      id: 'author1',
      name: 'Alex Morgan',
      avatar:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=1470&q=80',
    },
    category: 'Technology',
    categories: [{ name: 'Technology' }],
    tags: [{ name: 'Sustainability' }, { name: 'Urban Planning' }, { name: 'Innovation' }],
    readTime: 8,
    publishedDate: '2023-10-15T10:30:00Z',
    likes: 342,
    comments: 56,
    engagement: { likes: 342, comments: 56 },
  },
  {
    id: '2',
    title: 'Mindfulness Practices for the Modern Professional',
    excerpt:
      'Discover practical mindfulness techniques that can be integrated into your busy work schedule to reduce stress and increase productivity.',
    coverImage:
      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1470&q=80',
    author: {
      id: 'author2',
      name: 'Samantha Lee',
      avatar:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1470&q=80',
    },
    category: 'Wellness',
    categories: [{ name: 'Wellness' }],
    tags: [{ name: 'Mindfulness' }, { name: 'Productivity' }],
    readTime: 6,
    publishedDate: '2023-10-12T14:45:00Z',
    likes: 287,
    comments: 42,
    engagement: { likes: 287, comments: 42 },
  },
  {
    id: '3',
    title: 'The Art of Storytelling in Digital Marketing',
    excerpt:
      'How crafting compelling narratives can transform your brand messaging and create deeper connections with your audience.',
    coverImage:
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1470&q=80',
    author: {
      id: 'author3',
      name: 'Marcus Johnson',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1470&q=80',
    },
    category: 'Marketing',
    categories: [{ name: 'Marketing' }],
    tags: [{ name: 'Digital Marketing' }, { name: 'Branding' }],
    readTime: 7,
    publishedDate: '2023-10-10T09:15:00Z',
    likes: 215,
    comments: 38,
    engagement: { likes: 215, comments: 38 },
  },
  {
    id: '4',
    title: 'Decoding Financial Independence: A Practical Guide',
    excerpt:
      'A structured approach to managing your wealth, budgeting wisely, and setting up sustainable long-term investments.',
    coverImage:
      'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=1470&q=80',
    author: {
      id: 'author4',
      name: 'Priya Patel',
      avatar:
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1488&q=80',
    },
    category: 'Finance',
    categories: [{ name: 'Finance' }],
    tags: [{ name: 'Finance' }, { name: 'Investing' }],
    readTime: 10,
    publishedDate: '2023-10-08T16:20:00Z',
    likes: 198,
    comments: 45,
    engagement: { likes: 198, comments: 45 },
  },
];

const blogService = BlogsAndArticlesService.getInstance();

export default function BlogsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { id: userId } = useProfileStore();

  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [contentType, setContentType] = useState<'all' | 'blog' | 'article'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular' | 'comments'>('newest');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchBlogs = useCallback(async () => {
    try {
      const data = await blogService.getPosts();
      if (data && data.length > 0) {
        setBlogs(data);
      } else {
        setBlogs(SAMPLE_BLOGS);
      }
    } catch (err) {
      console.warn('[BlogsScreen] Error loading posts, using sample:', err);
      setBlogs(SAMPLE_BLOGS);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchBlogs();
  }, [fetchBlogs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchBlogs();
  }, [fetchBlogs]);

  const getTime = (val: unknown): number => {
    if (!val) return 0;
    if (
      typeof val === 'object' &&
      'toDate' in (val as object) &&
      typeof (val as { toDate: () => Date }).toDate === 'function'
    ) {
      return (val as { toDate: () => Date }).toDate().getTime();
    }
    if (typeof val === 'string' || typeof val === 'number' || val instanceof Date) {
      return new Date(val).getTime();
    }
    return 0;
  };

  const formatDate = (date: unknown): string => {
    if (!date) return '';
    const parsed = getTime(date);
    if (!parsed) return '';
    return new Date(parsed).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter blogs
  const filteredBlogs = useMemo(() => {
    return blogs.filter((blog) => {
      const cleanTitle = stripHtml(blog.title).toLowerCase();
      const cleanExcerpt = stripHtml(blog.excerpt).toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !query ||
        cleanTitle.includes(query) ||
        cleanExcerpt.includes(query) ||
        blog.tags?.some((t) => t.name?.toLowerCase().includes(query));

      const matchesCategory =
        selectedCategory === 'All' ||
        blog.category === selectedCategory ||
        blog.categories?.some((c) => c.name === selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [blogs, searchQuery, selectedCategory]);

  // Sort blogs
  const sortedBlogs = useMemo(() => {
    return [...filteredBlogs].sort((a, b) => {
      if (sortBy === 'newest') return getTime(b.createdAt) - getTime(a.createdAt);
      if (sortBy === 'oldest') return getTime(a.createdAt) - getTime(b.createdAt);
      if (sortBy === 'popular') {
        const aLikes = a.engagement?.likes ?? a.likes ?? 0;
        const bLikes = b.engagement?.likes ?? b.likes ?? 0;
        return bLikes - aLikes;
      }
      if (sortBy === 'comments') {
        const aComments = a.engagement?.comments ?? a.comments ?? 0;
        const bComments = b.engagement?.comments ?? b.comments ?? 0;
        return bComments - aComments;
      }
      return 0;
    });
  }, [filteredBlogs, sortBy]);

  // Hero Spotlight Story (top story)
  const heroStory = useMemo(() => {
    return !searchQuery.trim() && selectedCategory === 'All' ? sortedBlogs[0] ?? null : null;
  }, [sortedBlogs, searchQuery, selectedCategory]);

  // Trending Stories (next 3)
  const trendingStories = useMemo(() => {
    if (searchQuery.trim() || selectedCategory !== 'All') return [];
    return sortedBlogs.slice(1, 4);
  }, [sortedBlogs, searchQuery, selectedCategory]);

  // Main Articles Feed (all remaining stories)
  const feedStories = useMemo(() => {
    if (!heroStory) return sortedBlogs;
    return sortedBlogs.slice(1);
  }, [sortedBlogs, heroStory]);

  const hasActiveFilters = Boolean(searchQuery.trim() || selectedCategory !== 'All' || contentType !== 'all' || sortBy !== 'newest');

  const navigateToBlog = (blogId: string) => {
    router.push({ pathname: '/blogs/[id]', params: { id: blogId } });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.canvas }]}>
      {/* ── Top Header Bar ── */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => router.back()}
          style={styles.headerIconButton}
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>Blogs & Articles</Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsCreateModalOpen(true)}
          style={styles.writeButton}
          accessibilityLabel="Create Blog"
        >
          <PenSquare size={16} color="#ffffff" />
          <Text style={styles.writeButtonText}>Write</Text>
        </TouchableOpacity>
      </View>

      {/* ── Compact Search & Filter Row ── */}
      <View style={[styles.searchFilterRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
              borderColor: colors.border,
            },
          ]}
        >
          <Search size={16} color={colors.secondaryText} style={styles.searchIcon} />
          <TextInput
            placeholder="Search blogs, topics, authors…"
            placeholderTextColor={colors.secondaryText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={colors.secondaryText} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setIsFilterModalOpen(true)}
          style={[
            styles.filterIconButton,
            {
              backgroundColor: hasActiveFilters
                ? isDark
                  ? 'rgba(16, 185, 129, 0.2)'
                  : '#ecfdf5'
                : isDark
                ? 'rgba(255, 255, 255, 0.06)'
                : '#f1f5f9',
              borderColor: hasActiveFilters ? '#10b981' : colors.border,
            },
          ]}
          accessibilityLabel="Filter & Sort"
        >
          <SlidersHorizontal
            size={18}
            color={hasActiveFilters ? '#10b981' : colors.secondaryText}
          />
          {hasActiveFilters && <View style={styles.filterActiveDot} />}
        </TouchableOpacity>
      </View>

      {/* ── Horizontal Category Navigation Bar ── */}
      <View style={[styles.categoryBarContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBarContent}
        >
          {CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                activeOpacity={0.8}
                onPress={() => setSelectedCategory(category)}
                style={[
                  styles.categoryTabPill,
                  isSelected
                    ? styles.categoryTabPillActive
                    : {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                        borderColor: colors.border,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    {
                      color: isSelected ? '#ffffff' : colors.secondaryText,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Main Editorial Scroll Feed ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
      >
        {/* Loading State */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
              Loading editorial stories…
            </Text>
          </View>
        ) : sortedBlogs.length === 0 ? (
          /* Empty State */
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Search size={40} color={colors.secondaryText} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No matching stories</Text>
            <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
              Try adjusting your search terms or clearing your category filters.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setContentType('all');
                setSortBy('newest');
              }}
              style={styles.resetFiltersButton}
            >
              <Text style={styles.resetFiltersButtonText}>Reset All Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Hero Spotlight Article ── */}
            {heroStory ? (
              <View style={styles.spotlightSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured Story</Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => navigateToBlog(heroStory.id)}
                  style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Image
                    source={{ uri: heroStory.coverImage }}
                    style={styles.heroCoverImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0.92)']}
                    locations={[0.15, 0.6, 1]}
                    style={styles.heroGradient}
                  >
                    <View style={styles.heroBadgeRow}>
                      <View style={styles.heroCategoryPill}>
                        <Text style={styles.heroCategoryPillText}>
                          {heroStory.categories?.[0]?.name || heroStory.category || 'Featured'}
                        </Text>
                      </View>
                      <View style={styles.heroReadTimePill}>
                        <Clock size={11} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text style={styles.heroReadTimeText}>{heroStory.readTime || 5} min read</Text>
                      </View>
                    </View>

                    <Text style={styles.heroCardTitle} numberOfLines={2}>
                      {stripHtml(heroStory.title)}
                    </Text>

                    <View style={styles.heroAuthorRow}>
                      <UserAvatar
                        profileImage={heroStory.author?.avatar}
                        firstName={heroStory.author?.name || 'Author'}
                        size={28}
                      />
                      <Text style={styles.heroAuthorName}>
                        {heroStory.author?.name || 'Ourlime Writer'}
                      </Text>
                      <Text style={styles.heroDot}>•</Text>
                      <Text style={styles.heroDate}>
                        {formatDate(heroStory.createdAt || heroStory.publishedDate)}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* ── Trending Strip ── */}
            {trendingStories.length > 0 ? (
              <View style={styles.trendingSection}>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={16} color="#10b981" />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending Now</Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trendingScrollContent}
                >
                  {trendingStories.map((story) => (
                    <TouchableOpacity
                      key={story.id}
                      activeOpacity={0.88}
                      onPress={() => navigateToBlog(story.id)}
                      style={[
                        styles.trendingCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: story.coverImage }}
                        style={styles.trendingCardImage}
                        resizeMode="cover"
                      />
                      <View style={styles.trendingCardBody}>
                        <Text
                          style={[styles.trendingCategory, { color: '#10b981' }]}
                          numberOfLines={1}
                        >
                          {story.categories?.[0]?.name || story.category || 'Topic'}
                        </Text>
                        <Text
                          style={[styles.trendingCardTitle, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {stripHtml(story.title)}
                        </Text>
                        <View style={styles.trendingMetaRow}>
                          <Clock size={11} color={colors.secondaryText} style={{ marginRight: 3 }} />
                          <Text style={[styles.trendingMetaText, { color: colors.secondaryText }]}>
                            {story.readTime || 4} min
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* ── Latest Articles Feed ── */}
            <View style={styles.feedSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {selectedCategory === 'All' ? 'Latest Stories' : `${selectedCategory} Stories`}
                </Text>
                <Text style={[styles.feedCountText, { color: colors.secondaryText }]}>
                  {feedStories.length} {feedStories.length === 1 ? 'article' : 'articles'}
                </Text>
              </View>

              <View style={styles.feedList}>
                {feedStories.map((story) => {
                  const likesCount = story.engagement?.likes ?? story.likes ?? 0;
                  const commentsCount = story.engagement?.comments ?? story.comments ?? 0;
                  const categoryName = story.categories?.[0]?.name || story.category || 'General';

                  return (
                    <TouchableOpacity
                      key={story.id}
                      activeOpacity={0.88}
                      onPress={() => navigateToBlog(story.id)}
                      style={[
                        styles.articleCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {/* Image with category badge */}
                      {story.coverImage ? (
                        <View style={styles.articleCoverContainer}>
                          <Image
                            source={{ uri: story.coverImage }}
                            style={styles.articleCover}
                            resizeMode="cover"
                          />
                          <View style={styles.articleCategoryBadge}>
                            <Text style={styles.articleCategoryBadgeText}>{categoryName}</Text>
                          </View>
                        </View>
                      ) : null}

                      {/* Content Body */}
                      <View style={styles.articleBody}>
                        {/* Title */}
                        <Text
                          style={[styles.articleTitle, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {stripHtml(story.title)}
                        </Text>

                        {/* Excerpt */}
                        {story.excerpt ? (
                          <Text
                            style={[styles.articleExcerpt, { color: colors.secondaryText }]}
                            numberOfLines={2}
                          >
                            {stripHtml(story.excerpt)}
                          </Text>
                        ) : null}

                        {/* Author & Interactions Footer */}
                        <View style={[styles.articleFooter, { borderTopColor: colors.border }]}>
                          <View style={styles.articleAuthor}>
                            <UserAvatar
                              profileImage={story.author?.avatar}
                              firstName={story.author?.name || 'User'}
                              size={22}
                            />
                            <Text
                              style={[styles.articleAuthorName, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {story.author?.name || 'Ourlime Writer'}
                            </Text>
                            <Text style={[styles.articleDot, { color: colors.secondaryText }]}>•</Text>
                            <Text style={[styles.articleDate, { color: colors.secondaryText }]}>
                              {formatDate(story.createdAt || story.publishedDate)}
                            </Text>
                          </View>

                          <View style={styles.articleEngagement}>
                            <View style={styles.statChip}>
                              <Heart size={13} color="#ef4444" fill="rgba(239, 68, 68, 0.18)" />
                              <Text style={[styles.statCount, { color: colors.secondaryText }]}>
                                {likesCount}
                              </Text>
                            </View>
                            <View style={styles.statChip}>
                              <MessageCircle size={13} color={colors.secondaryText} />
                              <Text style={[styles.statCount, { color: colors.secondaryText }]}>
                                {commentsCount}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Refine & Filter Modal ── */}
      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsFilterModalOpen(false)}
        >
          <View
            style={[
              styles.filterSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.filterSheetHeader}>
              <Text style={[styles.filterSheetTitle, { color: colors.text }]}>Refine Articles</Text>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            {/* Content Type Filter */}
            <Text style={[styles.filterSectionLabel, { color: colors.secondaryText }]}>
              Content Format
            </Text>
            <View style={styles.formatRow}>
              {(['all', 'blog', 'article'] as const).map((type) => {
                const isSelected = contentType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    activeOpacity={0.8}
                    onPress={() => setContentType(type)}
                    style={[
                      styles.formatPill,
                      isSelected
                        ? styles.formatPillActive
                        : {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                            borderColor: colors.border,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.formatPillText,
                        {
                          color: isSelected ? '#ffffff' : colors.text,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {type === 'all' ? 'All Formats' : type === 'blog' ? 'Blogs' : 'Articles'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sort Options */}
            <Text style={[styles.filterSectionLabel, { color: colors.secondaryText, marginTop: 18 }]}>
              Sort By
            </Text>
            <View style={styles.sortList}>
              {SORT_OPTIONS.map((option) => {
                const isSelected = sortBy === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.7}
                    onPress={() => setSortBy(option.value)}
                    style={[
                      styles.sortRow,
                      isSelected && {
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sortRowText,
                        {
                          color: isSelected ? '#10b981' : colors.text,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && <Check size={18} color="#10b981" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Apply Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setIsFilterModalOpen(false)}
              style={styles.applyFiltersButton}
            >
              <Text style={styles.applyFiltersButtonText}>Show Stories</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Create Blog Modal ── */}
      <CreateBlogModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        userId={userId || ''}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          void fetchBlogs();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIconButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 5,
  },
  writeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  categoryBarContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 8,
  },
  categoryTabPill: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryTabPillActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  categoryTabText: {
    fontSize: 13,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyCard: {
    margin: 20,
    padding: 36,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  resetFiltersButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  resetFiltersButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  spotlightSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroCard: {
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  heroCoverImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: 16,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  heroCategoryPill: {
    backgroundColor: '#10b981',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroCategoryPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  heroReadTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroReadTimeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500',
  },
  heroCardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 10,
  },
  heroAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAuthorName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  heroDot: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 6,
    fontSize: 12,
  },
  heroDate: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
  },
  trendingSection: {
    paddingTop: 6,
    marginBottom: 18,
  },
  trendingScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  trendingCard: {
    width: 220,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  trendingCardImage: {
    width: '100%',
    height: 110,
  },
  trendingCardBody: {
    padding: 10,
    gap: 4,
  },
  trendingCategory: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  trendingCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  trendingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  trendingMetaText: {
    fontSize: 11,
  },
  feedSection: {
    paddingHorizontal: 16,
  },
  feedCountText: {
    fontSize: 12,
    fontWeight: '500',
  },
  feedList: {
    gap: 14,
  },
  articleCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  articleCoverContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  articleCover: {
    width: '100%',
    height: '100%',
  },
  articleCategoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  articleCategoryBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  articleBody: {
    padding: 14,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  articleExcerpt: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  articleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  articleAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  articleAuthorName: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  articleDot: {
    marginHorizontal: 5,
    fontSize: 11,
  },
  articleDate: {
    fontSize: 11,
  },
  articleEngagement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formatPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  formatPillActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  formatPillText: {
    fontSize: 13,
  },
  sortList: {
    gap: 6,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sortRowText: {
    fontSize: 14,
  },
  applyFiltersButton: {
    backgroundColor: '#10b981',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  applyFiltersButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});