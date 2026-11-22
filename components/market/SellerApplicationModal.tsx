import { useEffect, useRef, useState } from 'react';
import { Linking, Text, TouchableOpacity, View, AppState, type KeyboardTypeOptions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import MarketFormModal, { MarketButton, MarketField, MarketListField } from './MarketFormModal';
import { sellerVerificationService, type SellerApplicationErrors } from '@/lib/services/SellerVerificationService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import type { SellerApplication, SellerFileKind } from '@/lib/types/reliability';

type SellerTextField = 'name' | 'email' | 'phone' | 'storeName' | 'description';
const SELLER_TEXT_FIELDS: SellerTextField[] = ['name', 'email', 'phone', 'storeName', 'description'];
const SELLER_FIELD_LABELS: Record<SellerTextField, string> = {
  name: 'Full name',
  email: 'Email',
  phone: 'Phone',
  storeName: 'Store name',
  description: 'Store description',
};
const SELLER_FIELD_INPUT: Record<SellerTextField, { keyboardType?: KeyboardTypeOptions; placeholder?: string }> = {
  name: { placeholder: 'As it appears on your ID' },
  email: { keyboardType: 'email-address', placeholder: 'name@example.com' },
  phone: { keyboardType: 'phone-pad', placeholder: '868-710-4296' },
  storeName: {},
  description: { placeholder: 'What do you sell?' },
};
const SELLER_TYPES = [
  { isBusiness: false, title: 'Individual seller', body: 'You sell as yourself. Needs your government ID and proof of address.' },
  { isBusiness: true, title: 'Registered business', body: 'You sell as a registered company. Also needs your business registration certificate.' },
];
/** Why documents went missing from a saved draft, naming each one to choose again. */
function expiredFilesMessage(kinds: SellerFileKind[]): string {
  // Lower-case the label but keep "ID" in capitals ("government ID", "proof of address").
  const names = kinds.map((kind) => SELLER_FILE_LABELS[kind].toLowerCase().replace(/\bid\b/, 'ID'));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `Your ${list} ${kinds.length > 1 ? 'uploads have' : 'upload has'} expired. Documents are deleted 24 hours after upload unless the application is submitted, to keep them private. Choose ${kinds.length > 1 ? 'them' : 'it'} again, then submit.`;
}

const SELLER_FILE_LABELS: Record<SellerFileKind, string> = {
  governmentId: 'Government ID',
  proofOfAddress: 'Proof of address',
  businessRegistration: 'Business registration',
  logo: 'Logo',
};
const formatApplicationStatus = (status: string): string => {
  const label = status.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

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
  // Field errors appear once Submit was tried, and each clears as soon as its field is fixed.
  const [isCheckShown, setIsCheckShown] = useState(false);
  const fieldErrors: SellerApplicationErrors = isCheckShown && form ? sellerVerificationService.validate(form) : {};
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
      const checked = await sellerVerificationService.withoutExpiredFiles(local);
      if (active && checked.expired.length && current.current === local) {
        await sellerVerificationService.save(checked.application);
        current.current = checked.application; setForm(checked.application);
        setIsCheckShown(true);
        setError(expiredFilesMessage(checked.expired));
      }
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
      <Text style={{ color: colors.text }}>Application status: {formatApplicationStatus(form.status)} · Revision {form.revision}</Text>
      {editable ? <>
        {SELLER_TEXT_FIELDS.map((field) => <MarketField key={field} label={SELLER_FIELD_LABELS[field]} value={form[field]} multiline={field === 'description'} error={fieldErrors[field]}
          keyboardType={SELLER_FIELD_INPUT[field].keyboardType} placeholder={SELLER_FIELD_INPUT[field].placeholder} onChangeText={(value) => { void save({ ...form, [field]: value }).catch(() => {}); }} />)}
        <MarketListField label="Categories (comma separated)" placeholder="Books, Stationery" error={fieldErrors.categories} values={form.categories} onChange={(categories) => { void save({ ...form, categories }).catch(() => {}); }} />
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>How do you sell?</Text>
          {SELLER_TYPES.map((type) => {
            const isSelected = form.isBusiness === type.isBusiness;
            return <TouchableOpacity key={type.title} accessibilityRole="radio" accessibilityState={{ selected: isSelected }} disabled={busy}
              onPress={() => { if (!isSelected) void save({ ...form, isBusiness: type.isBusiness }).catch(() => {}); }}
              style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: isSelected ? colors.accent : colors.border, backgroundColor: colors.surface }}>
              <View style={{ width: 20, height: 20, marginTop: 2, borderRadius: 10, borderWidth: 2, borderColor: isSelected ? colors.accent : colors.mutedText, alignItems: 'center', justifyContent: 'center' }}>
                {isSelected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{type.title}</Text>
                <Text style={{ color: colors.secondaryText }}>{type.body}</Text>
              </View>
            </TouchableOpacity>;
          })}
        </View>
        {(['governmentId', 'proofOfAddress', ...(form.isBusiness ? ['businessRegistration' as const] : []), 'logo'] as SellerFileKind[]).map((kind) => <View key={kind} style={{ gap: 8 }}>
          <Text style={{ color: colors.text }}>{SELLER_FILE_LABELS[kind]}: {form.files.find((file) => file.kind === kind)?.name ?? 'No file selected'}</Text>
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
          <MarketButton label={`Choose / replace ${SELLER_FILE_LABELS[kind]}`} disabled={busy} onPress={() => void action(() => pick(kind))} />
          {fieldErrors[kind] ? <Text style={{ color: colors.destructive }}>{fieldErrors[kind]}</Text> : null}
          {form.files.find((file) => file.kind === kind) ? <MarketButton label="Remove file" onPress={() => { void save({ ...form, files: form.files.filter((file) => file.kind !== kind) }).catch(() => {}); }} /> : null}
        </View>)}
        <MarketButton label="Read seller terms" onPress={() => setTerms(!terms)} />
        {terms ? <><Text style={{ color: colors.text }}>Provide accurate information and lawful listings. Your identity documents are private and are deleted 30 days after a final approval or rejection. Re-review requires fresh documents. Payments and payouts are not available in this release.</Text><MarketButton label="Open full terms" onPress={() => { void Linking.openURL('https://ourlime.com/terms-and-conditions').catch(() => setError('Open ourlime.com/terms-and-conditions in your browser. Your application is saved.')); }} /></> : null}
        <MarketButton label={form.acceptedTerms ? 'Terms accepted (tap to undo)' : 'Accept seller terms'} onPress={() => { void save({ ...form, acceptedTerms: !form.acceptedTerms }).catch(() => {}); }} />
        {fieldErrors.acceptedTerms ? <Text style={{ color: colors.destructive }}>{fieldErrors.acceptedTerms}</Text> : null}
        {/* Shown beside Submit as well as at the top, so the reason is on screen where the button was tapped. */}
        {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
        <MarketButton label="Submit for review" disabled={busy} onPress={() => void action(async () => {
          const problems = Object.values(sellerVerificationService.validate(form));
          if (problems.length) { setIsCheckShown(true); throw new Error(problems.length === 1 ? problems[0] : `${problems.length} things to fix before submitting. Each is marked in red above.`); }
          await queue.current;
          const checked = await sellerVerificationService.withoutExpiredFiles(current.current ?? form);
          if (checked.expired.length) { await save(checked.application); setIsCheckShown(true); throw new Error(expiredFilesMessage(checked.expired)); }
          const submitted = await sellerVerificationService.submit(checked.application); current.current = submitted; setForm(submitted); setStatus('Submitted'); })} />
      </> : <>
        <Text style={{ color: colors.text }}>Submitted revisions are locked. You will receive an in-app update when the review changes.</Text>
        <MarketButton label="Refresh review status" onPress={() => void action(async () => { const remote = await sellerVerificationService.remote(ownerId); if (remote) { current.current = remote; setForm(remote); } })} />
        {['changes_requested', 'rejected'].includes(form.status) ? <MarketButton label="Start revised application with fresh documents" onPress={() => void action(async () => { const next = await sellerVerificationService.startRevision(ownerId, form); current.current = next; setForm(next); })} /> : null}
      </>}
    </> : null}
  </MarketFormModal>;
}
