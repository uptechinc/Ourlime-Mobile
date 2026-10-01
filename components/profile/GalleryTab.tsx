import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '@/lib/services/AuthService';
import { useFeedQuery } from '@/lib/hooks/useFeedQuery';
import CachedImage from '@/components/ui/CachedImage';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { profileGalleryService } from '@/lib/services/ProfileGalleryService';

type GalleryTabProps = { userId: string };

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_SIZE = (SCREEN_WIDTH - 48) / 3;
const GALLERY_SKELETON_ITEMS = [
  'gallery-skeleton-1',
  'gallery-skeleton-2',
  'gallery-skeleton-3',
  'gallery-skeleton-4',
  'gallery-skeleton-5',
  'gallery-skeleton-6',
] as const;
const authService = AuthService.getInstance();

export default function GalleryTab({ userId }: GalleryTabProps) {
  const { colors } = useAppTheme();
  const viewerId = authService.getCurrentUser()?.uid ?? userId;
  const { resource, refresh, loadMore } = useFeedQuery({ userId: viewerId, scope: 'home', filter: 'all', authorId: userId });
  const mediaList = profileGalleryService.selectGalleryMedia((resource.data?.posts ?? []).filter((post) => post.userId === userId));

  if (!resource.data && !resource.error) {
    return (
      <View style={styles.galleryGrid} accessibilityLabel="Loading profile gallery">
        {GALLERY_SKELETON_ITEMS.map((skeletonId) => (
          <Skeleton key={skeletonId} width={COLUMN_SIZE} height={COLUMN_SIZE} borderRadius={12} />
        ))}
      </View>
    );
  }

  if (resource.error && mediaList.length === 0) {
    return (
      <View style={styles.centeredState}>
        <Text style={[styles.errorText, { color: colors.destructiveText }]}>{resource.error.message}</Text>
        <TouchableOpacity onPress={() => void refresh()} style={[styles.retryButton, { backgroundColor: colors.accent }]} accessibilityRole="button">
          <Text style={{ color: colors.onAccent, fontWeight: '700' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mediaList.length === 0) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="images-outline" size={40} color={colors.icon} />
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>No photos or videos shared yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.galleryGrid}>
      {resource.error ? (
        <TouchableOpacity onPress={() => void refresh()} style={[styles.staleNotice, { backgroundColor: colors.control }]} accessibilityRole="button">
          <Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: '600' }}>Showing saved media. Tap to retry refresh.</Text>
        </TouchableOpacity>
      ) : null}
      {mediaList.map((mediaItem) => (
        <View key={mediaItem.id || `${mediaItem.type}:${mediaItem.typeUrl}`} style={styles.mediaTile}>
          <CachedImage uri={mediaItem.typeUrl} style={styles.mediaImage} recyclingKey={mediaItem.id || mediaItem.typeUrl} />
          {mediaItem.type === 'video' ? (
            <View style={styles.videoBadge}>
              <Ionicons name="play" size={12} color="#ffffff" />
            </View>
          ) : null}
        </View>
      ))}
      {resource.data?.hasMore ? (
        <TouchableOpacity onPress={() => void loadMore()} style={styles.loadMoreButton} accessibilityRole="button">
          <Text style={{ color: colors.accentText, fontWeight: '700' }}>Load more media</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  galleryGrid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  centeredState: { paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center' },
  errorText: { textAlign: 'center' },
  retryButton: { marginTop: 12, minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 10, fontSize: 14, fontWeight: '500' },
  staleNotice: { width: '100%', minHeight: 40, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mediaTile: { width: COLUMN_SIZE, height: COLUMN_SIZE, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f172a', position: 'relative' },
  mediaImage: { width: '100%', height: '100%' },
  videoBadge: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  loadMoreButton: { width: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
