import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { SkeletonIcon, SkeletonLine } from '../MarketSkeletons';

/** Text widths of the listing status filter chips: All, Published, Pending, Rejected, Unpublished, Draft. */
const LISTING_FILTER_TEXT_WIDTHS = [16, 58, 48, 52, 72, 30] as const;

/**
 * SellerListingsScreen body while listings load (rendered inside the real SellerScreenFrame header):
 * Add product / Orders buttons, four stat tiles, catalogue search, status filter chips, listing cards.
 */
export function SellerListingsSkeleton({ count = 3 }: { count?: number }): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <View style={styles.actionsRow}>
      <View style={styles.flex}><SkeletonBox height={46} borderRadius={13} /></View>
      <View style={[styles.secondaryButton, styles.flex]}><SkeletonIcon size={17} /><SkeletonLine fontSize={14} width={50} /></View>
    </View>
    <View style={styles.stats}>
      {[0, 1, 2, 3].map((statIndex) => <View key={statIndex} style={styles.stat}>
        <SkeletonLine fontSize={10} width="72%" />
        <SkeletonLine fontSize={24} width={34} style={{ marginTop: 4 }} />
      </View>)}
    </View>
    <View style={styles.searchBox}><SkeletonIcon size={19} /><SkeletonLine fontSize={15} width="58%" /></View>
    <View style={styles.filters}>
      {LISTING_FILTER_TEXT_WIDTHS.map((textWidth, chipIndex) => <View key={chipIndex} style={styles.filter}><SkeletonLine fontSize={12} width={textWidth} /></View>)}
    </View>
    {Array.from({ length: count }, (_, cardIndex) => <View key={cardIndex} style={styles.card}>
      <View style={styles.cardTop}>
        <SkeletonBox width={72} height={72} borderRadius={14} />
        <View style={styles.flex}>
          <SkeletonLine fontSize={15} width="78%" />
          <SkeletonLine fontSize={12} width="55%" style={{ marginTop: 3 }} />
          <View style={styles.metaRow}>
            <SkeletonLine fontSize={14} width={52} />
            <SkeletonLine fontSize={12} width={58} />
            <SkeletonBox width={74} height={21} borderRadius={999} style={{ marginTop: 4 }} />
          </View>
        </View>
      </View>
      <View style={styles.cardActions}>
        <View style={styles.iconButton}><SkeletonIcon size={17} /></View>
        <View style={styles.iconButton}><SkeletonIcon size={17} /></View>
        <View style={styles.iconButton}><SkeletonIcon size={17} /></View>
        <View style={styles.compactButton}><SkeletonIcon size={15} /><SkeletonLine fontSize={14} width={70} /></View>
        <View style={styles.iconButton}><SkeletonIcon size={17} /></View>
      </View>
    </View>)}
  </ScrollView>;
}

/**
 * SellerOrdersScreen body while orders load (inside the real SellerScreenFrame header):
 * order cards with number, buyer meta, status badge, item row, total and address strip, action buttons.
 */
export function SellerOrdersSkeleton({ count = 2 }: { count?: number }): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    {Array.from({ length: count }, (_, orderIndex) => <View key={orderIndex} style={styles.card}>
      <View style={styles.orderHead}>
        <View style={styles.flex}>
          <SkeletonLine fontSize={15} width="42%" />
          <SkeletonLine fontSize={12} lineHeight={17} width="72%" style={{ marginTop: 2 }} />
        </View>
        <SkeletonBox width={88} height={23} borderRadius={999} />
      </View>
      <View style={styles.item}>
        <SkeletonBox width={46} height={46} borderRadius={11} />
        <View style={styles.flex}>
          <SkeletonLine fontSize={13} width="70%" />
          <SkeletonLine fontSize={12} lineHeight={17} width="45%" style={{ marginTop: 2 }} />
        </View>
        <SkeletonLine fontSize={13} width={54} />
      </View>
      <View style={styles.totalRow}>
        <SkeletonLine fontSize={12} lineHeight={17} width="55%" />
        <SkeletonLine fontSize={16} width={64} />
      </View>
      <View style={styles.address}>
        <SkeletonIcon size={14} />
        <View style={styles.flex}>
          <SkeletonLine fontSize={12} lineHeight={17} width="100%" />
          <SkeletonLine fontSize={12} lineHeight={17} width="60%" />
        </View>
      </View>
      <View style={styles.cardActions}>
        <View style={styles.compactButton}><SkeletonIcon size={15} /><SkeletonLine fontSize={14} width={104} /></View>
        <SkeletonBox width={128} height={40} borderRadius={11} />
      </View>
    </View>)}
  </ScrollView>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 14, paddingBottom: 40, gap: 14 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  compactButton: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '47%', flexGrow: 1, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchBox: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filters: { flexDirection: 'row', gap: 8, overflow: 'hidden' },
  filter: { minHeight: 40, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  card: { padding: 14, gap: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  metaRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: colors.border },
  orderHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  address: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10, borderRadius: 12, backgroundColor: colors.control },
});
