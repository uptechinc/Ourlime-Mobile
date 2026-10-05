import { useEffect, useState } from 'react';
import { Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomVideoPlayer from '@/components/media/CustomVideoPlayer';
import Icon from 'react-native-vector-icons/Feather';
import { ensureMediaUrl } from '@/lib/helpers/mediaUrl';
import { voiceNotePlaybackService } from '@/lib/services/VoiceNotePlaybackService';

export type ChatVideoFrame = { uri: string; aspect: number } | null;

// Poster frames already made this session (URL -> local image + width/height ratio, or null when it failed).
const thumbnailCache = new Map<string, ChatVideoFrame>();
const pendingThumbnails = new Map<string, Promise<ChatVideoFrame>>();

function loadThumbnail(url: string): Promise<ChatVideoFrame> {
  if (thumbnailCache.has(url)) return Promise.resolve(thumbnailCache.get(url) ?? null);
  const pending = pendingThumbnails.get(url);
  if (pending) return pending;
  const request = VideoThumbnails.getThumbnailAsync(ensureMediaUrl(url) || url, { time: 500, quality: 0.5 })
    .then((result): ChatVideoFrame => ({ uri: result.uri, aspect: result.width > 0 && result.height > 0 ? result.width / result.height : 16 / 9 }))
    .catch((error: unknown): ChatVideoFrame => {
      console.warn('[ChatVideoThumbnail.load] Error:', error instanceof Error ? error.message : String(error));
      return null;
    })
    .then((frame) => {
      thumbnailCache.set(url, frame);
      pendingThumbnails.delete(url);
      return frame;
    });
  pendingThumbnails.set(url, request);
  return request;
}

/** First frame of a chat video and its shape (width / height), so bubbles can match the video's orientation. */
export function useChatVideoFrame(url: string): ChatVideoFrame {
  const [frame, setFrame] = useState<ChatVideoFrame>(thumbnailCache.get(url) ?? null);
  useEffect(() => {
    let active = true;
    void loadThumbnail(url).then((loaded) => { if (active) setFrame(loaded); });
    return () => { active = false; };
  }, [url]);
  return frame;
}

/** First frame of a chat video, shown behind the play button. */
export function ChatVideoThumbnail({ url, width, height }: { url: string; width: number; height: number }) {
  const frame = useChatVideoFrame(url);
  return frame ? <Image source={{ uri: frame.uri }} style={{ position: 'absolute', width, height }} resizeMode="cover" /> : null;
}

type ChatVideoPlayerProps = {
  url: string;
  autoPlay?: boolean;
};

/** In-app chat video player: the app's custom player (same as feed videos), used by the viewer and the preview. */
export function ChatVideoPlayer({ url, autoPlay = true }: ChatVideoPlayerProps) {
  // A video and a voice note shouldn't play over each other.
  useEffect(() => { voiceNotePlaybackService.stop(); }, []);
  return <CustomVideoPlayer url={url} autoPlay={autoPlay} />;
}

type ChatVideoViewerProps = {
  url: string | null;
  title?: string;
  onClose: () => void;
  onSave?: () => void;
};

/** Full-screen in-app video viewer for chat videos (instead of opening the link in a browser). */
export default function ChatVideoViewer({ url, title, onClose, onSave }: ChatVideoViewerProps) {
  return (
    <Modal visible={Boolean(url)} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: '#000000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close video" style={{ padding: 8 }}>
            <Icon name="x" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text numberOfLines={1} style={{ flex: 1, color: '#ffffff', fontWeight: '700', marginHorizontal: 8 }}>{title || 'Video'}</Text>
          {onSave ? (
            <TouchableOpacity onPress={onSave} accessibilityLabel="Save video" style={{ padding: 8 }}>
              <Icon name="download" size={20} color="#ffffff" />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>{url ? <ChatVideoPlayer url={url} /> : null}</View>
      </SafeAreaView>
    </Modal>
  );
}
