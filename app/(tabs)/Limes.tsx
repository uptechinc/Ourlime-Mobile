import React, { useState, useRef, useEffect } from 'react';
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
import { useVideoPlayer, VideoView } from 'expo-video';
import { auth } from '@/lib/firebaseConfig';
import CreateLimeModal from '@/components/limes/CreateLimeModal';
import CommentModal from '@/components/limes/CommentModal';
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

  useEffect(() => {
    let isMounted = true;
    async function loadRealLimes() {
      try {
        const { collection, getDocs, doc, getDoc, query, where, limit } = await import('firebase/firestore');
        const { db, auth } = await import('@/lib/firebaseConfig');
        
        // 1. Fetch user's following list
        if (auth.currentUser) {
          try {
            const followSnap = await getDocs(query(collection(db, 'followers'), where('followerId', '==', auth.currentUser.uid)));
            const followSet = new Set(followSnap.docs.map((d) => d.data().followeeId as string));
            if (isMounted) setFollowingUserIds(followSet);
          } catch (e) {
            console.log('[LimesScreen] Following fetch notice:', e);
          }
        }

        // 2. Fetch real reels from 'reels' collection
        const reelsSnap = await getDocs(query(collection(db, 'reels'), limit(50)));
        if (!reelsSnap.empty && isMounted) {
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
          if (isMounted) setLimesList(loaded);
        }
      } catch (err) {
        console.error('[LimesScreen] Error loading real limes:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void loadRealLimes();
    return () => {
      isMounted = false;
    };
  }, []);

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

      {/* Top Header Overlay with For You & Following tabs on top left */}
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
          <Icon name="camera" size={18} color="#ffffff" />
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
          }}
        />
      )}

      {/* Comments Modal */}
      {commentReelId && (
        <CommentModal
          isOpen={Boolean(commentReelId)}
          reelId={commentReelId}
          onClose={() => setCommentReelId(null)}
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
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));

    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(heartAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handleTap = () => {
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 300) {
      if (!isLiked) triggerLike();
    } else {
      setPaused((p) => !p);
    }
    lastTapRef.current = now;
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Watch ${reel.user.firstName}'s Lime on Ourlime: https://ourlime.com/limes/${reel.id}`,
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
            <Icon name="play" size={48} color="#ffffff" />
          </View>
        )}

        {/* Animated Pop-out Heart on Double Tap */}
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
          <Icon name="heart" size={100} color="#ef4444" />
        </Animated.View>

        {/* Right Sidebar Controls */}
        <View style={styles.rightSidebar}>
          {/* Mute Button */}
          <TouchableOpacity onPress={onToggleMute} style={styles.actionBtn}>
            <Icon name={muted ? 'volume-x' : 'volume-2'} size={24} color="#ffffff" />
          </TouchableOpacity>

          {/* Like Button */}
          <TouchableOpacity onPress={triggerLike} style={styles.actionBtn}>
            <Icon name="heart" size={28} color={isLiked ? '#ef4444' : '#ffffff'} />
            <Text style={styles.actionCount}>{likeCount}</Text>
          </TouchableOpacity>

          {/* Comment Button */}
          <TouchableOpacity onPress={onCommentPress} style={styles.actionBtn}>
            <Icon name="message-circle" size={28} color="#ffffff" />
            <Text style={styles.actionCount}>{reel.stats?.comments ?? 0}</Text>
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
            <Icon name="send" size={26} color="#ffffff" />
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
    zIndex: 50,
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
    position: 'relative',
    paddingVertical: 4,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  tabDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
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
    top: '45%',
    left: '42%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 40,
    padding: 16,
  },
  heartPop: {
    position: 'absolute',
    top: '40%',
    left: '37%',
    zIndex: 40,
  },
  rightSidebar: {
    position: 'absolute',
    right: 14,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
    zIndex: 40,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 70,
    zIndex: 40,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  creatorName: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  handle: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  followBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  followingBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  followText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  followingText: {
    color: '#cbd5e1',
  },
  caption: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
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
