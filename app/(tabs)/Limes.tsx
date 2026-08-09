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
  TouchableWithoutFeedback,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { Heart, MessageCircle, Send, Volume2, VolumeX, Play, Plus } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { auth, db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, getDoc, doc, limit, orderBy } from 'firebase/firestore';
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

  /* Pre-fetched comments map by reelId */
  const [preloadedCommentsMap, setPreloadedCommentsMap] = useState<Record<string, LimeComment[]>>({});

  const loadRealLimes = useCallback(async () => {
    setLoading(true);
    try {
      if (auth.currentUser?.uid) {
        try {
          const friendsSnap = await getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', auth.currentUser.uid)));
          const fSet = new Set<string>();
          friendsSnap.docs.forEach((d) => {
            const users: string[] = d.data().users || [];
            users.forEach((u) => { if (u !== auth.currentUser?.uid) fSet.add(u); });
          });
          setFollowingUserIds(fSet);
        } catch {
          // ignore
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
                // Fallback
              }
            }

            // Pre-fetch first 50 comments per reel ahead of time
            try {
              const commentsSnap = await getDocs(query(collection(db, 'reels', reelDoc.id, 'comments'), orderBy('createdAt', 'desc'), limit(50)));
              const firstComments: LimeComment[] = commentsSnap.docs.map((cd) => {
                const cData = cd.data();
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
                  parentCommentId: cData.parentCommentId || undefined,
                  replyToUserName: cData.replyToUserName || undefined,
                  createdAt: cData.createdAt ? (cData.createdAt.seconds ? cData.createdAt.seconds * 1000 : Date.now()) : Date.now(),
                };
              });
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
              user: userDetails || { firstName: 'Lime', lastName: 'User', userName: 'user', profileImage: undefined },
              stats: data.stats || { likes: Array.isArray(data.likes) ? data.likes.length : 0, comments: 0, shares: 0 },
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

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 70 }).current;

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

      {/* Comments Modal with Instant Preloaded Comments */}
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

type ReelItemProps = {
  reel: Reel;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onCommentPress: () => void;
};

function ReelVideoPlayer({ url, isActive, muted }: { url: string; isActive: boolean; muted: boolean }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = muted;
    if (isActive) {
      p.play();
    } else {
      p.pause();
    }
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, isActive]);

  return (
    <VideoView
      player={player}
      style={styles.videoPlayer}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

function ReelItem({ reel, isActive, muted, onToggleMute, onCommentPress }: ReelItemProps) {
  const [paused, setPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(reel.stats?.likes ?? 0);
  const [isFollowing, setIsFollowing] = useState(false);
  const heartAnim = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number | null>(null);

  const triggerLike = () => {
    setIsLiked(true);
    setLikeCount((c) => (isLiked ? c : c + 1));

    heartAnim.setValue(0);
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, bounciness: 14 }),
      Animated.delay(450),
      Animated.timing(heartAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const toggleLikeButton = () => {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
  };

  const handleTap = () => {
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 350) {
      triggerLike();
    } else {
      setPaused((p) => !p);
    }
    lastTapRef.current = now;
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://ourlime.com/limes/${reel.id}`;
      const title = reel.caption || `Lime Reel by @${reel.user.userName}`;
      const message = `${reel.caption ? `"${reel.caption}"\n\n` : ''}Watch @${reel.user.userName}'s Lime reel on Ourlime:\n${shareUrl}`;
      await Share.share({
        title,
        message,
        url: shareUrl,
      });
    } catch {
      // ignore
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={styles.reelContainer}>
        {/* Expo Video Player */}
        <ReelVideoPlayer url={reel.media.typeUrl} isActive={isActive && !paused} muted={muted} />

        {/* Mute Indicator / Tap to Pause Overlay */}
        {paused && (
          <View style={styles.pauseOverlay}>
            <Play size={48} color="#ffffff" />
          </View>
        )}

        {/* Animated Red Popped Heart in Center on Double Tap */}
        <Animated.View
          style={[
            styles.heartPop,
            {
              opacity: heartAnim,
              transform: [{ scale: heartAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <Heart size={110} color="#ef4444" fill="#ef4444" />
        </Animated.View>

        {/* Right Sidebar Controls */}
        <View style={styles.rightSidebar}>
          {/* Mute Button */}
          <TouchableOpacity onPress={onToggleMute} style={styles.actionBtn}>
            {muted ? <VolumeX size={26} color="#ffffff" /> : <Volume2 size={26} color="#ffffff" />}
          </TouchableOpacity>

          {/* Like Button with Red Inside Fill */}
          <TouchableOpacity onPress={toggleLikeButton} style={styles.actionBtn}>
            <Heart size={28} color={isLiked ? '#ef4444' : '#ffffff'} fill={isLiked ? '#ef4444' : 'none'} />
            <Text style={styles.actionCount}>{likeCount}</Text>
          </TouchableOpacity>

          {/* Comment Button */}
          <TouchableOpacity onPress={onCommentPress} style={styles.actionBtn}>
            <MessageCircle size={28} color="#ffffff" />
            <Text style={styles.actionCount}>{reel.stats?.comments ?? 0}</Text>
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
            <Send size={26} color="#ffffff" />
            <Text style={styles.actionCount}>{reel.stats?.shares ?? 0}</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Profile Overlay */}
        <View style={styles.bottomOverlay}>
          <View style={styles.creatorRow}>
            <Image
              source={{ uri: reel.user.profileImage || 'https://ui-avatars.com/api/?name=Lime+User' }}
              style={styles.avatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.creatorName}>{reel.user.firstName} {reel.user.lastName}</Text>
              <Text style={styles.handle}>@{reel.user.userName}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsFollowing((f) => !f)}
              style={[styles.followBtn, isFollowing && styles.followingBtn]}
            >
              <Text style={[styles.followText, isFollowing && styles.followingText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.caption} numberOfLines={2}>{reel.caption}</Text>

          <View style={styles.soundRow}>
            <Icon name="music" size={14} color="#10b981" />
            <Text style={styles.soundText}>Original Sound - @{reel.user.userName}</Text>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'relative',
    backgroundColor: '#000000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  heartPop: {
    position: 'absolute',
    alignSelf: 'center',
    top: SCREEN_HEIGHT / 2 - 55,
    zIndex: 30,
  },
  rightSidebar: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
    zIndex: 99,
    elevation: 20,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 10,
  },
  actionCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 40,
    right: 80,
    zIndex: 10,
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
  },
  handle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '600',
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
    borderColor: 'rgba(255, 255, 255, 0.4)',
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
  },
});
