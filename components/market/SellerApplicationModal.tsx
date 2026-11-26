import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Linking, RefreshControl, Text, TouchableOpacity, View, AppState, type KeyboardTypeOptions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, type Href } from 'expo-router';
import { withCleanup } from '@/lib/utils/withCleanup';
import MarketFormModal, { MarketButton, MarketField, MarketListField } from './MarketFormModal';
import { SellerDocumentRow, SellerTermsRow, type SellerUploadState } from './SellerApplicationParts';
import { SellerDraftHeader, SellerInfoNote, SellerRefreshPanel, SellerReviewTimeline, SellerStatusHero, SellerSubmittedSummary, describeSellerStatus, type SellerRefreshState, type SellerSaveState } from './SellerApplicationStatus';
import { sellerVerificationService, type SellerApplicationErrors } from '@/lib/services/SellerVerificationService';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import type { SellerApplication, SellerApplicationReview, SellerFile, SellerFileKind } from '@/lib/types/reliability';

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
/** What each document is, shown until a file is added. */
const SELLER_FILE_HINTS: Record<SellerFileKind, string> = {
  governmentId: 'Passport, national ID or driver\'s permit',
  proofOfAddress: 'Utility bill or bank statement, last 3 months',
  businessRegistration: 'Certificate of incorporation or registration',
  logo: 'Square image shown on your store',
};
/** How long a finished upload keeps its "Uploaded and saved" line before the row settles. */
const UPLOAD_DONE_MS = 2500;
const PAYMENTS_NOTE = 'An administrator reviews every application. Approval does not turn on payments or payouts.';

type SellerApplicationModalProps = { onClose: () => void };
export default function SellerApplicationModal({ onClose }: SellerApplicationModalProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { profile } = usePageAccess();
  const ownerId = profile?.uid ?? '';
  const [form, setForm] = useState<SellerApplication | null>(null);
  const current = useRef<SellerApplication | null>(null);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<SellerSaveState>('saved');
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState<{ kind: SellerFileKind; name: string }[]>([]);
  // Each document row tracks its own upload, so one slow file does not lock the rest of the form.
  const [uploads, setUploads] = useState<Partial<Record<SellerFileKind, SellerUploadState>>>({});
  const [review, setReview] = useState<SellerApplicationReview | null>(null);
  const [refresh, setRefresh] = useState<SellerRefreshState>({ phase: 'idle', checkedAtMs: null });
  const [isPulling, setIsPulling] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Field errors appear once Submit was tried, and each clears as soon as its field is fixed.
  const [isCheckShown, setIsCheckShown] = useState(false);
  const fieldErrors: SellerApplicationErrors = isCheckShown && form ? sellerVerificationService.validate(form) : {};
  const queue = useRef<Promise<void>>(Promise.resolve());
  const isMounted = useRef(true);
  // "Uploaded" confirmations that clear themselves; cancelled if the screen closes first.
  const doneTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  // The system file picker is open: a second tap on Add must not open another one.
  const isPicking = useRef(false);
  // Close was tried while a file was uploading: show why it stayed open.
  const [isCloseBlocked, setIsCloseBlocked] = useState(false);
  useEffect(() => {
    const timers = doneTimers.current;
    return () => { isMounted.current = false; timers.forEach(clearTimeout); timers.clear(); };
  }, []);
  const save = (application: SellerApplication) => {
    current.current = application; setForm(application); setSaveState('saving');
    const operation = queue.current.then(() => sellerVerificationService.save(application));
    queue.current = operation.catch(() => {});
    void operation.then(() => setSaveState('saved')).catch(() => { setSaveState('failed'); setError('Application could not be saved. Keep this screen open and retry.'); });
    return operation;
  };
  const refreshPending = useCallback(() => { void sellerVerificationService.pendingUploads(ownerId).then((entries) => { if (isMounted.current) setPending(entries); }).catch(() => {}); }, [ownerId]);
  useEffect(() => {
    let active = true;
    void sellerVerificationService.load(ownerId).then(async (local) => {
      if (!active) return;
      setPending(await sellerVerificationService.pendingUploads(ownerId));
      current.current = local; setForm(local); setSaveState('saved');
      const checked = await sellerVerificationService.withoutExpiredFiles(local);
      if (active && checked.expired.length && current.current === local) {
        await sellerVerificationService.save(checked.application);
        current.current = checked.application; setForm(checked.application);
        setIsCheckShown(true);
        setError(expiredFilesMessage(checked.expired));
      }
      const remote = await sellerVerificationService.remoteWithReview(ownerId);
      if (!active) return;
      if (remote) setReview(remote.review);
      setRefresh({ phase: 'idle', checkedAtMs: Date.now() });
      if (remote && current.current === local && sellerVerificationService.shouldAdoptRemote(local, remote.application)) {
        await sellerVerificationService.save(remote.application);
        if (active && current.current === local) { current.current = remote.application; setForm(remote.application); }
      }
    }).catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Application could not be restored.'); });
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active' && current.current) void sellerVerificationService.save(current.current).catch(() => setError('Application save failed. Retry.')); });
    return () => { active = false; subscription.remove(); };
  }, [ownerId]);
  const editable = form?.status === 'draft';
  // Keeps "checked 3 min ago" honest while the status screen stays open.
  useEffect(() => {
    if (editable !== false) return;
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [editable]);
  const action = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Action failed. Retry.'); }
    finally { setBusy(false); refreshPending(); }
  };
  const setUpload = (kind: SellerFileKind, upload: SellerUploadState | null) => {
    if (!isMounted.current) return;
    setUploads((previous) => {
      const next = { ...previous };
      if (upload) next[kind] = upload; else delete next[kind];
      return next;
    });
  };
  /** Runs one row's upload (new file or retry), showing its progress, success or failure inside that row. */
  const runUpload = async (kind: SellerFileKind, fileName: string, send: (onProgress: (percent: number) => void) => Promise<SellerFile>) => {
    setUpload(kind, { phase: 'uploading', percent: 0, fileName });
    try {
      const file = await send((percent) => setUpload(kind, { phase: percent >= 100 ? 'processing' : 'uploading', percent, fileName }));
      // A closed screen must never save: its draft may be older than one opened since. The upload stays in the
      // device's pending store, so the next visit offers it again.
      if (!isMounted.current) return;
      const latest = current.current;
      if (!latest) return;
      // Saves stay serialized through `queue`, so two rows finishing together cannot overwrite each other.
      await save({ ...latest, files: [...latest.files.filter((entry) => entry.kind !== kind), file] });
      await sellerVerificationService.discardUpload(ownerId, kind);
      if (!isMounted.current) return;
      setUpload(kind, { phase: 'done', percent: 100, fileName });
      AccessibilityInfo.announceForAccessibility(`${SELLER_FILE_LABELS[kind]} uploaded`);
      const timer = setTimeout(() => {
        doneTimers.current.delete(timer);
        setUploads((previous) => {
          if (previous[kind]?.phase !== 'done') return previous;
          const next = { ...previous };
          delete next[kind];
          return next;
        });
      }, UPLOAD_DONE_MS);
      doneTimers.current.add(timer);
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : 'The upload stopped. Check your connection and retry.';
      console.error('[SellerApplicationModal.runUpload] Error:', message);
      setUpload(kind, { phase: 'failed', percent: 0, fileName, message });
      AccessibilityInfo.announceForAccessibility(`${SELLER_FILE_LABELS[kind]} upload failed. ${message}`);
    } finally { refreshPending(); }
  };
  const isUploadActive = (kind: SellerFileKind) => uploads[kind]?.phase === 'uploading' || uploads[kind]?.phase === 'processing';
  const isAnyUploadActive = (Object.keys(uploads) as SellerFileKind[]).some(isUploadActive);
  const pick = async (kind: SellerFileKind) => {
    if (!form || isUploadActive(kind) || isPicking.current) return;
    isPicking.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: kind === 'logo' ? ['image/jpeg', 'image/png'] : ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true });
      isPicking.current = false;
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      await runUpload(kind, asset.name, (onProgress) => sellerVerificationService.upload(ownerId, kind, asset, onProgress));
    } catch (failure: unknown) {
      console.error('[SellerApplicationModal.pick] Error:', failure instanceof Error ? failure.message : 'Unknown error');
      setError('The file picker could not open. Try again.');
    } finally { isPicking.current = false; }
  };
  const retry = (kind: SellerFileKind) => {
    if (isUploadActive(kind)) return;
    const fileName = pending.find((entry) => entry.kind === kind)?.name ?? uploads[kind]?.fileName ?? SELLER_FILE_LABELS[kind];
    void runUpload(kind, fileName, (onProgress) => sellerVerificationService.retryUpload(ownerId, kind, onProgress));
  };
  const discard = (kind: SellerFileKind) => {
    setUpload(kind, null);
    void action(() => sellerVerificationService.discardUpload(ownerId, kind));
  };
  /** Asks the server for the latest decision and says what happened: up to date, changed, or could not check. */
  const checkStatus = async () => {
    if (refresh.phase === 'checking') return;
    const before = current.current?.status ?? null;
    setRefresh({ phase: 'checking', checkedAtMs: refresh.checkedAtMs });
    try {
      const remote = await sellerVerificationService.remoteWithReview(ownerId);
      if (!isMounted.current) return;
      const checkedAtMs = Date.now();
      setNowMs(checkedAtMs);
      if (remote) {
        current.current = remote.application; setForm(remote.application); setReview(remote.review);
        void sellerVerificationService.save(remote.application).catch(() => {});
      }
      const after = remote?.application.status ?? before;
      if (after && after !== before) {
        const statusLabel = describeSellerStatus(after);
        setRefresh({ phase: 'changed', checkedAtMs, statusLabel });
        AccessibilityInfo.announceForAccessibility(`Status changed to ${statusLabel}`);
      } else {
        setRefresh({ phase: 'current', checkedAtMs });
        AccessibilityInfo.announceForAccessibility('Up to date');
      }
    } catch (failure: unknown) {
      console.error('[SellerApplicationModal.checkStatus] Error:', failure instanceof Error ? failure.message : 'Unknown error');
      if (isMounted.current) setRefresh({ phase: 'failed', checkedAtMs: refresh.checkedAtMs, message: "Couldn't check right now. Check your connection and try again." });
    }
  };
  const handlePull = () => { setIsPulling(true); void withCleanup(checkStatus(), () => { if (isMounted.current) setIsPulling(false); }); };
  const lockedStatus = form && form.status !== 'draft' ? form.status : null;
  const refreshPanel = <SellerRefreshPanel state={refresh} nowMs={nowMs} onRefresh={() => void checkStatus()} variant={lockedStatus === 'approved' || lockedStatus === 'rejected' || lockedStatus === 'suspended' ? 'link' : 'button'} />;
  const handleClose = () => {
    // Closing mid-upload would leave the file unattached (and a second screen could save over this one).
    if (isAnyUploadActive) { setIsCloseBlocked(true); AccessibilityInfo.announceForAccessibility('Wait for the upload to finish'); return; }
    void action(async () => { if (current.current) await save(current.current); onClose(); });
  };
  const openListingEditor = () => { onClose(); router.push('/market/seller/edit' as Href); };
  return <MarketFormModal visible busy={busy} title="Seller application" onClose={handleClose}
    refreshControl={lockedStatus ? <RefreshControl refreshing={isPulling} onRefresh={handlePull} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} /> : undefined}>
    {error ? <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.destructiveBorder, backgroundColor: colors.destructiveSurface }}>
      <Icon name="alert-circle" size={16} color={colors.destructiveText} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: colors.destructiveText, fontSize: 14, lineHeight: 20 }}>{error}</Text>
    </View> : null}
    {isCloseBlocked && isAnyUploadActive ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.warningBorder, backgroundColor: colors.warningSurface }}>
      <Icon name="upload-cloud" size={16} color={colors.warningText} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: colors.warningText, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>Wait for the upload to finish. You can close this screen once it is done.</Text>
    </View> : null}
    {!form ? <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: 10, paddingVertical: 48 }}>
      <ActivityIndicator color={colors.accent} />
      <Text style={{ color: colors.mutedText }}>Loading your application…</Text>
    </View> : null}
    {form ? <>
      {editable ? <>
        <SellerDraftHeader revision={form.revision} saveState={saveState} />
        <SellerInfoNote icon="info" text={PAYMENTS_NOTE} />
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
        <View style={{ gap: 10, marginTop: 8 }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Documents</Text>
            <Text style={{ color: colors.secondaryText, fontSize: 13 }}>JPG, PNG or PDF up to 10 MB. Only reviewers see them.</Text>
          </View>
          {(['governmentId', 'proofOfAddress', ...(form.isBusiness ? ['businessRegistration' as const] : []), 'logo'] as SellerFileKind[]).map((kind) => (
            <SellerDocumentRow
              key={kind}
              label={SELLER_FILE_LABELS[kind]}
              hint={SELLER_FILE_HINTS[kind]}
              required={kind !== 'logo'}
              isImage={kind === 'logo'}
              fileName={form.files.find((file) => file.kind === kind)?.name ?? null}
              pendingName={pending.find((entry) => entry.kind === kind)?.name ?? null}
              upload={uploads[kind] ?? null}
              error={fieldErrors[kind]}
              disabled={busy}
              onChoose={() => void pick(kind)}
              onRemove={() => { void save({ ...form, files: form.files.filter((file) => file.kind !== kind) }).catch(() => {}); }}
              onRetry={() => retry(kind)}
              onDiscard={() => discard(kind)}
            />
          ))}
        </View>
        <SellerTermsRow
          accepted={form.acceptedTerms}
          expanded={terms}
          error={fieldErrors.acceptedTerms}
          onToggleAccepted={() => { void save({ ...form, acceptedTerms: !form.acceptedTerms }).catch(() => {}); }}
          onToggleExpanded={() => setTerms(!terms)}
          onOpenFullTerms={() => { void Linking.openURL('https://ourlime.com/terms-and-conditions').catch(() => setError('Open ourlime.com/terms-and-conditions in your browser. Your application is saved.')); }}
        />
        {/* Shown beside Submit as well as at the top, so the reason is on screen where the button was tapped. */}
        {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
        {isAnyUploadActive ? <Text accessibilityLiveRegion="polite" style={{ color: colors.mutedText, fontSize: 13, textAlign: 'center' }}>Submit is available once your uploads finish.</Text> : null}
        <MarketButton label="Submit for review" disabled={busy || isAnyUploadActive} onPress={() => void action(async () => {
          const problems = Object.values(sellerVerificationService.validate(form));
          if (problems.length) { setIsCheckShown(true); throw new Error(problems.length === 1 ? problems[0] : `${problems.length} things to fix before submitting. Each is marked in red above.`); }
          await queue.current;
          const checked = await sellerVerificationService.withoutExpiredFiles(current.current ?? form);
          if (checked.expired.length) { await save(checked.application); setIsCheckShown(true); throw new Error(expiredFilesMessage(checked.expired)); }
          const submitted = await sellerVerificationService.submit(checked.application); current.current = submitted; setForm(submitted);
          setReview({ submittedAtMs: Date.now(), decidedAtMs: null, reason: null });
          // Nothing has been checked since submitting, so do not claim "checked just now".
          setRefresh({ phase: 'idle', checkedAtMs: null });
        })} />
      </> : lockedStatus ? <>
        <SellerStatusHero status={lockedStatus} reason={review?.reason ?? null} />
        {lockedStatus === 'approved' ? <MarketButton label="List a product" onPress={openListingEditor} /> : null}
        {['changes_requested', 'rejected'].includes(lockedStatus) ? <Text style={{ color: colors.secondaryText, fontSize: 14, textAlign: 'center' }}>A revised application needs fresh documents.</Text> : null}
        {['changes_requested', 'rejected'].includes(lockedStatus) ? <MarketButton label="Start a revised application" onPress={() => void action(async () => { const next = await sellerVerificationService.startRevision(ownerId, form); current.current = next; setForm(next); })} /> : null}
        {/* While waiting, checking for a decision is the main thing to do, so it sits right under the status. */}
        {lockedStatus === 'submitted' ? refreshPanel : null}
        <SellerReviewTimeline status={lockedStatus} review={review} />
        <SellerSubmittedSummary application={form} />
        {lockedStatus === 'submitted' ? null : refreshPanel}
        <SellerInfoNote icon={lockedStatus === 'submitted' ? 'lock' : 'info'} text={lockedStatus === 'submitted' ? `Submitted details are locked while they are reviewed. ${PAYMENTS_NOTE}` : PAYMENTS_NOTE} />
      </> : null}
    </> : null}
  </MarketFormModal>;
}
