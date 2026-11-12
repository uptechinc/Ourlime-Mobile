import type { ReactNode } from 'react';
import { View } from 'react-native';
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
