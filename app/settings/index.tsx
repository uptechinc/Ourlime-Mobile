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
import DeleteAccountModal from '@/components/settings/DeleteAccountModal';
import { accountLifecycleService } from '@/lib/services/AccountLifecycleService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { MessagePermission, SettingsTheme } from '@/lib/profile/settings/SettingsService';
import NotificationSoundSettings from '@/components/settings/NotificationSoundSettings';
import ChangePasswordModal from '@/components/settings/ChangePasswordModal';
import ActiveSessionsSection from '@/components/settings/ActiveSessionsSection';

type SettingsTab = 'appearance' | 'account' | 'privacy' | 'notifications' | 'blocked' | 'security' | 'safety';
type SettingsModalState = { visible: boolean; type: CustomModalType; title: string; message: string; action?: 'logout' };
const authService = AuthService.getInstance();
const settingsService = SettingsService.getInstance();

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, isDark, setTheme } = useAppTheme();
  const styles = createStyles(isDark);
  const [userId, setUserId] = useState(authService.getVerifiedCurrentUser()?.uid ?? '');
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Account State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userName, setUserName] = useState('');
  const [bio, setBio] = useState('');

  // Privacy State
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [allowDirectMessages, setAllowDirectMessages] = useState(true);
  const [activityStatus, setActivityStatus] = useState(true);
  const [searchVisibility, setSearchVisibility] = useState(true);
  const [messagePermissions, setMessagePermissions] = useState<MessagePermission>('everyone');
  const [analyticsSharing, setAnalyticsSharing] = useState(true);
  const [marketingSharing, setMarketingSharing] = useState(false);
  const [thirdPartySharing, setThirdPartySharing] = useState(false);

  // Notifications State
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [mentionAlerts, setMentionAlerts] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [newMessageAlerts, setNewMessageAlerts] = useState(true);
  const [newCommentAlerts, setNewCommentAlerts] = useState(true);
  const [loginNotifications, setLoginNotifications] = useState(true);
  const [suspiciousActivityAlerts, setSuspiciousActivityAlerts] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Blocked Users State
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserSummary[]>([]);
  const [modal, setModal] = useState<SettingsModalState>({ visible: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    return authService.subscribeToVerifiedAuthState((verifiedUser) => setUserId(verifiedUser?.uid ?? ''));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fetchSettings = async () => {
      try {
        const settings = await settingsService.getMobileSettings(userId);
        setFirstName(settings.firstName); setLastName(settings.lastName); setUserName(settings.userName); setBio(settings.bio);
        setVisibility(settings.visibility); setAllowDirectMessages(settings.allowDirectMessages); setActivityStatus(settings.activityStatus); setSearchVisibility(settings.searchVisibility); setMessagePermissions(settings.messagePermissions);
        setAnalyticsSharing(settings.analyticsSharing); setMarketingSharing(settings.marketingSharing); setThirdPartySharing(settings.thirdPartySharing);
        setPushEnabled(settings.pushEnabled); setEmailEnabled(settings.emailEnabled); setSmsEnabled(settings.smsEnabled); setMentionAlerts(settings.mentionAlerts); setNewMessageAlerts(settings.newMessageAlerts); setNewCommentAlerts(settings.newCommentAlerts);
        setLoginNotifications(settings.loginNotifications); setSuspiciousActivityAlerts(settings.suspiciousActivityAlerts); setTwoFactorEnabled(settings.twoFactorEnabled); setBlockedUsers(settings.blockedUsers);
        await setTheme(settings.theme);
      } catch (err) {
        console.error('[Settings] Load error:', err);
        setModal({ visible: true, type: 'danger', title: 'Settings unavailable', message: err instanceof Error ? err.message : 'Could not load your settings.' });
      } finally {
        setLoading(false);
      }
    };
    void fetchSettings();
  }, [setTheme, userId]);

  const handleThemeChange = async (nextTheme: SettingsTheme) => {
    if (!userId || nextTheme === theme) return;
    const previousTheme = theme;
    await setTheme(nextTheme);
    try {
      await settingsService.updateTheme(userId, nextTheme);
    } catch (themeError: unknown) {
      await setTheme(previousTheme);
      setModal({ visible: true, type: 'danger', title: 'Theme not saved', message: themeError instanceof Error ? themeError.message : 'Your appearance preference could not be saved.' });
    }
  };

  const handleSaveAccount = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await settingsService.updateMobileSettings(userId, {
        firstName, lastName, userName, bio, theme, visibility, activityStatus, searchVisibility, messagePermissions, allowDirectMessages,
        analyticsSharing, marketingSharing, thirdPartySharing, pushEnabled, emailEnabled, smsEnabled, mentionAlerts, newMessageAlerts, newCommentAlerts,
        loginNotifications, suspiciousActivityAlerts, twoFactorEnabled, twoFactorMethod: twoFactorEnabled ? 'email' : null,
      });

      setModal({ visible: true, type: 'success', title: 'Settings saved', message: 'Your profile and preference settings have been updated.' });
    } catch (err) {
      console.error('[Settings] Save error:', err);
      setModal({ visible: true, type: 'danger', title: 'Settings not saved', message: 'Could not save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    if (!userId) return;
    try {
      await settingsService.unblockUser(userId, blockedId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedId));
      setModal({ visible: true, type: 'success', title: 'User unblocked', message: 'User has been removed from your block list.' });
    } catch (unblockError: unknown) {
      setModal({ visible: true, type: 'danger', title: 'User not unblocked', message: unblockError instanceof Error ? unblockError.message : 'Please try again.' });
    }
  };

  const handleDeleteAccount = async (password: string) => {
    setDeletingAccount(true);
    setDeleteError('');
    try {
      await accountLifecycleService.permanentlyDeleteCurrentAccount(password);
      setDeleteModalOpen(false);
      router.replace('/(auth)/login');
    } catch (deleteAccountError: unknown) {
      setDeleteError(deleteAccountError instanceof Error ? deleteAccountError.message : 'Your account could not be deleted.');
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading settings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.darkBorder]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={isDark ? '#f8fafc' : '#0f172a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textDark]}>Settings & Privacy</Text>
        <TouchableOpacity onPress={handleSaveAccount} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      {/* Settings Navigation Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {([
          { key: 'account', label: 'Account', icon: 'user' },
          { key: 'appearance', label: 'Appearance', icon: 'moon' },
          { key: 'privacy', label: 'Privacy', icon: 'lock' },
          { key: 'notifications', label: 'Notifications', icon: 'bell' },
          { key: 'blocked', label: 'Blocked', icon: 'user-x' },
          { key: 'security', label: 'Security', icon: 'shield' },
          { key: 'safety', label: 'Safety', icon: 'life-buoy' },
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
        {activeTab === 'appearance' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Appearance</Text>
            <Text style={[styles.switchSubtext, isDark && styles.subtextDark]}>Follow your phone automatically or choose a fixed appearance. The preference is saved to your account.</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {(['system', 'light', 'dark'] as const).map((themeOption) => {
                const selected = theme === themeOption;
                const iconName = themeOption === 'system' ? 'smartphone' : themeOption === 'light' ? 'sun' : 'moon';
                const label = themeOption === 'system' ? 'System' : themeOption === 'light' ? 'Light' : 'Dark';
                return <TouchableOpacity key={themeOption} onPress={() => void handleThemeChange(themeOption)} style={[styles.themeCard, isDark && styles.themeCardDark, selected && styles.themeCardSelected]}><Icon name={iconName} size={24} color={selected ? '#10b981' : isDark ? '#94a3b8' : '#64748b'} /><Text style={[styles.themeLabel, isDark && styles.textDark, selected && styles.themeLabelSelected]}>{label}</Text></TouchableOpacity>;
              })}
            </View>
          </View>
        )}
        {activeTab === 'account' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name</Text>
              <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} />
            </View>
            <Text style={styles.sectionTitle}>Policies and account controls</Text>
            <TouchableOpacity onPress={() => router.push('/policies')} style={styles.policyButton}><Icon name="file-text" size={18} color="#047857" /><Text style={styles.policyButtonText}>All Ourlime policies</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/child-safety-standards')} style={styles.policyButton}><Icon name="shield" size={18} color="#047857" /><Text style={styles.policyButtonText}>Child Safety Standards</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/delete-account')} style={styles.policyButton}><Icon name="info" size={18} color="#047857" /><Text style={styles.policyButtonText}>Account deletion information</Text></TouchableOpacity>
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
            <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.switchLabel}>Activity Status</Text><Text style={styles.switchSubtext}>Show when you are active</Text></View><Switch value={activityStatus} onValueChange={setActivityStatus} trackColor={{ true: '#10b981' }} /></View>
            <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.switchLabel}>Search Visibility</Text><Text style={styles.switchSubtext}>Allow people to find your profile</Text></View><Switch value={searchVisibility} onValueChange={setSearchVisibility} trackColor={{ true: '#10b981' }} /></View>
            <Text style={styles.label}>Who can message you</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>{(['everyone', 'friends', 'nobody'] as const).map((permission) => <TouchableOpacity key={permission} onPress={() => setMessagePermissions(permission)} style={[styles.visibilityOption, messagePermissions === permission && styles.visibilityOptionActive]}><Text style={[styles.visibilityText, messagePermissions === permission && styles.visibilityTextActive]}>{permission}</Text></TouchableOpacity>)}</View>
            <Text style={styles.sectionTitle}>Data sharing</Text>
            <View style={styles.switchRow}><Text style={styles.switchLabel}>Product analytics</Text><Switch value={analyticsSharing} onValueChange={setAnalyticsSharing} trackColor={{ true: '#10b981' }} /></View>
            <View style={styles.switchRow}><Text style={styles.switchLabel}>Marketing personalization</Text><Switch value={marketingSharing} onValueChange={setMarketingSharing} trackColor={{ true: '#10b981' }} /></View>
            <View style={styles.switchRow}><Text style={styles.switchLabel}>Third-party sharing</Text><Switch value={thirdPartySharing} onValueChange={setThirdPartySharing} trackColor={{ true: '#10b981' }} /></View>
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
            <View style={styles.switchRow}><Text style={styles.switchLabel}>SMS Alerts</Text><Switch value={smsEnabled} onValueChange={setSmsEnabled} trackColor={{ true: '#10b981' }} /></View>
            <View style={styles.switchRow}><Text style={styles.switchLabel}>New Messages</Text><Switch value={newMessageAlerts} onValueChange={setNewMessageAlerts} trackColor={{ true: '#10b981' }} /></View>
            <View style={styles.switchRow}><Text style={styles.switchLabel}>New Comments</Text><Switch value={newCommentAlerts} onValueChange={setNewCommentAlerts} trackColor={{ true: '#10b981' }} /></View>
            <NotificationSoundSettings />
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
            <Text style={styles.sectionTitle}>Password & Authentication</Text>
            <TouchableOpacity onPress={() => setPasswordModalOpen(true)} style={[styles.policyButton, { borderColor: '#10b981' }]}>
              <Icon name="lock" size={18} color="#10b981" />
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={[styles.policyButtonText, { color: isDark ? '#ffffff' : '#0f172a' }]}>Change Password</Text>
                <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>Update your login password securely</Text>
              </View>
              <Icon name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Login & Activity Alerts</Text>
            <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.switchLabel}>Login Notifications</Text><Text style={styles.switchSubtext}>Alert me about new sign-ins</Text></View><Switch value={loginNotifications} onValueChange={setLoginNotifications} trackColor={{ true: '#10b981' }} /></View>
            <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.switchLabel}>Suspicious Activity Alerts</Text><Text style={styles.switchSubtext}>Warn me about unusual account activity</Text></View><Switch value={suspiciousActivityAlerts} onValueChange={setSuspiciousActivityAlerts} trackColor={{ true: '#10b981' }} /></View>
            <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.switchLabel}>Two-factor Authentication</Text><Text style={styles.switchSubtext}>{twoFactorEnabled ? 'Enabled on your account' : 'Setup requires the secure verification workflow and is not exposed until it is available.'}</Text></View><Icon name={twoFactorEnabled ? 'check-circle' : 'lock'} size={20} color={twoFactorEnabled ? '#10b981' : '#94a3b8'} /></View>

            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Connected Accounts</Text>
            <View style={[styles.switchRow, { paddingVertical: 12 }]}>
              <Icon name="mail" size={20} color="#10b981" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.switchLabel}>Email & Password</Text>
                <Text style={styles.switchSubtext}>{authService.getVerifiedCurrentUser()?.email || 'Connected'}</Text>
              </View>
              <Icon name="check-circle" size={18} color="#10b981" />
            </View>

            <ActiveSessionsSection />

            <TouchableOpacity onPress={() => setModal({ visible: true, type: 'warning', title: 'Sign out?', message: 'You will need to sign in again to use Ourlime.', action: 'logout' })} style={[styles.signOutBtn, { marginTop: 16 }]}>
              <Icon name="log-out" size={18} color="#ef4444" />
              <Text style={styles.signOutText}>Sign Out of Ourlime</Text>
            </TouchableOpacity>
            <View style={styles.dangerZone}><Text style={styles.dangerTitle}>Danger Zone</Text><Text style={styles.switchSubtext}>Permanently delete your account and associated data.</Text><TouchableOpacity onPress={() => { setDeleteError(''); setDeleteModalOpen(true); }} style={styles.deleteAccountBtn}><Icon name="trash-2" size={18} color="#ffffff" /><Text style={styles.deleteAccountText}>Delete Account</Text></TouchableOpacity></View>
          </View>
        )}

        {activeTab === 'safety' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Safety</Text>
            <Text style={[styles.switchSubtext, isDark && styles.subtextDark]}>Access Ourlime safety standards, reporting guidance, and the restricted child-safety reporting flow.</Text>
            <TouchableOpacity onPress={() => router.push('/help')} style={styles.policyButton}><Icon name="life-buoy" size={18} color="#047857" /><Text style={styles.policyButtonText}>Help & reporting</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/child-safety-standards')} style={styles.policyButton}><Icon name="shield" size={18} color="#047857" /><Text style={styles.policyButtonText}>Child Safety Standards</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/policies')} style={styles.policyButton}><Icon name="file-text" size={18} color="#047857" /><Text style={styles.policyButtonText}>Policies & Community Guidelines</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <CustomModal visible={modal.visible} type={modal.type} title={modal.title} message={modal.message} confirmText={modal.action === 'logout' ? 'Sign Out' : 'OK'} cancelText={modal.action === 'logout' ? 'Cancel' : undefined} onClose={() => setModal((current) => ({ ...current, visible: false }))} onConfirm={modal.action === 'logout' ? () => { void authService.logout().then(() => router.replace('/(auth)/login')); } : undefined} />
      <ChangePasswordModal
        visible={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={() => {
          setPasswordModalOpen(false);
          setModal({ visible: true, type: 'success', title: 'Password Updated', message: 'Your password has been changed successfully.' });
        }}
      />
      <DeleteAccountModal visible={deleteModalOpen} isPasswordRequired={authService.getVerifiedCurrentUser()?.providerData.some((provider) => provider.providerId === 'password') ?? false} deleting={deletingAccount} error={deleteError} onClose={() => setDeleteModalOpen(false)} onDelete={(password) => void handleDeleteAccount(password)} />
    </SafeAreaView>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff' },
  containerDark: { backgroundColor: '#020617' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: isDark ? '#94a3b8' : '#64748b' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' },
  darkBorder: { borderBottomColor: '#1e293b' },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' },
  textDark: { color: '#f8fafc' },
  subtextDark: { color: '#94a3b8' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#10b981' },
  saveBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  tabBar: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#f1f5f9', paddingVertical: 8 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
  tabPillActive: { backgroundColor: '#10b981' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'capitalize' },
  tabTextActive: { color: '#ffffff' },
  content: { flex: 1 },
  section: { gap: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a', marginBottom: 4 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: isDark ? '#cbd5e1' : '#334155' },
  input: { borderWidth: 1, borderColor: isDark ? '#334155' : '#cbd5e1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: isDark ? '#f8fafc' : '#0f172a', backgroundColor: isDark ? '#0f172a' : '#ffffff' },
  visibilityOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#334155' : '#cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff' },
  visibilityOptionActive: { backgroundColor: '#d1fae5', borderColor: '#10b981' },
  visibilityText: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'capitalize' },
  visibilityTextActive: { color: '#047857' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' },
  switchLabel: { fontSize: 14, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a' },
  switchSubtext: { fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 },
  emptyText: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 14, fontStyle: 'italic' },
  blockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' },
  blockedName: { fontSize: 15, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a' },
  unblockBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#fee2e2' },
  unblockText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#fee2e2', marginTop: 12 },
  signOutText: { color: '#ef4444', fontSize: 15, fontWeight: '800' },
  policyButton: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 13, backgroundColor: isDark ? '#052e2b' : '#ecfdf5' },
  policyButtonText: { color: isDark ? '#6ee7b7' : '#047857', fontWeight: '800', fontSize: 14 },
  dangerZone: { gap: 10, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#fecaca', backgroundColor: isDark ? '#450a0a' : '#fff7f7', marginTop: 10 },
  dangerTitle: { color: '#ef4444', fontSize: 16, fontWeight: '900' },
  deleteAccountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, backgroundColor: '#dc2626', borderRadius: 12 },
  deleteAccountText: { color: '#ffffff', fontWeight: '900' },
  themeCard: { flex: 1, minHeight: 105, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#ffffff' },
  themeCardDark: { borderColor: '#334155', backgroundColor: '#0f172a' },
  themeCardSelected: { borderColor: '#10b981', borderWidth: 2, backgroundColor: isDark ? '#052e2b' : '#ecfdf5' },
  themeLabel: { color: '#475569', fontSize: 14, fontWeight: '800' },
  themeLabelSelected: { color: '#10b981' },
});
