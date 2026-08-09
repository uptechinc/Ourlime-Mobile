import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { Heart, MessageCircle, Send, Volume2, VolumeX, Play, Plus } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { auth, db } from '@/lib/firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  limit,
  orderBy,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import CreateLimeModal from '@/components/limes/CreateLimeModal';
import CommentModal, { LimeComment } from '@/components/limes/CommentModal';
import { Reel } from '@/types/userTypes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LimesScreen() {
  const [limesList, setLimesList] = useState<Reel[]>([]);
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(new Set());
  const [feedTab, setFeedTab] = useState<'forYou' | 'following'>('forYou');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [commentReelId, setCommentReelId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preloadedCommentsMap, setPreloadedCommentsMap] = useState<Record<string, LimeComment[]>>({});

  const loadRealLimes = useCallback(async () => {
    setLoading(true);
    try {
      if (auth.currentUser?.uid) {
        try {
          const friendsSnap = await getDocs(
            query(collection(db, 'friendships'), where('users', 'array-contains', auth.currentUser.uid))
          );
          const fSet = new Set<string>();
          friendsSnap.docs.forEach((d) => {
            const users: string[] = d.data().users || [];
            users.forEach((u) => {
              if (u !== auth.currentUser?.uid) fSet.add(u);
            });
          });
          setFollowingUserIds(fSet);
        } catch {
          // ignore friends fetch errors
        }
      }

      const reelsSnap = await getDocs(query(collection(db, 'reels'), limit(50)));
      if (!reelsSnap.empty) {
        const loaded = await Promise.all(
          reelsSnap.docs.map(async (reelDoc) => {
            const data = reelDoc.data();
            const creatorId = data.userId || '';
            let userDetails = data.user;

            if ((!userDetails || !userDetails.userName || userDetails.userName === 'lime_user') && creatorId) {
              try {
                const userDoc = await getDoc(doc(db, 'users', creatorId));
                if (userDoc.exists()) {
                  const u = userDoc.data();
                  userDetails = {
                    firstName: u.firstName || 'Lime',
                    lastName: u.lastName || 'Creator',
                    userName: u.userName || 'creator',
                    profileImage: u.profileImage || undefined,
                  };
                }
              } catch {
                // fallback
              }
            }

            // Pre-fetch first 50 comments
            try {
              const commentsSnap = await getDocs(
                query(
                  collection(db, 'reels', reelDoc.id, 'comments'),
                  orderBy('createdAt', 'desc'),
                  limit(50)
                )
              );
              const firstComments: LimeComment[] = commentsSnap.docs
                .map((cd) => {
                  const cData = cd.data();
                  const createdAt = cData.createdAt
                    ? typeof cData.createdAt.seconds === 'number'
                      ? cData.createdAt.seconds * 1000
                      : Date.now()
                    : Date.now();
                  return {
                    id: cd.id,
                    reelId: reelDoc.id,
                    userId: cData.userId || '',
                    content: cData.content || '',
                    userName: cData.userName || cData.user?.userName || 'user',
                    firstName: cData.firstName || cData.user?.firstName || 'User',
                    profileImage: cData.profileImage || cData.user?.profileImage || undefined,
                    likes: Array.isArray(cData.likes) ? cData.likes : [],
                    replyCount: cData.replyCount || 0,
                    parentCommentId: cData.parentCommentId || null,
                    replyToUserName: cData.replyToUserName || null,
                    createdAt,
                    editedAt: cData.editedAt
                      ? typeof cData.editedAt.seconds === 'number'
                        ? cData.editedAt.seconds * 1000
                        : undefined
                      : undefined,
                  } satisfies LimeComment;
                })
                .filter((c) => Boolean(c.id));
              setPreloadedCommentsMap((prev) => ({ ...prev, [reelDoc.id]: firstComments }));
            } catch {
              // ignore
            }

            return {
              id: reelDoc.id,
              userId: creatorId,
              media: data.media || { type: 'video', typeUrl: '', fileName: 'reel.mp4', duration: 0 },
              visibility: data.visibility || 'public',
              category: data.category || 'Lifestyle',
              caption: data.caption || '',
              createdAt: data.createdAt ? new Date() : new Date(),
              user: userDetails || {
                firstName: 'Lime',
                lastName: 'User',
                userName: 'user',
                profileImage: undefined,
              },
              stats: data.stats || {
                likes: Array.isArray(data.likes) ? data.likes.length : 0,
                comments: 0,
                shares: 0,
              },
              likes: Array.isArray(data.likes) ? data.likes : [],
            } as Reel;
          })
        );
        setLimesList(loaded);
      }
    } catch (err) {
      console.error('[LimesScreen] Error loading real limes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRealLimes();
  }, [loadRealLimes]);

  const currentUserId = auth.currentUser?.uid || '';

  const displayedLimes = limesList.filter((l) => {
    const isOwner = currentUserId === l.userId;
    if (l.visibility === 'private' || l.visibility === 'only_me') {
      if (!isOwner) return false;
    }
    if (l.visibility === 'friends') {
      if (!isOwner && !followingUserIds.has(l.userId)) return false;
    }
    if (feedTab === 'following') {
      return followingUserIds.has(l.userId) || isOwner;
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
          Be the first to post a Lime!
        </Text>
        <TouchableOpacity
          onPress={() => setIsCreateModalOpen(true)}
          style={{ marginTop: 20, backgroundColor: '#10b981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Create a Lime</Text>
        </TouchableOpacity>
        {isCreateModalOpen && (
          <CreateLimeModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={() => {
              setIsCreateModalOpen(false);
              void loadRealLimes();
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
          <TouchableOpacity onPress={() => setFeedTab('forYou')} style={styles.tabBtn}>
            <Text style={[styles.tabText, feedTab === 'forYou' && styles.activeTabText]}>For You</Text>
            {feedTab === 'forYou' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
          <View style={styles.tabDivider} />
          <TouchableOpacity onPress={() => setFeedTab('following')} style={styles.tabBtn}>
            <Text style={[styles.tabText, feedTab === 'following' && styles.activeTabText]}>Following</Text>
            {feedTab === 'following' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => setIsCreateModalOpen(true)}
          style={styles.createButton}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#ffffff" />
          <Text style={styles.createButtonText}>Create</Text>
        </TouchableOpacity>
      </SafeAreaView>

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
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === activeIndex}
            muted={muted}
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
          />
        )}
      />

      {/* Create Lime Modal */}
      {isCreateModalOpen && (
        <CreateLimeModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            void loadRealLimes();
          }}
        />
      )}

      {/* Comments Modal */}
      {commentReelId && (
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
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Video Player — isolated so VideoPlayer hook rules are respected     */
/* ─────────────────────────────────────────────────────────────────── */
function ReelVideoPlayer({ url, isActive, muted }: { url: string; isActive: boolean; muted: boolean }) {
  const safeUrl = url && url.length > 4 ? url : undefined;
  const [hasError, setHasError] = useState(false);

  const player = useVideoPlayer(safeUrl ?? null, (p) => {
    p.loop = true;
    p.muted = muted;
    if (isActive && safeUrl) {
      try { p.play(); } catch { /* ignore */ }
    }
  });

  // Catch player errors — prevents crash when video source fails or ends unexpectedly
  useEffect(() => {
    const sub = player.addListener('statusChange', (status) => {
      if (status.status === 'error') {
        console.error('[ReelVideoPlayer] Player error:', status.error?.message ?? 'unknown');
        setHasError(true);
      } else if (status.status === 'readyToPlay') {
        setHasError(false);
      }
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    try {
      player.muted = muted;
    } catch {
      // ignore
    }
  }, [player, muted]);

  useEffect(() => {
    if (hasError) return; // Don't attempt play on errored player
    try {
      if (isActive && safeUrl) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // ignore
    }
  }, [player, isActive, safeUrl, hasError]);

  if (!safeUrl || hasError) {
    return (
      <View style={[styles.videoPlayer, { backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>🎬</Text>
        <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>
          {hasError ? 'Video unavailable' : 'No video'}
        </Text>
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={styles.videoPlayer}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ReelItem — the core card. Double-tap zone sits on top of video       */
/* but BELOW all interactive buttons.                                   */
/* ─────────────────────────────────────────────────────────────────── */
type ReelItemProps = {
  reel: Reel;
  isActive: boolean;
  muted: boolean;
  currentUserId: string;
  onToggleMute: () => void;
  onCommentPress: () => void;
  onLikeUpdate: (reelId: string, liked: boolean) => void;
};

function ReelItem({ reel, isActive, muted, currentUserId, onToggleMute, onCommentPress, onLikeUpdate }: ReelItemProps) {
  const [paused, setPaused] = useState(false);
  const likedByMe = Array.isArray(reel.likes) && currentUserId ? reel.likes.includes(currentUserId) : false;
  const [isLiked, setIsLiked] = useState(likedByMe);
  const [likeCount, setLikeCount] = useState(reel.stats?.likes ?? 0);
  const [isFollowing, setIsFollowing] = useState(false);
  const heartAnim = useRef(new Animated.Value(0)).current;
  const heartScale = heartAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.3, 1] });
  const lastTapRef = useRef<number | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerLike = useCallback(() => {
    if (!isLiked) {
      setIsLiked(true);
      setLikeCount((c) => c + 1);
      onLikeUpdate(reel.id, true);
      // Persist to Firestore
      if (currentUserId) {
        updateDoc(doc(db, 'reels', reel.id), {
          likes: arrayUnion(currentUserId),
        }).catch(() => {});
      }
    }
    // Animate heart — pop in with bounce, hold, fade out
    heartAnim.stopAnimation();
    heartAnim.setValue(0);
    Animated.sequence([
      Animated.spring(heartAnim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 22,
        speed: 40,
      }),
      Animated.delay(500),
      Animated.timing(heartAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isLiked, heartAnim, reel.id, currentUserId, onLikeUpdate]);

  const toggleLikeButton = useCallback(() => {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    onLikeUpdate(reel.id, nextLiked);
    if (currentUserId) {
      updateDoc(doc(db, 'reels', reel.id), {
        likes: nextLiked ? arrayUnion(currentUserId) : arrayRemove(currentUserId),
      }).catch(() => {});
    }
  }, [isLiked, reel.id, currentUserId, onLikeUpdate]);

  /* Tap handler: only on the central video zone (not sidebar or overlay) */
  const handleDoubleTapZoneTap = useCallback(() => {
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
  }, [triggerLike]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  const handleShare = async () => {
    try {
      const shareUrl = `https://ourlime.com/limes/${reel.id}`;
      const title = reel.caption || `Lime Reel by @${reel.user.userName}`;
      const message = `${reel.caption ? `"${reel.caption}"\n\n` : ''}Watch @${reel.user.userName}'s Lime reel on Ourlime:\n${shareUrl}`;
      await Share.share({ title, message, url: shareUrl });
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.reelContainer}>
      {/* 1. Video player — bottom layer */}
      <ReelVideoPlayer url={reel.media.typeUrl} isActive={isActive && !paused} muted={muted} />

      {/* 2. Double-tap + single-tap zone — transparent, sits above video but BELOW UI elements */}
      <Pressable
        style={styles.doubleTapZone}
        onPress={handleDoubleTapZoneTap}
      />

      {/* 3. Pause indicator — rendered above tap zone, below sidebar */}
      {paused && (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <Play size={56} color="rgba(255,255,255,0.9)" />
        </View>
      )}

      {/* 4. Heart pop animation — above everything, non-interactive */}
      <Animated.View
        style={[
          styles.heartPop,
          {
            opacity: heartAnim,
            transform: [{ scale: heartScale }],
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

        <TouchableOpacity onPress={handleShare} style={styles.actionBtn} activeOpacity={0.7}>
          <Send size={26} color="#ffffff" />
          <Text style={styles.actionCount}>{reel.stats?.shares ?? 0}</Text>
        </TouchableOpacity>
      </View>

      {/* 6. Bottom overlay (creator info + caption) — non-interactive container */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">
        <View style={styles.creatorRow} pointerEvents="box-none">
          <Image
            source={{
              uri:
                reel.user.profileImage ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.user.firstName || 'L')}&background=10b981&color=fff`,
            }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.creatorName}>
              {reel.user.firstName} {reel.user.lastName}
            </Text>
            <Text style={styles.handle}>@{reel.user.userName}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsFollowing((f) => !f)}
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            activeOpacity={0.8}
          >
            <Text style={[styles.followText, isFollowing && styles.followingText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
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
  /* Transparent double-tap zone: full screen but NOT covering sidebar or bottom bar controls */
  doubleTapZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    /* Stop short of the right sidebar (80px) and bottom overlay (140px) */
    right: 70,
    bottom: 130,
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
    // Pixel-exact center of the screen — percentages are unreliable with absolute positioning
    top: SCREEN_HEIGHT * 0.38,
    left: SCREEN_WIDTH / 2 - 55,
    zIndex: 50,
    // Shadow glow effect
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  rightSidebar: {
    position: 'absolute',
    right: 16,
    bottom: 110,
    alignItems: 'center',
    gap: 22,
    zIndex: 80,
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
});
