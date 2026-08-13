import { useState, useCallback, useEffect } from 'react';
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
import FriendsTab from '@/components/profile/FriendsTab';
import AdminTab from '@/components/profile/AdminTab';
import SlideOutMenu from '@/components/ui/SlideOutMenu';
import EditProfileModal from '@/components/profile/EditProfileModal';
import ProfileSkeleton from '@/components/profile/ProfileSkeleton';
import { useProfileResource } from '@/lib/hooks/useProfileResource';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { getAppNavigationItems } from '@/lib/navigation/AppNavigation';
import type { MenuItem } from '@/lib/types/componentProps';

type ProfileTab = 'timeline' | 'friends' | 'about' | 'gallery' | 'admin';

export default function ProfileScreen() {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const { getDecision } = usePageAccess();
  // Wait for Firebase to restore the auth session before reading uid.
  // getCurrentUser() can return null on first render even when the user is
  // logged in, because Firebase Auth restores state asynchronously.
  const [currentUserId, setCurrentUserId] = useState<string>(
    authService.getVerifiedCurrentUser()?.uid ?? ''
  );

  useEffect(() => {
    const unsub = authService.subscribeToVerifiedAuthState((user) => {
      setCurrentUserId(user?.uid ?? '');
    });
    return () => unsub();
  }, []);

  const { resource, refresh } = useProfileResource({ kind: 'own', userId: currentUserId });
  const profile = resource.data?.profile ?? null;
  const isLoading = !currentUserId || (resource.data === null && (resource.status === 'idle' || resource.status === 'hydrating'));
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

  const menuItems: MenuItem[] = [
    ...getAppNavigationItems({
      includeHome: true,
      isAdmin,
      resolveStatus: (route) => {
        const decision = getDecision(route);
        return { visible: decision.isVisibleInNavigation, status: decision.status, badge: decision.setting?.badgeText };
      },
    }).map((item) => ({
      id: item.id,
      title: item.label,
      icon: item.ionicon,
      route: item.route,
      badge: item.badge || (item.status === 'coming_soon' ? 'Soon' : item.status === 'maintenance' ? 'Maintenance' : undefined),
      onPress: () => router.push(item.route as Href),
    })),
    {
      id: "logout",
      title: "Log Out",
      icon: "log-out",
      onPress: async () => {
        await authService.logout();
        router.replace("/(auth)/login");
      },
    },
  ];

  const tabs: { key: ProfileTab; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'timeline', label: 'Timeline', icon: 'list-outline' },
    { key: 'friends', label: 'Friends', icon: 'people-outline' },
    { key: 'about', label: 'About', icon: 'information-circle-outline' },
    { key: 'gallery', label: 'Gallery', icon: 'images-outline' },
  ];
  if (isAdmin) tabs.push({ key: 'admin', label: 'Admin', icon: 'shield-checkmark-outline' });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Unified Slide-Out Menu */}
      <SlideOutMenu
        isVisible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        menuItems={menuItems}
        userProfile={
          profile
            ? {
                name: `${profile.firstName} ${profile.lastName}`.trim(),
                email: profile.email,
                avatar: profile.profilePicture ?? undefined,
                firstName: profile.firstName,
                lastName: profile.lastName,
                userName: profile.userName,
                profilePicture: profile.profilePicture,
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
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }}>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => setDrawerOpen(true)} style={{ padding: 6 }}>
          <Ionicons name="menu-outline" size={26} color={colors.icon} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/settings' as Href)} style={{ padding: 6 }}>
          <Ionicons name="settings-outline" size={22} color={colors.icon} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ProfileSkeleton />
      ) : profile ? (
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.canvas }}
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
            onFriendsPress={() => setActiveTab('friends')}
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
            style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
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
                    backgroundColor: isActive ? '#10b981' : colors.control,
                    gap: 6,
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={t.icon}
                    size={16}
                    color={isActive ? '#ffffff' : colors.icon}
                  />
                  <Text style={{
                    fontSize: 13,
                    fontWeight: isActive ? '800' : '600',
                    color: isActive ? '#ffffff' : colors.mutedText,
                  }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Active Tab Content ── */}
          {activeTab === 'timeline' && <TimelineTab userId={profile.uid} />}
          {activeTab === 'friends' && <FriendsTab userId={profile.uid} />}
          {activeTab === 'about' && <AboutTab profile={profile} />}
          {activeTab === 'gallery' && <GalleryTab userId={profile.uid} />}
          {activeTab === 'admin' && <AdminTab profile={profile} />}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: colors.mutedText, fontWeight: '600', textAlign: 'center' }}>{error || 'Could not load profile'}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
