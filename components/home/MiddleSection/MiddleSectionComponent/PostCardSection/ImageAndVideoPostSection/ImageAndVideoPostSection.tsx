import { useState, useEffect, useRef } from 'react';
import {
  Dimensions,
  ScrollView,
  Text,
  View,
  Pressable,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { usePlaybackInteraction } from '@/lib/hooks/usePlaybackInteraction';
import { PlaybackSeekBar } from '@/components/media/PlaybackSeekBar';
import CachedImage from '@/components/ui/CachedImage';
import { PlayfulFloatingHeart, type PlayfulFloatingHeartRef } from '@/components/ui/PlayfulFloatingHeart';

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
  /** True only when the parent post card is at least 40% visible in the viewport */
  isParentVisible?: boolean;
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
  thumbnailUrl,
  isActiveSlide,
  isParentVisible,
  onLike,
  onSeekingChange,
  trimStartSeconds,
  trimEndSeconds,
}: {
  url: string;
  thumbnailUrl?: string;
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
  const [showPlayStateIcon, setShowPlayStateIcon] = useState<'play' | 'pause' | null>(null);
  const playIconOpacity = useRef(new Animated.Value(0)).current;
  const posterOpacity = useRef(new Animated.Value(1)).current;
  const [isReady, setIsReady] = useState(false);

  // Double tap state tracking
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heartRef = useRef<PlayfulFloatingHeartRef>(null);

  const shouldAutoplay = isActiveSlide && isParentVisible;
  const player = useVideoPlayer(url, (p) => {
    p.loop = typeof trimEndSeconds !== 'number';
    p.muted = true;
    if (typeof trimStartSeconds === 'number' && trimStartSeconds > 0) {
      p.currentTime = trimStartSeconds;
    }
    if (shouldAutoplay) {
      p.play();
    } else {
      p.pause();
    }
  });

  useEffect(() => {
    if (typeof trimStartSeconds === 'number' && trimStartSeconds > 0) {
      try {
        player.currentTime = trimStartSeconds;
      } catch {
        // ignore
      }
    }
  }, [player, trimStartSeconds]);

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

  const { session, snapshot, refresh, isPlaybackActive } = usePlaybackInteraction(player, shouldAutoplay);

  const toggleMute = () => {
    try {
      player.muted = !player.muted;
      setIsMuted(player.muted);
    } catch {
      // ignore
    }
  };

  // Autoplay / pause on viewport visibility change
  useEffect(() => {
    const shouldPlay = isPlaybackActive;
    try {
      if (shouldPlay) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // Ignore calls on released native handles
    }
  }, [isPlaybackActive, player]);

  // Track player readiness to smoothly fade poster thumbnail without flickering
  useEffect(() => {
    const statusSub = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setIsReady(true);
      }
    });
    const playingSub = player.addListener('playingChange', (event) => {
      if (event.isPlaying) {
        setIsReady(true);
      }
    });
    return () => {
      statusSub.remove();
      playingSub.remove();
    };
  }, [player]);

  useEffect(() => {
    if (isReady) {
      Animated.timing(posterOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isReady, posterOpacity]);

  // NOTE: Clean up unmount without calling player.pause() directly on native C++ instance to avoid release rejection error
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, [isActiveSlide, isParentVisible]);

  const triggerPlayIconAnim = (type: 'play' | 'pause') => {
    setShowPlayStateIcon(type);
    playIconOpacity.setValue(1);
    Animated.sequence([
      Animated.delay(450),
      Animated.timing(playIconOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowPlayStateIcon(null);
    });
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
    } else {
      // Potential single tap
      singleTapTimerRef.current = setTimeout(() => {
        try {
          if (player.playing) {
            player.pause();
            triggerPlayIconAnim('pause');
          } else {
            player.play();
            triggerPlayIconAnim('play');
          }
        } catch {
          // ignore
        }
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
      />

      {thumbnailUrl ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: posterOpacity,
            backgroundColor: '#000000',
          }}
        >
          <CachedImage
            uri={thumbnailUrl}
            style={{ width: '100%', height: '100%' }}
            recyclingKey={thumbnailUrl}
          />
        </Animated.View>
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

        {/* Floating Play/Pause Indicator on Single Tap */}
        {showPlayStateIcon && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '40%',
              alignSelf: 'center',
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: playIconOpacity,
            }}
          >
            <Ionicons
              name={showPlayStateIcon === 'play' ? 'play' : 'pause'}
              size={28}
              color="#ffffff"
            />
          </Animated.View>
        )}
      </Pressable>

      {/* Floating Mute / Unmute Button */}
      <TouchableOpacity
        onPress={toggleMute}
        style={{
          position: 'absolute',
          right: 12,
          bottom: 28,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
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
  onLike,
}: ImageAndVideoPostSectionProps) {
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
            {item.type === 'video' && index === activeIndex && isParentVisible ? (
              <VideoPostItem
                key={item.typeUrl}
                url={item.typeUrl}
                thumbnailUrl={item.thumbnailUrl}
                isActiveSlide={index === activeIndex}
                isParentVisible={isParentVisible}
                onLike={onLike}
                onSeekingChange={setSeeking}
                trimStartSeconds={item.trimStartSeconds}
                trimEndSeconds={item.trimEndSeconds}
              />
            ) : item.type === 'video' ? (
              <View style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000000' }}>
                {item.thumbnailUrl ? (
                  <CachedImage
                    uri={item.thumbnailUrl}
                    style={{ width: '100%', height: '100%' }}
                    recyclingKey={item.thumbnailUrl}
                  />
                ) : null}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: item.thumbnailUrl ? 'rgba(0, 0, 0, 0.25)' : '#111827',
                  }}
                >
                  <Ionicons name="play-circle-outline" size={54} color="#ffffff" />
                </View>
              </View>
            ) : item.type === 'image' ? (
              <ImagePostItem
                url={item.typeUrl}
                id={item.id}
                onLike={onLike}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' }}>
                <Ionicons name="play-circle-outline" size={54} color="#d1d5db" />
              </View>
            )}
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
