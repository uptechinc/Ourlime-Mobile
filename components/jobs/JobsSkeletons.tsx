import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import {
  FilterBarSkeleton,
  PageHeaderSkeleton,
  SkeletonLine,
  SkeletonParagraph,
} from '@/components/ui/WorkspaceSkeletonParts';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type PercentWidth = `${number}%`;

const SAFETY_TIP_LAST_LINE_WIDTHS: PercentWidth[] = ['70%', '55%', '62%', '40%'];
const APPLICATION_TITLE_WIDTHS: PercentWidth[] = ['70%', '58%', '64%'];
const APPLICANT_NAME_WIDTHS: PercentWidth[] = ['48%', '56%', '42%', '52%'];


/* ------------------------------------------------------------------ */
/* Jobs list (app/jobs/index.tsx)                                      */
/* ------------------------------------------------------------------ */

/** Mirrors `ProfessionalJobCard` in components/jobs/ProfessionalJobsList.tsx. */
function ProfessionalJobCardSkeleton({ titleWidth }: { titleWidth: PercentWidth }): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <Skeleton width={56} height={56} borderRadius={16} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <SkeletonLine fontSize={17} width={titleWidth} />
          <SkeletonLine fontSize={13} width="45%" />
        </View>
        <Skeleton width={84} height={20} borderRadius={999} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[82, 96, 92].map((pillWidth) => <Skeleton key={pillWidth} width={pillWidth} height={24} borderRadius={999} />)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SkeletonLine fontSize={12} width={120} />
        <Skeleton width={38} height={18} borderRadius={999} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton width={40} height={40} borderRadius={12} />
          <Skeleton width={40} height={40} borderRadius={12} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton width={96} height={38} borderRadius={12} />
          <Skeleton width={90} height={38} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

/** Mirrors `QuickTaskCard` in components/jobs/QuickTasksList.tsx. */
function QuickTaskCardSkeleton({ titleWidth }: { titleWidth: PercentWidth }): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
      <View style={{ minHeight: 118, backgroundColor: colors.successSurface, padding: 14, justifyContent: 'flex-end' }}>
        <View style={{ position: 'absolute', top: 10, right: 10, left: 90, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
          <Skeleton width={80} height={22} borderRadius={999} />
          <Skeleton width={100} height={22} borderRadius={999} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SkeletonCircle size={64} />
          <Skeleton width={52} height={26} borderRadius={999} />
        </View>
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        <SkeletonLine fontSize={18} width={titleWidth} />
        <SkeletonParagraph fontSize={14} lineHeight={20} lines={2} lastLineWidth="55%" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[74, 92, 82, 128].map((badgeWidth) => <Skeleton key={badgeWidth} width={badgeWidth} height={26} borderRadius={8} />)}
        </View>
        <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SkeletonLine fontSize={12} width={112} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Skeleton width={40} height={40} borderRadius={12} />
              <Skeleton width={40} height={40} borderRadius={12} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton width="48%" height={38} borderRadius={999} />
            <Skeleton width="48%" height={38} borderRadius={999} />
          </View>
        </View>
      </View>
    </View>
  );
}

export type JobsListSkeletonProps = {
  variant?: 'professional' | 'quickTask';
};

/** Replaces `ProfessionalJobsList` / `QuickTasksList` while jobs load: same `gap: 14, paddingHorizontal: 16` list. */
export function JobsListSkeleton({ variant = 'professional' }: JobsListSkeletonProps): ReactNode {
  const titleWidths: PercentWidth[] = ['72%', '58%', '66%'];
  return (
    <View style={{ gap: 14, paddingHorizontal: 16 }}>
      {titleWidths.map((titleWidth) => (variant === 'professional'
        ? <ProfessionalJobCardSkeleton key={titleWidth} titleWidth={titleWidth} />
        : <QuickTaskCardSkeleton key={titleWidth} titleWidth={titleWidth} />))}
    </View>
  );
}

/** Full Jobs list page (header, hero, search card, links, category chips, create buttons, tabs, cards) for route-level loading boundaries. */
export function JobsPageSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PageHeaderSkeleton titleWidth={44} />
      <ScrollView scrollEnabled={false} contentContainerStyle={{ paddingBottom: 50, gap: 16 }}>
        <View style={{ marginHorizontal: 16, marginTop: 14, alignItems: 'center', gap: 8 }}>
          <Skeleton width={180} height={24} borderRadius={999} />
          <SkeletonLine fontSize={24} width="80%" />
          <SkeletonLine fontSize={24} width="50%" />
          <SkeletonLine fontSize={14} width="75%" />
        </View>
        <View style={{ marginHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 8, gap: 4 }}>
          {[0, 1].map((row) => (
            <View key={row} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10 }}>
              <Skeleton width={18} height={18} borderRadius={5} />
              <SkeletonLine fontSize={14} width="60%" />
            </View>
          ))}
          <Skeleton width="100%" height={44} borderRadius={999} />
        </View>
        <View style={{ marginHorizontal: 16, flexDirection: 'row', gap: 8 }}>
          <Skeleton width="48%" height={40} borderRadius={12} />
          <Skeleton width="48%" height={40} borderRadius={12} />
        </View>
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', gap: 8 }}>
          {[96, 82, 110].map((chipWidth) => <Skeleton key={chipWidth} width={chipWidth} height={34} borderRadius={999} />)}
        </View>
        <View style={{ marginHorizontal: 16, flexDirection: 'row', gap: 8 }}>
          <Skeleton width="48%" height={44} borderRadius={999} />
          <Skeleton width="48%" height={44} borderRadius={999} />
        </View>
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', gap: 12 }}>
          {[0, 1].map((card) => (
            <View key={card} style={{ width: 160, minHeight: 140, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, gap: 6 }}>
              <Skeleton width={44} height={44} borderRadius={14} />
              <SkeletonLine fontSize={16} width="70%" />
              <SkeletonLine fontSize={13} width="55%" />
            </View>
          ))}
        </View>
        <View style={{ marginHorizontal: 16, flexDirection: 'row', gap: 8 }}>
          <Skeleton width="48%" height={40} borderRadius={999} />
          <Skeleton width="48%" height={40} borderRadius={999} />
        </View>
        <JobsListSkeleton />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Job detail (app/jobs/[id].tsx)                                      */
/* ------------------------------------------------------------------ */

/** Scroll content of the job detail screen: employer, overview, description, skills and safety cards. */
export function JobDetailSkeleton(): ReactNode {
  const { colors, isDark } = useAppTheme();
  const sectionCard = { padding: 18, borderRadius: 18, borderWidth: 1, gap: 12, backgroundColor: colors.surface, borderColor: colors.border };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, borderWidth: 1, gap: 14, backgroundColor: colors.surface, borderColor: colors.border }}>
        <SkeletonCircle size={58} />
        <View style={{ flex: 1 }}>
          <SkeletonLine fontSize={17} width="60%" />
          <SkeletonLine fontSize={13} width="42%" style={{ marginTop: 2 }} />
          <SkeletonLine fontSize={12} width="32%" style={{ marginTop: 4 }} />
        </View>
      </View>

      <View style={sectionCard}>
        <SkeletonLine fontSize={22} lineHeight={28} width="85%" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Skeleton width={86} height={26} borderRadius={8} />
          <Skeleton width={104} height={26} borderRadius={8} />
        </View>
        <View style={{ marginTop: 4, gap: 8 }}>
          {[124, 116, 148].map((valueWidth) => (
            <View key={valueWidth} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Skeleton width={18} height={18} borderRadius={5} />
              <SkeletonLine fontSize={14} width={valueWidth} />
            </View>
          ))}
        </View>
      </View>

      <View style={sectionCard}>
        <SkeletonLine fontSize={17} width="45%" />
        <SkeletonParagraph fontSize={15} lineHeight={24} lines={4} lastLineWidth="50%" />
      </View>

      <View style={sectionCard}>
        <SkeletonLine fontSize={17} width="68%" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[72, 94, 64, 84].map((chipWidth) => (
            <Skeleton key={chipWidth} width={chipWidth} height={31} borderRadius={10} />
          ))}
        </View>
      </View>

      <View style={{ padding: 16, borderRadius: 18, borderWidth: 1, gap: 8, backgroundColor: isDark ? '#78350f22' : '#fffbeb', borderColor: '#f59e0b' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Skeleton width={18} height={18} borderRadius={5} />
          <SkeletonLine fontSize={15} width={150} />
        </View>
        {SAFETY_TIP_LAST_LINE_WIDTHS.map((lastLineWidth, tipIndex) => (
          <View key={tipIndex} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ height: 18, justifyContent: 'center' }}>
              <Skeleton width={5} height={5} borderRadius={3} />
            </View>
            <SkeletonParagraph fontSize={13} lineHeight={18} lines={2} lastLineWidth={lastLineWidth} style={{ flex: 1 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Mirrors the absolutely positioned "Compensation / Apply Now" bar at the bottom of the job detail screen. */
export function JobDetailBottomBarSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, backgroundColor: colors.surface, borderTopColor: colors.border }}>
      <View>
        <SkeletonLine fontSize={11} width={92} />
        <SkeletonLine fontSize={17} width={118} />
      </View>
      <Skeleton width={142} height={44} borderRadius={14} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* My applications (app/jobs/applications.tsx)                         */
/* ------------------------------------------------------------------ */

/** Application cards below the hero: header + status badge, employer and date rows, cover letter, actions. */
export function ApplicationsSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 14 }}>
      {APPLICATION_TITLE_WIDTHS.map((titleWidth) => (
        <View key={titleWidth} style={{ gap: 11, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <SkeletonLine fontSize={17} width={titleWidth} />
              <SkeletonLine fontSize={12} width="52%" style={{ marginTop: 3 }} />
            </View>
            <Skeleton width={74} height={27} borderRadius={14} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Skeleton width={15} height={15} borderRadius={4} />
            <SkeletonLine fontSize={13} width="45%" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Skeleton width={15} height={15} borderRadius={4} />
            <SkeletonLine fontSize={13} width="36%" />
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
            <SkeletonParagraph fontSize={13} lineHeight={19} lines={3} lastLineWidth="48%" />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 9 }}>
            <Skeleton width={98} height={40} borderRadius={12} />
            <Skeleton width={112} height={40} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Manage jobs (app/jobs/manage.tsx)                                   */
/* ------------------------------------------------------------------ */

/** The FlatList header and applicant cards of Manage Jobs (job chips, selected job card, search, filters, applicants). */
export function JobManagementSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, overflow: 'hidden' }}>
        {[150, 128, 118].map((chipWidth, chipIndex) => (
          <View key={chipWidth} style={{ width: chipWidth, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: chipIndex === 0 ? colors.accent : colors.border, borderRadius: 999, backgroundColor: chipIndex === 0 ? colors.successSurface : colors.surface, paddingHorizontal: 12, paddingVertical: 9 }}>
            <SkeletonLine fontSize={12} width={chipWidth - 48} />
            <SkeletonLine fontSize={11} width={10} />
          </View>
        ))}
      </View>

      <View style={{ marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 15, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <SkeletonLine fontSize={18} width="65%" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
              <Skeleton width={13} height={13} borderRadius={4} />
              <SkeletonLine fontSize={11} width="72%" />
            </View>
          </View>
          <Skeleton width={38} height={38} borderRadius={12} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[62, 68, 82, 74].map((actionWidth) => (
            <Skeleton key={actionWidth} width={actionWidth} height={32} borderRadius={10} />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.input, paddingHorizontal: 12 }}>
        <Skeleton width={18} height={18} borderRadius={5} />
        <SkeletonLine fontSize={14} width="72%" />
      </View>
      <FilterBarSkeleton style={{ paddingHorizontal: 16, paddingVertical: 11 }} />
      <SkeletonLine fontSize={12} width={82} style={{ marginHorizontal: 16, marginBottom: 9 }} />

      {APPLICANT_NAME_WIDTHS.map((nameWidth) => (
        <View key={nameWidth} style={{ marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Skeleton width={22} height={22} borderRadius={5} />
            <View style={{ flex: 1 }}>
              <SkeletonLine fontSize={15} width={nameWidth} />
              <SkeletonLine fontSize={11} width="78%" />
            </View>
            <Skeleton width={21} height={21} borderRadius={5} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }}>
            <Skeleton width={68} height={24} borderRadius={999} />
            <Skeleton width={64} height={27} borderRadius={999} />
            <Skeleton width={80} height={27} borderRadius={999} />
          </View>
        </View>
      ))}
    </View>
  );
}
