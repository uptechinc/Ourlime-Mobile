import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type LegalDocumentScreenProps = { title: string; url: string };

export default function LegalDocumentScreen({ title, url }: LegalDocumentScreenProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 12, backgroundColor: colors.surface }}>
        <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()} style={{ padding: 8 }}><Ionicons name="chevron-back" size={24} color={colors.icon} /></TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{title}</Text>
      </View>
      <WebView source={{ uri: url }} startInLoadingState renderLoading={() => <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>} />
    </SafeAreaView>
  );
}
