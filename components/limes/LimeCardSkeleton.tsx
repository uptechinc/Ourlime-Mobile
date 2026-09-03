import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_GAP = 8;
const HORIZONTAL_PADDING = 12;
const NUM_COLUMNS = 2;
export const SKELETON_CARD_WIDTH =
  (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - COLUMN_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
export const SKELETON_CARD_HEIGHT = SKELETON_CARD_WIDTH * (16 / 9);

type LimeCardSkeletonProps = {
  width?: number;
  height?: number;
};

export function LimeCardSkeleton({
  width = SKELETON_CARD_WIDTH,
  height = SKELETON_CARD_HEIGHT,
}: LimeCardSkeletonProps) {
  const { isDark, colors } = useAppTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 1.5, width * 1.5],
  });

  const cardBackground = isDark ? '#0f172a' : '#f1f5f9';
  const shimmerColors: [string, string, string, string, string] = isDark
    ? [
        'rgba(255, 255, 255, 0)',
        'rgba(255, 255, 255, 0.03)',
        'rgba(16, 185, 129, 0.16)',
        'rgba(255, 255, 255, 0.03)',
        'rgba(255, 255, 255, 0)',
      ]
    : [
        'rgba(255, 255, 255, 0)',
        'rgba(255, 255, 255, 0.4)',
        'rgba(16, 185, 129, 0.25)',
        'rgba(255, 255, 255, 0.4)',
        'rgba(255, 255, 255, 0)',
      ];

  const placeholderElementColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <View
      style={[
        styles.cardContainer,
        {
          width,
          height,
          backgroundColor: cardBackground,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
        },
      ]}
    >
      {/* Center Subtle Ourlime Logo Glyph */}
      <View style={styles.centerIconContainer}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.centerLogo}
          resizeMode="contain"
        />
      </View>

      {/* Top Tag Placeholder */}
      <View style={styles.topBadgeRow}>
        <View style={[styles.topBadge, { backgroundColor: placeholderElementColor }]} />
      </View>

      {/* Bottom Information Overlay */}
      <View style={styles.bottomOverlay}>
        {/* Creator Row Placeholder */}
        <View style={styles.userRow}>
          <View style={[styles.avatarCircle, { backgroundColor: placeholderElementColor }]} />
          <View style={[styles.nameBar, { backgroundColor: placeholderElementColor }]} />
        </View>

        {/* Caption Bar */}
        <View style={[styles.captionBar, { backgroundColor: placeholderElementColor }]} />

        {/* Stats Row Placeholder */}
        <View style={styles.statsRow}>
          <View style={[styles.statPill, { backgroundColor: placeholderElementColor }]} />
          <View style={[styles.statPill, { backgroundColor: placeholderElementColor }]} />
        </View>
      </View>

      {/* Sweeping Shimmer Glow Beam */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX }],
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={shimmerColors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function LimeGridSkeleton({ count = 4 }: { count?: number }) {
  const placeholders = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={styles.gridContainer}>
      <View style={styles.gridRow}>
        {placeholders.map((key) => (
          <LimeCardSkeleton key={key} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 12,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COLUMN_GAP,
  },
  cardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: COLUMN_GAP,
    position: 'relative',
    justifyContent: 'space-between',
  },
  centerIconContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLogo: {
    width: 44,
    height: 44,
    opacity: 0.18,
  },
  topBadgeRow: {
    padding: 10,
    flexDirection: 'row',
  },
  topBadge: {
    width: 48,
    height: 18,
    borderRadius: 9,
  },
  bottomOverlay: {
    padding: 10,
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  nameBar: {
    width: 60,
    height: 10,
    borderRadius: 5,
  },
  captionBar: {
    width: '85%',
    height: 8,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  statPill: {
    width: 32,
    height: 12,
    borderRadius: 6,
  },
});
