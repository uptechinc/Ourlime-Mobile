import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';
import { SkeletonPostCard } from '@/components/home/SkeletonLoaders';

export default function ProfileSkeleton() {
  return (
    <View style={styles.container}>
      {/* Cover Banner Skeleton */}
      <SkeletonBox width="100%" height={140} borderRadius={0} />

      {/* Profile Header Body */}
      <View style={styles.headerBody}>
        <View style={styles.avatarRow}>
          <SkeletonCircle size={84} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SkeletonBox width={100} height={36} borderRadius={18} />
            <SkeletonBox width={36} height={36} borderRadius={18} />
          </View>
        </View>

        {/* Name & Handle */}
        <SkeletonText width={180} height={22} style={{ marginTop: 8 }} />
        <SkeletonText width={110} height={14} style={{ marginTop: 6 }} />

        {/* Metrics Bar */}
        <View style={styles.metricsBar}>
          <SkeletonBox width={60} height={32} borderRadius={10} />
          <SkeletonBox width={60} height={32} borderRadius={10} />
          <SkeletonBox width={60} height={32} borderRadius={10} />
        </View>
      </View>

      {/* Tabs Row Skeleton */}
      <View style={styles.tabsRow}>
        <SkeletonBox width={70} height={32} borderRadius={16} />
        <SkeletonBox width={70} height={32} borderRadius={16} />
        <SkeletonBox width={90} height={32} borderRadius={16} />
        <SkeletonBox width={70} height={32} borderRadius={16} />
      </View>

      {/* Feed Skeleton */}
      <View style={{ padding: 16 }}>
        <SkeletonPostCard />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerBody: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -40,
  },
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
});
