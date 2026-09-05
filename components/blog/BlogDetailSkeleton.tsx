import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export default function BlogDetailSkeleton() {
  const { colors, isDark } = useAppTheme();
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.75,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const blockColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const baseShimmer = [styles.shimmerBlock, { backgroundColor: blockColor, opacity: pulseAnim }];

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* Cover Image Placeholder */}
      <Animated.View style={[styles.coverSkeleton, baseShimmer]} />

      <View style={styles.contentPadding}>
        {/* Category & Read Time Row */}
        <View style={styles.metaRow}>
          <Animated.View style={[styles.categoryBadge, baseShimmer]} />
          <Animated.View style={[styles.readTimeBadge, baseShimmer]} />
        </View>

        {/* Title Lines */}
        <Animated.View style={[styles.titleLine1, baseShimmer]} />
        <Animated.View style={[styles.titleLine2, baseShimmer]} />

        {/* Author Pill */}
        <View style={[styles.authorRow, { borderBottomColor: colors.border }]}>
          <Animated.View style={[styles.authorAvatar, baseShimmer]} />
          <View style={styles.authorTextCol}>
            <Animated.View style={[styles.authorName, baseShimmer]} />
            <Animated.View style={[styles.authorSub, baseShimmer]} />
          </View>
        </View>

        {/* Content Paragraph 1 */}
        <View style={styles.paragraphBlock}>
          <Animated.View style={[styles.textLineFull, baseShimmer]} />
          <Animated.View style={[styles.textLine90, baseShimmer]} />
          <Animated.View style={[styles.textLine95, baseShimmer]} />
          <Animated.View style={[styles.textLine70, baseShimmer]} />
        </View>

        {/* Subheading placeholder */}
        <Animated.View style={[styles.subheading, baseShimmer]} />

        {/* Content Paragraph 2 */}
        <View style={styles.paragraphBlock}>
          <Animated.View style={[styles.textLineFull, baseShimmer]} />
          <Animated.View style={[styles.textLine95, baseShimmer]} />
          <Animated.View style={[styles.textLine80, baseShimmer]} />
          <Animated.View style={[styles.textLine50, baseShimmer]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  shimmerBlock: {
    borderRadius: 8,
  },
  coverSkeleton: {
    width: '100%',
    height: 220,
    borderRadius: 0,
  },
  contentPadding: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  categoryBadge: {
    width: 84,
    height: 24,
    borderRadius: 12,
  },
  readTimeBadge: {
    width: 60,
    height: 20,
    borderRadius: 10,
  },
  titleLine1: {
    width: '92%',
    height: 26,
    borderRadius: 6,
    marginBottom: 8,
  },
  titleLine2: {
    width: '68%',
    height: 26,
    borderRadius: 6,
    marginBottom: 18,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  authorTextCol: {
    gap: 6,
    flex: 1,
  },
  authorName: {
    width: 120,
    height: 14,
    borderRadius: 4,
  },
  authorSub: {
    width: 80,
    height: 11,
    borderRadius: 4,
  },
  paragraphBlock: {
    gap: 10,
    marginBottom: 22,
  },
  textLineFull: {
    width: '100%',
    height: 15,
  },
  textLine95: {
    width: '95%',
    height: 15,
  },
  textLine90: {
    width: '90%',
    height: 15,
  },
  textLine80: {
    width: '80%',
    height: 15,
  },
  textLine70: {
    width: '70%',
    height: 15,
  },
  textLine50: {
    width: '50%',
    height: 15,
  },
  subheading: {
    width: '55%',
    height: 20,
    borderRadius: 5,
    marginBottom: 14,
    marginTop: 4,
  },
});
