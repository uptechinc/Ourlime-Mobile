import { View } from 'react-native';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityDirectoryViewMode } from '@/lib/types/community';

type CommunityCardSkeletonProps = {
  viewMode?: CommunityDirectoryViewMode;
};

export default function CommunityCardSkeleton({ viewMode = 'grid' }: CommunityCardSkeletonProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        flexDirection: viewMode === 'list' ? 'row' : 'column',
        backgroundColor: colors.surface,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ width: viewMode === 'list' ? 128 : '100%', height: viewMode === 'list' ? 190 : 142, backgroundColor: colors.control }}>
        <SkeletonBox width="100%" height="100%" borderRadius={0} />
      </View>
      <View style={{ flex: 1, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SkeletonText width="60%" height={17} />
          <View style={{ flex: 1 }} />
          <SkeletonBox width={45} height={16} borderRadius={999} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
          <SkeletonCircle size={24} />
          <SkeletonText width={110} height={11} style={{ marginLeft: 7 }} />
        </View>
        <View style={{ minHeight: 39, marginTop: 10 }}>
          <SkeletonText width="95%" height={13} />
          <SkeletonText width="70%" height={13} style={{ marginTop: 5 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border }}>
          <SkeletonBox width={36} height={14} borderRadius={4} />
          <SkeletonBox width={36} height={14} borderRadius={4} style={{ marginLeft: 15 }} />
          <SkeletonBox width={50} height={14} borderRadius={4} style={{ marginLeft: 15 }} />
        </View>
        <View style={{ marginTop: 12 }}>
          <SkeletonBox width="100%" height={39} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}
