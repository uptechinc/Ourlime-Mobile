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
const WORKSPACE_ROW_WIDTHS: PercentWidth[] = ['46%', '40%', '52%', '38%', '56%', '34%', '48%', '42%', '50%', '36%'];

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
