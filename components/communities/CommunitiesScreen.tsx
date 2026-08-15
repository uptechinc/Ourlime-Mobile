import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Grid2X2, List, Plus, RefreshCw, Search, SlidersHorizontal, Users, X } from 'lucide-react-native';
import { CommunityService } from '@/lib/services/CommunityService';
import CreateCommunityModal from './CreateCommunityModal';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { useCommunitiesResource } from '@/lib/hooks/useCommunitiesResource';
import type { CommunityCardModel, CommunityDirectoryQuery, CommunityDirectoryScope, CommunityDirectorySort, CommunityDirectoryViewMode, CommunityDirectoryVisibility } from '@/lib/types/community';
import CommunityCard from './CommunityCard';
import CommunityOfTheWeek from './CommunityOfTheWeek';
import { ModerationService } from '@/lib/services/ModerationService';
import CommunityReportModal from './CommunityReportModal';
import type { ReportReasonCategory } from '@/lib/services/ModerationService';
import CommunityFiltersSheet from './CommunityFiltersSheet';

type ConfirmationAction = 'leave' | null;
type ConfirmationState = { action: ConfirmationAction; community: CommunityCardModel | null };

const communityService = CommunityService.getInstance();
const moderationService = ModerationService.getInstance();
const SCOPES: { value: CommunityDirectoryScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'joined', label: 'Joined' },
  { value: 'friends', label: 'Friends' },
  { value: 'new', label: 'New' },
  { value: 'created', label: 'Mine' },
];

export default function CommunitiesScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { activeUserId } = useAppData();
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<CommunityDirectoryScope>('all');
  const [visibility, setVisibility] = useState<CommunityDirectoryVisibility>('all');
  const [sort, setSort] = useState<CommunityDirectorySort>('popular');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CommunityDirectoryViewMode>('grid');
  const [createVisible, setCreateVisible] = useState(false);
  const [busyCommunityId, setBusyCommunityId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({ action: null, community: null });
  const [reportCommunity, setReportCommunity] = useState<CommunityCardModel | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const columnCount = viewMode === 'grid' && width >= 720 ? 2 : 1;
  const directoryQuery = useMemo<CommunityDirectoryQuery>(() => ({ scope, visibility, categoryId: selectedCategoryId, search: searchQuery, sort, cursor: null, limit: 20 }), [scope, visibility, selectedCategoryId, searchQuery, sort]);
  const { resource, categories, refresh, loadMore, patchCommunity } = useCommunitiesResource(activeUserId ?? '', directoryQuery);
  const selectedCategory = categories.data?.find((category) => category.id === selectedCategoryId) ?? null;
  const activeFilterCount = (visibility === 'all' ? 0 : 1) + (selectedCategoryId ? 1 : 0) + (sort === 'popular' ? 0 : 1);

  useEffect(() => {
    const timeout = setTimeout(() => setSearchQuery(searchText.trim()), 350);
    return () => clearTimeout(timeout);
  }, [searchText]);

  const handleOpen = (community: CommunityCardModel): void => {
    router.push({ pathname: '/communities/[id]', params: { id: community.slug || community.id } });
  };

  const handleManualRefresh = async (): Promise<void> => {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    try {
      await refresh();
    } finally {
      setManualRefreshing(false);
    }
  };

  const reconcileCommunity = async (communityId: string): Promise<void> => {
    const community = await communityService.fetchCommunity(communityId);
    await patchCommunity(community);
    await refresh();
  };

  const handleMembershipAction = async (community: CommunityCardModel): Promise<void> => {
    if (busyCommunityId) return;
    setBusyCommunityId(community.id);
    try {
      if (community.membershipState === 'pending') await communityService.cancelRequest(community.id);
      else await communityService.joinOrRequestAccess(community);
      await reconcileCommunity(community.id);
      setFeedback(community.membershipState === 'pending' ? 'Your join request was canceled.' : community.isPrivate ? 'Your access request was sent.' : `You joined ${community.title}.`);
    } catch (error: unknown) {
      setFeedback(error instanceof Error ? error.message : 'Community membership could not be updated.');
    } finally {
      setBusyCommunityId(null);
    }
  };

  const handleConfirmedAction = async (): Promise<void> => {
    const community = confirmation.community;
    const action = confirmation.action;
    if (!community || !action || busyCommunityId) return;
    setBusyCommunityId(community.id);
    try {
      await communityService.leaveCommunity(community.id);
      await reconcileCommunity(community.id);
      setFeedback(`You left ${community.title}.`);
    } catch (error: unknown) {
      setFeedback(error instanceof Error ? error.message : 'The community action could not be completed.');
    } finally {
      setBusyCommunityId(null);
      setConfirmation({ action: null, community: null });
    }
  };

  const renderCommunity = ({ item, index }: { item: CommunityCardModel; index: number }) => (
    <View style={{ flex: 1, marginLeft: columnCount === 2 && index % 2 === 1 ? 6 : 16, marginRight: columnCount === 2 && index % 2 === 0 ? 6 : 16, marginBottom: 14 }}>
      <CommunityCard community={item} viewMode={viewMode} busy={busyCommunityId === item.id} onOpen={handleOpen} onMembershipAction={(community) => void handleMembershipAction(community)} onLeave={(community) => setConfirmation({ action: 'leave', community })} onReport={setReportCommunity} />
    </View>
  );

  const listHeader = (
    <View>
      {resource.data?.communityOfTheWeek ? <CommunityOfTheWeek community={resource.data.communityOfTheWeek} onOpen={handleOpen} /> : null}
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <Text style={{ marginBottom: 8, color: colors.mutedText, fontWeight: '900', fontSize: 10, letterSpacing: 0.7 }}>BROWSE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
          {SCOPES.map((scopeOption) => <TouchableOpacity key={scopeOption.value} onPress={() => setScope(scopeOption.value)} style={{ marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: scope === scopeOption.value ? colors.selectedControl : colors.control }}><Text style={{ color: scope === scopeOption.value ? colors.selectedText : colors.secondaryText, fontWeight: '800', fontSize: 12 }}>{scopeOption.label}</Text></TouchableOpacity>)}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 13 }}>
          <TouchableOpacity onPress={() => setFiltersVisible(true)} style={{ flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: activeFilterCount ? colors.accent : colors.border }}>
            <SlidersHorizontal size={17} color={activeFilterCount ? colors.accent : colors.icon} />
            <Text style={{ flex: 1, marginLeft: 7, color: colors.text, fontWeight: '900' }}>Filters & sort</Text>
            {activeFilterCount ? <View style={{ minWidth: 23, height: 23, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontSize: 11, fontWeight: '900' }}>{activeFilterCount}</Text></View> : <Text style={{ color: colors.mutedText, fontSize: 11, textTransform: 'capitalize' }}>{sort}</Text>}
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Grid view" onPress={() => setViewMode('grid')} style={{ marginLeft: 8, padding: 8, borderRadius: 10, backgroundColor: viewMode === 'grid' ? colors.selectedControl : colors.control }}><Grid2X2 size={17} color={viewMode === 'grid' ? colors.selectedText : colors.icon} /></TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Compact list view" onPress={() => setViewMode('list')} style={{ marginLeft: 6, padding: 8, borderRadius: 10, backgroundColor: viewMode === 'list' ? colors.selectedControl : colors.control }}><List size={17} color={viewMode === 'list' ? colors.selectedText : colors.icon} /></TouchableOpacity>
        </View>
        {activeFilterCount ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ paddingRight: 8 }}>
          {visibility !== 'all' ? <TouchableOpacity onPress={() => setVisibility('all')} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.successSurface }}><Text style={{ color: colors.accentText, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }}>{visibility}</Text><X size={13} color={colors.accentText} style={{ marginLeft: 4 }} /></TouchableOpacity> : null}
          {selectedCategory ? <TouchableOpacity onPress={() => setSelectedCategoryId(null)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.successSurface }}><Text style={{ color: colors.accentText, fontSize: 11, fontWeight: '800' }}>{selectedCategory.name}</Text><X size={13} color={colors.accentText} style={{ marginLeft: 4 }} /></TouchableOpacity> : null}
          {sort !== 'popular' ? <TouchableOpacity onPress={() => setSort('popular')} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.successSurface }}><Text style={{ color: colors.accentText, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }}>{sort}</Text><X size={13} color={colors.accentText} style={{ marginLeft: 4 }} /></TouchableOpacity> : null}
        </ScrollView> : null}
        <Text style={{ marginTop: 12, color: colors.mutedText, fontSize: 12 }}>{resource.data ? `${resource.data.items.length} of ${resource.data.totalCount} communities` : 'Loading communities…'}</Text>
        {resource.error && resource.data ? <Text style={{ marginTop: 8, color: colors.warningText, fontSize: 12 }}>Showing saved communities while the latest update is unavailable.</Text> : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1, fontSize: 24, fontWeight: '900', color: colors.text }}>Communities</Text><TouchableOpacity disabled={manualRefreshing} onPress={() => void handleManualRefresh()} accessibilityLabel="Refresh communities" style={{ padding: 9, borderRadius: 12, backgroundColor: colors.control }}>{manualRefreshing ? <ActivityIndicator size="small" color={colors.accent} /> : <RefreshCw size={18} color={colors.icon} />}</TouchableOpacity><TouchableOpacity onPress={() => setCreateVisible(true)} style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 }}><Plus size={17} color={colors.onAccent} /><Text style={{ marginLeft: 5, color: colors.onAccent, fontWeight: '800' }}>Create</Text></TouchableOpacity></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, borderRadius: 14, paddingHorizontal: 12, marginTop: 12, borderWidth: 1, borderColor: colors.border }}><Search size={18} color={colors.icon} /><TextInput value={searchText} onChangeText={setSearchText} placeholder="Search communities" placeholderTextColor={colors.mutedText} style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 11, color: colors.text }} /></View>
      </View>
      {!resource.data && (resource.status === 'idle' || resource.status === 'hydrating') ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View> : !resource.data && resource.status === 'error' ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}><Users size={42} color={colors.destructive} /><Text style={{ marginTop: 13, color: colors.text, fontWeight: '900', fontSize: 18 }}>Communities unavailable</Text><Text style={{ color: colors.mutedText, textAlign: 'center', lineHeight: 21, marginTop: 7 }}>{resource.error?.message ?? 'Check your connection and try again.'}</Text><TouchableOpacity onPress={() => void handleManualRefresh()} style={{ backgroundColor: colors.accent, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, marginTop: 16 }}><Text style={{ color: colors.onAccent, fontWeight: '800' }}>Retry</Text></TouchableOpacity></View> : <FlatList key={`${viewMode}-${columnCount}`} data={resource.data?.items ?? []} numColumns={columnCount} keyExtractor={(community) => community.id} renderItem={renderCommunity} ListHeaderComponent={listHeader} contentContainerStyle={{ paddingBottom: 42, flexGrow: resource.data?.items.length ? undefined : 1 }} refreshControl={<RefreshControl refreshing={manualRefreshing} onRefresh={() => void handleManualRefresh()} tintColor={colors.accent} />} onEndReached={() => void loadMore()} onEndReachedThreshold={0.35} ListFooterComponent={resource.status === 'refreshing' && resource.data?.hasMore && !manualRefreshing ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} /> : null} ListEmptyComponent={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}><Users size={42} color={colors.accent} /><Text style={{ fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 12 }}>No communities found</Text><Text style={{ color: colors.mutedText, marginTop: 5, textAlign: 'center' }}>Adjust your filters or create a community for this space.</Text><TouchableOpacity onPress={() => setCreateVisible(true)} style={{ marginTop: 14 }}><Text style={{ color: colors.accentText, fontWeight: '900' }}>Create a community</Text></TouchableOpacity></View>} />}
      <CreateCommunityModal visible={createVisible} categories={categories.data ?? []} onClose={() => setCreateVisible(false)} onCreated={(community) => { void patchCommunity(community).then(() => refresh()); }} />
      <CustomModal visible={Boolean(feedback)} title="Community" message={feedback ?? ''} type="info" onClose={() => setFeedback(null)} />
      <CustomModal visible={confirmation.action !== null} title={`Leave ${confirmation.community?.title ?? 'community'}?`} message="You will lose access to member-only posts until you join again." type="warning" confirmText="Leave community" cancelText="Cancel" isLoading={Boolean(busyCommunityId)} onConfirm={() => void handleConfirmedAction()} onCancel={() => setConfirmation({ action: null, community: null })} onClose={() => setConfirmation({ action: null, community: null })} />
      <CommunityReportModal visible={reportCommunity !== null} title="Report community" subjectLabel={reportCommunity?.title ?? ''} onClose={() => setReportCommunity(null)} onSubmit={async (category: ReportReasonCategory, reason: string, details: string) => { if (!reportCommunity) return; await moderationService.reportCommunity({ targetId: reportCommunity.id, reasonCategory: category, reason, description: details, routePath: `/communities/${reportCommunity.slug || reportCommunity.id}` }); setFeedback('Your report was sent to Ourlime moderation.'); }} />
      <CommunityFiltersSheet visible={filtersVisible} categories={categories.data ?? []} visibility={visibility} sort={sort} categoryId={selectedCategoryId} onClose={() => setFiltersVisible(false)} onApply={(nextVisibility, nextSort, nextCategoryId) => { setVisibility(nextVisibility); setSort(nextSort); setSelectedCategoryId(nextCategoryId); }} />
    </SafeAreaView>
  );
}
