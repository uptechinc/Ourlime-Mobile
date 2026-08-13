import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import CustomModal from '@/components/ui/CustomModal';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import { AdminWorkspaceService, type AdminWorkspaceItem, type AdminWorkspaceKind, type AdminWorkspaceStatus } from '@/lib/services/AdminWorkspaceService';

type AdminCollectionWorkspaceProps = {
  kind: AdminWorkspaceKind;
  title: string;
  subtitle: string;
};

const workspaceService = AdminWorkspaceService.getInstance();
const STATUS_FILTERS: ReadonlyArray<AdminWorkspaceStatus | 'all'> = ['all', 'active', 'pending', 'approved', 'rejected', 'archived', 'disabled'];

export default function AdminCollectionWorkspace({ kind, title, subtitle }: AdminCollectionWorkspaceProps) {
  const [items, setItems] = useState<AdminWorkspaceItem[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AdminWorkspaceStatus | 'all'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [selected, setSelected] = useState<AdminWorkspaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try { setItems(await workspaceService.fetchWorkspaceItems(kind)); }
    catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : `${title} could not be loaded.`); }
    finally { setLoading(false); setRefreshing(false); }
  }, [kind, title]);

  useEffect(() => { void load(); }, [load]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => status === 'all' || item.status === status)
      .filter((item) => !normalizedQuery || `${item.title} ${item.subtitle} ${item.description} ${item.category}`.toLowerCase().includes(normalizedQuery))
      .sort((first, second) => sort === 'name' ? first.title.localeCompare(second.title) : sort === 'oldest' ? first.createdAtMs - second.createdAtMs : second.createdAtMs - first.createdAtMs);
  }, [items, query, sort, status]);

  const handleStatus = async (nextStatus: AdminWorkspaceStatus) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await workspaceService.setWorkspaceStatus(kind, selected.id, nextStatus);
      setItems((current) => current.map((item) => item.id === selected.id ? { ...item, status: nextStatus, isActive: nextStatus === 'active' || nextStatus === 'approved' } : item));
      setSelected((current) => current ? { ...current, status: nextStatus } : null);
      setMessage(`${selected.title} is now ${nextStatus}.`);
    } catch (actionError: unknown) { setMessage(actionError instanceof Error ? actionError.message : 'Status could not be updated.'); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await workspaceService.deleteWorkspaceItem(kind, selected.id);
      setItems((current) => current.filter((item) => item.id !== selected.id));
      setMessage(`${selected.title} was deleted.`);
      setSelected(null);
    } catch (actionError: unknown) { setMessage(actionError instanceof Error ? actionError.message : 'Item could not be deleted.'); }
    finally { setBusy(false); }
  };

  return (
    <AdminWorkspaceShell title={title} subtitle={subtitle} loading={loading} refreshing={refreshing} error={error} onRefresh={() => void load(true)}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
        <View style={{ flex: 1, minWidth: 150, marginRight: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12 }}><Icon name="search" size={17} color="#64748b" /><TextInput value={query} onChangeText={setQuery} placeholder={`Search ${kind}`} style={{ flex: 1, padding: 11, color: '#0f172a' }} /></View>
        <TouchableOpacity onPress={() => setSort((current) => current === 'newest' ? 'oldest' : current === 'oldest' ? 'name' : 'newest')} style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 13 }}><Icon name="sliders" size={16} color="#475569" /><Text style={{ marginLeft: 7, textTransform: 'capitalize', color: '#475569', fontWeight: '700' }}>{sort}</Text></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {STATUS_FILTERS.map((filterStatus) => <TouchableOpacity key={filterStatus} onPress={() => setStatus(filterStatus)} style={{ marginRight: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: status === filterStatus ? '#10b981' : '#e2e8f0' }}><Text style={{ textTransform: 'capitalize', color: status === filterStatus ? '#ffffff' : '#475569', fontSize: 12, fontWeight: '800' }}>{filterStatus}</Text></TouchableOpacity>)}
      </ScrollView>
      <Text style={{ marginBottom: 10, color: '#64748b', fontSize: 12 }}>{visibleItems.length} of {items.length} records</Text>
      {visibleItems.map((item) => <TouchableOpacity key={item.id} onPress={() => setSelected(item)} style={{ marginBottom: 10, padding: 13, borderRadius: 17, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' }}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: '#f1f5f9' }} /> : <View style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}><Icon name={kind === 'products' ? 'shopping-bag' : kind === 'communities' ? 'users' : kind === 'sticker_packs' ? 'package' : 'smile'} size={22} color="#10b981" /></View>}
        <View style={{ flex: 1, marginLeft: 11 }}><Text numberOfLines={1} style={{ color: '#0f172a', fontWeight: '900' }}>{item.title}</Text><Text numberOfLines={1} style={{ marginTop: 3, color: '#64748b', fontSize: 12 }}>{item.subtitle}{item.metricLabel ? ` · ${item.metricLabel}` : ''}</Text><Text style={{ marginTop: 5, color: item.status === 'active' || item.status === 'approved' ? '#047857' : item.status === 'rejected' || item.status === 'disabled' ? '#b91c1c' : '#92400e', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{item.status}</Text></View><Icon name="chevron-right" size={18} color="#94a3b8" />
      </TouchableOpacity>)}
      {!visibleItems.length ? <View style={{ paddingVertical: 50, alignItems: 'center' }}><Icon name="inbox" size={36} color="#cbd5e1" /><Text style={{ marginTop: 10, color: '#64748b' }}>No matching records.</Text></View> : null}

      <Modal visible={Boolean(selected)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}><SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}><View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#ffffff' }}><Text style={{ flex: 1, fontSize: 19, fontWeight: '900', color: '#0f172a' }}>{selected?.title}</Text><TouchableOpacity onPress={() => setSelected(null)}><Icon name="x" size={24} color="#475569" /></TouchableOpacity></View>{selected ? <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 50 }}><Text style={{ color: '#64748b', lineHeight: 20 }}>{selected.description || 'No description supplied.'}</Text><Text style={{ marginTop: 18, color: '#334155', fontWeight: '800' }}>Record ID</Text><Text selectable style={{ marginTop: 4, color: '#64748b' }}>{selected.id}</Text><Text style={{ marginTop: 18, marginBottom: 10, color: '#334155', fontWeight: '800' }}>Moderation status</Text>{(['active', 'approved', 'pending', 'rejected', 'archived', 'disabled'] as const).map((nextStatus) => <TouchableOpacity key={nextStatus} disabled={busy || selected.status === nextStatus} onPress={() => void handleStatus(nextStatus)} style={{ marginBottom: 8, flexDirection: 'row', padding: 14, borderRadius: 14, backgroundColor: selected.status === nextStatus ? '#d1fae5' : '#ffffff' }}><Text style={{ flex: 1, textTransform: 'capitalize', color: selected.status === nextStatus ? '#047857' : '#334155', fontWeight: '800' }}>{nextStatus}</Text>{selected.status === nextStatus ? <Icon name="check" size={18} color="#047857" /> : null}</TouchableOpacity>)}<TouchableOpacity disabled={busy} onPress={() => void handleDelete()} style={{ marginTop: 18, alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: '#c64d53' }}><Text style={{ color: '#ffffff', fontWeight: '900' }}>Delete permanently</Text></TouchableOpacity></ScrollView> : null}</SafeAreaView></Modal>
      <CustomModal visible={Boolean(message)} type="info" title={title} message={message ?? ''} onClose={() => setMessage(null)} />
    </AdminWorkspaceShell>
  );
}
