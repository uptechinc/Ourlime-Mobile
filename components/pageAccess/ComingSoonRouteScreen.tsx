import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type ComingSoonRouteScreenProps = { title: string; description: string };

export default function ComingSoonRouteScreen({ title, description }: ComingSoonRouteScreenProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 28 }}><View style={{ width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}><Icon name="clock" size={32} color="#10b981" /></View><Text style={{ marginTop: 18, fontSize: 24, fontWeight: '900', color: colors.text }}>{title}</Text><Text style={{ marginTop: 8, maxWidth: 320, textAlign: 'center', lineHeight: 21, color: colors.mutedText }}>{description}</Text><TouchableOpacity onPress={handleBack} style={{ marginTop: 24, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, backgroundColor: '#10b981' }}><Text style={{ color: '#ffffff', fontWeight: '900' }}>Go Back</Text></TouchableOpacity></SafeAreaView>;
}
