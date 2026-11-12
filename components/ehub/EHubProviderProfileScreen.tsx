import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View, type ScrollView } from 'react-native';
import { BadgeCheck, Building2, Check, Clock, Globe, MapPin, Package, Send, Share2, Star, UserRound } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import EHubSectionNav from '@/components/ehub/EHubSectionNav';
import CachedImage from '@/components/ui/CachedImage';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useEHubProvider } from '@/lib/hooks/useEHub';
import { eHubService, EHUB_PROVIDER_SHARE_BASE_URL, getEHubTermsRoute } from '@/lib/services/EHubService';
import { EHubChip, EHubEmptyState, EHubNotice, formatEHubPrice, useEHubLayout } from '@/components/ehub/EHubParts';
import { EHubScrollView } from '@/components/ehub/EHubScrollView';
import { EHubProviderProfileSkeleton } from '@/components/ehub/EHubSkeletons';
import type { EHubEnquiryType, EHubProviderDetail } from '@/lib/types/ehubDiscovery';

type Notice = { tone: 'success' | 'error'; text: string };

const ENQUIRY_TYPES: { value: EHubEnquiryType; label: string }[] = [
  { value: 'service', label: 'Ask about a service' },
  { value: 'availability', label: 'Ask about availability' },
  { value: 'product', label: 'Product or business question' },
  { value: 'general', label: 'Request more information' },
];
const MINIMUM_MESSAGE_LENGTH = 10;
const MAXIMUM_MESSAGE_LENGTH = 1500;

function readParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

/** The product the link asked about: the exact title, or the title followed by the options picked on the product page. */
function findRequestedProductTitle(provider: EHubProviderDetail | null, requestedName: string): string | null {
  if (!provider || !requestedName) return null;
  const name = requestedName.toLowerCase();
  const product = provider.products.find((item) => item.title.toLowerCase() === name || name.startsWith(`${item.title.toLowerCase()} (`));
  return product ? requestedName : null;
}

/**
 * The website's /ehub/providers/[providerId]: profile, services offered, published catalog, policies and the safe
 * enquiry form. ?product= or ?service= carries that context into the form (banner, type and opening message), and the
 * unsent form is kept per provider and context while the member signs in or reads the buyer terms.
 */
export default function EHubProviderProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ providerId: string; product?: string; service?: string }>();
  const providerId = readParam(params.providerId);
  const requestedProductName = readParam(params.product);
  const requestedServiceName = readParam(params.service);
  const { colors } = useAppTheme();
  const { profile } = usePageAccess();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors, layout.gutter), [colors, layout.gutter]);
  const resource = useEHubProvider(providerId);
  const provider = resource.data;
  const [type, setType] = useState<EHubEnquiryType>('service');
  const [message, setMessage] = useState('');
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const layoutOffsets = useRef({ body: 0, columns: 0, form: 0 });
  const restoredDraftKey = useRef<string | null>(null);

  const requestedProduct = findRequestedProductTitle(provider, requestedProductName);
  const requestedService = provider?.services.find((service) => service.toLowerCase() === requestedServiceName.toLowerCase()) ?? null;
  const draftKey = eHubService.getEnquiryDraftKey(providerId, requestedProductName || requestedServiceName || 'general');
  const isOwnProvider = Boolean(profile?.uid && provider?.ownerId === profile.uid);
  const trimmedLength = message.trim().length;
  const canSubmit = !isSubmitting && isAcknowledged && trimmedLength >= MINIMUM_MESSAGE_LENGTH && !isOwnProvider;

  // Once the provider is known, restore this context's unsent form or open with the website's context message.
  useEffect(() => {
    if (!provider) return;
    let isActive = true;
    restoredDraftKey.current = null;
    // Drafts are kept on the device, so a half-written enquiry comes back after the app restarts.
    void eHubService.getEnquiryDraft(draftKey).then((draft) => {
      if (!isActive) return;
      const restoredMessage = draft?.message.trim() ?? '';
      const contextName = requestedProduct ?? requestedService;
      setType(draft?.type ?? (requestedProduct ? 'product' : 'service'));
      setMessage(restoredMessage || (contextName ? `I would like more information about ${contextName}.` : ''));
      setIsAcknowledged(draft?.isBuyerAcknowledgementAccepted === true);
      setNotice(null);
      restoredDraftKey.current = draftKey;
    });
    return () => { isActive = false; };
  }, [draftKey, provider, requestedProduct, requestedService]);

  useEffect(() => {
    if (restoredDraftKey.current !== draftKey) return;
    eHubService.saveEnquiryDraft(draftKey, { type, message, isBuyerAcknowledgementAccepted: isAcknowledged });
  }, [draftKey, isAcknowledged, message, type]);

  const contextQuery = requestedProduct ? `?product=${encodeURIComponent(requestedProduct)}` : requestedService ? `?service=${encodeURIComponent(requestedService)}` : '';
  const scrollToForm = () => {
    const { body, columns, form } = layoutOffsets.current;
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, body + columns + form - 12), animated: true }), 60);
  };

  const handleSubmit = async () => {
    if (!profile) {
      router.push(`/(auth)/login?next=${encodeURIComponent(`/ehub/providers/${providerId}${contextQuery}`)}` as Href);
      return;
    }
    if (!provider || !canSubmit) return;
    setIsSubmitting(true);
    setNotice(null);
    try {
      await eHubService.createEnquiry({ providerId: provider.id, type, message: message.trim(), buyerAcknowledgementAccepted: true });
      setMessage('');
      setIsAcknowledged(false);
      eHubService.clearEnquiryDraft(draftKey);
      setNotice({ tone: 'success', text: 'Your enquiry was sent securely. The provider can reply through Ourlime.' });
    } catch (error: unknown) {
      console.error('[EHubProviderProfileScreen.handleSubmit] Error:', error instanceof Error ? error.message : 'Unknown error');
      setNotice({ tone: 'error', text: error instanceof Error && error.message ? error.message : 'Unable to send enquiry.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnquireAboutService = (service: string) => {
    router.setParams({ service, product: undefined });
    scrollToForm();
  };

  const handleShare = () => {
    if (!provider) return;
    const url = `${EHUB_PROVIDER_SHARE_BASE_URL}${encodeURIComponent(provider.id)}`;
    // Only the link: the website's provider page carries the preview title, description and image.
    const content = Platform.OS === 'ios' ? { title: provider.name, url } : { title: provider.name, message: url };
    void Share.share(content).catch((error: unknown) => {
      console.error('[EHubProviderProfileScreen.handleShare] Error:', error instanceof Error ? error.message : 'Share failed');
    });
  };

  const handleOpenBuyerTerms = () => router.push(getEHubTermsRoute('buyer') as Href);

  const header = <>
    <PageHeader title={provider?.name ?? 'Provider'} onBackPress={() => router.back()}
      rightComponent={provider ? <Pressable accessibilityRole="button" accessibilityLabel={`Share ${provider.name}`} onPress={handleShare} hitSlop={8} style={styles.headerButton}><Share2 size={21} color={colors.icon} /></Pressable> : undefined} />
    <EHubSectionNav currentLabel={provider?.name ?? 'Provider'} parentLabel="Discover" onParentPress={() => router.dismissTo('/ehub/discover' as Href)} />
  </>;
  if (resource.isLoading && !provider) {
    return <View style={styles.screen}>{header}<EHubProviderProfileSkeleton /></View>;
  }
  if (!provider) {
    return <View style={styles.screen}>{header}<View style={[styles.body, { width: layout.contentWidth }]}>
      {resource.error ? <EHubNotice tone="error" text={resource.error} actionLabel="Try again" onAction={() => void resource.refresh()} />
        : <EHubEmptyState icon={<Building2 size={44} color={colors.mutedText} />} title="Provider not found" body="This provider is not active on E-Hub." actionLabel="Back to discovery" onAction={() => router.replace('/ehub/discover' as Href)} />}
    </View></View>;
  }

  const tags = [...provider.categories, ...provider.services];
  const place = provider.nationwide ? 'Serves nationwide' : provider.location || provider.serviceAreas.join(', ') || 'Location not provided';
  const productWidth = layout.isTablet && !layout.isWide ? layout.columnWidth(2) - 18 : layout.isWide ? Math.floor((layout.innerWidth - 400 - 36) / 2) - 2 : layout.innerWidth - 36;

  const catalog = <View style={[styles.card, layout.isWide && styles.flex]}>
    {provider.services.length ? <View style={styles.services}>
      <Text style={styles.sectionTitle}>Services offered</Text>
      <Text style={styles.muted}>Choose a service to carry its context into your enquiry.</Text>
      <View style={styles.serviceRow}>{provider.services.map((service) => {
        const isSelected = requestedService === service;
        return <Pressable key={service} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => handleEnquireAboutService(service)} style={[styles.serviceButton, isSelected && styles.serviceButtonActive]}>
          <Text style={[styles.serviceText, isSelected && styles.serviceTextActive]}>Enquire about {service}</Text>
        </Pressable>;
      })}</View>
    </View> : null}
    <Text style={styles.sectionTitle}>E-Hub store catalog</Text>
    {provider.products.length === 0 ? <Text style={styles.muted}>This provider has no currently published E-Hub products.</Text>
      : <View style={styles.productGrid}>{provider.products.map((product) => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`View ${product.title}`} onPress={() => router.push(`/ehub/products/${encodeURIComponent(product.id)}` as Href)} style={[styles.productRow, { width: productWidth }]}>
        <View style={styles.productImage}>{product.imageUrl ? <CachedImage uri={product.imageUrl} style={styles.fill} /> : <Package size={22} color={colors.mutedText} />}</View>
        <View style={styles.flex}><Text numberOfLines={2} style={styles.productTitle}>{product.title}</Text><Text style={styles.productPrice}>{formatEHubPrice(product.price)}</Text></View>
      </Pressable>)}</View>}
    {provider.sellerPolicies || provider.returnPolicy ? <View style={styles.policies}>
      {provider.sellerPolicies ? <Text style={styles.policyText}><Text style={styles.strong}>Seller policies: </Text>{provider.sellerPolicies}</Text> : null}
      {provider.returnPolicy ? <Text style={styles.policyText}><Text style={styles.strong}>Return/refund expectations: </Text>{provider.returnPolicy}</Text> : null}
    </View> : null}
    <Pressable accessibilityRole="link" onPress={handleOpenBuyerTerms} hitSlop={6}><Text style={styles.link}>Buyer terms, safety, and payment limitations</Text></Pressable>
  </View>;

  const enquiryForm = <View onLayout={(event) => { layoutOffsets.current.form = event.nativeEvent.layout.y; }} style={[styles.card, layout.isWide && styles.formWide]}>
    <Text style={styles.sectionTitle}>Send a safe enquiry</Text>
    <Text style={styles.muted}>Your private contact details are not exposed. This is not a quote, booking, contract, or payment.</Text>
    {requestedProduct ? <View style={styles.contextBanner}><Text style={styles.contextLabel}>Product enquiry</Text><Text style={styles.contextName}>{requestedProduct}</Text></View> : null}
    {!requestedProduct && requestedService ? <View style={styles.contextBanner}><Text style={styles.contextLabel}>Service enquiry</Text><Text style={styles.contextName}>{requestedService}</Text></View> : null}
    {isOwnProvider ? <EHubNotice tone="warning" text="This is your business profile. Enquiries from other members appear in your E-Hub inbox." actionLabel="Open inbox" onAction={() => router.push('/ehub/enquiries' as Href)} /> : <>
      <Text style={styles.fieldLabel}>Enquiry type</Text>
      <View style={styles.typeGrid}>{ENQUIRY_TYPES.map((option) => <EHubChip key={option.value} label={option.label} selected={type === option.value} onPress={() => setType(option.value)} />)}</View>
      <Text style={styles.fieldLabel}>Message</Text>
      <TextInput value={message} onChangeText={setMessage} multiline maxLength={MAXIMUM_MESSAGE_LENGTH} textAlignVertical="top" placeholder="Describe what you need without including sensitive information." placeholderTextColor={colors.mutedText} accessibilityLabel="Enquiry message" style={styles.messageInput} />
      <Text style={[styles.hint, trimmedLength > 0 && trimmedLength < MINIMUM_MESSAGE_LENGTH && { color: colors.destructiveText }]}>At least {MINIMUM_MESSAGE_LENGTH} characters · {message.length}/{MAXIMUM_MESSAGE_LENGTH}</Text>
      <View style={styles.acknowledgement}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isAcknowledged }} onPress={() => setIsAcknowledged((current) => !current)} style={styles.acknowledgementRow}>
          <View style={[styles.checkbox, isAcknowledged && styles.checkboxChecked]}>{isAcknowledged ? <Check size={14} color="#ffffff" /> : null}</View>
          <Text style={styles.acknowledgementText}>I understand this independent provider supplies the details and arrangements, availability may change, and E-Hub currently provides no payment, escrow, booking, refund, or delivery guarantee.</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={handleOpenBuyerTerms} hitSlop={6} style={styles.termsLink}><Text style={styles.link}>Read buyer terms</Text></Pressable>
      </View>
      {notice ? <EHubNotice tone={notice.tone} text={notice.text} actionLabel={notice.tone === 'success' ? 'View my enquiries' : undefined} onAction={notice.tone === 'success' ? () => router.push('/ehub/enquiries?mode=sent' as Href) : undefined} /> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: profile ? !canSubmit : false }} onPress={() => void handleSubmit()} disabled={profile ? !canSubmit : false} style={[styles.submit, profile && !canSubmit && styles.submitDisabled]}>
        <Send size={17} color="#ffffff" /><Text style={styles.submitText}>{!profile ? 'Sign in to send an enquiry' : isSubmitting ? 'Sending…' : 'Send enquiry'}</Text>
      </Pressable>
    </>}
  </View>;

  return (
    <View style={styles.screen}>
      {header}
      <KeyboardSafeView style={styles.flex}>
        <EHubScrollView scrollRef={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={resource.isRefreshing} onRefresh={() => void resource.refresh()} tintColor={colors.accent} />} contentContainerStyle={styles.scrollContent}>
          <View onLayout={(event) => { layoutOffsets.current.body = event.nativeEvent.layout.y; }} style={[styles.body, { width: layout.contentWidth }]}>
            <View style={styles.profileCard}>
              <View style={[styles.cover, { height: layout.isTablet ? 200 : 150 }]}>{provider.coverUrl ? <CachedImage uri={provider.coverUrl} style={styles.fill} /> : null}</View>
              <View style={styles.profileBody}>
                <View style={styles.logo}>{provider.logoUrl ? <CachedImage uri={provider.logoUrl} style={styles.fill} accessibilityLabel={`${provider.name} logo`} /> : provider.kind === 'professional' ? <UserRound size={38} color={colors.mutedText} /> : <Building2 size={38} color={colors.mutedText} />}</View>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{provider.name}</Text>
                  {provider.isVerified ? <View style={styles.verifiedBadge}><BadgeCheck size={15} color={colors.successText} /><Text style={styles.verifiedText}>Identity verified</Text></View> : null}
                </View>
                <Text style={styles.description}>{provider.description || 'This provider has not added a description yet.'}</Text>
                <View style={styles.metaList}>
                  <View style={styles.row}><MapPin size={15} color={colors.mutedText} /><Text style={styles.meta}>{place}</Text></View>
                  {provider.businessHours ? <View style={styles.row}><Clock size={15} color={colors.mutedText} /><Text style={styles.meta}>{provider.businessHours}</Text></View> : null}
                  {provider.rating !== null ? <View style={styles.row}><Star size={15} color="#f59e0b" fill="#f59e0b" /><Text style={styles.meta}>{provider.rating.toFixed(1)} from {provider.reviewCount} eligible reviews</Text></View> : null}
                  {provider.websiteUrl ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(/^https?:\/\//i.test(provider.websiteUrl ?? '') ? provider.websiteUrl ?? '' : `https://${provider.websiteUrl}`)} style={styles.row}><Globe size={15} color={colors.accentText} /><Text numberOfLines={1} style={styles.link}>{provider.websiteUrl}</Text></Pressable> : null}
                </View>
                {tags.length ? <View style={styles.tags}>{tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View> : null}
              </View>
            </View>
            <View onLayout={(event) => { layoutOffsets.current.columns = event.nativeEvent.layout.y; }} style={[styles.columns, layout.isWide && styles.columnsWide]}>
              {layout.isWide ? <>{catalog}{enquiryForm}</> : <>{enquiryForm}{catalog}</>}
            </View>
          </View>
        </EHubScrollView>
      </KeyboardSafeView>
    </View>
  );
}

const createStyles = (colors: AppThemeColors, gutter: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 48, alignItems: 'center' },
  body: { maxWidth: '100%', alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 18 },
  profileCard: { overflow: 'hidden', borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cover: { backgroundColor: colors.successSurface, overflow: 'hidden' },
  profileBody: { paddingHorizontal: 20, paddingBottom: 22, gap: 12 },
  logo: { width: 92, height: 92, marginTop: -50, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 26, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.control },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  name: { color: colors.text, fontSize: 26, lineHeight: 31, fontWeight: '900' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.successSurface },
  verifiedText: { color: colors.successText, fontSize: 12, fontWeight: '800' },
  description: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  metaList: { gap: 7 },
  meta: { flexShrink: 1, color: colors.secondaryText, fontSize: 13 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.control },
  tagText: { color: colors.secondaryText, fontSize: 12, fontWeight: '800' },
  columns: { gap: 18 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
  card: { padding: 18, gap: 12, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  formWide: { width: 400 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  services: { gap: 8, paddingBottom: 14, marginBottom: 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  serviceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  serviceButton: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: colors.successSurface },
  serviceButtonActive: { borderColor: '#059669' },
  serviceText: { color: colors.successText, fontSize: 13, fontWeight: '900' },
  serviceTextActive: { color: colors.text },
  contextBanner: { padding: 14, gap: 3, borderRadius: 16, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: colors.successSurface },
  contextLabel: { color: colors.successText, fontSize: 11, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  contextName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  productRow: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  productImage: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 13, backgroundColor: colors.control },
  productTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  productPrice: { marginTop: 3, color: colors.accentText, fontSize: 14, fontWeight: '900' },
  policies: { padding: 14, gap: 8, borderRadius: 16, backgroundColor: colors.control },
  policyText: { color: colors.secondaryText, fontSize: 13, lineHeight: 20 },
  strong: { color: colors.text, fontWeight: '900' },
  link: { flexShrink: 1, color: colors.accentText, fontSize: 13, fontWeight: '900', textDecorationLine: 'underline' },
  fieldLabel: { marginTop: 4, color: colors.text, fontSize: 13, fontWeight: '900' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  messageInput: { minHeight: 140, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15, lineHeight: 21 },
  hint: { marginTop: -4, color: colors.mutedText, fontSize: 12 },
  acknowledgement: { padding: 13, gap: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  acknowledgementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  termsLink: { marginLeft: 33, minHeight: 32, justifyContent: 'center' },
  checkbox: { width: 22, height: 22, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 2, borderColor: colors.mutedText },
  checkboxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  acknowledgementText: { flex: 1, color: colors.secondaryText, fontSize: 12, lineHeight: 18 },
  submit: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: '#059669' },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
});
