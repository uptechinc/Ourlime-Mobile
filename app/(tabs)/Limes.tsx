import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  Animated,
  Share,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Laugh,
  BookOpen,
  Hammer,
  Music2,
  Flag,
} from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter, useLocalSearchParams } from 'expo-router';
import CreateLimeModal from '@/components/limes/CreateLimeModal';
import CommentModal from '@/components/limes/CommentModal';
import ReportLimeModal from '@/components/limes/ReportLimeModal';
import { Reel } from '@/types/userTypes';
import type { LimeComment } from '@/lib/types/lime';
import { limeService } from '@/lib/services/LimeService';
import type { LimeFeedCursor } from '@/lib/services/LimeService';
import { AuthService } from '@/lib/services/AuthService';
import { deepLinkService } from '@/lib/services/DeepLinkService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const authService = AuthService.getInstance();

type DiscoveryCategory = {
  name: string;
  Icon: typeof Laugh;
};

const DISCOVERY_CATEGORIES: DiscoveryCategory[] = [
  { name: 'Comedy',      Icon: Laugh    },
  { name: 'Educational', Icon: BookOpen },
  { name: 'DIY',         Icon: Hammer   },
  { name: 'Music',       Icon: Music2   },
  { name: 'Explore',     Icon: Compass  },
];

type ReportTarget = {
  reelId: string;
  reportedUserId: string;
  reportType: 'lime' | 'user';
};

export default function LimesScreen() {
  const router = useRouter();
  const { limeId } = useLocalSearchParams<{ limeId?: string }>();

  const [limesList, setLimesList] = useState<Reel[]>([]);
  const [userRepostedReelIds, setUserRepostedReelIds] = useState<Set<string>>(new Set());
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(new Set());
  const [feedTab, setFeedTab] = useState<'forYou' | 'following'>('forYou');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [commentReelId, setCommentReelId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [feedCursor, setFeedCursor] = useState<LimeFeedCursor | null>(null);
  const [preloadedCommentsMap, setPreloadedCommentsMap] = useState<Record<string, LimeComment[]>>({});
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const currentUserId = authService.getCurrentUser()?.uid || '';

  const loadRealLimes = useCallback(async (category?: string) => {
    setLoading(true);
    try {
      const uid = authService.getCurrentUser()?.uid ?? '';
      const [result, repostedIds] = await Promise.all([
        limeService.fetchFeed(uid, category),
        limeService.fetchUserRepostedLimeIds(uid),
      ]);
      const requestedLime = limeId
        ? result.reels.find((reel) => reel.id === limeId) ?? await limeService.fetchLimeById(limeId)
        : null;
      const orderedReels = requestedLime
        ? [requestedLime, ...result.reels.filter((reel) => reel.id !== requestedLime.id)]
        : result.reels;
      setFollowingUserIds(new Set(result.followingUserIds));
      setUserRepostedReelIds(repostedIds);
      setPreloadedCommentsMap(result.commentsByReel);
      setLimesList(orderedReels);
      setFeedCursor(result.lastDoc ?? null);
      setHasMore(result.hasMore);
      setFeedTab('forYou');
      setActiveIndex(0);
    } catch (err) {
      console.error('[LimesScreen] Error loading limes:', err);
    } finally {
      setLoading(false);
    }
  }, [limeId]);

  const loadMoreLimes = useCallback(async () => {
    if (!hasMore || isLoadingMore || !feedCursor) return;
    setIsLoadingMore(true);
    try {
      const uid = authService.getCurrentUser()?.uid ?? '';
      const result = await limeService.fetchFeed(uid, activeCategory ?? undefined, feedCursor);
      setLimesList((prev) => [...prev, ...result.reels]);
      setPreloadedCommentsMap((prev) => ({ ...prev, ...result.commentsByReel }));
      setFeedCursor(result.lastDoc ?? null);
      setHasMore(result.hasMore);
    } catch {
      // ignore
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, feedCursor, activeCategory]);

  useEffect(() => {
    void loadRealLimes();
  }, [loadRealLimes]);

  const handleSelectCategory = useCallback((category: string) => {
    setShowCategoryDropdown(false);
    setActiveCategory(category);
    setFeedTab('forYou');
    void loadRealLimes(category);
  }, [loadRealLimes]);

  const handleClearCategory = useCallback(() => {
    setActiveCategory(null);
    void loadRealLimes();
  }, [loadRealLimes]);

  const handleFollowToggle = useCallback(async (targetUserId: string, currentlyFollowing: boolean) => {
    if (!currentUserId) return;
    // Optimistic update
    setFollowingUserIds((prev) => {
      const next = new Set(prev);
      if (currentlyFollowing) next.delete(targetUserId);
      else next.add(targetUserId);
      return next;
    });
    try {
      if (currentlyFollowing) {
        await limeService.unfollowUser(currentUserId, targetUserId);
      } else {
        await limeService.followUser(currentUserId, targetUserId);
      }
    } catch {
      // Rollback on error
      setFollowingUserIds((prev) => {
        const next = new Set(prev);
        if (currentlyFollowing) next.add(targetUserId);
        else next.delete(targetUserId);
        return next;
      });
    }
  }, [currentUserId]);

  const displayedLimes = limesList.filter((l) => {
    const reposterId = l.repostedBy?.userId || l.userId;
    const isOwner = Boolean(currentUserId && (currentUserId === l.userId || currentUserId === reposterId));
    if (l.visibility === 'private' || l.visibility === 'only_me') {
      if (!isOwner) return false;
    }
    if (l.visibility === 'friends') {
      if (!isOwner && !followingUserIds.has(l.userId) && !followingUserIds.has(reposterId)) return false;
    }
    if (feedTab === 'following') {
      return isOwner || followingUserIds.has(l.userId) || followingUserIds.has(reposterId);
    }
    return true;
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 70 }).current;

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 13 }}>Loading Limes…</Text>
      </View>
    );
  }

  if (displayedLimes.length === 0) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Text style={{ fontSize: 42 }}>🍋</Text>
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800', marginTop: 12 }}>
          No Limes yet
        </Text>
        <Text style={{ color: '#64748b', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
          {activeCategory ? `No ${activeCategory} Limes yet.` : 'Be the first to post a Lime!'}
        </Text>
        {activeCategory ? (
          <TouchableOpacity
            onPress={handleClearCategory}
            style={{ marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#10b981' }}
          >
            <Text style={{ color: '#10b981', fontWeight: '700' }}>Back to For You</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => setIsCreateModalOpen(true)}
          style={{ marginTop: 16, backgroundColor: '#10b981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Create a Lime</Text>
        </TouchableOpacity>
        {isCreateModalOpen && (
          <CreateLimeModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={() => {
              setIsCreateModalOpen(false);
              void loadRealLimes(activeCategory ?? undefined);
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Top Header Overlay */}
      <SafeAreaView style={styles.topHeader} edges={['top', 'left', 'right']}>
        <View style={styles.tabToggleRow}>
          <TouchableOpacity
            onPress={() => { setFeedTab('forYou'); setActiveCategory(null); }}
            style={styles.tabBtn}
          >
            <Text style={[styles.tabText, feedTab === 'forYou' && !activeCategory && styles.activeTabText]}>
              For You
            </Text>
            {feedTab === 'forYou' && !activeCategory && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          <View style={styles.tabDivider} />

          <TouchableOpacity
            onPress={() => { setFeedTab('following'); setActiveCategory(null); }}
            style={styles.tabBtn}
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
            onPress={() => setShowCategoryDropdown((prev) => !prev)}
            style={[
              styles.iconHeaderBtn,
              showCategoryDropdown && { backgroundColor: 'rgba(16,185,129,0.2)', borderColor: '#10b981' },
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
      </SafeAreaView>

      {/* Category Discovery Dropdown */}
      {showCategoryDropdown ? (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowCategoryDropdown(false)}
          />
          <View style={styles.categoryDropdown}>
            <Text style={styles.categoryDropdownTitle}>Discover</Text>
            <View style={styles.categoryGrid}>
              {DISCOVERY_CATEGORIES.map((cat) => {
                const CatIcon = cat.Icon;
                const isActive = activeCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    onPress={() => handleSelectCategory(cat.name)}
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    activeOpacity={0.7}
                  >
                    <CatIcon size={15} color={isActive ? '#10b981' : '#94a3b8'} />
                    <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
      ) : null}

      {/* Vertical Reel Pager */}
      <FlatList
        data={displayedLimes}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfigRef}
        onEndReached={() => void loadMoreLimes()}
        onEndReachedThreshold={0.3}
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
            reel={item}
            isActive={index === activeIndex}
            muted={muted}
            isRepostedInitial={
              userRepostedReelIds.has(item.id) ||
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
              setLimesList((prev) =>
                prev.map((r) =>
                  r.id === reelId
                    ? ({
                        ...r,
                        likes: liked
                          ? [...(r.likes || []), currentUserId]
                          : (r.likes || []).filter((u) => u !== currentUserId),
                        stats: {
                          ...r.stats,
                          likes: liked
                            ? (r.stats?.likes ?? 0) + 1
                            : Math.max(0, (r.stats?.likes ?? 0) - 1),
                        },
                      } as Reel)
                    : r
                )
              );
            }}
            onToggleRepost={(reelId, reposted) => {
              setUserRepostedReelIds((prev) => {
                const next = new Set(prev);
                if (reposted) next.add(reelId);
                else next.delete(reelId);
                return next;
              });
              setLimesList((prev) =>
                prev.map((r) =>
                  r.id === reelId
                    ? ({
                        ...r,
                        stats: {
                          ...r.stats,
                          reposts: reposted
                            ? (r.stats?.reposts ?? 0) + 1
                            : Math.max(0, (r.stats?.reposts ?? 0) - 1),
                        },
                      } as Reel)
                    : r
                )
              );
            }}
            onFollowToggle={handleFollowToggle}
            onProfilePress={(userName) => {
              router.push(`/profile/viewOtherProfile/${userName}` as never);
            }}
            onReport={(reelId, reportedUserId, reportType) =>
              setReportTarget({ reelId, reportedUserId, reportType })
            }
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
            void loadRealLimes(activeCategory ?? undefined);
          }}
        />
      ) : null}

      {/* Comments Modal */}
      {commentReelId ? (
        <CommentModal
          isOpen={Boolean(commentReelId)}
          reelId={commentReelId}
          initialComments={preloadedCommentsMap[commentReelId] || []}
          onClose={() => setCommentReelId(null)}
          onCommentCountUpdate={(count) => {
            setLimesList((prev) =>
              prev.map((item) =>
                item.id === commentReelId
                  ? ({ ...item, stats: { ...item.stats, comments: count } } as Reel)
                  : item
              )
            );
          }}
        />
      ) : null}

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
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Video Player — isolated & rock solid like Feed Post videos          */
/* ─────────────────────────────────────────────────────────────────── */
function ReelVideoPlayer({ url, isActive, muted }: { url: string; isActive: boolean; muted: boolean }) {
  const safeUrl = url && url.length > 4 ? url : undefined;

  const player = useVideoPlayer(safeUrl ?? null, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  useEffect(() => {
    try {
      player.muted = muted;
    } catch {
      // ignore
    }
  }, [player, muted]);

  useEffect(() => {
    try {
      if (isActive && safeUrl) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // ignore
    }
  }, [player, isActive, safeUrl]);

  return (
    <View style={styles.videoPlayer}>
      {safeUrl ? (
        <VideoView
          player={player}
          style={{ width: '100%', height: '100%' }}
          nativeControls={false}
          contentFit="cover"
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🎬</Text>
          <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>No video</Text>
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ReelItem — core reel card with full feature set                     */
/* ─────────────────────────────────────────────────────────────────── */
type ReelItemProps = {
  reel: Reel;
  isActive: boolean;
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
};

function ReelItem({
  reel,
  isActive,
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
}: ReelItemProps) {
  const [paused, setPaused] = useState(false);
  const likedByMe = Array.isArray(reel.likes) && currentUserId ? reel.likes.includes(currentUserId) : false;
  const [isLiked, setIsLiked] = useState(likedByMe);
  const [likeCount, setLikeCount] = useState(reel.stats?.likes ?? 0);
  const [isReposted, setIsReposted] = useState(isRepostedInitial);
  const [repostCount, setRepostCount] = useState(reel.stats?.reposts ?? (reel.reposts?.length ?? 0));
  const [shareCount, setShareCount] = useState(reel.stats?.shares ?? 0);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  useEffect(() => {
    setIsReposted(isRepostedInitial);
  }, [isRepostedInitial]);

  // Close options menu when reel is no longer active
  useEffect(() => {
    if (!isActive) setShowOptionsMenu(false);
  }, [isActive]);

  // Feed-matching Heart animation values
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const heartTranslateY = useRef(new Animated.Value(0)).current;

  const lastTapRef = useRef<number | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHeartAnim = useCallback(() => {
    heartScale.setValue(0.3);
    heartOpacity.setValue(1);
    heartTranslateY.setValue(0);

    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1.35,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(heartTranslateY, {
        toValue: -30,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [heartScale, heartOpacity, heartTranslateY]);

  const triggerLike = useCallback(() => {
    if (!isLiked) {
      setIsLiked(true);
      setLikeCount((c) => c + 1);
      onLikeUpdate(reel.id, true);
      if (currentUserId) {
        limeService.toggleLike(reel.id, currentUserId, true).catch(() => {});
      }
    }
    triggerHeartAnim();
  }, [isLiked, reel.id, currentUserId, onLikeUpdate, triggerHeartAnim]);

  const toggleLikeButton = useCallback(() => {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    onLikeUpdate(reel.id, nextLiked);
    if (currentUserId) {
      limeService.toggleLike(reel.id, currentUserId, nextLiked).catch(() => {});
    }
    if (nextLiked) triggerHeartAnim();
  }, [isLiked, reel.id, currentUserId, onLikeUpdate, triggerHeartAnim]);

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
  }, []);

  const handleShare = useCallback(async () => {
    try {
      const shareUrl = deepLinkService.getLimeShareUrl(reel.id);
      const title = reel.caption || `Lime Reel by @${reel.user.userName}`;
      const message = `${reel.caption ? `"${reel.caption}"\n\n` : ''}Watch @${reel.user.userName}'s Lime reel on Ourlime:\n${shareUrl}`;
      const result = await Share.share({ title, message, url: shareUrl });
      if (result.action === Share.sharedAction) {
        setShareCount((c) => c + 1);
        limeService.incrementShareCount(reel.id).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, [reel.id, reel.caption, reel.user.userName]);

  const handleProfilePress = useCallback(() => {
    onProfilePress(reel.user.userName);
  }, [reel.user.userName, onProfilePress]);

  return (
    <View style={styles.reelContainer}>
      {/* 1. Video player — bottom layer */}
      <ReelVideoPlayer url={reel.media.typeUrl} isActive={isActive && !paused} muted={muted} />

      {/* 2. Double-tap + single-tap zone — full screen, sits behind controls */}
      <Pressable
        style={styles.doubleTapZone}
        onPress={handleDoubleTapZoneTap}
      />

      {/* 3. Pause indicator — overlay */}
      {paused ? (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <Play size={56} color="rgba(255,255,255,0.9)" />
        </View>
      ) : null}

      {/* 4. Animated Red Popped Heart on Double Tap */}
      <Animated.View
        style={[
          styles.heartPop,
          {
            opacity: heartOpacity,
            transform: [{ scale: heartScale }, { translateY: heartTranslateY }],
          },
        ]}
        pointerEvents="none"
      >
        <Heart size={110} color="#ef4444" fill="#ef4444" />
      </Animated.View>

      {/* 5. Right Sidebar — highest z-index, fully interactive */}
      <View style={styles.rightSidebar} pointerEvents="box-none">
        <TouchableOpacity onPress={onToggleMute} style={styles.actionBtn} activeOpacity={0.7}>
          {muted ? <VolumeX size={26} color="#ffffff" /> : <Volume2 size={26} color="#ffffff" />}
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleLikeButton} style={styles.actionBtn} activeOpacity={0.7}>
          <Heart
            size={28}
            color={isLiked ? '#ef4444' : '#ffffff'}
            fill={isLiked ? '#ef4444' : 'none'}
          />
          <Text style={styles.actionCount}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onCommentPress} style={styles.actionBtn} activeOpacity={0.7}>
          <MessageCircle size={28} color="#ffffff" />
          <Text style={styles.actionCount}>{reel.stats?.comments ?? 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => void toggleRepostButton()} style={styles.actionBtn} activeOpacity={0.7}>
          <Repeat2
            size={27}
            color={isReposted ? '#10b981' : '#ffffff'}
          />
          <Text style={[styles.actionCount, isReposted && { color: '#10b981' }]}>{repostCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => void handleShare()} style={styles.actionBtn} activeOpacity={0.7}>
          <Send size={26} color="#ffffff" />
          <Text style={styles.actionCount}>{shareCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowOptionsMenu((prev) => !prev)}
          style={styles.actionBtn}
          activeOpacity={0.7}
        >
          <MoreVertical size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Options menu (report) — appears next to sidebar */}
      {showOptionsMenu ? (
        <View style={styles.optionsMenu}>
          <TouchableOpacity
            style={styles.optionsMenuItem}
            onPress={() => {
              setShowOptionsMenu(false);
              onReport(reel.id, reel.userId, 'lime');
            }}
            activeOpacity={0.7}
          >
            <Flag size={14} color="#ef4444" />
            <Text style={styles.optionsMenuText}>Report Lime</Text>
          </TouchableOpacity>
          <View style={styles.optionsDivider} />
          <TouchableOpacity
            style={styles.optionsMenuItem}
            onPress={() => {
              setShowOptionsMenu(false);
              onReport(reel.id, reel.userId, 'user');
            }}
            activeOpacity={0.7}
          >
            <Flag size={14} color="#ef4444" />
            <Text style={styles.optionsMenuText}>Report User</Text>
          </TouchableOpacity>
          <View style={styles.optionsDivider} />
          <TouchableOpacity
            style={styles.optionsMenuItem}
            onPress={() => setShowOptionsMenu(false)}
            activeOpacity={0.7}
          >
            <Text style={[styles.optionsMenuText, { color: '#64748b' }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 6. Bottom overlay (creator info + caption) */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">
        {(() => {
          const currentUid = authService.getCurrentUser()?.uid || '';
          const isReposter = Boolean(
            currentUid && (
              currentUid === reel.repostedBy?.userId ||
              (reel.isRepost && currentUid === reel.userId)
            )
          );

          if (!reel.isRepost || isReposter || (!reel.repostedBy && !reel.repostedFrom)) {
            return null;
          }

          return (
            <View style={styles.repostBadge}>
              <Repeat2 size={13} color="#34d399" />
              <Text style={styles.repostBadgeText}>
                {reel.repostedBy?.firstName
                  ? `${reel.repostedBy.firstName} ${reel.repostedBy.lastName || ''}`.trim()
                  : (reel.repostedBy?.userName || reel.repostedFrom?.userName || 'Friend')}{' '}
                reposted
              </Text>
            </View>
          );
        })()}

        <View style={styles.creatorRow} pointerEvents="box-none">
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
            <Image
              source={{
                uri:
                  reel.user.profileImage ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.user.firstName || 'L')}&background=10b981&color=fff`,
              }}
              style={styles.avatar}
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

        {reel.caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            {reel.caption}
          </Text>
        ) : null}

        <View style={styles.soundRow}>
          <Icon name="music" size={14} color="#10b981" />
          <Text style={styles.soundText}>Original Sound – @{reel.user.userName}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  categoryDropdown: {
    position: 'absolute',
    top: 96,
    right: 16,
    zIndex: 200,
    backgroundColor: 'rgba(15, 23, 42, 0.97)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 14,
    minWidth: 220,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  categoryDropdownTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  categoryChipActive: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  categoryChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#10b981',
    fontWeight: '700',
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
    height: SCREEN_HEIGHT,
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
  optionsMenu: {
    position: 'absolute',
    right: 60,
    bottom: 40,
    zIndex: 200,
    backgroundColor: 'rgba(15, 23, 42, 0.97)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: 160,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 20,
  },
  optionsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  optionsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 12,
  },
  optionsMenuText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 30,
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
  repostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(6, 78, 59, 0.85)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  repostBadgeText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },
});
