import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authService, UserProfile } from '@/lib/services/AuthService';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        const userProf = await authService.getUserProfile(currentUser.uid);
        if (userProf) {
          setProfile(userProf);
        } else {
          setProfile({
            uid: currentUser.uid,
            firstName: currentUser.displayName || 'Ourlime',
            lastName: 'User',
            userName: currentUser.email?.split('@')[0] || 'user',
            email: currentUser.email || '',
            accountType: 'regular',
          });
        }
      }
    } catch (error) {
      console.error('[ProfileScreen.loadProfile] Error:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadProfile();
  }, [loadProfile]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Ourlime?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ── Header ── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
      }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827' }}>Profile</Text>
        <TouchableOpacity onPress={handleLogout} style={{ padding: 6 }}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* ── Content Area with Pull-To-Refresh ── */}
      <ScrollView
        style={{ flex: 1, backgroundColor: '#f8fafc' }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
      >
        {isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : (
          <View style={{ padding: 20 }}>
            {/* User Card */}
            <View style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              padding: 20,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#10b981',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}>
                {profile?.profilePicture ? (
                  <Image source={{ uri: profile.profilePicture }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 32, fontWeight: '700' }}>
                    {profile?.firstName?.charAt(0).toUpperCase() || 'U'}
                  </Text>
                )}
              </View>

              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>
                {profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Ourlime User'}
              </Text>
              <Text style={{ fontSize: 14, color: '#64748b', marginTop: 2 }}>
                @{profile?.userName || 'username'}
              </Text>
              <Text style={{ fontSize: 13, color: '#10b981', fontWeight: '600', marginTop: 6, textTransform: 'capitalize' }}>
                {profile?.accountType || 'Regular'} Account
              </Text>
            </View>

            {/* Quick Actions */}
            <View style={{ marginTop: 20, gap: 12 }}>
              <TouchableOpacity
                onPress={handleLogout}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#fff',
                  padding: 16,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#fee2e2',
                }}
              >
                <Ionicons name="log-out" size={20} color="#ef4444" style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#ef4444' }}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}