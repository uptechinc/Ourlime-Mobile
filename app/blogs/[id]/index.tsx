import { useCallback, useEffect, useRef, useState } from 'react';
import {
  findNodeHandle,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Archive,
  BadgeCheck,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  Flag,
  RotateCcw,
  Share2,
  Shield,
  Trash2,
} from 'lucide-react-native';
import { BlogNotFoundError, BlogsAndArticlesService } from '@/lib/blogs&articles/BlogsAndArticlesService';
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
import CreateBlogModal from '@/components/blogs/CreateBlogModal';
import ReportPostModal, { type ReportTarget } from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/ReportPostModal';
import { stripHtml } from '@/lib/utils/htmlUtils';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import type { BlogComment, BlogCommentReply, BlogListItem, BlogPostDetail } from '@/lib/types/blog';

const blogService = BlogsAndArticlesService.getInstance();

// Kept identical to Ourlime-Web app/blogs/[id]/page.tsx.
const GENERAL_NOTICE_TEXT = "Reader Content Notice: Identity verification verifies the author's real name or institutional association, but does not verify the accuracy, completeness, or authority of the content. Ourlime does not endorse, verify, or assume responsibility for any user-generated content, opinions, or advice.";

function getCategoryNotice(categoryId: string): { title: string; text: string } | null {
  const category = categoryId.toLowerCase();
  if (category === 'health' || category === 'wellness') {
    return { title: 'Health Notice', text: 'The information provided in this article is for general educational and informational purposes only. It is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.' };
  }
  if (category === 'legal') {
    return { title: 'Legal Notice', text: 'The content of this article is for informational purposes only and does not constitute legal advice. Readers should contact their attorney to obtain advice with respect to any particular legal matter. No reader should act or refrain from acting on the basis of information on this site without first seeking legal advice from counsel in the relevant jurisdiction.' };
  }
  if (category === 'finance' || category === 'business') {
    return { title: 'Financial Notice', text: 'The information contained in this article is for general informational and educational purposes only and does not constitute financial, investment, or tax advice. Past performance is not indicative of future results. Ourlime does not provide personalized investment advice and does not recommend the purchase or sale of any security or investment.' };
  }
  return null;
}

function fromListItem(item: BlogListItem): BlogPostDetail {
  return {
    id: item.id,
    userId: item.userId,
    title: item.title,
    type: item.type,
    excerpt: item.excerpt,
    content: '',
    coverImage: item.coverImage,
    categoryId: item.categoryId,
    category: item.categoryName,
    readTime: item.readTime,
    sources: [],
    tags: item.tags.map((name) => ({ name })),
    categories: [{ name: item.categoryName }],
    engagement: [{ likesCount: item.likesCount, commentsCount: item.commentsCount, sharesCount: 0, viewsCount: item.viewsCount, readTimeAverage: 0 }],
    author: { id: item.author.id, name: item.author.name, avatar: item.author.avatar, isVerified: item.author.isVerified },
    createdAt: item.createdAtMs ? new Date(item.createdAtMs).toISOString() : undefined,
    status: item.status,
  };
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
}

type DialogState = {
  visible: boolean;
  type: CustomModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
};

export default function BlogDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const blogId = id as string;
  const { activeUserId: currentUserId } = useAppData();
  const { colors, isDark } = useAppTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const composerRef = useRef<TextInput>(null);
  const { getDecision } = usePageAccess();
  const canMutate = getDecision('/blogs').canMutate;
  const [dialogState, setDialogState] = useState<DialogState>({ visible: false, type: 'info', title: '', message: '' });
  const closeDialog = () => setDialogState((prev) => ({ ...prev, visible: false }));
  const showError = (title: string, message: string) => setDialogState({ visible: true, type: 'error', title, message, confirmText: 'OK' });

  const cached = blogService.getCachedPost(blogId);
  const initialBlog: BlogPostDetail | null = cached ? ('categoryName' in cached ? fromListItem(cached) : cached) : null;

  const [blog, setBlog] = useState<BlogPostDetail | null>(initialBlog);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(!initialBlog);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialBlog?.engagement[0]?.likesCount ?? 0);
  const [shareVisible, setShareVisible] = useState(false);
  const [failedCoverImage, setFailedCoverImage] = useState<string | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const likePending = useRef(false);
  const bookmarkPending = useRef(false);
  const viewTracked = useRef(false);
  const loadGeneration = useRef(0);
  const [interactionsReady, setInteractionsReady] = useState(false);

  const isOwner = Boolean(currentUserId && blog && currentUserId === blog.userId);

  const reloadComments = useCallback(async () => {
    const latest = await blogService.getComments(blogId);
    setComments(latest);
    setCommentsError('');
  }, [blogId]);

  const loadBlogData = useCallback(async () => {
    if (!blogId) return;
    const generation = ++loadGeneration.current;
    setInteractionsReady(false);
    setError(null);
    setNotFound(false);
    try {
      const [blogData, commentsData, interactions] = await Promise.all([
        blogService.getPostDetail(blogId),
        blogService.getComments(blogId).catch(() => { setCommentsError('Comments could not be loaded. Tap to retry.'); return [] as BlogComment[]; }),
        currentUserId ? blogService.getInteractions(blogId).catch(() => ({ isLiked: false, isSaved: false })) : Promise.resolve({ isLiked: false, isSaved: false }),
      ]);
      if (generation !== loadGeneration.current) return;
      setBlog(blogData);
      setFailedCoverImage(null);
      setComments(commentsData);
      setLikesCount(blogData.engagement[0]?.likesCount ?? 0);
      setIsLiked(interactions.isLiked);
      setIsBookmarked(interactions.isSaved);
      setInteractionsReady(true);
      // Web counts one view per signed-in user per mount.
      if (currentUserId && blogData.status === 'published' && !viewTracked.current) {
        viewTracked.current = true;
        void blogService.updateInteraction(blogId, 'view').catch(() => undefined);
      }
    } catch (loadError: unknown) {
      if (generation !== loadGeneration.current) return;
      if (loadError instanceof BlogNotFoundError) {
        setBlog(null);
        setNotFound(true);
      } else {
        console.error('[BlogDetailScreen.loadBlogData] Error:', loadError instanceof Error ? loadError.message : loadError);
        setError('This blog post could not be loaded.');
      }
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [blogId, currentUserId]);

  useEffect(() => {
    likePending.current = false;
    bookmarkPending.current = false;
    void loadBlogData();
    return () => { loadGeneration.current += 1; };
  }, [loadBlogData]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollable = contentSize.height - layoutMeasurement.height;
    setReadingProgress(scrollable > 0 ? Math.min(1, Math.max(0, contentOffset.y / scrollable)) : 0);
  };

  const handleToggleLike = async () => {
    if (!canMutate || !currentUserId || !blog || !interactionsReady || likePending.current) return;
    likePending.current = true;
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikesCount((current) => Math.max(0, current + (nextState ? 1 : -1)));
    try {
      await blogService.updateInteraction(blog.id, 'like', nextState);
    } catch {
      setIsLiked(!nextState);
      setLikesCount((current) => Math.max(0, current + (nextState ? -1 : 1)));
      showError('Like not saved', 'Could not update your like. Please try again.');
    } finally {
      likePending.current = false;
    }
  };

  const handleToggleBookmark = async () => {
    if (!canMutate || !currentUserId || !blog || !interactionsReady || bookmarkPending.current) return;
    bookmarkPending.current = true;
    const nextState = !isBookmarked;
    setIsBookmarked(nextState);
    try {
      await blogService.updateInteraction(blog.id, 'save', nextState);
    } catch {
      setIsBookmarked(!nextState);
      showError('Bookmark not saved', 'Could not update your bookmark. Please try again.');
    } finally {
      bookmarkPending.current = false;
    }
  };

  const handleSubmitComment = async (text: string, replyToCommentId?: string) => {
    if (!canMutate || !currentUserId || !blog) throw new Error('Commenting is unavailable.');
    setCommentSubmitting(true);
    try {
      await blogService.addComment(blog.id, text, replyToCommentId);
      await reloadComments().catch(() => setCommentsError('Your comment was sent. Tap to refresh the discussion.'));
    } catch (commentError: unknown) {
      // Surfaces BLOG_COMMENT_RATE_LIMIT (429) and BLOG_COMMENTING_DISABLED messages from the API.
      showError('Comment not sent', commentError instanceof Error ? commentError.message : 'Please try again.');
      throw commentError;
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!blog) return;
    try {
      await blogService.deleteComment(blog.id, commentId);
      await reloadComments();
    } catch (deleteError: unknown) {
      showError('Comment not deleted', deleteError instanceof Error ? deleteError.message : 'Could not delete comment. Please try again.');
      throw deleteError;
    }
  };

  const handleReportComment = (comment: BlogComment | BlogCommentReply, parentId?: string) => {
    if (!canMutate || !blog) return;
    setReportTarget({
      contentType: 'blog_comment',
      targetId: parentId ? `${parentId}:${comment.id}` : comment.id,
      reportedUserId: comment.userId,
      parentContentId: blog.id,
      routePath: `/blogs/${blog.id}`,
      previewText: comment.text,
      label: parentId ? 'Reply' : 'Comment',
    });
  };

  const handleReportBlog = () => {
    if (!blog) return;
    setReportTarget({
      contentType: 'blog',
      targetId: blog.id,
      reportedUserId: blog.userId,
      parentContentId: blog.id,
      routePath: `/blogs/${blog.id}`,
      previewText: stripHtml(blog.title),
      label: 'Blog',
    });
  };

  // Web handleArchiveToggle: PATCH status archived ⇄ published.
  const handleArchiveToggle = async () => {
    if (!blog) return;
    const nextStatus = blog.status === 'archived' ? 'published' : 'archived';
    try {
      await blogService.updatePost(blog.id, { status: nextStatus, disclaimerAcceptance: { accepted: nextStatus === 'published' } });
      setBlog((previous) => (previous ? { ...previous, status: nextStatus } : previous));
      setDialogState({ visible: true, type: 'success', title: nextStatus === 'archived' ? 'Archived' : 'Restored', message: nextStatus === 'archived' ? 'Blog post archived successfully.' : 'Blog post restored successfully.', confirmText: 'OK' });
    } catch (archiveError: unknown) {
      showError('Status not updated', archiveError instanceof Error ? archiveError.message : 'Failed to update post status. Please try again.');
    }
  };

  const handleConfirmDelete = () => {
    setDialogState({
      visible: true,
      type: 'danger',
      title: 'Delete Post',
      message: 'Are you sure you want to delete this post? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        closeDialog();
        if (!blog) return;
        void blogService.deletePost(blog.id)
          .then(() => (router.canGoBack() ? router.back() : router.replace('/blogs')))
          .catch((deleteError: unknown) => showError('Post not deleted', deleteError instanceof Error ? deleteError.message : 'Failed to delete post. Please try again.'));
      },
    });
  };

  const handleScrollToComments = () => {
    const scrollView = scrollViewRef.current;
    if (!scrollView) return;
    setTimeout(() => scrollView.scrollToEnd({ animated: true }), 0);
    if (!canMutate) return;
    setTimeout(() => {
      const composer = composerRef.current;
      if (!composer) return;
      composer.focus();
      const composerHandle = findNodeHandle(composer);
      if (composerHandle !== null) scrollView.scrollResponderScrollNativeHandleToKeyboard(composerHandle, 12, true);
    }, 450);
  };

  const categoryNotice = blog?.categoryId ? getCategoryNotice(blog.categoryId) : null;
  const viewsCount = blog?.engagement[0]?.viewsCount ?? 0;
  const publishedLabel = blog?.createdAt ? new Date(String(blog.createdAt)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.canvas }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => (router.canGoBack() ? router.back() : router.navigate('/blogs'))}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{blog?.category || 'Blog'}</Text>
        <View style={styles.headerRight}>
          {blog && !notFound ? (
            <TouchableOpacity activeOpacity={0.7} onPress={handleToggleBookmark} style={styles.headerBtn} accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
              <Bookmark size={20} color={isBookmarked ? '#10b981' : colors.text} fill={isBookmarked ? '#10b981' : 'transparent'} />
            </TouchableOpacity>
          ) : null}
          {blog && !notFound ? (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setShareVisible(true)} style={styles.headerBtn} accessibilityLabel="Share">
              <Share2 size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          {blog && !notFound && !isOwner && canMutate ? (
            <TouchableOpacity activeOpacity={0.7} onPress={handleReportBlog} style={styles.headerBtn} accessibilityLabel="Report blog">
              <Flag size={19} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {/* Reading progress (web: fixed top bar) */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${readingProgress * 100}%` }]} />
      </View>

      {loading ? (
        <BlogDetailSkeleton />
      ) : notFound ? (
        <View style={styles.errorContainer}>
          <Text style={styles.notFoundCode}>404</Text>
          <Text style={[styles.notFoundTitle, { color: colors.text }]}>Article Not Found</Text>
          <Text style={[styles.errorText, { color: colors.mutedText }]}>The article you are looking for does not exist or has been removed.</Text>
          <TouchableOpacity onPress={() => router.replace('/blogs')} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Explore Blogs</Text>
          </TouchableOpacity>
        </View>
      ) : error || !blog ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>{error || 'Blog not found.'}</Text>
          <TouchableOpacity onPress={() => void loadBlogData()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} onScroll={handleScroll} scrollEventThrottle={32}>
          {blog.status !== 'published' ? (
            <View style={[styles.statusBanner, { backgroundColor: colors.warningSurface }]}>
              <Text style={[styles.statusBannerText, { color: colors.warningText }]}>
                {blog.status === 'archived' ? 'This post is archived and hidden from readers.' : blog.status === 'draft' ? 'Draft — only you can see this post.' : `Status: ${blog.status}`}
              </Text>
            </View>
          ) : null}

          <View style={styles.articleBody}>
            <View style={styles.metaRow}>
              {blog.categoryId ? (
                <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{blog.categoryId.toUpperCase()}</Text></View>
              ) : null}
              <View style={styles.readTimeRow}>
                <Clock size={13} color={colors.mutedText} />
                <Text style={[styles.readTimeText, { color: colors.mutedText }]}>{blog.readTime || 1} min read</Text>
                <Eye size={13} color={colors.mutedText} style={{ marginLeft: 8 }} />
                <Text style={[styles.readTimeText, { color: colors.mutedText }]}>{formatCount(viewsCount)}</Text>
              </View>
            </View>
            {publishedLabel ? <Text style={[styles.dateText, { color: colors.mutedText }]}>{publishedLabel}</Text> : null}

            <Text style={[styles.articleTitle, { color: colors.text }]}>{stripHtml(blog.title)}</Text>
            {blog.excerpt ? <Text style={[styles.leadExcerpt, { color: isDark ? '#94a3b8' : '#475569', borderLeftColor: '#10b981' }]}>{stripHtml(blog.excerpt)}</Text> : null}

            <TouchableOpacity activeOpacity={0.7} onPress={() => blog.userId && router.push(`/profile/${blog.userId}`)} style={[styles.authorRow, { borderBottomColor: colors.border }]}>
              <UserAvatar profileImage={blog.author.avatar} firstName={blog.author.name} size={44} />
              <View style={styles.authorInfo}>
                <View style={styles.authorNameRow}>
                  <Text style={[styles.authorName, { color: colors.text }]}>{blog.author.name}</Text>
                  {blog.author.isVerified ? <BadgeCheck size={16} color="#10b981" /> : null}
                  <View style={[styles.authorPill, { backgroundColor: colors.control }]}><Text style={[styles.authorPillText, { color: colors.secondaryText }]}>Author</Text></View>
                </View>
                {blog.author.role || blog.author.company ? (
                  <Text style={[styles.authorSubtext, { color: colors.mutedText }]}>{[blog.author.role, blog.author.company].filter(Boolean).join(' at ')}</Text>
                ) : null}
              </View>
            </TouchableOpacity>

            {isOwner ? (
              <View style={styles.ownerActions}>
                <TouchableOpacity onPress={() => setIsEditOpen(true)} style={[styles.ownerButton, { backgroundColor: '#10b981' }]}>
                  <Edit3 size={14} color="#ffffff" /><Text style={[styles.ownerButtonText, { color: '#ffffff' }]}>Edit Post</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void handleArchiveToggle()} style={[styles.ownerButton, { backgroundColor: colors.warningSurface }]}>
                  {blog.status === 'archived' ? <RotateCcw size={14} color={colors.warningText} /> : <Archive size={14} color={colors.warningText} />}
                  <Text style={[styles.ownerButtonText, { color: colors.warningText }]}>{blog.status === 'archived' ? 'Restore' : 'Archive'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirmDelete} style={[styles.ownerButton, { backgroundColor: colors.destructiveSurface }]}>
                  <Trash2 size={14} color={colors.destructiveText} /><Text style={[styles.ownerButtonText, { color: colors.destructiveText }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Reader Content Notice */}
            <View style={[styles.noticeBox, { backgroundColor: isDark ? '#0f172a' : '#fffbeb', borderLeftColor: '#f59e0b' }]}>
              <View style={styles.noticeTitleRow}>
                <Shield size={18} color={isDark ? '#fcd34d' : '#b45309'} />
                <Text style={[styles.noticeTitle, { color: isDark ? '#fcd34d' : '#78350f' }]}>Reader Content Notice</Text>
              </View>
              <Text style={[styles.noticeText, { color: colors.text }]}>{GENERAL_NOTICE_TEXT}</Text>
              {categoryNotice ? (
                <View style={[styles.noticeSection, { borderTopColor: isDark ? '#334155' : '#fde68a' }]}>
                  <Text style={[styles.noticeTitle, { color: isDark ? '#fcd34d' : '#78350f' }]}>{categoryNotice.title}</Text>
                  <Text style={[styles.noticeText, { color: colors.text }]}>{categoryNotice.text}</Text>
                </View>
              ) : null}
            </View>

            {blog.coverImage && blog.coverImage !== failedCoverImage ? (
              <Image source={{ uri: blog.coverImage }} style={styles.coverImage} resizeMode="cover" accessibilityLabel={`${stripHtml(blog.title)} cover image`} onError={() => setFailedCoverImage(blog.coverImage)} />
            ) : null}

            {blog.tags.length > 0 ? (
              <View style={styles.tagsCloud}>
                {blog.tags.map((tag) => (
                  <View key={tag.name} style={[styles.tagChip, { backgroundColor: isDark ? '#064e3b33' : '#ecfdf5', borderColor: '#10b981' }]}>
                    <Text style={styles.tagText}>#{tag.name}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <RichBlogContent content={blog.content} />

            {blog.sources && blog.sources.length > 0 ? (
              <View style={[styles.sourcesContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity onPress={() => setSourcesOpen((open) => !open)} style={styles.sourcesHeader} accessibilityRole="button">
                  <Text style={[styles.sourcesTitle, { color: colors.text }]}>Sources & References ({blog.sources.length})</Text>
                  {sourcesOpen ? <ChevronUp size={18} color={colors.mutedText} /> : <ChevronDown size={18} color={colors.mutedText} />}
                </TouchableOpacity>
                {sourcesOpen ? blog.sources.map((source, sourceIndex) => {
                  const year = source.publishDate ? new Date(String(source.publishDate)).getFullYear() : null;
                  return (
                    <View key={`source-${sourceIndex}`} style={[styles.sourceItem, { borderTopColor: colors.border }]}>
                      <Text style={[styles.sourceItemTitle, { color: colors.text }]}>{source.title || source.url}</Text>
                      {source.author || (year && year > 1970) ? (
                        <Text style={[styles.sourceItemAuthor, { color: colors.mutedText }]}>
                          {[source.author ? `by ${source.author}` : '', year && year > 1970 ? String(year) : ''].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                      {source.url ? (
                        <TouchableOpacity onPress={() => void Linking.openURL(source.url).catch(() => undefined)} style={styles.sourceLink}>
                          <ExternalLink size={13} color="#10b981" /><Text style={styles.sourceLinkText}>View source</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                }) : null}
              </View>
            ) : null}

            <BlogEngagementBar
              likesCount={likesCount}
              commentsCount={comments.length}
              isLiked={isLiked}
              isBookmarked={isBookmarked}
              onLikePress={handleToggleLike}
              onBookmarkPress={handleToggleBookmark}
              onCommentPress={handleScrollToComments}
              interactionsReady={interactionsReady && canMutate}
              onSharePress={() => setShareVisible(true)}
            />

            <BlogAuthorCard author={blog.author} />

            <View>
              {commentsError ? (
                <TouchableOpacity onPress={() => void reloadComments().catch(() => undefined)} style={{ padding: 14 }}>
                  <Text style={{ color: colors.destructive }}>{commentsError}</Text>
                </TouchableOpacity>
              ) : null}
              <BlogCommentsSection
                key={`${currentUserId}:${blogId}`}
                composerRef={composerRef}
                canMutate={canMutate && Boolean(currentUserId)}
                blogOwnerId={blog.userId}
                comments={comments}
                submitting={commentSubmitting}
                onSubmitComment={handleSubmitComment}
                onDeleteComment={handleDeleteComment}
                onReportComment={handleReportComment}
                onLikeComment={(commentId, enabled, replyId) => blogService.setCommentLike(blogId, commentId, enabled, replyId)}
              />
            </View>
          </View>
        </ScrollView>
      )}

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

      {reportTarget ? <ReportPostModal visible target={reportTarget} onClose={() => setReportTarget(null)} /> : null}

      {blog && isOwner ? (
        <CreateBlogModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          userId={currentUserId ?? ''}
          editBlogId={blog.id}
          initialData={blog}
          onSuccess={() => void loadBlogData()}
        />
      ) : null}

      <CustomModal
        visible={dialogState.visible}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        onConfirm={dialogState.onConfirm ?? closeDialog}
        onCancel={closeDialog}
        onClose={closeDialog}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  headerTitle: { fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  progressTrack: { height: 3 },
  progressFill: { height: 3, backgroundColor: '#10b981' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { fontSize: 15, textAlign: 'center' },
  notFoundCode: { fontSize: 56, fontWeight: '900', color: '#10b981' },
  notFoundTitle: { fontSize: 22, fontWeight: '800' },
  retryBtn: { backgroundColor: '#10b981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, marginTop: 6 },
  retryBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  scrollContent: { paddingBottom: 60 },
  statusBanner: { paddingHorizontal: 20, paddingVertical: 10 },
  statusBannerText: { fontSize: 13, fontWeight: '700' },
  coverImage: { width: '100%', aspectRatio: 1200 / 630, borderRadius: 16, marginBottom: 16 },
  articleBody: { paddingHorizontal: 20, paddingTop: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  categoryBadge: { backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  readTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readTimeText: { fontSize: 12, fontWeight: '600' },
  dateText: { fontSize: 12, marginBottom: 10 },
  articleTitle: { fontSize: 26, lineHeight: 34, fontWeight: '900', marginBottom: 12 },
  leadExcerpt: { fontSize: 17, lineHeight: 26, fontWeight: '500', fontStyle: 'italic', marginBottom: 16, borderLeftWidth: 3, paddingLeft: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 14 },
  authorInfo: { flex: 1 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  authorName: { fontSize: 15, fontWeight: '800' },
  authorPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  authorPillText: { fontSize: 11, fontWeight: '700' },
  authorSubtext: { fontSize: 12, marginTop: 2 },
  ownerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  ownerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  ownerButtonText: { fontSize: 13, fontWeight: '700' },
  noticeBox: { borderLeftWidth: 4, borderTopRightRadius: 10, borderBottomRightRadius: 10, padding: 14, gap: 8, marginBottom: 18 },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeTitle: { fontSize: 14, fontWeight: '800' },
  noticeText: { fontSize: 13, lineHeight: 20, fontWeight: '500' },
  noticeSection: { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  tagsCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  tagText: { color: '#047857', fontSize: 13, fontWeight: '700' },
  sourcesContainer: { padding: 16, borderRadius: 16, borderWidth: 1, marginVertical: 14 },
  sourcesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourcesTitle: { fontSize: 15, fontWeight: '800' },
  sourceItem: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, gap: 3 },
  sourceItemTitle: { fontSize: 14, fontWeight: '700' },
  sourceItemAuthor: { fontSize: 12 },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  sourceLinkText: { color: '#10b981', fontSize: 13, fontWeight: '700' },
});
