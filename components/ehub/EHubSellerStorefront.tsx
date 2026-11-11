import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Upload } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { getEHubTermsRoute } from '@/lib/services/EHubService';
import { EHUB_PROVIDER_DECLARATION_VERSION, EHUB_SELLER_AGREEMENT_VERSION } from '@/lib/types/ehubSeller';
import type { EHubSellerCenter } from '@/lib/hooks/useEHubSellerCenter';
import {
  SellerButton, SellerCheckRow, SellerChipField, SellerImageField, SellerSaveIndicator, SellerStepHeader, SellerTextField,
} from '@/components/ehub/EHubSellerFormParts';

const STORE_STEPS = ['Store basics', 'Branding', 'Business information', 'Policies', 'Review & publish'];

type StorefrontProps = { center: EHubSellerCenter; isTablet: boolean; onPublished: () => void };

/** The website's guided storefront setup: five steps, autosaved as a private draft, published with the agreements. */
export default function EHubSellerStorefront({ center, isTablet, onPublished }: StorefrontProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [isSellerAgreementAccepted, setIsSellerAgreementAccepted] = useState(false);
  const [isProviderDeclarationAccepted, setIsProviderDeclarationAccepted] = useState(false);
  const { storeForm: form, updateStoreForm: onChange, workspace } = center;
  const store = workspace?.store ?? null;
  const needsSellerAgreement = !store || store.sellerAgreementVersion !== EHUB_SELLER_AGREEMENT_VERSION;
  const needsProviderDeclaration = form.services.length > 0 && (!store || store.providerDeclarationVersion !== EHUB_PROVIDER_DECLARATION_VERSION);
  const agreementsAccepted = (!needsSellerAgreement || isSellerAgreementAccepted) && (!needsProviderDeclaration || isProviderDeclarationAccepted);
  const isPublishDisabled = Boolean(workspace?.eligibility.reason) || !agreementsAccepted || form.storeName.trim().length < 2 || form.description.trim().length < 20;
  const completedSteps = [
    form.storeName.trim().length >= 2 && form.description.trim().length >= 20 && form.categories.length > 0,
    Boolean(form.logoUrl && form.coverUrl),
    Boolean(form.businessHours && (form.services.length === 0 || form.serviceAreas.length > 0)),
    Boolean(form.sellerPolicies && form.returnPolicy),
    agreementsAccepted && !isPublishDisabled,
  ];

  const handlePublish = async () => {
    if (await center.publishStore(isSellerAgreementAccepted, isProviderDeclarationAccepted)) {
      setStep(0);
      onPublished();
    }
  };

  return <View style={styles.card}>
    <View style={styles.top}>
      <View style={styles.flex}><Text style={styles.eyebrow}>My Storefront</Text><Text style={styles.title}>Guided storefront setup</Text></View>
      <SellerSaveIndicator status={center.saveStatus} savedAt={center.lastSavedAt} />
    </View>
    <SellerStepHeader steps={STORE_STEPS} currentStep={step} completedSteps={completedSteps} onStepChange={setStep} />
    <View style={styles.body}>
      {step === 0 ? <>
        <SellerTextField label="Store name" required value={form.storeName} maxLength={120} onChangeText={(storeName) => onChange({ storeName })} />
        <SellerTextField label="Description" required hint="Tell buyers what your business offers (at least 20 characters)." multiline maxLength={3000} value={form.description} onChangeText={(description) => onChange({ description })} />
        <SellerChipField label="Business categories" values={form.categories} onChange={(categories) => onChange({ categories })} placeholder="Add a category" />
      </> : null}
      {step === 1 ? <View style={[styles.grid, isTablet ? styles.gridRow : null]}>
        <View style={styles.flex}><SellerImageField label="Store logo" imageUrl={form.logoUrl} aspect={[1, 1]} isUploading={center.isUploading} onPick={(uri) => void center.uploadImage(uri, 'storefront', 'logoUrl')} /></View>
        <View style={styles.flex}><SellerImageField label="Cover image" imageUrl={form.coverUrl} aspect={[16, 9]} isUploading={center.isUploading} onPick={(uri) => void center.uploadImage(uri, 'storefront', 'coverUrl')} /></View>
      </View> : null}
      {step === 2 ? <>
        <SellerChipField label="Services" values={form.services} onChange={(services) => onChange({ services })} placeholder="Add a service" />
        <SellerChipField label="Service areas" values={form.serviceAreas} onChange={(serviceAreas) => onChange({ serviceAreas })} placeholder="Add an area" />
        <SellerTextField label="Business hours" value={form.businessHours} maxLength={300} placeholder="Mon–Fri 8am–5pm" onChangeText={(businessHours) => onChange({ businessHours })} />
      </> : null}
      {step === 3 ? <>
        <SellerTextField label="Seller policies" multiline maxLength={5000} value={form.sellerPolicies} onChangeText={(sellerPolicies) => onChange({ sellerPolicies })} />
        <SellerTextField label="Return/refund expectations" multiline maxLength={5000} value={form.returnPolicy} onChangeText={(returnPolicy) => onChange({ returnPolicy })} />
      </> : null}
      {step === 4 ? <>
        <View style={styles.preview}>
          <View style={styles.previewCover}>{form.coverUrl ? <CachedImage uri={form.coverUrl} style={styles.fill} accessibilityLabel="Store cover preview" /> : null}</View>
          <View style={styles.previewBody}>
            <Text style={styles.previewTitle}>{form.storeName || 'Your store name'}</Text>
            <Text style={styles.muted}>{form.description || 'Your store description will appear here.'}</Text>
            {form.categories.length ? <View style={styles.tags}>{form.categories.map((category) => <Text key={category} style={styles.tag}>{category}</Text>)}</View> : null}
          </View>
        </View>
        <Text style={styles.warning}>Publishing requires current seller agreements and existing eligibility checks. Autosaved drafts are never published automatically.</Text>
        {needsSellerAgreement || needsProviderDeclaration ? <View style={styles.agreements}>
          {needsSellerAgreement ? <SellerCheckRow checked={isSellerAgreementAccepted} onChange={setIsSellerAgreementAccepted} accessibilityLabel="I accept the current E-Hub Seller Agreement">
            <Text style={styles.agreementText}>I accept the current <Text accessibilityRole="link" onPress={() => router.push(getEHubTermsRoute('seller') as Href)} style={styles.link}>E-Hub Seller Agreement</Text>.</Text>
          </SellerCheckRow> : null}
          {needsProviderDeclaration ? <SellerCheckRow checked={isProviderDeclarationAccepted} onChange={setIsProviderDeclarationAccepted} accessibilityLabel="I accept the current Provider Declaration">
            <Text style={styles.agreementText}>I accept the current <Text accessibilityRole="link" onPress={() => router.push(getEHubTermsRoute('provider') as Href)} style={styles.link}>Provider Declaration</Text>.</Text>
          </SellerCheckRow> : null}
        </View> : null}
        <SellerButton label={center.isWorking ? 'Publishing…' : 'Publish storefront'} icon={<Upload size={17} color="#ffffff" />} isLoading={center.isWorking} disabled={isPublishDisabled || center.isUploading} onPress={() => void handlePublish()} />
      </> : null}
    </View>
    <View style={styles.footer}>
      <SellerButton label="Previous" variant="secondary" disabled={step === 0} onPress={() => setStep(Math.max(0, step - 1))} />
      {step < STORE_STEPS.length - 1 ? <SellerButton label="Continue" onPress={() => setStep(step + 1)} /> : null}
    </View>
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  card: { padding: 18, gap: 18, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { marginTop: 3, color: colors.text, fontSize: 22, fontWeight: '900' },
  body: { minHeight: 260, gap: 18 },
  grid: { gap: 18 },
  gridRow: { flexDirection: 'row' },
  muted: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  preview: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  previewCover: { height: 130, backgroundColor: colors.successSurface },
  previewBody: { padding: 16, gap: 8 },
  previewTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.successSurface, color: colors.accentText, fontSize: 12, fontWeight: '800' },
  warning: { padding: 14, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.warningSurface, color: colors.warningText, fontSize: 13, lineHeight: 19 },
  agreements: { padding: 14, gap: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  agreementText: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  link: { color: colors.accentText, fontWeight: '900', textDecorationLine: 'underline' },
  footer: { paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
});
