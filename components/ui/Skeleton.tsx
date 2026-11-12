import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps): ReactNode {
  const { isDark } = useAppTheme();
  const opacity = useSharedValue(isDark ? 0.25 : 0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(isDark ? 0.65 : 0.9, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(isDark ? 0.25 : 0.45, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [isDark, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const baseColor = isDark ? '#334155' : '#e2e8f0';

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: baseColor },
        animatedStyle,
        style,
      ]}
    />
  );
}

export const SkeletonBox = Skeleton;

export function SkeletonCircle({ size = 40, style }: { size?: number; style?: StyleProp<ViewStyle> }): ReactNode {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
}

export type SkeletonTextProps = {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  lastLineWidth?: number | `${number}%`;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonText({
  lines,
  lineHeight = 12,
  gap = 8,
  lastLineWidth = '60%',
  width,
  height,
  borderRadius,
  style,
}: SkeletonTextProps): ReactNode {
  if (width !== undefined || height !== undefined || lines === 1) {
    return (
      <Skeleton
        width={width ?? '100%'}
        height={height ?? lineHeight}
        borderRadius={borderRadius ?? 4}
        style={style}
      />
    );
  }

  const lineCount = lines ?? 3;
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lineCount }).map((_, index) => (
        <Skeleton
          key={index}
          height={height ?? lineHeight}
          width={index === lineCount - 1 ? lastLineWidth : '100%'}
          borderRadius={borderRadius ?? (lineHeight / 2)}
        />
      ))}
    </View>
  );
}

/** Skeletons matching exact page layouts */

export function ProjectManagementSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={[styles.heroBox, { backgroundColor: colors.surface }]}>
        <SkeletonCircle size={36} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="90%" height={12} />
        </View>
      </View>

      {/* Section */}
      <Skeleton width="50%" height={18} style={{ marginTop: 8 }} />

      {/* Project Cards */}
      {[1, 2, 3].map((item) => (
        <View key={item} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <Skeleton width="60%" height={17} />
            <Skeleton width={60} height={20} borderRadius={10} />
          </View>
          <SkeletonText lines={2} lineHeight={12} />
          <View style={[styles.rowBetween, { marginTop: 4 }]}>
            <Skeleton width="35%" height={11} />
            <Skeleton width="25%" height={11} />
          </View>
          <Skeleton height={8} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

export function JobDetailSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
        <SkeletonCircle size={56} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 12 }]}>
        <Skeleton width="85%" height={22} />
        <View style={styles.rowGap}>
          <Skeleton width={80} height={26} borderRadius={13} />
          <Skeleton width={90} height={26} borderRadius={13} />
          <Skeleton width={70} height={26} borderRadius={13} />
        </View>
        <SkeletonText lines={4} lineHeight={14} />
      </View>
      <Skeleton height={48} borderRadius={14} />
    </View>
  );
}

export function ChatConversationSkeleton(): ReactNode {
  return (
    <View style={{ flex: 1, padding: 16, gap: 14 }}>
      {/* Incoming */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-start', maxWidth: '80%' }}>
        <SkeletonCircle size={32} />
        <Skeleton width={200} height={52} borderRadius={18} />
      </View>
      {/* Outgoing */}
      <View style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
        <Skeleton width={160} height={42} borderRadius={18} style={{ backgroundColor: '#10b98133' }} />
      </View>
      {/* Incoming */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-start', maxWidth: '80%' }}>
        <SkeletonCircle size={32} />
        <Skeleton width={230} height={70} borderRadius={18} />
      </View>
      {/* Outgoing */}
      <View style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
        <Skeleton width={120} height={38} borderRadius={18} style={{ backgroundColor: '#10b98133' }} />
      </View>
      {/* Incoming */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-start', maxWidth: '80%' }}>
        <SkeletonCircle size={32} />
        <Skeleton width={170} height={48} borderRadius={18} />
      </View>
    </View>
  );
}

export function JobManagementSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container}>
      {/* Selected Job Card Skeleton */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.rowBetween}>
          <Skeleton width="65%" height={20} />
          <SkeletonCircle size={28} />
        </View>
        <Skeleton width="45%" height={12} />
        <View style={styles.rowGap}>
          <Skeleton width={60} height={28} borderRadius={14} />
          <Skeleton width={60} height={28} borderRadius={14} />
          <Skeleton width={60} height={28} borderRadius={14} />
        </View>
      </View>

      {/* Search Input Skeleton */}
      <Skeleton height={46} borderRadius={14} />

      {/* Filter Chips */}
      <View style={styles.rowGap}>
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} width={75} height={32} borderRadius={16} />
        ))}
      </View>

      {/* Applicant Cards */}
      {[1, 2, 3].map((item) => (
        <View key={item} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.rowGap}>
            <SkeletonCircle size={44} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="55%" height={16} />
              <Skeleton width="40%" height={12} />
            </View>
            <Skeleton width={70} height={24} borderRadius={12} />
          </View>
          <SkeletonText lines={2} lineHeight={12} />
          <View style={styles.rowBetween}>
            <Skeleton width="30%" height={11} />
            <View style={styles.rowGap}>
              <Skeleton width={70} height={30} borderRadius={10} />
              <Skeleton width={70} height={30} borderRadius={10} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ApplicationsSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container}>
      {[1, 2, 3].map((item) => (
        <View key={item} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="70%" height={18} />
              <Skeleton width="45%" height={12} />
            </View>
            <Skeleton width={80} height={26} borderRadius={13} />
          </View>
          <Skeleton width="35%" height={11} />
          <SkeletonText lines={2} lineHeight={12} />
          <View style={[styles.rowBetween, { marginTop: 4 }]}>
            <Skeleton width="40%" height={12} />
            <Skeleton width={90} height={32} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ProjectBoardSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      {/* Project Overview Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 12 }]}>
        <View style={styles.rowBetween}>
          <Skeleton width="60%" height={22} />
          <Skeleton width={70} height={24} borderRadius={12} />
        </View>
        <SkeletonText lines={2} lineHeight={12} />
        <View style={styles.rowBetween}>
          {/* Member Avatars */}
          <View style={{ flexDirection: 'row', gap: -8 }}>
            <SkeletonCircle size={32} />
            <SkeletonCircle size={32} />
            <SkeletonCircle size={32} />
          </View>
          <Skeleton width={100} height={32} borderRadius={16} />
        </View>
      </View>

      {/* Filter / Search Bar */}
      <View style={styles.rowGap}>
        <Skeleton height={40} borderRadius={12} style={{ flex: 1 }} />
        <Skeleton width={40} height={40} borderRadius={12} />
      </View>

      {/* Board Columns */}
      <View style={styles.rowGap}>
        <Skeleton width={80} height={32} borderRadius={16} />
        <Skeleton width={80} height={32} borderRadius={16} />
        <Skeleton width={80} height={32} borderRadius={16} />
      </View>

      {/* Task Cards */}
      {[1, 2, 3].map((item) => (
        <View key={item} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 10 }]}>
          <View style={styles.rowBetween}>
            <Skeleton width="65%" height={16} />
            <Skeleton width={55} height={20} borderRadius={10} />
          </View>
          <SkeletonText lines={2} lineHeight={12} />
          <View style={styles.rowBetween}>
            <Skeleton width="30%" height={11} />
            <SkeletonCircle size={24} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SettingsSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, padding: 20, gap: 20 }}>
      {/* Profile card */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border }}>
        <SkeletonCircle size={60} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>

      {/* Tab row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[90, 110, 80, 100, 80].map((w, i) => (
          <Skeleton key={i} width={w} height={34} borderRadius={17} />
        ))}
      </View>

      {/* Setting rows */}
      {[1, 2, 3, 4].map((item) => (
        <View key={item} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
          <Skeleton width="45%" height={14} />
          <Skeleton height={42} borderRadius={12} />
        </View>
      ))}

      {/* Save button */}
      <Skeleton height={48} borderRadius={14} />
    </View>
  );
}

export function TicketListSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 12, paddingTop: 12 }}>
      {[1, 2, 3, 4].map((item) => (
        <View key={item} style={{ backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: 15, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width="55%" height={16} />
            <Skeleton width={70} height={22} borderRadius={11} />
          </View>
          <Skeleton width="35%" height={11} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton width={80} height={24} borderRadius={12} />
            <Skeleton width={80} height={24} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function AdminOverviewSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      {/* Metrics Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[1, 2, 3, 4].map((item) => (
          <View key={item} style={{ width: '47%', backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
            <SkeletonCircle size={28} />
            <Skeleton width="60%" height={22} />
            <Skeleton width="40%" height={11} />
          </View>
        ))}
      </View>

      {/* Section label */}
      <Skeleton width="50%" height={18} />

      {/* Action cards */}
      {[1, 2, 3].map((item) => (
        <View key={item} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
          <SkeletonCircle size={40} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="50%" height={16} />
            <Skeleton width="75%" height={11} />
          </View>
          <Skeleton width={24} height={24} borderRadius={12} />
        </View>
      ))}
    </View>
  );
}

export function ChildSafetyListSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 10, paddingTop: 8 }}>
      {[1, 2, 3, 4].map((item) => (
        <View key={item} style={{ backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: 15, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 5 }}>
              <Skeleton width="70%" height={15} />
              <Skeleton width="45%" height={11} />
            </View>
            <Skeleton width={65} height={24} borderRadius={12} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton width={85} height={22} borderRadius={11} />
            <Skeleton width={70} height={22} borderRadius={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  heroBox: {
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  courseCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blogCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
