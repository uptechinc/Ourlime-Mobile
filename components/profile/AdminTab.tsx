import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { UserProfile } from '@/lib/services/AuthService';

type AdminTabProps = { profile: UserProfile };

export default function AdminTab({ profile }: AdminTabProps) {
  const router = useRouter();
  const items = [
    { id: 'overview', label: 'Admin Overview', description: 'Platform metrics and operational status', icon: 'grid-outline' as const },
    { id: 'users', label: 'User Management', description: 'Roles, account status, archive and restore', icon: 'people-outline' as const },
    { id: 'moderation', label: 'Content Moderation', description: 'Review and resolve reported content', icon: 'flag-outline' as const },
    { id: 'page_access', label: 'Page Access', description: 'Availability, maintenance and Coming Soon controls', icon: 'shield-checkmark-outline' as const },
  ];
  return <View style={{ padding: 16 }}><View style={{ padding: 18, borderRadius: 20, backgroundColor: '#1e293b' }}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="shield-checkmark" size={24} color="#10b981" /><View style={{ marginLeft: 10 }}><Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Admin Control Panel</Text><Text style={{ color: '#94a3b8', marginTop: 2 }}>Signed in as @{profile.userName}</Text></View></View>{items.map((item) => <TouchableOpacity key={item.id} onPress={() => router.push({ pathname: '/admin', params: { section: item.id } })} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11, padding: 14, borderRadius: 14, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' }}><Ionicons name={item.icon} size={20} color="#10b981" /><View style={{ flex: 1, marginLeft: 11 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{item.label}</Text><Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{item.description}</Text></View><Ionicons name="chevron-forward" size={18} color="#64748b" /></TouchableOpacity>)}</View></View>;
}
