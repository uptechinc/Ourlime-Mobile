import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Heart, MapPin, Package, SlidersHorizontal, Star, Store } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CachedImage from '@/components/ui/CachedImage';
import { Skeleton } from '@/components/ui/Skeleton';
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
  return <View style={styles.heading}>
    <View style={styles.flex}>
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
  return <Pressable accessibilityRole="link" onPress={onPress} hitSlop={6} style={styles.linkButton}>
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
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !isAvailable }} disabled={!isAvailable} onPress={handleAddToCart} style={[styles.cartButton, !isAvailable && styles.cartButtonDisabled]}>
          <Text numberOfLines={1} style={[styles.cartButtonText, !isAvailable && styles.cartButtonTextDisabled]}>{isAvailable ? 'Add to E-Hub cart' : 'Unavailable'}</Text>
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

/** The website's ProviderCard: gradient cover with circles when there is no cover photo, logo, two tags and a "View profile" pill. */
export function EHubProviderCard({ provider, width, onOpen, actionLabel = 'View profile', showRating = false }: ProviderCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const label = provider.kind === 'professional' ? 'Professional' : 'Storefront';
  const ProviderIcon = provider.kind === 'professional' ? BriefcaseBusiness : Store;
  const tags = [...new Set([...provider.categories, ...provider.services])].slice(0, 2);
  const place = provider.nationwide ? 'Nationwide' : provider.location;
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${provider.name}`} onPress={() => onOpen(provider.id)} style={[styles.providerCard, { width }]} android_ripple={{ color: colors.control }}>
    <View style={styles.cover}>
      <LinearGradient colors={['#022c22', '#047857', '#a3e635']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {provider.coverUrl ? <CachedImage uri={provider.coverUrl} style={styles.fill} /> : <>
        <View style={styles.coverRing} />
        <View style={styles.coverCircle} />
      </>}
      <View style={styles.kindBadge}><Text style={styles.kindText}>{label}</Text></View>
    </View>
    <View style={styles.providerBody}>
      <View style={styles.logo}>
        <View style={styles.logoInner}>
          {provider.logoUrl ? <CachedImage uri={provider.logoUrl} style={styles.fill} accessibilityLabel={`${provider.name} logo`} /> : <ProviderIcon size={26} color="#047857" />}
        </View>
      </View>
      <View style={styles.nameRow}>
        <Text numberOfLines={2} style={styles.providerName}>{provider.name}</Text>
        {provider.isVerified ? <View style={styles.verifiedDot}><CheckCircle2 size={15} color="#059669" accessibilityLabel="Verified" /></View> : null}
      </View>
      {place ? <View style={styles.placeRow}><MapPin size={13} color={colors.mutedText} style={styles.placeIcon} /><Text numberOfLines={2} style={styles.meta}>{place}</Text></View> : null}
      <Text numberOfLines={2} style={styles.providerDescription}>{provider.description || `View this ${label.toLowerCase()} for current information and enquiry options.`}</Text>
      {showRating && provider.rating !== null ? <View style={styles.row}><Star size={13} color="#f59e0b" fill="#f59e0b" /><Text style={styles.ratingText}>{provider.rating.toFixed(1)}</Text><Text style={styles.meta}>({provider.reviewCount} verified interactions)</Text></View> : null}
      {tags.length ? <View style={styles.tags}>{tags.map((tag) => <View key={tag} style={styles.tag}><Text numberOfLines={1} style={styles.tagText}>{tag}</Text></View>)}</View> : null}
      <View style={styles.providerAction}><Text numberOfLines={1} style={styles.providerActionText}>{actionLabel}</Text><ArrowRight size={15} color={colors.successText} /></View>
    </View>
  </Pressable>;
}

export function EHubGridSkeleton({ count, width, height }: { count: number; width: number; height: number }) {
  const { gap } = useEHubLayout();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{Array.from({ length: count }, (_, index) => <Skeleton key={index} width={width} height={height} borderRadius={18} />)}</View>;
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
    {icon}
    <Text style={styles.emptyTitle}>{title}</Text>
    {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.darkButton}><Text style={styles.darkButtonText}>{actionLabel}</Text></Pressable> : null}
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
    row: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
    pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
    heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
    eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
    headingTitle: { marginTop: 4, color: colors.text, fontSize: 22, lineHeight: 27, fontWeight: '900' },
    headingBody: { marginTop: 4, color: colors.mutedText, fontSize: 13, lineHeight: 19 },
    linkButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
    linkText: { color: colors.accentText, fontSize: 13, fontWeight: '900' },
    productCard: { overflow: 'hidden', borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    heartButton: { position: 'absolute', top: 8, right: 8, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)' },
    productActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 11, paddingBottom: 11 },
    cartButton: { flex: 1, minHeight: 42, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#059669' },
    cartButtonDisabled: { backgroundColor: colors.disabled },
    cartButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
    cartButtonTextDisabled: { color: colors.disabledText },
    compareButton: { width: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    compareButtonActive: { borderColor: '#059669', backgroundColor: colors.successSurface },
    productImage: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, overflow: 'hidden' },
    stockBadge: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.85)' },
    stockText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
    productBody: { padding: 11, gap: 3 },
    storeName: { color: colors.accentText, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    productTitle: { minHeight: 36, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
    price: { marginTop: 3, color: colors.text, fontSize: 16, fontWeight: '900' },
    oldPrice: { color: colors.mutedText, fontSize: 11, fontWeight: '700', textDecorationLine: 'line-through' },
    providerCard: { overflow: 'hidden', borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    cover: { height: 128, overflow: 'hidden' },
    coverRing: { position: 'absolute', right: -32, top: -48, width: 128, height: 128, borderRadius: 64, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    coverCircle: { position: 'absolute', right: 48, bottom: -64, width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(255,255,255,0.1)' },
    kindBadge: { position: 'absolute', left: 16, top: 16, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(2,6,23,0.8)' },
    kindText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
    providerBody: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, paddingTop: 44, gap: 8 },
    logo: { position: 'absolute', top: -32, left: 18, width: 64, height: 64, overflow: 'hidden', borderRadius: 18, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.surface },
    logoInner: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 13, backgroundColor: '#ecfccb' },
    nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    providerName: { flex: 1, minWidth: 0, color: colors.text, fontSize: 16, lineHeight: 20, fontWeight: '900' },
    verifiedDot: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.successSurface },
    placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
    placeIcon: { marginTop: 2 },
    meta: { flexShrink: 1, color: colors.mutedText, fontSize: 12, lineHeight: 18 },
    providerDescription: { minHeight: 36, color: colors.secondaryText, fontSize: 12, lineHeight: 18 },
    ratingText: { color: colors.text, fontSize: 12, fontWeight: '900' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.control },
    tagText: { color: colors.secondaryText, fontSize: 10, fontWeight: '800' },
    providerAction: { marginTop: 4, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 13, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: colors.successSurface },
    providerActionText: { flexShrink: 1, color: colors.successText, fontSize: 14, fontWeight: '900' },
    notice: { padding: 13, borderRadius: 15, gap: 10 },
    noticeText: { fontSize: 13, lineHeight: 19 },
    noticeButton: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
    noticeButtonText: { fontSize: 13, fontWeight: '900' },
    empty: { paddingVertical: 36, paddingHorizontal: 20, alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
    emptyBody: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    darkButton: { marginTop: 6, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 13, backgroundColor: colors.text },
    darkButtonText: { color: colors.canvas, fontSize: 13, fontWeight: '900' },
    chip: { minHeight: 40, maxWidth: 220, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 13, backgroundColor: colors.control },
    chipSelected: { backgroundColor: colors.accent },
    chipText: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
    chipTextSelected: { color: colors.onAccent },
  });
}
