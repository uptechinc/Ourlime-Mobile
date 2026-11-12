import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { FilterBarSkeleton, SkeletonLine, SkeletonParagraph } from '@/components/ui/WorkspaceSkeletonParts';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type PercentWidth = `${number}%`;

/** Translucent bars for skeleton text placed on the active green tab. */
const activeBarStyle = { backgroundColor: 'rgba(255,255,255,0.55)' };

const SECTION_TAB_LABEL_WIDTHS = [44, 30, 38, 32, 36, 42];
const METRIC_LABEL_WIDTHS = [64, 62, 66, 42, 46];
/** One row per entry in REMAINING_ADMIN_WORKSPACES (app/admin/index.tsx). */
const WORKSPACE_ROW_WIDTHS: PercentWidth[] = ['46%', '40%', '52%', '38%', '56%', '34%', '48%', '42%', '50%', '36%', '30%', '44%', '40%'];

/* ------------------------------------------------------------------ */
/* Admin portal (app/admin/index.tsx)                                  */
/* ------------------------------------------------------------------ */

/** The six-way section switcher under the Admin Portal header (Overview active). */
function AdminSectionTabsSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      {SECTION_TAB_LABEL_WIDTHS.map((labelWidth, tabIndex) => (
        <View key={tabIndex} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingVertical: 10, backgroundColor: tabIndex === 0 ? '#10b981' : 'transparent', overflow: 'hidden' }}>
          <Skeleton width={15} height={15} borderRadius={4} style={tabIndex === 0 ? activeBarStyle : undefined} />
          <SkeletonLine fontSize={11} width={labelWidth} style={{ marginLeft: 5 }} barStyle={tabIndex === 0 ? activeBarStyle : undefined} />
        </View>
      ))}
    </View>
  );
}

export type AdminOverviewSkeletonProps = {
  /** True while page access is still resolving, before the real section switcher renders. */
  withSectionTabs?: boolean;
};

/** Overview & Metrics: title, five metric cards (47% grid), notice banner, and the Additional Workspaces list. */
export function AdminOverviewSkeleton({ withSectionTabs = false }: AdminOverviewSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1 }}>
      {withSectionTabs ? <AdminSectionTabsSkeleton /> : null}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <View style={{ padding: 20, gap: 16 }}>
          <SkeletonLine fontSize={16} width={156} />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {METRIC_LABEL_WIDTHS.map((labelWidth, metricIndex) => (
              <View key={metricIndex} style={{ width: '47%', padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Skeleton width={22} height={22} borderRadius={6} />
                <SkeletonLine fontSize={24} width={48} style={{ marginTop: 8 }} />
                <SkeletonLine fontSize={12} width={labelWidth} style={{ marginTop: 2 }} />
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 16, backgroundColor: colors.successSurface }}>
            <Skeleton width={20} height={20} borderRadius={6} />
            <SkeletonParagraph fontSize={13} lineHeight={19} lines={2} lastLineWidth="62%" style={{ flex: 1 }} />
          </View>

          <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <SkeletonLine fontSize={16} width={176} />
            <SkeletonParagraph fontSize={12} lineHeight={18} lines={2} lastLineWidth="70%" style={{ marginTop: 6, marginBottom: 8 }} />
            {WORKSPACE_ROW_WIDTHS.map((titleWidth, rowIndex) => (
              <View key={rowIndex} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border }}>
                <Skeleton width={19} height={19} borderRadius={5} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <SkeletonLine fontSize={14} width={titleWidth} />
                </View>
                <Skeleton width={34} height={19} borderRadius={999} style={{ marginRight: 8 }} />
                <Skeleton width={18} height={18} borderRadius={5} />
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/** Reports tab (components/admin/ModerationSection.tsx): sub-tab switcher, search, filters and report cards. */
export function ModerationSectionSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const reasonWidths: PercentWidth[] = ['54%', '42%', '60%', '48%'];
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 14, backgroundColor: colors.control, borderRadius: 14, padding: 3 }}>
        {[84, 82].map((labelWidth, tabIndex) => (
          <View key={labelWidth} style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12, backgroundColor: tabIndex === 0 ? colors.elevated : 'transparent' }}>
            <SkeletonLine fontSize={12} width={labelWidth} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 12, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }}>
        <Skeleton width={18} height={18} borderRadius={5} />
        <View style={{ flex: 1, paddingHorizontal: 11 }}>
          <SkeletonLine fontSize={14} width="78%" />
        </View>
        <Skeleton width={17} height={17} borderRadius={5} />
      </View>
      <FilterBarSkeleton style={{ marginBottom: 12 }} />
      {reasonWidths.map((reasonWidth) => (
        <View key={reasonWidth} style={{ padding: 15, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <SkeletonLine fontSize={14} width={reasonWidth} />
            <SkeletonLine fontSize={10} width={48} />
          </View>
          <SkeletonLine fontSize={12} width="62%" style={{ marginTop: 5 }} />
          <SkeletonParagraph fontSize={14} lineHeight={19} lines={2} lastLineWidth="50%" style={{ marginTop: 8 }} />
          <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <SkeletonLine fontSize={10} width={46} />
            </View>
            <SkeletonLine fontSize={12} width={44} />
            <Skeleton width={16} height={16} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Users tab (components/admin/UserManagementSection.tsx): search + export/import buttons, filters, count, user rows. */
export function UserManagementSectionSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const nameWidths: PercentWidth[] = ['52%', '44%', '60%', '38%', '56%', '46%'];
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        <View style={{ flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
          <Skeleton width={18} height={18} borderRadius={5} />
          <View style={{ flex: 1, paddingHorizontal: 11 }}>
            <SkeletonLine fontSize={14} width="80%" />
          </View>
        </View>
        <Skeleton width={45} height={44} borderRadius={14} style={{ marginLeft: 8 }} />
        <Skeleton width={45} height={44} borderRadius={14} style={{ marginLeft: 7 }} />
      </View>
      <FilterBarSkeleton />
      <SkeletonLine fontSize={12} width={150} style={{ marginVertical: 10 }} />
      {nameWidths.map((nameWidth) => (
        <View key={nameWidth} style={{ flexDirection: 'row', alignItems: 'center', padding: 13, marginBottom: 9, borderRadius: 15, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border }}>
          <SkeletonCircle size={44} />
          <View style={{ flex: 1, marginLeft: 11 }}>
            <SkeletonLine fontSize={14} width={nameWidth} />
            <SkeletonLine fontSize={12} width="70%" style={{ marginTop: 2 }} />
            <SkeletonLine fontSize={10} width={44} style={{ marginTop: 4 }} />
          </View>
          <Skeleton width={18} height={18} borderRadius={5} />
        </View>
      ))}
    </View>
  );
}

/** Pages tab (components/admin/PageAccessAdminSection.tsx): header card with tabs/search/status pills, default buttons, page rows. */
export function PageAccessSectionSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const pageNameWidths: PercentWidth[] = ['44%', '36%', '52%', '40%', '48%', '32%'];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border }}>
        <SkeletonLine fontSize={18} width={160} />
        <SkeletonParagraph fontSize={14} lines={2} lastLineWidth="58%" style={{ marginTop: 5 }} />
        <View style={{ marginTop: 14, flexDirection: 'row' }}>
          <View style={{ marginRight: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.successSurface }}>
            <SkeletonLine fontSize={14} width={42} />
          </View>
          <View style={{ marginRight: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.control }}>
            <SkeletonLine fontSize={14} width={82} />
          </View>
        </View>
        <View style={{ marginTop: 13, height: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
          <Skeleton width={17} height={17} borderRadius={5} />
          <View style={{ flex: 1, paddingHorizontal: 9 }}>
            <SkeletonLine fontSize={14} width="62%" />
          </View>
        </View>
        <View style={{ marginTop: 10, flexDirection: 'row', overflow: 'hidden' }}>
          {[22, 40, 52, 46, 58].map((labelWidth, pillIndex) => (
            <View key={labelWidth} style={{ marginRight: 7, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: pillIndex === 0 ? colors.accent : colors.control }}>
              <SkeletonLine fontSize={11} width={labelWidth} barStyle={pillIndex === 0 ? activeBarStyle : undefined} />
            </View>
          ))}
        </View>
      </View>

      <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
        <Skeleton width={138} height={39} borderRadius={11} style={{ marginRight: 8, marginBottom: 8 }} />
        <Skeleton width={124} height={39} borderRadius={11} style={{ marginBottom: 8 }} />
      </View>

      {pageNameWidths.map((nameWidth) => (
        <View key={nameWidth} style={{ marginBottom: 9, flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ padding: 4 }}>
            <Skeleton width={20} height={20} borderRadius={5} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <SkeletonLine fontSize={14} width={nameWidth} />
            <SkeletonLine fontSize={11} width="34%" style={{ marginTop: 2 }} />
            <SkeletonLine fontSize={10} width={136} style={{ marginTop: 4 }} />
          </View>
          <SkeletonLine fontSize={10} width={48} />
        </View>
      ))}
    </View>
  );
}

/** Security tab (components/admin/AdminSecurityWorkspace.tsx): sub-tab pills and the Region Blocking policy card. */
export function SecurityWorkspaceSkeleton(): ReactNode {
  const { colors, isDark } = useAppTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 8, overflow: 'hidden' }}>
        {[122, 84, 132, 104, 96].map((labelWidth, tabIndex) => (
          <View key={labelWidth} style={{ marginRight: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: tabIndex === 0 ? colors.accent : colors.control }}>
            <SkeletonLine fontSize={12} width={labelWidth - 28} barStyle={tabIndex === 0 ? activeBarStyle : undefined} />
          </View>
        ))}
      </View>
      <View style={{ marginTop: 16, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16 }}>
        <SkeletonLine fontSize={14} width={210} style={{ marginBottom: 10 }} />
        {[0, 1, 2].map((optionIndex) => (
          <View key={optionIndex} style={{ backgroundColor: optionIndex === 0 ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#18181b' : '#fafafa'), borderColor: optionIndex === 0 ? '#10b981' : colors.border, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Skeleton width={16} height={16} borderRadius={8} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <SkeletonLine fontSize={13} width="58%" />
                <SkeletonLine fontSize={11} width="86%" style={{ marginTop: 2 }} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Child Safety cases (app/admin/child-safety/index.tsx)               */
/* ------------------------------------------------------------------ */

/** Case cards: shield icon, reference, category, two-line description, priority/status line, chevron. */
export function ChildSafetyListSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const categoryWidths: PercentWidth[] = ['56%', '48%', '62%', '44%'];
  return (
    <View>
      {categoryWidths.map((categoryWidth) => (
        <View key={categoryWidth} style={{ marginBottom: 10, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row' }}>
            <Skeleton width={21} height={21} borderRadius={6} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <SkeletonLine fontSize={14} width="38%" />
              <SkeletonLine fontSize={14} width={categoryWidth} style={{ marginTop: 4 }} />
              <SkeletonParagraph fontSize={14} lineHeight={19} lines={2} lastLineWidth="64%" style={{ marginTop: 6 }} />
              <SkeletonLine fontSize={11} width="46%" style={{ marginTop: 9 }} />
            </View>
            <Skeleton width={18} height={18} borderRadius={5} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Admin sub-workspaces (components/admin/AdminWorkspaceShell.tsx)     */
/* ------------------------------------------------------------------ */

/** Status pill label widths for all / active / pending / approved / rejected / archived / disabled. */
const WORKSPACE_STATUS_PILL_WIDTHS = [16, 40, 50, 58, 52, 54, 50];
const WORKSPACE_RECORD_TITLE_WIDTHS: PercentWidth[] = ['58%', '46%', '64%', '40%', '54%', '48%'];

/**
 * Body of an admin sub-workspace while it loads, inside the shell's real header.
 * Mirrors the shared collection layout (Products, Communities, Stickers): search + sort row,
 * status pills, record count and 54pt-thumbnail record rows, on the shell's 16pt scroll padding.
 */
export function AdminWorkspaceBodySkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <View style={{ flex: 1, height: 42, marginRight: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
            <Skeleton width={17} height={17} borderRadius={5} />
            <View style={{ flex: 1, paddingHorizontal: 11 }}>
              <SkeletonLine fontSize={14} width="58%" />
            </View>
          </View>
          <View style={{ height: 42, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13 }}>
            <Skeleton width={16} height={16} borderRadius={4} />
            <SkeletonLine fontSize={14} width={46} style={{ marginLeft: 7 }} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 14, overflow: 'hidden' }}>
          {WORKSPACE_STATUS_PILL_WIDTHS.map((labelWidth, pillIndex) => (
            <View key={pillIndex} style={{ marginRight: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: pillIndex === 0 ? colors.accent : colors.control }}>
              <SkeletonLine fontSize={12} width={labelWidth} barStyle={pillIndex === 0 ? activeBarStyle : undefined} />
            </View>
          ))}
        </View>

        <SkeletonLine fontSize={12} width={96} style={{ marginBottom: 10 }} />

        {WORKSPACE_RECORD_TITLE_WIDTHS.map((titleWidth) => (
          <View key={titleWidth} style={{ marginBottom: 10, padding: 13, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
            <Skeleton width={54} height={54} borderRadius={14} />
            <View style={{ flex: 1, marginLeft: 11 }}>
              <SkeletonLine fontSize={14} width={titleWidth} />
              <SkeletonLine fontSize={12} width="72%" style={{ marginTop: 3 }} />
              <SkeletonLine fontSize={10} width={44} style={{ marginTop: 5 }} />
            </View>
            <Skeleton width={18} height={18} borderRadius={5} />
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* User content (components/admin/AdminUserContentWorkspace.tsx)       */
/* ------------------------------------------------------------------ */

const USER_CONTENT_META_WIDTHS = [148, 132, 156];

/** Content cards under the filter pills and search: media strip on the first, status badge + meta, title, ID line, View / Delete buttons. */
export function AdminUserContentListSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View>
      {USER_CONTENT_META_WIDTHS.map((metaWidth, cardIndex) => (
        <View key={metaWidth} style={{ marginTop: 13, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border }}>
          {cardIndex === 0 ? (
            <View style={{ flexDirection: 'row', padding: 8, overflow: 'hidden' }}>
              {[0, 1, 2].map((tileIndex) => (
                <Skeleton key={tileIndex} width={138} height={138} borderRadius={13} style={{ marginRight: 8 }} />
              ))}
            </View>
          ) : null}
          <View style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <View style={{ marginRight: 7, marginBottom: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.successSurface }}>
                <SkeletonLine fontSize={10} width={40} />
              </View>
              <SkeletonLine fontSize={11} width={metaWidth} style={{ marginBottom: 5 }} />
            </View>
            <SkeletonParagraph fontSize={14} lineHeight={20} lines={2} lastLineWidth="58%" style={{ marginTop: 4 }} />
            <SkeletonLine fontSize={10} width="66%" style={{ marginTop: 5 }} />
            <View style={{ marginTop: 12, flexDirection: 'row' }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 10, backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}>
                <Skeleton width={14} height={14} borderRadius={4} />
                <SkeletonLine fontSize={14} width={34} style={{ marginLeft: 6 }} />
              </View>
              <View style={{ flex: 1, marginLeft: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 10, backgroundColor: colors.destructiveSurface }}>
                <Skeleton width={14} height={14} borderRadius={4} />
                <SkeletonLine fontSize={14} width={44} style={{ marginLeft: 6 }} />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Report review (app/admin/reports/[reportId]/index.tsx)              */
/* ------------------------------------------------------------------ */

/** The reported content preview while it loads: author row, text, and the Open / View Comments buttons. */
export function ReportedContentPreviewSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <SkeletonCircle size={38} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <SkeletonLine fontSize={14} width="48%" />
          <SkeletonLine fontSize={12} width="32%" />
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.control }}>
          <SkeletonLine fontSize={11} width={66} />
        </View>
      </View>
      <SkeletonParagraph fontSize={14} lineHeight={20} lines={3} lastLineWidth="54%" style={{ marginBottom: 10 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.accent }}>
          <Skeleton width={14} height={14} borderRadius={4} style={activeBarStyle} />
          <SkeletonLine fontSize={12} width={92} style={{ marginLeft: 6 }} barStyle={activeBarStyle} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}>
          <Skeleton width={14} height={14} borderRadius={4} />
          <SkeletonLine fontSize={12} width={104} style={{ marginLeft: 6 }} />
        </View>
      </View>
    </View>
  );
}

type ReportFieldSkeletonProps = {
  labelWidth: number;
  valueWidth: PercentWidth;
};

/** An uppercase 10pt label over a selectable value. */
function ReportFieldSkeleton({ labelWidth, valueWidth }: ReportFieldSkeletonProps): ReactNode {
  return (
    <View style={{ marginTop: 12 }}>
      <SkeletonLine fontSize={10} width={labelWidth} />
      <SkeletonLine fontSize={14} width={valueWidth} style={{ marginTop: 2 }} />
    </View>
  );
}

type ReportPersonRowSkeletonProps = {
  labelWidth: number;
  nameWidth: PercentWidth;
};

/** Reporter / Reported User: label, 26pt avatar with name and username, and the small View Profile pill. */
function ReportPersonRowSkeleton({ labelWidth, nameWidth }: ReportPersonRowSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginTop: 12 }}>
      <SkeletonLine fontSize={10} width={labelWidth} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <SkeletonCircle size={26} />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <SkeletonLine fontSize={14} width={nameWidth} />
            <SkeletonLine fontSize={11} width="28%" />
          </View>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.control }}>
          <SkeletonLine fontSize={10} width={60} />
        </View>
      </View>
    </View>
  );
}

type ReportActionGroupSkeleton = {
  labelWidth: number;
  surface: 'successSurface' | 'warningSurface' | 'destructiveSurface' | 'control';
  actionWidths: number[];
};

/** Label widths for each moderation ACTIONS entry, grouped and coloured as on the screen. */
const REPORT_ACTION_GROUPS: ReportActionGroupSkeleton[] = [
  { labelWidth: 72, surface: 'successSurface', actionWidths: [82, 128] },
  { labelWidth: 56, surface: 'warningSurface', actionWidths: [84, 136, 88, 108, 108, 118] },
  { labelWidth: 58, surface: 'destructiveSurface', actionWidths: [76, 88, 100, 92, 136, 136, 144, 128, 92, 62] },
  { labelWidth: 74, surface: 'control', actionWidths: [140, 140, 128] },
];

/** Report Review body: reported-content card, report metadata card, and the grouped Available actions. */
export function AdminReportReviewSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <View style={{ padding: 16 }}>
        <View style={{ marginBottom: 14, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Skeleton width={16} height={16} borderRadius={4} />
              <SkeletonLine fontSize={13} width={136} style={{ marginLeft: 6 }} />
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.control }}>
              <SkeletonLine fontSize={10} width={30} />
            </View>
          </View>
          <ReportedContentPreviewSkeleton />
        </View>

        <View style={{ padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              <SkeletonLine fontSize={18} width="56%" />
            </View>
            <SkeletonLine fontSize={10} width={40} />
          </View>
          <SkeletonParagraph fontSize={14} lineHeight={20} lines={2} lastLineWidth="64%" style={{ marginTop: 8 }} />
          <ReportFieldSkeleton labelWidth={40} valueWidth="22%" />
          <ReportFieldSkeleton labelWidth={78} valueWidth="16%" />
          <ReportFieldSkeleton labelWidth={56} valueWidth="62%" />
          <ReportPersonRowSkeleton labelWidth={54} nameWidth="42%" />
          <ReportFieldSkeleton labelWidth={70} valueWidth="66%" />
          <ReportPersonRowSkeleton labelWidth={88} nameWidth="38%" />
        </View>

        <SkeletonLine fontSize={16} width={136} style={{ marginTop: 18, marginBottom: 10 }} />
        {REPORT_ACTION_GROUPS.map((group) => (
          <View key={group.labelWidth} style={{ marginBottom: 13 }}>
            <SkeletonLine fontSize={11} width={group.labelWidth} style={{ marginBottom: 7 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {group.actionWidths.map((actionWidth, actionIndex) => (
                <View key={actionIndex} style={{ marginRight: 7, marginBottom: 7, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: colors[group.surface] }}>
                  <SkeletonLine fontSize={11} width={actionWidth} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Child Safety case detail (app/admin/child-safety/[reportId].tsx)    */
/* ------------------------------------------------------------------ */

const CASE_STATUS_BUTTON_WIDTHS = [72, 96, 70, 112, 64, 150, 46];
const CASE_PRIORITY_BUTTON_WIDTHS = [56, 34, 54, 64];
/** Add note … Purge: the always-present reviewer buttons (Release legal hold only shows on held cases). */
const CASE_ACTION_BUTTON_WIDTHS = [68, 92, 62, 112, 80, 182, 58, 176];
const CASE_HISTORY_ACTION_WIDTHS: PercentWidth[] = ['38%', '30%', '44%'];

type CaseActionButtonSkeletonProps = {
  labelWidth: number;
  danger?: boolean;
};

/** Mirrors the screen's ActionButton: 12pt padding, radius 13, bold white 14pt label on accent (or destructive). */
function CaseActionButtonSkeleton({ labelWidth, danger = false }: CaseActionButtonSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ alignItems: 'center', padding: 12, borderRadius: 13, backgroundColor: danger ? colors.destructive : colors.accent }}>
      <SkeletonLine fontSize={14} width={labelWidth} barStyle={activeBarStyle} />
    </View>
  );
}

/** Case detail body below the header: secure conversation button, case card, reviewer action card and case history. */
export function ChildSafetyCaseDetailSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const inputStyle = { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input };
  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <View style={{ padding: 16 }}>
        <View style={{ marginBottom: 12, padding: 14, borderRadius: 15, alignItems: 'center', backgroundColor: colors.destructive }}>
          <SkeletonLine fontSize={14} width={232} barStyle={activeBarStyle} />
        </View>

        <View style={{ padding: 17, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <SkeletonLine fontSize={11} width={124} />
          <SkeletonLine fontSize={20} width="62%" style={{ marginTop: 7 }} />
          <SkeletonLine fontSize={14} width="74%" style={{ marginTop: 8 }} />
          <SkeletonParagraph fontSize={14} lineHeight={22} lines={3} lastLineWidth="48%" style={{ marginTop: 13 }} />
        </View>

        <View style={{ marginTop: 14, padding: 16, borderRadius: 19, backgroundColor: colors.surface }}>
          <SkeletonLine fontSize={14} width={112} />
          <View style={[inputStyle, { minHeight: 90, marginTop: 10 }]}>
            <SkeletonLine fontSize={14} width="64%" />
          </View>
          <SkeletonLine fontSize={12} width={62} style={{ marginTop: 12 }} />
          <View style={{ flexDirection: 'row', gap: 7, paddingTop: 7, overflow: 'hidden' }}>
            {CASE_STATUS_BUTTON_WIDTHS.map((labelWidth, buttonIndex) => (
              <CaseActionButtonSkeleton key={buttonIndex} labelWidth={labelWidth} />
            ))}
          </View>
          <SkeletonLine fontSize={12} width={70} style={{ marginTop: 12 }} />
          <View style={{ flexDirection: 'row', gap: 7, paddingTop: 7, overflow: 'hidden' }}>
            {CASE_PRIORITY_BUTTON_WIDTHS.map((labelWidth, buttonIndex) => (
              <CaseActionButtonSkeleton key={buttonIndex} labelWidth={labelWidth} />
            ))}
          </View>
          <View style={[inputStyle, { marginTop: 12 }]}>
            <SkeletonLine fontSize={14} width="56%" />
          </View>
          <View style={[inputStyle, { marginTop: 8 }]}>
            <SkeletonLine fontSize={14} width="60%" />
          </View>
          <View style={{ marginTop: 11, gap: 8 }}>
            {CASE_ACTION_BUTTON_WIDTHS.map((labelWidth, buttonIndex) => (
              <CaseActionButtonSkeleton key={buttonIndex} labelWidth={labelWidth} danger={buttonIndex === CASE_ACTION_BUTTON_WIDTHS.length - 1} />
            ))}
          </View>
        </View>

        <View style={{ marginTop: 14, padding: 16, borderRadius: 19, backgroundColor: colors.surface }}>
          <SkeletonLine fontSize={14} width={96} />
          {CASE_HISTORY_ACTION_WIDTHS.map((actionWidth) => (
            <View key={actionWidth} style={{ marginTop: 12, borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: 10 }}>
              <SkeletonLine fontSize={14} width={actionWidth} />
              <SkeletonLine fontSize={14} width="76%" style={{ marginTop: 3 }} />
              <SkeletonLine fontSize={11} width={124} style={{ marginTop: 3 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
