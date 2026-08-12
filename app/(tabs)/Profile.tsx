import { useState, useCallback } from 'react';
import type { ComponentProps } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { authService } from '@/lib/services/AuthService';
import ProfileHeader from '@/components/profile/ProfileHeader';
import TimelineTab from '@/components/profile/TimelineTab';
import AboutTab from '@/components/profile/AboutTab';
import GalleryTab from '@/components/profile/GalleryTab';
import AdminTab from '@/components/profile/AdminTab';
import AppDrawerNav from '@/components/navigation/AppDrawerNav';
import EditProfileModal from '@/components/profile/EditProfileModal';
import ProfileSkeleton from '@/components/profile/ProfileSkeleton';
import { useProfileResource } from '@/lib/hooks/useProfileResource';

type ProfileTab = 'timeline' | 'about' | 'gallery' | 'admin';

export default function ProfileScreen() {
  const router = useRouter();
  const currentUserId = authService.getCurrentUser()?.uid ?? '';
  const { resource, refresh } = useProfileResource({ kind: 'own', userId: currentUserId });
  const profile = resource.data?.profile ?? null;
  const isLoading = resource.data === null && (resource.status === 'idle' || resource.status === 'hydrating');
  const refreshing = resource.status === 'refreshing';
  const [activeTab, setActiveTab] = useState<ProfileTab>('timeline');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const stats = resource.data?.stats ?? { posts: 0, friends: 0, followers: 0, following: 0 };
  const error = resource.error?.message ?? null;

  const onRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const isAdmin = profile?.accountType === 'admin' || profile?.role === 'admin' || profile?.isAdmin === true;

  const tabs: { key: ProfileTab; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'timeline', label: 'Timeline', icon: 'list-outline' },
    { key: 'about', label: 'About', icon: 'information-circle-outline' },
    { key: 'gallery', label: 'Gallery', icon: 'images-outline' },
  ];
  if (isAdmin) tabs.push({ key: 'admin', label: 'Admin', icon: 'shield-checkmark-outline' });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* App Drawer Navigation */}
      <AppDrawerNav
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userProfile={
          profile
            ? { ...profile, isAdmin }
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
        <TouchableOpacity onPress={() => router.push('/settings' as Href)} style={{ padding: 6 }}>
          <Ionicons name="settings-outline" size={22} color="#334155" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ProfileSkeleton />
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
            postsCount={stats.posts}
            friendsCount={stats.friends}
            followingCount={stats.following}
            onEditProfile={() => setEditModalOpen(true)}
          />
          {error ? <TouchableOpacity onPress={() => void refresh()} style={{ marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#fff7ed' }}><Text style={{ color: '#9a3412', textAlign: 'center', fontSize: 12, fontWeight: '700' }}>Showing saved profile · Tap to retry</Text></TouchableOpacity> : null}
          <EditProfileModal
            visible={editModalOpen}
            profile={profile}
            onClose={() => setEditModalOpen(false)}
            onProfileUpdated={() => void refresh()}
          />

          {/* ── Tab Selector Row ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
          >
            {tabs.map((t) => {
              const isActive = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setActiveTab(t.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isActive ? '#10b981' : '#f1f5f9',
                    gap: 6,
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={t.icon}
                    size={16}
                    color={isActive ? '#ffffff' : '#64748b'}
                  />
                  <Text style={{
                    fontSize: 13,
                    fontWeight: isActive ? '800' : '600',
                    color: isActive ? '#ffffff' : '#64748b',
                  }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Active Tab Content ── */}
          {activeTab === 'timeline' && <TimelineTab userId={profile.uid} />}
          {activeTab === 'about' && <AboutTab profile={profile} />}
          {activeTab === 'gallery' && <GalleryTab userId={profile.uid} />}
          {activeTab === 'admin' && <AdminTab profile={profile} />}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '600', textAlign: 'center' }}>{error || 'Could not load profile'}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
