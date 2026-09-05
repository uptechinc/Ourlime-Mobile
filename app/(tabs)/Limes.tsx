import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
  ScrollView,
  Modal,
  RefreshControl,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/Feather';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  Volume2,
  VolumeX,
  Play,
  Plus,
  Compass,
  MoreVertical,
  Maximize2,
  ChevronLeft,
  X,
} from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter, useLocalSearchParams, useIsFocused } from 'expo-router';
import { usePlaybackInteraction } from '@/lib/hooks/usePlaybackInteraction';
import { PlaybackSeekBar } from '@/components/media/PlaybackSeekBar';
import { PlaybackSpeedMenu } from '@/components/media/PlaybackSpeedMenu';
import type { PlaybackSpeed } from '@/lib/services/PlaybackInteractionService';
import CreateLimeModal from '@/components/limes/CreateLimeModal';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import ReportLimeModal from '@/components/limes/ReportLimeModal';
import LimeCategorySheet from '@/components/limes/LimeCategorySheet';
import LimeOptionsSheet from '@/components/limes/LimeOptionsSheet';
import ShareContentSheet from '@/components/sharing/ShareContentSheet';
import CustomModal from '@/components/ui/CustomModal';
import type { Reel } from '@/types/userTypes';
import type { PostItem } from '@/lib/services/PostService';
import { limeService } from '@/lib/services/LimeService';
import { AuthService } from '@/lib/services/AuthService';
import { deepLinkService } from '@/lib/services/DeepLinkService';
import { limeThumbnailService } from '@/lib/services/LimeThumbnailService';
import { LimeResourceService } from '@/lib/services/LimeResourceService';
import { useLimeFeedResource } from '@/lib/hooks/useLimeFeedResource';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { PlayfulFloatingHeart, type PlayfulFloatingHeartRef } from '@/components/ui/PlayfulFloatingHeart';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const authService = AuthService.getInstance();
const limeResourceService = LimeResourceService.getInstance();

type ReportTarget = {
  reelId: string;
  reportedUserId: string;
  reportType: 'lime' | 'user';
};

type LimeReposter = NonNullable<Reel['repostedBy']>[number];

export function reelToPostItem(reel: Reel): PostItem {
  const createdAtMs = reel.createdAt instanceof Date
    ? reel.createdAt.getTime()
    : typeof reel.createdAt === 'number'
    ? reel.createdAt
    : Date.now();

  return {
    id: reel.id,
    origin: 'home',
    userId: reel.userId,
    user: {
      id: reel.userId,
      firstName: reel.user?.firstName || 'Lime',
      lastName: reel.user?.lastName || 'Creator',
      userName: reel.user?.userName || 'user',
      profileImage: reel.user?.profileImage,
    },
    type: 'regular',
    caption: reel.caption || '',
    description: '',
    visibility: reel.visibility === 'private' || reel.visibility === 'friends' ? reel.visibility : 'public',
    hashtags: [],
    media: [
      {
        id: reel.id,
        type: 'video',
        typeUrl: reel.media.typeUrl,
        fileName: reel.media.fileName,
      },
    ],
    stats: {
      likes: reel.stats?.likes ?? (Array.isArray(reel.likes) ? reel.likes.length : 0),
      comments: reel.stats?.comments ?? 0,
      shares: reel.stats?.shares ?? 0,
    },
    likedUserIds: Array.isArray(reel.likes) ? reel.likes : [],
    mentions: (reel.caption?.match(/@[\w.-]+/g)?.map((m) => m.slice(1)) ?? []),
    friendReferences: [],
    createdAt: new Date(createdAtMs).toISOString(),
  };
}

type FloatingReposterBubbleProps = {
  reposter: LimeReposter;
  reposterIndex: number;
  visibleReposterCount: number;
  showBadge?: boolean;
};

function FloatingReposterBubble({
  reposter,
  reposterIndex,
  visibleReposterCount,
  showBadge = false,
}: FloatingReposterBubbleProps) {
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const baseTranslateY = reposterIndex === 1 ? -6 : reposterIndex === 2 ? 3 : 0;

  useEffect(() => {
    if (reduceMotion) return;
    const direction = reposterIndex % 2 === 0 ? 1 : -1;
    const delayMs = reposterIndex * 180;
    const horizontalRadius = (4 + reposterIndex) * direction;
    const verticalRadius = 5 + reposterIndex;
    const easing = Easing.inOut(Easing.ease);

    translateX.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(horizontalRadius, { duration: 1_350 + reposterIndex * 120, easing }),
          withTiming(-horizontalRadius * 0.7, { duration: 1_550 + reposterIndex * 100, easing }),
          withTiming(0, { duration: 1_100, easing })
        ),
        -1,
        false
      )
    );
    translateY.value = withDelay(
      delayMs + 90,
      withRepeat(
        withSequence(
          withTiming(-verticalRadius, { duration: 1_200 + reposterIndex * 140, easing }),
          withTiming(verticalRadius * 0.65, { duration: 1_450 + reposterIndex * 110, easing }),
          withTiming(0, { duration: 1_050, easing })
        ),
        -1,
        false
      )
    );
    scale.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1.035, { duration: 1_300, easing }),
          withTiming(0.985, { duration: 1_500, easing }),
          withTiming(1, { duration: 1_050, easing })
        ),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(scale);
    };
  }, [reduceMotion, reposterIndex, scale, translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: baseTranslateY + translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.reposterBubbleShell,
        {
          marginLeft: reposterIndex === 0 ? 0 : -12,
          zIndex: visibleReposterCount - reposterIndex,
        },
        animatedStyle,
      ]}
    >
      <Image
        source={{ uri: reposter.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(reposter.firstName || 'L')}&background=10b981&color=fff` }}
        style={styles.reposterBubbleAvatar}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      {showBadge ? (
        <View style={styles.reposterRepeatBadge} pointerEvents="none">
          <Repeat2 size={10} color="#ffffff" />
        </View>
      ) : null}
    </Animated.View>
  );
}

export default function LimesScreen() {
  const [viewportHeight, setViewportHeight] = useState(SCREEN_HEIGHT);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [seeking, setSeeking] = useState(false);
  const router = useRouter();
  const { limeId, viewer } = useLocalSearchParams<{ limeId?: string; viewer?: string }>();
  const isScreenFocused = useIsFocused();
  const isSharedViewer = viewer === '1';

  const [feedTab, setFeedTab] = useState<'forYou' | 'following'>('forYou');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [commentReelId, setCommentReelId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [preloadAdjacentVideos, setPreloadAdjacentVideos] = useState(true);
  const limesListRef = useRef<FlatList<Reel>>(null);

  const currentUserId = authService.getCurrentUser()?.uid || '';
  const { query, resource, refresh, loadMore } = useLimeFeedResource({
    userId: currentUserId,
    category: activeCategory ?? undefined,
    scope: feedTab,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh(true);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  const resourceData = resource?.data;
  const limesList = resourceData?.reels ?? [];
  const followingUserIds = useMemo(
    () => new Set(resourceData?.followingUserIds ?? []),
    [resourceData?.followingUserIds],
  );
  const friendUserIds = useMemo(
    () => new Set(resourceData?.friendUserIds ?? []),
    [resourceData?.friendUserIds],
  );
  const userRepostedReelIds = useMemo(
    () => new Set(resourceData?.userRepostedReelIds ?? []),
    [resourceData?.userRepostedReelIds],
  );
  const loading = Boolean(currentUserId) && !resourceData && resource?.status !== 'error';
  const isLoadingMore = resourceData?.isLoadingMore ?? false;
  const playbackAllowed = isScreenFocused
    && appState === 'active'
    && !isCreateModalOpen
    && !commentReelId
    && !reportTarget
    && !categorySheetVisible;

  useEffect(() => {
    const stateSubscription = AppState.addEventListener('change', setAppState);
    const memorySubscription = AppState.addEventListener('memoryWarning', () => {
      setPreloadAdjacentVideos(false);
    });
    return () => {
      stateSubscription.remove();
      memorySubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId || !limeId) return;
    void limeResourceService.ensureLime(query, limeId).then(() => setActiveIndex(0));
  }, [currentUserId, limeId, query]);

  const resetPager = useCallback(() => {
    setActiveIndex(0);
    requestAnimationFrame(() => {
      limesListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, []);

  const handleFeedTabChange = useCallback((tab: 'forYou' | 'following') => {
    setFeedTab(tab);
    setActiveCategory(null);
    resetPager();
  }, [resetPager]);

  const handleSelectCategory = useCallback((category: string) => {
    setCategorySheetVisible(false);
    setActiveCategory(category);
    setFeedTab('forYou');
    resetPager();
  }, [resetPager]);

  const handleClearCategory = useCallback(() => {
    setCategorySheetVisible(false);
    setActiveCategory(null);
    setFeedTab('forYou');
    resetPager();
  }, [resetPager]);

  const handleFollowToggle = useCallback(async (targetUserId: string, currentlyFollowing: boolean) => {
    if (!currentUserId) return;
    void limeResourceService.patchFollowing(query, targetUserId, !currentlyFollowing);
    try {
      if (currentlyFollowing) {
        await limeService.unfollowUser(currentUserId, targetUserId);
      } else {
        await limeService.followUser(currentUserId, targetUserId);
      }
    } catch {
      void limeResourceService.patchFollowing(query, targetUserId, currentlyFollowing);
    }
  }, [currentUserId, query]);

  const handleDeleteLime = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await limeService.deleteLime(deleteTarget.id);
      await limeResourceService.removeReel(query, deleteTarget.id);
      setDeleteTarget(null);
      resetPager();
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete this Lime.');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleting, query, resetPager]);

  const displayedLimes = limesList.filter((reel) => {
    if (reel.isDeleted === true || reel.status === 'deleted') return false;
    const reposterIds = (reel.repostedBy ?? []).map((reposter) => reposter.userId);
    const isOwner = Boolean(currentUserId && (currentUserId === reel.userId || reposterIds.includes(currentUserId)));
    if (reel.visibility === 'private' || reel.visibility === 'only_me') {
      if (!isOwner) return false;
    }
    if (reel.visibility === 'friends') {
      if (!isOwner && !friendUserIds.has(reel.userId) && !reposterIds.some((reposterId) => friendUserIds.has(reposterId))) return false;
    }
    return true;
  });
  const isRefreshingEmptyFeed = displayedLimes.length === 0
    && (resource?.status === 'hydrating' || resource?.status === 'refreshing');

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    } else setActiveIndex(-1);
  }).current;

  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 70 }).current;

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const emptyFeed = (
    <View style={[styles.loadingScreen, styles.emptyFeed]}>
      {isRefreshingEmptyFeed ? <ActivityIndicator size="large" color="#10b981" /> : null}
      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800', marginTop: 12 }}>
        {resource?.status === 'error'
          ? 'Couldn’t load Limes'
          : isRefreshingEmptyFeed
            ? feedTab === 'following' ? 'Loading Following…' : 'Refreshing Limes…'
            : 'No Limes yet'}
      </Text>
      <Text style={{ color: '#64748b', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
        {resource?.status === 'error'
          ? 'Check your connection and try again.'
          : isRefreshingEmptyFeed
            ? 'Preparing the latest videos for this feed.'
          : activeCategory
            ? `No ${activeCategory} Limes yet.`
            : feedTab === 'following'
              ? 'Follow creators to see their Limes here.'
              : 'Be the first to post a Lime!'}
      </Text>
      {resource?.status === 'error' ? (
        <TouchableOpacity
          onPress={() => void refresh(true)}
          style={{ marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#10b981' }}
        >
          <Text style={{ color: '#10b981', fontWeight: '700' }}>Try Again</Text>
        </TouchableOpacity>
      ) : null}
      {!isRefreshingEmptyFeed && (activeCategory || feedTab === 'following') ? (
        <TouchableOpacity
          onPress={activeCategory ? handleClearCategory : () => handleFeedTabChange('forYou')}
          style={{ marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#10b981' }}
        >
          <Text style={{ color: '#10b981', fontWeight: '700' }}>Back to For You</Text>
        </TouchableOpacity>
      ) : null}
      {!isRefreshingEmptyFeed ? (
        <TouchableOpacity
          onPress={() => setIsCreateModalOpen(true)}
          style={{ marginTop: 16, backgroundColor: '#10b981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Create a Lime</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container} onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Top Header Overlay */}
      <SafeAreaView style={styles.topHeader} edges={['top', 'left', 'right']}>
        {isSharedViewer ? (
          <>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to chat"
              style={styles.viewerBackButton}
            >
              <ChevronLeft size={25} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.viewerTitleContainer}>
              <Text style={styles.viewerTitle}>Limes</Text>
              <Text style={styles.viewerSubtitle}>Swipe for more</Text>
            </View>
            <View style={styles.viewerHeaderSpacer} />
          </>
        ) : (
          <>
        <View style={styles.tabToggleRow}>
          <TouchableOpacity
            onPress={() => handleFeedTabChange('forYou')}
            style={styles.tabBtn}
            hitSlop={8}
            activeOpacity={0.65}
            accessibilityRole="tab"
            accessibilityState={{ selected: feedTab === 'forYou' && !activeCategory }}
          >
            <Text style={[styles.tabText, feedTab === 'forYou' && !activeCategory && styles.activeTabText]}>
              For You
            </Text>
            {feedTab === 'forYou' && !activeCategory && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          <View style={styles.tabDivider} />

          <TouchableOpacity
            onPress={() => handleFeedTabChange('following')}
            style={styles.tabBtn}
            hitSlop={8}
            activeOpacity={0.65}
            accessibilityRole="tab"
            accessibilityState={{ selected: feedTab === 'following' }}
          >
            <Text style={[styles.tabText, feedTab === 'following' && styles.activeTabText]}>
              Following
            </Text>
            {feedTab === 'following' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          {activeCategory ? (
            <>
              <View style={styles.tabDivider} />
              <TouchableOpacity
                onPress={handleClearCategory}
                style={[styles.tabBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
              >
                <Text style={[styles.tabText, styles.activeTabText]}>{activeCategory}</Text>
                <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '800', marginTop: -2 }}>×</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setCategorySheetVisible(true)}
            style={[
              styles.iconHeaderBtn,
              categorySheetVisible && { backgroundColor: 'rgba(16,185,129,0.2)', borderColor: '#10b981' },
            ]}
            activeOpacity={0.7}
          >
            <Compass size={18} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsCreateModalOpen(true)}
            style={styles.createButton}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
          </>
        )}
      </SafeAreaView>

      <LimeCategorySheet
        visible={categorySheetVisible}
        selectedCategory={activeCategory}
        onSelect={handleSelectCategory}
        onClear={handleClearCategory}
        onClose={() => setCategorySheetVisible(false)}
      />

      {/* Vertical Reel Pager */}
      <FlatList
        key={`${feedTab}:${activeCategory ?? 'all'}`}
        ref={limesListRef}
        data={displayedLimes}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={viewportHeight}
        scrollEnabled={!seeking}
        snapToAlignment="start"
        decelerationRate="fast"
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={Platform.OS === 'android'}
        getItemLayout={(_, index) => ({
          length: viewportHeight,
          offset: viewportHeight * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfigRef}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={emptyFeed}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadMoreFooter}>
              <ActivityIndicator size="large" color="#10b981" />
              <Text style={{ color: '#64748b', marginTop: 12, fontSize: 13 }}>Loading more…</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <ReelItem
            height={viewportHeight}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            onSeekingChange={setSeeking}
            reel={item}
            isActive={playbackAllowed && index === activeIndex}
            shouldLoadVideo={playbackAllowed && (
              index === activeIndex
              || (preloadAdjacentVideos && Math.abs(index - activeIndex) <= 1)
            )}
            muted={muted}
            isRepostedInitial={
              userRepostedReelIds.has(item.id) ||
              item.repostedByViewer === true ||
              (Boolean(item.isRepost) && item.userId === currentUserId)
            }
            isFollowing={
              item.userId !== currentUserId && followingUserIds.has(item.userId)
            }
            isOwnReel={item.userId === currentUserId}
            onToggleMute={() => setMuted((prev) => !prev)}
            onCommentPress={() => setCommentReelId(item.id)}
            currentUserId={currentUserId}
            onLikeUpdate={(reelId, liked) => {
              void limeResourceService.patchReel(query, reelId, (reel) => ({
                ...reel,
                likes: liked
                  ? Array.from(new Set([...(reel.likes || []), currentUserId]))
                  : (reel.likes || []).filter((userId) => userId !== currentUserId),
                stats: {
                  likes: liked
                    ? (reel.stats?.likes ?? 0) + 1
                    : Math.max(0, (reel.stats?.likes ?? 0) - 1),
                  comments: reel.stats?.comments ?? 0,
                  shares: reel.stats?.shares ?? 0,
                  reposts: reel.stats?.reposts ?? 0,
                },
              }));
            }}
            onToggleRepost={(reelId, reposted) => {
              void limeResourceService.patchRepostMarker(query, reelId, reposted);
              void limeResourceService.patchReel(query, reelId, (reel) => ({
                ...reel,
                stats: {
                  likes: reel.stats?.likes ?? 0,
                  comments: reel.stats?.comments ?? 0,
                  shares: reel.stats?.shares ?? 0,
                  reposts: reposted
                    ? (reel.stats?.reposts ?? 0) + 1
                    : Math.max(0, (reel.stats?.reposts ?? 0) - 1),
                },
              }));
            }}
            onFollowToggle={handleFollowToggle}
            onProfilePress={(userName) => {
              router.push({ pathname: '/profile/[username]', params: { username: userName } });
            }}
            onReport={(reelId, reportedUserId, reportType) =>
              setReportTarget({ reelId, reportedUserId, reportType })
            }
            onDeleteRequest={(reel) => {
              setDeleteError(null);
              setDeleteTarget(reel);
            }}
            onDeleted={(deletedReelId) => {
              void limeResourceService.removeReel(query, deletedReelId);
              resetPager();
            }}
          />
        )}
      />

      {/* Create Lime Modal */}
      {isCreateModalOpen ? (
        <CreateLimeModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            void refresh(true);
          }}
        />
      ) : null}

      {/* Comments Modal */}
      {commentReelId ? (() => {
        const targetReel = displayedLimes.find((r) => r.id === commentReelId) || limesList.find((r) => r.id === commentReelId);
        if (!targetReel) return null;
        return (
          <CommentsModal
            post={reelToPostItem(targetReel)}
            userId={currentUserId}
            onClose={() => setCommentReelId(null)}
            onPostUpdate={(updatedPost) => {
              void limeResourceService.patchReel(query, commentReelId, (reel) => ({
                ...reel,
                stats: {
                  likes: reel.stats?.likes ?? 0,
                  comments: updatedPost.stats?.comments ?? reel.stats?.comments ?? 0,
                  shares: reel.stats?.shares ?? 0,
                  reposts: reel.stats?.reposts ?? 0,
                },
              }));
            }}
          />
        );
      })() : null}

      {/* Report Modal */}
      {reportTarget ? (
        <ReportLimeModal
          visible={Boolean(reportTarget)}
          reelId={reportTarget.reelId}
          reportedUserId={reportTarget.reportedUserId}
          reportType={reportTarget.reportType}
          onClose={() => setReportTarget(null)}
        />
      ) : null}

      <CustomModal
        visible={Boolean(deleteTarget)}
        type="danger"
        title="Delete this Lime?"
        message={deleteError || 'This permanently removes the Lime and its repost markers. This cannot be undone.'}
        confirmText="Delete Lime"
        cancelText="Keep Lime"
        isLoading={deleting}
        onConfirm={() => void handleDeleteLime()}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Video Player — isolated & rock solid like Feed Post videos          */
/* ─────────────────────────────────────────────────────────────────── */
type ReelVideoPlayerHandle = {
  enterFullscreen: () => Promise<void>;
  beginHold: () => void;
  endHold: () => void;
};

type ReelVideoPlayerProps = {
  url: string;
  isActive: boolean;
  muted: boolean;
  paused: boolean;
  speed: PlaybackSpeed;
  onSeekingChange?: (seeking: boolean) => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
};

const ReelVideoPlayer = forwardRef<ReelVideoPlayerHandle, ReelVideoPlayerProps>(function ReelVideoPlayer(
  { url, isActive, muted, paused, speed, onSpeedChange, onSeekingChange },
  ref,
) {
  const safeUrl = url && url.length > 4 ? url : undefined;
  const videoViewRef = useRef<VideoView>(null);

  const player = useVideoPlayer(safeUrl ?? null, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  const { session, snapshot, refresh, isPlaybackActive } = usePlaybackInteraction(player, isActive, speed);

  useEffect(() => {
    try {
      player.muted = muted;
    } catch {
      // ignore
    }
  }, [player, muted]);

  useEffect(() => {
    try {
      if (isPlaybackActive && !paused && safeUrl) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // ignore
    }
  }, [player, isPlaybackActive, paused, safeUrl]);


  useImperativeHandle(ref, () => ({
    beginHold: () => { session.beginHold(); refresh(); },
    endHold: () => { session.endHold(); refresh(); },
    enterFullscreen: async () => {
      await videoViewRef.current?.enterFullscreen();
    },
  }), [session, refresh]);

  return (
    <>
    <View style={styles.videoPlayer}>
      {safeUrl ? (
        <VideoView
          ref={videoViewRef}
          player={player}
          style={{ width: '100%', height: '100%' }}
          nativeControls={false}
          contentFit="cover"
          fullscreenOptions={{ enable: true }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🎬</Text>
          <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>No video</Text>
        </View>
      )}
    </View>
    <PlaybackSeekBar session={session} snapshot={snapshot} onChange={refresh} onSeekingChange={onSeekingChange} />
    <PlaybackSpeedMenu speed={speed} onChange={onSpeedChange} />
    {snapshot.holding ? <View pointerEvents="none" style={{ position: 'absolute', top: 92, alignSelf: 'center', zIndex: 122, backgroundColor: '#000b', padding: 10, borderRadius: 18 }}><Text style={{ color: '#fff' }}>2× Speed</Text></View> : null}
    </>
  );
});

type LimeCaptionProps = {
  caption: string;
  onProfilePress: (userName: string) => void;
};

function LimeCaption({ caption, onProfilePress }: LimeCaptionProps) {
  const parts = caption.split(/(https?:\/\/[^\s]+|www\.[^\s]+|@[a-zA-Z0-9._]+)/g);
  return (
    <Text style={styles.caption} numberOfLines={2}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          return <Text key={`${part}-${index}`} style={styles.captionLink} onPress={() => onProfilePress(part.slice(1))}>{part}</Text>;
        }
        if (part.startsWith('http://') || part.startsWith('https://') || part.startsWith('www.')) {
          const url = part.startsWith('www.') ? `https://${part}` : part;
          return <Text key={`${part}-${index}`} style={styles.captionLink} onPress={() => void Linking.openURL(url)}>{part}</Text>;
        }
        return <Text key={`${part}-${index}`}>{part}</Text>;
      })}
    </Text>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ReelItem — core reel card with full feature set                     */
/* ─────────────────────────────────────────────────────────────────── */
export type ReelItemProps = {
  height?: number;
  playbackSpeed?: PlaybackSpeed;
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void;
  onSeekingChange?: (seeking: boolean) => void;
  reel: Reel;
  isActive: boolean;
  shouldLoadVideo: boolean;
  muted: boolean;
  currentUserId: string;
  isRepostedInitial: boolean;
  isFollowing: boolean;
  isOwnReel: boolean;
  onToggleMute: () => void;
  onCommentPress: () => void;
  onLikeUpdate: (reelId: string, liked: boolean) => void;
  onToggleRepost: (reelId: string, reposted: boolean) => void;
  onFollowToggle: (userId: string, currentlyFollowing: boolean) => void;
  onProfilePress: (userName: string) => void;
  onReport: (reelId: string, reportedUserId: string, reportType: 'lime' | 'user') => void;
  onDeleteRequest: (reel: Reel) => void;
  onDeleted?: (reelId: string) => void;
};

export function ReelItem({
  height = SCREEN_HEIGHT,
  playbackSpeed,
  onPlaybackSpeedChange,
  onSeekingChange,
  reel,
  isActive,
  shouldLoadVideo,
  muted,
  currentUserId,
  isRepostedInitial,
  isFollowing,
  isOwnReel,
  onToggleMute,
  onCommentPress,
  onLikeUpdate,
  onToggleRepost,
  onFollowToggle,
  onProfilePress,
  onReport,
  onDeleteRequest,
  onDeleted,
}: ReelItemProps) {
  const [paused, setPaused] = useState(false);
  const likedByMe = Array.isArray(reel.likes) && currentUserId ? reel.likes.includes(currentUserId) : false;
  const [isLiked, setIsLiked] = useState(likedByMe);
  const [likeCount, setLikeCount] = useState(reel.stats?.likes ?? 0);
  const [isReposted, setIsReposted] = useState(isRepostedInitial);
  const [repostCount, setRepostCount] = useState(reel.stats?.reposts ?? reel.repostedBy?.length ?? (reel.reposts?.length ?? 0));
  const [shareCount, setShareCount] = useState(reel.stats?.shares ?? 0);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [preparedThumbnailUrl, setPreparedThumbnailUrl] = useState(
    reel.thumbnailUrl || reel.media.thumbnailUrl || ''
  );
  const [localSpeed, setLocalSpeed] = useState<PlaybackSpeed>(1);
  const heldRef = useRef(false);
  const touchOrigin = useRef({ x: 0, y: 0 });
  const [showReposters, setShowReposters] = useState(false);
  const videoPlayerRef = useRef<ReelVideoPlayerHandle>(null);
  const viewerReposted = isReposted
    || reel.repostedByViewer === true
    || Boolean(currentUserId && reel.repostedBy?.some((reposter) => reposter.userId === currentUserId));
  const orderedReposters = useMemo(() => {
    const reposters = [...(reel.repostedBy ?? [])];
    if (!currentUserId) return reposters;
    return reposters.sort((firstReposter, secondReposter) => {
      if (firstReposter.userId === currentUserId) return -1;
      if (secondReposter.userId === currentUserId) return 1;
      return 0;
    });
  }, [currentUserId, reel.repostedBy]);
  const visibleReposters = orderedReposters.slice(0, 3);
  const hiddenReposterCount = Math.max(0, repostCount - visibleReposters.length);
  const reposterAccessibilityLabel = viewerReposted
    ? `You reposted this Lime.${repostCount > 1 ? ` ${repostCount - 1} other ${repostCount === 2 ? 'person' : 'people'} reposted it.` : ''}`
    : `${repostCount} ${repostCount === 1 ? 'person' : 'people'} reposted this Lime.`;

  useEffect(() => {
    setIsReposted(isRepostedInitial);
  }, [isRepostedInitial]);

  // Close options menu when reel is no longer active
  useEffect(() => {
    if (!isActive) {
      setShowOptionsMenu(false);
      setShowReposters(false);
    }
  }, [isActive]);

  const heartRef = useRef<PlayfulFloatingHeartRef>(null);

  const lastTapRef = useRef<number | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerLike = useCallback(() => {
    if (!isLiked) {
      setIsLiked(true);
      setLikeCount((c) => c + 1);
      onLikeUpdate(reel.id, true);
      if (currentUserId) {
        limeService.toggleLike(reel.id, currentUserId, true).catch(() => {});
      }
    }
    heartRef.current?.trigger();
  }, [isLiked, reel.id, currentUserId, onLikeUpdate]);

  const toggleLikeButton = useCallback(() => {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    onLikeUpdate(reel.id, nextLiked);
    if (currentUserId) {
      limeService.toggleLike(reel.id, currentUserId, nextLiked).catch(() => {});
    }
    if (nextLiked) heartRef.current?.trigger();
  }, [isLiked, reel.id, currentUserId, onLikeUpdate]);

  const toggleRepostButton = useCallback(async () => {
    if (!currentUserId) return;
    const nextReposted = !isReposted;
    setIsReposted(nextReposted);
    setRepostCount((c) => Math.max(0, c + (nextReposted ? 1 : -1)));
    onToggleRepost(reel.id, nextReposted);
    try {
      if (nextReposted) {
        await limeService.repostLime(reel.id, currentUserId);
      } else {
        await limeService.removeLimeRepost(reel.id, currentUserId);
      }
    } catch (err) {
      console.error('[Limes] Failed to toggle repost:', err);
      // Rollback
      setIsReposted(!nextReposted);
      setRepostCount((c) => Math.max(0, c + (!nextReposted ? 1 : -1)));
      onToggleRepost(reel.id, !nextReposted);
    }
  }, [isReposted, reel.id, currentUserId, onToggleRepost]);

  /* Tap handler: double tap likes & animates heart; single tap toggles pause */
  const handleDoubleTapZoneTap = useCallback(() => {
    if (showOptionsMenu) {
      setShowOptionsMenu(false);
      return;
    }
    const now = Date.now();
    if (lastTapRef.current !== null && now - lastTapRef.current < 320) {
      // Double tap detected
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapRef.current = null;
      triggerLike();
    } else {
      lastTapRef.current = now;
      // Single tap after delay → toggle pause
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        lastTapRef.current = null;
        setPaused((p) => !p);
      }, 330);
    }
  }, [triggerLike, showOptionsMenu]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, [isActive, reel.media.typeUrl]);

  const shareUrl = deepLinkService.getLimeShareUrl(reel.id);
  const shareTitle = reel.caption || `Lime by @${reel.user.userName}`;
  const shareMessage = `${reel.caption ? `"${reel.caption}"\n\n` : ''}Watch @${reel.user.userName}'s Lime on Ourlime:\n${shareUrl}`;

  const handleShared = useCallback(() => {
    setShareCount((count) => count + 1);
    void limeService.incrementShareCount(reel.id);
  }, [reel.id]);

  const handleOpenShare = useCallback(async () => {
    if (!preparedThumbnailUrl && currentUserId === reel.userId) {
      try {
        const thumbnailUrl = await limeThumbnailService.ensureOwnedLimeThumbnail({
          reelId: reel.id,
          ownerUserId: reel.userId,
          viewerUserId: currentUserId,
          videoUri: reel.media.typeUrl,
          durationSeconds: reel.media.duration,
        });
        if (thumbnailUrl) setPreparedThumbnailUrl(thumbnailUrl);
      } catch (error: unknown) {
        console.warn(
          '[Limes.handleOpenShare] Thumbnail preparation failed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
    setShareSheetVisible(true);
  }, [currentUserId, preparedThumbnailUrl, reel.id, reel.media.duration, reel.media.typeUrl, reel.userId]);

  const handleProfilePress = useCallback(() => {
    onProfilePress(reel.user.userName);
  }, [reel.user.userName, onProfilePress]);

  return (
    <View style={[styles.reelContainer, { height, width: '100%' }]}>
      {/* 1. Video player — bottom layer */}
      {shouldLoadVideo ? (
        <ReelVideoPlayer
          key={reel.media.typeUrl}
          ref={videoPlayerRef}
          url={reel.media.typeUrl}
          isActive={isActive && !shareSheetVisible && !showReposters && !showOptionsMenu}
          paused={paused}
          speed={playbackSpeed ?? localSpeed}
          onSpeedChange={onPlaybackSpeedChange ?? setLocalSpeed}
          onSeekingChange={(seeking) => {
            if (seeking) {
              if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
              lastTapRef.current = null;
            }
            onSeekingChange?.(seeking);
          }}
          muted={muted}
        />
      ) : (
        <View style={styles.videoPlayer} />
      )}

      {/* 2. Double-tap + single-tap zone — full screen, sits behind controls */}
      <Pressable
        style={styles.doubleTapZone}
        key={`tap-${reel.media.typeUrl}`}
        onPress={() => { if (!heldRef.current) handleDoubleTapZoneTap(); }}
        delayLongPress={300}
        onLongPress={() => { if (heldRef.current) return; heldRef.current = true; if (tapTimerRef.current) clearTimeout(tapTimerRef.current); videoPlayerRef.current?.beginHold(); }}
        onPressOut={() => videoPlayerRef.current?.endHold()}
        onTouchStart={(event) => {
          heldRef.current = false;
          touchOrigin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        }}
        onTouchMove={(event) => {
          if (Math.hypot(event.nativeEvent.pageX - touchOrigin.current.x, event.nativeEvent.pageY - touchOrigin.current.y) > 10) {
            heldRef.current = true;
            videoPlayerRef.current?.endHold();
          }
        }}
      />

      {/* 3. Pause indicator — overlay */}
      {paused ? (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <Play size={56} color="rgba(255,255,255,0.9)" />
        </View>
      ) : null}

      {/* 4. Animated Red Popped Heart on Double Tap */}
      <PlayfulFloatingHeart ref={heartRef} size={110} />

      {/* 5. Right Sidebar — highest z-index, fully interactive */}
      <View style={styles.rightSidebar} pointerEvents="box-none">
        <TouchableOpacity onPress={onToggleMute} style={styles.actionBtn} activeOpacity={0.7}>
          {muted ? <VolumeX size={26} color="#ffffff" /> : <Volume2 size={26} color="#ffffff" />}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => void videoPlayerRef.current?.enterFullscreen()}
          style={styles.actionBtn}
          accessibilityLabel="Watch Lime fullscreen"
          activeOpacity={0.7}
        >
          <Maximize2 size={24} color="#ffffff" />
        </TouchableOpacity>

        <AnimatedActionButton feedback="like" accessibilityLabel={isLiked ? 'Unlike Lime' : 'Like Lime'} onPress={toggleLikeButton} style={styles.actionBtn}>
          <Heart
            size={28}
            color={isLiked ? '#ef4444' : '#ffffff'}
            fill={isLiked ? '#ef4444' : 'none'}
          />
          <Text style={styles.actionCount}>{likeCount}</Text>
        </AnimatedActionButton>

        <AnimatedActionButton feedback="comment" accessibilityLabel="Open Lime comments" onPress={onCommentPress} style={styles.actionBtn}>
          <MessageCircle size={28} color="#ffffff" />
          <Text style={styles.actionCount}>{reel.stats?.comments ?? 0}</Text>
        </AnimatedActionButton>

        <AnimatedActionButton
          accessibilityLabel={isOwnReel ? 'You cannot repost your own Lime' : isReposted ? 'Remove Lime repost' : 'Repost Lime'}
          onPress={() => void toggleRepostButton()}
          disabled={isOwnReel}
          style={[styles.actionBtn, isOwnReel && { opacity: 0.45 }]}
        >
          <Repeat2
            size={27}
            color={isReposted ? '#10b981' : '#ffffff'}
          />
          <Text style={[styles.actionCount, isReposted && { color: '#10b981' }]}>{repostCount}</Text>
        </AnimatedActionButton>

        <AnimatedActionButton feedback="share" accessibilityLabel="Share Lime" onPress={() => void handleOpenShare()} style={styles.actionBtn}>
          <Send size={26} color="#ffffff" />
          <Text style={styles.actionCount}>{shareCount}</Text>
        </AnimatedActionButton>

        <TouchableOpacity
          onPress={() => setShowOptionsMenu((prev) => !prev)}
          style={styles.actionBtn}
          activeOpacity={0.7}
        >
          <MoreVertical size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Options Slide-Up Sheet */}
      <LimeOptionsSheet
        visible={showOptionsMenu}
        reel={reel}
        currentUserId={currentUserId}
        isFollowing={isFollowing}
        onClose={() => setShowOptionsMenu(false)}
        onDeleteRequest={onDeleteRequest}
        onDeleted={(deletedReelId) => {
          setShowOptionsMenu(false);
          if (onDeleted) {
            onDeleted(deletedReelId);
          }
        }}
        onFollowToggle={onFollowToggle}
        onReport={onReport}
      />

      {/* 6. Bottom overlay (creator info + caption) */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">
        {repostCount > 0 ? (
          <TouchableOpacity
            onPress={() => {
              if (orderedReposters.length > 0) setShowReposters(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={reposterAccessibilityLabel}
            activeOpacity={0.82}
            style={styles.reposterBubbleAnchor}
          >
            <View style={styles.reposterBubbleCluster}>
              {visibleReposters.map((reposter, reposterIndex) => (
                <FloatingReposterBubble
                  key={reposter.userId}
                  reposter={reposter}
                  reposterIndex={reposterIndex}
                  visibleReposterCount={visibleReposters.length}
                  showBadge={reposterIndex === 0}
                />
              ))}
              {visibleReposters.length === 0 ? (
                <View style={[styles.reposterBubbleShell, styles.reposterCountBubble]}>
                  <Repeat2 size={17} color="#ffffff" />
                  <Text style={styles.reposterCountText}>{repostCount}</Text>
                </View>
              ) : null}
              {hiddenReposterCount > 0 ? (
                <View style={[styles.reposterBubbleShell, styles.reposterCountBubble, { marginLeft: -10, zIndex: 0 }]}>
                  <Text style={styles.reposterCountText}>+{hiddenReposterCount}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.creatorRow} pointerEvents="box-none">
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
            <Image
              source={{
                uri:
                  reel.user.profileImage ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.user.firstName || 'L')}&background=10b981&color=fff`,
              }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={handleProfilePress} activeOpacity={0.8}>
            <Text style={styles.creatorName}>
              {reel.user.firstName} {reel.user.lastName}
            </Text>
            <Text style={styles.handle}>@{reel.user.userName}</Text>
          </TouchableOpacity>
          {!isOwnReel ? (
            <TouchableOpacity
              onPress={() => onFollowToggle(reel.userId, isFollowing)}
              style={[styles.followBtn, isFollowing && styles.followingBtn]}
              activeOpacity={0.8}
            >
              <Text style={[styles.followText, isFollowing && styles.followingText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {reel.caption ? <LimeCaption caption={reel.caption} onProfilePress={onProfilePress} /> : null}

        <View style={styles.soundRow}>
          <Icon name="music" size={14} color="#10b981" />
          <Text style={styles.soundText}>Original Sound – @{reel.user.userName}</Text>
        </View>
      </View>


      <ShareContentSheet
        visible={shareSheetVisible}
        currentUserId={currentUserId}
        contentLabel="Lime"
        title={shareTitle}
        message={shareMessage}
        url={shareUrl}
        onClose={() => setShareSheetVisible(false)}
        onShared={handleShared}
      />

      <Modal
        visible={showReposters}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowReposters(false)}
      >
        <Pressable style={styles.reposterSheetBackdrop} onPress={() => setShowReposters(false)} />
        <SwipeDismissSurface
          visible={showReposters}
          onDismiss={() => setShowReposters(false)}
          handleColor="#64748b"
          accessibilityLabel="Swipe down to close Lime reposters"
          style={styles.reposterSheet}
        >
          <View style={styles.reposterSheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reposterSheetTitle}>Reposted by</Text>
              <Text style={styles.reposterSheetSubtitle}>{repostCount} {repostCount === 1 ? 'person' : 'people'} shared this Lime with their audience.</Text>
            </View>
            <TouchableOpacity onPress={() => setShowReposters(false)} accessibilityLabel="Close Lime reposters" style={styles.reposterSheetClose}>
              <X size={20} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.reposterSheetList} contentContainerStyle={{ paddingBottom: 24 }} nestedScrollEnabled>
            {orderedReposters.map((reposter) => (
              <TouchableOpacity
                key={reposter.userId}
                onPress={() => {
                  setShowReposters(false);
                  onProfilePress(reposter.userName);
                }}
                style={styles.reposterSheetRow}
              >
                <Image
                  source={{ uri: reposter.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(reposter.firstName || 'L')}&background=10b981&color=fff` }}
                  style={styles.reposterSheetAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.reposterSheetName} numberOfLines={1}>
                    {reposter.userId === currentUserId ? 'You' : `${reposter.firstName} ${reposter.lastName}`.trim()}
                  </Text>
                  <Text style={styles.reposterSheetHandle} numberOfLines={1}>@{reposter.userName}</Text>
                </View>
                <Text style={styles.reposterSheetProfileAction}>View profile</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SwipeDismissSurface>
      </Modal>
    </View>
  );
}

export const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  emptyFeed: {
    height: SCREEN_HEIGHT,
    paddingHorizontal: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  viewerBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  viewerTitleContainer: {
    alignItems: 'center',
  },
  viewerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  viewerSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  viewerHeaderSpacer: {
    width: 42,
    height: 42,
  },
  tabToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tabBtn: {
    paddingVertical: 4,
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  activeTabIndicator: {
    height: 3,
    backgroundColor: '#10b981',
    borderRadius: 2,
    marginTop: 4,
  },
  tabDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  iconHeaderBtn: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#10b981',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  loadMoreFooter: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
    backgroundColor: '#000000',
  },
  videoPlayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  /* Transparent double-tap zone: full screen behind sidebar controls */
  doubleTapZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 11,
  },
  heartPop: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    zIndex: 99,
  },
  rightSidebar: {
    position: 'absolute',
    right: 16,
    bottom: 110,
    alignItems: 'center',
    gap: 22,
    zIndex: 99,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.95,
    shadowRadius: 6,
    elevation: 12,
    padding: 4,
  },
  actionCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 54,
    right: 80,
    zIndex: 20,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  creatorName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  handle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#10b981',
  },
  followingBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  followText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  followingText: {
    color: '#ffffff',
  },
  caption: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captionLink: { color: '#6ee7b7', fontWeight: '800' },
  videoProgressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.24)', zIndex: 110 },
  videoProgressFill: { height: '100%', backgroundColor: '#10b981' },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  soundText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reposterBubbleAnchor: { position: 'absolute', left: 0, bottom: '100%', marginBottom: 12, zIndex: 40 },
  reposterBubbleCluster: { minWidth: 48, minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingRight: 5 },
  reposterBubbleShell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 0,
    padding: 0,
    backgroundColor: 'rgba(2,6,23,0.72)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 12,
  },
  reposterBubbleAvatar: { width: '100%', height: '100%', borderRadius: 21 },
  reposterCountBubble: { alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(255,255,255,0.8)', flexDirection: 'row', gap: 2 },
  reposterCountText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  reposterRepeatBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  reposterSheetBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.58)' },
  reposterSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  reposterSheetHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 14 },
  reposterSheetTitle: { color: '#ffffff', fontSize: 21, fontWeight: '900' },
  reposterSheetSubtitle: { color: '#94a3b8', fontSize: 12, lineHeight: 17, marginTop: 3 },
  reposterSheetClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  reposterSheetList: { flexGrow: 0 },
  reposterSheetRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  reposterSheetAvatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12 },
  reposterSheetName: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  reposterSheetHandle: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  reposterSheetProfileAction: { color: '#34d399', fontSize: 12, fontWeight: '800', marginLeft: 10 },
});
