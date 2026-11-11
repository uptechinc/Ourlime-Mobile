import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import { SellerButton, SellerStepHeader } from '@/components/ehub/EHubSellerFormParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useMarketListingEditor } from '@/lib/hooks/useMarketListingEditor';
import { useSellerEligibility } from '@/lib/hooks/useMarketListings';
import { LISTING_STEPS } from '@/lib/services/MarketListingFormService';
import type { ListingEditorStep } from '@/lib/types/marketListing';
import SellerScreenFrame, { SellerLoading } from './SellerScreenFrame';
import SellerEligibilityNotice from './SellerEligibilityNotice';
import { ListingIssues } from './ListingFormParts';
import ListingBasicInfoStep from './steps/ListingBasicInfoStep';
import ListingMediaStep from './steps/ListingMediaStep';
import ListingPricingStep from './steps/ListingPricingStep';
import ListingReviewStep from './steps/ListingReviewStep';

/**
 * Create or edit a listing (website /profile/products/add and /profile/products/edit/[id]) in the web's four steps.
 * Route: /market/seller/edit (new) or /market/seller/edit?id=<productId>. Selling needs an approved seller.
 */
export default function SellerListingEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const productId = typeof params.id === 'string' && params.id ? params.id : null;
  const { profile, getDecision } = usePageAccess();
  const userId = profile?.uid ?? null;
  const seller = useSellerEligibility(userId);
  const title = productId ? 'Edit listing' : 'Add product';

  if (!seller.eligibility) {
    return <SellerScreenFrame title={title} subtitle="Lime Market seller" fallbackRoute="/market/seller">
      {seller.error ? <View style={{ padding: 16 }}><SellerButton label="Retry" onPress={() => void seller.refresh()} /></View> : <SellerLoading label="Checking your seller status…" />}
    </SellerScreenFrame>;
  }
  if (seller.eligibility.status !== 'approved') {
    return <SellerScreenFrame title={title} subtitle="Lime Market seller" fallbackRoute="/market/seller">
      <ScrollView contentContainerStyle={{ padding: 16 }}><SellerEligibilityNotice eligibility={seller.eligibility} onApplicationClosed={() => void seller.refresh()} /></ScrollView>
    </SellerScreenFrame>;
  }
  return <ListingEditor productId={productId} title={title} canMutate={getDecision('/market').canMutate} />;
}

function ListingEditor({ productId, title, canMutate }: { productId: string | null; title: string; canMutate: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const editor = useMarketListingEditor(productId);
  const scrollRef = useRef<ScrollView>(null);
  const [attempted, setAttempted] = useState<{ [step in ListingEditorStep]: boolean }>({ 0: false, 1: false, 2: false, 3: false });
  const [isSaved, setIsSaved] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { step, setStep, stepErrors, progress } = editor;
  const isBusy = progress.phase !== 'idle';

  const goTo = (next: ListingEditorStep) => {
    // Forward only past valid steps (like the web's Next buttons); back is always allowed.
    if (next > step) {
      const blocking = ([0, 1, 2] as const).find((index) => index < next && stepErrors[index].length > 0);
      if (blocking !== undefined) {
        setAttempted((current) => ({ ...current, [blocking]: true }));
        setStep(blocking);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
    }
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleSubmit = async () => {
    setAttempted({ 0: true, 1: true, 2: true, 3: true });
    const result = await editor.save();
    if (result) setIsSaved(true);
  };

  if (editor.loadState === 'loading') return <SellerScreenFrame title={title} subtitle="Lime Market seller" fallbackRoute="/market/seller"><SellerLoading label="Loading listing…" /></SellerScreenFrame>;
  if (editor.loadState === 'error') {
    return <SellerScreenFrame title={title} subtitle="Lime Market seller" fallbackRoute="/market/seller">
      <View style={styles.content}>
        <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{editor.loadError}</Text></View>
        <SellerButton label="Back to my listings" variant="secondary" onPress={() => router.replace('/market/seller' as Href)} />
      </View>
    </SellerScreenFrame>;
  }

  const progressLabel = progress.phase === 'uploading' ? `Uploading photos ${progress.uploaded}/${progress.total}…` : progress.phase === 'saving' ? 'Submitting for review…' : '';

  return <SellerScreenFrame title={title} subtitle={editor.listing ? editor.listing.title : 'Submitted listings are reviewed before they go live'} fallbackRoute="/market/seller">
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <SellerStepHeader steps={[...LISTING_STEPS]} currentStep={step} completedSteps={([0, 1, 2, 3] as const).map((index) => stepErrors[index].length === 0)} onStepChange={(index) => goTo(index as ListingEditorStep)} />
      {editor.hasRestoredDraft && step === 0 ? <View style={styles.draftBanner}>
        <Text style={styles.draftText}>Restored the draft saved on this device.</Text>
        <Pressable accessibilityRole="button" onPress={() => setConfirmDiscard(true)}><Text style={styles.draftAction}>Discard draft</Text></Pressable>
      </View> : null}
      {editor.listing?.status === 'rejected' && editor.listing.rejectionReason && step === 0 ? <View style={styles.errorCard}>
        <Text style={styles.errorText}><Text style={{ fontWeight: '900' }}>Admin feedback: </Text>{editor.listing.rejectionReason}</Text>
      </View> : null}
      {step === 0 ? <ListingBasicInfoStep editor={editor} /> : null}
      {step === 1 ? <ListingMediaStep editor={editor} /> : null}
      {step === 2 ? <ListingPricingStep editor={editor} /> : null}
      {step === 3 ? <ListingReviewStep editor={editor} /> : null}
      {step < 3 && attempted[step] ? <ListingIssues title="Complete the following to continue:" issues={stepErrors[step]} /> : null}
      {editor.saveError ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{editor.saveError}</Text></View> : null}
      {progressLabel ? <Text accessibilityLiveRegion="polite" style={styles.progress}>{progressLabel}</Text> : null}
      <View style={styles.footer}>
        <View style={styles.flex}><SellerButton variant="secondary" label={step === 0 ? 'Cancel' : 'Previous'} disabled={isBusy}
          onPress={() => step === 0 ? (router.canGoBack() ? router.back() : router.replace('/market/seller' as Href)) : goTo((step - 1) as ListingEditorStep)} /></View>
        <View style={styles.flex}>{step < 3
          ? <SellerButton label="Continue" onPress={() => { setAttempted((current) => ({ ...current, [step]: true })); if (!stepErrors[step].length) goTo((step + 1) as ListingEditorStep); }} />
          : <SellerButton label={editor.isEditing ? 'Save & resubmit' : 'Confirm & publish'} icon={<ShieldCheck size={17} color="#ffffff" />} isLoading={isBusy}
            disabled={!canMutate || (!editor.isEditing && !editor.form.disclaimerAccepted)} onPress={() => void handleSubmit()} />}</View>
      </View>
      {!canMutate ? <Text style={styles.progress}>Preview sessions cannot submit listings.</Text> : null}
    </ScrollView>
    <CustomModal visible={isSaved} type="success" title="Submitted for review" message="Your listing was saved and sent to an administrator for review. You will be notified when it is approved or needs changes."
      onClose={() => { setIsSaved(false); router.replace('/market/seller' as Href); }} />
    <CustomModal visible={confirmDiscard} type="warning" title="Discard draft?" message="The details saved on this device will be cleared." confirmText="Discard" cancelText="Keep"
      onConfirm={() => { setConfirmDiscard(false); void editor.discardDraft(); }} onCancel={() => setConfirmDiscard(false)} onClose={() => setConfirmDiscard(false)} />
  </SellerScreenFrame>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 14, paddingBottom: 40, gap: 16 },
  draftBanner: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface },
  draftText: { flex: 1, color: colors.accentText, fontSize: 12, fontWeight: '700' },
  draftAction: { color: colors.destructiveText, fontSize: 12, fontWeight: '900', textDecorationLine: 'underline' },
  errorCard: { padding: 12, borderRadius: 13, backgroundColor: colors.destructiveSurface },
  errorText: { color: colors.destructiveText, fontSize: 13, lineHeight: 18 },
  progress: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  footer: { paddingTop: 14, flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
});
