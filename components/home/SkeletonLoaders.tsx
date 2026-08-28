import { View, Dimensions } from 'react-native';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function SkeletonPostCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: '100%',
        backgroundColor: colors.surface,
        borderRadius: 18,
        paddingVertical: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: 16 }}>
        <SkeletonCircle size={48} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonText width={140} height={16} borderRadius={4} />
          <SkeletonText width={90} height={12} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
        <SkeletonCircle size={20} />
      </View>

      {/* Caption lines */}
      <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
        <SkeletonText width="92%" height={16} style={{ marginBottom: 6 }} />
        <SkeletonText width="65%" height={16} />
      </View>

      {/* Media Box - 100% Full-bleed width with 0 border radius */}
      <SkeletonBox width="100%" height={260} borderRadius={0} style={{ marginBottom: 14 }} />

      {/* Action Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
        <SkeletonBox width={50} height={20} borderRadius={10} style={{ marginRight: 24 }} />
        <SkeletonBox width={50} height={20} borderRadius={10} style={{ marginRight: 24 }} />
        <SkeletonBox width={50} height={20} borderRadius={10} />
      </View>
    </View>
  );
}

export function SkeletonUserCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: 150,
        padding: 14,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        marginRight: 12,
      }}
    >
      <SkeletonCircle size={60} />
      <SkeletonText width={90} height={14} style={{ marginTop: 10 }} />
      <SkeletonText width={60} height={11} style={{ marginTop: 6 }} />
      <SkeletonBox width="100%" height={30} borderRadius={14} style={{ marginTop: 12 }} />
    </View>
  );
}

export function SkeletonCommunityCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: SCREEN_WIDTH * 0.72,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        marginRight: 14,
      }}
    >
      <SkeletonBox width="100%" height={110} borderRadius={0} />
      <View style={{ padding: 14 }}>
        <SkeletonText width={160} height={16} />
        <SkeletonText width={90} height={12} style={{ marginTop: 6 }} />
        <SkeletonBox width="100%" height={34} borderRadius={14} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

export function SkeletonEventCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
      }}
    >
      <SkeletonBox width={80} height={80} borderRadius={16} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <SkeletonText width={50} height={12} />
        <SkeletonText width={150} height={15} style={{ marginTop: 6 }} />
        <SkeletonText width={110} height={12} style={{ marginTop: 6 }} />
      </View>
      <SkeletonCircle size={24} />
    </View>
  );
}

export function SkeletonJobCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
      }}
    >
      <SkeletonBox width={44} height={44} borderRadius={14} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <SkeletonText width={140} height={15} />
        <SkeletonText width={100} height={12} style={{ marginTop: 6 }} />
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <SkeletonText width={60} height={13} />
        <SkeletonText width={40} height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function SkeletonChatRow() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 14,
        borderRadius: 18,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <SkeletonCircle size={48} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonText width={120} height={15} />
          <SkeletonText width={40} height={11} />
        </View>
        <SkeletonText width={80} height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function SkeletonNotificationRow() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <SkeletonCircle size={44} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <SkeletonText width={140} height={15} />
        <SkeletonText width={180} height={13} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}
