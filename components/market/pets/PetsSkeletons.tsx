import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton, SkeletonBox } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { SkeletonIcon, SkeletonLine } from '../MarketSkeletons';

/** PetsScreen cards while listings load: 240 px photo with the status pill, name and arrow, breed · age, two description lines, location. */
export function PetListingsSkeleton({ count = 2 }: { count?: number }): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View accessibilityLabel="Loading listings" style={{ gap: 14 }}>
    {Array.from({ length: count }, (_, cardIndex) => <View key={cardIndex} style={styles.card}>
      <View style={styles.photo}>
        <Skeleton width="100%" height="100%" borderRadius={0} />
        <View style={styles.pill}><SkeletonBox width={78} height={26} borderRadius={13} /></View>
      </View>
      <View style={styles.body}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SkeletonLine fontSize={20} width="42%" />
            <SkeletonLine fontSize={13} width="58%" style={{ marginTop: 3 }} />
          </View>
          <SkeletonIcon size={20} />
        </View>
        <View>
          <SkeletonLine fontSize={13} lineHeight={20} width="100%" />
          <SkeletonLine fontSize={13} lineHeight={20} width="72%" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><SkeletonIcon size={15} /><SkeletonLine fontSize={12} width="32%" /></View>
      </View>
    </View>)}
  </View>;
}

/** PetDetailScreen while the listing loads: 320 px photo, then the card with status, title, meta, location, sections, tiles and the button. */
export function PetDetailSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View accessibilityLabel="Loading pet" style={{ padding: 16, gap: 12 }}>
    <SkeletonBox width="100%" height={320} borderRadius={22} />
    <View style={[styles.card, { padding: 18, gap: 14 }]}>
      <SkeletonBox width={92} height={24} borderRadius={12} />
      <SkeletonLine fontSize={28} width="62%" />
      <SkeletonLine fontSize={14} lineHeight={20} width="55%" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><SkeletonIcon size={16} /><SkeletonLine fontSize={14} width="30%" /></View>
      {[0, 1, 2].map((sectionIndex) => <View key={sectionIndex} style={{ gap: 4 }}>
        <SkeletonLine fontSize={15} width="34%" />
        <SkeletonLine fontSize={14} lineHeight={21} width="100%" />
        <SkeletonLine fontSize={14} lineHeight={21} width="80%" />
      </View>)}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SkeletonBox width="48%" height={84} borderRadius={14} />
        <SkeletonBox width="48%" height={84} borderRadius={14} />
      </View>
      <SkeletonBox width="100%" height={52} borderRadius={14} />
    </View>
  </View>;
}

/** PetEnquiriesScreen while enquiries load: pet name, enquirer, contact and status pill, message, three action buttons. */
export function PetEnquiriesSkeleton({ count = 2 }: { count?: number }): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View accessibilityLabel="Loading enquiries" style={{ gap: 12 }}>
    {Array.from({ length: count }, (_, cardIndex) => <View key={cardIndex} style={[styles.card, { padding: 16, gap: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <SkeletonLine fontSize={11} width="28%" />
          <SkeletonLine fontSize={17} width="46%" />
          <SkeletonLine fontSize={13} width="52%" />
        </View>
        <SkeletonBox width={56} height={24} borderRadius={12} />
      </View>
      <View>
        <SkeletonLine fontSize={14} lineHeight={21} width="100%" />
        <SkeletonLine fontSize={14} lineHeight={21} width="66%" />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SkeletonBox width={88} height={36} borderRadius={10} />
        <SkeletonBox width={70} height={36} borderRadius={10} />
        <SkeletonBox width={76} height={36} borderRadius={10} />
      </View>
    </View>)}
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  photo: { height: 240, backgroundColor: colors.control },
  pill: { position: 'absolute', top: 14, left: 14 },
  body: { padding: 16, gap: 10 },
});
