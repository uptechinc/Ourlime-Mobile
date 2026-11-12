import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

/**
 * Loading skeletons for every E-Learning screen. Each one mirrors the real screen's layout values
 * (paddings, gaps, radii, heights, line heights) so the page keeps its shape while data loads.
 */

type SkeletonWidth = number | `${number}%`;
type Styles = ReturnType<typeof createStyles>;

/** Placeholder colour for skeleton bars drawn on the dark lesson player box. */
const ON_DARK_PLACEHOLDER = '#334155';

const useSkeletonStyles = (): Styles => {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
};

/** Matches the box a single line of text occupies: line height (default ≈ 1.2 × font size) with a bar centred in it. */
type SkeletonLineProps = { width: SkeletonWidth; fontSize: number; lineHeight?: number; style?: StyleProp<ViewStyle> };
function SkeletonLine({ width, fontSize, lineHeight, style }: SkeletonLineProps): ReactElement {
  return (
    <View style={[{ height: lineHeight ?? Math.round(fontSize * 1.2), justifyContent: 'center' }, style]}>
      <SkeletonText width={width} height={Math.max(8, Math.round(fontSize * 0.8))} borderRadius={4} />
    </View>
  );
}

type SkeletonParagraphProps = { lines: number; fontSize: number; lineHeight?: number; lastLineWidth?: SkeletonWidth };
function SkeletonParagraph({ lines, fontSize, lineHeight, lastLineWidth = '60%' }: SkeletonParagraphProps): ReactElement {
  return (
    <View>
      {Array.from({ length: lines }).map((_line, lineIndex) => (
        <SkeletonLine key={lineIndex} width={lineIndex === lines - 1 ? lastLineWidth : '100%'} fontSize={fontSize} lineHeight={lineHeight} />
      ))}
    </View>
  );
}

function SkeletonIcon({ size, style }: { size: number; style?: StyleProp<ViewStyle> }): ReactElement {
  return <Skeleton width={size} height={size} borderRadius={Math.round(size * 0.3)} style={style} />;
}

/** components/ui/PageHeader: 40px back slot, centred 18px title, 40px right slot, 1px bottom border. */
type PageHeaderSkeletonProps = { titleWidth: number };
export function PageHeaderSkeleton({ titleWidth }: PageHeaderSkeletonProps): ReactElement {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderSide}>
        <View style={styles.pageHeaderBack}><SkeletonIcon size={24} /></View>
      </View>
      <View style={styles.pageHeaderTitle}><SkeletonLine width={titleWidth} fontSize={18} /></View>
      <View style={styles.pageHeaderSide} />
    </View>
  );
}

/* ───────────────────────────── E-Learning home (app/eLearning/index.tsx) ───────────────────────────── */

const QUICK_LINK_TEXT_WIDTHS = [56, 82, 58];
const INLINE_STAT_WIDTHS = [{ value: 22, label: 44 }, { value: 36, label: 50 }, { value: 26, label: 58 }];

/** The welcome card's Courses / Learners / Avg rating stats (value 16px over label 12px, 20px apart). */
export function ELearningInlineStatsSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.inlineStats}>
      {INLINE_STAT_WIDTHS.map((statWidths) => (
        <View key={statWidths.label} style={styles.inlineStat}>
          <SkeletonLine width={statWidths.value} fontSize={16} />
          <SkeletonLine width={statWidths.label} fontSize={12} />
        </View>
      ))}
    </View>
  );
}

function WelcomeCardSkeleton({ styles }: { styles: Styles }): ReactElement {
  return (
    <View style={styles.card}>
      <View style={styles.welcomeRow}>
        <SkeletonCircle size={48} />
        <View style={styles.flexCopy}>
          <SkeletonLine width="70%" fontSize={18} />
          <SkeletonLine width="85%" fontSize={13} lineHeight={19} />
        </View>
      </View>
      <View style={styles.welcomeStatsRow}>
        {/* The "Become an instructor" pill only appears once loading finishes, so the loading page has none. */}
        <ELearningInlineStatsSkeleton />
      </View>
      <View style={[styles.quickLinksDivider, styles.chipRow, styles.clipRow]}>
        {QUICK_LINK_TEXT_WIDTHS.map((textWidth) => (
          <View key={textWidth} style={styles.quickChip}>
            <SkeletonIcon size={16} />
            <SkeletonLine width={textWidth} fontSize={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

function HeroCardSkeleton({ styles, colors, cardWidth }: { styles: Styles; colors: AppThemeColors; cardWidth: number }): ReactElement {
  const slideWidth = cardWidth * 0.75;
  return (
    <View style={[styles.card, styles.heroCard]}>
      <View style={styles.heroBanner}>
        <View style={styles.heroLogo}>
          <Skeleton width={64} height={64} borderRadius={16} />
          <SkeletonLine width={46} fontSize={10} />
        </View>
        <View style={[styles.heroSlides, { width: slideWidth }]}>
          <Skeleton width="100%" height={128} borderRadius={0} />
          {/* Same slanted left edge as the real slides. */}
          <View style={[styles.heroSlant, { borderTopColor: colors.surface, borderRightWidth: slideWidth * 0.25 }]} />
        </View>
      </View>
      <View style={styles.heroSearchArea}>
        <View style={styles.searchPill}>
          <SkeletonIcon size={18} />
          <SkeletonLine width={170} fontSize={15} style={styles.flexCopy} />
          <Skeleton width={82} height={36} borderRadius={999} />
        </View>
        {/* "Popular:" topics come from the loaded courses, so the loading page has no row for them. */}
      </View>
    </View>
  );
}

function HomeCourseCardSkeleton({ styles }: { styles: Styles }): ReactElement {
  return (
    <View style={styles.homeCourseCard}>
      <Skeleton width="100%" height={128} borderRadius={0} />
      <View style={styles.homeCourseBody}>
        <SkeletonLine width="80%" fontSize={16} style={styles.homeCourseTitle} />
        <SkeletonLine width="40%" fontSize={12} style={styles.homeCourseInstructor} />
        <View style={styles.homeCourseMetaRow}>
          <View style={styles.metaItem}><SkeletonIcon size={14} /><SkeletonLine width={96} fontSize={12} /></View>
          <View style={styles.metaItem}><SkeletonIcon size={14} /><SkeletonLine width={52} fontSize={12} /></View>
        </View>
        <View style={styles.homeCourseFooter}>
          <SkeletonLine width={44} fontSize={14} />
          <Skeleton width={92} height={24} borderRadius={999} />
        </View>
      </View>
    </View>
  );
}

/** Course updates, the tab chips and the Learning Materials card: what the home screen shows below the hero while it loads. */
export function ELearningHomeContentSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  const { width } = useWindowDimensions();
  const updateCardWidth = (width - 64) * 0.85;
  return (
    <>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.sectionTitleRow}>
            <SkeletonIcon size={20} />
            <SkeletonLine width={124} fontSize={16} />
          </View>
          <Skeleton width={70} height={18} borderRadius={999} />
        </View>
        <View style={[styles.updatesRow, styles.clipRow]}>
          {[0, 1].map((cardIndex) => (
            <View key={cardIndex} style={[styles.updateCard, { width: updateCardWidth }]}>
              <View style={styles.updateAuthorRow}>
                <SkeletonCircle size={36} />
                <View style={styles.flexCopy}>
                  <SkeletonLine width="55%" fontSize={14} />
                  <SkeletonLine width="30%" fontSize={12} />
                </View>
              </View>
              <SkeletonLine width="75%" fontSize={14} />
              <SkeletonParagraph lines={2} fontSize={13} lineHeight={19} lastLineWidth="70%" />
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.chipRow, styles.clipRow]}>
        {/* The active tab is a solid pill. */}
        <Skeleton width={184} height={35} borderRadius={999} />
        {[70, 46].map((labelWidth) => (
          <View key={labelWidth} style={styles.tabChip}>
            <SkeletonIcon size={16} />
            <SkeletonLine width={labelWidth} fontSize={14} />
          </View>
        ))}
      </View>

      <View style={[styles.card, styles.materialsCard]}>
        <View style={[styles.chipRow, styles.clipRow]}>
          <Skeleton width={84} height={35} borderRadius={999} />
          {[112, 128, 96].map((labelWidth) => (
            <View key={labelWidth} style={styles.categoryPill}>
              <SkeletonLine width={labelWidth} fontSize={14} />
            </View>
          ))}
        </View>
        <View style={styles.divider} />
        <View style={styles.homeCourseList}>
          <HomeCourseCardSkeleton styles={styles} />
          <HomeCourseCardSkeleton styles={styles} />
        </View>
      </View>
    </>
  );
}

/**
 * The whole E-Learning home page (header, welcome card, hero with search, course updates, tabs, materials)
 * for the route-level page-access boundary. Renders its own SafeAreaView (top/left/right, like PageHeader), so it needs no wrapper.
 */
export function ELearningPageSkeleton(): ReactElement {
  const { colors } = useAppTheme();
  const styles = useSkeletonStyles();
  const { width } = useWindowDimensions();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.pageRoot}>
      <PageHeaderSkeleton titleWidth={96} />
      <View style={styles.screen}>
        <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent}>
          <WelcomeCardSkeleton styles={styles} />
          <HeroCardSkeleton styles={styles} colors={colors} cardWidth={width - 32} />
          <ELearningHomeContentSkeleton />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* ───────────────────────────── Course catalog (app/eLearning/courses/index.tsx) ───────────────────────────── */

/** The course card list under the results bar. */
export function CourseCatalogResultsSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.catalogGrid}>
      {[0, 1, 2].map((cardIndex) => (
        <View key={cardIndex} style={styles.catalogCard}>
          <Skeleton width="100%" height={180} borderRadius={0} />
          <View style={styles.catalogContent}>
            <View style={styles.rowBetween}>
              <Skeleton width={76} height={19} borderRadius={6} />
              <SkeletonLine width={64} fontSize={12} />
            </View>
            <SkeletonLine width={cardIndex === 1 ? '90%' : '72%'} fontSize={17} lineHeight={22} />
            <SkeletonLine width="42%" fontSize={13} />
            <View style={styles.catalogMetaRow}>
              {[52, 26, 24].map((textWidth) => (
                <View key={textWidth} style={styles.metaItem}><SkeletonIcon size={14} /><SkeletonLine width={textWidth} fontSize={12} /></View>
              ))}
              <SkeletonLine width={32} fontSize={13} style={styles.marginLeftAuto} />
            </View>
            <Skeleton height={42} borderRadius={12} style={styles.catalogEnroll} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ───────────────────────────── My Learning (app/eLearning/my-learning.tsx) ───────────────────────────── */

/** The enrolled course cards under the status chips and sort row. */
export function MyLearningListSkeleton(): ReactElement {
  const { isDark } = useAppTheme();
  const styles = useSkeletonStyles();
  return (
    <View style={styles.learningList}>
      {[0, 1].map((cardIndex) => (
        <View key={cardIndex} style={styles.learningCard}>
          <Skeleton width="100%" height={140} borderRadius={0} />
          <View style={styles.learningInfo}>
            <SkeletonLine width="78%" fontSize={16} lineHeight={22} />
            <SkeletonLine width="40%" fontSize={13} />
            <View style={styles.learningProgress}>
              <View style={styles.rowBetween}>
                <SkeletonLine width={72} fontSize={12} />
                <SkeletonLine width={30} fontSize={13} />
              </View>
              <View style={[styles.learningTrack, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                <Skeleton width={`${cardIndex === 0 ? 45 : 20}%`} height={8} borderRadius={4} />
              </View>
            </View>
            <Skeleton height={37} borderRadius={12} style={styles.learningResume} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ───────────────────────────── Course detail (app/eLearning/courses/[courseId].tsx) ───────────────────────────── */

const DETAIL_FACT_WIDTHS = [{ label: 50, value: 62 }, { label: 54, value: 52 }, { label: 50, value: 70 }, { label: 58, value: 64 }, { label: 30, value: 66 }, { label: 44, value: 74 }];
const DETAIL_INCLUDES_WIDTHS: SkeletonWidth[] = ['62%', '55%', '42%', '58%'];

/** Hero image, course info, tab bar, the Overview tab and the bottom enroll bar. Replaces the whole page body (renders its own ScrollView). */
export function CourseDetailPageSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.flex}>
      <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
        <Skeleton width="100%" height={220} borderRadius={0} />
        <View style={styles.detailMain}>
          <View style={styles.rowBetween}>
            <Skeleton width={84} height={21} borderRadius={8} />
            <View style={styles.inlineGap4}><SkeletonIcon size={15} /><SkeletonLine width={92} fontSize={13} /></View>
          </View>
          <SkeletonLine width="82%" fontSize={22} lineHeight={28} />
          <SkeletonParagraph lines={2} fontSize={15} lineHeight={24} lastLineWidth="64%" />
          <View style={styles.detailMetaRow}>
            {[56, 78, 70].map((textWidth) => (
              <View key={textWidth} style={styles.inlineGap6}><SkeletonIcon size={15} /><SkeletonLine width={textWidth} fontSize={13} /></View>
            ))}
          </View>
          <View style={styles.detailTabBar}>
            <View style={styles.flex}><Skeleton height={32} borderRadius={10} /></View>
            {[56, 66].map((labelWidth) => (
              <View key={labelWidth} style={styles.detailTabItem}><SkeletonLine width={labelWidth} fontSize={13} /></View>
            ))}
          </View>
          <View style={styles.detailTabContent}>
            <SkeletonLine width={108} fontSize={18} />
            <SkeletonParagraph lines={4} fontSize={15} lineHeight={24} lastLineWidth="52%" />
            <View style={styles.detailCard}>
              <SkeletonLine width={76} fontSize={16} style={styles.marginBottom4} />
              {DETAIL_INCLUDES_WIDTHS.map((rowWidth, rowIndex) => (
                <View key={rowIndex} style={styles.objectiveRow}>
                  <SkeletonIcon size={16} />
                  <SkeletonLine width={rowWidth} fontSize={14} lineHeight={20} style={styles.flex} />
                </View>
              ))}
            </View>
            <View style={styles.factsGrid}>
              {DETAIL_FACT_WIDTHS.map((factWidths, factIndex) => (
                <View key={factIndex} style={styles.fact}>
                  <SkeletonLine width={factWidths.label} fontSize={10} />
                  <SkeletonLine width={factWidths.value} fontSize={14} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={styles.detailBottomBar}>
        <View>
          <SkeletonLine width={46} fontSize={11} />
          <SkeletonLine width={52} fontSize={17} />
        </View>
        <Skeleton width={172} height={42} borderRadius={14} />
      </View>
    </View>
  );
}

/* ───────────────────────────── Lesson (app/eLearning/courses/[courseId]/lesson.tsx) ───────────────────────────── */

/** 16:9 player box, lesson badge and "Mark as Done" pill, title, type line and the content card. */
export function LessonContentSkeleton(): ReactElement {
  const { isDark } = useAppTheme();
  const styles = useSkeletonStyles();
  return (
    <>
      <View style={[styles.playerBox, { backgroundColor: isDark ? '#0f172a' : '#1e293b' }]}>
        <SkeletonCircle size={56} style={styles.onDark} />
        <Skeleton width={110} height={16} borderRadius={4} style={styles.onDark} />
      </View>
      <View style={styles.lessonBody}>
        <View style={styles.rowBetween}>
          <Skeleton width={104} height={22} borderRadius={8} />
          <View style={styles.completeToggle}>
            <SkeletonIcon size={16} />
            <SkeletonLine width={78} fontSize={12} />
          </View>
        </View>
        <SkeletonLine width="78%" fontSize={22} lineHeight={28} />
        <SkeletonLine width={110} fontSize={13} style={styles.lessonTypeLine} />
        <View style={styles.lessonContentCard}>
          <SkeletonParagraph lines={5} fontSize={15} lineHeight={24} lastLineWidth="58%" />
        </View>
      </View>
    </>
  );
}

/* ───────────────────────────── Modules (app/eLearning/courses/[courseId]/modules.tsx) ───────────────────────────── */

/** Title, counts line and module cards (first one expanded with lesson rows). Place inside the screen's `scroll` ScrollView. */
export function CourseModulesSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  return (
    <>
      <SkeletonLine width="78%" fontSize={22} />
      <SkeletonLine width={150} fontSize={13} />
      {[0, 1, 2].map((moduleIndex) => (
        <View key={moduleIndex} style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <SkeletonIcon size={20} />
            <View style={styles.moduleCopy}>
              <SkeletonLine width={moduleIndex === 0 ? '72%' : '60%'} fontSize={15} />
              <SkeletonLine width="42%" fontSize={12} />
            </View>
          </View>
          {moduleIndex === 0 ? (
            <View style={styles.moduleBody}>
              {[0, 1, 2].map((lessonIndex) => (
                <View key={lessonIndex} style={styles.moduleLessonRow}>
                  <SkeletonCircle size={20} />
                  <View style={styles.moduleLessonIcon}><SkeletonIcon size={16} /></View>
                  <View style={styles.moduleCopy}>
                    <SkeletonLine width={lessonIndex === 1 ? '80%' : '64%'} fontSize={14} />
                    <SkeletonLine width="38%" fontSize={12} />
                  </View>
                  <SkeletonIcon size={16} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </>
  );
}

/* ───────────────────────────── Grades (app/eLearning/courses/[courseId]/grades.tsx) ───────────────────────────── */

/** Title, the three stat cards and the learning path modules. Place inside the screen's centred `scroll` ScrollView. */
export function CourseGradesSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  return (
    <View style={[styles.gradesColumn, { width: Math.min(width, 760) }]}>
      <SkeletonLine width="75%" fontSize={22} />
      <View style={[styles.gradesStats, isWide && styles.row]}>
        {[{ label: 84, hint: 110 }, { label: 104, hint: 190 }, { label: 52, hint: 120 }].map((statWidths) => (
          <View key={statWidths.label} style={[styles.gradesStatCard, isWide && styles.flex]}>
            <SkeletonIcon size={20} />
            <SkeletonLine width={statWidths.label} fontSize={12} style={styles.marginTop6} />
            <SkeletonLine width={64} fontSize={28} />
            <SkeletonLine width={statWidths.hint} fontSize={12} />
          </View>
        ))}
      </View>
      <View style={styles.gradesBreakdown}>
        <SkeletonLine width={128} fontSize={18} />
        {[0, 1].map((moduleIndex) => (
          <View key={moduleIndex} style={styles.gradesModule}>
            <View style={styles.gradesModuleHeader}>
              <SkeletonIcon size={14} />
              <SkeletonLine width="55%" fontSize={13} style={styles.flex} />
              <SkeletonLine width={24} fontSize={12} />
            </View>
            {[0, 1, 2].map((lessonIndex) => (
              <View key={lessonIndex} style={styles.gradesLessonRow}>
                <SkeletonCircle size={18} />
                <View style={styles.flex}>
                  <SkeletonLine width={lessonIndex === 1 ? '78%' : '62%'} fontSize={14} />
                  <SkeletonLine width={52} fontSize={12} />
                </View>
                <SkeletonLine width={64} fontSize={13} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ───────────────────────────── Quizzes / Assignments (components/eLearning/course/CourseWorkListScreen.tsx) ───────────────────────────── */

/** Title, total line and module groups of WorkItemRow cards. Place inside the screen's `scroll` ScrollView. */
export function CourseWorkListSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  return (
    <>
      <SkeletonLine width="78%" fontSize={22} />
      <SkeletonLine width={130} fontSize={13} />
      {[0, 1].map((groupIndex) => (
        <View key={groupIndex} style={styles.workGroup}>
          <SkeletonLine width={groupIndex === 0 ? 132 : 108} fontSize={12} style={styles.marginTop6} />
          {[0, 1].map((rowIndex) => (
            <View key={rowIndex} style={styles.workRow}>
              <Skeleton width={44} height={44} borderRadius={12} />
              <View style={styles.workCopy}>
                <SkeletonLine width={rowIndex === 0 ? '78%' : '62%'} fontSize={15} />
                <View style={styles.inlineGap4}>
                  <SkeletonIcon size={12} />
                  <SkeletonLine width={130} fontSize={12} />
                </View>
              </View>
              <View style={styles.workSide}>
                <Skeleton width={78} height={18} borderRadius={999} />
                <SkeletonIcon size={18} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

/* ───────────────────────────── CXC hub (app/eLearning/cxc.tsx) ───────────────────────────── */

/** Search box, "Choose Subject", the subject cards and the papers card. Place after the banner in the screen's ScrollView. */
export function CxcHubContentSkeleton(): ReactElement {
  const { isDark } = useAppTheme();
  const styles = useSkeletonStyles();
  return (
    <>
      <View style={styles.cxcSearch}>
        <SkeletonIcon size={18} />
        <SkeletonLine width={120} fontSize={15} />
      </View>
      <SkeletonLine width={132} fontSize={17} />
      <View style={[styles.cxcSubjectRow, styles.clipRow]}>
        {[0, 1, 2].map((subjectIndex) => (
          <View key={subjectIndex} style={styles.cxcSubjectCard}>
            <SkeletonLine width={48} fontSize={11} />
            <SkeletonLine width={subjectIndex === 1 ? 96 : 110} fontSize={14} />
            <SkeletonLine width={78} fontSize={11} style={styles.marginTop4} />
          </View>
        ))}
      </View>
      <View style={styles.cxcPapers}>
        <View style={styles.inlineGap10}>
          <SkeletonIcon size={20} />
          <SkeletonLine width="75%" fontSize={16} style={styles.flex} />
        </View>
        <View style={styles.cxcPaperList}>
          {[0, 1, 2].map((paperIndex) => (
            <View key={paperIndex} style={[styles.cxcPaper, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
              <SkeletonIcon size={20} />
              <View style={styles.flex}>
                <SkeletonLine width={paperIndex === 1 ? '82%' : '68%'} fontSize={14} />
                <SkeletonLine width="40%" fontSize={12} style={styles.marginTop2} />
              </View>
              <Skeleton width={62} height={26} borderRadius={8} />
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

/* ───────────────────────────── Course discussions (app/eLearning/courses/[courseId]/discussions.tsx) ───────────────────────────── */

/** Discussion cards with the list's own padding (16) and gap (12). */
export function CourseDiscussionsSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.discussionList}>
      {[0, 1, 2].map((cardIndex) => (
        <View key={cardIndex} style={styles.discussionCard}>
          <View style={styles.rowBetween}>
            <SkeletonLine width={cardIndex === 1 ? 96 : 120} fontSize={14} />
            <SkeletonLine width={72} fontSize={12} />
          </View>
          <SkeletonParagraph lines={cardIndex === 0 ? 3 : 2} fontSize={15} lineHeight={22} lastLineWidth="55%" />
          <SkeletonLine width={112} fontSize={12} />
        </View>
      ))}
    </View>
  );
}

/* ───────────────────────────── Instructor dashboard (app/eLearning/instructor/index.tsx) ───────────────────────────── */

/** View / Quiz / Assignment, then Grade / Publish (+ delete): label widths and whether the button has an icon. */
const INSTRUCTOR_ACTION_ROWS = [
  [{ labelWidth: 34, hasIcon: true }, { labelWidth: 30, hasIcon: true }, { labelWidth: 74, hasIcon: true }],
  [{ labelWidth: 40, hasIcon: true }, { labelWidth: 50, hasIcon: false }],
];

/** Status card, stats, "My courses" header and instructor course cards. Place inside the screen's centred `scroll` ScrollView. */
export function InstructorDashboardSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  return (
    <View style={[styles.instructorColumn, { width: Math.min(width, 900) }]}>
      <View style={styles.instructorStatus}>
        <SkeletonIcon size={22} />
        <View style={styles.flex}>
          <SkeletonLine width="55%" fontSize={15} />
          <SkeletonLine width="100%" fontSize={12} />
          <SkeletonLine width="70%" fontSize={12} />
        </View>
      </View>
      <View style={[styles.instructorStats, isWide && styles.row]}>
        {[50, 60, 52].map((labelWidth) => (
          <View key={labelWidth} style={styles.instructorStatCard}>
            <SkeletonIcon size={18} />
            <SkeletonLine width={30} fontSize={24} style={styles.marginTop4} />
            <SkeletonLine width={labelWidth} fontSize={12} />
          </View>
        ))}
      </View>
      <View style={styles.instructorCoursesHeader}>
        <SkeletonLine width={104} fontSize={18} style={[styles.flex, styles.marginTop6]} />
        <Skeleton width={136} height={40} borderRadius={12} />
      </View>
      {[0, 1].map((cardIndex) => (
        <View key={cardIndex} style={styles.instructorCourseCard}>
          <View style={styles.instructorCourseTop}>
            <Skeleton width={72} height={72} borderRadius={12} />
            <View style={styles.flex}>
              <SkeletonLine width={cardIndex === 0 ? '85%' : '65%'} fontSize={15} />
              <SkeletonLine width="50%" fontSize={12} />
              <View style={styles.instructorMetaRow}>
                <Skeleton width={60} height={17} borderRadius={8} style={styles.marginRight4} />
                <SkeletonIcon size={13} /><SkeletonLine width={62} fontSize={12} />
                <SkeletonIcon size={13} /><SkeletonLine width={48} fontSize={12} />
              </View>
              <View style={styles.instructorMetaRow}>
                <SkeletonIcon size={13} /><SkeletonLine width={58} fontSize={12} />
                <SkeletonIcon size={13} /><SkeletonLine width={82} fontSize={12} />
              </View>
            </View>
          </View>
          {INSTRUCTOR_ACTION_ROWS.map((actions, rowIndex) => (
            <View key={rowIndex} style={styles.row8}>
              {actions.map((action) => (
                <View key={action.labelWidth} style={styles.actionShell}>
                  {action.hasIcon ? <SkeletonIcon size={16} /> : null}
                  <SkeletonLine width={action.labelWidth} fontSize={13} />
                </View>
              ))}
              {rowIndex === 1 ? <View style={[styles.actionShell, styles.deleteShell]}><SkeletonIcon size={16} /></View> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ───────────────────────────── Instructor course (app/eLearning/instructor/course/[courseId].tsx) ───────────────────────────── */

/** Cover, status/category, title, meta, action buttons, stats, About and Curriculum. Place inside the screen's centred `scroll` ScrollView. */
export function InstructorCourseSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.instructorCourseColumn, { width: Math.min(width, 860) }]}>
      <Skeleton width="100%" height={Math.min((Math.min(width, 860) - 32) * (9 / 16), 320)} borderRadius={16} />
      <View style={styles.inlineGap6}>
        <Skeleton width={64} height={17} borderRadius={8} />
        <SkeletonLine width={130} fontSize={12} lineHeight={17} />
      </View>
      <SkeletonLine width="78%" fontSize={22} />
      <SkeletonParagraph lines={2} fontSize={15} lineHeight={21} lastLineWidth="62%" />
      <View style={styles.inlineGap6}>
        <SkeletonIcon size={14} /><SkeletonLine width={64} fontSize={12} lineHeight={17} />
        <SkeletonIcon size={14} /><SkeletonLine width={56} fontSize={12} lineHeight={17} />
        <SkeletonLine width={104} fontSize={12} lineHeight={17} />
      </View>
      <View style={styles.row8}>
        {[30, 74, 38].map((labelWidth) => (
          <View key={labelWidth} style={[styles.actionShell, styles.actionShellSurface]}>
            <SkeletonIcon size={15} />
            <SkeletonLine width={labelWidth} fontSize={13} />
          </View>
        ))}
      </View>
      <View style={styles.row8}>
        {[48, 72, 54].map((labelWidth) => (
          <View key={labelWidth} style={styles.instructorCourseStat}>
            <SkeletonIcon size={16} />
            <SkeletonLine width={24} fontSize={20} style={styles.marginTop2} />
            <SkeletonLine width={labelWidth} fontSize={12} lineHeight={17} />
          </View>
        ))}
      </View>
      <SkeletonLine width={60} fontSize={17} style={styles.marginTop8} />
      <SkeletonParagraph lines={3} fontSize={14} lineHeight={21} lastLineWidth="48%" />
      <SkeletonLine width={96} fontSize={17} style={styles.marginTop8} />
      {[0, 1].map((moduleIndex) => (
        <View key={moduleIndex} style={styles.instructorModuleCard}>
          <SkeletonLine width={moduleIndex === 0 ? '60%' : '48%'} fontSize={15} />
          {[0, 1].map((lessonIndex) => (
            <View key={lessonIndex} style={styles.instructorLessonRow}>
              <SkeletonIcon size={16} />
              <View style={styles.flex}>
                <SkeletonLine width={lessonIndex === 0 ? '70%' : '56%'} fontSize={14} />
                <SkeletonLine width={90} fontSize={12} lineHeight={17} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ───────────────────────────── Grading (app/eLearning/instructor/grading/[courseId].tsx) ───────────────────────────── */

/** Course title, counts line and the collapsed quiz/assignment groups. Place inside the screen's centred `scroll` ScrollView. */
export function InstructorGradingSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.instructorCourseColumn, { width: Math.min(width, 820) }]}>
      <SkeletonLine width="70%" fontSize={20} />
      <SkeletonLine width="85%" fontSize={12} />
      {[0, 1, 2].map((groupIndex) => (
        <View key={groupIndex} style={styles.gradingGroup}>
          <SkeletonIcon size={20} />
          <View style={styles.flex}>
            <SkeletonLine width={groupIndex === 1 ? '75%' : '60%'} fontSize={15} />
            <SkeletonLine width="80%" fontSize={12} />
          </View>
          <SkeletonIcon size={18} />
        </View>
      ))}
    </View>
  );
}

/* ───────────────────────────── Instructor application (app/eLearning/instructor/register.tsx) ───────────────────────────── */

/** Step progress, step label, the "Select application type" section with its two cards and the Cancel / Continue buttons. */
export function InstructorApplicationSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  const { width } = useWindowDimensions();
  return (
    <ScrollView scrollEnabled={false} contentContainerStyle={styles.centredScroll}>
      <View style={[styles.applicationColumn, { width: Math.min(width, 720) }]}>
        <View style={styles.row6}>
          {[0, 1, 2, 3, 4].map((stepIndex) => <View key={stepIndex} style={styles.flex}><Skeleton height={5} borderRadius={3} /></View>)}
        </View>
        <SkeletonLine width={210} fontSize={12} />
        <View style={styles.applicationSection}>
          <SkeletonLine width={210} fontSize={18} style={styles.marginTop10} />
          <SkeletonLine width="88%" fontSize={13} lineHeight={19} style={styles.marginTopMinus6} />
          <View style={styles.applicationTypeList}>
            {[0, 1].map((typeIndex) => (
              <View key={typeIndex} style={styles.applicationTypeCard}>
                <SkeletonIcon size={22} />
                <View style={styles.flex}>
                  <SkeletonLine width={typeIndex === 0 ? '45%' : '58%'} fontSize={15} />
                  <SkeletonParagraph lines={2} fontSize={12} lineHeight={17} lastLineWidth="70%" />
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.applicationNav}>
          <View style={[styles.flex, styles.applicationSecondaryButton]}><SkeletonLine width={54} fontSize={15} /></View>
          <View style={styles.flex}><Skeleton height={50} borderRadius={14} /></View>
        </View>
      </View>
    </ScrollView>
  );
}

/* ───────────────────────────── Assignment hand-in (components/eLearning/LessonAssignment.tsx) ───────────────────────────── */

/** The "Your submission" card: heading, response box, attach button, file hint and submit button. */
export function LessonAssignmentSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.assignmentCard}>
      <SkeletonLine width={130} fontSize={16} />
      <View style={styles.assignmentInput}><SkeletonLine width={150} fontSize={15} /></View>
      <View style={styles.assignmentSecondary}>
        <SkeletonIcon size={16} />
        <SkeletonLine width={84} fontSize={14} />
      </View>
      <SkeletonLine width="88%" fontSize={12} />
      <Skeleton height={48} borderRadius={12} />
    </View>
  );
}

/* ───────────────────────────── Course reviews (components/eLearning/CourseReviews.tsx) ───────────────────────────── */

/** Review cards under the "Reviews" heading. */
export function CourseReviewsSkeleton(): ReactElement {
  const styles = useSkeletonStyles();
  return (
    <>
      {[0, 1].map((reviewIndex) => (
        <View key={reviewIndex} style={styles.reviewCard}>
          <View style={styles.rowBetween}>
            <SkeletonLine width={reviewIndex === 0 ? 120 : 96} fontSize={14} />
            <Skeleton width={86} height={14} borderRadius={4} />
          </View>
          <SkeletonParagraph lines={2} fontSize={14} lineHeight={20} lastLineWidth="60%" />
          <SkeletonLine width={84} fontSize={12} />
        </View>
      ))}
    </>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  row6: { flexDirection: 'row', gap: 6 },
  row8: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inlineGap4: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inlineGap6: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  inlineGap10: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clipRow: { flexDirection: 'row', overflow: 'hidden' },
  marginTop2: { marginTop: 2 },
  marginTop4: { marginTop: 4 },
  marginTop6: { marginTop: 6 },
  marginTop8: { marginTop: 8 },
  marginTop10: { marginTop: 10 },
  marginTopMinus6: { marginTop: -6 },
  marginBottom4: { marginBottom: 4 },
  marginRight4: { marginRight: 4 },
  marginLeftAuto: { marginLeft: 'auto' },
  onDark: { backgroundColor: ON_DARK_PLACEHOLDER },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // PageHeader
  pageRoot: { flex: 1, backgroundColor: colors.surface },
  pageHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 8 : 12, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  pageHeaderSide: { width: 40 },
  pageHeaderBack: { padding: 8 },
  pageHeaderTitle: { flex: 1, alignItems: 'center' },

  // E-Learning home (app/eLearning/index.tsx createStyles)
  screen: { flex: 1, backgroundColor: colors.canvas },
  homeContent: { padding: 16, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  flexCopy: { flex: 1, minWidth: 0 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  welcomeStatsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', rowGap: 12, columnGap: 16 },
  inlineStats: { flexDirection: 'row', gap: 20 },
  inlineStat: { alignItems: 'center' },
  quickLinksDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 2 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, paddingHorizontal: 16, paddingVertical: 9 },
  heroCard: { padding: 0, gap: 0, overflow: 'hidden' },
  heroBanner: { height: 128, flexDirection: 'row', alignItems: 'center' },
  heroLogo: { width: 96, alignItems: 'center', paddingLeft: 12 },
  heroSlides: { position: 'absolute', right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  heroSlant: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, borderTopWidth: 128, borderRightColor: 'transparent' },
  heroSearchArea: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16, gap: 12 },
  searchPill: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, paddingLeft: 16, paddingRight: 6 },
  popularRow: { alignItems: 'center', gap: 6 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  updatesRow: { gap: 12 },
  updateCard: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, padding: 16, gap: 8 },
  updateAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  materialsCard: { padding: 12 },
  categoryPill: { borderRadius: 999, backgroundColor: colors.control, paddingHorizontal: 16, paddingVertical: 9 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  homeCourseList: { gap: 12 },
  homeCourseCard: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, overflow: 'hidden' },
  homeCourseBody: { padding: 12 },
  homeCourseTitle: { marginBottom: 6 },
  homeCourseInstructor: { marginBottom: 10 },
  homeCourseMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 6 },
  homeCourseFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },

  // Course catalog
  catalogGrid: { gap: 16, marginTop: 6 },
  catalogCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  catalogContent: { padding: 16, gap: 8 },
  catalogMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  catalogEnroll: { marginTop: 4 },

  // My Learning
  learningList: { gap: 16 },
  learningCard: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  learningInfo: { padding: 16, gap: 8 },
  learningProgress: { gap: 6, marginVertical: 4 },
  learningTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  learningResume: { marginTop: 6 },

  // Course detail
  detailScroll: { paddingBottom: 100 },
  detailMain: { padding: 18, gap: 14 },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4, flexWrap: 'wrap' },
  detailTabBar: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 4, marginVertical: 6 },
  detailTabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  detailTabContent: { gap: 14, marginTop: 6 },
  detailCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 10 },
  objectiveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, rowGap: 12 },
  fact: { width: '50%', paddingHorizontal: 4, gap: 2 },
  detailBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },

  // Lesson
  playerBox: { width: '100%', aspectRatio: 16 / 9, maxHeight: 520, alignItems: 'center', justifyContent: 'center', gap: 8 },
  lessonBody: { padding: 18, gap: 14 },
  completeToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  lessonTypeLine: { marginTop: -6 },
  lessonContentCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 6 },

  // Modules
  moduleCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  moduleCopy: { flex: 1, gap: 3 },
  moduleBody: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 6 },
  moduleLessonRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  moduleLessonIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },

  // Grades
  gradesColumn: { padding: 16, gap: 16 },
  gradesStats: { gap: 10 },
  gradesStatCard: { padding: 16, gap: 4, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  gradesBreakdown: { gap: 12 },
  gradesModule: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  gradesModuleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.control },
  gradesLessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },

  // Quizzes / assignments
  workGroup: { gap: 10 },
  workRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  workCopy: { flex: 1, gap: 4 },
  workSide: { alignItems: 'flex-end', gap: 6 },

  // CXC
  cxcSearch: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, borderColor: colors.border, backgroundColor: colors.input },
  cxcSubjectRow: { gap: 12, paddingBottom: 4 },
  cxcSubjectCard: { width: 150, padding: 14, borderRadius: 16, borderWidth: 1, gap: 4, borderColor: colors.border, backgroundColor: colors.surface },
  cxcPapers: { padding: 18, borderRadius: 18, borderWidth: 1, gap: 14, borderColor: colors.border, backgroundColor: colors.surface },
  cxcPaperList: { gap: 10 },
  cxcPaper: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, gap: 12, borderColor: colors.border },

  // Discussions
  discussionList: { padding: 16, gap: 12, paddingBottom: 24 },
  discussionCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 15, gap: 9 },

  // Instructor dashboard / course / grading
  instructorColumn: { padding: 16, gap: 14 },
  instructorStatus: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: colors.control },
  instructorStats: { gap: 10 },
  instructorStatCard: { flex: 1, padding: 14, gap: 2, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  instructorCoursesHeader: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  instructorCourseCard: { padding: 12, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  instructorCourseTop: { flexDirection: 'row', gap: 12 },
  instructorMetaRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  actionShell: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  actionShellSurface: { backgroundColor: colors.surface },
  deleteShell: { flex: 0, width: 46, borderColor: colors.destructiveSurface },
  instructorCourseColumn: { padding: 16, gap: 12 },
  instructorCourseStat: { flex: 1, padding: 12, gap: 2, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  instructorModuleCard: { padding: 12, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  instructorLessonRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  gradingGroup: { minHeight: 62, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },

  // Instructor application
  centredScroll: { alignItems: 'center', paddingBottom: 40 },
  applicationColumn: { padding: 16, gap: 12 },
  applicationSection: { gap: 12 },
  applicationTypeList: { gap: 10 },
  applicationTypeCard: { minHeight: 72, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  applicationNav: { marginTop: 6, flexDirection: 'row', gap: 10 },
  applicationSecondaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },

  // Assignment hand-in
  assignmentCard: { marginTop: 14, padding: 16, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  assignmentInput: { minHeight: 140, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  assignmentSecondary: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border },

  // Reviews
  reviewCard: { padding: 14, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
