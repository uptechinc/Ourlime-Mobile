import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Building2, ChevronRight, Eye, FilePenLine, FileText, Inbox, LayoutDashboard, Lock, Package, Settings, Store, Trash2 } from 'lucide-react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import CustomModal from '@/components/ui/CustomModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useEHubSellerCenter } from '@/lib/hooks/useEHubSellerCenter';
import { getEHubTermsRoute } from '@/lib/services/EHubService';
import type { EHubDraft, EHubPublicationState, EHubSellerProduct } from '@/lib/types/ehubSeller';
import { EHubEmptyState, EHubNotice, useEHubLayout } from '@/components/ehub/EHubParts';
import { SellerButton } from '@/components/ehub/EHubSellerFormParts';
import EHubSellerStorefront from '@/components/ehub/EHubSellerStorefront';
import EHubSellerProducts from '@/components/ehub/EHubSellerProducts';
import EHubSellerDrafts from '@/components/ehub/EHubSellerDrafts';

type SellerSection = 'overview' | 'storefront' | 'products' | 'drafts' | 'settings';
type Confirmation =
  | { kind: 'deleteProduct'; product: EHubSellerProduct }
  | { kind: 'productState'; product: EHubSellerProduct; state: EHubPublicationState }
  | { kind: 'deleteDraft'; draft: EHubDraft; permanent: boolean };

const SECTIONS: SellerSection[] = ['overview', 'storefront', 'products', 'drafts', 'settings'];

function readSection(value: string | undefined): SellerSection {
  return SECTIONS.find((section) => section === value) ?? 'overview';
}

/**
 * The website's Seller Center (/profile/ehub/seller): overview, guided storefront setup with the seller agreements,
 * products (create, edit, publish, unpublish, delete), autosaved drafts with Recently Deleted, and a link to the
 * enquiry inbox. Publishing and deleting ask first; the server repeats every eligibility and ownership check.
 */
export default function EHubSellerCenterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const { colors } = useAppTheme();
  const { profile, loading: profileLoading } = usePageAccess();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors, layout.gutter), [colors, layout.gutter]);
  const center = useEHubSellerCenter(profile?.uid ?? null);
  const [section, setSection] = useState<SellerSection>(readSection(params.section));
  const [productsKey, setProductsKey] = useState(0);
  const [productsStartEditing, setProductsStartEditing] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const { workspace, refresh } = center;
  // Coming back from the business account screen (or anywhere else) reloads eligibility; the first focus is the initial load.
  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current && profile?.uid) void refresh();
    hasFocused.current = true;
  }, [profile?.uid, refresh]));
  const activeDrafts = workspace?.drafts.filter((draft) => draft.status === 'active') ?? [];
  const deletedDrafts = workspace?.drafts.filter((draft) => draft.status === 'deleted') ?? [];
  const publishedProducts = workspace?.products.filter((product) => product.publicationState === 'published') ?? [];

  const handleSectionChange = (nextSection: SellerSection) => {
    if (nextSection === 'products') { setProductsStartEditing(false); setProductsKey((key) => key + 1); }
    setSection(nextSection);
  };

  const handleResumeDraft = (draft: EHubDraft) => {
    center.resumeDraft(draft);
    if (draft.type === 'product') { setProductsStartEditing(true); setProductsKey((key) => key + 1); }
    setSection(draft.type === 'storefront' ? 'storefront' : 'products');
  };

  const handleConfirm = async () => {
    if (!confirmation) return;
    if (confirmation.kind === 'deleteProduct') await center.deleteProduct(confirmation.product);
    else if (confirmation.kind === 'productState') await center.setProductState(confirmation.product, confirmation.state);
    else await center.deleteDraft(confirmation.draft, confirmation.permanent);
    setConfirmation(null);
  };

  const header = <PageHeader title="Seller Center" onBackPress={() => router.back()} />;
  if (!profile) {
    return <View style={styles.screen}>{header}<View style={[styles.body, { width: layout.contentWidth }]}>
      {profileLoading ? <Skeleton height={220} borderRadius={22} /> : <EHubEmptyState icon={<Lock size={38} color={colors.mutedText} />} title="Sign in to grow on E-Hub" body="Set up a storefront, list products and answer enquiries." actionLabel="Sign in" onAction={() => router.push('/(auth)/login')} />}
    </View></View>;
  }

  const navigationItems: { id: SellerSection; label: string; icon: (color: string) => ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: (color) => <LayoutDashboard size={17} color={color} /> },
    { id: 'storefront', label: 'My Storefront', icon: (color) => <Store size={17} color={color} /> },
    { id: 'products', label: 'Products', icon: (color) => <Package size={17} color={color} /> },
    { id: 'drafts', label: 'Drafts', icon: (color) => <FileText size={17} color={color} /> },
    { id: 'settings', label: 'Settings', icon: (color) => <Settings size={17} color={color} /> },
  ];
  const navigation = <ScrollView horizontal={!layout.isWide} scrollEnabled={!layout.isWide} showsHorizontalScrollIndicator={false} style={layout.isWide ? styles.rail : styles.tabsScroll} contentContainerStyle={layout.isWide ? styles.railContent : styles.tabs}>
    {layout.isWide ? <Text style={styles.railLabel}>Seller Center</Text> : null}
    {navigationItems.map((item) => {
      const isSelected = section === item.id;
      return <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: isSelected }} onPress={() => handleSectionChange(item.id)} style={[styles.navItem, isSelected ? styles.navItemActive : null]}>
        {item.icon(isSelected ? '#ffffff' : colors.icon)}<Text style={[styles.navText, isSelected ? styles.navTextActive : null]}>{item.label}</Text>
      </Pressable>;
    })}
    <Pressable accessibilityRole="link" onPress={() => router.push('/ehub/enquiries' as Href)} style={styles.navItem}><Inbox size={17} color={colors.icon} /><Text style={styles.navText}>Enquiries</Text></Pressable>
  </ScrollView>;

  const confirmCopy = confirmation?.kind === 'deleteProduct'
    ? { type: 'danger' as const, title: 'Delete this product?', message: 'This removes the product from your E-Hub catalog. This action cannot be undone.', confirmText: 'Delete product' }
    : confirmation?.kind === 'productState'
      ? confirmation.state === 'published'
        ? { type: 'info' as const, title: 'Publish this product?', message: 'Buyers will see it in the E-Hub catalog and on your storefront.', confirmText: 'Publish' }
        : { type: 'warning' as const, title: 'Unpublish this product?', message: 'It leaves the public catalog. You can publish it again at any time.', confirmText: 'Unpublish' }
      : confirmation?.kind === 'deleteDraft' && confirmation.permanent
        ? { type: 'danger' as const, title: 'Permanently delete draft?', message: 'This draft will be permanently removed and cannot be recovered.', confirmText: 'Delete permanently' }
        : { type: 'warning' as const, title: 'Move draft to Recently Deleted?', message: 'You can restore this draft for 30 days before it is eligible for permanent removal.', confirmText: 'Delete draft' };

  return (
    <View style={styles.screen}>
      {header}
      <KeyboardSafeView style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={center.isRefreshing} onRefresh={() => void center.refresh()} tintColor={colors.accent} />} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.body, { width: layout.contentWidth }, layout.isWide ? styles.bodyWide : null]}>
            {navigation}
            <View style={styles.main}>
              {center.notice ? <EHubNotice tone={center.notice.tone} text={center.notice.text} actionLabel="Dismiss" onAction={() => center.setNotice(null)} /> : null}
              {center.loadError ? <EHubNotice tone="error" text={center.loadError} actionLabel="Try again" onAction={() => void center.refresh()} /> : null}
              {workspace?.eligibility.reason ? <View style={styles.eligibility}>
                <Text style={styles.eligibilityTitle}>Seller eligibility required</Text>
                <Text style={styles.eligibilityText}>{workspace.eligibility.reason}</Text>
                {!workspace.eligibility.hasBusiness && !workspace.eligibility.isRestricted ? <View style={styles.eligibilityAction}>
                  <SellerButton compact label="Set up business account" icon={<Building2 size={16} color="#ffffff" />} onPress={() => router.push('/ehub/business-account' as Href)} />
                </View> : null}
              </View> : null}
              {center.isLoading ? <View style={styles.main}><Skeleton height={120} borderRadius={22} /><Skeleton height={260} borderRadius={22} /></View> : <>
                {section === 'overview' ? <View style={styles.section}>
                  <View style={styles.top}>
                    <View style={styles.flex}>
                      <Text style={styles.eyebrow}>E-Hub Seller Center</Text>
                      <Text style={styles.pageTitle}>Manage your business</Text>
                      <Text style={styles.muted}>Storefront, catalog, drafts, and enquiries in one focused workspace.</Text>
                    </View>
                    {workspace?.store ? <SellerButton compact variant="secondary" label="View public storefront" icon={<Eye size={16} color={colors.text} />} onPress={() => router.push(`/ehub/providers/${encodeURIComponent(workspace.store?.businessId ?? '')}` as Href)} /> : null}
                  </View>
                  <View style={[styles.metrics, layout.isTablet ? styles.metricsRow : null]}>
                    <Metric styles={styles} icon={<Package size={20} color={colors.accentText} />} value={String(publishedProducts.length)} label="Published" />
                    <Metric styles={styles} icon={<FilePenLine size={20} color={colors.accentText} />} value={String(activeDrafts.length)} label="Drafts" />
                    <Metric styles={styles} icon={<Inbox size={20} color={colors.accentText} />} value="Open inbox" label="Enquiries" onPress={() => router.push('/ehub/enquiries' as Href)} />
                  </View>
                  <Text style={styles.subTitle}>Manage your business</Text>
                  <View style={styles.destinations}>
                    <Destination styles={styles} colors={colors} icon={<Store size={20} color={colors.accentText} />} title="My Storefront" description={workspace?.store ? 'Edit business information and branding' : 'Set up your storefront to start selling'} onPress={() => handleSectionChange('storefront')} />
                    <Destination styles={styles} colors={colors} icon={<Package size={20} color={colors.accentText} />} title="Manage Products" description="Add, edit, and organize your catalog" onPress={() => handleSectionChange('products')} />
                    <Destination styles={styles} colors={colors} icon={<FileText size={20} color={colors.accentText} />} title="Saved Drafts" description="Continue unfinished storefronts or products" onPress={() => handleSectionChange('drafts')} />
                    <Destination styles={styles} colors={colors} icon={<Trash2 size={20} color={colors.accentText} />} title="Recently Deleted" description={`${deletedDrafts.length} recoverable draft${deletedDrafts.length === 1 ? '' : 's'}`} onPress={() => handleSectionChange('drafts')} />
                  </View>
                </View> : null}
                {section === 'storefront' ? <EHubSellerStorefront center={center} isTablet={layout.isTablet} onPublished={() => setSection('overview')} /> : null}
                {section === 'products' ? <EHubSellerProducts key={productsKey} center={center} isTablet={layout.isTablet} startEditing={productsStartEditing}
                  onPreview={(productId) => router.push(`/ehub/products/${encodeURIComponent(productId)}` as Href)}
                  onRequestStateChange={(product, state) => setConfirmation({ kind: 'productState', product, state })}
                  onRequestDelete={(product) => setConfirmation({ kind: 'deleteProduct', product })} /> : null}
                {section === 'drafts' ? <EHubSellerDrafts activeDrafts={activeDrafts} deletedDrafts={deletedDrafts} isWorking={center.isWorking} onResume={handleResumeDraft}
                  onRequestDelete={(draft, permanent) => setConfirmation({ kind: 'deleteDraft', draft, permanent })} onRestore={(draft) => void center.restoreDraft(draft)} /> : null}
                {section === 'settings' ? <View style={styles.card}>
                  <Text style={styles.cardTitle}>Seller settings</Text>
                  <Text style={styles.muted}>Seller eligibility, identity verification, and business ownership remain managed by your Ourlime account.</Text>
                  <View style={styles.buttonRow}>
                    <SellerButton label="Business account" icon={<Building2 size={17} color="#ffffff" />} onPress={() => router.push('/ehub/business-account' as Href)} />
                    <SellerButton label="Seller terms" variant="secondary" onPress={() => router.push(getEHubTermsRoute('seller') as Href)} />
                  </View>
                </View> : null}
              </>}
            </View>
          </View>
        </ScrollView>
      </KeyboardSafeView>
      <CustomModal visible={confirmation !== null} type={confirmCopy.type} title={confirmCopy.title} message={confirmCopy.message} confirmText={confirmCopy.confirmText} cancelText="Cancel"
        isLoading={center.isWorking} onConfirm={() => void handleConfirm()} onCancel={() => setConfirmation(null)} onClose={() => { if (!center.isWorking) setConfirmation(null); }} />
    </View>
  );
}

type SectionStyles = ReturnType<typeof createStyles>;

function Metric({ styles, icon, value, label, onPress }: { styles: SectionStyles; icon: ReactNode; value: string; label: string; onPress?: () => void }) {
  const content = <>{icon}<Text style={styles.metricValue}>{value}</Text><Text style={styles.small}>{label}</Text></>;
  return onPress ? <Pressable accessibilityRole="link" onPress={onPress} style={styles.metric}>{content}</Pressable> : <View style={styles.metric}>{content}</View>;
}

function Destination({ styles, colors, icon, title, description, onPress }: { styles: SectionStyles; colors: AppThemeColors; icon: ReactNode; title: string; description: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.destination}>
    {icon}
    <View style={styles.flex}><Text style={styles.destinationTitle}>{title}</Text><Text style={styles.small}>{description}</Text></View>
    <ChevronRight size={19} color={colors.mutedText} />
  </Pressable>;
}

const createStyles = (colors: AppThemeColors, gutter: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  scrollContent: { paddingBottom: 56, alignItems: 'center' },
  body: { alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 16 },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
  main: { flex: 1, minWidth: 0, gap: 16 },
  tabsScroll: { flexGrow: 0, marginHorizontal: -gutter },
  tabs: { paddingHorizontal: gutter, gap: 8 },
  rail: { width: 220, flexGrow: 0, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  railContent: { padding: 10, gap: 4 },
  railLabel: { paddingHorizontal: 10, paddingVertical: 8, color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  navItem: { minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  navItemActive: { backgroundColor: '#059669', borderColor: '#059669' },
  navText: { color: colors.secondaryText, fontSize: 14, fontWeight: '800' },
  navTextActive: { color: '#ffffff' },
  eligibility: { padding: 16, gap: 4, borderRadius: 18, borderWidth: 1, borderColor: colors.warningText, backgroundColor: colors.warningSurface },
  eligibilityTitle: { color: colors.warningText, fontSize: 15, fontWeight: '900' },
  eligibilityText: { color: colors.warningText, fontSize: 14, lineHeight: 20 },
  eligibilityAction: { marginTop: 8, flexDirection: 'row' },
  section: { gap: 16 },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  pageTitle: { marginTop: 3, color: colors.text, fontSize: 27, fontWeight: '900' },
  subTitle: { marginTop: 6, color: colors.text, fontSize: 18, fontWeight: '900' },
  muted: { marginTop: 4, color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  small: { color: colors.mutedText, fontSize: 13 },
  metrics: { gap: 10 },
  metricsRow: { flexDirection: 'row' },
  metric: { flex: 1, padding: 16, gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  metricValue: { marginTop: 4, color: colors.text, fontSize: 22, fontWeight: '900' },
  destinations: { gap: 10 },
  destination: { minHeight: 76, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  destinationTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  card: { padding: 20, gap: 6, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  buttonRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
