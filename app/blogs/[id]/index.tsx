import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Share2,
  Bookmark,
  Clock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react-native';
import { BlogsAndArticlesService } from '@/lib/blogs&articles/BlogsAndArticlesService';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { deepLinkService } from '@/lib/services/DeepLinkService';
import UserAvatar from '@/components/ui/UserAvatar';
import ShareContentSheet from '@/components/sharing/ShareContentSheet';
import RichBlogContent from '@/components/blog/RichBlogContent';
import BlogAuthorCard from '@/components/blog/BlogAuthorCard';
import BlogEngagementBar from '@/components/blog/BlogEngagementBar';
import BlogCommentsSection from '@/components/blog/BlogCommentsSection';
import BlogDetailSkeleton from '@/components/blog/BlogDetailSkeleton';
import { stripHtml } from '@/lib/utils/htmlUtils';
import type { BlogPostDetail, BlogComment } from '@/lib/types/blog';

const blogService = BlogsAndArticlesService.getInstance();

export default function BlogDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const blogId = id as string;
  const { activeUserId: currentUserId } = useAppData();
  const { colors, isDark } = useAppTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const cached = blogService.getCachedPost(blogId);
  const initialBlog: BlogPostDetail | null = cached
    ? ('categoryId' in cached
        ? (cached as BlogPostDetail)
        : {
            id: cached.id,
            userId: cached.author?.id || '',
            title: cached.title,
            type: 'blog',
            excerpt: cached.excerpt,
            content: cached.excerpt,
            coverImage: cached.coverImage,
            categoryId: cached.category || 'technology',
            category: cached.category || 'technology',
            slug: '',
            readTime: cached.readTime,
            sources: [],
            tags: cached.tags?.map((t) => ({ name: t.name })) || [],
            categories: cached.categories?.map((c) => ({ name: c.name })) || [],
            engagement: [
              {
                likesCount: 'likes' in cached ? cached.likes : 0,
                commentsCount: 'comments' in cached ? cached.comments : 0,
                sharesCount: 0,
                viewsCount: 0,
                readTimeAverage: 0,
              },
            ],
            status: 'published',
            author: {
              id: cached.author?.id || '',
              name: cached.author?.name || 'Author',
              avatar: cached.author?.avatar || '',
              bio: '',
              role: '',
              company: '',
              followersCount: 0,
              isVerified: cached.author?.isVerified || false,
            },
          })
    : null;

  const [blog, setBlog] = useState<BlogPostDetail | null>(initialBlog);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(!initialBlog);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialBlog?.engagement[0]?.likesCount ?? 0);
  const [commentsCount, setCommentsCount] = useState(initialBlog?.engagement[0]?.commentsCount ?? 0);
  const [shareVisible, setShareVisible] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const loadBlogData = useCallback(async () => {
    if (!blogId) return;
    if (!blog) setLoading(true);
    setError(null);
    try {
      const [blogData, commentsData, interactions] = await Promise.all([
        blogService.getPostDetail(blogId),
        blogService.getComments(blogId).catch(() => []),
        blogService.getInteractions(blogId).catch(() => ({ isLiked: false, isSaved: false })),
      ]);

      setBlog(blogData);
      setComments(commentsData);
      setLikesCount(blogData.engagement[0]?.likesCount ?? 0);
      setCommentsCount(commentsData.length || (blogData.engagement[0]?.commentsCount ?? 0));
      setIsLiked(interactions.isLiked);
      setIsBookmarked(interactions.isSaved);

      // Track view
      void blogService.updateInteraction(blogId, 'view').catch(() => {});
    } catch (loadError: unknown) {
      console.error('[BlogDetailScreen.loadBlogData]', loadError);
      if (!blog) setError('This blog post could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [blog, blogId]);

  useEffect(() => {
    void loadBlogData();
  }, [loadBlogData]);

  const handleToggleLike = async () => {
    if (!currentUserId || !blog) return;
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikesCount((count) => (nextState ? count + 1 : Math.max(0, count - 1)));
    try {
      await blogService.updateInteraction(blog.id, 'like', nextState);
    } catch {
      setIsLiked(!nextState);
      setLikesCount((count) => (!nextState ? count + 1 : Math.max(0, count - 1)));
    }
  };

  const handleToggleBookmark = async () => {
    if (!currentUserId || !blog) return;
    const nextState = !isBookmarked;
    setIsBookmarked(nextState);
    try {
      await blogService.updateInteraction(blog.id, 'save', nextState);
    } catch {
      setIsBookmarked(!nextState);
    }
  };

  const handleSubmitComment = async (text: string, replyToCommentId?: string) => {
    if (!currentUserId || !blog) return;
    setCommentSubmitting(true);
    try {
      await blogService.addComment(blog.id, text, replyToCommentId);
      const updatedComments = await blogService.getComments(blog.id);
      setComments(updatedComments);
      setCommentsCount(updatedComments.length);
    } catch (commentErr) {
      console.error('[handleSubmitComment] Error:', commentErr);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!blog) return;
    try {
      await blogService.deleteComment(blog.id, commentId);
      const updatedComments = await blogService.getComments(blog.id);
      setComments(updatedComments);
      setCommentsCount(updatedComments.length);
    } catch (delErr) {
      console.error('[handleDeleteComment] Error:', delErr);
    }
  };

  const handleReportComment = (comment: BlogComment) => {
    // Non-blocking report alert / integration
  };

  const scrollToComments = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const getCategoryNotice = (categoryId: string) => {
    const cat = categoryId.toLowerCase();
    if (cat === 'health' || cat === 'wellness') {
      return {
        title: 'Health Notice',
        text: 'The information in this article is for educational purposes only. Always consult a qualified health provider for medical advice.',
      };
    }
    if (cat === 'legal') {
      return {
        title: 'Legal Notice',
        text: 'The content in this article is for informational purposes and does not constitute legal advice. Readers should seek legal counsel in their jurisdiction.',
      };
    }
    if (cat === 'finance' || cat === 'business') {
      return {
        title: 'Financial Notice',
        text: 'The information in this article does not constitute financial or investment advice. Past performance is not indicative of future results.',
      };
    }
    return null;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.canvas }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.navigate('/blogs');
            }
          }}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {blog?.category || 'Blog'}
        </Text>
        <View style={styles.headerRight}>
          {blog ? (
            <TouchableOpacity activeOpacity={0.7} onPress={handleToggleBookmark} style={styles.headerBtn}>
              <Bookmark
                size={20}
                color={isBookmarked ? '#10b981' : colors.text}
                fill={isBookmarked ? '#10b981' : 'transparent'}
              />
            </TouchableOpacity>
          ) : null}
          {blog ? (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setShareVisible(true)} style={styles.headerBtn}>
              <Share2 size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <BlogDetailSkeleton />
      ) : error || !blog ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>{error || 'Blog not found.'}</Text>
          <TouchableOpacity onPress={() => void loadBlogData()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Cover Hero Image */}
          {blog.coverImage ? (
            <Image
              source={{ uri: blog.coverImage }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : null}

          <View style={styles.articleBody}>
            {/* Category & Meta */}
            <View style={styles.metaRow}>
              {blog.category ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{blog.category.toUpperCase()}</Text>
                </View>
              ) : null}
              <View style={styles.readTimeRow}>
                <Clock size={13} color={colors.mutedText} />
                <Text style={[styles.readTimeText, { color: colors.mutedText }]}>
                  {blog.readTime || 3} min read
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text style={[styles.articleTitle, { color: colors.text }]}>{stripHtml(blog.title)}</Text>

            {/* Author Row */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => blog.author.id && router.push(`/profile/${blog.author.id}`)}
              style={styles.authorRow}
            >
              <UserAvatar
                profileImage={blog.author.avatar}
                firstName={blog.author.name}
                size={44}
              />
              <View style={styles.authorInfo}>
                <Text style={[styles.authorName, { color: colors.text }]}>{blog.author.name}</Text>
                <Text style={[styles.authorSubtext, { color: colors.mutedText }]}>
                  Published in {blog.category || 'Articles'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Notice Disclaimer if applicable */}
            {blog.categoryId && getCategoryNotice(blog.categoryId) ? (
              <View
                style={[
                  styles.disclaimerBox,
                  { backgroundColor: isDark ? '#78350f22' : '#fffbeb', borderColor: '#f59e0b' },
                ]}
              >
                <ShieldAlert size={18} color="#f59e0b" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.disclaimerTitle, { color: '#f59e0b' }]}>
                    {getCategoryNotice(blog.categoryId)?.title}
                  </Text>
                  <Text style={[styles.disclaimerText, { color: colors.text }]}>
                    {getCategoryNotice(blog.categoryId)?.text}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Excerpt Lead */}
            {blog.excerpt ? (
              <Text style={[styles.leadExcerpt, { color: isDark ? '#94a3b8' : '#475569' }]}>
                {stripHtml(blog.excerpt)}
              </Text>
            ) : null}

            {/* Rich Article Content */}
            <RichBlogContent content={blog.content} />

            {/* Tags Cloud */}
            {blog.tags && blog.tags.length > 0 ? (
              <View style={styles.tagsCloud}>
                {blog.tags.map((tag) => (
                  <View
                    key={tag.name}
                    style={[
                      styles.tagChip,
                      { backgroundColor: isDark ? '#064e3b33' : '#ecfdf5', borderColor: '#10b981' },
                    ]}
                  >
                    <Text style={styles.tagText}>#{tag.name}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Sources Section */}
            {blog.sources && blog.sources.length > 0 ? (
              <View style={[styles.sourcesContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sourcesTitle, { color: colors.text }]}>Sources & Citations</Text>
                {blog.sources.map((source, sIdx) => (
                  <TouchableOpacity
                    key={`source-${sIdx}`}
                    activeOpacity={0.7}
                    onPress={() => source.url && Linking.openURL(source.url)}
                    style={styles.sourceItem}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sourceItemTitle, { color: colors.text }]}>{source.title}</Text>
                      {source.author ? (
                        <Text style={[styles.sourceItemAuthor, { color: colors.mutedText }]}>by {source.author}</Text>
                      ) : null}
                    </View>
                    {source.url ? <ExternalLink size={16} color="#10b981" /> : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {/* In-feed Engagement Bar */}
            <BlogEngagementBar
              likesCount={likesCount}
              commentsCount={commentsCount}
              isLiked={isLiked}
              isBookmarked={isBookmarked}
              onLikePress={handleToggleLike}
              onBookmarkPress={handleToggleBookmark}
              onCommentPress={scrollToComments}
              onSharePress={() => setShareVisible(true)}
            />

            {/* Author Bio Card */}
            <BlogAuthorCard author={blog.author} />

            {/* Comments Thread */}
            <BlogCommentsSection
              comments={comments}
              submitting={commentSubmitting}
              onSubmitComment={handleSubmitComment}
              onDeleteComment={handleDeleteComment}
              onReportComment={handleReportComment}
            />
          </View>
        </ScrollView>
      )}

      {/* Share Sheet */}
      {blog ? (
        <ShareContentSheet
          visible={shareVisible}
          currentUserId={currentUserId ?? ''}
          contentLabel="blog"
          title={blog.title}
          message={`${blog.title}\n\n${deepLinkService.getBlogShareUrl(blog.id)}`}
          url={deepLinkService.getBlogShareUrl(blog.id)}
          onClose={() => setShareVisible(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  coverImage: {
    width: '100%',
    height: 240,
  },
  articleBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  readTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readTimeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  articleTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '900',
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f022',
    marginBottom: 16,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '800',
  },
  authorSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  leadExcerpt: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  tagsCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 16,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
  },
  sourcesContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 14,
    gap: 10,
  },
  sourcesTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f033',
  },
  sourceItemTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  sourceItemAuthor: {
    fontSize: 12,
    marginTop: 2,
  },
});
