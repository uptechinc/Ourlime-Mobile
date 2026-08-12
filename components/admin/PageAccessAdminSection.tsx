import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import { adminPageAccessService } from '@/lib/services/AdminPageAccessService';
import { getPageAccessBadge } from '@/lib/pageAccess/PageRegistry';
import type { PageAccessSetting, PageAccessStatus } from '@/lib/types/pageAccess';

const STATUSES: readonly PageAccessStatus[] = ['enabled', 'coming_soon', 'maintenance', 'beta_only', 'developer_only', 'admin_only', 'disabled'];
const LABELS: Record<PageAccessStatus, string> = {
  enabled: 'Enabled',
  coming_soon: 'Coming Soon',
  maintenance: 'Maintenance',
  beta_only: 'Beta Only',
  developer_only: 'Developer Only',
  admin_only: 'Admin Only',
  disabled: 'Disabled',
};

type FeedbackState = {
  visible: boolean;
  type: CustomModalType;
  title: string;
  message: string;
};

export default function PageAccessAdminSection() {
  const [settings, setSettings] = useState<PageAccessSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PageAccessStatus | 'all'>('all');
  const [editing, setEditing] = useState<PageAccessSetting | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<PageAccessStatus>('enabled');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ visible: false, type: 'info', title: '', message: '' });

  const loadSettings = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      setSettings(await adminPageAccessService.fetchSettings());
    } catch (error: unknown) {
      setFeedback({ visible: true, type: 'danger', title: 'Page settings unavailable', message: error instanceof Error ? error.message : 'Could not load page settings.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return settings.filter((setting) => {
      if (statusFilter !== 'all' && setting.status !== statusFilter) return false;
      return !normalized || `${setting.pageName} ${setting.route} ${setting.description || ''}`.toLowerCase().includes(normalized);
    });
  }, [query, settings, statusFilter]);

  const openEditor = (setting: PageAccessSetting) => {
    setEditing(setting);
    setSelectedStatus(setting.status);
  };

  const handleSave = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      await adminPageAccessService.updateSetting(editing.id, {
        status: selectedStatus,
        badgeText: getPageAccessBadge(selectedStatus),
        showPagePreview: selectedStatus !== 'disabled',
      });
      setSettings((current) => current.map((item) => item.id === editing.id ? { ...item, status: selectedStatus, badgeText: getPageAccessBadge(selectedStatus), showPagePreview: selectedStatus !== 'disabled' } : item));
      setEditing(null);
      setFeedback({ visible: true, type: 'success', title: 'Page access updated', message: `${editing.pageName} is now ${LABELS[selectedStatus].toLowerCase()}.` });
    } catch (error: unknown) {
      setFeedback({ visible: true, type: 'danger', title: 'Update failed', message: error instanceof Error ? error.message : 'Could not update this page.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ paddingVertical: 70, alignItems: 'center' }}><ActivityIndicator color="#10b981" /><Text style={{ marginTop: 10, color: '#64748b' }}>Loading page access settings…</Text></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0' }}>
        <Text style={{ color: '#0f172a', fontSize: 18, fontWeight: '800' }}>Page Availability</Text>
        <Text style={{ marginTop: 5, color: '#64748b', lineHeight: 19 }}>Control navigation visibility and the global mobile/web access overlay.</Text>
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12 }}>
          <Icon name="search" size={17} color="#94a3b8" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search pages or routes" style={{ flex: 1, paddingHorizontal: 9, paddingVertical: 11, color: '#0f172a' }} />
          {query ? <TouchableOpacity onPress={() => setQuery('')}><Icon name="x" size={17} color="#64748b" /></TouchableOpacity> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {(['all', ...STATUSES] as const).map((status) => (
            <TouchableOpacity key={status} onPress={() => setStatusFilter(status)} style={{ marginRight: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: statusFilter === status ? '#10b981' : '#f1f5f9' }}>
              <Text style={{ color: statusFilter === status ? '#ffffff' : '#475569', fontSize: 12, fontWeight: '700' }}>{status === 'all' ? 'All' : LABELS[status]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ marginTop: 12 }}>
        {filtered.map((setting) => (
          <TouchableOpacity key={setting.id} onPress={() => openEditor(setting)} style={{ marginBottom: 10, padding: 15, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}><Text style={{ color: '#0f172a', fontSize: 15, fontWeight: '800' }}>{setting.pageName}</Text><Text style={{ marginTop: 3, color: '#64748b', fontSize: 12 }}>{setting.route}</Text></View>
              <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: setting.status === 'enabled' ? '#ecfdf5' : setting.status === 'disabled' ? '#f1f5f9' : '#fffbeb' }}><Text style={{ color: setting.status === 'enabled' ? '#047857' : setting.status === 'disabled' ? '#475569' : '#92400e', fontSize: 10, fontWeight: '800' }}>{LABELS[setting.status]}</Text></View>
              <Icon name="chevron-right" size={17} color="#94a3b8" style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>
        ))}
        {!filtered.length ? <View style={{ paddingVertical: 50, alignItems: 'center' }}><Icon name="search" size={30} color="#cbd5e1" /><Text style={{ marginTop: 10, color: '#64748b' }}>No matching pages.</Text></View> : null}
      </View>

      <TouchableOpacity disabled={refreshing} onPress={() => void loadSettings(true)} style={{ marginVertical: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', padding: 10 }}><Icon name="refresh-cw" size={16} color="#047857" /><Text style={{ marginLeft: 7, color: '#047857', fontWeight: '700' }}>{refreshing ? 'Refreshing…' : 'Refresh settings'}</Text></TouchableOpacity>

      <Modal visible={Boolean(editing)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(null)}>
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}><TouchableOpacity onPress={() => setEditing(null)} style={{ padding: 5 }}><Icon name="x" size={22} color="#334155" /></TouchableOpacity><Text style={{ flex: 1, marginLeft: 12, color: '#0f172a', fontSize: 18, fontWeight: '800' }}>Edit {editing?.pageName}</Text></View>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
            <Text style={{ color: '#64748b', lineHeight: 20 }}>{editing?.description}</Text>
            <Text style={{ marginTop: 22, marginBottom: 10, color: '#0f172a', fontWeight: '800' }}>Availability status</Text>
            {STATUSES.map((status) => <TouchableOpacity key={status} onPress={() => setSelectedStatus(status)} style={{ marginBottom: 9, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 15, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: selectedStatus === status ? '#10b981' : '#e2e8f0' }}><Icon name={selectedStatus === status ? 'check-circle' : 'circle'} size={19} color={selectedStatus === status ? '#10b981' : '#94a3b8'} /><Text style={{ marginLeft: 11, color: '#0f172a', fontWeight: '700' }}>{LABELS[status]}</Text></TouchableOpacity>)}
            <TouchableOpacity disabled={saving} onPress={() => void handleSave()} style={{ marginTop: 16, alignItems: 'center', borderRadius: 16, backgroundColor: '#10b981', padding: 14 }}>{saving ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '800' }}>Save Changes</Text>}</TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <CustomModal visible={feedback.visible} type={feedback.type} title={feedback.title} message={feedback.message} onClose={() => setFeedback((current) => ({ ...current, visible: false }))} />
    </View>
  );
}
