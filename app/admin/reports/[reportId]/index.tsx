import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import CustomModal from '@/components/ui/CustomModal';
import { AdminModerationService, type AdminModerationAction, type AdminModerationReport } from '@/lib/services/AdminModerationService';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';

const moderationService = AdminModerationService.getInstance();
const ACTIONS: readonly { id: AdminModerationAction; label: string; group: 'resolution' | 'content' | 'account' | 'escalation' }[] = [
  { id: 'dismiss', label: 'Dismiss report', group: 'resolution' }, { id: 'resolved_no_violation', label: 'Resolve — no violation', group: 'resolution' },
  { id: 'content_removed', label: 'Remove content', group: 'content' }, { id: 'content_hidden', label: 'Hide content temporarily', group: 'content' }, { id: 'content_restored', label: 'Restore content', group: 'content' }, { id: 'content_restricted', label: 'Restrict visibility', group: 'content' }, { id: 'commenting_disabled', label: 'Disable commenting', group: 'content' }, { id: 'advertisement_removed', label: 'Delete advertisement', group: 'content' },
  { id: 'warning_issued', label: 'Issue warning', group: 'account' }, { id: 'posting_disabled', label: 'Disable posting', group: 'account' }, { id: 'messaging_disabled', label: 'Disable messaging', group: 'account' }, { id: 'account_suspended', label: 'Suspend account', group: 'account' }, { id: 'account_temp_banned', label: 'Temporarily ban account', group: 'account' }, { id: 'account_perma_banned', label: 'Permanently ban account', group: 'account' }, { id: 'account_restricted', label: 'Restrict account features', group: 'account' }, { id: 'profile_picture_removed', label: 'Remove profile picture', group: 'account' }, { id: 'username_removed', label: 'Remove username', group: 'account' }, { id: 'bio_removed', label: 'Remove bio', group: 'account' },
  { id: 'escalated_senior_review', label: 'Escalate to senior review', group: 'escalation' }, { id: 'requested_info', label: 'Request more information', group: 'escalation' }, { id: 'referred_legal', label: 'Refer to legal / safety', group: 'escalation' },
];

export default function AdminReportDetailRoute() {
  const router = useRouter();
  const { reportId } = useLocalSearchParams<{ reportId?: string }>();
  const { authorization, loading: accessLoading } = usePageAccess();
  const [report, setReport] = useState<AdminModerationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<AdminModerationAction | null>(null);
  const [reason, setReason] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!reportId) { setError('Report ID is missing.'); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setReport(await moderationService.fetchReport(reportId)); }
    catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : 'Report could not be loaded.'); }
    finally { setLoading(false); }
  }, [reportId]);
  useEffect(() => { if (!accessLoading && authorization.isAdmin) void load(); }, [accessLoading, authorization.isAdmin, load]);
  const handleAction = async () => {
    if (!report || !selectedAction || !reason.trim() || busy) return;
    const days = Number(durationDays);
    const durationMs = Number.isFinite(days) && days > 0 ? days * 86_400_000 : undefined;
    setBusy(true);
    try { await moderationService.takeAction(report.id, selectedAction, reason, durationMs); setMessage('Moderation action applied through the secure server workflow.'); setSelectedAction(null); await load(); }
    catch (actionError: unknown) { setMessage(actionError instanceof Error ? actionError.message : 'Moderation action failed.'); }
    finally { setBusy(false); }
  };
  const handleDelete = async () => { if (!report || busy) return; setBusy(true); try { await moderationService.deleteReport(report.id); router.back(); } catch (deleteError: unknown) { setMessage(deleteError instanceof Error ? deleteError.message : 'Report could not be deleted.'); } finally { setBusy(false); } };

  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f8fafc' }}><View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}><TouchableOpacity onPress={() => router.back()}><Icon name="arrow-left" size={23} color="#0f172a" /></TouchableOpacity><Text style={{ flex: 1, marginLeft: 12, fontSize: 19, fontWeight: '900' }}>Report Review</Text><TouchableOpacity disabled={!report || busy} onPress={() => void handleDelete()}><Icon name="trash-2" size={20} color="#c64d53" /></TouchableOpacity></View>{accessLoading || loading ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color="#10b981" /></View> : !authorization.isAdmin ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={38} color="#c64d53" /><Text style={{ marginTop: 12, fontWeight: '900' }}>Admin access required</Text></View> : error ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text style={{ color: '#991b1b', textAlign: 'center' }}>{error}</Text><TouchableOpacity onPress={() => void load()} style={{ marginTop: 14, borderRadius: 999, backgroundColor: '#10b981', paddingHorizontal: 18, paddingVertical: 10 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text></TouchableOpacity></View> : report ? <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }}><View style={{ padding: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }}><View style={{ flexDirection: 'row' }}><Text style={{ flex: 1, fontSize: 18, fontWeight: '900', color: '#0f172a' }}>{report.reason}</Text><Text style={{ color: report.severity === 'critical' || report.severity === 'high' ? '#b91c1c' : '#92400e', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{report.severity}</Text></View><Text style={{ marginTop: 8, color: '#475569', lineHeight: 20 }}>{report.description || 'No reporter description.'}</Text>{[['Status', report.status], ['Content type', report.contentType], ['Target ID', report.targetId], ['Reporter', report.reporterName], ['Reporter ID', report.reporterId], ['Reported user', report.reportedUserId || 'Not supplied']].map(([label, value]) => <View key={label} style={{ marginTop: 12 }}><Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{label}</Text><Text selectable style={{ marginTop: 2, color: '#334155' }}>{value}</Text></View>)}</View><Text style={{ marginTop: 18, marginBottom: 10, fontSize: 16, fontWeight: '900', color: '#0f172a' }}>Available actions</Text>{(['resolution', 'content', 'account', 'escalation'] as const).map((group) => <View key={group} style={{ marginBottom: 13 }}><Text style={{ marginBottom: 7, color: '#64748b', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>{group}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{ACTIONS.filter((action) => action.group === group).map((action) => <TouchableOpacity key={action.id} onPress={() => { setSelectedAction(action.id); setReason(report.moderatorNotes); }} style={{ marginRight: 7, marginBottom: 7, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: group === 'account' ? '#fff1f2' : group === 'content' ? '#fffbeb' : group === 'escalation' ? '#eff6ff' : '#ecfdf5' }}><Text style={{ color: group === 'account' ? '#be123c' : group === 'content' ? '#92400e' : group === 'escalation' ? '#1d4ed8' : '#047857', fontSize: 11, fontWeight: '800' }}>{action.label}</Text></TouchableOpacity>)}</View></View>)}</ScrollView> : null}
    <Modal visible={Boolean(selectedAction)} transparent animationType="fade" onRequestClose={() => setSelectedAction(null)}><SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15,23,42,0.55)' }}><View style={{ borderRadius: 22, backgroundColor: '#fff', padding: 18 }}><View style={{ flexDirection: 'row' }}><Text style={{ flex: 1, fontSize: 18, fontWeight: '900' }}>{ACTIONS.find((action) => action.id === selectedAction)?.label}</Text><TouchableOpacity onPress={() => setSelectedAction(null)}><Icon name="x" size={22} color="#475569" /></TouchableOpacity></View><TextInput value={reason} onChangeText={setReason} multiline placeholder="Required moderation reason" style={{ minHeight: 90, marginTop: 14, textAlignVertical: 'top', borderRadius: 13, borderWidth: 1, borderColor: '#e2e8f0', padding: 11 }} />{selectedAction && ['content_hidden', 'commenting_disabled', 'messaging_disabled', 'posting_disabled', 'account_suspended', 'account_temp_banned'].includes(selectedAction) ? <TextInput value={durationDays} onChangeText={setDurationDays} keyboardType="number-pad" placeholder="Duration in days" style={{ marginTop: 9, borderRadius: 13, borderWidth: 1, borderColor: '#e2e8f0', padding: 11 }} /> : null}<TouchableOpacity disabled={busy || !reason.trim()} onPress={() => void handleAction()} style={{ marginTop: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#10b981', padding: 13 }}><Text style={{ color: '#fff', fontWeight: '900' }}>{busy ? 'Applying…' : 'Apply action'}</Text></TouchableOpacity></View></SafeAreaView></Modal><CustomModal visible={Boolean(message)} title="Report moderation" message={message ?? ''} type="info" onClose={() => setMessage(null)} /></SafeAreaView>;
}
