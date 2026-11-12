import type { ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityTab } from '@/lib/types/community';
import {
  CommunityAboutWorkspaceSkeleton,
  CommunityEventsWorkspaceSkeleton,
  CommunityMembersWorkspaceSkeleton,
  CommunityPollsWorkspaceSkeleton,
  CommunityPostsSkeleton,
  SkeletonLines,
} from './CommunityWorkspaceSkeletons';

type CommunityDetailSkeletonProps = {
  activeTab?: CommunityTab;
};

// Posts, Events, Polls, About, Members pills: 15px padding each side + 14px heavy label.
const TAB_WIDTHS = [71, 80, 68, 75, 92];

/**
 * Body of app/communities/[id] while the community loads (the top bar above stays live):
 * CommunityDetailHeader (220px banner, title, badges, description, creator + date, stats, actions),
 * the workspace tab strip and the active tab's workspace.
 */
export default function CommunityDetailSkeleton({ activeTab = 'posts' }: CommunityDetailSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < 390;

  return (
    <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={{ height: 220, backgroundColor: colors.successSurface }}>
        <Skeleton width="100%" height="100%" borderRadius={0} />
      </View>

      <View style={{ backgroundColor: colors.surface, padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <SkeletonLines fontSize={25} lineHeight={30} width="66%" />
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 9 }}>
          <Skeleton width={78} height={23} borderRadius={999} />
          <Skeleton width={66} height={23} borderRadius={999} />
        </View>

        <View style={{ marginTop: 13 }}>
          <SkeletonLines lines={2} fontSize={14} lineHeight={21} lastLineWidth="72%" />
        </View>

        <View style={{ flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'flex-start' : 'center', marginTop: 13, gap: isNarrow ? 9 : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: isNarrow ? undefined : 1 }}>
            <SkeletonCircle size={34} />
            <View style={{ marginLeft: 9 }}>
              <SkeletonLines fontSize={11} lineHeight={14} width={56} />
              <SkeletonLines fontSize={14} lineHeight={18} width={118} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: isNarrow ? 43 : 10 }}>
            <Skeleton width={15} height={15} borderRadius={4} />
            <Skeleton width={92} height={9} borderRadius={4} style={{ marginLeft: 5 }} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 17, padding: 13, borderRadius: 15, backgroundColor: colors.control }}>
          {[0, 1, 2].map((statIndex) => (
            <View key={statIndex} style={{ flex: 1, flexDirection: 'row' }}>
              {statIndex > 0 ? <View style={{ width: 1, backgroundColor: colors.border }} /> : null}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <SkeletonLines fontSize={18} lineHeight={24} width={34} />
                <SkeletonLines fontSize={11} lineHeight={14} width={statIndex === 0 ? 50 : 34} />
              </View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Skeleton width={44} height={44} borderRadius={13} />
          <Skeleton width={44} height={44} borderRadius={13} />
          <Skeleton width={44} height={44} borderRadius={13} />
          <View style={{ flex: 1 }}><Skeleton height={44} borderRadius={13} /></View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
        {TAB_WIDTHS.map((tabWidth, tabIndex) => (
          <Skeleton key={tabIndex} width={tabWidth} height={37} borderRadius={999} style={{ marginHorizontal: 4 }} />
        ))}
      </View>

      {activeTab === 'events' ? (
        <CommunityEventsWorkspaceSkeleton />
      ) : activeTab === 'members' ? (
        <CommunityMembersWorkspaceSkeleton />
      ) : activeTab === 'polls' ? (
        <CommunityPollsWorkspaceSkeleton />
      ) : activeTab === 'about' ? (
        <CommunityAboutWorkspaceSkeleton />
      ) : (
        <CommunityPostsSkeleton />
      )}
    </ScrollView>
  );
}
