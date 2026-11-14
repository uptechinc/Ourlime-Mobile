import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { SkeletonIcon, SkeletonLine } from '../MarketSkeletons';

/** CourierCard while couriers load: icon and name, area line, two description lines, tags and contact buttons. */
export function CourierCardsSkeleton({ count = 3 }: { count?: number }): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View accessibilityLabel="Loading couriers" style={{ gap: 12 }}>
    {Array.from({ length: count }, (_, cardIndex) => <View key={cardIndex} style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SkeletonBox width={42} height={42} borderRadius={12} />
        <View style={{ flex: 1 }}><SkeletonLine fontSize={17} width="55%" /><SkeletonLine fontSize={13} width="38%" style={{ marginTop: 1 }} /></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><SkeletonIcon size={15} /><SkeletonLine fontSize={13} lineHeight={18} width="62%" /></View>
      <View><SkeletonLine fontSize={13} lineHeight={19} width="100%" /><SkeletonLine fontSize={13} lineHeight={19} width="70%" /></View>
      <View style={{ flexDirection: 'row', gap: 6 }}><SkeletonBox width={70} height={23} borderRadius={10} /><SkeletonBox width={58} height={23} borderRadius={10} /></View>
      <View style={{ flexDirection: 'row', gap: 8 }}><SkeletonBox width={74} height={40} borderRadius={10} /><SkeletonBox width={108} height={40} borderRadius={10} /></View>
    </View>)}
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { padding: 16, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
