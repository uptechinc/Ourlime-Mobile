import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type LegalDocumentScreenProps = { title: string; url: string };

export default function LegalDocumentScreen({ title, url }: LegalDocumentScreenProps) {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingHorizontal: 12 }}>
        <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()} style={{ padding: 8 }}><Ionicons name="chevron-back" size={24} color="#0f172a" /></TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>{title}</Text>
      </View>
      <WebView source={{ uri: url }} startInLoadingState renderLoading={() => <ActivityIndicator style={{ flex: 1 }} color="#10b981" />} />
    </SafeAreaView>
  );
}
