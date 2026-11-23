import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ArrowRight, Building2, ChevronDown, ChevronLeft, ChevronRight, Inbox, Package, Search, ShieldCheck, ShoppingBag, Store, Truck, Wrench, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubCatalog, useEHubProviders } from '@/lib/hooks/useEHub';
import { useEHubCommerce } from '@/lib/hooks/useEHubCommerce';
import { getEHubTermsRoute } from '@/lib/services/EHubService';
import { getEHubCurrentPrice } from '@/lib/services/EHubCommerceService';
import { EHubChip, EHubEmptyState, EHubLinkButton, EHubNotice, EHubProductCard, EHubProviderCard, EHubRecruitPanel, EHubSectionHeading, useEHubLayout } from '@/components/ehub/EHubParts';
import EHubSectionNav from '@/components/ehub/EHubSectionNav';
import { EHubCartSheet, EHubComparePanel, EHubHeaderActions } from '@/components/ehub/EHubCommerceParts';
import { EHubScrollView, useEHubSectionScroll } from '@/components/ehub/EHubScrollView';
import { EHubProductGridSkeleton, EHubProviderGridSkeleton } from '@/components/ehub/EHubSkeletons';

type ProductSort = 'catalog' | 'price-low' | 'price-high' | 'name';
type HomeSection = 'products' | 'saved' | 'professionals';
type HomeTarget = { section: HomeSection } | { route: string };
type HeroSlide = { eyebrow: string; title: string; description: string; imageUrl: string; actionLabel: string; target: HomeTarget };

const HERO_ROTATION_MS = 6_000;

// Same slides, paths, copy and links as the website's /ehub (components/ehub/EHubHomePageContent.tsx). The website's
// #anchors scroll to the section here; its /profile/ehub pages are the app's /ehub/seller and /ehub/enquiries.
const HERO_SLIDES: HeroSlide[] = [
  { eyebrow: 'Local storefronts', title: 'Find products from businesses across Trinidad & Tobago.', description: 'Browse published catalogs, compare real product details, and contact the seller before you decide.', imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=900&fit=crop&auto=format', actionLabel: 'Browse products', target: { section: 'products' } },
  { eyebrow: 'Professional services', title: 'Discover local talent for the work you need done.', description: 'Review active profiles and service areas before sending an enquiry.', imageUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&h=900&fit=crop&auto=format', actionLabel: 'Find professionals', target: { section: 'professionals' } },
  { eyebrow: 'Build your presence', title: 'Give your business a polished home on Ourlime.', description: 'Eligible businesses can manage a storefront, publish products, and receive enquiries.', imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=900&fit=crop&auto=format', actionLabel: 'Open seller workspace', target: { route: '/ehub/seller' } },
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
  { value: 'catalog', label: 'Catalog order' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
  { value: 'name', label: 'Name' },
];

const STEPS = [
  { icon: Search, title: '1. Discover', text: 'Search real products, storefronts, and professional profiles.' },
  { icon: ShieldCheck, title: '2. Review', text: 'Check availability, service areas, profile details, and listed policies.' },
  { icon: ShoppingBag, title: '3. Enquire', text: 'Save products or contact the provider to confirm next steps.' },
];

// Buyer safety is the last answer rather than a separate card: the same message was shown three times on the page.
const FAQ_ITEMS = [
  { question: 'Can I pay or book through EHub?', answer: 'Not yet. EHub currently supports discovery, catalogs, preparation carts, favorites, comparisons, and enquiries. Confirm arrangements directly with the provider.' },
  { question: 'Is every provider verified?', answer: 'No. A verified badge appears only when backend data confirms it. Always review the available profile information before making arrangements.' },
  { question: 'How do I sell on EHub?', answer: 'Open the seller workspace to complete eligibility checks, agreements, storefront setup, and product publishing.' },
  { question: 'How do I stay safe?', answer: 'EHub does not process payments, hold escrow, guarantee delivery, manage refunds, or guarantee bookings. Confirm identity, price, availability, fulfilment, and policies with the provider first.' },
];

const FOOTER_LINKS: { label: string; route: string }[] = [
  { label: 'Buyer safety', route: getEHubTermsRoute('buyer') },
  { label: 'Seller terms', route: getEHubTermsRoute('seller') },
  { label: 'EHub terms', route: getEHubTermsRoute() },
  { label: 'Privacy policy', route: '/privacy-policy' },
];

/** The website's /ehub home: hero, search, categories, professionals, catalog with cart, saved and compare, selling, how it works with FAQ, footer. Storefronts are in Discover. */
export default function EHubScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors, layout.gutter, layout.isTablet), [colors, layout.gutter, layout.isTablet]);
  const catalog = useEHubCatalog();
  const providers = useEHubProviders();
  const { favorites } = useEHubCommerce();
  const { scrollRef, scrollToSection, onContainerLayout, onSectionLayout } = useEHubSectionScroll<HomeSection>();
  // ?section=products opens at the catalog (the website's /ehub#featured-products); jump changes on every tap of the Shop pill.
  const params = useLocalSearchParams<{ section?: string; jump?: string }>();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sort, setSort] = useState<ProductSort>('catalog');
  const [heroIndex, setHeroIndex] = useState(0);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  useEffect(() => {
    if (params.section === 'products' || params.section === 'professionals') scrollToSection(params.section);
  }, [params.jump, params.section, scrollToSection]);

  useEffect(() => {
    const timer = setInterval(() => setHeroIndex((currentIndex) => (currentIndex + 1) % HERO_SLIDES.length), HERO_ROTATION_MS);
    return () => clearInterval(timer);
  }, []);

  const products = useMemo(() => catalog.data ?? [], [catalog.data]);
  const providerList = useMemo(() => providers.data ?? [], [providers.data]);
  // Only real catalog categories, like the website (no placeholder categories).
  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(), [products]);
  const displayedCategories = categories.slice(0, 6);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleProducts = useMemo(() => products
    .filter((product) => selectedCategory === 'All' || product.category === selectedCategory)
    .filter((product) => !normalizedSearch || [product.title, product.category, product.storeName, product.description].some((value) => value.toLowerCase().includes(normalizedSearch)))
    .map((product, index) => ({ product, index, price: getEHubCurrentPrice(product.price, product.salePrice) }))
    .sort((left, right) => {
      if (sort === 'price-low') return left.price - right.price;
      if (sort === 'price-high') return right.price - left.price;
      if (sort === 'name') return left.product.title.localeCompare(right.product.title);
      return left.index - right.index;
    })
    .map(({ product }) => product), [normalizedSearch, products, selectedCategory, sort]);
  const matchingProviders = useMemo(() => !normalizedSearch ? [] : providerList.filter((provider) => [provider.name, provider.description, provider.location, ...provider.categories, ...provider.services].some((value) => value.toLowerCase().includes(normalizedSearch))).slice(0, 5), [normalizedSearch, providerList]);
  // Anyone offering services is a professional here, including storefronts that also sell products.
  const professionals = providerList.filter((provider) => provider.offersServices || provider.kind === 'professional').slice(0, 6);
  const carouselCardWidth = Math.round(layout.innerWidth * 0.86);
  const comparedProducts = products.filter((product) => compareIds.includes(product.id));
  const savedProducts = products.filter((product) => favorites.includes(product.id));
  const hero = HERO_SLIDES[heroIndex];
  const isRefreshing = catalog.isRefreshing || providers.isRefreshing;

  const handleOpenProduct = (productId: string) => router.push(`/ehub/products/${encodeURIComponent(productId)}` as Href);
  const handleOpenProvider = (providerId: string) => router.push(`/ehub/providers/${encodeURIComponent(providerId)}` as Href);
  const handleTarget = (target: HomeTarget) => {
    if ('section' in target) scrollToSection(target.section);
    else router.push(target.route as Href);
  };
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    scrollToSection('products');
  };
  const handleCompare = (productId: string) => setCompareIds((currentIds) => currentIds.includes(productId)
    ? currentIds.filter((id) => id !== productId)
    : [...currentIds.slice(-1), productId]);
  const handleRefresh = () => { void catalog.refresh(); void providers.refresh(); };
  const handleResetFilters = () => { setSearch(''); setSelectedCategory('All'); };
  const handleOpenCart = () => setIsCartOpen(true);

  const renderProductGrid = (items: typeof products) => <View style={[styles.grid, { gap: layout.gap }]}>
    {items.map((product) => <EHubProductCard key={product.id} product={product} width={layout.productWidth} onOpen={handleOpenProduct} isCompared={compareIds.includes(product.id)} onCompare={handleCompare} onAddedToCart={handleOpenCart} />)}
  </View>;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={8} style={styles.headerButton}><ArrowLeft size={24} color={colors.icon} /></Pressable>
          <Text style={styles.brand}><Text style={styles.brandAccent}>E</Text>-Hub</Text>
          <View style={styles.headerActions}>
            <EHubHeaderActions onOpenCart={handleOpenCart} onOpenSaved={() => scrollToSection('saved')} />
            <Pressable accessibilityRole="button" accessibilityLabel="Open E-Hub enquiries" onPress={() => router.push('/ehub/enquiries?mode=sent' as Href)} hitSlop={4} style={styles.headerButton}><Inbox size={21} color={colors.icon} /></Pressable>
          </View>
        </View>
        <EHubSectionNav />
      </SafeAreaView>
      <EHubScrollView scrollRef={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.accent} />} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <CachedImage key={hero.imageUrl} uri={hero.imageUrl} style={styles.heroImage} />
          <LinearGradient colors={['rgba(2,6,23,0.35)', 'rgba(2,6,23,0.92)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.heroShade} />
          <View style={[styles.heroContent, { width: layout.contentWidth }]}>
            <Text style={styles.heroEyebrow}>{hero.eyebrow}</Text>
            <Text style={styles.heroTitle}>{hero.title}</Text>
            <Text style={styles.heroBody}>{hero.description}</Text>
            <View style={styles.heroActions}>
              <Pressable accessibilityRole="button" onPress={() => handleTarget(hero.target)} style={styles.heroPrimary}><Text style={styles.heroPrimaryText}>{hero.actionLabel}</Text><ArrowRight size={16} color="#020617" /></Pressable>
            </View>
          </View>
          <View style={styles.heroDots}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous slide" onPress={() => setHeroIndex((heroIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)} hitSlop={6} style={styles.heroArrow}><ChevronLeft size={18} color="#ffffff" /></Pressable>
            {HERO_SLIDES.map((slide, index) => <Pressable key={slide.eyebrow} accessibilityRole="button" accessibilityLabel={`Show slide ${index + 1}`} accessibilityState={{ selected: index === heroIndex }} onPress={() => setHeroIndex(index)} hitSlop={8} style={[styles.dot, index === heroIndex && styles.dotActive]} />)}
            <Pressable accessibilityRole="button" accessibilityLabel="Next slide" onPress={() => setHeroIndex((heroIndex + 1) % HERO_SLIDES.length)} hitSlop={6} style={styles.heroArrow}><ChevronRight size={18} color="#ffffff" /></Pressable>
          </View>
        </View>

        <View onLayout={onContainerLayout} style={[styles.body, { width: layout.contentWidth }]}>
          <View style={styles.searchBox}>
            <Search size={19} color={colors.mutedText} />
            <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => scrollToSection('products')} placeholder="Search E-Hub" placeholderTextColor={colors.mutedText} returnKeyType="search" accessibilityLabel="Search E-Hub products, storefronts, and professionals" style={styles.searchInput} />
            {search ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} hitSlop={8}><X size={18} color={colors.mutedText} /></Pressable> : null}
          </View>

          {normalizedSearch ? <View style={styles.searchResults}>
            <EHubSectionHeading eyebrow="Search" title={`Results for “${search.trim()}”`} description={`${visibleProducts.length} products and ${matchingProviders.length} providers match.`} />
            {matchingProviders.map((provider) => <Pressable key={provider.id} accessibilityRole="button" onPress={() => handleOpenProvider(provider.id)} style={styles.searchProvider}>
              <View style={styles.searchLogo}>{provider.logoUrl ? <CachedImage uri={provider.logoUrl} style={styles.fill} /> : <Building2 size={20} color={colors.mutedText} />}</View>
              <View style={styles.flex}><Text numberOfLines={1} style={styles.searchProviderName}>{provider.name}</Text><Text style={styles.muted}>{provider.kind === 'business' ? 'Storefront' : 'Professional'}</Text></View>
              <ArrowRight size={16} color={colors.mutedText} />
            </Pressable>)}
            <Pressable accessibilityRole="button" onPress={() => setSearch('')} style={styles.clearSearch}><Text style={styles.clearSearchText}>Clear search</Text></Pressable>
          </View> : null}

          {displayedCategories.length ? <View style={styles.section}>
            <EHubSectionHeading eyebrow="Explore" title="Shop by category" description="Filter published products from active storefronts." action={<EHubLinkButton label="View all" onPress={() => handleCategorySelect('All')} />} />
            <HorizontalRow styles={styles}>
              {displayedCategories.map((category) => {
                const imageUrl = CATEGORY_IMAGES.find((item) => item.label === category)?.imageUrl ?? CATEGORY_IMAGES[0].imageUrl;
                return <Pressable key={category} accessibilityRole="button" accessibilityLabel={`Show ${category}`} onPress={() => handleCategorySelect(category)} style={styles.categoryTile}>
                  <CachedImage uri={imageUrl} style={styles.fill} />
                  <LinearGradient colors={['rgba(2,6,23,0)', 'rgba(2,6,23,0.85)']} start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }} style={styles.categoryShade} />
                  <Text numberOfLines={2} style={styles.categoryLabel}>{category}</Text>
                </Pressable>;
              })}
            </HorizontalRow>
          </View> : null}

          <View onLayout={onSectionLayout('professionals')} style={[styles.section, styles.band]}>
            <EHubSectionHeading eyebrow="Hire" title="Discover professionals" description="Real service profiles. Send an enquiry; booking and payment happen with the provider." action={<View style={styles.headingActions}>
              <EHubLinkButton label="See all" onPress={() => router.push('/ehub/discover?kind=professional' as Href)} />
              <EHubLinkButton label="Join as a pro" onPress={() => router.push('/ehub/seller?intent=services' as Href)} />
            </View>} />
            {providers.error ? <EHubNotice tone="warning" text={providers.error} actionLabel="Try again" onAction={() => void providers.refresh()} /> : null}
            {providers.isLoading && !providers.data ? <EHubProviderGridSkeleton />
              : professionals.length ? (layout.isTablet
                ? <View style={[styles.grid, { gap: layout.gap }]}>{professionals.map((provider) => <EHubProviderCard key={provider.id} provider={provider} width={layout.providerWidth} onOpen={handleOpenProvider} />)}</View>
                // Phones: a swipeable row; the next card peeks in so it's clear there are more.
                : <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={carouselCardWidth + 12} snapToAlignment="start" contentContainerStyle={styles.carousel} style={styles.carouselBleed}>
                  {professionals.map((provider) => <EHubProviderCard key={provider.id} provider={provider} width={professionals.length === 1 ? layout.innerWidth : carouselCardWidth} onOpen={handleOpenProvider} />)}
                </ScrollView>)
                : !providers.error ? <EHubRecruitPanel onOfferServices={() => router.push('/ehub/seller?intent=services' as Href)} onOpenDirectory={() => router.push('/ehub/discover' as Href)} /> : null}
          </View>

          <View onLayout={onSectionLayout('products')} style={styles.section}>
            <EHubSectionHeading eyebrow="Current catalog" title="Products from local storefronts" description="Real published products with seller-provided pricing and availability. Prices are shown in TTD." />
            <View style={styles.filterPanel}>
              <HorizontalRow styles={styles}>
                {['All', ...categories].map((category) => <EHubChip key={category} label={category} selected={selectedCategory === category} onPress={() => setSelectedCategory(category)} />)}
              </HorizontalRow>
              <HorizontalRow styles={styles}>
                <Text style={styles.sortLabel}>Sort</Text>
                {SORT_OPTIONS.map((option) => <EHubChip key={option.value} label={option.label} selected={sort === option.value} onPress={() => setSort(option.value)} />)}
              </HorizontalRow>
            </View>
            {catalog.error ? <EHubNotice tone="warning" text={catalog.error} actionLabel="Try again" onAction={() => void catalog.refresh()} /> : null}
            {catalog.isLoading && !catalog.data ? <EHubProductGridSkeleton />
              : visibleProducts.length ? renderProductGrid(visibleProducts)
                : !catalog.error ? <EHubEmptyState icon={<Package size={40} color={colors.mutedText} />} title="No matching products" body="Try another search or category. Only real published listings appear here." actionLabel="Reset filters" onAction={handleResetFilters} /> : null}
            <EHubComparePanel products={comparedProducts} onClear={() => setCompareIds([])} onOpenProduct={handleOpenProduct} />
          </View>

          {favorites.length ? <View onLayout={onSectionLayout('saved')} style={styles.section}>
            <EHubSectionHeading eyebrow="Saved for later" title="Your saved products" description="Saved items stay on this device so you can quickly return to them." />
            {savedProducts.length ? renderProductGrid(savedProducts)
              : <View style={styles.dashedNote}><Text style={styles.dashedNoteText}>Your saved products are not currently published. You can remove them with the heart button when they become available again.</Text></View>}
          </View> : null}

          <Pressable accessibilityRole="button" onPress={() => router.push('/ehub/enquiries?mode=sent' as Href)} style={[styles.inboxCard]}>
            <View style={styles.inboxIcon}><Inbox size={22} color={colors.successText} /></View>
            <View style={styles.flex}><Text style={styles.inboxTitle}>My enquiries</Text><Text style={styles.muted}>Enquiries you sent and replies from providers</Text></View>
            <ArrowRight size={19} color={colors.mutedText} />
          </Pressable>

          <View style={styles.sellBanner}>
            <LinearGradient colors={['#022c22', '#065f46']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.sellEyebrow}>Sell on E-Hub</Text>
            <Text style={styles.sellTitle}>Run a storefront, offer services or deliver.</Text>
            <Text style={styles.sellBody}>Plumber, designer, shop or courier? Set up once and get enquiries from people across Trinidad & Tobago. Couriers can be chosen by sellers and their buyers for delivery.</Text>
            <View style={styles.sellActions}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/ehub/seller?intent=services' as Href)} style={[styles.sellPrimary]}><Wrench size={16} color="#022c22" /><Text style={styles.sellPrimaryText}>Offer services</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/ehub/seller' as Href)} style={[styles.sellSecondary]}><Store size={16} color="#ffffff" /><Text style={styles.sellSecondaryText}>Seller Center</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/market/couriers/register' as Href)} style={[styles.sellSecondary]}><Truck size={16} color="#ffffff" /><Text style={styles.sellSecondaryText}>Register as a courier</Text></Pressable>
            </View>
          </View>

          <View style={styles.howItWorks}>
            <Text style={styles.howEyebrow}>Simple and transparent</Text>
            <Text style={styles.howTitle}>How EHub works</Text>
            <View style={[styles.steps, layout.isTablet && styles.stepsWide]}>
              {STEPS.map((step) => <View key={step.title} style={[styles.step, layout.isTablet && styles.flex]}>
                <View style={styles.stepIcon}><step.icon size={18} color="#01eb53" /></View>
                <View style={styles.flex}><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.howBody}>{step.text}</Text></View>
              </View>)}
            </View>
            <View style={styles.faqList}>
              {FAQ_ITEMS.map((item) => {
                const isOpen = openQuestion === item.question;
                return <Pressable key={item.question} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpenQuestion(isOpen ? null : item.question)} style={styles.faqItem}>
                  <View style={styles.faqQuestionRow}><Text style={styles.faqQuestion}>{item.question}</Text><ChevronDown size={18} color="rgba(255,255,255,0.6)" style={isOpen ? styles.chevronOpen : null} /></View>
                  {isOpen ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
                </Pressable>;
              })}
            </View>
            <Pressable accessibilityRole="link" onPress={() => router.push(getEHubTermsRoute('buyer') as Href)} style={[styles.safetyLink]}>
              <ShieldCheck size={18} color="#fbbf24" /><Text style={styles.safetyLinkText}>Read buyer safety terms</Text><ArrowRight size={15} color="#fbbf24" />
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}><Text style={styles.footerBrandAccent}>E</Text>Hub</Text>
          <Text style={styles.footerText}>Ourlime’s home for local business catalogs and professional discovery.</Text>
          <View style={styles.footerLinks}>
            {FOOTER_LINKS.map((link) => <Pressable key={link.label} accessibilityRole="link" onPress={() => router.push(link.route as Href)} hitSlop={6} style={styles.footerLink}><Text style={styles.footerLinkText}>{link.label}</Text></Pressable>)}
          </View>
          <Text style={styles.copyright}>© 2026 Ourlime EHub. Discovery, catalogs, and enquiries—not payment or booking.</Text>
        </View>
      </EHubScrollView>
      <EHubCartSheet visible={isCartOpen} onClose={() => setIsCartOpen(false)} onOpenProduct={handleOpenProduct} />
    </View>
  );
}

type RowProps = { styles: ReturnType<typeof createStyles>; children: ReactNode };

/** A horizontal row of chips or category tiles. */
function HorizontalRow({ styles, children }: RowProps) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{children}</ScrollView>;
}

const createStyles = (colors: AppThemeColors, gutter: number, isTablet: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  headingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pressed: { opacity: 0.86 },
  fill: { width: '100%', height: '100%' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  brand: { flex: 1, color: colors.text, fontSize: 21, fontWeight: '900' },
  brandAccent: { color: '#10b981' },
  scrollContent: { alignItems: 'center' },
  hero: { width: '100%', minHeight: isTablet ? 420 : 360, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617', overflow: 'hidden' },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.55 },
  heroShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2,6,23,0.55)' },
  heroContent: { paddingHorizontal: gutter + 6, paddingTop: 32, paddingBottom: 76, maxWidth: '100%' },
  heroEyebrow: { color: '#01eb53', fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  heroTitle: { marginTop: 12, maxWidth: 620, color: '#ffffff', fontSize: isTablet ? 42 : 29, lineHeight: isTablet ? 46 : 34, fontWeight: '900' },
  heroBody: { marginTop: 14, maxWidth: 520, color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 22 },
  heroActions: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  heroPrimary: { minHeight: 46, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: '#01eb53' },
  heroPrimaryText: { color: '#020617', fontSize: 14, fontWeight: '900' },
  heroDots: { position: 'absolute', bottom: 22, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 5, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.5)' },
  heroArrow: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 26, backgroundColor: '#01eb53' },
  body: { maxWidth: '100%', paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 40, gap: 30 },
  band: { marginHorizontal: -gutter, paddingHorizontal: gutter, paddingVertical: 24, backgroundColor: colors.successSurface },
  carouselBleed: { marginHorizontal: -gutter },
  carousel: { gap: 12, paddingHorizontal: gutter, paddingBottom: 6 },
  searchBox: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#020617', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  searchInput: { flex: 1, minHeight: 48, color: colors.text, fontSize: 15 },
  searchResults: { marginTop: -16, padding: 14, gap: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface },
  searchProvider: { minHeight: 60, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, backgroundColor: colors.surface },
  searchLogo: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12, backgroundColor: colors.control },
  searchProviderName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  clearSearch: { alignSelf: 'flex-start', minHeight: 42, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  clearSearchText: { color: colors.successText, fontSize: 13, fontWeight: '800' },
  section: { gap: 14 },
  chipRow: { gap: 8, alignItems: 'center', paddingHorizontal: 2 },
  categoryTile: { width: isTablet ? 160 : 136, height: isTablet ? 170 : 150, overflow: 'hidden', borderRadius: 18, backgroundColor: colors.control },
  categoryShade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
  categoryLabel: { position: 'absolute', left: 12, right: 12, bottom: 12, color: '#ffffff', fontSize: 14, fontWeight: '900' },
  filterPanel: { padding: 10, gap: 8, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sortLabel: { color: colors.mutedText, fontSize: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dashedNote: { padding: 18, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  dashedNoteText: { color: colors.secondaryText, fontSize: 13, lineHeight: 20 },
  howItWorks: { padding: isTablet ? 28 : 20, gap: 8, borderRadius: 24, backgroundColor: '#020617' },
  howEyebrow: { color: '#01eb53', fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  howTitle: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
  howBody: { marginTop: 2, color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 19 },
  steps: { marginTop: 8, gap: 10 },
  stepsWide: { flexDirection: 'row' },
  step: { padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' },
  stepIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(1,235,83,0.12)' },
  stepTitle: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  faqList: { marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  faqItem: { paddingVertical: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  faqQuestionRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 10 },
  faqQuestion: { flex: 1, color: '#ffffff', fontSize: 15, fontWeight: '800' },
  faqAnswer: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 20 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  safetyLink: { marginTop: 6, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  safetyLinkText: { color: '#fbbf24', fontSize: 14, fontWeight: '800' },
  sellBanner: { overflow: 'hidden', padding: 20, gap: 8, borderRadius: 24, backgroundColor: '#022c22' },
  sellEyebrow: { color: '#01eb53', fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  sellTitle: { color: '#ffffff', fontSize: 21, lineHeight: 26, fontWeight: '900' },
  sellBody: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 19 },
  sellActions: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sellPrimary: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: '#01eb53' },
  sellPrimaryText: { color: '#022c22', fontSize: 14, fontWeight: '900' },
  sellSecondary: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  sellSecondaryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  inboxIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.successSurface },
  inboxCard: { minHeight: 76, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  inboxTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  footer: { width: '100%', alignItems: 'center', gap: 8, paddingTop: 28, paddingBottom: 36, paddingHorizontal: gutter + 4, backgroundColor: '#020617' },
  footerBrand: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  footerBrandAccent: { color: '#01eb53' },
  footerText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  footerLinks: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18 },
  footerLink: { minHeight: 44, justifyContent: 'center' },
  footerLinkText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
  copyright: { marginTop: 10, color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center' },
});
