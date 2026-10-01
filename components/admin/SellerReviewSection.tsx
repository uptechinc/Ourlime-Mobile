import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { sellerVerificationService } from '@/lib/services/SellerVerificationService';
import type { SellerApplication, SellerReviewDecision } from '@/lib/types/reliability';
import { MarketButton, MarketField } from '@/components/market/MarketFormModal';

export default function SellerReviewSection() {
  const { authorization, profile } = usePageAccess();
  const { colors } = useAppTheme();
  const [queue, setQueue] = useState<SellerApplication[]>([]);
  const [selected, setSelected] = useState<SellerApplication | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ownerId = profile?.uid ?? '';
  const [filter, setFilter] = useState<SellerApplication['status']>('submitted');
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<SellerReviewDecision[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async (nextCursor: string | null = null) => {
    if (!authorization.isAdmin || !ownerId) return;
    const current = ++generation.current;
    try { const result = await sellerVerificationService.queue(ownerId, filter, nextCursor); if (current !== generation.current) return; setQueue((previous) => nextCursor ? [...previous, ...result.applications] : result.applications); setCursor(result.cursor); setError(''); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Review queue unavailable.'); }
  }, [authorization.isAdmin, ownerId, filter]);
  useEffect(() => { const requests = generation; setSelected(null); setQueue([]); void refresh(); return () => { ++requests.current; }; }, [refresh]);
  useEffect(() => {
    let active = true;
    setHistory([]); setHistoryCursor(null);
    if (selected) void sellerVerificationService.history(ownerId, selected.ownerId).then((result) => { if (active) { setHistory(result.decisions); setHistoryCursor(result.cursor); } }).catch(() => { if (active) setError('Review history could not be loaded. Reopen the application to retry.'); });
    return () => { active = false; };
  }, [ownerId, selected]);
  if (!authorization.isAdmin) return <Text style={{ color: colors.text }}>Administrator review access is required.</Text>;
  const decide = async (status: SellerReviewDecision['status']) => {
    if (!selected || busy) return;
    setBusy(true);
    try { await sellerVerificationService.review(ownerId, selected, status, reason); setSelected(null); setReason(''); await refresh(); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Decision failed. Refresh the revision before retrying.'); }
    finally { setBusy(false); }
  };
  return <View style={{ padding: 16, gap: 14 }}>
    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Seller review</Text>
    {!selected ? (['submitted', 'approved', 'changes_requested', 'rejected', 'suspended'] as const).map((status) => <MarketButton key={status} label={`${filter === status ? 'Selected: ' : ''}${status.replaceAll('_', ' ')}`} onPress={() => setFilter(status)} />) : null}
    <MarketButton label="Refresh queue" onPress={() => void refresh()} />
    {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
    {selected ? <>
      <Text style={{ color: colors.text }}>{selected.storeName} · Revision {selected.revision}{'\n'}{selected.name} · {selected.email} · {selected.phone}{'\n'}{selected.description}</Text>
      {selected.files.map((file) => <MarketButton key={file.id} label={`View privately: ${file.kind} · ${file.name}`} onPress={() => {
        void sellerVerificationService.view(ownerId, file.id).then((url) => Linking.openURL(url)).catch(() => setError('Private document could not be opened. Access may have expired.'));
      }} />)}
      <MarketField label="Decision reason (required)" multiline value={reason} onChangeText={setReason} />
      {(selected.status === 'approved' ? ['suspended' as const] : selected.status === 'submitted' ? ['approved', 'changes_requested', 'rejected'] as const : []).map((status) => <MarketButton key={status} label={status.replaceAll('_', ' ')} disabled={busy || !reason.trim() || selected.ownerId === ownerId} onPress={() => void decide(status)} />)}
      <Text style={{ color: colors.text, fontWeight: '700' }}>Decision history</Text>
      {history.map((decision) => <Text key={decision.id} style={{ color: colors.text }}>Revision {decision.applicationRevision} · {decision.status.replaceAll('_', ' ')} · {decision.decidedAt}{'\n'}{decision.reason}</Text>)}
      {historyCursor ? <MarketButton label="Older decisions" onPress={() => { void sellerVerificationService.history(ownerId, selected.ownerId, historyCursor).then((result) => { setHistory((previous) => [...previous, ...result.decisions]); setHistoryCursor(result.cursor); }).catch(() => setError('History could not be loaded. Retry.')); }} /> : null}
      <MarketButton label="Back to queue" onPress={() => setSelected(null)} />
    </> : queue.map((application) => <MarketButton key={application.ownerId} label={`${application.storeName} · Revision ${application.revision}`} onPress={() => { setSelected(application); setReason(''); }} />)}
    {cursor && !selected ? <MarketButton label="Load more applications" onPress={() => void refresh(cursor)} /> : null}
    {!queue.length && !selected ? <Text style={{ color: colors.text }}>No submitted applications in this page.</Text> : null}
  </View>;
}
