import { useState, useEffect, useRef } from 'react';
import Reanimated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useIsFocused } from 'expo-router';
import {
  Dimensions,
  ScrollView,
  Text,
  View,
  Pressable,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { usePlaybackInteraction } from '@/lib/hooks/usePlaybackInteraction';
import { PlaybackSeekBar } from '@/components/media/PlaybackSeekBar';
import CachedImage from '@/components/ui/CachedImage';
import { PlayfulFloatingHeart, type PlayfulFloatingHeartRef } from '@/components/ui/PlayfulFloatingHeart';
import { ensureMediaUrl } from '@/lib/helpers/mediaUrl';

type DisplayPostMedia = {
  id?: string;
  type: 'image' | 'video';
  typeUrl: string;
  thumbnailUrl?: string;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  durationSeconds?: number;
};

type ImageAndVideoPostSectionProps = {
  media: DisplayPostMedia[];
  /** True while this post is the one playing in the feed (the most visible post). */
  isParentVisible?: boolean;
  /** True for the playing post and its neighbours: their players load early so the first frame is ready on arrival. */
  shouldLoadVideo?: boolean;
  onLike?: () => void;
};

const MEDIA_WIDTH = Dimensions.get('window').width;

function ImagePostItem({
  url,
  id,
  onLike,
}: {
  url: string;
  id?: string;
  onLike?: () => void;
}) {
  const heartRef = useRef<PlayfulFloatingHeartRef>(null);
  const lastTapRef = useRef<number>(0);

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 320;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      heartRef.current?.trigger();
      onLike?.();
      // A third quick tap starts a new double-tap instead of counting as another one.
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  };

  return (
    <Pressable onPress={handlePress} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <CachedImage
        uri={url}
        style={{ width: '100%', height: '100%' }}
        recyclingKey={id ?? url}
      />
      <PlayfulFloatingHeart ref={heartRef} size={92} />
    </Pressable>
  );
}

function VideoPostItem({
  url,
  isActiveSlide,
  isParentVisible,
  onLike,
  onSeekingChange,
  trimStartSeconds,
  trimEndSeconds,
}: {
  url: string;
  onSeekingChange: (seeking: boolean) => void;
  isActiveSlide: boolean;
  isParentVisible: boolean;
  onLike?: () => void;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
}) {
  const heldRef = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const [isMuted, setIsMuted] = useState(true);
  const [playStateIcon, setPlayStateIcon] = useState<'play' | 'pause'>('pause');
  const playIconOpacity = useSharedValue(0);
  const playIconStyle = useAnimatedStyle(() => ({ opacity: playIconOpacity.value }));
  // Until the first frame is drawn the view stays the same black as the card (no thumbnail, no flash).
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  // A tap to pause holds until the post leaves the screen; coming back plays it again.
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const isPausedByUserRef = useRef(false);
  isPausedByUserRef.current = isPausedByUser;

  // Double tap state tracking
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heartRef = useRef<PlayfulFloatingHeartRef>(null);

  const isInView = isActiveSlide && isParentVisible;
  // Created paused at the first frame (or the trim start); the effect below plays it once it's in view.
  const player = useVideoPlayer(url, (p) => {
    if (Platform.OS === 'android') {
      p.bufferOptions = { preferredForwardBufferDuration: 3, minBufferForPlayback: 0.5, maxBufferBytes: 4 * 1024 * 1024, prioritizeTimeOverSizeThreshold: false };
    }
    p.loop = typeof trimEndSeconds !== 'number';
    p.muted = true;
    // Trimmed posts stop at trimEndSeconds via timeUpdate, which expo-video only emits when an interval is set.
    if (typeof trimEndSeconds === 'number') p.timeUpdateEventInterval = 0.25;
    if (typeof trimStartSeconds === 'number' && trimStartSeconds > 0) {
      p.currentTime = trimStartSeconds;
    }
    p.pause();
  });

  useEffect(() => {
    if (typeof trimEndSeconds !== 'number' || trimEndSeconds <= 0) return;
    const sub = player.addListener('timeUpdate', (event) => {
      const start = trimStartSeconds ?? 0;
      if (event.currentTime >= trimEndSeconds) {
        try {
          player.currentTime = start;
          player.play();
        } catch {
          // ignore
        }
      }
    });
    return () => sub.remove();
  }, [player, trimStartSeconds, trimEndSeconds]);

  const { session, snapshot, refresh, isPlaybackActive } = usePlaybackInteraction(player, isInView);

  useEffect(() => {
    if (!isInView) setIsPausedByUser(false);
  }, [isInView]);

  const toggleMute = () => {
    try {
      player.muted = !player.muted;
      setIsMuted(player.muted);
    } catch {
      // ignore
    }
  };

  // Plays while in view (and not paused by a tap); pauses in place when it scrolls away so it resumes on return.
  const shouldPlay = isPlaybackActive && !isPausedByUser;
  useEffect(() => {
    try {
      if (shouldPlay) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // Ignore calls on released native handles
    }
  }, [shouldPlay, player]);

  // NOTE: Clean up unmount without calling player.pause() directly on native C++ instance to avoid release rejection error
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  const flashPlayStateIcon = (type: 'play' | 'pause') => {
    setPlayStateIcon(type);
    playIconOpacity.value = withSequence(withTiming(1, { duration: 0 }), withDelay(450, withTiming(0, { duration: 250 })));
  };

  const handlePress = () => {
    const now = Date.now();
    if (heldRef.current || session.snapshot().status !== 'idle') return;
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected!
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      heartRef.current?.trigger();
      onLike?.();
      // A third quick tap starts a new double-tap instead of counting as another one.
      lastTapRef.current = 0;
      return;
    } else {
      // Potential single tap: flip what the viewer asked for (not player.playing, which is false while buffering).
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        const nextPaused = !isPausedByUserRef.current;
        isPausedByUserRef.current = nextPaused;
        setIsPausedByUser(nextPaused);
        flashPlayStateIcon(nextPaused ? 'pause' : 'play');
      }, DOUBLE_TAP_DELAY);
    }
    lastTapRef.current = now;
  };

  const handlePressIn = () => {
    if (heldRef.current) return;
    heldRef.current = true;
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    session.beginHold();
    refresh();
  };
  const handlePressOut = () => { session.endHold(); refresh(); };

  return (
    <View style={{ width: '100%', height: '100%', backgroundColor: '#000000', position: 'relative' }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        nativeControls={false}
        surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
        onFirstFrameRender={() => setHasFirstFrame(true)}
      />
      {!hasFirstFrame ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }}>
          {isInView ? <ActivityIndicator color="rgba(255,255,255,0.7)" /> : null}
        </View>
      ) : null}

      {/* Main Touch Overlay for Single Tap, Double Tap, and Long Press 2x */}
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 44 }}
        onPress={handlePress}
        onLongPress={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={300}
        onTouchStart={(event) => {
          heldRef.current = false;
          touchStartRef.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        }}
        onTouchMove={(event) => {
          if (Math.hypot(event.nativeEvent.pageX - touchStartRef.current.x, event.nativeEvent.pageY - touchStartRef.current.y) > 10) {
            heldRef.current = true;
            session.endHold();
            refresh();
          }
        }}
      >
        {/* Floating 2x Speed Indicator Overlay */}
        {snapshot.holding && (
          <View style={{
            position: 'absolute',
            top: 14,
            alignSelf: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }}>
            <Ionicons name="play-forward" size={14} color="#10b981" />
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
              2x Speed
            </Text>
          </View>
        )}

        {/* Floating Heart Overlay on Double Tap */}
        <PlayfulFloatingHeart ref={heartRef} size={96} />

        {/* Play/Pause badge after a single tap, showing what the tap did */}
        <Reanimated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: '40%',
              alignSelf: 'center',
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              justifyContent: 'center',
              alignItems: 'center',
            },
            playIconStyle,
          ]}
        >
          <Ionicons name={playStateIcon} size={28} color="#ffffff" />
        </Reanimated.View>
      </Pressable>

      {/* Floating Mute / Unmute Button */}
      <TouchableOpacity
        onPress={toggleMute}
        accessibilityRole="button"
        accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
        style={{
          position: 'absolute',
          right: 12,
          bottom: 52,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          elevation: 20,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
        }}
        activeOpacity={0.8}
      >
        <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={18} color="#ffffff" />
      </TouchableOpacity>

      <PlaybackSeekBar session={session} snapshot={snapshot} onChange={refresh} onSeekingChange={(seeking) => {
        if (seeking) {
          if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
          lastTapRef.current = 0;
        }
        onSeekingChange(seeking);
      }} />
    </View>
  );
}

export default function ImageAndVideoPostSection({
  media,
  isParentVisible = false,
  shouldLoadVideo = true,
  onLike,
}: ImageAndVideoPostSectionProps) {
  const isScreenFocused = useIsFocused();
  const [activeIndex, setActiveIndex] = useState(0);
  const [mediaWidth, setMediaWidth] = useState(MEDIA_WIDTH);
  const [seeking, setSeeking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / mediaWidth));
  };

  const handlePrevSlide = () => {
    if (activeIndex > 0) {
      const nextIndex = activeIndex - 1;
      scrollRef.current?.scrollTo({ x: nextIndex * mediaWidth, animated: true });
      setActiveIndex(nextIndex);
    }
  };

  const handleNextSlide = () => {
    if (activeIndex < media.length - 1) {
      const nextIndex = activeIndex + 1;
      scrollRef.current?.scrollTo({ x: nextIndex * mediaWidth, animated: true });
      setActiveIndex(nextIndex);
    }
  };

  return (
    <View onLayout={(event) => setMediaWidth(event.nativeEvent.layout.width)} style={{ borderRadius: 0, overflow: 'hidden', backgroundColor: '#111827', position: 'relative' }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        scrollEnabled={!seeking}
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {media.map((item, index) => (
          <View
            key={item.id ?? `${item.typeUrl}-${index}`}
            style={{ width: mediaWidth, height: 330, backgroundColor: '#111827' }}
          >
            {item.type === 'video' && shouldLoadVideo && index === activeIndex ? (
              <VideoPostItem
                key={item.typeUrl}
                url={ensureMediaUrl(item.typeUrl)}
                isActiveSlide={index === activeIndex}
                isParentVisible={Boolean(isParentVisible) && isScreenFocused}
                onLike={onLike}
                onSeekingChange={setSeeking}
                trimStartSeconds={item.trimStartSeconds}
                trimEndSeconds={item.trimEndSeconds}
              />
            ) : item.type === 'video' ? (
              // Not loaded yet (far from view): plain black, so the video appears from its first frame, not a cover.
              <View style={{ flex: 1, backgroundColor: '#000000' }} />
            ) : item.type === 'image' ? (
              <ImagePostItem
                url={item.typeUrl}
                id={item.id}
                onLike={onLike}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>

      {/* Left Arrow Button */}
      {media.length > 1 && activeIndex > 0 ? (
        <TouchableOpacity
          onPress={handlePrevSlide}
          style={{
            position: 'absolute',
            left: 10,
            top: '46%',
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30,
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={20} color="#ffffff" />
        </TouchableOpacity>
      ) : null}

      {/* Right Arrow Button */}
      {media.length > 1 && activeIndex < media.length - 1 ? (
        <TouchableOpacity
          onPress={handleNextSlide}
          style={{
            position: 'absolute',
            right: 10,
            top: '46%',
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30,
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-forward" size={20} color="#ffffff" />
        </TouchableOpacity>
      ) : null}

      {media.length > 1 ? (
        <View style={{
          position: 'absolute',
          right: 10,
          top: 10,
          paddingHorizontal: 9,
          paddingVertical: 5,
          borderRadius: 12,
          backgroundColor: '#111827b3',
          zIndex: 30,
        }}>
          <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
            {activeIndex + 1}/{media.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
