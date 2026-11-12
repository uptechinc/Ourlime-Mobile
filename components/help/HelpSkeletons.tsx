import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonLine } from '@/components/ui/WorkspaceSkeletonParts';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type PercentWidth = `${number}%`;

const TICKET_SUBJECT_WIDTHS: PercentWidth[] = ['72%', '58%', '66%', '52%'];

export type TicketListSkeletonProps = {
  /** `requester`: Help → My Tickets cards. `staff`: Admin → Support queue cards (status label beside the reference). */
  variant?: 'requester' | 'staff';
};

/**
 * Support ticket cards: monospace reference row, one-line subject, category line and assignee line.
 * Requester cards use radius 18 / gap 10; the staff queue uses radius 17 / gap 9 and a status label.
 */
export function TicketListSkeleton({ variant = 'requester' }: TicketListSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  const isStaff = variant === 'staff';
  return (
    <View>
      {TICKET_SUBJECT_WIDTHS.map((subjectWidth) => (
        <View
          key={subjectWidth}
          style={{
            marginBottom: isStaff ? 9 : 10,
            padding: 15,
            borderRadius: isStaff ? 17 : 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SkeletonLine fontSize={14} width={92} />
            {isStaff ? <SkeletonLine fontSize={10} width={54} style={{ marginLeft: 7 }} /> : null}
          </View>
          <SkeletonLine fontSize={16} width={subjectWidth} style={{ marginTop: 7 }} />
          <SkeletonLine fontSize={12} width="54%" style={{ marginTop: 4 }} />
          <SkeletonLine fontSize={12} width="42%" style={{ marginTop: 3 }} />
        </View>
      ))}
    </View>
  );
}

const SAFETY_REPORT_CATEGORY_WIDTHS: PercentWidth[] = ['62%', '48%', '56%', '44%'];

/**
 * Help → My Safety Reports cards: shield icon + monospace reference, category, and status · reviewer line.
 * Radius 17, 15pt padding, 9pt gap, bordered with the destructive surface like the real cards.
 */
export function ChildSafetyReportListSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View>
      {SAFETY_REPORT_CATEGORY_WIDTHS.map((categoryWidth) => (
        <View
          key={categoryWidth}
          style={{
            marginBottom: 9,
            padding: 15,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: colors.destructiveSurface,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Skeleton width={20} height={20} borderRadius={6} />
            <SkeletonLine fontSize={14} width={104} style={{ marginLeft: 8 }} />
          </View>
          <SkeletonLine fontSize={14} width={categoryWidth} style={{ marginTop: 8 }} />
          <SkeletonLine fontSize={12} width="58%" style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Child-safety case conversation while the case first loads: the "Original report" card, then message bubbles from
 * the reporter (surface, left) and the Child Safety reviewer (red, right), at the screen's padding 12 / radius 17 /
 * max width 84%.
 */
export function ChildSafetyConversationSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const reviewerBar = { backgroundColor: 'rgba(255,255,255,0.45)' };
  const bubbles: { reviewer: boolean; lines: number }[] = [
    { reviewer: true, lines: 2 },
    { reviewer: false, lines: 1 },
    { reviewer: true, lines: 1 },
  ];
  return (
    <View style={{ padding: 12 }}>
      <View style={{ maxWidth: '84%', width: '84%', marginBottom: 8, padding: 12, borderRadius: 17, backgroundColor: colors.surface }}>
        <SkeletonLine fontSize={11} width={104} />
        <View style={{ marginTop: 4 }}>
          <SkeletonLine fontSize={14} lineHeight={20} width="100%" />
          <SkeletonLine fontSize={14} lineHeight={20} width="88%" />
          <SkeletonLine fontSize={14} lineHeight={20} width="52%" />
        </View>
      </View>
      {bubbles.map((bubble, bubbleIndex) => (
        <View key={bubbleIndex} style={{ maxWidth: '84%', width: bubble.lines > 1 ? '74%' : '56%', alignSelf: bubble.reviewer ? 'flex-end' : 'flex-start', marginVertical: 4, padding: 12, borderRadius: 17, backgroundColor: bubble.reviewer ? colors.destructive : colors.surface }}>
          <SkeletonLine fontSize={11} width={bubble.reviewer ? 132 : 84} barStyle={bubble.reviewer ? reviewerBar : undefined} />
          <View style={{ marginTop: 4 }}>
            {Array.from({ length: bubble.lines }).map((_, lineIndex) => (
              <SkeletonLine key={lineIndex} fontSize={14} lineHeight={20} width={lineIndex === bubble.lines - 1 ? '70%' : '100%'} barStyle={bubble.reviewer ? reviewerBar : undefined} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
