import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Clock, Heart, MapPin, Package, ShoppingCart, SlidersHorizontal, Star, Store, Wrench } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubCommerce } from '@/lib/hooks/useEHubCommerce';
import { getEHubCurrentPrice, normalizeEHubSalePrice } from '@/lib/services/EHubCommerceService';
import type { EHubCatalogProduct, EHubProvider } from '@/lib/types/ehubDiscovery';

/** Same output as the website's Intl en-TT TTD format (TT$1,234.50), without relying on Hermes Intl data. */
export function formatEHubPrice(amount: number): string {
  const [whole, cents] = Math.max(0, amount).toFixed(2).split('.');
  return `TT$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
}

/** Shared phone/tablet measurements: a centred column up to 1080 wide and the product/provider grid sizes. */
export function useEHubLayout() {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 1080);
  const gutter = width >= 768 ? 24 : 14;
  const innerWidth = contentWidth - gutter * 2;
  const isTablet = width >= 768;
  const isWide = width >= 960;
  const productColumns = width >= 1024 ? 4 : width >= 640 ? 3 : 2;
  const providerColumns = width >= 1024 ? 3 : width >= 600 ? 2 : 1;
  const gap = isTablet ? 14 : 10;
  const columnWidth = (columns: number) => Math.floor((innerWidth - gap * (columns - 1)) / columns);
  return { width, contentWidth, gutter, innerWidth, isTablet, isWide, gap, productWidth: columnWidth(productColumns), providerWidth: columnWidth(providerColumns), columnWidth };
}

type SectionHeadingProps = { eyebrow: string; title: string; description?: string; action?: ReactNode };

export function EHubSectionHeading({ eyebrow, title, description, action }: SectionHeadingProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // On phones the actions sit under the text so the title and description keep the full width.
  const isStacked = useWindowDimensions().width < 600;
  return <View style={isStacked ? styles.headingStacked : styles.heading}>
    <View style={isStacked ? null : styles.flex}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.headingTitle}>{title}</Text>
      {description ? <Text style={styles.headingBody}>{description}</Text> : null}
    </View>
    {action}
  </View>;
}

type LinkButtonProps = { label: string; onPress: () => void };

export function EHubLinkButton({ label, onPress }: LinkButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable accessibilityRole="link" onPress={onPress} hitSlop={6} style={[styles.linkButton]}>
    <Text style={styles.linkText}>{label}</Text><ArrowRight size={15} color={colors.accentText} />
  </Pressable>;
}

type ProductCardProps = {
  product: EHubCatalogProduct;
  width: number;
  onOpen: (productId: string) => void;
  /** Hides the save, cart and compare controls (e.g. the related-product rows on a product page). */
  isCompact?: boolean;
  isCompared?: boolean;
  onCompare?: (productId: string) => void;
  /** Called after the product went into the cart (the website opens its cart drawer then). */
  onAddedToCart?: () => void;
};

/** The website's ProductCard: save heart, stock badge, price, "Add to EHub cart" and the compare toggle. */
export function EHubProductCard({ product, width, onOpen, isCompact = false, isCompared = false, onCompare, onAddedToCart }: ProductCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { addToCart, isFavorite, toggleFavorite } = useEHubCommerce();
  const isAvailable = product.inventory > 0;
  const isSaved = isFavorite(product.id);
  const currentPrice = getEHubCurrentPrice(product.price, product.salePrice);
  const isOnSale = normalizeEHubSalePrice(product.salePrice, product.price) !== null;
  const handleAddToCart = () => {
    const isAdded = addToCart({
      productId: product.id, title: product.title, imageUrl: product.imageUrl ?? '', price: currentPrice,
      originalPrice: isOnSale ? product.price : null, quantity: 1, availableQuantity: product.inventory,
      sellerId: product.storeId, sellerName: product.storeName, deliveryAvailable: product.deliveryAvailable,
      pickupAvailable: product.pickupAvailable, selectedVariant: null, selectedSize: null, selectedColour: null,
    });
    if (isAdded) onAddedToCart?.();
  };
  return <View style={[styles.productCard, { width }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${product.title}`} onPress={() => onOpen(product.id)} android_ripple={{ color: colors.control }}>
      <View style={[styles.productImage, { height: width }]}>
        {product.imageUrl ? <CachedImage uri={product.imageUrl} style={styles.fill} accessibilityLabel={product.title} /> : <Package size={34} color={colors.mutedText} />}
        <View style={styles.stockBadge}><Text style={styles.stockText}>{isAvailable ? `${product.inventory} available` : 'Out of stock'}</Text></View>
      </View>
      <View style={styles.productBody}>
        <Text numberOfLines={1} style={styles.storeName}>{product.storeName}</Text>
        <Text numberOfLines={2} style={styles.productTitle}>{product.title}</Text>
        <Text style={styles.price}>{formatEHubPrice(currentPrice)}</Text>
        {isOnSale ? <Text style={styles.oldPrice}>{formatEHubPrice(product.price)}</Text> : null}
      </View>
    </Pressable>
    {isCompact ? null : <>
      <Pressable accessibilityRole="button" accessibilityLabel={isSaved ? `Remove ${product.title} from favorites` : `Save ${product.title}`} accessibilityState={{ selected: isSaved }} onPress={() => toggleFavorite(product.id, product.title)} hitSlop={4} style={styles.heartButton}>
        <Heart size={17} color={isSaved ? '#f43f5e' : '#334155'} fill={isSaved ? '#f43f5e' : 'transparent'} />
      </Pressable>
      <View style={styles.productActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={isAvailable ? `Add ${product.title} to E-Hub cart` : `${product.title} is unavailable`} accessibilityState={{ disabled: !isAvailable }} disabled={!isAvailable} onPress={handleAddToCart} style={[styles.cartButton, !isAvailable && styles.cartButtonDisabled]}>
          {/* Two-column phone cards are too narrow for the icon and the label together. */}
          {isAvailable && width >= 190 ? <ShoppingCart size={15} color="#ffffff" /> : null}
          <Text numberOfLines={1} style={[styles.cartButtonText, !isAvailable && styles.cartButtonTextDisabled]}>{isAvailable ? 'Add to cart' : 'Unavailable'}</Text>
        </Pressable>
        {onCompare ? <Pressable accessibilityRole="button" accessibilityLabel={`${isCompared ? 'Remove' : 'Add'} ${product.title} ${isCompared ? 'from' : 'to'} comparison`} accessibilityState={{ selected: isCompared }} onPress={() => onCompare(product.id)} style={[styles.compareButton, isCompared && styles.compareButtonActive]}>
          <SlidersHorizontal size={16} color={isCompared ? colors.successText : colors.icon} />
        </Pressable> : null}
      </View>
    </>}
  </View>;
}

type ProviderCardProps = {
  provider: EHubProvider;
  width: number;
  onOpen: (providerId: string) => void;
  actionLabel?: string;
  /** Discover shows the rating as "(n verified interactions)"; the E-Hub home cards do not show ratings. */
  showRating?: boolean;
};

/**
 * A provider's card: cover (photo with a dark fade, or a brand gradient), name, place and verified badge on the
 * cover, the logo overlapping its edge, then up to three services or categories, hours, and "View profile".
 */
export function EHubProviderCard({ provider, width, onOpen, actionLabel = 'View profile', showRating = false }: ProviderCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isProfessional = provider.kind === 'professional' || (provider.offersServices && !provider.offersProducts);
  const label = isProfessional ? 'Professional' : provider.offersServices ? 'Shop + services' : 'Storefront';
  const ProviderIcon = isProfessional ? BriefcaseBusiness : Store;
  const allTags = [...new Set([...provider.services, ...provider.categories])].filter(Boolean);
  const tags = allTags.slice(0, 3);
  const place = provider.nationwide ? 'Nationwide' : provider.location || provider.serviceAreas[0] || '';
  const coverHeight = Math.round(Math.min(width, 520) * 0.5);
  const hasMeta = Boolean(provider.businessHours) || (provider.offersServices && provider.offersProducts) || (showRating && provider.rating !== null);
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${provider.name}, ${label.toLowerCase()}${place ? `, ${place}` : ''}`} onPress={() => onOpen(provider.id)} style={[styles.providerCard, { width }]} android_ripple={{ color: colors.control }}>
    <View style={[styles.cover, { height: coverHeight }]}>
      {provider.coverUrl ? <CachedImage uri={provider.coverUrl} style={styles.fill} /> : <>
        <LinearGradient colors={['#022c22', '#065f46', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.coverRing} />
        <View style={styles.coverIcon}><ProviderIcon size={110} color="rgba(255,255,255,0.09)" /></View>
      </>}
      <LinearGradient colors={['rgba(2,6,23,0)', 'rgba(2,6,23,0.82)']} start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.coverTopRow}>
        <View style={styles.kindBadge}><Text style={styles.kindText}>{label}</Text></View>
        {provider.isVerified ? <View style={styles.verifiedPill}><CheckCircle2 size={13} color="#01eb53" /><Text style={styles.verifiedText}>Verified</Text></View> : null}
      </View>
      <View style={styles.coverText}>
        <Text numberOfLines={1} style={styles.providerName}>{provider.name}</Text>
        {place ? <View style={styles.placeRow}><MapPin size={12} color="rgba(255,255,255,0.8)" /><Text numberOfLines={1} style={styles.placeText}>{place}</Text></View> : null}
      </View>
    </View>
    <View style={styles.providerBody}>
      <View style={styles.logo}>
        <View style={styles.logoInner}>
          {provider.logoUrl ? <CachedImage uri={provider.logoUrl} style={styles.fill} accessibilityLabel={`${provider.name} logo`} /> : <ProviderIcon size={24} color={colors.successText} />}
        </View>
      </View>
      <Text numberOfLines={2} style={styles.providerDescription}>{provider.description || `View this ${label.toLowerCase()} for current information and enquiry options.`}</Text>
      {tags.length ? <View style={styles.tags}>
        {tags.map((tag) => <View key={tag} style={styles.tag}><Text numberOfLines={1} style={styles.tagText}>{tag}</Text></View>)}
        {allTags.length > tags.length ? <View style={styles.tagMore}><Text style={styles.tagMoreText}>+{allTags.length - tags.length}</Text></View> : null}
      </View> : null}
      {hasMeta ? <View style={styles.metaRow}>
        {showRating && provider.rating !== null ? <View style={styles.row}><Star size={13} color="#f59e0b" fill="#f59e0b" /><Text style={styles.ratingText}>{provider.rating.toFixed(1)}</Text><Text style={styles.meta}>({provider.reviewCount} verified interactions)</Text></View> : null}
        {provider.businessHours ? <View style={styles.row}><Clock size={13} color={colors.mutedText} /><Text numberOfLines={1} style={styles.meta}>{provider.businessHours}</Text></View> : null}
        {provider.offersServices && provider.offersProducts ? <View style={styles.row}><Package size={13} color={colors.mutedText} /><Text numberOfLines={1} style={styles.meta}>Services and products</Text></View> : null}
      </View> : null}
      <View style={styles.providerAction}><Text numberOfLines={1} style={styles.providerActionText}>{actionLabel}</Text><ArrowRight size={15} color={colors.successText} /></View>
    </View>
  </Pressable>;
}

type RecruitPanelProps = { onOfferServices: () => void; onOpenDirectory: () => void };

/** Shown where professionals would be listed when none are active yet: invites people to list their services. */
export function EHubRecruitPanel({ onOfferServices, onOpenDirectory }: RecruitPanelProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.recruit}>
    <LinearGradient colors={['#022c22', '#064e3b', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={styles.recruitRing} />
    <View style={styles.recruitIconOuter}><View style={styles.recruitIconInner}><Wrench size={26} color="#ffffff" /></View></View>
    <Text style={styles.recruitTitle}>Be the first professional on E-Hub</Text>
    <Text style={styles.recruitBody}>Plumbers, designers, tutors, caterers: list your services and the areas you cover, and get enquiries from people nearby.</Text>
    <View style={styles.recruitActions}>
      <Pressable accessibilityRole="button" onPress={onOfferServices} style={[styles.recruitPrimary]}><Text style={styles.recruitPrimaryText}>Offer your services</Text><ArrowRight size={16} color="#022c22" /></Pressable>
      <Pressable accessibilityRole="link" onPress={onOpenDirectory} style={[styles.recruitSecondary]}><Text style={styles.recruitSecondaryText}>Open directory</Text></Pressable>
    </View>
  </View>;
}

type NoticeProps = { tone: 'error' | 'warning' | 'success'; text: string; actionLabel?: string; onAction?: () => void };

export function EHubNotice({ tone, text, actionLabel, onAction }: NoticeProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const background = tone === 'error' ? colors.destructiveSurface : tone === 'warning' ? colors.warningSurface : colors.successSurface;
  const foreground = tone === 'error' ? colors.destructiveText : tone === 'warning' ? colors.warningText : colors.successText;
  return <View accessibilityRole={tone === 'error' ? 'alert' : 'text'} style={[styles.notice, { backgroundColor: background }]}>
    <Text style={[styles.noticeText, { color: foreground }]}>{text}</Text>
    {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={6} style={[styles.noticeButton, { borderColor: foreground }]}><Text style={[styles.noticeButtonText, { color: foreground }]}>{actionLabel}</Text></Pressable> : null}
  </View>;
}

type EmptyProps = { icon: ReactNode; title: string; body?: string; actionLabel?: string; onAction?: () => void };

export function EHubEmptyState({ icon, title, body, actionLabel, onAction }: EmptyProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.empty}>
    <View style={styles.emptyIcon}>{icon}</View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={[styles.primaryButton]}><Text style={styles.primaryButtonText}>{actionLabel}</Text></Pressable> : null}
  </View>;
}

type ChipProps = { label: string; selected: boolean; onPress: () => void };

export function EHubChip({ label, selected, onPress }: ChipProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
    <Text numberOfLines={1} style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </Pressable>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    fill: { width: '100%', height: '100%' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0, flexShrink: 1 },
    pressed: { opacity: 0.86 },
    cardPressed: { transform: [{ scale: 0.985 }] },
    heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
    headingStacked: { gap: 10 },
    eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
    headingTitle: { marginTop: 4, color: colors.text, fontSize: 24, lineHeight: 29, fontWeight: '900' },
    headingBody: { marginTop: 4, color: colors.mutedText, fontSize: 13, lineHeight: 19 },
    linkButton: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    linkText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
    productCard: { overflow: 'hidden', borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#020617', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    heartButton: { position: 'absolute', top: 8, right: 8, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)' },
    productActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 11, paddingBottom: 11 },
    cartButton: { flex: 1, minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: '#047857' },
    cartButtonDisabled: { backgroundColor: colors.disabled },
    cartButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
    cartButtonTextDisabled: { color: colors.disabledText },
    compareButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    compareButtonActive: { borderColor: colors.accent, backgroundColor: colors.successSurface },
    productImage: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, overflow: 'hidden' },
    stockBadge: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.85)' },
    stockText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
    productBody: { padding: 11, gap: 3 },
    storeName: { color: colors.accentText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    productTitle: { minHeight: 36, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '800' },
    price: { marginTop: 3, color: colors.successText, fontSize: 17, fontWeight: '900' },
    oldPrice: { color: colors.mutedText, fontSize: 11, fontWeight: '700', textDecorationLine: 'line-through' },
    providerCard: { overflow: 'hidden', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#020617', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
    cover: { overflow: 'hidden', backgroundColor: '#022c22' },
    coverRing: { position: 'absolute', right: -40, top: -60, width: 170, height: 170, borderRadius: 85, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
    coverIcon: { position: 'absolute', right: 14, bottom: -14 },
    coverTopRow: { position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    kindBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(2,6,23,0.6)' },
    kindText: { color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
    verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.6)' },
    verifiedText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
    coverText: { position: 'absolute', left: 14, right: 84, bottom: 12, gap: 3 },
    providerName: { color: '#ffffff', fontSize: 19, lineHeight: 23, fontWeight: '900' },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    placeText: { flexShrink: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
    logo: { position: 'absolute', right: 14, top: -30, width: 60, height: 60, overflow: 'hidden', borderRadius: 30, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.surface },
    logoInner: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 27, backgroundColor: colors.successSurface },
    providerBody: { flex: 1, padding: 14, paddingTop: 12, gap: 10 },
    providerDescription: { marginRight: 62, color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
    meta: { flexShrink: 1, color: colors.mutedText, fontSize: 12, lineHeight: 17 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
    ratingText: { color: colors.text, fontSize: 12, fontWeight: '900' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.successSurface },
    tagText: { color: colors.successText, fontSize: 11, fontWeight: '800' },
    tagMore: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.control },
    tagMoreText: { color: colors.secondaryText, fontSize: 11, fontWeight: '800' },
    providerAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
    providerActionText: { flexShrink: 1, color: colors.successText, fontSize: 14, fontWeight: '800' },
    recruit: { overflow: 'hidden', padding: 22, gap: 12, borderRadius: 24, backgroundColor: '#064e3b' },
    recruitRing: { position: 'absolute', right: -60, top: -70, width: 220, height: 220, borderRadius: 110, borderWidth: 30, borderColor: 'rgba(255,255,255,0.05)' },
    recruitIconOuter: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.08)' },
    recruitIconInner: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: '#10b981' },
    recruitTitle: { color: '#ffffff', fontSize: 21, lineHeight: 26, fontWeight: '900' },
    recruitBody: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 20 },
    recruitActions: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    recruitPrimary: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: '#01eb53' },
    recruitPrimaryText: { color: '#022c22', fontSize: 14, fontWeight: '900' },
    recruitSecondary: { minHeight: 46, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    recruitSecondaryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    notice: { padding: 13, borderRadius: 14, gap: 10 },
    noticeText: { fontSize: 13, lineHeight: 19 },
    noticeButton: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
    noticeButtonText: { fontSize: 13, fontWeight: '800' },
    empty: { paddingVertical: 30, paddingHorizontal: 20, alignItems: 'center', gap: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    emptyIcon: { width: 72, height: 72, marginBottom: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 36, backgroundColor: colors.control },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
    emptyBody: { maxWidth: 360, color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    primaryButton: { marginTop: 6, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 13, backgroundColor: '#047857' },
    primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    chip: { minHeight: 40, maxWidth: 220, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    chipSelected: { backgroundColor: colors.successSurface, borderColor: colors.accent },
    chipText: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
    chipTextSelected: { color: colors.successText, fontWeight: '800' },
  });
}
