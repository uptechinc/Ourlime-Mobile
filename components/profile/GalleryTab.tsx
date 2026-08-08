import { useEffect, useState } from 'react';
import { View, Text, Image, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PostService, type PostMedia } from '@/lib/services/PostService';

type GalleryTabProps = {
  userId: string;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_SIZE = (SCREEN_WIDTH - 48) / 3;

const postService = PostService.getInstance();

export default function GalleryTab({ userId }: GalleryTabProps) {
  const [mediaList, setMediaList] = useState<PostMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGalleryMedia = async () => {
      setIsLoading(true);
      try {
        const page = await postService.fetchFeedPage({ authorId: userId, limit: 30 });
        const allMedia = page.posts.flatMap((p) => p.media);
        setMediaList(allMedia);
      } catch {
        setMediaList([]);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchGalleryMedia();
  }, [userId]);

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#10b981" />
      </View>
    );
  }

  if (mediaList.length === 0) {
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <Ionicons name="images-outline" size={40} color="#cbd5e1" />
        <Text style={{ marginTop: 10, fontSize: 14, color: '#64748b', fontWeight: '500' }}>
          No photos or videos shared yet
        </Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {mediaList.map((item, i) => (
        <View
          key={item.id || `${item.typeUrl}-${i}`}
          style={{
            width: COLUMN_SIZE,
            height: COLUMN_SIZE,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            position: 'relative',
          }}
        >
          <Image source={{ uri: item.typeUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          {item.type === 'video' && (
            <View style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons name="play" size={12} color="#ffffff" />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
