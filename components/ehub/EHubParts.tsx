import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowRight, BriefcaseBusiness, Check, CheckCircle2, ChevronRight, Clock, Heart, MapPin, Package, ShoppingCart, Star, Store, Wrench } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubCommerce } from '@/lib/hooks/useEHubCommerce';
import { getEHubCurrentPrice, normalizeEHubSalePrice } from '@/lib/services/EHubCommerceService';
import type { EHubCatalogProduct, EHubProvider } from '@/lib/types/ehubDiscovery';

/**
 * Fill for primary E-Hub buttons. Brand #10b981 under white text is only ~2.5:1, so filled buttons use the darker
 * emerald (5.5:1); the theme's accent stays for borders, selected states and indicators.
 */
export const EHUB_ACTION_GREEN = '#047857';
/** Products with this many or fewer left show "Only N left" (Baymard: show scarcity only when it is real). */
export const EHUB_LOW_STOCK_THRESHOLD = 5;

/** Same output as the website's Intl en-TT TTD format (TT$1,234.50), without relying on Hermes Intl data. */
export function formatEHubPrice(amount: number): string {
  const [whole, cents] = Math.max(0, amount).toFixed(2).split('.');
  return `TT$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
}

export type EHubStockStatus = { tone: 'out' | 'low' | 'in'; label: string };

/** "Out of stock", "Only N left" (5 or fewer) or "In stock": shared by the cards and the comparison. */
export function getEHubStockStatus(inventory: number): EHubStockStatus {
  if (inventory <= 0) return { tone: 'out', label: 'Out of stock' };
  if (inventory <= EHUB_LOW_STOCK_THRESHOLD) return { tone: 'low', label: `Only ${inventory} left` };
  return { tone: 'in', label: 'In stock' };
}

/** Whole-percent saving for a sale, or null when the product is not on sale. */
export function getEHubDiscountPercent(price: number, salePrice: number | null): number | null {
  const normalizedSale = normalizeEHubSalePrice(salePrice, price);
  if (normalizedSale === null || price <= 0) return null;
  const percent = Math.round((1 - normalizedSale / price) * 100);
  return percent > 0 ? percent : null;
}

/** Shared phone/tablet measurements on a 4/8 scale: a centred column up to 1080 wide and the product/provider grid sizes. */
export function useEHubLayout() {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 1080);
  const gutter = width >= 768 ? 24 : 16;
  const innerWidth = contentWidth - gutter * 2;
  const isTablet = width >= 768;
  const isWide = width >= 960;
  const productColumns = width >= 1024 ? 4 : width >= 640 ? 3 : 2;
  const providerColumns = width >= 1024 ? 3 : width >= 600 ? 2 : 1;
  const gap = isTablet ? 16 : 12;
  const columnWidth = (columns: number) => Math.floor((innerWidth - gap * (columns - 1)) / columns);
  return { width, contentWidth, gutter, innerWidth, isTablet, isWide, gap, productWidth: columnWidth(productColumns), providerWidth: columnWidth(providerColumns), columnWidth };
}

type SectionHeadingProps = { eyebrow: string; title: string; description?: string; action?: ReactNode };

/**
 * Eyebrow and title on the left with the action (usually "See all") on the same line at the right, and the
 * description under both at full width. The title shrinks and wraps beside the action instead of pushing it away.
 */
export function EHubSectionHeading({ eyebrow, title, description, action }: SectionHeadingProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.heading}>
    <View style={styles.headingRow}>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.headingTitle}>{title}</Text>
      </View>
      {action ? <View style={styles.headingAction}>{action}</View> : null}
    </View>
    {description ? <Text style={styles.headingBody}>{description}</Text> : null}
  </View>;
}

type LinkButtonProps = { label: string; onPress: () => void };

/** A text link with a chevron ("See all ›"): 44 tall and borderless, so it reads as navigation rather than another button. */
export function EHubLinkButton({ label, onPress }: LinkButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable accessibilityRole="link" onPress={onPress} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={[styles.linkButton]}>
    <Text numberOfLines={1} style={styles.linkText}>{label}</Text><ChevronRight size={16} color={colors.accentText} />
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
  /** Called after the product went into the cart. */
  onAddedToCart?: () => void;
  /** Called when quick-add is pressed while the product is already in the cart (the button shows "in cart" then). */
  onOpenCart?: () => void;
};

/**
 * A catalog card in the Baymard/NN/g order: the whole card opens the product; the image carries the save heart and at
 * most one badge (the sale percentage); a two-line title; the price as the strongest text, with the old price struck
 * through; the store as one muted line; stock only when it matters ("Only 3 left", "Out of stock"). Underneath, a
 * labelled Compare checkbox and a compact quick-add icon button that turns into a check once the product is in the
 * cart. Three type sizes: 16, 14 and 12.
 */
export function EHubProductCard({ product, width, onOpen, isCompact = false, isCompared = false, onCompare, onAddedToCart, onOpenCart }: ProductCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cart, addToCart, isFavorite, toggleFavorite } = useEHubCommerce();
  const isAvailable = product.inventory > 0;
  const isSaved = isFavorite(product.id);
  const isInCart = cart.some((item) => item.productId === product.id);
  const currentPrice = getEHubCurrentPrice(product.price, product.salePrice);
  const isOnSale = normalizeEHubSalePrice(product.salePrice, product.price) !== null;
  const discountPercent = getEHubDiscountPercent(product.price, product.salePrice);
  const stock = getEHubStockStatus(product.inventory);
  const stockColor = stock.tone === 'out' ? colors.destructiveText : colors.warningText;
  const handleAddToCart = () => {
    if (isInCart) { (onOpenCart ?? onAddedToCart)?.(); return; }
    const isAdded = addToCart({
      productId: product.id, title: product.title, imageUrl: product.imageUrl ?? '', price: currentPrice,
      originalPrice: isOnSale ? product.price : null, quantity: 1, availableQuantity: product.inventory,
      sellerId: product.storeId, sellerName: product.storeName, deliveryAvailable: product.deliveryAvailable,
      pickupAvailable: product.pickupAvailable, selectedVariant: null, selectedSize: null, selectedColour: null,
    });
    if (isAdded) onAddedToCart?.();
  };
  const priceLabel = isOnSale ? `${formatEHubPrice(currentPrice)}, was ${formatEHubPrice(product.price)}` : formatEHubPrice(currentPrice);
  const cartLabel = !isAvailable ? `${product.title} is out of stock` : isInCart ? `${product.title} is in your cart. Open cart` : `Add ${product.title} to cart`;
  return <View style={[styles.productCard, { width }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${product.title}, ${priceLabel}, from ${product.storeName}${stock.tone === 'in' ? '' : `, ${stock.label}`}`} onPress={() => onOpen(product.id)} android_ripple={{ color: colors.control }} style={styles.productMain}>
      <View style={[styles.productImage, { height: width }]}>
        {product.imageUrl ? <View style={[styles.fill, !isAvailable && styles.imageMuted]}><CachedImage uri={product.imageUrl} style={styles.fill} accessibilityLabel={product.title} /></View> : <Package size={34} color={colors.mutedText} />}
        {discountPercent ? <View style={styles.saleBadge}><Text style={styles.saleBadgeText}>-{discountPercent}%</Text></View> : null}
      </View>
      <View style={styles.productBody}>
        <Text numberOfLines={2} style={styles.productTitle}>{product.title}</Text>
        <View style={styles.priceRow}>
          <Text numberOfLines={1} style={[styles.price, isOnSale && { color: colors.destructiveText }]}>{formatEHubPrice(currentPrice)}</Text>
          {isOnSale ? <Text numberOfLines={1} style={styles.oldPrice}>{formatEHubPrice(product.price)}</Text> : null}
        </View>
        <Text numberOfLines={1} style={styles.storeName}>{product.storeName}</Text>
        {stock.tone === 'in' ? null : <Text numberOfLines={1} style={[styles.stockText, { color: stockColor }]}>{stock.label}</Text>}
      </View>
    </Pressable>
    {isCompact ? null : <>
      <Pressable accessibilityRole="button" accessibilityLabel={isSaved ? `Remove ${product.title} from saved` : `Save ${product.title}`} accessibilityState={{ selected: isSaved }} onPress={() => toggleFavorite(product.id, product.title)} hitSlop={5} style={styles.heartButton}>
        <Heart size={17} color={isSaved ? '#e11d48' : '#334155'} fill={isSaved ? '#e11d48' : 'transparent'} />
      </Pressable>
      <View style={styles.productFooter}>
        {onCompare ? <Pressable accessibilityRole="checkbox" accessibilityLabel={`Compare ${product.title}`} accessibilityState={{ checked: isCompared }} onPress={() => onCompare(product.id)} style={styles.compareToggle}>
          <View style={[styles.checkbox, isCompared && styles.checkboxChecked]}>{isCompared ? <Check size={12} color="#ffffff" strokeWidth={3} /> : null}</View>
          <Text numberOfLines={1} style={[styles.compareText, isCompared && styles.compareTextChecked]}>Compare</Text>
        </Pressable> : <View style={styles.flex} />}
        <Pressable accessibilityRole="button" accessibilityLabel={cartLabel} accessibilityState={{ disabled: !isAvailable }} disabled={!isAvailable} onPress={handleAddToCart} hitSlop={4} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={[styles.quickAdd, isInCart && styles.quickAddInCart, !isAvailable && styles.quickAddDisabled]}>
          {isInCart ? <Check size={18} color={colors.successText} strokeWidth={2.6} /> : <ShoppingCart size={18} color={isAvailable ? '#ffffff' : colors.disabledText} />}
        </Pressable>
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
  // Two tags on a phone carousel card, three when there is room: more than that wraps into a cluttered block.
  const tags = allTags.slice(0, width < 320 ? 2 : 3);
  const place = provider.nationwide ? 'Nationwide' : provider.location || provider.serviceAreas[0] || '';
  const coverHeight = Math.round(Math.min(width, 520) * 0.5);
  // "Services and products" is not repeated here: the cover badge already says "Shop + services".
  const hasMeta = Boolean(provider.businessHours) || (showRating && provider.rating !== null);
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${provider.name}, ${label.toLowerCase()}${place ? `, ${place}` : ''}`} onPress={() => onOpen(provider.id)} style={[styles.providerCard, { width }]} android_ripple={{ color: colors.control }}>
    <View style={[styles.cover, { height: coverHeight }]}>
      {provider.coverUrl ? <CachedImage uri={provider.coverUrl} style={styles.fill} /> : <>
        <LinearGradient colors={['#022c22', '#065f46', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.coverRing} />
        <View style={styles.coverIcon}><ProviderIcon size={110} color="rgba(255,255,255,0.09)" /></View>
      </>}
      <LinearGradient colors={['rgba(2,6,23,0)', 'rgba(2,6,23,0.82)']} start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.coverTopRow}>
        <View style={styles.kindBadge}><Text numberOfLines={1} style={styles.kindText}>{label}</Text></View>
        {provider.isVerified ? <View style={styles.verifiedPill}><CheckCircle2 size={13} color="#01eb53" /><Text numberOfLines={1} style={styles.verifiedText}>Verified</Text></View> : null}
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
        {showRating && provider.rating !== null ? <View style={styles.row}><Star size={13} color="#f59e0b" fill="#f59e0b" /><Text style={styles.ratingText}>{provider.rating.toFixed(1)}</Text><Text numberOfLines={1} style={styles.meta}>({provider.reviewCount} verified interactions)</Text></View> : null}
        {provider.businessHours ? <View style={styles.row}><Clock size={13} color={colors.mutedText} /><Text numberOfLines={1} style={styles.meta}>{provider.businessHours}</Text></View> : null}
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
      <Pressable accessibilityRole="button" onPress={onOfferServices} style={[styles.recruitPrimary]}><Text numberOfLines={1} style={styles.recruitPrimaryText}>Offer your services</Text><ArrowRight size={16} color="#022c22" /></Pressable>
      <Pressable accessibilityRole="link" onPress={onOpenDirectory} style={[styles.recruitSecondary]}><Text numberOfLines={1} style={styles.recruitSecondaryText}>Open directory</Text></Pressable>
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
    {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={6} style={[styles.noticeButton, { borderColor: foreground }]}><Text numberOfLines={1} style={[styles.noticeButtonText, { color: foreground }]}>{actionLabel}</Text></Pressable> : null}
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
    {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={[styles.primaryButton]}><Text numberOfLines={1} style={styles.primaryButtonText}>{actionLabel}</Text></Pressable> : null}
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
    flex: { flex: 1, minWidth: 0 },
    fill: { width: '100%', height: '100%' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0, flexShrink: 1 },
    heading: { gap: 4 },
    headingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
    headingAction: { flexShrink: 0, marginBottom: -8 },
    eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
    headingTitle: { marginTop: 4, color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '900' },
    headingBody: { color: colors.mutedText, fontSize: 13, lineHeight: 20 },
    linkButton: { minHeight: 44, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 2 },
    linkText: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
    // Hairline border and a tonal surface instead of a heavy shadow; 16 radius like every E-Hub card.
    productCard: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    productMain: { flex: 1 },
    heartButton: { position: 'absolute', top: 6, right: 6, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.95)' },
    productImage: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, overflow: 'hidden' },
    imageMuted: { opacity: 0.5 },
    saleBadge: { position: 'absolute', left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#b91c1c' },
    saleBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
    productBody: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 4 },
    productTitle: { minHeight: 38, color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '600' },
    priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
    price: { flexShrink: 1, color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '800' },
    oldPrice: { flexShrink: 1, color: colors.mutedText, fontSize: 12, textDecorationLine: 'line-through' },
    storeName: { color: colors.mutedText, fontSize: 12, lineHeight: 16 },
    stockText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
    productFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 8, paddingBottom: 8 },
    compareToggle: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkbox: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 5, borderWidth: 1.5, borderColor: colors.mutedText },
    checkboxChecked: { borderColor: EHUB_ACTION_GREEN, backgroundColor: EHUB_ACTION_GREEN },
    compareText: { flexShrink: 1, color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
    compareTextChecked: { color: colors.successText, fontWeight: '800' },
    quickAdd: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: EHUB_ACTION_GREEN },
    quickAddInCart: { backgroundColor: colors.successSurface, borderWidth: 1, borderColor: colors.accent },
    quickAddDisabled: { backgroundColor: colors.disabled },
    providerCard: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    cover: { overflow: 'hidden', backgroundColor: '#022c22' },
    coverRing: { position: 'absolute', right: -40, top: -60, width: 170, height: 170, borderRadius: 85, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
    coverIcon: { position: 'absolute', right: 14, bottom: -14 },
    coverTopRow: { position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    kindBadge: { flexShrink: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(2,6,23,0.6)' },
    kindText: { color: '#ffffff', fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
    verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.6)' },
    verifiedText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
    coverText: { position: 'absolute', left: 14, right: 84, bottom: 12, gap: 3 },
    providerName: { color: '#ffffff', fontSize: 19, lineHeight: 23, fontWeight: '900' },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    placeText: { flexShrink: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
    logo: { position: 'absolute', right: 14, top: -30, width: 60, height: 60, overflow: 'hidden', borderRadius: 30, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.surface },
    logoInner: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 27, backgroundColor: colors.successSurface },
    providerBody: { flex: 1, padding: 16, paddingTop: 12, gap: 8 },
    providerDescription: { marginRight: 62, color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
    meta: { flexShrink: 1, color: colors.mutedText, fontSize: 12, lineHeight: 17 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
    ratingText: { color: colors.text, fontSize: 12, fontWeight: '900' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.successSurface },
    tagText: { color: colors.successText, fontSize: 12, fontWeight: '800' },
    tagMore: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.control },
    tagMoreText: { color: colors.secondaryText, fontSize: 12, fontWeight: '800' },
    providerAction: { marginTop: 'auto', minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
    providerActionText: { flexShrink: 1, color: colors.successText, fontSize: 14, fontWeight: '800' },
    recruit: { overflow: 'hidden', padding: 22, gap: 12, borderRadius: 24, backgroundColor: '#064e3b' },
    recruitRing: { position: 'absolute', right: -60, top: -70, width: 220, height: 220, borderRadius: 110, borderWidth: 30, borderColor: 'rgba(255,255,255,0.05)' },
    recruitIconOuter: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.08)' },
    recruitIconInner: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: '#10b981' },
    recruitTitle: { color: '#ffffff', fontSize: 21, lineHeight: 26, fontWeight: '900' },
    recruitBody: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 20 },
    recruitActions: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    recruitPrimary: { maxWidth: '100%', minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: '#01eb53' },
    recruitPrimaryText: { flexShrink: 1, color: '#022c22', fontSize: 14, fontWeight: '900' },
    recruitSecondary: { maxWidth: '100%', minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    recruitSecondaryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    notice: { padding: 13, borderRadius: 14, gap: 10 },
    noticeText: { fontSize: 13, lineHeight: 19 },
    noticeButton: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
    noticeButtonText: { fontSize: 13, fontWeight: '800' },
    empty: { paddingVertical: 30, paddingHorizontal: 20, alignItems: 'center', gap: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    emptyIcon: { width: 72, height: 72, marginBottom: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 36, backgroundColor: colors.control },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
    emptyBody: { maxWidth: 360, color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    primaryButton: { maxWidth: '100%', marginTop: 8, minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12, backgroundColor: EHUB_ACTION_GREEN },
    primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    chip: { minHeight: 40, maxWidth: 220, flexShrink: 0, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    chipSelected: { backgroundColor: colors.successSurface, borderColor: colors.accent },
    chipText: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
    chipTextSelected: { color: colors.successText, fontWeight: '800' },
  });
}
