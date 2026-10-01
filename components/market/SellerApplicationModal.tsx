import { useEffect, useRef, useState } from 'react';
import { Linking, Text, View, AppState } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import MarketFormModal, { MarketButton, MarketField, MarketListField } from './MarketFormModal';
import { sellerVerificationService } from '@/lib/services/SellerVerificationService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import type { SellerApplication, SellerFileKind } from '@/lib/types/reliability';

type SellerApplicationModalProps = { onClose: () => void };
export default function SellerApplicationModal({ onClose }: SellerApplicationModalProps) {
  const { colors } = useAppTheme();
  const { profile } = usePageAccess();
  const ownerId = profile?.uid ?? '';
  const [form, setForm] = useState<SellerApplication | null>(null);
  const current = useRef<SellerApplication | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Loading application');
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState<{ kind: SellerFileKind; name: string }[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const save = (application: SellerApplication) => {
    current.current = application; setForm(application); setStatus('Saving');
    const operation = queue.current.then(() => sellerVerificationService.save(application));
    queue.current = operation.catch(() => {});
    void operation.then(() => setStatus('Saved on device')).catch(() => { setStatus('Save failed'); setError('Application could not be saved. Keep this screen open and retry.'); });
    return operation;
  };
  useEffect(() => {
    let active = true;
    void sellerVerificationService.load(ownerId).then(async (local) => {
      if (!active) return;
      setPending(await sellerVerificationService.pendingUploads(ownerId));
      current.current = local; setForm(local); setStatus('Saved on device');
      const remote = await sellerVerificationService.remote(ownerId);
      if (active && remote && current.current === local && sellerVerificationService.shouldAdoptRemote(local, remote)) {
        await sellerVerificationService.save(remote);
        if (active && current.current === local) { current.current = remote; setForm(remote); }
      }
    }).catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Application could not be restored.'); });
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active' && current.current) void sellerVerificationService.save(current.current).catch(() => setError('Application save failed. Retry.')); });
    return () => { active = false; subscription.remove(); };
  }, [ownerId]);
  const action = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Action failed. Retry.'); }
    finally { setBusy(false); void sellerVerificationService.pendingUploads(ownerId).then(setPending).catch(() => {}); }
  };
  const pick = async (kind: SellerFileKind) => {
    if (!form) return;
    const result = await DocumentPicker.getDocumentAsync({ type: kind === 'logo' ? ['image/jpeg', 'image/png'] : ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const file = await sellerVerificationService.upload(ownerId, kind, result.assets[0], (percent) => setStatus(`Uploading ${percent}%`));
    const latest = current.current;
    if (!latest) return;
    await save({ ...latest, files: [...latest.files.filter((entry) => entry.kind !== kind), file] });
    await sellerVerificationService.discardUpload(ownerId, kind);
  };
  const editable = form?.status === 'draft';
  return <MarketFormModal visible busy={busy} title="Seller application" onClose={() => void action(async () => { if (current.current) await save(current.current); onClose(); })}>
    <Text style={{ color: colors.secondaryText }}>{status}</Text>
    <Text style={{ color: colors.text }}>Seller verification is reviewed by an administrator. Approval does not enable payments or payouts.</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
    {form ? <>
      <Text style={{ color: colors.text }}>Application status: {form.status} · Revision {form.revision}</Text>
      {editable ? <>
        {(['name', 'email', 'phone', 'storeName', 'description'] as const).map((field) => <MarketField key={field} label={field} value={form[field]} multiline={field === 'description'} onChangeText={(value) => { void save({ ...form, [field]: value }).catch(() => {}); }} />)}
        <MarketListField label="Categories (comma separated)" values={form.categories} onChange={(categories) => { void save({ ...form, categories }).catch(() => {}); }} />
        <MarketButton label={form.isBusiness ? 'Registered business' : 'Individual seller'} onPress={() => { void save({ ...form, isBusiness: !form.isBusiness }).catch(() => {}); }} />
        {(['governmentId', 'proofOfAddress', ...(form.isBusiness ? ['businessRegistration' as const] : []), 'logo'] as SellerFileKind[]).map((kind) => <View key={kind} style={{ gap: 8 }}>
          <Text style={{ color: colors.text }}>{kind}: {form.files.find((file) => file.kind === kind)?.name ?? 'No file selected'}</Text>
          {pending.find((entry) => entry.kind === kind) ? <>
            <Text style={{ color: colors.secondaryText }}>Pending: {pending.find((entry) => entry.kind === kind)?.name}</Text>
            <MarketButton label="Retry saved upload" onPress={() => void action(async () => {
              const file = await sellerVerificationService.retryUpload(ownerId, kind, (percent) => setStatus(`Uploading ${percent}%`));
              const latest = current.current;
              if (!latest) return;
              await save({ ...latest, files: [...latest.files.filter((entry) => entry.kind !== kind), file] });
              await sellerVerificationService.discardUpload(ownerId, kind);
            })} />
            <MarketButton label="Remove pending upload" onPress={() => void action(() => sellerVerificationService.discardUpload(ownerId, kind))} />
          </> : null}
          <MarketButton label={`Choose / replace ${kind}`} disabled={busy} onPress={() => void action(() => pick(kind))} />
          {form.files.find((file) => file.kind === kind) ? <MarketButton label="Remove file" onPress={() => { void save({ ...form, files: form.files.filter((file) => file.kind !== kind) }).catch(() => {}); }} /> : null}
        </View>)}
        <MarketButton label="Read seller terms" onPress={() => setTerms(!terms)} />
        {terms ? <><Text style={{ color: colors.text }}>Provide accurate information and lawful listings. Your identity documents are private and are deleted 30 days after a final approval or rejection. Re-review requires fresh documents. Payments and payouts are not available in this release.</Text><MarketButton label="Open full terms" onPress={() => { void Linking.openURL('https://ourlime.com/terms-and-conditions').catch(() => setError('Open ourlime.com/terms-and-conditions in your browser. Your application is saved.')); }} /></> : null}
        <MarketButton label={form.acceptedTerms ? 'Terms accepted (tap to undo)' : 'Accept seller terms'} onPress={() => { void save({ ...form, acceptedTerms: !form.acceptedTerms }).catch(() => {}); }} />
        <MarketButton label="Submit for review" disabled={busy} onPress={() => void action(async () => { await queue.current; const submitted = await sellerVerificationService.submit(form); current.current = submitted; setForm(submitted); setStatus('Submitted'); })} />
      </> : <>
        <Text style={{ color: colors.text }}>Submitted revisions are locked. You will receive an in-app update when the review changes.</Text>
        <MarketButton label="Refresh review status" onPress={() => void action(async () => { const remote = await sellerVerificationService.remote(ownerId); if (remote) { current.current = remote; setForm(remote); } })} />
        {['changes_requested', 'rejected'].includes(form.status) ? <MarketButton label="Start revised application with fresh documents" onPress={() => void action(async () => { const next = await sellerVerificationService.startRevision(ownerId, form); current.current = next; setForm(next); })} /> : null}
      </>}
    </> : null}
  </MarketFormModal>;
}
