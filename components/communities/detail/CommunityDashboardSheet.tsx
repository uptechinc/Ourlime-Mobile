import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Activity, BarChart3, CheckCircle2, EyeOff, Flag, RefreshCw, Search, Shield, Users, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityCardModel, CommunityDashboardData, CommunityJoinRequest, CommunityMember, CommunityPage, CommunityReportItem } from '@/lib/types/community';
import type { CommunityReportAction } from '@/lib/services/CommunityDashboardService';
import type { ResourceState } from '@/lib/types/resourceState';
import CachedImage from '@/components/ui/CachedImage';

type DashboardTab = 'overview' | 'members' | 'requests' | 'activity' | 'reports';
type CommunityDashboardSheetProps = {
  visible: boolean;
  community: CommunityCardModel;
  members: ResourceState<CommunityPage<CommunityMember>>;
  requests: ResourceState<CommunityPage<CommunityJoinRequest>>;
  dashboard: ResourceState<CommunityDashboardData>;
  onClose: () => void;
  onLoadMembers: (force?: boolean) => void;
  onLoadRequests: (force?: boolean) => void;
  onLoadDashboard: (force?: boolean) => void;
  onReviewRequest: (request: CommunityJoinRequest, action: 'approve' | 'decline') => Promise<void>;
  onManageMember: (member: CommunityMember) => void;
  onModerateReport: (report: CommunityReportItem, action: CommunityReportAction) => Promise<void>;
};

const TABS: { value: DashboardTab; label: string }[] = [
  { value: 'overview', label: 'Overview' }, { value: 'members', label: 'Members' }, { value: 'requests', label: 'Requests' }, { value: 'activity', label: 'Activity' }, { value: 'reports', label: 'Reports' },
];

export default function CommunityDashboardSheet({ visible, community, members, requests, dashboard, onClose, onLoadMembers, onLoadRequests, onLoadDashboard, onReviewRequest, onManageMember, onModerateReport }: CommunityDashboardSheetProps) {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CommunityReportItem['status']>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    onLoadDashboard();
    onLoadMembers();
    onLoadRequests();
  }, [onLoadDashboard, onLoadMembers, onLoadRequests, visible]);

  useEffect(() => {
    if (!visible) {
      setTab('overview');
      setSearch('');
      setStatusFilter('all');
      setBusyId(null);
    }
  }, [visible]);

  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (members.data?.items ?? []).filter((member) => !query || `${member.firstName} ${member.lastName} ${member.userName}`.toLowerCase().includes(query));
  }, [members.data?.items, search]);
  const activities = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (dashboard.data?.activities ?? []).filter((activity) => !query || `${activity.title} ${activity.creatorName} ${activity.type}`.toLowerCase().includes(query));
  }, [dashboard.data?.activities, search]);
  const reports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (dashboard.data?.reports ?? []).filter((report) => (statusFilter === 'all' || report.status === statusFilter) && (!query || `${report.title} ${report.reporterName} ${report.reason}`.toLowerCase().includes(query)));
  }, [dashboard.data?.reports, search, statusFilter]);

  const runRequest = async (request: CommunityJoinRequest, action: 'approve' | 'decline'): Promise<void> => {
    setBusyId(request.requestId);
    try { await onReviewRequest(request, action); } finally { setBusyId(null); }
  };
  const runReport = async (report: CommunityReportItem, action: CommunityReportAction): Promise<void> => {
    setBusyId(report.id);
    try { await onModerateReport(report, action); } finally { setBusyId(null); }
  };
  const SearchField = () => <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, borderRadius: 13, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border }}><Search size={16} color={colors.icon} /><TextInput value={search} onChangeText={setSearch} placeholder="Search this workspace" placeholderTextColor={colors.mutedText} style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 10, color: colors.text }} /></View>;

  const renderOverview = () => {
    const data = dashboard.data;
    const metrics = [
      { label: 'Members', value: data?.memberCount ?? community.memberCount, icon: Users },
      { label: 'Posts', value: data?.postCount ?? community.postCount, icon: BarChart3 },
      { label: 'Events', value: data?.eventCount ?? 0, icon: Activity },
      { label: 'Polls', value: data?.pollCount ?? 0, icon: BarChart3 },
      { label: 'Requests', value: data?.pendingRequestCount ?? 0, icon: Shield },
      { label: 'Open reports', value: data?.openReportCount ?? 0, icon: Flag },
    ];
    return <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>{metrics.map((metric) => <View key={metric.label} style={{ width: '50%', padding: 5 }}><View style={{ padding: 16, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><metric.icon size={20} color={colors.accent} /><Text style={{ marginTop: 10, color: colors.text, fontSize: 23, fontWeight: '900' }}>{metric.value.toLocaleString()}</Text><Text style={{ color: colors.mutedText, fontSize: 12 }}>{metric.label}</Text></View></View>)}</View>;
  };

  const renderWorkspaceError = (message: string, onRetry: () => void) => (
    <View style={{ alignItems: 'center', marginTop: 24, padding: 20, borderRadius: 16, backgroundColor: colors.destructiveSurface, borderWidth: 1, borderColor: colors.destructive }}>
      <Text style={{ color: colors.destructiveText, textAlign: 'center', lineHeight: 20 }}>{message}</Text>
      <TouchableOpacity onPress={onRetry} style={{ marginTop: 12, minHeight: 40, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '900' }}>Retry</Text></TouchableOpacity>
    </View>
  );

  const dashboardTab = tab === 'overview' || tab === 'activity' || tab === 'reports';
  const dashboardFailed = dashboardTab && dashboard.status === 'error' && !dashboard.data;
  const currentRefreshing = tab === 'members'
    ? members.status === 'refreshing'
    : tab === 'requests'
      ? requests.status === 'refreshing'
      : dashboard.status === 'refreshing';
  const refreshCurrentTab = (): void => {
    if (tab === 'members') onLoadMembers(true);
    else if (tab === 'requests') onLoadRequests(true);
    else onLoadDashboard(true);
  };

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}><SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}><View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Community dashboard</Text><Text style={{ marginTop: 2, color: colors.mutedText, fontSize: 12 }}>{community.title} · {community.viewerRole}</Text></View><TouchableOpacity onPress={onClose} accessibilityLabel="Close community dashboard" accessibilityRole="button" hitSlop={12} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}><X size={23} color={colors.icon} /></TouchableOpacity></View><ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 9 }} style={{ flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>{TABS.map((option) => <TouchableOpacity key={option.value} onPress={() => { setTab(option.value); setSearch(''); }} accessibilityRole="tab" accessibilityState={{ selected: tab === option.value }} style={{ marginRight: 6, minHeight: 42, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 11, backgroundColor: tab === option.value ? colors.selectedControl : colors.control }}><Text style={{ color: tab === option.value ? colors.selectedText : colors.mutedText, fontWeight: '800', fontSize: 11 }}>{option.label}</Text></TouchableOpacity>)}</ScrollView><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 45 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}><Text style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: '900' }}>{TABS.find((option) => option.value === tab)?.label}</Text><TouchableOpacity onPress={refreshCurrentTab} disabled={currentRefreshing} accessibilityRole="button" accessibilityLabel={`Refresh ${tab}`} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>{currentRefreshing ? <ActivityIndicator size="small" color={colors.accent} /> : <RefreshCw size={16} color={colors.icon} />}<Text style={{ marginLeft: 6, color: colors.secondaryText, fontWeight: '800' }}>Refresh</Text></TouchableOpacity></View>
    {dashboard.status === 'hydrating' && !dashboard.data && dashboardTab ? <ActivityIndicator color={colors.accent} style={{ marginTop: 35 }} /> : null}
    {dashboardFailed ? renderWorkspaceError(dashboard.error?.message ?? 'Dashboard data could not be loaded.', onLoadDashboard) : null}
    {tab === 'overview' && !dashboardFailed ? renderOverview() : null}
    {tab === 'members' ? <><SearchField />{!members.data ? members.status === 'error' ? renderWorkspaceError(members.error?.message ?? 'Members could not be loaded.', onLoadMembers) : <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} /> : visibleMembers.map((member) => <TouchableOpacity key={member.membershipId || member.userId} onPress={() => onManageMember(member)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9, padding: 11, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>{member.profilePicture ? <CachedImage uri={member.profilePicture} recyclingKey={`dashboard-member-${member.userId}-${member.profilePicture}`} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" /> : <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface }}><Text style={{ color: colors.accentText, fontWeight: '900' }}>{(member.firstName || member.userName).charAt(0).toUpperCase()}</Text></View>}<View style={{ flex: 1, marginLeft: 9 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{`${member.firstName} ${member.lastName}`.trim() || member.userName}</Text><Text style={{ color: colors.mutedText, fontSize: 11, textTransform: 'capitalize' }}>{member.role}</Text></View><Shield size={17} color={colors.icon} /></TouchableOpacity>)}</> : null}
    {tab === 'requests' ? <>{!requests.data ? requests.status === 'error' ? renderWorkspaceError(requests.error?.message ?? 'Join requests could not be loaded.', onLoadRequests) : <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} /> : requests.data.items.length ? requests.data.items.map((request) => <View key={request.requestId} style={{ marginBottom: 9, padding: 13, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontWeight: '900' }}>{`${request.firstName} ${request.lastName}`.trim() || request.userName}</Text><Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}>@{request.userName}</Text><View style={{ flexDirection: 'row', gap: 8, marginTop: 11 }}><TouchableOpacity disabled={busyId === request.requestId} onPress={() => void runRequest(request, 'decline')} style={{ flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: colors.destructive }}><Text style={{ color: colors.destructiveText, fontWeight: '900' }}>Decline</Text></TouchableOpacity><TouchableOpacity disabled={busyId === request.requestId} onPress={() => void runRequest(request, 'approve')} style={{ flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.accent }}>{busyId === request.requestId ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Approve</Text>}</TouchableOpacity></View></View>) : <Text style={{ marginTop: 30, color: colors.mutedText, textAlign: 'center' }}>No pending requests.</Text>}</> : null}
    {tab === 'activity' && !dashboardFailed ? <><SearchField />{activities.length ? activities.map((item) => <View key={`${item.type}-${item.id}`} style={{ marginTop: 9, padding: 13, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontWeight: '900' }}>{item.title}</Text><Text style={{ marginTop: 4, color: colors.mutedText, fontSize: 11, textTransform: 'capitalize' }}>{item.type} · {item.creatorName} · {new Date(item.createdAt).toLocaleString()}</Text></View>) : <Text style={{ marginTop: 30, color: colors.mutedText, textAlign: 'center' }}>No activity matches this view.</Text>}</> : null}
    {tab === 'reports' && !dashboardFailed ? <><SearchField /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>{(['all', 'pending', 'in_review', 'resolved', 'dismissed'] as const).map((status) => <TouchableOpacity key={status} onPress={() => setStatusFilter(status)} style={{ marginRight: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: statusFilter === status ? colors.selectedControl : colors.control }}><Text style={{ color: statusFilter === status ? colors.selectedText : colors.secondaryText, fontSize: 10, fontWeight: '900', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</Text></TouchableOpacity>)}</ScrollView>{reports.length ? reports.map((report) => <View key={report.id} style={{ marginBottom: 10, padding: 14, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontWeight: '900' }}>{report.title}</Text><Text style={{ marginTop: 4, color: colors.secondaryText }}>{report.reason}</Text>{report.details ? <Text style={{ marginTop: 4, color: colors.mutedText, fontSize: 12 }}>{report.details}</Text> : null}<Text style={{ marginTop: 6, color: colors.mutedText, fontSize: 10 }}>Reported by {report.reporterName} · {report.status.replace('_', ' ')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>{report.status === 'pending' ? <TouchableOpacity disabled={busyId === report.id} onPress={() => void runReport(report, 'assign')} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.control }}><Text style={{ color: colors.secondaryText, fontWeight: '800', fontSize: 11 }}>Assign to me</Text></TouchableOpacity> : null}<TouchableOpacity disabled={busyId === report.id} onPress={() => void runReport(report, 'dismiss')} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.control }}><Text style={{ color: colors.secondaryText, fontWeight: '800', fontSize: 11 }}>Dismiss</Text></TouchableOpacity><TouchableOpacity disabled={busyId === report.id} onPress={() => void runReport(report, 'resolve')} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.successSurface }}><CheckCircle2 size={13} color={colors.successText} /><Text style={{ marginLeft: 4, color: colors.successText, fontWeight: '800', fontSize: 11 }}>Resolve</Text></TouchableOpacity><TouchableOpacity disabled={busyId === report.id} onPress={() => void runReport(report, 'hide')} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.destructiveSurface }}><EyeOff size={13} color={colors.destructive} /><Text style={{ marginLeft: 4, color: colors.destructiveText, fontWeight: '800', fontSize: 11 }}>Hide content</Text></TouchableOpacity></View></View>) : <Text style={{ marginTop: 25, color: colors.mutedText, textAlign: 'center' }}>No reports match this view.</Text>}</> : null}
  </ScrollView></SafeAreaView></Modal>;
}
