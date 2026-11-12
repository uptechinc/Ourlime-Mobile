import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton, SkeletonBox } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { SkeletonIcon, SkeletonLine } from '../MarketSkeletons';

/**
 * PetsScreen listing cards while listings load: 230 px image with favourite button, name / breed with
 * price pill, age / sex / vaccinated tags, and the location footer with the round arrow button.
 */
export function PetListingsSkeleton({ count = 2 }: { count?: number }): ReactNode {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  return <View accessibilityLabel="Loading listings" style={{ gap: 16 }}>
    {Array.from({ length: count }, (_, cardIndex) => <View key={cardIndex} style={styles.petCard}>
      <View style={styles.petImageWrap}>
        <Skeleton width="100%" height="100%" borderRadius={0} />
        <View style={styles.favorite}><SkeletonIcon size={20} /></View>
      </View>
      <View style={styles.petBody}>
        <View style={styles.petTitleRow}>
          <View style={{ flex: 1 }}>
            <SkeletonLine fontSize={20} width="45%" />
            <SkeletonLine fontSize={13} width="60%" style={{ marginTop: 1 }} />
          </View>
          <SkeletonBox width={72} height={30} borderRadius={10} />
        </View>
        <View style={styles.tagRow}>
          <SkeletonBox width={62} height={28} borderRadius={9} />
          <SkeletonBox width={56} height={28} borderRadius={9} />
          <SkeletonBox width={96} height={28} borderRadius={9} />
        </View>
        <View style={styles.petFooter}>
          <View style={styles.petLocation}><SkeletonIcon size={15} /><SkeletonLine fontSize={12} width="62%" /></View>
          <SkeletonBox width={36} height={36} borderRadius={18} />
        </View>
      </View>
    </View>)}
  </View>;
}

const createStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  petCard: { overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#101817' : colors.surface },
  petImageWrap: { height: 230, backgroundColor: isDark ? '#17211f' : '#e2e8f0' },
  favorite: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: isDark ? '#101817' : '#ffffff', elevation: 3, shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  petBody: { padding: 16 },
  petTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tagRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  petFooter: { marginTop: 14, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9' },
  petLocation: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
});
