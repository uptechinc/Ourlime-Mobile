import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { toast } from 'sonner-native';
import AdsDocumentField from '@/components/ads/AdsDocumentField';
import { pickAdsDocuments } from '@/components/ads/adsPickers';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsFormSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsErrorState, AdsField, AdsHeading, AdsScreen, AdsSectionLabel, AdsToggleChip } from '@/components/ads/AdsUi';
import { useAdsHostRegistrationGate } from '@/lib/hooks/useAdsHostRegistrationGate';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { BusinessAddress } from '@/lib/types/adsMarketplace';

type UploadedDocument = { name: string; url: string };
type DocumentKind = 'registrationCertificate' | 'taxIdDocument';

/** Register as a business host (website /ads/marketplace/become-host/business). */
export default function BusinessHostRegistrationRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { isChecking, error, retry } = useAdsHostRegistrationGate(adsRoutes.login, adsRoutes.hostDashboard);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<DocumentKind | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState<Required<BusinessAddress>>({ street: '', city: '', state: '', country: '', postalCode: '' });
  const [canHostDigital, setCanHostDigital] = useState(true);
  const [canHostSocial, setCanHostSocial] = useState(false);
  const [canHostPhysical, setCanHostPhysical] = useState(false);
  const [documents, setDocuments] = useState<{ [kind in DocumentKind]: UploadedDocument | null }>({ registrationCertificate: null, taxIdDocument: null });

  const updateAddress = (field: keyof BusinessAddress, value: string): void => setAddress((previous) => ({ ...previous, [field]: value }));

  const handlePickDocument = async (kind: DocumentKind): Promise<void> => {
    const [file] = await pickAdsDocuments(true, false);
    if (!file) return;
    setUploadingKind(kind);
    try {
      const url = await adsMarketplaceService.uploadVerificationDocument(file, kind);
      setDocuments((previous) => ({ ...previous, [kind]: { name: file.name, url } }));
      toast.success('Document uploaded successfully');
    } catch (uploadError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(uploadError, 'Failed to upload document'));
    } finally {
      setUploadingKind(null);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!businessName.trim() || !businessEmail.trim()) {
      toast.error('Business name and email are required');
      return;
    }
    if (!address.country.trim()) {
      toast.error('Country is required');
      return;
    }
    if (!documents.registrationCertificate) {
      toast.error('Business registration certificate is required');
      return;
    }
    setIsSubmitting(true);
    try {
      await adsMarketplaceService.registerBusinessHost({
        businessName,
        businessEmail,
        businessPhone,
        businessWebsite,
        businessRegistrationNumber: registrationNumber,
        taxId,
        businessAddress: address,
        canHostDigital,
        canHostSocial,
        canHostPhysical,
        verificationDocuments: {
          registrationCertificate: documents.registrationCertificate.url,
          taxIdDocument: documents.taxIdDocument?.url,
        },
      });
      toast.success('Host registration submitted! Your documents will be reviewed by an admin.');
      router.replace(adsRoutes.hostDashboard);
    } catch (submitError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(submitError, 'Failed to register as host'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = Boolean(businessName.trim() && businessEmail.trim() && documents.registrationCertificate) && uploadingKind === null;

  return (
    <AdsScreen
      title="Business Host"
      loading={isChecking}
      skeleton={<AdsFormSkeleton sections={4} />}
      footer={!error ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AdsButton label="Cancel" variant="secondary" disabled={isSubmitting} onPress={() => router.replace(adsRoutes.becomeHost)} style={{ flex: 1 }} />
          <AdsButton label={isSubmitting ? 'Submitting…' : 'Submit registration'} loading={isSubmitting} disabled={!canSubmit} onPress={() => void handleSubmit()} style={{ flex: 1 }} />
        </View>
      ) : undefined}
    >
      <AdsHeading title="Register as a business host" subtitle="Complete the form below and upload required documents. Your account will be verified by an admin before you can create offers." />
      {error ? <AdsErrorState message={error} onRetry={retry} /> : (
        <>
          <AdsCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Building2 size={16} color={colors.mutedText} />
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Business information</Text>
            </View>
            <AdsField label="Business name" required placeholder="Enter business name" value={businessName} onChangeText={setBusinessName} />
            <AdsField label="Business email" required placeholder="business@example.com" keyboardType="email-address" autoCapitalize="none" value={businessEmail} onChangeText={setBusinessEmail} />
            <AdsField label="Business phone" placeholder="+1 (555) 123-4567" keyboardType="phone-pad" value={businessPhone} onChangeText={setBusinessPhone} />
            <AdsField label="Website" placeholder="https://example.com" keyboardType="url" autoCapitalize="none" value={businessWebsite} onChangeText={setBusinessWebsite} />
            <AdsField label="Registration number" placeholder="Optional" value={registrationNumber} onChangeText={setRegistrationNumber} />
            <AdsField label="Tax ID" placeholder="Optional" value={taxId} onChangeText={setTaxId} />
          </AdsCard>
          <AdsCard>
            <AdsSectionLabel title="Address" />
            <AdsField label="Street" placeholder="123 Main St" value={address.street} onChangeText={(value) => updateAddress('street', value)} />
            <AdsField label="City" placeholder="City" value={address.city} onChangeText={(value) => updateAddress('city', value)} />
            <AdsField label="State / province" placeholder="State" value={address.state} onChangeText={(value) => updateAddress('state', value)} />
            <AdsField label="Country" required placeholder="Country" value={address.country} onChangeText={(value) => updateAddress('country', value)} />
            <AdsField label="Postal code" placeholder="12345" value={address.postalCode} onChangeText={(value) => updateAddress('postalCode', value)} />
          </AdsCard>
          <AdsCard>
            <AdsSectionLabel title="Ad space types" description="Choose every kind of ad space you can offer." />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <AdsToggleChip label="Digital (websites, apps, screens)" pressed={canHostDigital} onChange={setCanHostDigital} />
              <AdsToggleChip label="Social media" pressed={canHostSocial} onChange={setCanHostSocial} />
              <AdsToggleChip label="Physical (banners, posters, billboards)" pressed={canHostPhysical} onChange={setCanHostPhysical} />
            </View>
          </AdsCard>
          <AdsCard>
            <AdsSectionLabel title="Required documents" description="Upload proof documents for admin review. Your registration will be pending until approved." />
            <AdsDocumentField
              label="Business registration certificate"
              required
              uploadLabel="Upload registration certificate"
              fileName={documents.registrationCertificate?.name ?? null}
              isUploaded={Boolean(documents.registrationCertificate)}
              isUploading={uploadingKind === 'registrationCertificate'}
              disabled={uploadingKind !== null}
              onPick={() => void handlePickDocument('registrationCertificate')}
              onRemove={() => setDocuments((previous) => ({ ...previous, registrationCertificate: null }))}
            />
            <AdsDocumentField
              label="Tax ID document"
              uploadLabel="Upload tax ID document"
              fileName={documents.taxIdDocument?.name ?? null}
              isUploaded={Boolean(documents.taxIdDocument)}
              isUploading={uploadingKind === 'taxIdDocument'}
              disabled={uploadingKind !== null}
              onPick={() => void handlePickDocument('taxIdDocument')}
              onRemove={() => setDocuments((previous) => ({ ...previous, taxIdDocument: null }))}
            />
          </AdsCard>
        </>
      )}
    </AdsScreen>
  );
}
