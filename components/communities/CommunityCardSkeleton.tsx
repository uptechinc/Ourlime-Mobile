import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityDirectoryViewMode } from '@/lib/types/community';

type CommunityCardSkeletonProps = {
  viewMode?: CommunityDirectoryViewMode;
};

type LineProps = { fontSize: number; lineHeight: number; width: number | `${number}%` };

/** One text line placeholder occupying the real line height. */
function Line({ fontSize, lineHeight, width }: LineProps): ReactNode {
  return (
    <View style={{ height: lineHeight, justifyContent: 'center' }}>
      <Skeleton width={width} height={Math.round(fontSize * 0.8)} borderRadius={4} />
    </View>
  );
}

/** Mirrors components/communities/CommunityCard.tsx in both grid and list view modes. */
export default function CommunityCardSkeleton({ viewMode = 'grid' }: CommunityCardSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  const isList = viewMode === 'list';
  const descriptionLines = isList ? 3 : 2;

  return (
    <View
      style={{
        flex: 1,
        flexDirection: isList ? 'row' : 'column',
        backgroundColor: colors.surface,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ width: isList ? 128 : '100%', height: isList ? 190 : 142, backgroundColor: colors.control }}>
        <Skeleton width="100%" height="100%" borderRadius={0} />
        <View style={{ position: 'absolute', top: 9, left: 9, flexDirection: 'row', gap: 5 }}>
          <View style={{ width: isList ? 44 : 68, height: 19, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.6)' }} />
          <View style={{ width: 52, height: 19, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.6)' }} />
        </View>
        {isList ? null : <View style={{ position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.75)' }} />}
      </View>
      <View style={{ flex: 1, padding: 14 }}>
        <Line fontSize={17} lineHeight={21} width="68%" />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
          <SkeletonCircle size={24} />
          <View style={{ marginLeft: 7, flex: 1 }}><Line fontSize={11} lineHeight={14} width={120} /></View>
        </View>
        <View style={{ minHeight: 39, marginTop: 10 }}>
          {Array.from({ length: descriptionLines }).map((_, lineIndex) => (
            <Line key={lineIndex} fontSize={13} lineHeight={19} width={lineIndex === descriptionLines - 1 ? '62%' : '96%'} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Skeleton width={14} height={14} borderRadius={7} />
          <Skeleton width={22} height={10} borderRadius={4} style={{ marginLeft: 5 }} />
          <Skeleton width={14} height={14} borderRadius={7} style={{ marginLeft: 15 }} />
          <Skeleton width={18} height={10} borderRadius={4} style={{ marginLeft: 5 }} />
          {isList ? null : <Skeleton width={40} height={9} borderRadius={4} style={{ marginLeft: 15 }} />}
          <View style={{ flex: 1 }} />
          {[0, 1, 2].map((avatarIndex) => (
            <View key={avatarIndex} style={{ marginLeft: avatarIndex === 0 ? 0 : -7, borderRadius: 12, borderWidth: 2, borderColor: colors.surface }}>
              <SkeletonCircle size={19} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Skeleton height={39} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}
