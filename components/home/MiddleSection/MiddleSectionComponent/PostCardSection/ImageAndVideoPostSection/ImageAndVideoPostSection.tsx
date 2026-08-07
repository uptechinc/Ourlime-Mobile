import { useState, useEffect } from 'react';
import { Dimensions, Image, ScrollView, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type DisplayPostMedia = {
  id?: string;
  type: 'image' | 'video';
  typeUrl: string;
};

type ImageAndVideoPostSectionProps = {
  media: DisplayPostMedia[];
};

const MEDIA_WIDTH = Dimensions.get('window').width - 72;

function VideoPostItem({ url, isActive }: { url: string; isActive: boolean }) {
  const player = useVideoPlayer(url, (player) => {
    player.loop = true;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

export default function ImageAndVideoPostSection({ media }: ImageAndVideoPostSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / MEDIA_WIDTH));
  };

  return (
    <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#111827' }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {media.map((item, index) => (
          <View key={item.id ?? `${item.typeUrl}-${index}`} style={{ width: MEDIA_WIDTH, height: 330, backgroundColor: '#111827' }}>
            {item.type === 'video' ? (
              <VideoPostItem url={item.typeUrl} isActive={index === activeIndex} />
            ) : (
              <Image source={{ uri: item.typeUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            )}
          </View>
        ))}
      </ScrollView>
      {media.length > 1 ? (
        <View style={{ position: 'absolute', right: 10, top: 10, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: '#111827b3' }}>
          <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>{activeIndex + 1}/{media.length}</Text>
        </View>
      ) : null}
    </View>
  );
}
