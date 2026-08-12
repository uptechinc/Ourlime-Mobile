import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import { AuthService } from '@/lib/services/AuthService';
import { SettingsService, type BlockedUserSummary } from '@/lib/profile/settings/SettingsService';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';

type SettingsTab = 'account' | 'privacy' | 'notifications' | 'blocked' | 'security';
type SettingsModalState = { visible: boolean; type: CustomModalType; title: string; message: string; action?: 'logout' };
const authService = AuthService.getInstance();
const settingsService = SettingsService.getInstance();

export default function SettingsScreen() {
  const router = useRouter();
  const user = authService.getCurrentUser();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Account State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userName, setUserName] = useState('');
  const [bio, setBio] = useState('');

  // Privacy State
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [allowDirectMessages, setAllowDirectMessages] = useState(true);

  // Notifications State
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [mentionAlerts, setMentionAlerts] = useState(true);

  // Blocked Users State
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserSummary[]>([]);
  const [modal, setModal] = useState<SettingsModalState>({ visible: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      try {
        const settings = await settingsService.getMobileSettings(user.uid);
        setFirstName(settings.firstName); setLastName(settings.lastName); setUserName(settings.userName); setBio(settings.bio);
        setVisibility(settings.visibility); setAllowDirectMessages(settings.allowDirectMessages); setPushEnabled(settings.pushEnabled); setEmailEnabled(settings.emailEnabled); setMentionAlerts(settings.mentionAlerts); setBlockedUsers(settings.blockedUsers);
      } catch (err) {
        console.error('[Settings] Load error:', err);
        setModal({ visible: true, type: 'danger', title: 'Settings unavailable', message: err instanceof Error ? err.message : 'Could not load your settings.' });
      } finally {
        setLoading(false);
      }
    };
    void fetchSettings();
  }, [user]);

  const handleSaveAccount = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await settingsService.updateMobileSettings(user.uid, { firstName, lastName, userName, bio, visibility, allowDirectMessages, pushEnabled, emailEnabled, mentionAlerts });

      setModal({ visible: true, type: 'success', title: 'Settings saved', message: 'Your profile and preference settings have been updated.' });
    } catch (err) {
      console.error('[Settings] Save error:', err);
      setModal({ visible: true, type: 'danger', title: 'Settings not saved', message: 'Could not save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    if (!user) return;
    try {
      await settingsService.unblockUser(blockedId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedId));
      setModal({ visible: true, type: 'success', title: 'User unblocked', message: 'User has been removed from your block list.' });
    } catch (unblockError: unknown) {
      setModal({ visible: true, type: 'danger', title: 'User not unblocked', message: unblockError instanceof Error ? unblockError.message : 'Please try again.' });
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading settings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings & Privacy</Text>
        <TouchableOpacity onPress={handleSaveAccount} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      {/* Settings Navigation Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {([
          { key: 'account', label: 'Account', icon: 'user' },
          { key: 'privacy', label: 'Privacy', icon: 'lock' },
          { key: 'notifications', label: 'Notifications', icon: 'bell' },
          { key: 'blocked', label: 'Blocked', icon: 'user-x' },
          { key: 'security', label: 'Security', icon: 'shield' },
        ] satisfies { key: SettingsTab; label: string; icon: string }[]).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabPill, active && styles.tabPillActive]}
            >
              <Icon name={tab.icon} size={15} color={active ? '#ffffff' : '#64748b'} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Section Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {activeTab === 'account' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name</Text>
              <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput value={lastName} onChangeText={setLastName} style={styles.input} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput value={userName} onChangeText={setUserName} autoCapitalize="none" style={styles.input} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput value={bio} onChangeText={setBio} multiline numberOfLines={3} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} />
            </View>
          </View>
        )}

        {activeTab === 'privacy' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy Settings</Text>
            <Text style={styles.label}>Profile Visibility</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginVertical: 10 }}>
              {(['public', 'friends', 'private'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setVisibility(opt)}
                  style={[styles.visibilityOption, visibility === opt && styles.visibilityOptionActive]}
                >
                  <Text style={[styles.visibilityText, visibility === opt && styles.visibilityTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Allow Direct Messages</Text>
                <Text style={styles.switchSubtext}>Let people message you directly</Text>
              </View>
              <Switch value={allowDirectMessages} onValueChange={setAllowDirectMessages} trackColor={{ true: '#10b981' }} />
            </View>
          </View>
        )}

        {activeTab === 'notifications' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Push Notifications</Text>
                <Text style={styles.switchSubtext}>Receive mobile push alerts</Text>
              </View>
              <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ true: '#10b981' }} />
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Email Notifications</Text>
                <Text style={styles.switchSubtext}>Receive email updates</Text>
              </View>
              <Switch value={emailEnabled} onValueChange={setEmailEnabled} trackColor={{ true: '#10b981' }} />
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Mention Alerts</Text>
                <Text style={styles.switchSubtext}>Notify when tagged with @username</Text>
              </View>
              <Switch value={mentionAlerts} onValueChange={setMentionAlerts} trackColor={{ true: '#10b981' }} />
            </View>
          </View>
        )}

        {activeTab === 'blocked' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Blocked Users</Text>
            {blockedUsers.length === 0 ? (
              <Text style={styles.emptyText}>Your blocked-users list is empty.</Text>
            ) : (
              blockedUsers.map((b) => (
                <View key={b.id} style={styles.blockedRow}>
                  <Text style={styles.blockedName}>@{b.userName || b.firstName}</Text>
                  <TouchableOpacity onPress={() => handleUnblock(b.id)} style={styles.unblockBtn}>
                    <Text style={styles.unblockText}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'security' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            <TouchableOpacity onPress={() => setModal({ visible: true, type: 'warning', title: 'Sign out?', message: 'You will need to sign in again to use Ourlime.', action: 'logout' })} style={styles.signOutBtn}>
              <Icon name="log-out" size={18} color="#ef4444" />
              <Text style={styles.signOutText}>Sign Out of Ourlime</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <CustomModal visible={modal.visible} type={modal.type} title={modal.title} message={modal.message} confirmText={modal.action === 'logout' ? 'Sign Out' : 'OK'} cancelText={modal.action === 'logout' ? 'Cancel' : undefined} onClose={() => setModal((current) => ({ ...current, visible: false }))} onConfirm={modal.action === 'logout' ? () => { void authService.logout().then(() => router.replace('/(auth)/login')); } : undefined} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#10b981' },
  saveBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  tabBar: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 8 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  tabPillActive: { backgroundColor: '#10b981' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'capitalize' },
  tabTextActive: { color: '#ffffff' },
  content: { flex: 1 },
  section: { gap: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#0f172a' },
  visibilityOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff' },
  visibilityOptionActive: { backgroundColor: '#d1fae5', borderColor: '#10b981' },
  visibilityText: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'capitalize' },
  visibilityTextActive: { color: '#047857' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  switchLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  switchSubtext: { fontSize: 12, color: '#64748b', marginTop: 2 },
  emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic' },
  blockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  blockedName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  unblockBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#fee2e2' },
  unblockText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#fee2e2', marginTop: 12 },
  signOutText: { color: '#ef4444', fontSize: 15, fontWeight: '800' },
});
