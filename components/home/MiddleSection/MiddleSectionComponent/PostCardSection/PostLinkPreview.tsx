import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { extractDomain, openGraphService, type LinkPreviewData } from '@/lib/services/OpenGraphService';
import { useDeepLinkNavigation } from '@/lib/hooks/useDeepLinkNavigation';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';

type PostLinkPreviewProps = {
  url: string;
};

export default function PostLinkPreview({ url }: PostLinkPreviewProps) {
  const { openLink } = useDeepLinkNavigation();
  const { colors } = useAppTheme();
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void openGraphService.fetchPreview(url).then((result) => {
      if (!active) return;
      setPreview(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [url]);

  const domain = extractDomain(url);
  const isYouTube = domain.includes('youtube') || domain.includes('youtu.be');

  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={`Open ${preview?.title ?? domain}`}
      activeOpacity={0.86}
      onPress={() => void openLink(url)}
      style={{ marginTop: 14, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control }}
    >
      {preview?.image ? <Image source={{ uri: preview.image }} resizeMode="cover" style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.control }} /> : null}
      <View style={{ padding: 11 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name={isYouTube ? 'youtube' : 'link'} size={14} color="#059669" />
          <Text style={{ marginLeft: 6, color: '#059669', fontSize: 11, fontWeight: '800' }}>{preview?.siteName ?? domain}</Text>
        </View>
        {loading ? <ActivityIndicator size="small" color={colors.accent} style={{ alignSelf: 'flex-start', marginTop: 8 }} /> : <Text numberOfLines={2} style={{ marginTop: 5, color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '800' }}>{preview?.title ?? linkPresentationService.formatUrl(url)}</Text>}
        {preview?.description ? <Text numberOfLines={2} style={{ marginTop: 3, color: colors.mutedText, fontSize: 12, lineHeight: 17 }}>{preview.description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}
