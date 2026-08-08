import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserProfile } from '@/lib/services/AuthService';

type AdminTabProps = {
  profile: UserProfile;
};

export default function AdminTab({ profile }: AdminTabProps) {
  const handleAction = (title: string) => {
    Alert.alert(title, `Admin action triggered for user ${profile.userName}`);
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {/* Admin Surface Header */}
      <View style={{
        backgroundColor: '#1e293b', // admin-surface
        borderRadius: 20,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
          }}>
            <Ionicons name="shield-checkmark" size={18} color="#ef4444" />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#ffffff' }}>
              Admin Control Panel
            </Text>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
              Privileged tools & account management
            </Text>
          </View>
        </View>

        <View style={{ gap: 10, marginTop: 10 }}>
          {/* Quick Actions */}
          <TouchableOpacity
            onPress={() => handleAction('Verify User')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 14,
              backgroundColor: '#0f172a',
              borderWidth: 1,
              borderColor: '#334155',
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>Verify Account Status</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleAction('Change Tier')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 14,
              backgroundColor: '#0f172a',
              borderWidth: 1,
              borderColor: '#334155',
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="ribbon-outline" size={18} color="#3b82f6" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>Assign Tier & Role</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleAction('View Audit Logs')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 14,
              backgroundColor: '#0f172a',
              borderWidth: 1,
              borderColor: '#334155',
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="list-outline" size={18} color="#f59e0b" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>View Activity & Audit Logs</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleAction('Moderate Content')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 14,
              backgroundColor: '#450a0a',
              borderWidth: 1,
              borderColor: '#991b1b',
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="warning-outline" size={18} color="#ef4444" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fca5a5' }}>Moderate / Suspend Account</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#f87171" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
