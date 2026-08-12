import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import { AdminUserService, type AdminUserRecord, type AdminUserRole } from '@/lib/services/AdminUserService';

const adminUserService = AdminUserService.getInstance();
const roles: readonly AdminUserRole[] = ['user', 'premium', 'moderator', 'admin', 'developer'];

export default function UserManagementSection() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try { setUsers((await adminUserService.fetchUsers()).items); }
    catch (error: unknown) { setMessage(error instanceof Error ? error.message : 'Users could not be loaded'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);
  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? users.filter((user) => `${user.firstName} ${user.lastName} ${user.userName} ${user.email}`.toLowerCase().includes(query)) : users;
  }, [search, users]);

  const handleRole = async (role: AdminUserRole) => {
    if (!selectedUser || busy) return;
    setBusy(true);
    try {
      await adminUserService.updateRole(selectedUser.id, role);
      setUsers((current) => current.map((user) => user.id === selectedUser.id ? { ...user, role, isAdmin: role === 'admin' } : user));
      setSelectedUser((current) => current ? { ...current, role, isAdmin: role === 'admin' } : current);
      setMessage(`@${selectedUser.userName || selectedUser.email}'s role is now ${role}.`);
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : 'Role could not be changed'); }
    finally { setBusy(false); }
  };

  const handleLifecycle = async () => {
    if (!selectedUser || busy) return;
    const action = selectedUser.archived ? 'unarchive' : 'archive';
    setBusy(true);
    try {
      await adminUserService.updateLifecycle(selectedUser.id, action);
      const archived = action === 'archive';
      setUsers((current) => current.map((user) => user.id === selectedUser.id ? { ...user, archived } : user));
      setSelectedUser((current) => current ? { ...current, archived } : current);
      setMessage(archived ? 'Account archived.' : 'Account restored.');
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : 'Account status could not be changed'); }
    finally { setBusy(false); }
  };

  if (loading) return <View style={{ paddingVertical: 50, alignItems: 'center' }}><ActivityIndicator color="#10b981" /><Text style={{ marginTop: 8, color: '#64748b' }}>Loading users…</Text></View>;
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: '#f1f5f9', paddingHorizontal: 12, marginBottom: 14 }}><Icon name="search" size={18} color="#64748b" /><TextInput value={search} onChangeText={setSearch} placeholder="Search users" style={{ flex: 1, padding: 11, color: '#0f172a' }} /></View>
    {visibleUsers.map((user) => <TouchableOpacity key={user.id} onPress={() => setSelectedUser(user)} style={{ flexDirection: 'row', alignItems: 'center', padding: 13, marginBottom: 9, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }}><UserAvatar profileImage={user.profilePicture} firstName={user.firstName || user.userName || user.email} size={44} /><View style={{ flex: 1, marginLeft: 11 }}><Text numberOfLines={1} style={{ fontWeight: '900', color: '#0f172a' }}>{`${user.firstName} ${user.lastName}`.trim() || user.userName || user.email}</Text><Text numberOfLines={1} style={{ marginTop: 2, color: '#64748b', fontSize: 12 }}>@{user.userName || 'unknown'} · {user.role}</Text></View>{user.archived ? <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '800' }}>ARCHIVED</Text> : <Icon name="chevron-right" size={18} color="#94a3b8" />}</TouchableOpacity>)}
    <Modal visible={Boolean(selectedUser)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedUser(null)}><SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}><View style={{ flexDirection: 'row', padding: 16, backgroundColor: '#fff' }}><Text style={{ flex: 1, fontSize: 19, fontWeight: '900' }}>Manage user</Text><TouchableOpacity onPress={() => setSelectedUser(null)}><Icon name="x" size={24} color="#475569" /></TouchableOpacity></View>{selectedUser ? <ScrollView contentContainerStyle={{ padding: 18 }}><View style={{ alignItems: 'center' }}><UserAvatar profileImage={selectedUser.profilePicture} firstName={selectedUser.firstName || selectedUser.userName} size={70} /><Text style={{ marginTop: 10, fontSize: 19, fontWeight: '900' }}>{`${selectedUser.firstName} ${selectedUser.lastName}`.trim()}</Text><Text style={{ color: '#64748b' }}>{selectedUser.email}</Text></View><Text style={{ marginTop: 24, marginBottom: 8, fontWeight: '900', color: '#334155' }}>Platform role</Text>{roles.map((role) => <TouchableOpacity key={role} disabled={busy || selectedUser.role === role} onPress={() => void handleRole(role)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 7, borderRadius: 13, backgroundColor: selectedUser.role === role ? '#d1fae5' : '#fff' }}><Text style={{ flex: 1, textTransform: 'capitalize', color: selectedUser.role === role ? '#047857' : '#334155', fontWeight: '800' }}>{role}</Text>{selectedUser.role === role ? <Icon name="check" size={18} color="#047857" /> : null}</TouchableOpacity>)}<TouchableOpacity disabled={busy} onPress={() => void handleLifecycle()} style={{ marginTop: 20, padding: 15, borderRadius: 14, alignItems: 'center', backgroundColor: selectedUser.archived ? '#10b981' : '#dc2626' }}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>{selectedUser.archived ? 'Restore account' : 'Archive account'}</Text>}</TouchableOpacity></ScrollView> : null}</SafeAreaView></Modal>
    <CustomModal visible={Boolean(message)} title="User management" message={message ?? ''} type="info" onClose={() => setMessage(null)} />
  </>;
}
