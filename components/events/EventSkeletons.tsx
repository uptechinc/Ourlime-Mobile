import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
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

/** One card from app/events/index.tsx (image, title + category, summary, date, location, attend button). */
function EventListCardSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton width="100%" height={185} borderRadius={0} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}><TextLines fontSize={17} lineHeight={22} width="72%" /></View>
          <Skeleton width={64} height={21} borderRadius={12} />
        </View>
        <TextLines lines={3} fontSize={14} lineHeight={20} lastLineWidth="62%" />
        <View style={styles.meta}>
          <Skeleton width={15} height={15} borderRadius={4} />
          <TextLines fontSize={12} lineHeight={16} width={150} />
        </View>
        <View style={styles.meta}>
          <Skeleton width={15} height={15} borderRadius={4} />
          <View style={{ flex: 1 }}><TextLines fontSize={12} lineHeight={16} width="70%" /></View>
        </View>
        <Skeleton width="100%" height={43} borderRadius={12} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

/** Event cards shown in the Events list while events load (the hero, search and toggle above stay live). */
export function EventListCardsSkeleton({ count = 3 }: { count?: number }): ReactNode {
  return (
    <View style={styles.cardList}>
      {Array.from({ length: count }).map((_, cardIndex) => <EventListCardSkeleton key={cardIndex} />)}
    </View>
  );
}

/** Whole Events list page (header, hero, search, list/calendar toggle, cards) for the route-level boundary. */
export function EventsPageSkeleton(): ReactNode {
  const router = useRouter();
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PageHeader title="Events" onBackPress={() => router.back()} />
      <ScrollView scrollEnabled={false} contentContainerStyle={styles.listContent}>
        <View style={styles.hero}>
          <Skeleton width={30} height={30} borderRadius={8} />
          <View style={{ flex: 1, gap: 3 }}>
            <TextLines fontSize={20} lineHeight={26} width="78%" />
            <TextLines fontSize={12} lineHeight={16} width="88%" />
          </View>
          <SkeletonCircle size={42} />
        </View>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Skeleton width={19} height={19} borderRadius={5} />
          <Skeleton width="45%" height={13} borderRadius={4} />
        </View>
        <View style={[styles.viewToggle, { backgroundColor: colors.control }]}>
          <View style={[styles.viewOption, { backgroundColor: colors.surface }]}><Skeleton width={30} height={11} borderRadius={4} /></View>
          <View style={styles.viewOption}><Skeleton width={58} height={11} borderRadius={4} /></View>
        </View>
        <EventListCardsSkeleton count={2} />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Body of app/events/[id].tsx while the event loads: hero, tags + title + summary, date/location card,
 * attend + share row, organiser card, About section and the discussion with its composer bar.
 */
export function EventDetailSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(width, 760);
  const surfaceCard = { backgroundColor: colors.surface, borderColor: colors.border };
  return (
    <View style={{ flex: 1 }}>
      <ScrollView scrollEnabled={false} style={{ flex: 1 }} contentContainerStyle={styles.detailScroll}>
        <View style={[styles.detailColumn, { width: contentWidth }]}>
          <View style={styles.detailHero}><Skeleton width="100%" height="100%" borderRadius={0} /></View>

          <View style={styles.section}>
            <View style={styles.tagRow}><Skeleton width={78} height={21} borderRadius={12} /></View>
            <TextLines lines={2} fontSize={26} lineHeight={32} lastLineWidth="58%" />
            <TextLines lines={2} fontSize={15} lineHeight={22} lastLineWidth="70%" />
          </View>

          <View style={[styles.infoCard, surfaceCard]}>
            <View style={styles.infoRow}>
              <Skeleton width={20} height={20} borderRadius={5} />
              <View style={{ flex: 1 }}>
                <TextLines fontSize={15} lineHeight={20} width="55%" />
                <View style={styles.inline}>
                  <Skeleton width={14} height={14} borderRadius={4} />
                  <TextLines fontSize={13} lineHeight={19} width={120} />
                </View>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={styles.infoRow}>
              <Skeleton width={20} height={20} borderRadius={5} />
              <View style={{ flex: 1 }}>
                <TextLines fontSize={15} lineHeight={20} width="65%" />
                <TextLines fontSize={13} lineHeight={19} width="45%" />
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}><Skeleton height={48} borderRadius={14} /></View>
            <View style={[styles.iconButton, surfaceCard]}><Skeleton width={20} height={20} borderRadius={5} /></View>
          </View>

          <View style={[styles.organizer, surfaceCard]}>
            <SkeletonCircle size={44} />
            <View style={{ flex: 1 }}>
              <TextLines fontSize={13} lineHeight={17} width={80} />
              <TextLines fontSize={16} lineHeight={21} width="50%" />
            </View>
          </View>

          <View style={styles.section}>
            <TextLines fontSize={18} lineHeight={24} width={150} />
            <TextLines lines={4} fontSize={15} lineHeight={23} lastLineWidth="55%" />
          </View>

          <View style={styles.section}>
            <View style={[styles.inline, { marginTop: 0 }]}>
              <Skeleton width={20} height={20} borderRadius={5} />
              <TextLines fontSize={18} lineHeight={24} width={130} />
            </View>
            {[0, 1].map((commentIndex) => (
              <View key={commentIndex} style={styles.comment}>
                <SkeletonCircle size={36} />
                <View style={[styles.commentBody, surfaceCard]}>
                  <View style={styles.inlineTight}>
                    <TextLines fontSize={14} lineHeight={18} width={96} />
                    <TextLines fontSize={11} lineHeight={14} width={44} />
                  </View>
                  <TextLines lines={2} fontSize={14} lineHeight={20} lastLineWidth="60%" />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.composerBar, { paddingBottom: 10 + insets.bottom, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={[styles.composer, { width: contentWidth - 24 }]}>
          <View style={[styles.composerInput, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Skeleton width="55%" height={13} borderRadius={4} />
          </View>
          <SkeletonCircle size={44} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 18, paddingBottom: 48, gap: 14 },
  cardList: { gap: 14 },
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  cardBody: { padding: 15, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#34d399', borderRadius: 20, padding: 17 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, height: 46 },
  viewToggle: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14 },
  viewOption: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  detailScroll: { alignItems: 'center', paddingBottom: 28 },
  detailColumn: { gap: 16 },
  detailHero: { width: '100%', aspectRatio: 16 / 9, maxHeight: 420 },
  section: { paddingHorizontal: 18, gap: 10 },
  tagRow: { flexDirection: 'row', gap: 8 },
  infoCard: { marginHorizontal: 18, padding: 16, gap: 12, borderRadius: 18, borderWidth: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  inlineTight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1 },
  organizer: { marginHorizontal: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  commentBody: { flex: 1, padding: 12, gap: 4, borderRadius: 14, borderWidth: 1 },
  composerBar: { alignItems: 'center', paddingTop: 10, borderTopWidth: 1 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  composerInput: { flex: 1, height: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1 },
});
