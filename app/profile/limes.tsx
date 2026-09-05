import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackSpeed } from '@/lib/services/PlaybackInteractionService';
import {
  AppState,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Platform,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Volume2, VolumeX } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, useIsFocused } from 'expo-router';
import type { Reel } from '@/types/userTypes';
import { limeService } from '@/lib/services/LimeService';
import { AuthService } from '@/lib/services/AuthService';
import { ReelItem, reelToPostItem } from '@/app/(tabs)/Limes';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import ReportLimeModal from '@/components/limes/ReportLimeModal';
import CustomModal from '@/components/ui/CustomModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const authService = AuthService.getInstance();

type ReportTarget = {
  reelId: string;
  reportedUserId: string;
  reportType: 'lime' | 'user';
};

export default function ProfileLimesScreen() {
  const router = useRouter();
  const { userId, limeId } = useLocalSearchParams<{ userId?: string; limeId?: string }>();
  const isScreenFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const currentUserId = authService.getCurrentUser()?.uid || authService.getVerifiedCurrentUser()?.uid || '';
  const targetUserId = userId || currentUserId;

  const [limes, setLimes] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(SCREEN_HEIGHT);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [seeking, setSeeking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [commentReelId, setCommentReelId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const limesListRef = useRef<FlatList<Reel>>(null);
  const hasInitializedIndex = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (!targetUserId) return;
    setRefreshing(true);
    try {
      const data = await limeService.fetchUserAndRepostedReels(targetUserId);
      setLimes(data);
    } catch (err) {
      console.error('[ProfileLimesScreen] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [targetUserId]);

  const playbackAllowed = isScreenFocused
    && appState === 'active'
    && !commentReelId
    && !reportTarget;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  // Fetch only this user's profile limes
  useEffect(() => {
    let cancelled = false;
    const fetchProfileLimes = async () => {
      if (!targetUserId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await limeService.fetchUserAndRepostedReels(targetUserId);
        if (cancelled) return;
        setLimes(data);

        // Find initial index from clicked limeId
        if (limeId && data.length > 0) {
          const foundIndex = data.findIndex((item) => item.id === limeId);
          if (foundIndex >= 0) {
            setActiveIndex(foundIndex);
          }
        }
      } catch (err) {
        console.error('[ProfileLimesScreen] Failed to fetch profile limes:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchProfileLimes();
    return () => {
      cancelled = true;
    };
  }, [targetUserId, limeId]);

  // Scroll to initial index once data is loaded
  useEffect(() => {
    if (!loading && limes.length > 0 && !hasInitializedIndex.current) {
      hasInitializedIndex.current = true;
      if (limeId) {
        const foundIndex = limes.findIndex((item) => item.id === limeId);
        if (foundIndex > 0) {
          requestAnimationFrame(() => {
            limesListRef.current?.scrollToIndex({
              index: foundIndex,
              animated: false,
            });
          });
        }
      }
    }
  }, [loading, limes, limeId]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      } else setActiveIndex(-1);
    }
  ).current;

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 70 }).current;

  const handleLikeUpdate = useCallback((reelId: string, liked: boolean) => {
    setLimes((prev) =>
      prev.map((r) => {
        if (r.id !== reelId) return r;
        const currentLikes = Array.isArray(r.likes) ? r.likes : [];
        const nextLikes = liked
          ? Array.from(new Set([...currentLikes, currentUserId]))
          : currentLikes.filter((uid) => uid !== currentUserId);
        return {
          ...r,
          likes: nextLikes,
          stats: {
            likes: liked ? (r.stats?.likes ?? 0) + 1 : Math.max(0, (r.stats?.likes ?? 0) - 1),
            comments: r.stats?.comments ?? 0,
            shares: r.stats?.shares ?? 0,
            reposts: r.stats?.reposts ?? 0,
          },
        };
      })
    );
  }, [currentUserId]);

  const handleToggleRepost = useCallback((reelId: string, reposted: boolean) => {
    setLimes((prev) =>
      prev.map((r) => {
        if (r.id !== reelId) return r;
        return {
          ...r,
          repostedByViewer: reposted,
          stats: {
            likes: r.stats?.likes ?? 0,
            comments: r.stats?.comments ?? 0,
            shares: r.stats?.shares ?? 0,
            reposts: reposted
              ? (r.stats?.reposts ?? 0) + 1
              : Math.max(0, (r.stats?.reposts ?? 0) - 1),
          },
        };
      })
    );
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      await limeService.deleteLime(deleteTarget.id);
      setLimes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete Lime');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={screenStyles.loadingContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (limes.length === 0) {
    return (
      <View style={screenStyles.loadingContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <SafeAreaView edges={['top', 'left', 'right']} style={screenStyles.headerSafe}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={screenStyles.backButton}
            activeOpacity={0.8}
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
        </SafeAreaView>
        <Text style={screenStyles.emptyText}>No Limes found</Text>
      </View>
    );
  }

  return (
    <View style={[screenStyles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Vertical Reel Pager (Scrolls ONLY through this user's profile limes) */}
      <FlatList
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        ref={limesListRef}
        data={limes}
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
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            limesListRef.current?.scrollToIndex({ index, animated: false });
          }, 150);
        }}
        renderItem={({ item, index }) => (
          <ReelItem
            height={viewportHeight}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            onSeekingChange={setSeeking}
            reel={item}
            isActive={playbackAllowed && index === activeIndex}
            shouldLoadVideo={playbackAllowed && Math.abs(index - activeIndex) <= 1}
            muted={muted}
            currentUserId={currentUserId}
            isRepostedInitial={
              item.repostedByViewer === true ||
              (Boolean(item.isRepost) && item.userId === currentUserId)
            }
            isFollowing={false}
            isOwnReel={item.userId === currentUserId}
            onToggleMute={() => setMuted((prev) => !prev)}
            onCommentPress={() => setCommentReelId(item.id)}
            onLikeUpdate={handleLikeUpdate}
            onToggleRepost={handleToggleRepost}
            onFollowToggle={() => {}}
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
              setLimes((prev) => prev.filter((r) => r.id !== deletedReelId));
            }}
          />
        )}
      />

      {/* Floating Top Bar (Clean back button & sound toggle — NO For You/Following, NO category filter, NO discover icon) */}
      <SafeAreaView edges={['top', 'left', 'right']} style={screenStyles.topBar} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => router.back()}
          style={screenStyles.backButton}
          activeOpacity={0.8}
          accessibilityLabel="Back to Profile"
        >
          <ChevronLeft size={24} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMuted((prev) => !prev)}
          style={screenStyles.soundButton}
          activeOpacity={0.8}
          accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
        >
          {muted ? <VolumeX size={18} color="#ffffff" /> : <Volume2 size={18} color="#ffffff" />}
        </TouchableOpacity>
      </SafeAreaView>

      {/* Comments Modal */}
      {commentReelId ? (() => {
        const targetReel = limes.find((r) => r.id === commentReelId);
        if (!targetReel) return null;
        return (
          <CommentsModal
            post={reelToPostItem(targetReel)}
            userId={currentUserId}
            onClose={() => setCommentReelId(null)}
            onPostUpdate={(updatedPost) => {
              setLimes((prev) =>
                prev.map((r) => {
                  if (r.id !== commentReelId) return r;
                  return {
                    ...r,
                    stats: {
                      likes: r.stats?.likes ?? 0,
                      comments: updatedPost.stats?.comments ?? r.stats?.comments ?? 0,
                      shares: r.stats?.shares ?? 0,
                      reposts: r.stats?.reposts ?? 0,
                    },
                  };
                })
              );
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

      {/* Delete Confirmation Modal */}
      <CustomModal
        visible={Boolean(deleteTarget)}
        type="danger"
        title="Delete this Lime?"
        message={deleteError || 'This permanently removes the Lime and its repost markers. This cannot be undone.'}
        confirmText="Delete Lime"
        cancelText="Keep Lime"
        isLoading={deleting}
        onConfirm={() => void handleDeleteConfirm()}
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

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  headerSafe: {
    position: 'absolute',
    top: 0,
    left: 16,
    zIndex: 50,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    zIndex: 50,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  soundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
});
