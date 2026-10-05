import { useEffect, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { ensureMediaUrl } from '@/lib/helpers/mediaUrl';
import { useChatVideoFrame } from '@/components/chat/ChatVideoViewer';

// Largest media box inside a message bubble; the shape follows the photo/video (portrait stays tall).
const MAX_WIDTH = 270;
const MAX_HEIGHT = 360;
const MIN_WIDTH = 150;
const MIN_HEIGHT = 110;

/** Box size for media with this width/height ratio (unknown ratio: a neutral 4:3 box while it loads). */
export function chatMediaBoxSize(aspect: number | null): { width: number; height: number } {
  const ratio = aspect && Number.isFinite(aspect) && aspect > 0 ? aspect : 4 / 3;
  let width = MAX_WIDTH;
  let height = width / ratio;
  if (height > MAX_HEIGHT) {
    height = MAX_HEIGHT;
    width = height * ratio;
  }
  return { width: Math.round(Math.max(MIN_WIDTH, width)), height: Math.round(Math.max(MIN_HEIGHT, height)) };
}

// Photo shapes already measured this session.
const imageAspectCache = new Map<string, number>();

function useImageAspect(url: string): number | null {
  const [aspect, setAspect] = useState<number | null>(imageAspectCache.get(url) ?? null);
  useEffect(() => {
    if (imageAspectCache.has(url)) { setAspect(imageAspectCache.get(url) ?? null); return; }
    let active = true;
    Image.getSize(ensureMediaUrl(url) || url, (width, height) => {
      if (width <= 0 || height <= 0) return;
      imageAspectCache.set(url, width / height);
      if (active) setAspect(width / height);
    }, (error: unknown) => {
      console.warn('[ChatImageBubble.getSize] Error:', error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, [url]);
  return aspect;
}

type ChatImageBubbleProps = { url: string; spacingBelow: number; onPress: () => void };

/** Chat photo sized to its own shape: tall photos get a tall bubble, wide photos a wide one. */
export function ChatImageBubble({ url, spacingBelow, onPress }: ChatImageBubbleProps) {
  const { width, height } = chatMediaBoxSize(useImageAspect(url));
  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel="Open photo" style={{ marginBottom: spacingBelow }}>
      <Image source={{ uri: ensureMediaUrl(url) || url }} style={{ width, height, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.15)' }} resizeMode="cover" />
    </TouchableOpacity>
  );
}

type ChatVideoBubbleProps = { url: string; sizeLabel: string; spacingBelow: number; onPress: () => void };

/** Chat video sized to its own shape, with its first frame behind the play button. */
export function ChatVideoBubble({ url, sizeLabel, spacingBelow, onPress }: ChatVideoBubbleProps) {
  const frame = useChatVideoFrame(url);
  const { width, height } = chatMediaBoxSize(frame?.aspect ?? 16 / 9);
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel="Play video"
      style={{ width, height, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', marginBottom: spacingBelow }}
    >
      {frame ? <Image source={{ uri: frame.uri }} style={{ position: 'absolute', width, height }} resizeMode="cover" /> : null}
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="play" size={26} color="#ffffff" style={{ marginLeft: 3 }} />
      </View>
      <Text style={{ position: 'absolute', bottom: 8, right: 10, color: '#ffffff', fontSize: 11, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>{sizeLabel}</Text>
    </TouchableOpacity>
  );
}
