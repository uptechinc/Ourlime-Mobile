import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authService, UserProfile } from '@/lib/services/AuthService';
import ProfileHeader from '@/components/profile/ProfileHeader';
import TimelineTab from '@/components/profile/TimelineTab';
import AboutTab from '@/components/profile/AboutTab';
import GalleryTab from '@/components/profile/GalleryTab';
import AdminTab from '@/components/profile/AdminTab';
import AppDrawerNav from '@/components/navigation/AppDrawerNav';
import EditProfileModal from '@/components/profile/EditProfileModal';

type ProfileTab = 'timeline' | 'about' | 'gallery' | 'admin';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('timeline');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const isAdmin = profile?.accountType === 'admin' || (profile as any)?.isAdmin === true;

  const tabs: { key: ProfileTab; label: string; icon: string }[] = [
    { key: 'timeline', label: 'Timeline', icon: 'list-outline' },
    { key: 'about', label: 'About', icon: 'information-circle-outline' },
    { key: 'gallery', label: 'Gallery', icon: 'images-outline' },
    ...(isAdmin ? [{ key: 'admin' as ProfileTab, label: 'Admin', icon: 'shield-checkmark-outline' }] : []),
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* App Drawer Navigation */}
      <AppDrawerNav
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userProfile={
          profile
            ? {
                uid: profile.uid,
                userName: profile.userName,
                firstName: profile.firstName,
                lastName: profile.lastName,
                profilePicture: profile.profilePicture || undefined,
                isAdmin,
              }
            : undefined
        }
      />

      {/* ── Top Header Bar ── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#ffffff',
      }}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={{ padding: 6 }}>
          <Ionicons name="menu-outline" size={26} color="#0f172a" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/settings' as any)} style={{ padding: 6 }}>
          <Ionicons name="settings-outline" size={22} color="#334155" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : profile ? (
        <ScrollView
          style={{ flex: 1, backgroundColor: '#f8fafc' }}
          contentContainerStyle={{ paddingBottom: 100 }}
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
          {/* ── Profile Header Card ── */}
          <ProfileHeader
            profile={profile}
            postsCount={0}
            friendsCount={0}
            followingCount={0}
            onEditProfile={() => setEditModalOpen(true)}
            onCustomize={() => Alert.alert('Customization', 'Profile theme customization')}
          />
          <EditProfileModal
            visible={editModalOpen}
            profile={profile}
            onClose={() => setEditModalOpen(false)}
            onProfileUpdated={() => void loadProfile()}
          />

          {/* ── Tab Selector Row ── */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: '#ffffff',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
            gap: 8,
          }}>
            {tabs.map((t) => {
              const isActive = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setActiveTab(t.key)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 9,
                    borderRadius: 12,
                    backgroundColor: isActive ? '#10b981' : '#f1f5f9',
                    gap: 6,
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={16}
                    color={isActive ? '#ffffff' : '#64748b'}
                  />
                  <Text style={{
                    fontSize: 13,
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? '#ffffff' : '#64748b',
                  }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Active Tab Content ── */}
          {activeTab === 'timeline' && <TimelineTab userId={profile.uid} />}
          {activeTab === 'about' && <AboutTab profile={profile} />}
          {activeTab === 'gallery' && <GalleryTab userId={profile.uid} />}
          {activeTab === 'admin' && <AdminTab profile={profile} />}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '600' }}>Could not load profile</Text>
        </View>
      )}
    </SafeAreaView>
  );
}