import type { ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/* Same grid maths as the profile Limes / Reposts tabs. */
const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_GAP = 8;
const HORIZONTAL_PADDING = 12;
const NUM_COLUMNS = 2;
export const SKELETON_CARD_WIDTH =
  (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - COLUMN_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
export const SKELETON_CARD_HEIGHT = SKELETON_CARD_WIDTH * (16 / 9);

/** Bars drawn on the card's dark caption overlay. */
const OVERLAY_BAR_COLOR = 'rgba(255, 255, 255, 0.35)';

type LimeCardSkeletonProps = {
  width?: number;
  height?: number;
  /** Reposted Limes show a "Repost" badge in the top-left corner. */
  showRepostBadge?: boolean;
};

/** One Lime thumbnail card: rounded 14 surface, thumbnail, bottom overlay with caption and like/comment counts. */
export function LimeCardSkeleton({
  width = SKELETON_CARD_WIDTH,
  height = SKELETON_CARD_HEIGHT,
  showRepostBadge = false,
}: LimeCardSkeletonProps): ReactNode {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        { width, height, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Thumbnail */}
      <Skeleton width="100%" height="100%" borderRadius={0} style={StyleSheet.absoluteFill} />

      {showRepostBadge ? (
        <View style={styles.repostBadge}>
          <Skeleton width={12} height={12} borderRadius={6} style={{ backgroundColor: OVERLAY_BAR_COLOR }} />
          <Skeleton width={34} height={9} borderRadius={4} style={{ backgroundColor: OVERLAY_BAR_COLOR }} />
        </View>
      ) : null}

      {/* Bottom overlay: caption (11pt) + heart/comment counts */}
      <View style={styles.bottomOverlay}>
        <View style={styles.captionLine}>
          <Skeleton width="80%" height={9} borderRadius={4} style={{ backgroundColor: OVERLAY_BAR_COLOR }} />
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Skeleton width={12} height={12} borderRadius={6} style={{ backgroundColor: OVERLAY_BAR_COLOR }} />
            <Skeleton width={14} height={9} borderRadius={4} style={{ backgroundColor: OVERLAY_BAR_COLOR }} />
          </View>
          <View style={styles.statItem}>
            <Skeleton width={11} height={11} borderRadius={5} style={{ backgroundColor: OVERLAY_BAR_COLOR }} />
            <Skeleton width={10} height={9} borderRadius={4} style={{ backgroundColor: OVERLAY_BAR_COLOR }} />
          </View>
        </View>
      </View>
    </View>
  );
}

type LimeGridSkeletonProps = {
  count?: number;
  /** Own profile: the "Limes (n)" title and "Create Lime" button above the grid. */
  showHeader?: boolean;
};

/** The profile Limes tab while it loads (12 padding, two columns, 8 gap). */
export function LimeGridSkeleton({ count = 4, showHeader = false }: LimeGridSkeletonProps): ReactNode {
  return (
    <View style={styles.gridContainer} accessibilityLabel="Loading Limes">
      {showHeader ? (
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Skeleton width={84} height={14} borderRadius={4} />
          </View>
          {/* Create Lime pill: 14 x 7 padding, + icon 16, 13pt label */}
          <Skeleton width={118} height={32} borderRadius={20} />
        </View>
      ) : null}
      <View style={styles.gridRow}>
        {Array.from({ length: count }, (_, cardIndex) => (
          <LimeCardSkeleton key={`lime-card-skeleton-${cardIndex}`} />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitleBox: {
    height: 20,
    justifyContent: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COLUMN_GAP,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: COLUMN_GAP,
  },
  repostBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captionLine: {
    height: 14,
    justifyContent: 'center',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 14,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
