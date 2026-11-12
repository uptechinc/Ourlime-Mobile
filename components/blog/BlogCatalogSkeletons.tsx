import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type TextLinesProps = {
  lines?: number;
  fontSize: number;
  lineHeight: number;
  width?: number | `${number}%`;
  lastLineWidth?: number | `${number}%`;
};

/** Text placeholder that occupies exactly `lines * lineHeight` like the real Text it stands in for. */
function TextLines({ lines = 1, fontSize, lineHeight, width = '100%', lastLineWidth }: TextLinesProps): ReactNode {
  const barHeight = Math.round(fontSize * 0.8);
  return (
    <View>
      {Array.from({ length: lines }).map((_, lineIndex) => (
        <View key={lineIndex} style={{ height: lineHeight, justifyContent: 'center' }}>
          <Skeleton
            width={lineIndex === lines - 1 && lastLineWidth !== undefined ? lastLineWidth : width}
            height={barHeight}
            borderRadius={4}
          />
        </View>
      ))}
    </View>
  );
}

// Same order as CATEGORIES in app/blogs/index.tsx; widths follow each label at 13px semibold + 15px padding.
const CATEGORY_CHIP_WIDTHS = [74, 52, 107, 92, 98, 84, 78, 90, 90, 100, 76];

/** Mirrors components/blog/BlogListCard.tsx: 1200:630 cover with badge + bookmark, title, excerpt, author, footer. */
function BlogListCardSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cover}>
        <Skeleton width="100%" height="100%" borderRadius={0} />
        <View style={styles.categoryBadge} />
        <View style={styles.bookmarkButton} />
      </View>
      <View style={styles.body}>
        <TextLines lines={2} fontSize={16} lineHeight={22} lastLineWidth="64%" />
        <TextLines lines={3} fontSize={13} lineHeight={19} lastLineWidth="48%" />
        <View style={styles.authorRow}>
          <SkeletonCircle size={28} />
          <View style={{ flex: 1 }}>
            <TextLines fontSize={13} lineHeight={17} width={110} />
            <TextLines fontSize={11} lineHeight={14} width={140} />
          </View>
        </View>
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.action}><Skeleton width={16} height={16} borderRadius={8} /><Skeleton width={14} height={10} borderRadius={4} /></View>
          <View style={styles.action}><Skeleton width={16} height={16} borderRadius={8} /><Skeleton width={14} height={10} borderRadius={4} /></View>
          <View style={[styles.action, { marginLeft: 'auto' }]}><Skeleton width={16} height={16} borderRadius={8} /></View>
        </View>
      </View>
    </View>
  );
}

/** Blog cards shown under the live category chips while the catalog loads (app/blogs/index.tsx `feedList`). */
export function BlogCatalogListSkeleton({ count = 3 }: { count?: number }): ReactNode {
  return (
    <View style={styles.feedList}>
      {Array.from({ length: count }).map((_, cardIndex) => <BlogListCardSkeleton key={cardIndex} />)}
    </View>
  );
}

/** Whole Blogs & Articles catalog page (header, search + filter row, category chips, cards) for the route boundary. */
export function BlogCatalogPageSkeleton(): ReactNode {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const idleControl = isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9';
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(tabs)'))} style={styles.headerIconButton} accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Blogs & Articles</Text>
        <Skeleton width={83} height={31} borderRadius={20} />
      </View>

      <View style={[styles.searchFilterRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', borderColor: colors.border }]}>
          <Skeleton width={16} height={16} borderRadius={8} style={{ marginRight: 8 }} />
          <Skeleton width="62%" height={12} borderRadius={4} />
        </View>
        <View style={[styles.filterIconButton, { backgroundColor: idleControl, borderColor: colors.border }]}>
          <Skeleton width={18} height={18} borderRadius={5} />
        </View>
      </View>

      <View style={styles.scrollContent}>
        {/* A plain clipped row: a non-scrolling horizontal ScrollView collapsed to zero height here. */}
        <View style={[styles.chipRow, { flexDirection: 'row', overflow: 'hidden' }]}>
          {CATEGORY_CHIP_WIDTHS.map((chipWidth, chipIndex) => <Skeleton key={chipIndex} width={chipWidth} height={33} borderRadius={20} style={{ flexShrink: 0 }} />)}
        </View>
        <BlogCatalogListSkeleton count={2} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerIconButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  searchFilterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 40, borderRadius: 12, borderWidth: 1 },
  filterIconButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  scrollContent: { flex: 1, paddingTop: 12, overflow: 'hidden' },
  chipRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  feedList: { gap: 14, paddingHorizontal: 16, paddingTop: 10 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 1200 / 630 },
  categoryBadge: { position: 'absolute', top: 10, left: 10, width: 76, height: 21, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.55)' },
  bookmarkButton: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.92)' },
  body: { padding: 14, gap: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 18, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
