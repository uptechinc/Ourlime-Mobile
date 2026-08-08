import { useState, useEffect, useRef } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  Text,
  View,
  Pressable,
  Animated,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type DisplayPostMedia = {
  id?: string;
  type: 'image' | 'video';
  typeUrl: string;
};

type ImageAndVideoPostSectionProps = {
  media: DisplayPostMedia[];
  /** True only when the parent post card is at least 40% visible in the viewport */
  isParentVisible?: boolean;
  onLike?: () => void;
};

const MEDIA_WIDTH = Dimensions.get('window').width - 72;

function VideoPostItem({
  url,
  isActiveSlide,
  isParentVisible,
  onLike,
}: {
  url: string;
  isActiveSlide: boolean;
  isParentVisible: boolean;
  onLike?: () => void;
}) {
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showPlayStateIcon, setShowPlayStateIcon] = useState<'play' | 'pause' | null>(null);
  const playIconOpacity = useRef(new Animated.Value(0)).current;

  // Double tap state tracking
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced Heart animation for double tap like
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const heartTranslateY = useRef(new Animated.Value(0)).current;

  // Track progress position
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(1);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPercent, setSeekPercent] = useState(0);

  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.pause();
  });

  const toggleMute = () => {
    try {
      player.muted = !player.muted;
      setIsMuted(player.muted);
    } catch {
      // ignore
    }
  };

  // Track progress position smoothly while playing
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        if (player && !isSeeking) {
          setCurrentTime(player.currentTime || 0);
          if (player.duration > 0) setDuration(player.duration);
        }
      } catch {
        // ignore
      }
    }, 200);
    return () => clearInterval(interval);
  }, [player, isSeeking]);

  const progressPercent = isSeeking ? seekPercent : Math.min(100, Math.max(0, (currentTime / duration) * 100));

  // Autoplay / pause on viewport visibility change
  useEffect(() => {
    const shouldPlay = isActiveSlide && isParentVisible;
    try {
      if (shouldPlay) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // Ignore calls on released native handles
    }
  }, [isActiveSlide, isParentVisible, player]);

  // NOTE: Clean up unmount without calling player.pause() directly on native C++ instance to avoid release rejection error
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  const triggerHeartAnim = () => {
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
  };

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
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected!
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      triggerHeartAnim();
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
    try {
      player.playbackRate = 2.0;
      setIsFastForwarding(true);
    } catch {
      // ignore
    }
  };

  const handlePressOut = () => {
    try {
      player.playbackRate = 1.0;
      setIsFastForwarding(false);
    } catch {
      // ignore
    }
  };

  // Drag scrubber seeking with PanResponder
  const progressPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsSeeking(true);
        updateSeekRatio(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateSeekRatio(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: (evt) => {
        const ratio = updateSeekRatio(evt.nativeEvent.locationX);
        if (duration > 0) {
          try {
            player.currentTime = ratio * duration;
            setCurrentTime(ratio * duration);
          } catch {
            // ignore
          }
        }
        setIsSeeking(false);
      },
      onPanResponderTerminate: () => {
        setIsSeeking(false);
      },
    })
  ).current;

  const updateSeekRatio = (x: number): number => {
    const ratio = Math.max(0, Math.min(1, x / MEDIA_WIDTH));
    setSeekPercent(ratio * 100);
    return ratio;
  };

  return (
    <View style={{ width: '100%', height: '100%', backgroundColor: '#000000', position: 'relative' }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        nativeControls={false}
      />

      {/* Main Touch Overlay for Single Tap, Double Tap, and Long Press 2x */}
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 20 }}
        onPress={handlePress}
        onLongPress={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={250}
      >
        {/* Floating 2x Speed Indicator Overlay */}
        {isFastForwarding && (
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
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '32%',
            left: '37%',
            opacity: heartOpacity,
            transform: [
              { scale: heartScale },
              { translateY: heartTranslateY },
            ],
          }}
        >
          <Ionicons name="heart" size={88} color="#ef4444" />
        </Animated.View>

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

      {/* Instagram-Style Touch Progress Bar Scrubber */}
      <View
        {...progressPanResponder.panHandlers}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 22,
          justifyContent: 'center',
          zIndex: 20,
          paddingHorizontal: 0,
        }}
      >
        {/* Track Background */}
        <View style={{ height: 4, width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.35)', position: 'relative' }}>
          {/* Progress Fill */}
          <View
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#10b981',
            }}
          />
          {/* Draggable Thumb Indicator Dot */}
          <View
            style={{
              position: 'absolute',
              top: -4,
              left: `${Math.max(0, Math.min(97, progressPercent))}%`,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: '#ffffff',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.3,
              shadowRadius: 2,
              elevation: 3,
            }}
          />
        </View>
      </View>
    </View>
  );
}

export default function ImageAndVideoPostSection({
  media,
  isParentVisible = false,
  onLike,
}: ImageAndVideoPostSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / MEDIA_WIDTH));
  };

  return (
    <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#111827' }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {media.map((item, index) => (
          <View
            key={item.id ?? `${item.typeUrl}-${index}`}
            style={{ width: MEDIA_WIDTH, height: 330, backgroundColor: '#111827' }}
          >
            {item.type === 'video' ? (
              <VideoPostItem
                url={item.typeUrl}
                isActiveSlide={index === activeIndex}
                isParentVisible={isParentVisible}
                onLike={onLike}
              />
            ) : (
              <Image
                source={{ uri: item.typeUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            )}
          </View>
        ))}
      </ScrollView>
      {media.length > 1 ? (
        <View style={{
          position: 'absolute',
          right: 10,
          top: 10,
          paddingHorizontal: 9,
          paddingVertical: 5,
          borderRadius: 12,
          backgroundColor: '#111827b3',
        }}>
          <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
            {activeIndex + 1}/{media.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
