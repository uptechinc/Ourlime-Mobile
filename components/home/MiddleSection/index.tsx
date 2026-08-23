import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
  type ViewToken,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import type { UserProfile } from '@/lib/services/AuthService';
import type { FeedFilter as ApiFeedFilter, FeedScope, PostItem } from '@/lib/services/PostService';
import { FeedResourceService } from '@/lib/services/FeedResourceService';
import { useFeedQuery } from '@/lib/hooks/useFeedQuery';
import { CreatePostSection } from './MiddleSectionComponent/CreatePostSection/CreatePostSection';
import { FeedsFilterSection, type FeedFilter, type FeedSource } from './MiddleSectionComponent/FeedsFilterSection/FeedsFilterSection';
import CommentsModal from './MiddleSectionComponent/CommentsModal/CommentsModal';
import PollCardSection from './MiddleSectionComponent/PostCardSection/PollCardSection';
import PostCardSection from './MiddleSectionComponent/PostCardSection/PostCardSection';
import SuggestedUsersSection from '@/components/home/SuggestedUsersSection';
import ActivityCard from '@/components/home/ActivityCard';
import { SkeletonPostCard } from '@/components/home/SkeletonLoaders';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppDrawer } from '@/lib/contexts/AppDrawerContext';

type MiddleSectionProps = {
  userProfile: UserProfile;
  createdPost: PostItem | null;
  onCreatePost: () => void;
};

const feedResourceService = FeedResourceService.getInstance();
const apiFilterByUiFilter: Record<FeedFilter, ApiFeedFilter> = {
  All: 'all',
  Photos: 'photo',
  Videos: 'video',
  Sound: 'audio',
  Polls: 'poll',
  Events: 'event',
};

// Viewability config: a post is "visible" when at least 40% of it is in the viewport
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 40,
  minimumViewTime: 150,
} as const;

// Sentinel IDs for the injected non-post rows
const HEADER_ID = '__header__';
const FILTERS_ID = '__filters__';
const LOADING_ID = '__loading__';
const EMPTY_ID = '__empty__';
const ERROR_ID = '__error__';
const FOOTER_ID = '__footer__';

type FeedRow =
  | { kind: 'header' }
  | { kind: 'filters' }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'post'; post: PostItem; index: number }
  | { kind: 'promoted' }
  | { kind: 'activity' }
  | { kind: 'suggested' }
  | { kind: 'games' }
  | { kind: 'footer' };

function rowKey(row: FeedRow): string {
  if (row.kind === 'post') return `post-${row.post.id}`;
  if (row.kind === 'error') return ERROR_ID;
  if (row.kind === 'loading') return LOADING_ID;
  if (row.kind === 'empty') return EMPTY_ID;
  if (row.kind === 'header') return HEADER_ID;
  if (row.kind === 'filters') return FILTERS_ID;
  if (row.kind === 'footer') return FOOTER_ID;
  return row.kind;
}

export default function MiddleSection({ userProfile, createdPost, onCreatePost }: MiddleSectionProps) {
  const { colors, isDark } = useAppTheme();
  const { state: drawerState } = useAppDrawer();
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('All');
  const [activeFeedSource, setActiveFeedSource] = useState<FeedSource>('home');
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const feedQuery = useMemo(() => ({
    userId: userProfile.uid,
    scope: activeFeedSource as FeedScope,
    filter: apiFilterByUiFilter[activeFilter],
  }), [activeFeedSource, activeFilter, userProfile.uid]);
  const { resource, refresh: refreshFeed, loadMore: loadMoreFeed, setScrollOffset } = useFeedQuery(feedQuery);
  const posts = resource.data?.posts ?? [];
  const displayedPosts = posts;
  const isLoading = !resource.data && (resource.status === 'idle' || resource.status === 'hydrating');
  const refreshing = resource.status === 'refreshing';
  const feedError = resource.error?.message ?? null;
  const nextCursor = resource.data?.nextCursor ?? null;
  const hasMore = resource.data?.hasMore === true;

  // Track which post IDs are currently visible in the viewport (for video play/pause)
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!createdPost) return;
    setActiveFilter('All');
    void feedResourceService.prependCreated({ userId: userProfile.uid, scope: 'home', filter: 'all' }, createdPost);
    if (createdPost.communityId) void feedResourceService.prependCreated({ userId: userProfile.uid, scope: 'communities', filter: 'all' }, createdPost);
  }, [createdPost, userProfile.uid]);

  const activePost = activePostId ? posts.find((post) => post.id === activePostId) ?? null : null;

  const handleRefresh = useCallback(async () => {
    if (isPullRefreshing) return;
    setIsPullRefreshing(true);
    try {
      await refreshFeed();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [isPullRefreshing, refreshFeed]);

  const handleFilterChange = useCallback((filter: FeedFilter) => {
    setActiveFilter(filter);
    setVisiblePostIds(new Set());
  }, []);

  const handleFeedSourceChange = useCallback((source: FeedSource) => {
    setVisiblePostIds(new Set());
    setActiveFeedSource(source);
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore || refreshing || isLoading) return;
    setLoadingMore(true);
    try {
      await loadMoreFeed();
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, isLoading, loadMoreFeed, loadingMore, nextCursor, refreshing]);

  const handleCommentClick = (postId: string) => setActivePostId(postId);
  const handlePostDelete = (postId: string) => {
    void feedResourceService.removePosts((post) => post.id === postId);
  };
  const handleAuthorBlocked = (userId: string) => {
    void feedResourceService.removePosts((post) => post.userId === userId);
  };
  const handlePostUpdate = (updatedPost: PostItem) => {
    void feedResourceService.patchPost(updatedPost);
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const ids = new Set<string>();
      for (const token of viewableItems) {
        const row = token.item as FeedRow;
        if (row.kind === 'post') ids.add(row.post.id);
      }
      setVisiblePostIds(ids);
    },
  ).current;

  const suggestedIndexRef = useRef<number>(5);
  useEffect(() => {
    if (posts.length >= 5) {
      const maxIdx = Math.max(5, Math.min(12, posts.length - 1));
      suggestedIndexRef.current = Math.floor(Math.random() * (maxIdx - 5 + 1)) + 5;
    }
  }, [posts.length]);

  const rows: FeedRow[] = [
    { kind: 'header' },
    { kind: 'filters' },
    ...(isLoading
      ? [{ kind: 'loading' as const }]
      : feedError
      ? [{ kind: 'error' as const, message: feedError }]
      : displayedPosts.length === 0
      ? [{ kind: 'empty' as const }]
      : displayedPosts.flatMap<FeedRow>((post, index) => {
          const rows: FeedRow[] = [{ kind: 'post', post, index }];
          if (index === 1) rows.push({ kind: 'promoted' });
          if (index === 2) rows.push({ kind: 'activity' });
          if (index === suggestedIndexRef.current) rows.push({ kind: 'suggested' });
          return rows;
        })),
    { kind: 'footer' },
  ];

  const renderRow = useCallback(
    ({ item: row }: ListRenderItemInfo<FeedRow>) => {
      switch (row.kind) {
        case 'header':
          return (
            <View style={{
              marginHorizontal: 16,
              marginBottom: 16,
              padding: 18,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 3,
            }}>
              <CreatePostSection
                onCreatePost={onCreatePost}
                profileImageUrl={userProfile.profilePicture}
                userInitial={userProfile.firstName}
              />
            </View>
          );

        case 'filters':
          return (
            <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
              <FeedsFilterSection
                activeFilter={activeFilter}
                onFilterChange={handleFilterChange}
                activeFeedSource={activeFeedSource}
                onFeedSourceChange={handleFeedSourceChange}
              />
            </View>
          );

        case 'loading':
          return (
            <View style={{ width: '100%' }}>
              <SkeletonPostCard />
              <SkeletonPostCard />
            </View>
          );

        case 'error':
          return (
            <View style={{
              minHeight: 340,
              marginHorizontal: 16,
              paddingHorizontal: 26,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: isDark ? '#7f1d1d' : '#fecaca',
              backgroundColor: isDark ? '#450a0a' : '#fff7f7',
            }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? '#7f1d1d' : '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon name="alert-triangle" size={30} color="#c64d53" />
              </View>
              <Text style={{ color: isDark ? '#fca5a5' : '#991b1b', fontSize: 20, fontWeight: '700', textAlign: 'center' }}>Could not load your feed</Text>
              <Text style={{ marginTop: 9, color: isDark ? '#fecaca' : '#7f1d1d', fontSize: 13, textAlign: 'center' }}>{row.message}</Text>
              <Text style={{ marginTop: 8, color: colors.mutedText, fontSize: 12, textAlign: 'center' }}>
                Check Metro for logs beginning with [Ourlime.Mobile][PostService].
              </Text>
              <TouchableOpacity
                onPress={() => { void refreshFeed(); }}
                style={{ marginTop: 18, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 18, backgroundColor: '#10b981' }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          );

        case 'empty':
          return (
            <View style={{ minHeight: 360, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={require('@/assets/images/stickers/greetings/Hello.png')}
                style={{ width: 140, height: 140, marginBottom: 14 }}
                resizeMode="contain"
                accessibilityLabel="Friendly Welcome"
              />
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
                {activeFilter === 'All' ? 'Your feed is quiet!' : `No ${activeFilter.toLowerCase()} posts yet`}
              </Text>
              <Text style={{ marginTop: 8, color: colors.mutedText, fontSize: 15, textAlign: 'center', maxWidth: 280, lineHeight: 22 }}>
                {activeFilter === 'All'
                  ? 'Say hello or share what is on your mind to get the lime started.'
                  : 'Try selecting another filter or pulling down to refresh.'}
              </Text>
              {activeFilter === 'All' ? (
                <TouchableOpacity
                  onPress={onCreatePost}
                  activeOpacity={0.8}
                  style={{
                    marginTop: 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 22,
                    paddingVertical: 12,
                    borderRadius: 999,
                    backgroundColor: '#10b981',
                    shadowColor: '#10b981',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Icon name="edit-3" size={16} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>Create a Post</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );

        case 'post':
          return (
            <View style={{ width: '100%', marginBottom: 12 }}>
              {row.post.type === 'poll' ? (
                <PollCardSection
                  post={row.post}
                  isVisible={visiblePostIds.has(row.post.id)}
                  onCommentClick={handleCommentClick}
                  onPostDelete={handlePostDelete}
                  onAuthorBlocked={handleAuthorBlocked}
                  onPostUpdate={handlePostUpdate}
                />
              ) : (
                <PostCardSection
                  post={row.post}
                  isVisible={visiblePostIds.has(row.post.id)}
                  onCommentClick={handleCommentClick}
                  onPostDelete={handlePostDelete}
                  onAuthorBlocked={handleAuthorBlocked}
                  onPostUpdate={handlePostUpdate}
                />
              )}
            </View>
          );

        case 'promoted':
          return null;

        case 'activity':
          return <View style={{ marginHorizontal: 16 }}><ActivityCard userId={userProfile.uid} /></View>;

        case 'suggested':
          return <View style={{ marginHorizontal: 16 }}><SuggestedUsersSection /></View>;

        case 'games':
          return null;

        case 'footer':
          return loadingMore ? (
            <ActivityIndicator color="#10b981" style={{ marginVertical: 18 }} />
          ) : !hasMore && posts.length > 0 ? (
            <Text style={{ marginVertical: 22, color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>
              That&apos;s a wrap — no more posts.
            </Text>
          ) : null;

        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeFilter,
      activeFeedSource,
      visiblePostIds,
      isLoading,
      feedError,
      loadingMore,
      hasMore,
      posts.length,
      userProfile,
      onCreatePost,
    ],
  );

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={rowKey}
        renderItem={renderRow}
        scrollEnabled={drawerState === 'closed'}
        style={{ flex: 1, backgroundColor: colors.canvas }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onEndReached={() => void handleLoadMore()}
        onEndReachedThreshold={0.4}
        onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={250}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={() => { void handleRefresh(); }}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={11}
        initialNumToRender={5}
      />

      {activePost ? (
        <CommentsModal
          post={activePost}
          userId={userProfile.uid}
          onClose={() => setActivePostId(null)}
          onPostUpdate={handlePostUpdate}
        />
      ) : null}
    </>
  );
}
