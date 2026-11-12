import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { SkeletonPostCard } from '@/components/home/SkeletonLoaders';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type LinesProps = {
  lines?: number;
  fontSize: number;
  lineHeight: number;
  width?: number | `${number}%`;
  lastLineWidth?: number | `${number}%`;
};

/** Text placeholder that occupies exactly `lines * lineHeight` like the real Text it stands in for. */
export function SkeletonLines({ lines = 1, fontSize, lineHeight, width = '100%', lastLineWidth }: LinesProps): ReactNode {
  const barHeight = Math.round(fontSize * 0.8);
  return (
    <View>
      {Array.from({ length: lines }).map((_, lineIndex) => (
        <View key={lineIndex} style={{ height: lineHeight, justifyContent: 'center' }}>
          <Skeleton
            width={lineIndex === lines - 1 && lastLineWidth !== undefined ? lastLineWidth : width}
            height={barHeight}
            borderRadius={4}
          />
        </View>
      ))}
    </View>
  );
}

type WorkspaceHeadingProps = { titleWidth: number; actionWidth?: number };

/** "Community events" / "Community polls" heading row: 20px icon, 18px title, optional create button. */
function WorkspaceHeading({ titleWidth, actionWidth }: WorkspaceHeadingProps): ReactNode {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Skeleton width={20} height={20} borderRadius={5} />
      <View style={{ flex: 1, marginLeft: 7 }}><SkeletonLines fontSize={18} lineHeight={24} width={titleWidth} /></View>
      {actionWidth ? <Skeleton width={actionWidth} height={31} borderRadius={11} /> : null}
    </View>
  );
}

type CreatableWorkspaceSkeletonProps = { canCreate?: boolean };

/** Mirrors CommunityEventsWorkspace: heading + event cards (145px cover, title + flag, summary, date, location, attend). */
export function CommunityEventsWorkspaceSkeleton({ canCreate = false }: CreatableWorkspaceSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ margin: 16 }}>
      <WorkspaceHeading titleWidth={170} actionWidth={canCreate ? 64 : undefined} />
      {[0, 1].map((cardIndex) => (
        <View key={cardIndex} style={{ marginBottom: 13, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <Skeleton width="100%" height={145} borderRadius={0} />
          <View style={{ padding: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}><SkeletonLines fontSize={18} lineHeight={24} width="70%" /></View>
              <View style={{ padding: 7 }}><Skeleton width={17} height={17} borderRadius={4} /></View>
            </View>
            <View style={{ marginTop: 7 }}><SkeletonLines lines={3} fontSize={14} lineHeight={20} lastLineWidth="55%" /></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Skeleton width={15} height={15} borderRadius={4} />
              <View style={{ marginLeft: 6 }}><SkeletonLines fontSize={12} lineHeight={16} width={150} /></View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
              <Skeleton width={15} height={15} borderRadius={4} />
              <View style={{ flex: 1, marginLeft: 6 }}><SkeletonLines fontSize={12} lineHeight={16} width="65%" /></View>
            </View>
            <Skeleton height={42} borderRadius={12} style={{ marginTop: 13 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Mirrors CommunityPollsWorkspace: heading + poll cards (label, question, flag, 52px option bars, totals line). */
export function CommunityPollsWorkspaceSkeleton({ canCreate = false }: CreatableWorkspaceSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ margin: 16 }}>
      <WorkspaceHeading titleWidth={150} actionWidth={canCreate ? 76 : undefined} />
      {[0, 1].map((pollIndex) => (
        <View key={pollIndex} style={{ marginBottom: 13, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <SkeletonLines fontSize={10} lineHeight={13} width={110} />
              <View style={{ marginTop: 7 }}><SkeletonLines fontSize={18} lineHeight={24} width="80%" /></View>
            </View>
            <View style={{ padding: 6 }}><Skeleton width={16} height={16} borderRadius={4} /></View>
          </View>
          <View style={{ marginTop: 14 }}>
            {[0, 1, 2].map((optionIndex) => (
              <View key={optionIndex} style={{ minHeight: 52, marginBottom: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 }}>
                <View style={{ flex: 1 }}><Skeleton width={optionIndex === 1 ? '45%' : '60%'} height={12} borderRadius={4} /></View>
                <Skeleton width={30} height={12} borderRadius={4} />
                <Skeleton width={10} height={9} borderRadius={3} style={{ marginLeft: 6 }} />
              </View>
            ))}
          </View>
          <SkeletonLines fontSize={11} lineHeight={14} width="62%" />
        </View>
      ))}
    </View>
  );
}

/** Mirrors CommunityMembersWorkspace: search field, "x of y members" line and member rows. */
export function CommunityMembersWorkspaceSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ margin: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }}>
        <Skeleton width={17} height={17} borderRadius={5} />
        <Skeleton width="42%" height={12} borderRadius={4} style={{ marginLeft: 9 }} />
      </View>
      <View style={{ marginTop: 11, marginBottom: 9 }}><SkeletonLines fontSize={12} lineHeight={16} width={110} /></View>
      {[0, 1, 2, 3, 4].map((memberIndex) => (
        <View key={memberIndex} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <SkeletonCircle size={46} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <SkeletonLines fontSize={14} lineHeight={18} width="52%" />
            <View style={{ marginTop: 3 }}><SkeletonLines fontSize={12} lineHeight={16} width="40%" /></View>
          </View>
          {memberIndex === 0 ? <Skeleton width={18} height={18} borderRadius={5} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Mirrors CommunityAboutWorkspace: title, description, six setting rows and the rules list. */
export function CommunityAboutWorkspaceSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={{ margin: 16, padding: 17, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <SkeletonLines fontSize={18} lineHeight={24} width="68%" />
      <View style={{ marginTop: 8 }}><SkeletonLines lines={2} fontSize={14} lineHeight={21} lastLineWidth="60%" /></View>
      <View style={{ marginTop: 14 }}>
        {[0, 1, 2, 3, 4, 5].map((rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>
              <Skeleton width={18} height={18} borderRadius={5} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <SkeletonLines fontSize={11} lineHeight={14} width={80} />
              <View style={{ marginTop: 2 }}><SkeletonLines fontSize={14} lineHeight={18} width={rowIndex % 2 === 0 ? '55%' : '42%'} /></View>
            </View>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 17 }}><SkeletonLines fontSize={16} lineHeight={21} width={140} /></View>
      {[0, 1].map((ruleIndex) => (
        <View key={ruleIndex} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
          <SkeletonCircle size={17} />
          <View style={{ flex: 1, marginLeft: 8 }}><SkeletonLines fontSize={14} lineHeight={20} width={ruleIndex === 0 ? '80%' : '64%'} /></View>
        </View>
      ))}
    </View>
  );
}

/** Posts tab placeholder in app/communities/[id]: post cards with the screen's 12px gutter. */
export function CommunityPostsSkeleton(): ReactNode {
  return (
    <View style={{ paddingTop: 13 }}>
      {[0, 1].map((postIndex) => (
        // SkeletonPostCard carries the 14px gap the real list puts on each post wrapper.
        <View key={postIndex} style={{ paddingHorizontal: 12 }}><SkeletonPostCard /></View>
      ))}
    </View>
  );
}
