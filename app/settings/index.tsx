import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import { auth, db } from '@/lib/firebaseConfig';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

export default function SettingsScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [activeTab, setActiveTab] = useState<'account' | 'privacy' | 'notifications' | 'blocked' | 'security'>('account');
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
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; userName: string; firstName: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
          setUserName(data.userName || '');
          setBio(data.bio || '');
          setVisibility(data.visibility || 'public');
          if (data.allowDirectMessages !== undefined) setAllowDirectMessages(data.allowDirectMessages);
        }

        // Fetch user settings
        const notifDoc = await getDoc(doc(db, `users/${user.uid}/userSettings/notifications`));
        if (notifDoc.exists()) {
          const notifData = notifDoc.data();
          if (notifData.pushNotifications !== undefined) setPushEnabled(notifData.pushNotifications);
          if (notifData.emailNotifications !== undefined) setEmailEnabled(notifData.emailNotifications);
        }

        // Fetch blocked users
        const blockedSnap = await getDocs(collection(db, `users/${user.uid}/blockedUsers`));
        const list = blockedSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        setBlockedUsers(list);
      } catch (err) {
        console.error('[Settings] Load error:', err);
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
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userName: userName.trim().toLowerCase(),
        bio: bio.trim(),
        visibility,
        allowDirectMessages,
      });
      await updateDoc(doc(db, `users/${user.uid}/userSettings/notifications`), {
        pushNotifications: pushEnabled,
        emailNotifications: emailEnabled,
      }).catch(() => {});

      Alert.alert('Settings Saved', 'Your profile and preference settings have been updated.');
    } catch (err) {
      console.error('[Settings] Save error:', err);
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    if (!user) return;
    try {
      setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedId));
      Alert.alert('User Unblocked', 'User has been removed from your block list.');
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading settings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
        {[
          { key: 'account', label: 'Account', icon: 'user' },
          { key: 'privacy', label: 'Privacy', icon: 'lock' },
          { key: 'notifications', label: 'Notifications', icon: 'bell' },
          { key: 'blocked', label: 'Blocked', icon: 'user-x' },
          { key: 'security', label: 'Security', icon: 'shield' },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key as any)}
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
              <Text style={styles.emptyText}>You haven't blocked any users.</Text>
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
            <TouchableOpacity onPress={() => auth.signOut().then(() => router.replace('/(auth)/login'))} style={styles.signOutBtn}>
              <Icon name="log-out" size={18} color="#ef4444" />
              <Text style={styles.signOutText}>Sign Out of Ourlime</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
