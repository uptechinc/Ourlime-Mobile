import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { PATTERN_STICKERS } from '@/assets/images/stickers/patternStickers';

/** Position and motion of one sticker, advanced on the UI thread every frame. */
type StickerMotion = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  spin: number;
  size: number;
};

type FloatingStickerProps = {
  index: number;
  source: ImageSourcePropType;
  motions: SharedValue<StickerMotion[]>;
};

const STICKER_COUNT = 36;
const BACKGROUND_COLOR = '#0b141a';

/** Small deterministic pseudo-random number so the starting layout is scattered but stable between renders. */
function seededRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function createMotions(width: number, height: number): StickerMotion[] {
  return Array.from({ length: STICKER_COUNT }, (_, index) => {
    const size = 30 + Math.round(seededRandom(index + 1) * 14);
    const speed = 18 + seededRandom(index + 11) * 30;
    const direction = seededRandom(index + 21) * Math.PI * 2;
    return {
      x: seededRandom(index + 31) * Math.max(1, width - size),
      y: seededRandom(index + 41) * Math.max(1, height - size),
      velocityX: Math.cos(direction) * speed,
      velocityY: Math.sin(direction) * speed,
      rotation: (seededRandom(index + 51) - 0.5) * 60,
      spin: (seededRandom(index + 61) - 0.5) * 24,
      size,
    };
  });
}

const FloatingSticker = memo(function FloatingSticker({ index, source, motions }: FloatingStickerProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const motion = motions.value[index];
    return {
      width: motion.size,
      height: motion.size,
      transform: [{ translateX: motion.x }, { translateY: motion.y }, { rotate: `${motion.rotation}deg` }],
    };
  });
  return <Animated.Image source={source} resizeMode="contain" fadeDuration={0} style={[styles.sticker, animatedStyle]} />;
});

/**
 * WhatsApp-style call wallpaper: the chat sticker set, small and faded, floating around the dark background and
 * bouncing off the screen edges. Uses the transparent copies from assets/images/stickers/pattern (the originals have
 * solid backgrounds that show as squares). Shown behind voice calls and whenever no camera picture is on screen.
 */
function CallPatternBackground() {
  const { width, height } = useWindowDimensions();
  const motions = useSharedValue<StickerMotion[]>(createMotions(width, height));
  const bounds = useSharedValue({ width, height });
  useEffect(() => {
    bounds.value = { width, height };
  }, [bounds, height, width]);

  useFrameCallback((frame) => {
    // Clamp the step so a paused/backgrounded screen doesn't teleport stickers when it resumes.
    const seconds = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const { width: maxWidth, height: maxHeight } = bounds.value;
    motions.modify((list) => {
      'worklet';
      for (const motion of list) {
        motion.x += motion.velocityX * seconds;
        motion.y += motion.velocityY * seconds;
        motion.rotation += motion.spin * seconds;
        // Bounce off each edge, reversing direction and giving the spin a little kick.
        if (motion.x < 0) { motion.x = 0; motion.velocityX = Math.abs(motion.velocityX); motion.spin = -motion.spin; }
        if (motion.x > maxWidth - motion.size) { motion.x = maxWidth - motion.size; motion.velocityX = -Math.abs(motion.velocityX); motion.spin = -motion.spin; }
        if (motion.y < 0) { motion.y = 0; motion.velocityY = Math.abs(motion.velocityY); motion.spin = -motion.spin; }
        if (motion.y > maxHeight - motion.size) { motion.y = maxHeight - motion.size; motion.velocityY = -Math.abs(motion.velocityY); motion.spin = -motion.spin; }
      }
      return list;
    });
  });

  const sources = useMemo(
    () => Array.from({ length: STICKER_COUNT }, (_, index) => PATTERN_STICKERS[index % Math.max(1, PATTERN_STICKERS.length)]),
    [],
  );

  return (
    <View pointerEvents="none" style={styles.container}>
      {PATTERN_STICKERS.length > 0
        ? sources.map((source, index) => <FloatingSticker key={index} index={index} source={source} motions={motions} />)
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: BACKGROUND_COLOR, overflow: 'hidden' },
  sticker: { position: 'absolute', left: 0, top: 0, opacity: 0.22 },
});

export default memo(CallPatternBackground);
