import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Search, ShieldCheck, ShoppingBag, Sparkles, Store, Tag } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useMarketplaceCatalog } from '@/lib/hooks/useMarketplaceCatalog';
import { useMarketplacePreferences } from '@/lib/hooks/useMarketplacePreferences';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import MarketProductCard from '@/components/market/MarketProductCard';
import { MarketplaceSkeleton } from '@/components/ui/Skeleton';
import type { MarketProduct } from '@/lib/types/reliability';

const EMPTY_CATALOG_ITEMS: readonly MarketProduct[] = Object.freeze([]);

export default function EHubScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { profile } = usePageAccess();
  const styles = useMemo(() => createStyles(colors, width), [colors, width]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const catalog = useMarketplaceCatalog(profile?.uid ?? null, search, category);
  const preferences = useMarketplacePreferences();
  const products = catalog.data?.products ?? EMPTY_CATALOG_ITEMS;
  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(), [products]);

  const handleOpenMarket = () => router.push('/market' as Href);
  const handleOpenProduct = (product: MarketProduct) => router.push(`/market?product=${encodeURIComponent(product.id)}` as Href);

  return (
    <View style={styles.safeArea}>
      <PageHeader title="E-Hub" onBackPress={() => router.back()} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={catalog.status === 'refreshing'} onRefresh={() => void catalog.refresh()} tintColor={colors.accent} />}
        contentContainerStyle={styles.content}
      >
        <LinearGradient colors={['#ecfdf5', '#d1fae5', '#ccfbf1']} style={styles.hero}>
          <View style={styles.promoPill}><Sparkles size={16} color="#047857" /><Text style={styles.promoText}>COMMUNITY SHOPPING</Text></View>
          <Text style={styles.heroTitle}>Shop smarter, discover Ourlime sellers</Text>
          <Text style={styles.heroBody}>Browse real community listings by category, then open Market for product details, variants, favorites, and your saved cart.</Text>
          <View style={styles.heroActions}>
            <Pressable accessibilityRole="button" onPress={handleOpenMarket} style={styles.primaryButton}><ShoppingBag size={18} color="#ffffff" /><Text style={styles.primaryText}>Browse Market</Text></Pressable>
            <View style={styles.safetyPill}><ShieldCheck size={16} color="#047857" /><Text style={styles.safetyText}>Payments unavailable</Text></View>
          </View>
        </LinearGradient>

        <View style={styles.searchBox}><Search size={20} color={colors.mutedText} /><TextInput value={search} onChangeText={setSearch} placeholder="Search real products" placeholderTextColor={colors.mutedText} style={styles.searchInput} /></View>

        <View style={styles.heading}><View><Text style={styles.sectionTitle}>Shop by category</Text><Text style={styles.sectionSubtitle}>Browse collections from the live catalog</Text></View><Tag size={22} color={colors.accentText} /></View>
        {categories.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          <Pressable onPress={() => setCategory('')} style={[styles.categoryCard, !category && styles.categoryActive]}><Store size={22} color={!category ? colors.onAccent : colors.accentText} /><Text style={[styles.categoryText, !category && styles.categoryTextActive]}>All products</Text></Pressable>
          {categories.map((categoryName) => <Pressable key={categoryName} onPress={() => setCategory(categoryName)} style={[styles.categoryCard, category === categoryName && styles.categoryActive]}><Tag size={22} color={category === categoryName ? colors.onAccent : colors.accentText} /><Text numberOfLines={2} style={[styles.categoryText, category === categoryName && styles.categoryTextActive]}>{categoryName}</Text></Pressable>)}
        </ScrollView> : null}

        <View style={styles.heading}><View><Text style={styles.sectionTitle}>{search || category ? 'Matching products' : 'Featured products'}</Text><Text style={styles.sectionSubtitle}>{products.length} live {products.length === 1 ? 'listing' : 'listings'}</Text></View><Pressable onPress={handleOpenMarket} style={styles.link}><Text style={styles.linkText}>View all</Text><ArrowRight size={16} color={colors.accentText} /></Pressable></View>
        {catalog.status === 'hydrating' && !products.length ? <MarketplaceSkeleton /> : null}
        {catalog.error ? <Pressable accessibilityRole="button" onPress={() => void catalog.refresh()} style={styles.error}><Text style={styles.errorText}>{catalog.error.message} Tap to retry.</Text></Pressable> : null}
        {!catalog.error && catalog.status !== 'hydrating' && !products.length ? <View style={styles.empty}><ShoppingBag size={38} color={colors.mutedText} /><Text style={styles.emptyTitle}>No products found</Text><Text style={styles.sectionSubtitle}>Try another search or browse the full Market.</Text></View> : null}
        {products.length ? <View style={styles.grid}>{products.slice(0, 8).map((product) => <MarketProductCard key={product.id} product={product} favorite={preferences.favoriteIds.includes(product.id)} onOpen={handleOpenProduct} onToggleFavorite={(productId) => void preferences.toggleFavorite(productId)} onQuickAdd={handleOpenProduct} />)}</View> : null}
        <Pressable onPress={handleOpenMarket} style={styles.marketCard}><Store size={25} color={colors.accentText} /><View style={styles.flex}><Text style={styles.marketTitle}>Open Lime Market</Text><Text style={styles.sectionSubtitle}>Filters, product details, seller information, favorites, and saved cart</Text></View><ArrowRight size={20} color={colors.mutedText} /></Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppThemeColors, width: number) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 14, paddingBottom: 42, gap: 18 },
  hero: { borderRadius: 24, padding: width < 360 ? 18 : 22, gap: 10, borderWidth: 1, borderColor: '#a7f3d0' },
  promoPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.74)' },
  promoText: { color: '#047857', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { maxWidth: 440, color: '#064e3b', fontSize: width < 360 ? 26 : 31, lineHeight: width < 360 ? 32 : 37, fontWeight: '900' },
  heroBody: { maxWidth: 480, color: '#166534', fontSize: 13, lineHeight: 20 },
  heroActions: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 },
  primaryButton: { minHeight: 46, paddingHorizontal: 16, borderRadius: 23, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#059669' },
  primaryText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  safetyPill: { minHeight: 42, paddingHorizontal: 12, borderRadius: 21, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.72)' },
  safetyText: { color: '#047857', fontSize: 11, fontWeight: '800' },
  searchBox: { minHeight: 52, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  sectionSubtitle: { color: colors.mutedText, fontSize: 12, lineHeight: 17, marginTop: 2 },
  categories: { gap: 10 },
  categoryCard: { width: 126, minHeight: 92, padding: 13, justifyContent: 'space-between', borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  categoryActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  categoryTextActive: { color: colors.onAccent },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  linkText: { color: colors.accentText, fontSize: 12, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  error: { padding: 14, borderRadius: 15, backgroundColor: colors.destructiveSurface },
  errorText: { color: colors.destructiveText, lineHeight: 19 },
  empty: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  marketCard: { minHeight: 82, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  marketTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  flex: { flex: 1 },
});
