import { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowRight, BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, Inbox, Package, Search, ShieldCheck, ShoppingBag, Store, X } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubCatalog, useEHubProviders } from '@/lib/hooks/useEHub';
import { EHUB_BUYER_TERMS_URL } from '@/lib/services/EHubService';
import { EHubChip, EHubEmptyState, EHubGridSkeleton, EHubLinkButton, EHubNotice, EHubProductCard, EHubProviderCard, EHubSectionHeading, useEHubLayout } from '@/components/ehub/EHubParts';
import type { EHubProviderKind } from '@/lib/types/ehubDiscovery';

type ProductSort = 'featured' | 'price-low' | 'price-high' | 'name';
type HeroSlide = { eyebrow: string; title: string; description: string; imageUrl: string; actionLabel: string; kind?: EHubProviderKind };

// Same slides, categories and copy as the website's /ehub. Hero actions open discovery: programmatic scrolling
// does not work in this app (NativeWind drops ScrollView refs).
const HERO_SLIDES: HeroSlide[] = [
  { eyebrow: 'Local storefronts', title: 'Find products from businesses across Trinidad & Tobago.', description: 'Browse published catalogs, compare real product details, and contact the seller before you decide.', imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=900&fit=crop&auto=format', actionLabel: 'Browse storefronts', kind: 'business' },
  { eyebrow: 'Professional services', title: 'Discover local talent for the work you need done.', description: 'Review active profiles and service areas before sending an enquiry.', imageUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&h=900&fit=crop&auto=format', actionLabel: 'Find professionals', kind: 'professional' },
  { eyebrow: 'Local businesses', title: 'Explore storefronts and professionals near you.', description: 'Filter active profiles by category, location and type, then send a safe enquiry.', imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=900&fit=crop&auto=format', actionLabel: 'Open discovery' },
];

const CATEGORY_IMAGES: { label: string; imageUrl: string }[] = [
  { label: 'Electronics', imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&h=450&fit=crop&auto=format' },
  { label: 'Fashion', imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=450&fit=crop&auto=format' },
  { label: 'Home & Garden', imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=450&fit=crop&auto=format' },
  { label: 'Beauty', imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=450&fit=crop&auto=format' },
  { label: 'Food', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=450&fit=crop&auto=format' },
  { label: 'Books', imageUrl: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=600&h=450&fit=crop&auto=format' },
];

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
  { value: 'name', label: 'Name' },
];

const STEPS = [
  { icon: Search, title: '1. Discover', text: 'Search real products, storefronts, and professional profiles.' },
  { icon: ShieldCheck, title: '2. Review', text: 'Check availability, service areas, profile details, and listed policies.' },
  { icon: ShoppingBag, title: '3. Enquire', text: 'Contact the provider to confirm next steps.' },
];

export default function EHubScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors, layout.gutter, layout.isTablet), [colors, layout.gutter, layout.isTablet]);
  const catalog = useEHubCatalog();
  const providers = useEHubProviders();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sort, setSort] = useState<ProductSort>('featured');
  const [heroIndex, setHeroIndex] = useState(0);

  const products = useMemo(() => catalog.data ?? [], [catalog.data]);
  const providerList = useMemo(() => providers.data ?? [], [providers.data]);
  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(), [products]);
  const displayedCategories = useMemo(() => [...new Set([...categories, ...CATEGORY_IMAGES.map((category) => category.label)])].slice(0, 6), [categories]);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleProducts = useMemo(() => products
    .filter((product) => selectedCategory === 'All' || product.category === selectedCategory)
    .filter((product) => !normalizedSearch || [product.title, product.category, product.storeName, product.description].some((value) => value.toLowerCase().includes(normalizedSearch)))
    .map((product, index) => ({ product, index }))
    .sort((left, right) => {
      const leftPrice = left.product.salePrice ?? left.product.price;
      const rightPrice = right.product.salePrice ?? right.product.price;
      if (sort === 'price-low') return leftPrice - rightPrice;
      if (sort === 'price-high') return rightPrice - leftPrice;
      if (sort === 'name') return left.product.title.localeCompare(right.product.title);
      return left.index - right.index;
    })
    .map(({ product }) => product), [normalizedSearch, products, selectedCategory, sort]);
  const matchingProviders = useMemo(() => !normalizedSearch ? [] : providerList.filter((provider) => [provider.name, provider.description, provider.location, ...provider.categories, ...provider.services].some((value) => value.toLowerCase().includes(normalizedSearch))).slice(0, 5), [normalizedSearch, providerList]);
  const storefronts = providerList.filter((provider) => provider.kind === 'business').slice(0, 4);
  const professionals = providerList.filter((provider) => provider.kind === 'professional').slice(0, 4);
  const hero = HERO_SLIDES[heroIndex];
  const isRefreshing = catalog.isRefreshing || providers.isRefreshing;

  const handleOpenProduct = (productId: string) => router.push(`/ehub/products/${encodeURIComponent(productId)}` as Href);
  const handleOpenProvider = (providerId: string) => router.push(`/ehub/providers/${encodeURIComponent(providerId)}` as Href);
  const handleOpenDiscover = (kind?: EHubProviderKind) => router.push((kind ? `/ehub/discover?kind=${kind}` : '/ehub/discover') as Href);
  // A category with no published products yet filters by search text instead, so the list shows the empty state.
  const handleCategorySelect = (category: string) => {
    if (categories.includes(category)) { setSelectedCategory(category); return; }
    setSelectedCategory('All');
    setSearch(category);
  };
  const handleRefresh = () => { void catalog.refresh(); void providers.refresh(); };
  const handleResetFilters = () => { setSearch(''); setSelectedCategory('All'); };

  return (
    <View style={styles.screen}>
      <PageHeader title="E-Hub" onBackPress={() => router.back()} rightComponent={<Pressable accessibilityRole="button" accessibilityLabel="Open E-Hub enquiries" onPress={() => router.push('/ehub/enquiries?mode=sent' as Href)} hitSlop={8} style={styles.headerButton}><Inbox size={22} color={colors.icon} /></Pressable>} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.accent} />} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <CachedImage key={hero.imageUrl} uri={hero.imageUrl} style={styles.heroImage} />
          <View style={styles.heroShade} />
          <View style={[styles.heroContent, { width: layout.contentWidth }]}>
            <Text style={styles.heroEyebrow}>{hero.eyebrow}</Text>
            <Text style={styles.heroTitle}>{hero.title}</Text>
            <Text style={styles.heroBody}>{hero.description}</Text>
            <View style={styles.heroActions}>
              <Pressable accessibilityRole="button" onPress={() => handleOpenDiscover(hero.kind)} style={styles.heroPrimary}><Text style={styles.heroPrimaryText}>{hero.actionLabel}</Text><ArrowRight size={16} color="#020617" /></Pressable>
              <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(EHUB_BUYER_TERMS_URL)} style={styles.heroSecondary}><Text style={styles.heroSecondaryText}>Buyer safety</Text></Pressable>
            </View>
          </View>
          <View style={styles.heroDots}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous slide" onPress={() => setHeroIndex((heroIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)} hitSlop={6} style={styles.heroArrow}><ChevronLeft size={18} color="#ffffff" /></Pressable>
            {HERO_SLIDES.map((slide, index) => <Pressable key={slide.eyebrow} accessibilityRole="button" accessibilityLabel={`Show slide ${index + 1}`} onPress={() => setHeroIndex(index)} hitSlop={8} style={[styles.dot, index === heroIndex && styles.dotActive]} />)}
            <Pressable accessibilityRole="button" accessibilityLabel="Next slide" onPress={() => setHeroIndex((heroIndex + 1) % HERO_SLIDES.length)} hitSlop={6} style={styles.heroArrow}><ChevronRight size={18} color="#ffffff" /></Pressable>
          </View>
        </View>

        <View style={[styles.body, { width: layout.contentWidth }]}>
          <View style={styles.searchBox}>
            <Search size={19} color={colors.mutedText} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search E-Hub" placeholderTextColor={colors.mutedText} returnKeyType="search" accessibilityLabel="Search E-Hub products, storefronts, and professionals" style={styles.searchInput} />
            {search ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} hitSlop={8}><X size={18} color={colors.mutedText} /></Pressable> : null}
          </View>

          {normalizedSearch ? <View style={styles.searchResults}>
            <EHubSectionHeading eyebrow="Search" title={`Results for “${search.trim()}”`} description={`${visibleProducts.length} products and ${matchingProviders.length} providers match.`} />
            {matchingProviders.map((provider) => <Pressable key={provider.id} accessibilityRole="button" onPress={() => handleOpenProvider(provider.id)} style={styles.searchProvider}>
              <View style={styles.searchLogo}>{provider.logoUrl ? <CachedImage uri={provider.logoUrl} style={styles.fill} /> : <Building2 size={20} color={colors.mutedText} />}</View>
              <View style={styles.flex}><Text numberOfLines={1} style={styles.searchProviderName}>{provider.name}</Text><Text style={styles.muted}>{provider.kind === 'business' ? 'Storefront' : 'Professional'}</Text></View>
              <ArrowRight size={16} color={colors.mutedText} />
            </Pressable>)}
          </View> : null}

          <View style={styles.section}>
            <EHubSectionHeading eyebrow="Explore" title="Shop by category" description="Choose a category to filter published products from active E-Hub storefronts." />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {displayedCategories.map((category) => {
                const imageUrl = CATEGORY_IMAGES.find((item) => item.label === category)?.imageUrl ?? CATEGORY_IMAGES[0].imageUrl;
                return <Pressable key={category} accessibilityRole="button" accessibilityLabel={`Show ${category}`} onPress={() => handleCategorySelect(category)} style={styles.categoryTile}>
                  <CachedImage uri={imageUrl} style={styles.fill} />
                  <View style={styles.categoryShade} />
                  <Text numberOfLines={2} style={styles.categoryLabel}>{category}</Text>
                </Pressable>;
              })}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <EHubSectionHeading eyebrow="Current catalog" title="Featured products" description="Real published products with seller-provided pricing and availability. Prices are shown in TTD." />
            <View style={styles.filterPanel}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {['All', ...categories].map((category) => <EHubChip key={category} label={category} selected={selectedCategory === category} onPress={() => setSelectedCategory(category)} />)}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Text style={styles.sortLabel}>Sort</Text>
                {SORT_OPTIONS.map((option) => <EHubChip key={option.value} label={option.label} selected={sort === option.value} onPress={() => setSort(option.value)} />)}
              </ScrollView>
            </View>
            {catalog.error ? <EHubNotice tone="warning" text={catalog.error} actionLabel="Try again" onAction={() => void catalog.refresh()} /> : null}
            {catalog.isLoading && !catalog.data ? <EHubGridSkeleton count={layout.isTablet ? 6 : 4} width={layout.productWidth} height={layout.productWidth + 96} />
              : visibleProducts.length ? <View style={[styles.grid, { gap: layout.gap }]}>{visibleProducts.map((product) => <EHubProductCard key={product.id} product={product} width={layout.productWidth} onOpen={handleOpenProduct} />)}</View>
                : !catalog.error ? <EHubEmptyState icon={<Package size={40} color={colors.mutedText} />} title="No matching products" body="Try another search or category. Only real published listings appear here." actionLabel="Reset filters" onAction={handleResetFilters} /> : null}
          </View>

          <View style={styles.section}>
            <EHubSectionHeading eyebrow="Local businesses" title="Featured local storefronts" description="Explore active E-Hub business profiles and their published catalog information." action={<EHubLinkButton label="All" onPress={() => handleOpenDiscover('business')} />} />
            {providers.error ? <EHubNotice tone="warning" text={providers.error} actionLabel="Try again" onAction={() => void providers.refresh()} /> : null}
            {providers.isLoading && !providers.data ? <EHubGridSkeleton count={layout.isTablet ? 2 : 1} width={layout.providerWidth} height={260} />
              : storefronts.length ? <View style={[styles.grid, { gap: layout.gap }]}>{storefronts.map((provider) => <EHubProviderCard key={provider.id} provider={provider} width={layout.providerWidth} onOpen={handleOpenProvider} />)}</View>
                : !providers.error ? <EHubEmptyState icon={<Store size={36} color={colors.mutedText} />} title="No active storefronts are available yet." /> : null}
          </View>

          <View style={styles.section}>
            <EHubSectionHeading eyebrow="Services" title="Discover professionals" description="Review real service profiles and send an enquiry. Online booking and payments are not currently available." action={<EHubLinkButton label="Directory" onPress={() => handleOpenDiscover('professional')} />} />
            {providers.isLoading && !providers.data ? <EHubGridSkeleton count={layout.isTablet ? 2 : 1} width={layout.providerWidth} height={260} />
              : professionals.length ? <View style={[styles.grid, { gap: layout.gap }]}>{professionals.map((provider) => <EHubProviderCard key={provider.id} provider={provider} width={layout.providerWidth} onOpen={handleOpenProvider} />)}</View>
                : !providers.error ? <EHubEmptyState icon={<BriefcaseBusiness size={36} color={colors.mutedText} />} title="No active professional profiles are available yet." /> : null}
          </View>

          <View style={styles.howItWorks}>
            <Text style={styles.howEyebrow}>Simple and transparent</Text>
            <Text style={styles.howTitle}>How E-Hub works</Text>
            <Text style={styles.howBody}>Discover catalogs and services, review the details, then contact providers directly.</Text>
            <View style={[styles.steps, layout.isTablet && styles.stepsWide]}>
              {STEPS.map((step) => <View key={step.title} style={[styles.step, layout.isTablet && styles.flex]}><step.icon size={22} color="#bef264" /><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.howBody}>{step.text}</Text></View>)}
            </View>
          </View>

          <View style={styles.safetyCard}>
            <ShieldCheck size={32} color={colors.warningText} />
            <Text style={[styles.safetyTitle, { color: colors.warningText }]}>Buyer safety</Text>
            <Text style={[styles.safetyBody, { color: colors.warningText }]}>E-Hub does not process payments, hold escrow, guarantee delivery, manage refunds, or guarantee bookings. Confirm identity, price, availability, fulfilment, and policies first.</Text>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(EHUB_BUYER_TERMS_URL)} style={styles.safetyButton}><Text style={styles.safetyButtonText}>Read buyer terms</Text><ArrowRight size={15} color="#ffffff" /></Pressable>
          </View>

          <Pressable accessibilityRole="button" onPress={() => router.push('/ehub/enquiries?mode=sent' as Href)} style={styles.inboxCard}>
            <Inbox size={24} color={colors.accentText} />
            <View style={styles.flex}><Text style={styles.inboxTitle}>Your enquiries</Text><Text style={styles.muted}>See enquiries you sent and replies from providers</Text></View>
            <ArrowRight size={19} color={colors.mutedText} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppThemeColors, gutter: number, isTablet: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 48, alignItems: 'center' },
  hero: { width: '100%', minHeight: isTablet ? 440 : 400, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617', overflow: 'hidden' },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.55 },
  heroShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2,6,23,0.55)' },
  heroContent: { paddingHorizontal: gutter + 6, paddingTop: 40, paddingBottom: 76, maxWidth: '100%' },
  heroEyebrow: { color: '#bef264', fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  heroTitle: { marginTop: 12, maxWidth: 620, color: '#ffffff', fontSize: isTablet ? 44 : 32, lineHeight: isTablet ? 48 : 36, fontWeight: '900' },
  heroBody: { marginTop: 14, maxWidth: 520, color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 22 },
  heroActions: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  heroPrimary: { minHeight: 46, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: '#a3e635' },
  heroPrimaryText: { color: '#020617', fontSize: 14, fontWeight: '900' },
  heroSecondary: { minHeight: 46, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  heroSecondaryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  heroDots: { position: 'absolute', bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 5, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.5)' },
  heroArrow: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 26, backgroundColor: '#a3e635' },
  body: { maxWidth: '100%', paddingHorizontal: gutter, paddingTop: 18, gap: 34 },
  searchBox: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, minHeight: 48, color: colors.text, fontSize: 15 },
  searchResults: { marginTop: -16, padding: 14, gap: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface },
  searchProvider: { minHeight: 60, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, backgroundColor: colors.surface },
  searchLogo: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12, backgroundColor: colors.control },
  searchProviderName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  section: { gap: 14 },
  categoryRow: { gap: 10 },
  categoryTile: { width: isTablet ? 160 : 136, height: isTablet ? 170 : 150, overflow: 'hidden', borderRadius: 18, backgroundColor: colors.control },
  categoryShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%', backgroundColor: 'rgba(2,6,23,0.55)' },
  categoryLabel: { position: 'absolute', left: 12, right: 12, bottom: 12, color: '#ffffff', fontSize: 14, fontWeight: '900' },
  filterPanel: { padding: 10, gap: 8, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipRow: { gap: 8, alignItems: 'center' },
  sortLabel: { color: colors.mutedText, fontSize: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  howItWorks: { padding: isTablet ? 30 : 22, gap: 6, borderRadius: 26, backgroundColor: '#020617' },
  howEyebrow: { color: '#bef264', fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  howTitle: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
  howBody: { color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 20 },
  steps: { marginTop: 12, gap: 10 },
  stepsWide: { flexDirection: 'row' },
  step: { padding: 16, gap: 8, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' },
  stepTitle: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  safetyCard: { padding: 22, gap: 10, borderRadius: 24, borderWidth: 1, borderColor: '#fcd34d', backgroundColor: colors.warningSurface },
  safetyTitle: { fontSize: 22, fontWeight: '900' },
  safetyBody: { fontSize: 13, lineHeight: 20 },
  safetyButton: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 13, backgroundColor: '#451a03' },
  safetyButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  inboxCard: { minHeight: 76, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  inboxTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
});
