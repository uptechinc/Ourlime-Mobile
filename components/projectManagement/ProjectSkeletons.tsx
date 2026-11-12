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

/** Translucent bars that read well on the green #34d399 hero banner. */
const heroBarStyle = { backgroundColor: 'rgba(255,255,255,0.55)' };

const PROJECT_CARD_TITLE_WIDTHS: PercentWidth[] = ['62%', '48%', '56%'];
const STAT_LABEL_WIDTHS: PercentWidth[] = ['78%', '88%', '64%', '58%'];

/* ------------------------------------------------------------------ */
/* Projects list (app/projectManagement/index.tsx)                     */
/* ------------------------------------------------------------------ */

/** Mirrors one project card in "Your Projects": title + menu, badges, description, owner, progress, meta rows, footer. */
function ProjectCardSkeleton({ titleWidth }: { titleWidth: PercentWidth }): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, gap: 9 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <SkeletonLine fontSize={17} width={titleWidth} />
        <View style={{ padding: 4 }}>
          <Skeleton width={18} height={18} borderRadius={9} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Skeleton width={56} height={21} borderRadius={12} />
        <Skeleton width={50} height={21} borderRadius={12} />
      </View>
      <SkeletonParagraph fontSize={14} lineHeight={20} lines={2} lastLineWidth="58%" />
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Skeleton width={15} height={15} borderRadius={4} />
        <SkeletonLine fontSize={12} width="48%" />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <SkeletonLine fontSize={12} width={52} />
        <SkeletonLine fontSize={12} width={30} />
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.control, overflow: 'hidden' }}>
        <Skeleton width="45%" height={6} borderRadius={3} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Skeleton width={14} height={14} borderRadius={4} />
          <SkeletonLine fontSize={12} width={64} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Skeleton width={14} height={14} borderRadius={4} />
          <SkeletonLine fontSize={12} width={66} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Skeleton width={14} height={14} borderRadius={4} />
          <SkeletonLine fontSize={12} width={128} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Skeleton width={14} height={14} borderRadius={4} />
          <SkeletonLine fontSize={12} width={78} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <SkeletonLine fontSize={12} width={98} />
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Skeleton width={14} height={14} borderRadius={4} />
          <SkeletonLine fontSize={12} width={68} />
        </View>
      </View>
    </View>
  );
}

/**
 * Everything below the hero on the E-Projects list while projects load: the four stat cards and the
 * "Your Projects" section (title + create button, search, filters, cards). Rendered as one child of the
 * page's `gap: 18` content, so it keeps that gap internally.
 */
export function ProjectManagementSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {STAT_LABEL_WIDTHS.map((labelWidth, statIndex) => (
          <View key={labelWidth} style={{ width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <SkeletonLine fontSize={12} width={labelWidth} />
              <SkeletonLine fontSize={22} width={statIndex === 3 ? '60%' : '28%'} />
              {statIndex === 3 ? <SkeletonLine fontSize={11} width="70%" /> : null}
            </View>
            <SkeletonCircle size={40} />
          </View>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SkeletonLine fontSize={18} width={160} />
          <Skeleton width={42} height={42} borderRadius={12} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }}>
          <Skeleton width={17} height={17} borderRadius={5} />
          <SkeletonLine fontSize={14} width="45%" />
        </View>
        <FilterBarSkeleton />
        {PROJECT_CARD_TITLE_WIDTHS.map((titleWidth) => <ProjectCardSkeleton key={titleWidth} titleWidth={titleWidth} />)}
      </View>
    </View>
  );
}

/** Full E-Projects list page (header, hero with stats, cards) for route-level loading boundaries. */
export function ProjectsPageSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PageHeaderSkeleton titleWidth={92} />
      <ScrollView scrollEnabled={false} contentContainerStyle={{ padding: 18, paddingBottom: 48, gap: 18 }}>
        <View style={{ borderRadius: 22, padding: 18, backgroundColor: '#34d399', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={30} height={30} borderRadius={8} style={heroBarStyle} />
            <View style={{ flex: 1 }}>
              <SkeletonLine fontSize={21} width="78%" barStyle={heroBarStyle} />
              <SkeletonLine fontSize={13} width="100%" style={{ marginTop: 3 }} barStyle={heroBarStyle} />
              <SkeletonLine fontSize={13} width="70%" barStyle={heroBarStyle} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[88, 76].map((labelWidth) => (
              <View key={labelWidth} style={{ flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.28)' }}>
                <SkeletonLine fontSize={24} width={26} barStyle={heroBarStyle} />
                <SkeletonLine fontSize={12} width={labelWidth} barStyle={heroBarStyle} />
              </View>
            ))}
          </View>
        </View>
        <ProjectManagementSkeleton />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Project board (app/projectManagement/[id]/index.tsx)                */
/* ------------------------------------------------------------------ */

const PRIORITY_PILL_WIDTHS = [44, 70, 54, 72, 48];
const METRIC_LABEL_WIDTHS = [58, 56, 60, 50];
const KANBAN_LABEL_WIDTHS = [62, 84, 58];
const TASK_TITLE_WIDTHS: PercentWidth[] = ['68%', '54%', '62%'];
const MEMBER_NAME_WIDTHS: PercentWidth[] = ['46%', '38%', '52%'];
const ACTIVITY_LINE_WIDTHS: PercentWidth[] = ['92%', '84%', '76%'];

/** Board scroll content: project hero, search + priority pills, kanban tabs, task cards, team and activity cards. */
export function ProjectBoardSkeleton(): ReactNode {
  const { colors, isDark } = useAppTheme();
  const sidebarCard = { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 12 };
  return (
    <View style={{ padding: 16, paddingBottom: 48, gap: 16 }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SkeletonLine fontSize={20} width="66%" />
            <SkeletonParagraph fontSize={13} lineHeight={18} lines={2} lastLineWidth="54%" style={{ marginTop: 4 }} />
          </View>
          <Skeleton width={62} height={23} borderRadius={12} />
        </View>

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <SkeletonLine fontSize={12} width={100} />
            <SkeletonLine fontSize={12} width={30} />
          </View>
          <View style={{ height: 7, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' }}>
            <Skeleton width="40%" height={7} borderRadius={999} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderRadius: 14, padding: 12 }}>
          {METRIC_LABEL_WIDTHS.map((labelWidth) => (
            <View key={labelWidth} style={{ alignItems: 'center' }}>
              <SkeletonLine fontSize={16} width={22} />
              <SkeletonLine fontSize={11} width={labelWidth} style={{ marginTop: 2 }} />
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          <View style={{ flex: 1 }}>
            <Skeleton height={40} borderRadius={12} />
          </View>
          <Skeleton width={88} height={40} borderRadius={12} />
          <Skeleton width={104} height={40} borderRadius={12} />
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 42 }}>
          <Skeleton width={16} height={16} borderRadius={4} style={{ marginRight: 8 }} />
          <SkeletonLine fontSize={14} width="40%" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, overflow: 'hidden' }}>
          {PRIORITY_PILL_WIDTHS.map((pillWidth, pillIndex) => (
            <View key={pillWidth} style={{ width: pillWidth, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: pillIndex === 0 ? '#10b981' : colors.surface, borderColor: pillIndex === 0 ? '#10b981' : colors.border }}>
              <SkeletonLine fontSize={11} width="100%" barStyle={pillIndex === 0 ? heroBarStyle : undefined} />
            </View>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 4 }}>
        {KANBAN_LABEL_WIDTHS.map((labelWidth, tabIndex) => (
          <View key={labelWidth} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: tabIndex === 0 ? (isDark ? '#1e293b' : '#ecfdf5') : 'transparent' }}>
            <SkeletonLine fontSize={12} width={labelWidth} />
          </View>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        {TASK_TITLE_WIDTHS.map((titleWidth) => (
          <View key={titleWidth} style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width={54} height={22} borderRadius={8} />
              <Skeleton width={66} height={25} borderRadius={10} />
            </View>
            <SkeletonLine fontSize={15} width={titleWidth} />
            <SkeletonParagraph fontSize={13} lineHeight={18} lines={2} lastLineWidth="46%" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Skeleton width={13} height={13} borderRadius={4} />
                  <SkeletonLine fontSize={12} width={12} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Skeleton width={13} height={13} borderRadius={4} />
                  <SkeletonLine fontSize={12} width={64} />
                </View>
              </View>
              <Skeleton width={16} height={16} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 14 }}>
        <View style={sidebarCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Skeleton width={18} height={18} borderRadius={5} />
            <SkeletonLine fontSize={16} width={150} />
          </View>
          {MEMBER_NAME_WIDTHS.map((nameWidth) => (
            <View key={nameWidth} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <SkeletonCircle size={36} />
              <View style={{ flex: 1 }}>
                <SkeletonLine fontSize={14} width={nameWidth} />
                <SkeletonLine fontSize={12} width={52} style={{ marginTop: 2 }} />
              </View>
            </View>
          ))}
        </View>
        <View style={sidebarCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Skeleton width={18} height={18} borderRadius={5} />
            <SkeletonLine fontSize={16} width={124} />
          </View>
          {ACTIVITY_LINE_WIDTHS.map((lineWidth) => (
            <View key={lineWidth} style={{ gap: 2 }}>
              <SkeletonLine fontSize={13} width={lineWidth} />
              <SkeletonLine fontSize={11} width="34%" />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
