import { useCallback, useMemo } from 'react';
import { Linking, StyleProp, Text, TextStyle, View } from 'react-native';
import WebView from 'react-native-webview';
import { useRouter } from 'expo-router';

// --- Types ---

type PlainSegment = { kind: 'text'; value: string };
type MentionSegment = { kind: 'mention'; username: string; value: string };
type UrlSegment = { kind: 'url'; url: string; value: string };
type YoutubeSegment = { kind: 'youtube'; videoId: string };

type ContentSegment = PlainSegment | MentionSegment | UrlSegment | YoutubeSegment;

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
function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' && parsed.pathname === '/watch') {
      return parsed.searchParams.get('v');
    }

    const pathMatch = parsed.pathname.match(/^\/(shorts|embed|v)\/([a-zA-Z0-9_-]{11})/);
    if ((host === 'youtube.com' || host === 'm.youtube.com') && pathMatch) {
      return pathMatch[2];
    }

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('?')[0];
      if (id.length === 11) return id;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a raw content string into typed segments.
 * Order: URLs (YouTube detected separately) > @mentions > plain text.
 */
function parseSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];

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
        segments.push({ kind: 'youtube', videoId });
      } else {
        segments.push({ kind: 'url', url, value: url });
      }
    }
  });

  return segments;
}

// --- YouTube embed ---

type YoutubeEmbedProps = { videoId: string };

function YouTubeEmbed({ videoId }: YoutubeEmbedProps) {
  const embedHtml = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; background: #000; }
  iframe { width: 100%; height: 100%; border: none; display: block; }
</style>
</head>
<body>
<iframe
  src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1"
  allowfullscreen
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
></iframe>
</body>
</html>`;

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 10,
        backgroundColor: '#000',
      }}
    >
      <WebView
        source={{ html: embedHtml }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        style={{ flex: 1, backgroundColor: '#000' }}
      />
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

  const segments = useMemo(() => parseSegments(content), [content]);

  if (!content) return null;

  const youtubeSegments = segments.filter((s): s is YoutubeSegment => s.kind === 'youtube');
  const inlineSegments = segments.filter(
    (s): s is PlainSegment | MentionSegment | UrlSegment => s.kind !== 'youtube',
  );

  const hasInlineContent = inlineSegments.some(
    (s) => s.kind !== 'text' || s.value.trim().length > 0,
  );

  return (
    <View>
      {hasInlineContent ? (
        <Text style={style}>
          {inlineSegments.map((segment, index) => {
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
                  style={{ color: linkColor, textDecorationLine: 'underline' }}
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
      ) : null}

      {youtubeSegments.map((segment, index) => (
        <YouTubeEmbed key={`yt-${segment.videoId}-${index}`} videoId={segment.videoId} />
      ))}
    </View>
  );
}
