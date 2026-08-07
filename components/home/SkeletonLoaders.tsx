import { View, Dimensions } from 'react-native';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function SkeletonPostCard() {
  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <SkeletonCircle size={48} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonText width={140} height={16} borderRadius={4} />
          <SkeletonText width={90} height={12} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
        <SkeletonCircle size={20} />
      </View>

      {/* Caption lines */}
      <SkeletonText width="92%" height={16} style={{ marginBottom: 6 }} />
      <SkeletonText width="65%" height={16} style={{ marginBottom: 14 }} />

      {/* Media Box */}
      <SkeletonBox width="100%" height={190} borderRadius={16} style={{ marginBottom: 14 }} />

      {/* Action Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
        <SkeletonBox width={50} height={20} borderRadius={10} style={{ marginRight: 24 }} />
        <SkeletonBox width={50} height={20} borderRadius={10} style={{ marginRight: 24 }} />
        <SkeletonBox width={50} height={20} borderRadius={10} />
      </View>
    </View>
  );
}

export function SkeletonUserCard() {
  return (
    <View
      style={{
        width: 150,
        padding: 14,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
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
  return (
    <View
      style={{
        width: SCREEN_WIDTH * 0.72,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
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
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
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
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
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
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: 14,
        borderRadius: 18,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
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
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#f1f5f9',
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
