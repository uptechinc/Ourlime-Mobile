import { memo, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Play, Maximize2, X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type YouTubePostPreviewProps = {
  text: string;
  postId?: string;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function getYouTubeVideoId(text: string): string | null {
  if (!text || !text.trim()) return null;

  const urlMatches = text.match(/https?:\/\/[^\s]+/g) ?? [];

  for (const rawUrl of urlMatches) {
    const candidateUrl = rawUrl.replace(/[),.!?]+$/, '');

    try {
      const url = new URL(candidateUrl);
      const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
      let videoId: string | null = null;

      if (hostname === 'youtu.be') {
        videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
      } else if (
        hostname === 'youtube.com' ||
        hostname === 'm.youtube.com' ||
        hostname === 'music.youtube.com'
      ) {
        if (url.pathname === '/watch') {
          videoId = url.searchParams.get('v');
        } else {
          const pathSegments = url.pathname.split('/').filter(Boolean);
          if (['embed', 'shorts', 'live'].includes(pathSegments[0] ?? '')) {
            videoId = pathSegments[1] ?? null;
          }
        }
      }

      if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        return videoId;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function YouTubePostPreviewComponent({ text, postId }: YouTubePostPreviewProps) {
  const { colors, isDark } = useAppTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoId = getYouTubeVideoId(text);

  if (!videoId) return null;

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const embedHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; background-color: #000; }
          html, body { width: 100%; height: 100%; overflow: hidden; }
          iframe { width: 100%; height: 100%; border: 0; }
        </style>
      </head>
      <body>
        <iframe
          src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&modestbranding=1&rel=0"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </body>
    </html>
  `;

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      {isPlaying ? (
        <View style={styles.playerWrapper}>
          <WebView
            source={{ html: embedHtml }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            style={styles.webView}
          />
          <TouchableOpacity
            onPress={() => setIsFullscreen(true)}
            style={styles.expandBtn}
            accessibilityLabel="Expand YouTube video full screen"
          >
            <Maximize2 size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setIsPlaying(true)}
          style={styles.thumbnailWrapper}
        >
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Play size={24} color="#ffffff" fill="#ffffff" style={{ marginLeft: 3 }} />
            </View>
            <Text style={styles.playText}>YouTube Video</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Fullscreen Video Modal */}
      {isFullscreen ? (
        <Modal
          visible={isFullscreen}
          animationType="fade"
          supportedOrientations={['portrait', 'landscape']}
          onRequestClose={() => setIsFullscreen(false)}
        >
          <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.fullscreenContainer}>
            <TouchableOpacity
              onPress={() => setIsFullscreen(false)}
              style={styles.fullscreenCloseBtn}
              accessibilityLabel="Close full screen video"
            >
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
            <WebView
              source={{ html: embedHtml }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              style={styles.fullscreenWebView}
            />
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}

export const YouTubePostPreview = memo(YouTubePostPreviewComponent);
YouTubePostPreview.displayName = 'YouTubePostPreview';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#000000',
    marginTop: 10,
    marginBottom: 4,
  },
  thumbnailWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ff0000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  playText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  playerWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  expandBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
    zIndex: 10,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 20,
  },
  fullscreenWebView: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
