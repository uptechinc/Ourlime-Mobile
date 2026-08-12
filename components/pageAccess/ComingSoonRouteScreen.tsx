import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';

type ComingSoonRouteScreenProps = { title: string; description: string };

export default function ComingSoonRouteScreen({ title, description }: ComingSoonRouteScreenProps) {
  const router = useRouter();
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: 28 }}><View style={{ width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d1fae5' }}><Icon name="clock" size={32} color="#059669" /></View><Text style={{ marginTop: 18, fontSize: 24, fontWeight: '900', color: '#0f172a' }}>{title}</Text><Text style={{ marginTop: 8, maxWidth: 320, textAlign: 'center', lineHeight: 21, color: '#64748b' }}>{description}</Text><TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 24, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, backgroundColor: '#10b981' }}><Text style={{ color: '#fff', fontWeight: '900' }}>Back to Home</Text></TouchableOpacity></SafeAreaView>;
}
