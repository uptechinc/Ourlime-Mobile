import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { FileText } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/** Opens an uploaded file (image, video or document) in the phone's viewer. */
export function openAdsFile(url: string): void {
  Linking.openURL(url).catch((error: unknown) => console.warn('[openAdsFile] Error:', error));
}

/** A grid of uploaded image files; tapping one opens it full size. */
export function AdsImageGrid({ urls, labelPrefix }: { urls: string[]; labelPrefix: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {urls.map((url, index) => (
        <TouchableOpacity key={`${url}-${index}`} accessibilityRole="imagebutton" accessibilityLabel={`${labelPrefix} ${index + 1}`} activeOpacity={0.85} onPress={() => openAdsFile(url)} style={{ width: '31%', height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={22} color={colors.mutedText} style={{ position: 'absolute' }} />
          <Image source={{ uri: url }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** A list of file links ("Video 1", "Video 2" …). */
export function AdsFileLinks({ urls, label }: { urls: string[]; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 8 }}>
      {urls.map((url, index) => (
        <TouchableOpacity key={`${url}-${index}`} accessibilityRole="link" onPress={() => openAdsFile(url)} style={{ borderRadius: 10, backgroundColor: colors.control, padding: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#2563eb' }}>{label} {index + 1}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
