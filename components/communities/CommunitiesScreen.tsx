import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Lock, Plus, Search, Users } from 'lucide-react-native';
import { CommunityService, type CommunitySummary } from '@/lib/services/CommunityService';
import CreateCommunityModal from './CreateCommunityModal';
import CustomModal from '@/components/ui/CustomModal';

type CommunityTab = 'all' | 'joined' | 'new' | 'created';

const communityService = CommunityService.getInstance();

export default function CommunitiesScreen() {
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CommunityTab>('all');
  const [createVisible, setCreateVisible] = useState(false);
  const [busyCommunityId, setBusyCommunityId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadCommunities = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      setCommunities(await communityService.fetchCommunities());
    } catch (loadError: unknown) {
      console.error('[CommunitiesScreen.loadCommunities]', loadError);
      setError('We could not load communities. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadCommunities(); }, [loadCommunities]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let visible = [...communities];
    if (activeTab === 'joined') visible = visible.filter((community) => community.isMember);
    if (activeTab === 'created') visible = visible.filter((community) => community.creatorId && community.isMember && community.creatorId === communityService.getCurrentUserId());
    if (activeTab === 'new') visible.reverse();
    if (!query) return visible;
    return visible.filter((community) => `${community.title} ${community.description}`.toLowerCase().includes(query));
  }, [activeTab, communities, search]);

  const handleCommunityAction = async (community: CommunitySummary) => {
    if (busyCommunityId || community.isMember || community.requestStatus === 'pending') return;
    setBusyCommunityId(community.id);
    try {
      const result = await communityService.joinOrRequestAccess(community);
      setCommunities((current) => current.map((item) => item.id === community.id ? {
        ...item,
        isMember: result === 'joined',
        requestStatus: result === 'requested' ? 'pending' : item.requestStatus,
        membershipCount: item.membershipCount + (result === 'joined' ? 1 : 0),
      } : item));
      setActionMessage(result === 'joined' ? 'You joined the community.' : 'Your access request was sent.');
    } catch (actionError: unknown) {
      setActionMessage(actionError instanceof Error ? actionError.message : 'Community membership could not be updated');
    } finally {
      setBusyCommunityId(null);
    }
  };

  const renderCommunity = ({ item }: { item: CommunitySummary }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/communities/[id]', params: { id: item.id } })}
      style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' }}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: 150 }} resizeMode="cover" />
      ) : (
        <View style={{ height: 120, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={38} color="#10b981" />
        </View>
      )}
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: '#0f172a' }}>{item.title}</Text>
          {item.isPrivate ? <Lock size={15} color="#64748b" /> : null}
        </View>
        {item.description ? <Text numberOfLines={2} style={{ color: '#64748b', marginTop: 6, lineHeight: 19 }}>{item.description}</Text> : null}
        <Text style={{ color: '#059669', fontWeight: '700', marginTop: 10 }}>{item.membershipCount.toLocaleString()} members</Text>
        {!item.isMember ? <TouchableOpacity disabled={busyCommunityId === item.id || item.requestStatus === 'pending'} onPress={() => void handleCommunityAction(item)} style={{ marginTop: 12, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: item.requestStatus === 'pending' ? '#e2e8f0' : '#10b981' }}>{busyCommunityId === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: item.requestStatus === 'pending' ? '#64748b' : '#fff', fontWeight: '800' }}>{item.requestStatus === 'pending' ? 'Request pending' : item.isPrivate ? 'Request access' : 'Join community'}</Text>}</TouchableOpacity> : <View style={{ marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#d1fae5' }}><Text style={{ color: '#047857', fontWeight: '800', fontSize: 12 }}>Joined</Text></View>}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1, fontSize: 24, fontWeight: '900', color: '#0f172a' }}>Communities</Text><TouchableOpacity onPress={() => setCreateVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 }}><Plus size={17} color="#fff" /><Text style={{ marginLeft: 5, color: '#fff', fontWeight: '800' }}>Create</Text></TouchableOpacity></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 14, paddingHorizontal: 12, marginTop: 12 }}>
          <Search size={18} color="#64748b" />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search communities" placeholderTextColor="#94a3b8" style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 11, color: '#0f172a' }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ paddingRight: 8 }}>
          {(['all', 'joined', 'new', 'created'] as const).map((tab) => <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={{ marginRight: 8, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: activeTab === tab ? '#10b981' : '#f1f5f9' }}><Text style={{ color: activeTab === tab ? '#fff' : '#475569', fontWeight: '800', textTransform: 'capitalize' }}>{tab === 'created' ? 'My communities' : tab}</Text></TouchableOpacity>)}
        </ScrollView>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#10b981" /></View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ color: '#475569', textAlign: 'center', lineHeight: 21 }}>{error}</Text>
          <TouchableOpacity onPress={() => void loadCommunities()} style={{ backgroundColor: '#10b981', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, marginTop: 16 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderCommunity}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 40, flexGrow: filtered.length === 0 ? 1 : undefined }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadCommunities(true)} tintColor="#10b981" />}
          ListEmptyComponent={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}><Users size={42} color="#10b981" /><Text style={{ fontSize: 19, fontWeight: '800', color: '#0f172a', marginTop: 12 }}>No communities found</Text><Text style={{ color: '#64748b', marginTop: 5 }}>Try a different search or check back later.</Text></View>}
        />
      )}
      <CreateCommunityModal visible={createVisible} onClose={() => setCreateVisible(false)} onCreated={(community) => setCommunities((current) => [community, ...current])} />
      <CustomModal visible={Boolean(actionMessage)} title="Community" message={actionMessage ?? ''} type="info" onClose={() => setActionMessage(null)} />
    </SafeAreaView>
  );
}
