import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Building2, Lock, Save, Star, Store } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useBusinessAccount } from '@/lib/hooks/useBusinessAccount';
import { businessAccountService } from '@/lib/services/BusinessAccountService';
import type { BusinessAccountForm } from '@/lib/types/businessAccount';
import { EHubEmptyState, EHubNotice, useEHubLayout } from '@/components/ehub/EHubParts';
import { SellerButton, SellerChipField, SellerTextField } from '@/components/ehub/EHubSellerFormParts';
import { BusinessAccountSkeleton } from '@/components/ehub/EHubSkeletons';

/**
 * The website's /profile/business-account: request a business account, then edit its name, description,
 * established date, location, contact details and categories. Seller Center needs an active business account.
 */
export default function BusinessAccountScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile, loading: profileLoading } = usePageAccess();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors, layout.gutter), [colors, layout.gutter]);
  const business = useBusinessAccount(profile?.uid ?? null);
  const [requestedName, setRequestedName] = useState('');
  const [form, setForm] = useState<BusinessAccountForm | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  // A category typed but not yet added with Add; it counts as a change and is added when saving.
  const [pendingCategory, setPendingCategory] = useState('');
  const [chipFieldKey, setChipFieldKey] = useState(0);
  const savedForm = useMemo(() => business.account ? businessAccountService.toForm(business.account) : null, [business.account]);

  useEffect(() => { setForm(savedForm); }, [savedForm]);

  const isDirty = form !== null && (JSON.stringify(form) !== JSON.stringify(savedForm) || pendingCategory.trim().length > 0);
  const isNameValid = (form?.name.trim().length ?? 0) >= 2;
  const updateForm = (updates: Partial<BusinessAccountForm>) => { setSavedNotice(null); setForm((current) => current ? { ...current, ...updates } : current); };
  const updateContact = (updates: Partial<BusinessAccountForm['contact']>) => { setSavedNotice(null); setForm((current) => current ? { ...current, contact: { ...current.contact, ...updates } } : current); };

  const handleRequest = async () => {
    if (await business.requestAccount(requestedName)) setSavedNotice('Business account created. Add your details below.');
  };
  const handleSave = async () => {
    if (!form) return;
    const category = pendingCategory.trim();
    const categories = category && !form.categories.some((item) => item.toLowerCase() === category.toLowerCase()) ? [...form.categories, category].slice(0, 30) : form.categories;
    if (await business.saveAccount({ ...form, categories })) {
      setPendingCategory('');
      setChipFieldKey((key) => key + 1);
      setSavedNotice('Business account saved.');
    }
  };

  const header = <PageHeader title="Business account" onBackPress={() => router.back()} />;
  if (!profile) {
    return <View style={styles.screen}>{header}<View style={[styles.body, { width: layout.contentWidth }]}>
      {profileLoading ? <BusinessAccountSkeleton /> : <EHubEmptyState icon={<Lock size={38} color={colors.mutedText} />} title="Sign in to manage your business" actionLabel="Sign in" onAction={() => router.push('/(auth)/login')} />}
    </View></View>;
  }

  const account = business.account;
  const twoColumns = layout.isTablet ? styles.row : null;
  return (
    <View style={styles.screen}>
      {header}
      <KeyboardSafeView style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={business.isRefreshing} onRefresh={() => void business.refresh()} tintColor={colors.accent} />} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.body, { width: layout.contentWidth }]}>
            {business.error ? <EHubNotice tone="error" text={business.error} actionLabel={account ? undefined : 'Try again'} onAction={account ? undefined : () => void business.refresh()} /> : null}
            {savedNotice ? <EHubNotice tone="success" text={savedNotice} /> : null}
            {business.isLoading ? <BusinessAccountSkeleton />
              : !account ? (business.error ? null : <View style={styles.card}>
                <View style={styles.iconCircle}><Building2 size={30} color={colors.accentText} /></View>
                <Text style={styles.title}>Upgrade to Business Account</Text>
                <Text style={styles.muted}>Get access to exclusive business features and grow your presence on our platform. A business account is required to open an E-Hub storefront.</Text>
                <SellerTextField label="Business name" placeholder="New Business" maxLength={200} value={requestedName} onChangeText={setRequestedName} hint="You can change this and add the rest of your details afterwards." />
                <SellerButton label="Request Business Account" isLoading={business.isWorking} onPress={() => void handleRequest()} />
              </View>)
              : form ? <>
                <View style={styles.card}>
                  <Text style={styles.eyebrow}>Business account</Text>
                  <Text style={styles.title}>{account.profile.name || 'Your business'}</Text>
                  {/* The website's four business metrics, two per row. */}
                  <View style={styles.stats}>
                    <Stat styles={styles} value={String(account.metrics.totalProducts)} label={account.metrics.totalProducts === 1 ? 'Total Product' : 'Total Products'} />
                    <Stat styles={styles} value={String(account.metrics.totalSales)} label="Total Sales" />
                    <Stat styles={styles} value={String(account.metrics.avgRating)} label="Average Rating" icon={<Star size={14} color={colors.warningText} />} />
                    <Stat styles={styles} value={String(account.metrics.responseRate)} label="Response Rate" />
                  </View>
                  <SellerButton variant="secondary" label="Open Seller Center" icon={<Store size={17} color={colors.text} />} onPress={() => router.push('/ehub/seller' as Href)} />
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Business details</Text>
                  <SellerTextField label="Business name" required maxLength={200} value={form.name} onChangeText={(name) => updateForm({ name })} />
                  <SellerTextField label="Description" multiline maxLength={3000} value={form.description} onChangeText={(description) => updateForm({ description })} />
                  <View style={[styles.grid, twoColumns]}>
                    <View style={styles.flex}><SellerTextField label="Established" placeholder="2018" maxLength={200} value={form.established} onChangeText={(established) => updateForm({ established })} /></View>
                    <View style={styles.flex}><SellerTextField label="Location" placeholder="Port of Spain" maxLength={200} value={form.location} onChangeText={(location) => updateForm({ location })} /></View>
                  </View>
                  <Text style={styles.cardTitle}>Contact</Text>
                  <View style={[styles.grid, twoColumns]}>
                    <View style={styles.flex}><SellerTextField label="Email" maxLength={320} value={form.contact.email} onChangeText={(email) => updateContact({ email })} /></View>
                    <View style={styles.flex}><SellerTextField label="Phone" maxLength={50} value={form.contact.phone} onChangeText={(phone) => updateContact({ phone })} /></View>
                  </View>
                  <SellerTextField label="Website" placeholder="https://" maxLength={1000} value={form.contact.website} onChangeText={(website) => updateContact({ website })} />
                  <SellerChipField key={chipFieldKey} label="Categories" values={form.categories} onDraftChange={(draft) => { setSavedNotice(null); setPendingCategory(draft); }} onChange={(categories) => updateForm({ categories: categories.slice(0, 30) })} placeholder="Add a category" />
                  <SellerButton label={business.isWorking ? 'Saving…' : 'Save changes'} icon={<Save size={17} color="#ffffff" />} isLoading={business.isWorking} disabled={!isDirty || !isNameValid} onPress={() => void handleSave()} />
                </View>
              </> : null}
          </View>
        </ScrollView>
      </KeyboardSafeView>
    </View>
  );
}

function Stat({ styles, value, label, icon }: { styles: ReturnType<typeof createStyles>; value: string; label: string; icon?: ReactNode }) {
  return <View style={styles.stat}><View style={styles.statValueRow}>{icon}<Text style={styles.statValue}>{value}</Text></View><Text style={styles.small}>{label}</Text></View>;
}

const createStyles = (colors: AppThemeColors, gutter: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  scrollContent: { paddingBottom: 56, alignItems: 'center' },
  body: { maxWidth: 820, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 16 },
  card: { padding: 20, gap: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconCircle: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 30, backgroundColor: colors.successSurface },
  eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: -12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  small: { color: colors.mutedText, fontSize: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '40%', minWidth: 120, padding: 12, gap: 2, borderRadius: 16, backgroundColor: colors.control },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  grid: { gap: 16 },
  row: { flexDirection: 'row' },
});
