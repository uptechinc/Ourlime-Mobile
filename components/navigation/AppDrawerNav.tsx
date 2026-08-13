import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { getAppNavigationItems, type AppNavigationItem } from '@/lib/navigation/AppNavigation';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type AppDrawerNavProps = {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile;
};

const authService = AuthService.getInstance();

export default function AppDrawerNav({ isOpen, onClose, userProfile }: AppDrawerNavProps) {
  const { authorization, getDecision } = usePageAccess();
  const { isDark } = useAppTheme();
  const router = useRouter();
  const themeStyles = createThemeStyles(isDark);
  const navigateTo = (item: AppNavigationItem) => {
    onClose();
    router.push(item.route);
  };

  if (!isOpen) return null;

  const navItems = getAppNavigationItems({
    includeHome: true,
    isAdmin: authorization.isAdmin,
    resolveStatus: (route) => {
      const decision = getDecision(route);
      return { visible: decision.isVisibleInNavigation, status: decision.status, badge: decision.setting?.badgeText };
    },
  });

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <SafeAreaView edges={['top', 'left', 'right']} style={[styles.drawerCard, themeStyles.drawerCard]}>
          {/* Header Profile Section */}
          <View style={[styles.profileHeader, themeStyles.divider]}>
            <UserAvatar
              profileImage={userProfile?.profilePicture}
              firstName={userProfile?.firstName || 'U'}
              size={54}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.profileName, themeStyles.primaryText]}>
                {userProfile?.firstName ? `${userProfile.firstName} ${userProfile.lastName}` : 'Ourlime User'}
              </Text>
              <Text style={styles.profileHandle}>@{userProfile?.userName || 'user'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={22} color={isDark ? '#cbd5e1' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Navigation Links */}
          <ScrollView style={styles.menuScroll} contentContainerStyle={{ paddingVertical: 12, gap: 4 }}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => navigateTo(item)}
                style={[styles.menuRow, themeStyles.menuRow]}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Icon name={item.featherIcon} size={18} color="#10b981" />
                </View>
                <Text style={[styles.menuText, themeStyles.primaryText]}>{item.label}</Text>
                {item.status && item.status !== 'enabled' && item.status !== 'admin_only' ? (
                  <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>{item.badge || 'Soon'}</Text></View>
                ) : null}
                <Icon name="chevron-right" size={16} color={isDark ? '#cbd5e1' : '#94a3b8'} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Footer Sign Out */}
          <View style={[styles.footer, themeStyles.divider]}>
            <TouchableOpacity
              onPress={() => {
                onClose();
                void authService.logout().then(() => router.replace('/(auth)/login'));
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
  statusBadge: { marginRight: 8, borderRadius: 999, backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { color: '#047857', fontSize: 10, fontWeight: '800' },
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

const createThemeStyles = (isDark: boolean) => StyleSheet.create({
  drawerCard: { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
  divider: { borderColor: isDark ? '#334155' : '#f1f5f9' },
  menuRow: { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
  primaryText: { color: isDark ? '#f8fafc' : '#0f172a' },
});
