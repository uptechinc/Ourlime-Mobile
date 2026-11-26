import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { EHubCatalogProduct } from '@/lib/types/ehubDiscovery';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ArrowRight, Building2, ChevronDown, Inbox, Package, Search, ShieldCheck, ShoppingBag, Store, Truck, Wrench, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubCatalog, useEHubProviders } from '@/lib/hooks/useEHub';
import { useEHubCommerce } from '@/lib/hooks/useEHubCommerce';
import { getEHubTermsRoute } from '@/lib/services/EHubService';
import { getEHubCurrentPrice } from '@/lib/services/EHubCommerceService';
import { EHubChip, EHubEmptyState, EHubLinkButton, EHubNotice, EHubProductCard, EHubProviderCard, EHubRecruitPanel, EHubSectionHeading, useEHubLayout } from '@/components/ehub/EHubParts';
import EHubSectionNav from '@/components/ehub/EHubSectionNav';
import { EHubCartSheet, EHubHeaderActions } from '@/components/ehub/EHubCommerceParts';
import { EHUB_COMPARE_LIMIT, EHubCompareBar, EHubCompareSheet, type EHubStoreRating } from '@/components/ehub/EHubCompare';
import EHubHeroSlider, { type EHubHeroSlide } from '@/components/ehub/EHubHeroSlider';
import { EHubScrollView, useEHubSectionScroll } from '@/components/ehub/EHubScrollView';
import { EHubProductGridSkeleton, EHubProviderGridSkeleton } from '@/components/ehub/EHubSkeletons';

type ProductSort = 'catalog' | 'price-low' | 'price-high' | 'name';
type HomeSection = 'products' | 'saved' | 'professionals';
type HomeTarget = { section: HomeSection } | { route: string };
type HeroSlide = EHubHeroSlide<HomeTarget>;

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

// Short labels so each chip fits on one line at 360dp.
const SORT_OPTIONS: { value: ProductSort; label: string; accessibilityLabel: string }[] = [
  { value: 'catalog', label: 'Default', accessibilityLabel: 'Sort in catalog order' },
  { value: 'price-low', label: 'Lowest price', accessibilityLabel: 'Sort by price, low to high' },
  { value: 'price-high', label: 'Highest price', accessibilityLabel: 'Sort by price, high to low' },
  { value: 'name', label: 'A–Z', accessibilityLabel: 'Sort by name' },
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
  const insets = useSafeAreaInsets();
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  useEffect(() => {
    if (params.section === 'products' || params.section === 'professionals') scrollToSection(params.section);
  }, [params.jump, params.section, scrollToSection]);

  const products = useMemo(() => catalog.data ?? [], [catalog.data]);
  const providerList = useMemo(() => providers.data ?? [], [providers.data]);
  // Only real catalog categories, like the website (no placeholder categories).
  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(), [products]);
  const displayedCategories = categories.slice(0, 6);
  const categoryCounts = useMemo(() => products.reduce<{ [category: string]: number }>((counts, product) => {
    if (product.category) counts[product.category] = (counts[product.category] ?? 0) + 1;
    return counts;
  }, {}), [products]);
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
  // Kept in the order they were ticked, so the bar's thumbnails and the table's columns match.
  const comparedProducts = compareIds.map((productId) => products.find((product) => product.id === productId)).filter((product): product is EHubCatalogProduct => Boolean(product));
  const savedProducts = products.filter((product) => favorites.includes(product.id));
  // Products carry no rating of their own; the comparison shows the storefront's rating when the directory has it.
  const storeRatings = useMemo(() => {
    const ratings = new Map<string, EHubStoreRating>();
    providerList.filter((provider) => provider.offersProducts || provider.kind === 'business').forEach((provider) => {
      const rating = { rating: provider.rating, reviewCount: provider.reviewCount };
      ratings.set(`id:${provider.id}`, rating);
      ratings.set(`name:${provider.name.trim().toLowerCase()}`, rating);
    });
    return ratings;
  }, [providerList]);
  const getStoreRating = (product: EHubCatalogProduct) => storeRatings.get(`id:${product.storeId}`) ?? storeRatings.get(`name:${product.storeName.trim().toLowerCase()}`) ?? null;
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
  // A third pick replaces the oldest, so ticking Compare never silently does nothing.
  const handleCompare = (productId: string) => setCompareIds((currentIds) => currentIds.includes(productId)
    ? currentIds.filter((id) => id !== productId)
    : [...currentIds.slice(-(EHUB_COMPARE_LIMIT - 1)), productId]);
  const handleRemoveCompare = (productId: string) => setCompareIds((currentIds) => currentIds.filter((id) => id !== productId));
  const handleClearCompare = () => setCompareIds([]);
  const handleRefresh = () => { void catalog.refresh(); void providers.refresh(); };
  const handleResetFilters = () => { setSearch(''); setSelectedCategory('All'); };
  const handleOpenCart = () => setIsCartOpen(true);

  const renderProductGrid = (items: typeof products) => <View style={[styles.grid, { gap: layout.gap }]}>
    {/* Adding confirms with a toast, the header badge and the card's "in cart" state; it no longer covers the page with the cart. */}
    {items.map((product) => <EHubProductCard key={product.id} product={product} width={layout.productWidth} onOpen={handleOpenProduct} isCompared={compareIds.includes(product.id)} onCompare={handleCompare} onOpenCart={handleOpenCart} />)}
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
      <EHubScrollView scrollRef={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.accent} />} contentContainerStyle={[styles.scrollContent, comparedProducts.length ? { paddingBottom: 96 + insets.bottom } : null]}>
        <EHubHeroSlider slides={HERO_SLIDES} contentWidth={layout.contentWidth} gutter={layout.gutter} isTablet={layout.isTablet} onAction={handleTarget} />

        <View onLayout={onContainerLayout} style={[styles.body, { width: layout.contentWidth }]}>
          <View style={styles.searchBox}>
            <Search size={19} color={colors.mutedText} />
            <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => scrollToSection('products')} placeholder="Search E-Hub" placeholderTextColor={colors.mutedText} returnKeyType="search" accessibilityLabel="Search E-Hub products, storefronts, and professionals" style={styles.searchInput} />
            {search ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} style={styles.searchClear}><X size={18} color={colors.mutedText} /></Pressable> : null}
          </View>

          {normalizedSearch ? <View style={styles.searchResults}>
            <EHubSectionHeading eyebrow="Search" title={`Results for “${search.trim()}”`} description={`${visibleProducts.length} ${visibleProducts.length === 1 ? 'product' : 'products'} and ${matchingProviders.length} ${matchingProviders.length === 1 ? 'provider' : 'providers'} match.`} />
            {matchingProviders.map((provider) => <Pressable key={provider.id} accessibilityRole="button" onPress={() => handleOpenProvider(provider.id)} style={styles.searchProvider}>
              <View style={styles.searchLogo}>{provider.logoUrl ? <CachedImage uri={provider.logoUrl} style={styles.fill} /> : <Building2 size={20} color={colors.mutedText} />}</View>
              <View style={styles.flex}><Text numberOfLines={1} style={styles.searchProviderName}>{provider.name}</Text><Text numberOfLines={1} style={styles.muted}>{provider.kind === 'business' ? 'Storefront' : 'Professional'}</Text></View>
              <ArrowRight size={16} color={colors.mutedText} />
            </Pressable>)}
            <Pressable accessibilityRole="button" onPress={() => setSearch('')} style={styles.clearSearch}><Text numberOfLines={1} style={styles.clearSearchText}>Clear search</Text></Pressable>
          </View> : null}

          {displayedCategories.length ? <View style={styles.section}>
            <EHubSectionHeading eyebrow="Explore" title="Shop by category" action={<EHubLinkButton label="See all" onPress={() => handleCategorySelect('All')} />} />
            <HorizontalRow styles={styles}>
              {displayedCategories.map((category) => {
                const imageUrl = CATEGORY_IMAGES.find((item) => item.label === category)?.imageUrl ?? CATEGORY_IMAGES[0].imageUrl;
                const count = categoryCounts[category] ?? 0;
                return <Pressable key={category} accessibilityRole="button" accessibilityLabel={`Show ${category}, ${count} ${count === 1 ? 'product' : 'products'}`} onPress={() => handleCategorySelect(category)} style={styles.categoryTile}>
                  <CachedImage uri={imageUrl} style={styles.fill} />
                  <LinearGradient colors={['rgba(2,6,23,0)', 'rgba(2,6,23,0.85)']} start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }} style={styles.categoryShade} />
                  <View style={styles.categoryText}>
                    <Text numberOfLines={2} style={styles.categoryLabel}>{category}</Text>
                    <Text numberOfLines={1} style={styles.categoryCount}>{count} {count === 1 ? 'product' : 'products'}</Text>
                  </View>
                </Pressable>;
              })}
            </HorizontalRow>
          </View> : null}

          <View onLayout={onSectionLayout('professionals')} style={[styles.section, styles.band]}>
            <EHubSectionHeading eyebrow="Hire" title="Professionals" description="Send an enquiry; booking and payment happen with the provider." action={<EHubLinkButton label="See all" onPress={() => router.push('/ehub/discover?kind=professional' as Href)} />} />
            {providers.error ? <EHubNotice tone="warning" text={providers.error} actionLabel="Try again" onAction={() => void providers.refresh()} /> : null}
            {providers.isLoading && !providers.data ? <EHubProviderGridSkeleton />
              : professionals.length ? (layout.isTablet
                ? <View style={[styles.grid, { gap: layout.gap }]}>{professionals.map((provider) => <EHubProviderCard key={provider.id} provider={provider} width={layout.providerWidth} onOpen={handleOpenProvider} />)}</View>
                // Phones: a swipeable row; the next card peeks in so it's clear there are more.
                : <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={carouselCardWidth + 12} snapToAlignment="start" contentContainerStyle={styles.carousel} style={styles.carouselBleed}>
                  {professionals.map((provider) => <EHubProviderCard key={provider.id} provider={provider} width={professionals.length === 1 ? layout.innerWidth : carouselCardWidth} onOpen={handleOpenProvider} />)}
                </ScrollView>)
                : !providers.error ? <EHubRecruitPanel onOfferServices={() => router.push('/ehub/seller?intent=services' as Href)} onOpenDirectory={() => router.push('/ehub/discover' as Href)} /> : null}
            {/* "Join as a pro" used to sit beside "See all" in the heading; one heading action keeps the title readable. */}
            {professionals.length ? <Pressable accessibilityRole="link" onPress={() => router.push('/ehub/seller?intent=services' as Href)} style={styles.joinLink}>
              <Wrench size={15} color={colors.successText} /><Text numberOfLines={1} style={styles.joinLinkText}>Offer your services on E-Hub</Text><ArrowRight size={15} color={colors.successText} />
            </Pressable> : null}
          </View>

          <View onLayout={onSectionLayout('products')} style={styles.section}>
            <EHubSectionHeading eyebrow="Shop" title="Products" description="From local storefronts. Prices in TTD, set by each seller." />
            <View style={styles.filterPanel}>
              <HorizontalRow styles={styles}>
                {['All', ...categories].map((category) => <EHubChip key={category} label={category} selected={selectedCategory === category} onPress={() => setSelectedCategory(category)} />)}
              </HorizontalRow>
              <HorizontalRow styles={styles}>
                <Text style={styles.sortLabel}>Sort</Text>
                {SORT_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.accessibilityLabel} accessibilityState={{ selected: sort === option.value }} onPress={() => setSort(option.value)} style={[styles.sortChip, sort === option.value && styles.sortChipSelected]}>
                  <Text numberOfLines={1} style={[styles.sortChipText, sort === option.value && styles.sortChipTextSelected]}>{option.label}</Text>
                </Pressable>)}
              </HorizontalRow>
            </View>
            {catalog.data && !catalog.error ? <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{visibleProducts.length} {visibleProducts.length === 1 ? 'product' : 'products'}{selectedCategory === 'All' ? '' : ` in ${selectedCategory}`}</Text> : null}
            {catalog.error ? <EHubNotice tone="warning" text={catalog.error} actionLabel="Try again" onAction={() => void catalog.refresh()} /> : null}
            {catalog.isLoading && !catalog.data ? <EHubProductGridSkeleton />
              : visibleProducts.length ? renderProductGrid(visibleProducts)
                : !catalog.error ? <EHubEmptyState icon={<Package size={40} color={colors.mutedText} />} title="No matching products" body="Try another search or category. Only real published listings appear here." actionLabel="Reset filters" onAction={handleResetFilters} /> : null}
          </View>

          {favorites.length ? <View onLayout={onSectionLayout('saved')} style={styles.section}>
            <EHubSectionHeading eyebrow="Saved" title="Saved for later" description="Saved on this device." />
            {savedProducts.length ? renderProductGrid(savedProducts)
              : <View style={styles.dashedNote}><Text style={styles.dashedNoteText}>Your saved products are not currently published. You can remove them with the heart button when they become available again.</Text></View>}
          </View> : null}

          <Pressable accessibilityRole="button" onPress={() => router.push('/ehub/enquiries?mode=sent' as Href)} style={[styles.inboxCard]}>
            <View style={styles.inboxIcon}><Inbox size={22} color={colors.successText} /></View>
            <View style={styles.flex}><Text numberOfLines={1} style={styles.inboxTitle}>My enquiries</Text><Text numberOfLines={2} style={styles.muted}>Enquiries you sent and replies from providers</Text></View>
            <ArrowRight size={19} color={colors.mutedText} />
          </Pressable>

          <View style={styles.sellBanner}>
            <LinearGradient colors={['#022c22', '#065f46']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.sellEyebrow}>Sell on E-Hub</Text>
            <Text style={styles.sellTitle}>Run a storefront, offer services or deliver.</Text>
            <Text style={styles.sellBody}>Plumber, designer, shop or courier? Set up once and get enquiries from people across Trinidad & Tobago.</Text>
            {/* One full-width primary, then two equal secondaries: three wrapping pills of different widths looked unfinished. */}
            <Pressable accessibilityRole="button" onPress={() => router.push('/ehub/seller?intent=services' as Href)} style={styles.sellPrimary}><Wrench size={16} color="#022c22" /><Text numberOfLines={1} style={styles.sellPrimaryText}>Offer services</Text></Pressable>
            <View style={styles.sellActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Open Seller Center" onPress={() => router.push('/ehub/seller' as Href)} style={styles.sellSecondary}><Store size={16} color="#ffffff" /><Text numberOfLines={1} style={styles.sellSecondaryText}>Seller Center</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Register as a courier" onPress={() => router.push('/market/couriers/register' as Href)} style={styles.sellSecondary}><Truck size={16} color="#ffffff" /><Text numberOfLines={1} style={styles.sellSecondaryText}>Courier sign-up</Text></Pressable>
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
              <ShieldCheck size={18} color="#fbbf24" /><Text numberOfLines={1} style={styles.safetyLinkText}>Read buyer safety terms</Text><ArrowRight size={15} color="#fbbf24" />
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
      <EHubCompareBar products={comparedProducts} bottomInset={insets.bottom} onOpen={() => setIsCompareOpen(true)} onRemove={handleRemoveCompare} onClear={handleClearCompare} />
      <EHubCompareSheet visible={isCompareOpen} onClose={() => setIsCompareOpen(false)} onClear={handleClearCompare} products={comparedProducts} getStoreRating={getStoreRating} onOpenProduct={handleOpenProduct} onOpenCart={handleOpenCart} />
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
  body: { maxWidth: '100%', paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 40, gap: 32 },
  band: { marginHorizontal: -gutter, paddingHorizontal: gutter, paddingVertical: 24, backgroundColor: colors.successSurface },
  carouselBleed: { marginHorizontal: -gutter },
  carousel: { gap: 12, paddingHorizontal: gutter, paddingBottom: 4 },
  searchBox: { minHeight: 52, paddingLeft: 16, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchClear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchInput: { flex: 1, minHeight: 48, color: colors.text, fontSize: 15 },
  searchResults: { marginTop: -16, padding: 16, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface },
  searchProvider: { minHeight: 60, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, backgroundColor: colors.surface },
  searchLogo: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12, backgroundColor: colors.control },
  searchProviderName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  clearSearch: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  clearSearchText: { color: colors.successText, fontSize: 13, fontWeight: '800' },
  section: { gap: 12 },
  chipRow: { gap: 8, alignItems: 'center', paddingHorizontal: 2 },
  categoryTile: { width: isTablet ? 160 : 136, height: isTablet ? 168 : 152, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.control },
  categoryShade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
  categoryText: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 2 },
  categoryLabel: { color: '#ffffff', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  categoryCount: { color: 'rgba(255,255,255,0.78)', fontSize: 12 },
  filterPanel: { gap: 8 },
  sortChip: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 999, flexShrink: 0 },
  sortChipSelected: { backgroundColor: colors.control },
  sortChipText: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  sortChipTextSelected: { color: colors.text, fontWeight: '800' },
  resultCount: { marginTop: -4, color: colors.mutedText, fontSize: 12 },
  joinLink: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  joinLinkText: { flexShrink: 1, color: colors.successText, fontSize: 14, fontWeight: '700' },
  sortLabel: { color: colors.mutedText, fontSize: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dashedNote: { padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  dashedNoteText: { color: colors.secondaryText, fontSize: 13, lineHeight: 20 },
  howItWorks: { padding: isTablet ? 32 : 20, gap: 8, borderRadius: 20, backgroundColor: '#020617' },
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
  safetyLinkText: { flexShrink: 1, color: '#fbbf24', fontSize: 14, fontWeight: '800' },
  sellBanner: { overflow: 'hidden', padding: 20, gap: 8, borderRadius: 20, backgroundColor: '#022c22' },
  sellEyebrow: { color: '#01eb53', fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  sellTitle: { color: '#ffffff', fontSize: 21, lineHeight: 26, fontWeight: '900' },
  sellBody: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 19 },
  sellActions: { flexDirection: 'row', gap: 8 },
  sellPrimary: { marginTop: 8, minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: '#01eb53' },
  sellPrimaryText: { flexShrink: 1, color: '#022c22', fontSize: 14, fontWeight: '900' },
  sellSecondary: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  sellSecondaryText: { flexShrink: 1, color: '#ffffff', fontSize: 13, fontWeight: '800' },
  inboxIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.successSurface },
  inboxCard: { minHeight: 76, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
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
