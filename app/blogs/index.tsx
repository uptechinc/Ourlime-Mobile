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
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useProfileStore } from '@/src/store/useProfileStore';
import PageHeader from '@/components/ui/PageHeader';
import CreateBlogModal from '@/components/blogs/CreateBlogModal';
import {
  BlogsAndArticlesService,
  type BlogListItem,
} from '@/lib/blogs&articles/BlogsAndArticlesService';
import UserAvatar from '@/components/ui/UserAvatar';

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

const POPULAR_TAGS = [
  'Technology',
  'Wellness',
  'Sustainability',
  'Marketing',
  'Finance',
  'Productivity',
  'Innovation',
  'Mental Health',
  'Remote Work',
  'Artificial Intelligence',
];

const SORT_OPTIONS: { value: 'newest' | 'oldest' | 'popular' | 'comments'; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'comments', label: 'Most Comments' },
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
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular' | 'comments'>('newest');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);

  const fetchBlogs = useCallback(async () => {
    try {
      const data = await blogService.getPosts();
      if (data && data.length > 0) {
        setBlogs(data);
      } else {
        setBlogs(SAMPLE_BLOGS);
      }
    } catch (err) {
      console.warn('[BlogsScreen] Error loading posts, falling back to sample:', err);
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
    if (typeof val === 'object' && 'toDate' in (val as object) && typeof (val as { toDate: () => Date }).toDate === 'function') {
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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter blogs
  const filteredBlogs = useMemo(() => {
    return blogs.filter((blog) => {
      const matchesSearch =
        !searchQuery.trim() ||
        blog.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        blog.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        blog.tags?.some((t) => t.name?.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === 'All' ||
        blog.category === selectedCategory ||
        blog.categories?.some((c) => c.name === selectedCategory);

      const matchesTag =
        !selectedTag ||
        blog.tags?.some((t) => t.name?.toLowerCase() === selectedTag.toLowerCase());

      return matchesSearch && matchesCategory && matchesTag;
    });
  }, [blogs, searchQuery, selectedCategory, selectedTag]);

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

  // Featured blogs (top 3)
  const featuredBlogs = useMemo(() => {
    return blogs.slice(0, 3);
  }, [blogs]);

  const activeFeatured = featuredBlogs[currentFeaturedIndex] ?? featuredBlogs[0] ?? null;

  const navigateToBlog = (blogId: string) => {
    router.push({ pathname: '/blogs/[id]', params: { id: blogId } });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.canvas }]}>
      <PageHeader title="Blogs" onBackPress={() => router.back()} />

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
        {/* ── Hero Header ── */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Explore Our Popular Blogs
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.secondaryText }]}>
            Discover trending insights, stories, and knowledge based on community engagement
          </Text>

          {/* Action Row: Create Blog + Search Input */}
          <View style={styles.heroActionRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setIsCreateModalOpen(true)}
              style={styles.createBlogButton}
            >
              <Plus size={18} color="#ffffff" />
              <Text style={styles.createBlogButtonText}>Create Blog</Text>
            </TouchableOpacity>

            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Search size={18} color={colors.secondaryText} style={styles.searchIcon} />
              <TextInput
                placeholder="Search blogs, tags, or authors…"
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
          </View>

          {/* Content Type Tabs & Sort Button */}
          <View style={styles.typeAndSortRow}>
            <View style={[styles.typeSwitcher, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {(['all', 'blog', 'article'] as const).map((type) => {
                const isActive = contentType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    activeOpacity={0.8}
                    onPress={() => setContentType(type)}
                    style={[
                      styles.typeTab,
                      isActive && { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#ecfdf5' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeTabText,
                        {
                          color: isActive ? '#10b981' : colors.secondaryText,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {type === 'all' ? 'All' : type === 'blog' ? 'Blogs' : 'Articles'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsSortModalOpen(true)}
              style={[
                styles.sortButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ArrowUpDown size={15} color={colors.secondaryText} />
              <Text style={[styles.sortButtonText, { color: colors.text }]}>
                {SORT_OPTIONS.find((s) => s.value === sortBy)?.label ?? 'Sort'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Featured Blog Hero Card ── */}
        {activeFeatured ? (
          <View style={styles.featuredContainer}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => navigateToBlog(activeFeatured.id)}
              style={[
                styles.featuredCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Image
                source={{ uri: activeFeatured.coverImage }}
                style={styles.featuredCover}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.75)', 'rgba(0, 0, 0, 0.95)']}
                locations={[0.1, 0.6, 1]}
                style={styles.featuredScrim}
              >
                {/* Badges */}
                <View style={styles.featuredBadgesRow}>
                  <View style={styles.featuredCategoryBadge}>
                    <Text style={styles.featuredCategoryText}>
                      {activeFeatured.categories?.[0]?.name || activeFeatured.category || 'General'}
                    </Text>
                  </View>
                  <View style={styles.featuredReadTimeBadge}>
                    <Clock size={12} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.featuredReadTimeText}>
                      {activeFeatured.readTime || 5} min read
                    </Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.featuredTitle} numberOfLines={2}>
                  {activeFeatured.title}
                </Text>

                {/* Author & Action Row */}
                <View style={styles.featuredFooter}>
                  <View style={styles.featuredAuthor}>
                    <UserAvatar
                      profileImage={activeFeatured.author?.avatar}
                      firstName={activeFeatured.author?.name || 'User'}
                      size={32}
                    />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.featuredAuthorName}>
                        {activeFeatured.author?.name || 'Ourlime user'}
                      </Text>
                      <Text style={styles.featuredDate}>
                        {formatDate(activeFeatured.createdAt || activeFeatured.publishedDate)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.readArticleBtn}>
                    <Text style={styles.readArticleBtnText}>Read Article</Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Carousel Indicators & Arrows */}
              {featuredBlogs.length > 1 && (
                <View style={styles.carouselIndicators}>
                  {featuredBlogs.map((_, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.carouselDot,
                        idx === currentFeaturedIndex && styles.carouselDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>

            {/* Carousel prev/next buttons */}
            {featuredBlogs.length > 1 && (
              <View style={styles.carouselControls}>
                <TouchableOpacity
                  onPress={() =>
                    setCurrentFeaturedIndex((prev) =>
                      prev === 0 ? featuredBlogs.length - 1 : prev - 1
                    )
                  }
                  style={styles.carouselArrowBtn}
                >
                  <ChevronLeft size={16} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    setCurrentFeaturedIndex((prev) =>
                      prev === featuredBlogs.length - 1 ? 0 : prev + 1
                    )
                  }
                  style={styles.carouselArrowBtn}
                >
                  <ChevronRight size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {/* ── Category Filter Pills ── */}
        <View style={styles.categoriesSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  activeOpacity={0.8}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: isSelected ? '#10b981' : colors.surface,
                      borderColor: isSelected ? '#10b981' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      {
                        color: isSelected ? '#ffffff' : colors.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Popular Tags ── */}
        <View style={styles.tagsSection}>
          <View style={styles.tagsHeader}>
            <Sparkles size={14} color="#10b981" />
            <Text style={[styles.tagsHeaderTitle, { color: colors.secondaryText }]}>
              Popular Tags
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsList}
          >
            {POPULAR_TAGS.map((tag) => {
              const isSelected = selectedTag === tag;
              return (
                <TouchableOpacity
                  key={tag}
                  activeOpacity={0.8}
                  onPress={() => setSelectedTag(isSelected ? null : tag)}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: isSelected
                        ? isDark ? 'rgba(16, 185, 129, 0.25)' : '#ecfdf5'
                        : colors.surface,
                      borderColor: isSelected ? '#10b981' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      {
                        color: isSelected ? '#10b981' : colors.secondaryText,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    #{tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Results Count Bar ── */}
        <View style={[styles.resultsBar, { borderColor: colors.border }]}>
          <Text style={[styles.resultsText, { color: colors.secondaryText }]}>
            {sortedBlogs.length} {sortedBlogs.length === 1 ? 'blog' : 'blogs'} found
          </Text>
          {(selectedCategory !== 'All' || selectedTag || searchQuery) && (
            <TouchableOpacity
              onPress={() => {
                setSelectedCategory('All');
                setSelectedTag(null);
                setSearchQuery('');
              }}
            >
              <Text style={styles.clearFiltersText}>Reset filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Blog Cards Feed ── */}
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : sortedBlogs.length === 0 ? (
          <View
            style={[
              styles.emptyContainer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Search size={44} color={colors.secondaryText} style={{ opacity: 0.6 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No blogs found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
              We couldn't find any blogs matching your criteria.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedCategory('All');
                setSelectedTag(null);
                setSearchQuery('');
              }}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.blogsFeed}>
            {sortedBlogs.map((blog) => {
              const likesCount = blog.engagement?.likes ?? blog.likes ?? 0;
              const commentsCount = blog.engagement?.comments ?? blog.comments ?? 0;
              const categoryName = blog.categories?.[0]?.name || blog.category || 'General';

              return (
                <TouchableOpacity
                  key={blog.id}
                  activeOpacity={0.88}
                  onPress={() => navigateToBlog(blog.id)}
                  style={[
                    styles.blogCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Cover Image */}
                  {blog.coverImage ? (
                    <View style={styles.cardImageContainer}>
                      <Image
                        source={{ uri: blog.coverImage }}
                        style={styles.cardImage}
                        resizeMode="cover"
                      />
                      <View style={styles.cardCategoryBadge}>
                        <Text style={styles.cardCategoryBadgeText}>{categoryName}</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Card Content */}
                  <View style={styles.cardBody}>
                    <View style={styles.cardMetaRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Clock size={12} color={colors.secondaryText} style={{ marginRight: 4 }} />
                        <Text style={[styles.cardMetaText, { color: colors.secondaryText }]}>
                          {blog.readTime || 5} min read
                        </Text>
                      </View>
                      <Text style={[styles.cardMetaText, { color: colors.secondaryText }]}>
                        {formatDate(blog.createdAt || blog.publishedDate)}
                      </Text>
                    </View>

                    {/* Title */}
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                      {blog.title}
                    </Text>

                    {/* Excerpt */}
                    {blog.excerpt ? (
                      <Text
                        style={[styles.cardExcerpt, { color: colors.secondaryText }]}
                        numberOfLines={2}
                      >
                        {blog.excerpt}
                      </Text>
                    ) : null}

                    {/* Card Footer: Author & Engagement */}
                    <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                      <View style={styles.cardAuthor}>
                        <UserAvatar
                          profileImage={blog.author?.avatar}
                          firstName={blog.author?.name || 'User'}
                          size={24}
                        />
                        <Text
                          style={[styles.cardAuthorName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {blog.author?.name || 'Ourlime User'}
                        </Text>
                      </View>

                      <View style={styles.cardEngagement}>
                        <View style={styles.statItem}>
                          <Heart size={14} color="#ef4444" fill="rgba(239, 68, 68, 0.2)" />
                          <Text style={[styles.statText, { color: colors.secondaryText }]}>
                            {likesCount}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <MessageCircle size={14} color={colors.secondaryText} />
                          <Text style={[styles.statText, { color: colors.secondaryText }]}>
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
        )}
      </ScrollView>

      {/* ── Sort Options Modal ── */}
      <Modal
        visible={isSortModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSortModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsSortModalOpen(false)}
        >
          <View
            style={[
              styles.sortModalBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sortModalTitle, { color: colors.text }]}>Sort Blogs By</Text>
            {SORT_OPTIONS.map((option) => {
              const isSelected = sortBy === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSortBy(option.value);
                    setIsSortModalOpen(false);
                  }}
                  style={[
                    styles.sortModalRow,
                    isSelected && {
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortModalRowText,
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
  scrollContent: {
    paddingBottom: 110,
  },
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  createBlogButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 6,
  },
  createBlogButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
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
  typeAndSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  typeSwitcher: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  typeTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  typeTabText: {
    fontSize: 13,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  featuredContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    position: 'relative',
  },
  featuredCard: {
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  featuredCover: {
    width: '100%',
    height: '100%',
  },
  featuredScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'flex-end',
    padding: 16,
  },
  featuredBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  featuredCategoryBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featuredCategoryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  featuredReadTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featuredReadTimeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  featuredTitle: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
    marginBottom: 10,
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredAuthorName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  featuredDate: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginTop: 1,
  },
  readArticleBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  readArticleBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  carouselIndicators: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 6,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  carouselDotActive: {
    backgroundColor: '#10b981',
    width: 14,
  },
  carouselControls: {
    position: 'absolute',
    top: 14,
    left: 28,
    flexDirection: 'row',
    gap: 8,
  },
  carouselArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesSection: {
    marginBottom: 12,
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
  },
  tagsSection: {
    marginBottom: 14,
  },
  tagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tagsHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagsList: {
    paddingHorizontal: 16,
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 12,
  },
  resultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearFiltersText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '700',
  },
  blogsFeed: {
    paddingHorizontal: 16,
    gap: 14,
  },
  blogCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardCategoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardCategoryBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    padding: 14,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardMetaText: {
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  cardExcerpt: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  cardAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  cardAuthorName: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  cardEngagement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    marginHorizontal: 16,
    padding: 36,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  clearButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sortModalBox: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sortModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  sortModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sortModalRowText: {
    fontSize: 14,
  },
});