import { useCallback, useMemo, useState } from 'react';
import { Linking, StyleProp, Text, TextStyle, TouchableOpacity, View } from 'react-native';
import WebView from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// --- Types ---

type PlainSegment = { kind: 'text'; value: string };
type MentionSegment = { kind: 'mention'; username: string; value: string };
type UrlSegment = { kind: 'url'; url: string; value: string; isYouTube?: boolean };

type ContentSegment = PlainSegment | MentionSegment | UrlSegment;

type RichTextContentProps = {
  content: string;
  style?: StyleProp<TextStyle>;
  linkColor?: string;
  mentionColor?: string;
  onMentionPress?: (username: string) => void;
};

// --- Helpers ---

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
const MENTION_REGEX = /(@[\w.-]+)/g;
const TRAILING_PUNCT = /[),.!?;:\]}]+$/;

/** Extract a YouTube video ID from common URL formats. Returns null if not YouTube. */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('?')[0];
      if (id && id.length === 11) return id;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v');
        if (id && id.length === 11) return id;
      }
      const pathMatch = parsed.pathname.match(/^\/(shorts|embed|v|live)\/([a-zA-Z0-9_-]{11})/);
      if (pathMatch) return pathMatch[2];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a raw content string into typed segments.
 * Preserves all URLs (including YouTube URLs) as clickable spans in the text.
 */
function parseSegments(content: string): { segments: ContentSegment[]; youtubeVideoIds: string[] } {
  const segments: ContentSegment[] = [];
  const youtubeVideoIds: string[] = [];

  const urlParts = content.split(URL_REGEX);
  const urlMatches = content.match(URL_REGEX) ?? [];

  urlParts.forEach((textChunk, chunkIndex) => {
    if (textChunk) {
      const mentionParts = textChunk.split(MENTION_REGEX);
      mentionParts.forEach((part) => {
        if (!part) return;
        if (part.startsWith('@') && part.length > 1) {
          segments.push({ kind: 'mention', username: part.slice(1), value: part });
        } else {
          segments.push({ kind: 'text', value: part });
        }
      });
    }

    const rawUrl = urlMatches[chunkIndex];
    if (rawUrl) {
      const url = rawUrl.replace(TRAILING_PUNCT, '');
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        if (!youtubeVideoIds.includes(videoId)) {
          youtubeVideoIds.push(videoId);
        }
        segments.push({ kind: 'url', url, value: url, isYouTube: true });
      } else {
        segments.push({ kind: 'url', url, value: url });
      }
    }
  });

  return { segments, youtubeVideoIds };
}

// --- YouTube embed ---

type YoutubeEmbedProps = { videoId: string };

function YouTubeEmbed({ videoId }: YoutubeEmbedProps) {
  const [hasError, setHasError] = useState(false);
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&enablejsapi=1&rel=0&modestbranding=1&origin=https://ourlime.com`;

  const handleOpenExternal = useCallback(async () => {
    try {
      const appUrl = `vnd.youtube://${videoId}`;
      const canOpenApp = await Linking.canOpenURL(appUrl);
      if (canOpenApp) {
        await Linking.openURL(appUrl);
        return;
      }
      await Linking.openURL(youtubeUrl);
    } catch {
      await Linking.openURL(youtubeUrl).catch(() => {});
    }
  }, [videoId, youtubeUrl]);

  return (
    <View
      style={{
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 10,
        backgroundColor: '#0a0f1d',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
        {!hasError ? (
          <WebView
            source={{
              uri: embedUrl,
              headers: {
                Referer: 'https://ourlime.com/',
              },
            }}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            originWhitelist={['*']}
            userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
            onError={() => setHasError(true)}
            onHttpError={() => setHasError(true)}
            style={{ flex: 1, backgroundColor: '#000' }}
          />
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleOpenExternal}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#111827',
              padding: 16,
            }}
          >
            <Ionicons name="logo-youtube" size={48} color="#ef4444" />
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14, marginTop: 8 }}>
              Watch on YouTube
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
              Tap to play directly in YouTube app
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Launch Bar */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpenExternal}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 7,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="logo-youtube" size={16} color="#ef4444" />
          <Text style={{ color: '#e5e7eb', fontSize: 12, fontWeight: '600' }}>
            YouTube Video
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700' }}>
            Open App
          </Text>
          <Ionicons name="open-outline" size={13} color="#10b981" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// --- Main component ---

export default function RichTextContent({
  content,
  style,
  linkColor = '#10b981',
  mentionColor = '#059669',
  onMentionPress,
}: RichTextContentProps) {
  const router = useRouter();

  const handleMentionPress = useCallback(
    (username: string) => {
      if (onMentionPress) {
        onMentionPress(username);
      } else {
        router.push({ pathname: '/profile/[username]', params: { username } });
      }
    },
    [onMentionPress, router],
  );

  const handleUrlPress = useCallback(async (url: string): Promise<void> => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch {
      // silently ignore unsupported URLs
    }
  }, []);

  const { segments, youtubeVideoIds } = useMemo(() => parseSegments(content || ''), [content]);

  if (!content) return null;

  return (
    <View>
      <Text style={style}>
        {segments.map((segment, index) => {
          const key = `${segment.kind}-${index}`;
          if (segment.kind === 'mention') {
            return (
              <Text
                key={key}
                style={{ color: mentionColor, fontWeight: '800' }}
                onPress={() => handleMentionPress(segment.username)}
              >
                {segment.value}
              </Text>
            );
          }
          if (segment.kind === 'url') {
            return (
              <Text
                key={key}
                style={{
                  color: segment.isYouTube ? '#ef4444' : linkColor,
                  fontWeight: '600',
                  textDecorationLine: 'underline',
                }}
                onPress={() => void handleUrlPress(segment.url)}
                accessibilityRole="link"
                accessibilityLabel={`Open link: ${segment.url}`}
              >
                {segment.value}
              </Text>
            );
          }
          return <Text key={key}>{segment.value}</Text>;
        })}
      </Text>

      {youtubeVideoIds.map((videoId) => (
        <YouTubeEmbed key={`yt-${videoId}`} videoId={videoId} />
      ))}
    </View>
  );
}
