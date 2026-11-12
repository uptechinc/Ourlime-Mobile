import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { LimeCardSkeleton } from '@/components/limes/LimeCardSkeleton';
import { feedCardContainerStyle } from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/feedCardStyles';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type SkeletonLineProps = {
  fontSize: number;
  lineHeight?: number;
  width: number | `${number}%`;
  marginTop?: number;
};

/** One line of text: a bar the height of the glyphs, inside a box as tall as the real line. */
export function SkeletonLine({ fontSize, lineHeight, width, marginTop = 0 }: SkeletonLineProps): ReactNode {
  const boxHeight = lineHeight ?? Math.round(fontSize * 1.2);
  return (
    <View style={{ height: boxHeight, justifyContent: 'center', marginTop, width }}>
      <Skeleton width="100%" height={Math.round(fontSize * 0.85)} borderRadius={4} />
    </View>
  );
}

/* ── Posts tab: "Filters" label + content-type chips (FeedsFilterSection) ── */

const FILTER_CHIP_TEXT_WIDTHS = [18, 46, 46, 40, 76, 34] as const;

export function ProfileFilterSectionSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View>
      <SkeletonLine fontSize={15} lineHeight={20} width={48} />
      <View style={{ flexDirection: 'row', marginTop: 10, overflow: 'hidden' }}>
        {FILTER_CHIP_TEXT_WIDTHS.map((textWidth, chipIndex) => (
          <View
            key={`filter-chip-${textWidth}-${chipIndex}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginRight: 10,
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Skeleton width={16} height={16} borderRadius={4} />
            <View style={{ marginLeft: 7 }}>
              <SkeletonLine fontSize={14} lineHeight={19} width={textWidth} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── Post card (PostCardSection) ── */

type ProfilePostCardSkeletonProps = {
  withMedia?: boolean;
};

export function ProfilePostCardSkeleton({ withMedia = true }: ProfilePostCardSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={[feedCardContainerStyle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ paddingHorizontal: 16 }}>
        {/* Author row: avatar 48, name 16, handle · time 13 + visibility icon, options button */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <SkeletonCircle size={48} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <SkeletonLine fontSize={16} lineHeight={21} width={140} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <SkeletonLine fontSize={13} lineHeight={17} width={110} />
                <Skeleton width={12} height={12} borderRadius={6} style={{ marginLeft: 5 }} />
              </View>
            </View>
          </View>
          <View style={{ padding: 8 }}>
            <Skeleton width={21} height={21} borderRadius={6} />
          </View>
        </View>

        {/* Caption: 17 / 23 */}
        <View style={{ marginTop: 14 }}>
          <SkeletonLine fontSize={17} lineHeight={23} width="92%" />
          <SkeletonLine fontSize={17} lineHeight={23} width="58%" />
        </View>
      </View>

      {/* Edge-to-edge media, 330 tall */}
      {withMedia ? <Skeleton width="100%" height={330} borderRadius={0} style={{ marginTop: 12 }} /> : null}

      {/* Action footer */}
      <View style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <Skeleton width={23} height={23} borderRadius={12} />
            </View>
            <View style={{ marginLeft: 7, marginRight: 22, paddingVertical: 6 }}>
              <SkeletonLine fontSize={14} lineHeight={19} width={12} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 22, paddingVertical: 6 }}>
              <Skeleton width={22} height={22} borderRadius={11} />
              <View style={{ marginLeft: 7 }}><SkeletonLine fontSize={14} lineHeight={19} width={12} /></View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20, paddingVertical: 6 }}>
              <Skeleton width={22} height={22} borderRadius={11} />
              <View style={{ marginLeft: 7 }}><SkeletonLine fontSize={14} lineHeight={19} width={12} /></View>
            </View>
            <View style={{ paddingVertical: 6 }}>
              <Skeleton width={22} height={22} borderRadius={11} />
            </View>
          </View>
          <SkeletonLine fontSize={13} lineHeight={17} width={48} />
        </View>
      </View>
    </View>
  );
}

/** Post cards as TimelineTab lays them out (12 side padding, 14 between cards). */
export function ProfilePostListSkeleton({ count = 2 }: { count?: number }): ReactNode {
  return (
    <View>
      {Array.from({ length: count }, (_, cardIndex) => (
        <View key={`post-skeleton-${cardIndex}`} style={{ width: '100%', paddingHorizontal: 12, marginBottom: 14 }}>
          <ProfilePostCardSkeleton withMedia={cardIndex % 2 === 0} />
        </View>
      ))}
    </View>
  );
}

/** The whole Posts tab while it loads: filter section, then post cards. */
export function ProfileTimelineSkeleton(): ReactNode {
  return (
    <View style={{ paddingVertical: 12 }}>
      <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <ProfileFilterSectionSkeleton />
      </View>
      <ProfilePostListSkeleton count={2} />
    </View>
  );
}

/* ── Friends tab rows ── */

export function FriendRowsSkeleton({ count = 5 }: { count?: number }): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ paddingHorizontal: 16, gap: 9 }} accessibilityLabel="Loading people">
      {Array.from({ length: count }, (_, rowIndex) => (
        <View
          key={`friend-row-skeleton-${rowIndex}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            padding: 12,
            borderRadius: 18,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <SkeletonCircle size={48} />
          <View style={{ flex: 1 }}>
            <SkeletonLine fontSize={15} lineHeight={20} width={rowIndex % 2 === 0 ? 130 : 105} />
            <SkeletonLine fontSize={14} lineHeight={19} width={rowIndex % 2 === 0 ? 90 : 110} marginTop={2} />
          </View>
          {/* Action button (e.g. Remove): marginTop 8, radius 12, 11 x 8 padding, 12pt label */}
          <Skeleton width={66} height={31} borderRadius={12} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

/* ── Reposts tab: filter pills, Reposted Limes grid, Reposted Posts ── */

const REPOST_PILL_WIDTHS = [62, 72, 72] as const;

export function ProfileRepostsSkeleton(): ReactNode {
  return (
    <View style={{ paddingVertical: 12 }} accessibilityLabel="Loading reposts">
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 }}>
        {REPOST_PILL_WIDTHS.map((pillWidth, pillIndex) => (
          <Skeleton key={`repost-pill-${pillIndex}`} width={pillWidth} height={28} borderRadius={16} />
        ))}
      </View>

      <View style={{ marginBottom: 20 }}>
        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <SkeletonLine fontSize={15} lineHeight={20} width={118} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12 }}>
          <LimeCardSkeleton showRepostBadge />
          <LimeCardSkeleton showRepostBadge />
        </View>
      </View>

      <View>
        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <SkeletonLine fontSize={15} lineHeight={20} width={116} />
        </View>
        <ProfilePostListSkeleton count={1} />
      </View>
    </View>
  );
}

/* ── Admin "Deleted posts" tab cards (public profile) ── */

export function DeletedPostCardsSkeleton({ count = 2 }: { count?: number }): ReactNode {
  const { colors, isDark } = useAppTheme();
  return (
    <View accessibilityLabel="Loading deleted posts">
      {Array.from({ length: count }, (_, cardIndex) => (
        <View
          key={`deleted-post-skeleton-${cardIndex}`}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SkeletonCircle size={22} style={{ marginRight: 6 }} />
              <SkeletonLine fontSize={12} lineHeight={16} width={76} />
            </View>
            <SkeletonLine fontSize={11} lineHeight={14} width={60} />
          </View>
          <View style={{ marginVertical: 4 }}>
            <SkeletonLine fontSize={13} lineHeight={19} width="90%" />
            <SkeletonLine fontSize={13} lineHeight={19} width="55%" />
          </View>
          <View
            style={{
              marginTop: 6,
              padding: 8,
              borderRadius: 10,
              backgroundColor: isDark ? '#27272a' : '#fef2f2',
              borderLeftWidth: 3,
              borderLeftColor: '#ef4444',
            }}
          >
            <SkeletonLine fontSize={11} lineHeight={14} width={150} />
            <SkeletonLine fontSize={10} lineHeight={13} width={110} marginTop={1} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Skeleton width={104} height={29} borderRadius={10} />
          </View>
        </View>
      ))}
    </View>
  );
}
