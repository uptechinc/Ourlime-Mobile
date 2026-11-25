import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { SkeletonLine, SkeletonParagraph } from '@/components/ui/WorkspaceSkeletonParts';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { adminRadius, adminSpace, getAdminTone } from '@/lib/admin/adminTokens';

type PercentWidth = `${number}%`;

/** Translucent bars for skeleton text placed on the active green tab. */
const activeBarStyle = { backgroundColor: 'rgba(255,255,255,0.55)' };

/** Rows per workspace group in WORKSPACE_GROUPS (app/admin/index.tsx): People, Content, Commerce, Safety and support, System. */
const HUB_GROUP_ROW_COUNTS = [2, 6, 6, 2, 4] as const;
const HUB_GROUP_TITLE_WIDTHS = [56, 64, 84, 132, 60] as const;
const HUB_ROW_TITLE_WIDTHS: PercentWidth[] = ['46%', '40%', '52%', '38%', '56%', '34%'];

/* ------------------------------------------------------------------ */
/* Admin hub (app/admin/index.tsx)                                     */
/* ------------------------------------------------------------------ */

type HubSectionSkeletonProps = { titleWidth: number; children: ReactNode };

/** An AdminSection card placeholder: surface, 1px border, radius 16, padding 16, section title. */
function HubSectionSkeleton({ titleWidth, children }: HubSectionSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ padding: 16, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <SkeletonLine fontSize={16} lineHeight={22} width={titleWidth} />
      {children}
    </View>
  );
}

/** An AdminListRow placeholder (minHeight 56, icon, title and subtitle, chevron). */
function HubRowSkeleton({ titleWidth }: { titleWidth: PercentWidth }): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <SkeletonCircle size={40} />
      <View style={{ flex: 1, gap: 4 }}>
        <SkeletonLine fontSize={14} lineHeight={20} width={titleWidth} />
        <SkeletonLine fontSize={14} lineHeight={20} width="70%" />
      </View>
      <Skeleton width={18} height={18} borderRadius={4} />
    </View>
  );
}

/** An AdminStatCard placeholder in a two-column AdminStatGrid cell. */
function HubStatSkeleton({ compact = false }: { compact?: boolean }): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexBasis: '40%', flexGrow: 1, gap: 4, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <SkeletonLine fontSize={11} lineHeight={14} width={64} />
      <Skeleton width="45%" height={compact ? 26 : 34} borderRadius={8} />
    </View>
  );
}

/** The hub: Needs attention (approvals row + 3 cards), Metrics (5 cards) and the five workspace groups. */
export function AdminOverviewSkeleton(): ReactNode {
  return (
    <View style={{ padding: 16, gap: 24 }}>
      <HubSectionSkeleton titleWidth={120}>
        <HubRowSkeleton titleWidth="44%" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[0, 1, 2].map((cardIndex) => (
            <HubStatSkeleton key={cardIndex} compact />
          ))}
        </View>
      </HubSectionSkeleton>
      <HubSectionSkeleton titleWidth={64}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((cardIndex) => (
            <HubStatSkeleton key={cardIndex} />
          ))}
        </View>
      </HubSectionSkeleton>
      {HUB_GROUP_ROW_COUNTS.map((rowCount, groupIndex) => (
        <HubSectionSkeleton key={groupIndex} titleWidth={HUB_GROUP_TITLE_WIDTHS[groupIndex]}>
          <View style={{ gap: 8 }}>
            {Array.from({ length: rowCount }, (_unused, rowIndex) => (
              <HubRowSkeleton key={rowIndex} titleWidth={HUB_ROW_TITLE_WIDTHS[rowIndex % HUB_ROW_TITLE_WIDTHS.length]} />
            ))}
          </View>
        </HubSectionSkeleton>
      ))}
    </View>
  );
}


/** Security (components/admin/AdminSecurityWorkspace.tsx): the Region policy card under the mounted tab toolbar. */
export function SecurityWorkspaceSkeleton(): ReactNode {
  // Body only: AdminScreen keeps the Security tab toolbar mounted above it while loading.
  const { colors } = useAppTheme();
  const positive = getAdminTone(colors, 'positive');
  return (
    <View style={{ padding: adminSpace.lg }}>
      <View style={{ gap: adminSpace.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: adminRadius.lg, padding: adminSpace.lg }}>
        <SkeletonLine fontSize={16} width={210} />
        {[0, 1, 2].map((optionIndex) => (
          <View key={optionIndex} style={{ minHeight: 56, justifyContent: 'center', backgroundColor: optionIndex === 0 ? positive.soft : colors.surface, borderColor: optionIndex === 0 ? positive.border : colors.border, borderWidth: 1, borderRadius: adminRadius.md, paddingHorizontal: adminSpace.md, paddingVertical: adminSpace.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: adminSpace.md }}>
              <Skeleton width={20} height={20} borderRadius={adminRadius.pill} />
              <View style={{ flex: 1, gap: adminSpace.xs }}>
                <SkeletonLine fontSize={14} width="58%" />
                <SkeletonLine fontSize={12} width="86%" />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Admin sub-workspaces (components/admin/AdminScreen.tsx)            */
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
