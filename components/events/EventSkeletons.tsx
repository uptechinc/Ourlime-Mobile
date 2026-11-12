import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

/** One EventCard (image, title, date, location, attending, summary, attend + action buttons). */
function EventListCardSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton width="100%" height={180} borderRadius={0} />
      <View style={styles.cardBody}>
        <TextLines fontSize={17} lineHeight={22} width="72%" />
        {[150, 190, 90].map((lineWidth) => (
          <View key={lineWidth} style={styles.meta}>
            <Skeleton width={14} height={14} borderRadius={4} />
            <TextLines fontSize={12} lineHeight={16} width={lineWidth} />
          </View>
        ))}
        <TextLines lines={2} fontSize={13} lineHeight={19} lastLineWidth="62%" />
        <View style={[styles.meta, { marginTop: 6, gap: 8 }]}>
          <View style={{ flex: 1 }}><Skeleton height={40} borderRadius={12} /></View>
          {[0, 1, 2, 3].map((buttonIndex) => <Skeleton key={buttonIndex} width={36} height={36} borderRadius={12} />)}
        </View>
      </View>
    </View>
  );
}

/** Event cards shown in the events lists while events load (the controls above stay live). */
export function EventListCardsSkeleton({ count = 3 }: { count?: number }): ReactNode {
  return (
    <View style={styles.cardList}>
      {Array.from({ length: count }).map((_, cardIndex) => <EventListCardSkeleton key={cardIndex} />)}
    </View>
  );
}

/** Whole Events page (featured hero, active count, upcoming strip, search row, cards) for the route-level boundary. */
export function EventsPageSkeleton(): ReactNode {
  const router = useRouter();
  const { colors } = useAppTheme();
  const surfaceCard = { backgroundColor: colors.surface, borderColor: colors.border };
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PageHeader title="Events" onBackPress={() => router.back()} />
      <ScrollView scrollEnabled={false} contentContainerStyle={styles.listContent}>
        <Skeleton width="100%" height={380} borderRadius={20} />
        <Skeleton width={180} height={78} borderRadius={18} />
        <View style={[styles.upcomingSection, surfaceCard]}>
          <View style={styles.meta}>
            <View style={{ flex: 1, gap: 4 }}>
              <TextLines fontSize={20} lineHeight={26} width="60%" />
              <TextLines fontSize={12} lineHeight={16} width="80%" />
            </View>
            <Skeleton width={92} height={36} borderRadius={10} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[0, 1].map((cardIndex) => (
              <View key={cardIndex} style={[styles.upcomingCard, surfaceCard]}>
                <Skeleton width="100%" height={130} borderRadius={0} />
                <View style={{ padding: 12, gap: 6 }}>
                  <TextLines fontSize={15} lineHeight={20} width="80%" />
                  <TextLines fontSize={12} lineHeight={16} width="70%" />
                  <TextLines fontSize={12} lineHeight={16} width="55%" />
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.meta}>
          <View style={{ flex: 1 }}><Skeleton height={44} borderRadius={22} /></View>
          <SkeletonCircle size={44} />
          <SkeletonCircle size={44} />
        </View>
        <EventListCardsSkeleton count={2} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** The /calendar page: month card with the 6-week grid, then the selected day's events. */
export function EventsCalendarSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const surfaceCard = { backgroundColor: colors.surface, borderColor: colors.border };
  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.calendarCard, surfaceCard]}>
        <View style={[styles.meta, { justifyContent: 'space-between', marginBottom: 8 }]}>
          <SkeletonCircle size={40} />
          <Skeleton width={140} height={16} borderRadius={4} />
          <SkeletonCircle size={40} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 49 }).map((_, cellIndex) => (
            <View key={cellIndex} style={styles.calendarCell}>
              <Skeleton width={cellIndex < 7 ? 24 : 30} height={cellIndex < 7 ? 10 : 30} borderRadius={cellIndex < 7 ? 4 : 15} />
            </View>
          ))}
        </View>
      </View>
      <TextLines fontSize={16} lineHeight={22} width={200} />
      {[0, 1].map((rowIndex) => (
        <View key={rowIndex} style={[styles.calendarRow, surfaceCard]}>
          <Skeleton width={64} height={30} borderRadius={10} />
          <View style={{ flex: 1, gap: 4 }}>
            <TextLines fontSize={15} lineHeight={20} width="75%" />
            <TextLines fontSize={12} lineHeight={16} width="50%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Discussion or review cards while they load (avatar, name + time, two lines). */
export function EventDiscussionSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 12 }}>
      {[0, 1].map((commentIndex) => (
        <View key={commentIndex} style={[styles.commentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SkeletonCircle size={36} />
          <View style={{ flex: 1, gap: 3 }}>
            <TextLines fontSize={14} lineHeight={18} width={110} />
            <TextLines fontSize={11} lineHeight={14} width={90} />
            <TextLines lines={2} fontSize={14} lineHeight={20} lastLineWidth="60%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Body of app/events/[id].tsx while the event loads: hero with its badges and title block, the action bar,
 * the About / Discussions / Reviews tabs, the About text and the Event Information card.
 */
export function EventDetailSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 760);
  const surfaceCard = { backgroundColor: colors.surface, borderColor: colors.border };
  return (
    <ScrollView scrollEnabled={false} style={{ flex: 1 }} contentContainerStyle={styles.detailScroll}>
      <View style={[styles.detailColumn, { width: contentWidth }]}>
        <View style={styles.detailHero}>
          <Skeleton width="100%" height="100%" borderRadius={0} />
          <View style={styles.detailHeroOverlay}>
            <TextLines lines={2} fontSize={24} lineHeight={30} width="80%" lastLineWidth="50%" />
            <TextLines fontSize={13} lineHeight={18} width="70%" />
            <TextLines fontSize={13} lineHeight={18} width="55%" />
          </View>
        </View>
        <View style={[styles.actionBar, surfaceCard]}>
          <Skeleton width={120} height={42} borderRadius={12} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2, 3].map((buttonIndex) => <SkeletonCircle key={buttonIndex} size={40} />)}
          </View>
        </View>
        <View style={[styles.tabs, surfaceCard]}>
          {[56, 110, 90].map((tabWidth) => <Skeleton key={tabWidth} width={tabWidth} height={14} borderRadius={4} />)}
        </View>
        <View style={styles.section}>
          <TextLines fontSize={19} lineHeight={25} width={170} />
          <TextLines lines={4} fontSize={15} lineHeight={23} lastLineWidth="55%" />
        </View>
        <View style={[styles.infoCard, surfaceCard]}>
          <TextLines fontSize={16} lineHeight={22} width={160} />
          {[0, 1, 2].map((rowIndex) => (
            <View key={rowIndex} style={styles.infoRow}>
              <Skeleton width={20} height={20} borderRadius={5} />
              <View style={{ flex: 1, gap: 3 }}>
                <TextLines fontSize={14} lineHeight={19} width="40%" />
                <TextLines fontSize={13} lineHeight={19} width="75%" />
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 14, paddingBottom: 48, gap: 14 },
  upcomingSection: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  upcomingCard: { width: 260, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  calendarCard: { padding: 12, borderRadius: 18, borderWidth: 1 },
  calendarCell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  calendarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  cardList: { gap: 14 },
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  cardBody: { padding: 14, gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailScroll: { alignItems: 'center', paddingBottom: 28 },
  detailColumn: { gap: 16 },
  detailHero: { width: '100%', height: 300 },
  detailHeroOverlay: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 4 },
  actionBar: { marginHorizontal: 14, padding: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabs: { marginHorizontal: 14, padding: 14, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 24 },
  commentCard: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  section: { paddingHorizontal: 18, gap: 10 },
  infoCard: { marginHorizontal: 14, padding: 16, gap: 14, borderRadius: 18, borderWidth: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
