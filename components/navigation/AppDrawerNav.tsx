import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import { auth } from '@/lib/firebaseConfig';
import UserAvatar from '@/components/ui/UserAvatar';

type AppDrawerNavProps = {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: {
    uid: string;
    userName: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    isAdmin?: boolean;
  };
};

export default function AppDrawerNav({ isOpen, onClose, userProfile }: AppDrawerNavProps) {
  const router = useRouter();
  const currentUser = auth.currentUser;

  const navigateTo = (path: string) => {
    onClose();
    router.push(path as any);
  };

  if (!isOpen) return null;

  const navItems = [
    { label: 'Home Feed', icon: 'home', route: '/(tabs)' },
    { label: 'Limes (Reels)', icon: 'video', route: '/(tabs)/Limes' },
    { label: 'Events', icon: 'calendar', route: '/events' },
    { label: 'E-Learning', icon: 'book-open', route: '/eLearning' },
    { label: 'Blogs', icon: 'file-text', route: '/blogs' },
    { label: 'Jobs', icon: 'briefcase', route: '/jobs' },
    { label: 'Communities', icon: 'users', route: '/communities' },
    { label: 'Marketplace', icon: 'shopping-bag', route: '/market' },
    { label: 'E-Projects', icon: 'folder', route: '/(tabs)/Discover' },
    { label: 'My Profile', icon: 'user', route: '/(tabs)/Profile' },
    { label: 'Settings', icon: 'settings', route: '/settings' },
  ];

  if (userProfile?.isAdmin) {
    navItems.push({ label: 'Admin Portal', icon: 'shield', route: '/admin' });
  }

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <SafeAreaView style={styles.drawerCard}>
          {/* Header Profile Section */}
          <View style={styles.profileHeader}>
            <UserAvatar
              profileImage={userProfile?.profilePicture}
              firstName={userProfile?.firstName || 'U'}
              size={54}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.profileName}>
                {userProfile?.firstName ? `${userProfile.firstName} ${userProfile.lastName}` : 'Ourlime User'}
              </Text>
              <Text style={styles.profileHandle}>@{userProfile?.userName || 'user'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Navigation Links */}
          <ScrollView style={styles.menuScroll} contentContainerStyle={{ paddingVertical: 12, gap: 4 }}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => navigateTo(item.route)}
                style={styles.menuRow}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Icon name={item.icon} size={18} color="#10b981" />
                </View>
                <Text style={styles.menuText}>{item.label}</Text>
                <Icon name="chevron-right" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Footer Sign Out */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => {
                onClose();
                auth.signOut().then(() => router.replace('/(auth)/login'));
              }}
              style={styles.signOutRow}
            >
              <Icon name="log-out" size={18} color="#ef4444" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: {
    flex: 1,
  },
  drawerCard: {
    width: 290,
    backgroundColor: '#ffffff',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileHandle: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  menuScroll: {
    flex: 1,
    paddingHorizontal: 12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },
});
