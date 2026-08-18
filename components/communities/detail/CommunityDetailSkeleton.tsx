import { ScrollView, View } from 'react-native';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';
import { SkeletonPostCard, SkeletonEventCard } from '@/components/home/SkeletonLoaders';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityTab } from '@/lib/types/community';

type CommunityDetailSkeletonProps = {
  activeTab?: CommunityTab;
};

export default function CommunityDetailSkeleton({ activeTab = 'posts' }: CommunityDetailSkeletonProps) {
  const { colors } = useAppTheme();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* ── Banner Image Skeleton ── */}
      <View style={{ height: 220, backgroundColor: colors.control }}>
        <SkeletonBox width="100%" height="100%" borderRadius={0} />
      </View>

      {/* ── Header Metadata Skeleton ── */}
      <View style={{ backgroundColor: colors.surface, padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {/* Title & Badges */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SkeletonText width="65%" height={26} />
        </View>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 10 }}>
          <SkeletonBox width={70} height={20} borderRadius={999} />
          <SkeletonBox width={60} height={20} borderRadius={999} />
        </View>

        {/* Description */}
        <View style={{ marginTop: 14 }}>
          <SkeletonText width="95%" height={14} />
          <SkeletonText width="75%" height={14} style={{ marginTop: 6 }} />
        </View>

        {/* Creator Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
          <SkeletonCircle size={34} />
          <View style={{ marginLeft: 9, flex: 1 }}>
            <SkeletonText width={55} height={10} />
            <SkeletonText width={110} height={13} style={{ marginTop: 4 }} />
          </View>
          <SkeletonText width={80} height={12} />
        </View>

        {/* Stats Row (3 Columns) */}
        <View style={{ flexDirection: 'row', marginTop: 17, padding: 13, borderRadius: 15, backgroundColor: colors.control }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonText width={35} height={18} />
            <SkeletonText width={45} height={11} style={{ marginTop: 4 }} />
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonText width={35} height={18} />
            <SkeletonText width={35} height={11} style={{ marginTop: 4 }} />
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonText width={35} height={18} />
            <SkeletonText width={35} height={11} style={{ marginTop: 4 }} />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <SkeletonBox width={44} height={44} borderRadius={13} />
          <SkeletonBox width={44} height={44} borderRadius={13} />
          <SkeletonBox width="100%" height={44} borderRadius={13} style={{ flex: 1 }} />
        </View>
      </View>

      {/* ── Sticky Tab Bar Skeleton ── */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
        <SkeletonBox width={64} height={32} borderRadius={999} />
        <SkeletonBox width={64} height={32} borderRadius={999} />
        <SkeletonBox width={64} height={32} borderRadius={999} />
        <SkeletonBox width={64} height={32} borderRadius={999} />
        <SkeletonBox width={72} height={32} borderRadius={999} />
      </View>

      {/* ── Workspace / Tab Content Skeleton ── */}
      <View style={{ padding: 16 }}>
        {activeTab === 'events' ? (
          <View style={{ gap: 14 }}>
            <SkeletonEventCard />
            <SkeletonEventCard />
          </View>
        ) : activeTab === 'members' ? (
          <View style={{ gap: 14 }}>
            {[1, 2, 3, 4, 5].map((item) => (
              <View key={item} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
                <SkeletonCircle size={44} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <SkeletonText width={120} height={14} />
                  <SkeletonText width={80} height={11} style={{ marginTop: 6 }} />
                </View>
                <SkeletonBox width={50} height={24} borderRadius={999} />
              </View>
            ))}
          </View>
        ) : activeTab === 'polls' ? (
          <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
            <SkeletonText width="80%" height={17} />
            <View style={{ gap: 10, marginTop: 14 }}>
              <SkeletonBox width="100%" height={38} borderRadius={10} />
              <SkeletonBox width="100%" height={38} borderRadius={10} />
              <SkeletonBox width="100%" height={38} borderRadius={10} />
            </View>
          </View>
        ) : activeTab === 'about' ? (
          <View style={{ backgroundColor: colors.surface, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
            <SkeletonText width={120} height={16} />
            <SkeletonText width="95%" height={13} style={{ marginTop: 10 }} />
            <SkeletonText width="85%" height={13} style={{ marginTop: 6 }} />
            <SkeletonText width="60%" height={13} style={{ marginTop: 6 }} />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <SkeletonPostCard />
            <SkeletonPostCard />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
