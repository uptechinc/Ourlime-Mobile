import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Film, ShoppingBag } from 'lucide-react-native';
import SaveButton from '@/components/ui/SaveButton';
import type { SaveTarget } from '@/lib/types/saved';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type ProductGalleryProps = {
  title: string;
  media: string[];
  /** The listing as a saved item (the Save button on the image). */
  saveTarget: SaveTarget;
  badges: string[];
};

/** Same test as the web gallery: listing videos live under a video/ folder (decoded, since download URLs encode the path). */
export const isMarketVideo = (uri: string): boolean => {
  try { return decodeURIComponent(uri).includes('/video/'); } catch { return uri.includes('/video/'); }
};

/** Web ProductDetailsContent gallery: a large preview (image or video) above a row of thumbnails. */
export default function ProductGallery({ title, media, saveTarget, badges }: ProductGalleryProps) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState(media[0] ?? '');
  const current = media.includes(selected) ? selected : media[0] ?? '';
  const size = Math.min(width, 560);
  return <View style={{ gap: 10 }}>
    <View style={{ width: '100%', height: size * 0.9, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}>
      {!current ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ShoppingBag color={colors.mutedText} size={46} /><Text style={{ color: colors.mutedText, marginTop: 6 }}>Image unavailable</Text></View>
        : isMarketVideo(current) ? <GalleryVideo key={current} uri={current} />
          : <Image accessibilityLabel={title} source={{ uri: current }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />}
      <View style={{ position: 'absolute', left: 12, top: 12, gap: 6 }} pointerEvents="none">
        {badges.map((badge) => <View key={badge} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, backgroundColor: badge.startsWith('Save') ? '#dc2626' : 'rgba(17,24,39,0.8)' }}><Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }}>{badge}</Text></View>)}
      </View>
      <SaveButton target={saveTarget} variant="overlay" iconSize={21} style={{ position: 'absolute', right: 12, top: 12, width: 46, height: 46, borderRadius: 23 }} />
    </View>
    {media.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
      {media.map((uri, index) => <Pressable key={uri} accessibilityRole="button" accessibilityLabel={`Select product ${isMarketVideo(uri) ? 'video' : 'image'} ${index + 1}`} accessibilityState={{ selected: uri === current }} onPress={() => setSelected(uri)}
        style={{ width: 72, height: 72, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.control, borderWidth: 2, borderColor: uri === current ? colors.accent : colors.border, alignItems: 'center', justifyContent: 'center' }}>
        {isMarketVideo(uri) ? <Film color={colors.mutedText} size={24} /> : <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />}
      </Pressable>)}
    </ScrollView> : null}
  </View>;
}

type GalleryVideoProps = { uri: string };
function GalleryVideo({ uri }: GalleryVideoProps) {
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; });
  return <VideoView player={player} nativeControls contentFit="contain" style={{ width: '100%', height: '100%' }} />;
}
