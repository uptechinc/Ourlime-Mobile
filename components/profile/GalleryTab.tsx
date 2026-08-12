import { ActivityIndicator, Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '@/lib/services/AuthService';
import { useFeedQuery } from '@/lib/hooks/useFeedQuery';
import CachedImage from '@/components/ui/CachedImage';

type GalleryTabProps = { userId: string };

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_SIZE = (SCREEN_WIDTH - 48) / 3;
const authService = AuthService.getInstance();

export default function GalleryTab({ userId }: GalleryTabProps) {
  const viewerId = authService.getCurrentUser()?.uid ?? userId;
  const { resource, refresh, loadMore } = useFeedQuery({ userId: viewerId, scope: 'home', filter: 'photo', authorId: userId });
  const mediaList = (resource.data?.posts ?? []).flatMap((post) => post.media);
  const isInitialLoading = !resource.data && (resource.status === 'idle' || resource.status === 'hydrating');

  if (isInitialLoading) return <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator size="small" color="#10b981" /></View>;
  if (resource.error && mediaList.length === 0) return <View style={{ paddingVertical: 40, alignItems: 'center', paddingHorizontal: 24 }}><Text style={{ color: '#991b1b', textAlign: 'center' }}>{resource.error.message}</Text><TouchableOpacity onPress={() => void refresh()} style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: '#10b981' }}><Text style={{ color: '#ffffff', fontWeight: '700' }}>Retry</Text></TouchableOpacity></View>;
  if (mediaList.length === 0) return <View style={{ paddingVertical: 40, alignItems: 'center' }}><Ionicons name="images-outline" size={40} color="#cbd5e1" /><Text style={{ marginTop: 10, fontSize: 14, color: '#64748b', fontWeight: '500' }}>No photos or videos shared yet</Text></View>;

  return (
    <View style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {mediaList.map((item, index) => (
        <View key={item.id || `${item.typeUrl}-${index}`} style={{ width: COLUMN_SIZE, height: COLUMN_SIZE, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f172a', position: 'relative' }}>
          <CachedImage uri={item.typeUrl} style={{ width: '100%', height: '100%' }} recyclingKey={item.id || item.typeUrl} />
          {item.type === 'video' ? <View style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' }}><Ionicons name="play" size={12} color="#ffffff" /></View> : null}
        </View>
      ))}
      {resource.data?.hasMore ? <TouchableOpacity onPress={() => void loadMore()} style={{ width: '100%', alignItems: 'center', paddingVertical: 12 }}><Text style={{ color: '#059669', fontWeight: '700' }}>Load more media</Text></TouchableOpacity> : null}
    </View>
  );
}
