import { useState } from 'react';
import { Text } from 'react-native';
import MarketFormModal, { MarketButton, MarketField } from './MarketFormModal';
import { nativeEngagementService } from '@/lib/services/NativeEngagementService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
type DiscussionReportModalProps = { ownerId: string; kind: 'blog' | 'product'; targetId: string; commentId: string; parentId?: string; onClose: () => void };
export default function DiscussionReportModal({ ownerId, kind, targetId, commentId, parentId, onClose }: DiscussionReportModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { colors } = useAppTheme();
  const handleSubmit = async () => {
    if (busy || !reason.trim()) return;
    setBusy(true);
    try { await nativeEngagementService.mutate(ownerId, { kind, targetId, commentId, parentId, action: 'report', text: reason }); onClose(); }
    catch { setError('Report was not confirmed. Your explanation is retained; retry safely.'); }
    finally { setBusy(false); }
  };
  return <MarketFormModal visible title="Report discussion" onClose={onClose}>
    <Text style={{ color: colors.text }}>This report will be sent to the existing moderation queue.</Text>
    <MarketField label="Reason for reporting" multiline value={reason} onChangeText={setReason} />
    {error ? <Text style={{ color: colors.destructive }}>{error}</Text> : null}
    <MarketButton label="Submit report" disabled={busy || !reason.trim()} onPress={() => void handleSubmit()} />
  </MarketFormModal>;
}
