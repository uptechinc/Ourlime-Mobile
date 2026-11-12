import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { ProfileTimelineSkeleton, SkeletonLine } from '@/components/profile/ProfileTabSkeletons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type ProfileSkeletonProps = {
  /**
   * 'own'    — Profile tab (ProfileHeader): 140 cover, Edit Profile + customize + share buttons,
   *            status chip, boxed metrics bar, icon tab chips.
   * 'public' — /profile/[username]: 130 cover, Follow + Add Friend + message buttons,
   *            divider stats row, text-only tab chips, tab content 12 below.
   */
  variant?: 'own' | 'public';
};

/* Tab chip widths: 16 side padding each, 13pt label, plus a 16 icon + 6 gap on the own profile. */
const OWN_TAB_CHIP_WIDTHS = [88, 86, 102, 98, 88, 94] as const;
const PUBLIC_TAB_CHIP_WIDTHS = [66, 68, 84, 80, 112, 68, 76] as const;

export default function ProfileSkeleton({ variant = 'own' }: ProfileSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  const isOwn = variant === 'own';
  const tabChipWidths = isOwn ? OWN_TAB_CHIP_WIDTHS : PUBLIC_TAB_CHIP_WIDTHS;

  return (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.canvas }} accessibilityLabel="Loading profile">
      {/* ── Header card ── */}
      <View
        style={
          isOwn
            ? { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }
            : undefined
        }
      >
        {/* Cover banner */}
        <Skeleton width="100%" height={isOwn ? 140 : 130} borderRadius={0} />

        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: 20,
            paddingBottom: isOwn ? 16 : 18,
            borderBottomWidth: isOwn ? 0 : 1,
            borderBottomColor: colors.border,
          }}
        >
          {/* Avatar (84 ring, 78 photo) overlapping the cover + action buttons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -40, marginBottom: 12 }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surface, padding: 3 }}>
              <SkeletonCircle size={78} />
            </View>

            {isOwn ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* Edit Profile: 14 x 8 padding, 13pt label, radius 14 */}
                <Skeleton width={98} height={34} borderRadius={14} />
                <Skeleton width={36} height={36} borderRadius={12} />
                <Skeleton width={36} height={36} borderRadius={12} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {/* + Follow, Add Friend (radius 20, 13pt), message circle 36 */}
                <Skeleton width={88} height={36} borderRadius={20} />
                <Skeleton width={98} height={34} borderRadius={20} />
                <SkeletonCircle size={36} />
              </View>
            )}
          </View>

          {/* Name 22 / handle 14 */}
          <SkeletonLine fontSize={22} lineHeight={28} width={180} />
          <SkeletonLine fontSize={14} lineHeight={19} width={110} marginTop={2} />

          {/* Own profile: status chip under the handle */}
          {isOwn ? (
            <Skeleton width={92} height={26} borderRadius={999} style={{ marginTop: 6 }} />
          ) : null}

          {/* Bio (14 / 20) */}
          <View style={{ marginTop: 8 }}>
            <SkeletonLine fontSize={14} lineHeight={20} width="88%" />
            <SkeletonLine fontSize={14} lineHeight={20} width="62%" />
          </View>

          {isOwn ? (
            /* Boxed metrics bar: Posts | Friends | Following */
            <View
              style={{
                flexDirection: 'row',
                marginTop: 16,
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: colors.control,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                justifyContent: 'space-around',
              }}
            >
              {[34, 44, 56].map((labelWidth, metricIndex) => [
                metricIndex > 0 ? (
                  <View
                    key={`own-metric-divider-${metricIndex}`}
                    style={{ width: 1, height: '80%', backgroundColor: colors.border, alignSelf: 'center' }}
                  />
                ) : null,
                <View key={`own-metric-${metricIndex}`} style={{ alignItems: 'center' }}>
                  <SkeletonLine fontSize={17} lineHeight={22} width={26} />
                  <SkeletonLine fontSize={12} lineHeight={16} width={labelWidth} marginTop={1} />
                </View>,
              ])}
            </View>
          ) : (
            /* Divider stats row: Posts, Followers, Friends (24 apart) */
            <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
              {[34, 56, 44].map((labelWidth, statIndex) => (
                <View key={`public-stat-${statIndex}`} style={{ marginRight: statIndex < 2 ? 24 : 0, alignItems: 'center' }}>
                  <SkeletonLine fontSize={16} lineHeight={21} width={22} />
                  <SkeletonLine fontSize={12} lineHeight={16} width={labelWidth} />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* ── Tab chip row ── */}
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          overflow: 'hidden',
        }}
      >
        {tabChipWidths.map((chipWidth, chipIndex) => (
          <Skeleton key={`profile-tab-chip-${chipIndex}`} width={chipWidth} height={34} borderRadius={20} />
        ))}
      </View>

      {/* ── Default tab (Posts) ── */}
      <View style={{ marginTop: isOwn ? 0 : 12 }}>
        <ProfileTimelineSkeleton />
      </View>
    </View>
  );
}
