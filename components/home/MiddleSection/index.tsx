import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import type { UserProfile } from '@/lib/services/AuthService';
import { PostService, type FeedFilter as ApiFeedFilter, type PostItem } from '@/lib/services/PostService';
import { DiagnosticLogService } from '@/lib/services/DiagnosticLogService';
import { CreatePostSection } from './MiddleSectionComponent/CreatePostSection/CreatePostSection';
import { FeedsFilterSection, type FeedFilter } from './MiddleSectionComponent/FeedsFilterSection/FeedsFilterSection';
import CommentsModal from './MiddleSectionComponent/CommentsModal/CommentsModal';
import PollCardSection from './MiddleSectionComponent/PostCardSection/PollCardSection';
import PostCardSection from './MiddleSectionComponent/PostCardSection/PostCardSection';
import PromotedCarousel from '../PromotedCarousel';
import SuggestedUsersSection from '../SuggestedUsersSection';
import { SkeletonPostCard } from '../SkeletonLoaders';

type MiddleSectionProps = {
  userProfile: UserProfile;
  createdPost: PostItem | null;
  onCreatePost: () => void;
};

const postService = PostService.getInstance();
const diagnosticLogService = DiagnosticLogService.getInstance();
type CachedFeed = { posts: PostItem[]; nextCursor: string | null; hasMore: boolean };
const apiFilterByUiFilter: Record<FeedFilter, ApiFeedFilter> = { All: 'all', Photos: 'photo', Videos: 'video', Sound: 'audio', Polls: 'poll', Events: 'event' };

export default function MiddleSection({ userProfile, createdPost, onCreatePost }: MiddleSectionProps) {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('All');
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const feedCache = useRef<Map<FeedFilter, CachedFeed>>(new Map());
  const feedRequestRef = useRef<AbortController | null>(null);
  const feedRequestIdRef = useRef(0);

  const loadFeedPosts = useCallback(async (filter: FeedFilter = 'All', force = false) => {
    const cached = feedCache.current.get(filter);
    if (cached && !force) {
      setPosts(cached.posts);
      setNextCursor(cached.nextCursor);
      setHasMore(cached.hasMore);
      setIsLoading(false);
      return;
    }
    feedRequestRef.current?.abort();
    setLoadingMore(false);
    const controller = new AbortController();
    feedRequestRef.current = controller;
    const requestId = ++feedRequestIdRef.current;
    diagnosticLogService.info('MiddleSection', 'load-feed:start', { requestedLimit: 20, filter });
    setFeedError(null);
    try {
      const page = await postService.fetchFeedPage({ limit: 20, filter: apiFilterByUiFilter[filter], signal: controller.signal });
      if (requestId !== feedRequestIdRef.current) return;
      feedCache.current.set(filter, page);
      setPosts(page.posts);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      diagnosticLogService.success('MiddleSection', 'load-feed', {
        receivedPostCount: page.posts.length,
        postIds: page.posts.map((post) => post.id),
        hasMore: page.hasMore,
      });
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Unknown Firestore feed error';
      diagnosticLogService.error('MiddleSection', 'load-feed', error);
      setFeedError(message);
      setPosts([]);
    } finally {
      if (requestId === feedRequestIdRef.current) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadFeedPosts('All');
    return () => feedRequestRef.current?.abort();
  }, [loadFeedPosts]);

  useEffect(() => {
    if (!createdPost) return;
    const cachedAll = feedCache.current.get('All');
    const nextAllPosts = [createdPost, ...(cachedAll?.posts ?? []).filter((post) => post.id !== createdPost.id)];
    feedCache.current.set('All', { posts: nextAllPosts, nextCursor: cachedAll?.nextCursor ?? null, hasMore: cachedAll?.hasMore ?? false });
    setPosts(nextAllPosts);
    setNextCursor(cachedAll?.nextCursor ?? null);
    setHasMore(cachedAll?.hasMore ?? false);
    setActiveFilter('All');
  }, [createdPost]);
  const activePost = activePostId ? posts.find((post) => post.id === activePostId) ?? null : null;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadFeedPosts(activeFilter, true);
  }, [activeFilter, loadFeedPosts]);

  const handleFilterChange = useCallback((filter: FeedFilter) => {
    setActiveFilter(filter);
    setFeedError(null);
    if (!feedCache.current.has(filter)) setIsLoading(true);
    void loadFeedPosts(filter);
  }, [loadFeedPosts]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore || refreshing || isLoading) return;
    feedRequestRef.current?.abort();
    const controller = new AbortController();
    feedRequestRef.current = controller;
    const requestId = ++feedRequestIdRef.current;
    setLoadingMore(true);
    try {
      const page = await postService.fetchFeedPage({ limit: 20, cursor: nextCursor, filter: apiFilterByUiFilter[activeFilter], signal: controller.signal });
      if (requestId !== feedRequestIdRef.current) return;
      setPosts((current) => {
        const reconciled = [...current, ...page.posts.filter((post) => !current.some((item) => item.id === post.id))];
        feedCache.current.set(activeFilter, { posts: reconciled, nextCursor: page.nextCursor, hasMore: page.hasMore });
        return reconciled;
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      diagnosticLogService.error('MiddleSection', 'load-more', error, { nextCursor });
    } finally {
      if (requestId === feedRequestIdRef.current) setLoadingMore(false);
    }
  }, [activeFilter, hasMore, isLoading, loadingMore, nextCursor, refreshing]);

  const handleCommentClick = (postId: string) => setActivePostId(postId);
  const handlePostDelete = (postId: string) => {
    setPosts((current) => current.filter((post) => post.id !== postId));
    feedCache.current.forEach((cached, key) => feedCache.current.set(key, { ...cached, posts: cached.posts.filter((post) => post.id !== postId) }));
  };
  const handleAuthorBlocked = (userId: string) => {
    setPosts((current) => current.filter((post) => post.userId !== userId));
    feedCache.current.forEach((cached, key) => feedCache.current.set(key, { ...cached, posts: cached.posts.filter((post) => post.userId !== userId) }));
  };
  const handlePostUpdate = (updatedPost: PostItem) => {
    setPosts((current) => current.map((post) => post.id === updatedPost.id ? updatedPost : post));
    feedCache.current.forEach((cached, key) => feedCache.current.set(key, { ...cached, posts: cached.posts.map((post) => post.id === updatedPost.id ? updatedPost : post) }));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f8f9fa' }}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={250}
      onScroll={({ nativeEvent }) => {
        const distanceFromBottom = nativeEvent.contentSize.height - (nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height);
        if (distanceFromBottom < 500) void handleLoadMore();
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#10b981" colors={['#10b981']} />}
    >
      <View style={{ marginHorizontal: 16, marginBottom: 16, padding: 18, borderRadius: 20, backgroundColor: '#ffffff', shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
        <CreatePostSection
          onCreatePost={onCreatePost}
          profileImageUrl={userProfile.profilePicture}
          userInitial={userProfile.firstName}
        />
      </View>

      <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
        <FeedsFilterSection activeFilter={activeFilter} onFilterChange={handleFilterChange} />
      </View>

      {isLoading ? (
        <View style={{ marginHorizontal: 16 }}>
          <SkeletonPostCard />
          <SkeletonPostCard />
        </View>
      ) : feedError ? (
        <View style={{ minHeight: 340, marginHorizontal: 16, paddingHorizontal: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff7f7' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Icon name="alert-triangle" size={30} color="#c64d53" />
          </View>
          <Text style={{ color: '#991b1b', fontSize: 20, fontWeight: '700', textAlign: 'center' }}>Could not load your feed</Text>
          <Text style={{ marginTop: 9, color: '#7f1d1d', fontSize: 13, textAlign: 'center' }}>{feedError}</Text>
          <Text style={{ marginTop: 8, color: '#6b7280', fontSize: 12, textAlign: 'center' }}>Check Metro for logs beginning with [Ourlime.Mobile][PostService].</Text>
          <TouchableOpacity onPress={() => { setIsLoading(true); void loadFeedPosts(activeFilter, true); }} style={{ marginTop: 18, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 18, backgroundColor: '#10b981' }}>
            <Text style={{ color: '#ffffff', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : posts.length === 0 ? (
        <View style={{ minHeight: 360, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Icon name={activeFilter === 'All' ? 'inbox' : 'filter'} size={34} color="#10b981" />
          </View>
          <Text style={{ color: '#111827', fontSize: 21, fontWeight: '700' }}>
            {activeFilter === 'All' ? 'Your feed is empty' : `No ${activeFilter.toLowerCase()} posts`}
          </Text>
          <Text style={{ marginTop: 8, color: '#6b7280', fontSize: 15, textAlign: 'center' }}>
            {activeFilter === 'All' ? 'Be the first to create a post!' : 'Try another filter or pull down to refresh.'}
          </Text>
        </View>
      ) : (
        posts.map((post, index) => (
          <View key={post.id}>
            <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
              {post.type === 'poll' ? (
                <PollCardSection post={post} onCommentClick={handleCommentClick} onPostDelete={handlePostDelete} onAuthorBlocked={handleAuthorBlocked} onPostUpdate={handlePostUpdate} />
              ) : (
                <PostCardSection post={post} onCommentClick={handleCommentClick} onPostDelete={handlePostDelete} onAuthorBlocked={handleAuthorBlocked} onPostUpdate={handlePostUpdate} />
              )}
            </View>
            {index === 1 && (
              <View style={{ marginHorizontal: 16 }}>
                <PromotedCarousel />
              </View>
            )}
            {index === 4 && (
              <View style={{ marginHorizontal: 16 }}>
                <SuggestedUsersSection />
              </View>
            )}
          </View>
        ))
      )}

      {loadingMore ? <ActivityIndicator color="#10b981" style={{ marginVertical: 18 }} /> : null}
      {!loadingMore && !hasMore && posts.length > 0 ? <Text style={{ marginVertical: 22, color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>That&apos;s a wrap — no more posts.</Text> : null}

      {activePost ? (
        <CommentsModal
          post={activePost}
          userId={userProfile.uid}
          onClose={() => setActivePostId(null)}
          onPostUpdate={handlePostUpdate}
        />
      ) : null}
    </ScrollView>
  );
}
