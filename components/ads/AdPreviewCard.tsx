import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdPreviewCreative = {
  sponsorName?: string;
  headline?: string;
  primaryText?: string;
  destinationUrl?: string;
  imageUri?: string;
  imageAlt?: string;
};

/** The labelled public-feed ad preview from the website's ad builder. */
export default function AdPreviewCard({ creative }: { creative?: AdPreviewCreative }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLabel="Public feed ad preview" style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{creative?.sponsorName || 'Sponsor name'}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accentText }}>Sponsored</Text>
      </View>
      {creative?.imageUri ? (
        <Image source={{ uri: creative.imageUri }} accessibilityLabel={creative.imageAlt ?? ''} contentFit="contain" style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.control }} />
      ) : null}
      <View style={{ padding: 14, gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{creative?.headline || 'Your headline'}</Text>
        <Text style={{ fontSize: 14, color: colors.secondaryText, lineHeight: 20 }}>{creative?.primaryText || 'Your ad copy appears here.'}</Text>
        {creative?.destinationUrl ? <Text style={{ fontSize: 12, color: colors.mutedText }}>{creative.destinationUrl}</Text> : null}
        <View style={{ alignSelf: 'flex-start', borderRadius: 10, backgroundColor: colors.successSurface, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.accentText }}>Learn more</Text>
        </View>
      </View>
    </View>
  );
}
