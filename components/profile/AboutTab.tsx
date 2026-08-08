import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserProfile } from '@/lib/services/AuthService';

type AboutTabProps = {
  profile: UserProfile;
};

export default function AboutTab({ profile }: AboutTabProps) {
  const items = [
    {
      icon: 'person-outline',
      label: 'Account Type',
      value: `${profile.accountType || 'Regular'} Account`,
      color: '#3b82f6',
    },
    {
      icon: 'location-outline',
      label: 'Location',
      value: profile.city && profile.country ? `${profile.city}, ${profile.country}` : profile.country || profile.city || 'Not specified',
      color: '#10b981',
    },
    {
      icon: 'mail-outline',
      label: 'Email',
      value: profile.email || 'Not specified',
      color: '#8b5cf6',
    },
    {
      icon: 'calendar-outline',
      label: 'Date of Birth',
      value: profile.dateOfBirth || 'Not specified',
      color: '#f59e0b',
    },
    {
      icon: 'call-outline',
      label: 'Phone',
      value: profile.phone || 'Not specified',
      color: '#0ea5e9',
    },
  ];

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 14 }}>
          About & Overview
        </Text>

        <View style={{ gap: 14 }}>
          {items.map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: `${item.color}15`,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500' }}>{item.label}</Text>
                <Text style={{ fontSize: 14, color: '#1e293b', fontWeight: '600', marginTop: 1 }}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
