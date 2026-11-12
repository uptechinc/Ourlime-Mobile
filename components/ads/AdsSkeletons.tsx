import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/*
 * Loading skeletons for the ads marketplace screens; each mirrors the layout of the page it stands in for
 * (rendered inside AdsScreen, below the real header).
 */

function SkeletonCard({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 }}>{children}</View>;
}

function ChipRow({ count = 2 }: { count?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {Array.from({ length: count }).map((_, index) => <Skeleton key={index} width={70} height={24} borderRadius={12} />)}
    </View>
  );
}

/** Heading, optional search/tabs row and a column of record cards (browse, my offers, my bookings). */
export function AdsListSkeleton({ rows = 3, withSearch = false, withTabs = false }: { rows?: number; withSearch?: boolean; withTabs?: boolean }) {
  return (
    <View style={{ gap: 14 }}>
      <SkeletonText width="55%" height={26} />
      <SkeletonText width="75%" height={14} />
      {withSearch ? <Skeleton height={46} borderRadius={12} /> : null}
      {withSearch ? <ChipRow count={4} /> : null}
      {withTabs ? <ChipRow count={4} /> : null}
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonCard key={index}>
          <SkeletonText width="70%" height={18} />
          <ChipRow />
          <SkeletonText lines={2} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 6 }}>
              <Skeleton width={90} height={22} />
              <Skeleton width={60} height={12} />
            </View>
            <Skeleton width={110} height={40} borderRadius={14} />
          </View>
        </SkeletonCard>
      ))}
    </View>
  );
}

/** Title card with price and stats, then a details card (offer detail, booking detail). */
export function AdsDetailSkeleton() {
  return (
    <View style={{ gap: 14 }}>
      <SkeletonCard>
        <SkeletonText width="80%" height={24} />
        <ChipRow />
        <Skeleton width={120} height={28} />
        <SkeletonText lines={3} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} width="46%" height={38} />)}
        </View>
        <Skeleton height={46} borderRadius={14} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonText width="45%" height={18} />
        <SkeletonText lines={4} />
      </SkeletonCard>
    </View>
  );
}

/** Heading and stacked form sections (book, proof, review, registration, create and edit offer). */
export function AdsFormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <View style={{ gap: 14 }}>
      <SkeletonText width="60%" height={26} />
      <SkeletonText width="85%" height={14} />
      {Array.from({ length: sections }).map((_, index) => (
        <SkeletonCard key={index}>
          <SkeletonText width="40%" height={16} />
          <View style={{ gap: 6 }}><Skeleton width={100} height={12} /><Skeleton height={46} borderRadius={12} /></View>
          <View style={{ gap: 6 }}><Skeleton width={120} height={12} /><Skeleton height={46} borderRadius={12} /></View>
        </SkeletonCard>
      ))}
      <Skeleton height={46} borderRadius={14} />
    </View>
  );
}

/** Heading with action, metric tiles, tier card and recent offers (host dashboard). */
export function AdsDashboardSkeleton() {
  return (
    <View style={{ gap: 14 }}>
      <SkeletonText width="55%" height={26} />
      <SkeletonText width="40%" height={14} />
      <Skeleton height={46} borderRadius={14} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={{ flexBasis: '46%', flexGrow: 1 }}>
            <SkeletonCard>
              <Skeleton width={80} height={12} />
              <Skeleton width={70} height={24} />
              <Skeleton width={60} height={10} />
            </SkeletonCard>
          </View>
        ))}
      </View>
      <SkeletonCard>
        <SkeletonText width="35%" height={18} />
        <Skeleton width={90} height={26} borderRadius={13} />
        <Skeleton height={8} borderRadius={4} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonText width="45%" height={18} />
        {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} height={64} borderRadius={12} />)}
      </SkeletonCard>
    </View>
  );
}

/** Two host-type choice cards (become a host). */
export function AdsChoiceSkeleton() {
  return (
    <View style={{ gap: 14 }}>
      <SkeletonText width="55%" height={26} />
      <SkeletonText width="65%" height={14} />
      {Array.from({ length: 2 }).map((_, index) => (
        <SkeletonCard key={index}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={48} height={48} borderRadius={14} />
            <Skeleton width={140} height={20} />
          </View>
          <SkeletonText lines={2} />
          <SkeletonText lines={3} lineHeight={10} />
        </SkeletonCard>
      ))}
    </View>
  );
}

/** Status card with progress and requirement rows (host verification). */
export function AdsVerificationSkeleton() {
  return (
    <View style={{ gap: 14 }}>
      <SkeletonText width="55%" height={26} />
      <SkeletonText width="80%" height={14} />
      <SkeletonCard>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton width={150} height={18} />
          <Skeleton width={80} height={24} borderRadius={12} />
        </View>
        <Skeleton height={8} borderRadius={4} />
        <Skeleton height={48} borderRadius={12} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonText width="60%" height={18} />
        {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} height={84} borderRadius={12} />)}
      </SkeletonCard>
    </View>
  );
}
