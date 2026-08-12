import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';

type AdminWebOnlyScreenProps = {
  title: string;
  description: string;
};

export default function AdminWebOnlyScreen({ title, description }: AdminWebOnlyScreenProps) {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={{ marginLeft: 12, fontSize: 18, fontWeight: '900', color: '#0f172a' }}>{title}</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' }}>
          <Icon name="monitor" size={30} color="#475569" />
        </View>
        <Text style={{ marginTop: 18, fontSize: 22, fontWeight: '900', textAlign: 'center', color: '#0f172a' }}>{title}</Text>
        <Text style={{ marginTop: 8, maxWidth: 340, textAlign: 'center', lineHeight: 21, color: '#64748b' }}>{description}</Text>
        <Text style={{ marginTop: 10, maxWidth: 340, textAlign: 'center', lineHeight: 20, color: '#475569' }}>This workspace remains available in Ourlime Web while its secure native workflow is completed.</Text>
        <TouchableOpacity onPress={() => router.replace('/admin/index')} style={{ marginTop: 22, borderRadius: 999, backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 11 }}>
          <Text style={{ color: '#ffffff', fontWeight: '800' }}>Admin Overview</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
