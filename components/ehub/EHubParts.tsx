import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowRight, BadgeCheck, Building2, MapPin, Package, Star, UserRound } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
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

type ProductCardProps = { product: EHubCatalogProduct; width: number; onOpen: (productId: string) => void };

export function EHubProductCard({ product, width, onOpen }: ProductCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isAvailable = product.inventory > 0;
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${product.title}`} onPress={() => onOpen(product.id)} style={({ pressed }) => [styles.productCard, { width }, pressed && styles.pressed]}>
    <View style={[styles.productImage, { height: width }]}>
      {product.imageUrl ? <CachedImage uri={product.imageUrl} style={styles.fill} accessibilityLabel={product.title} /> : <Package size={34} color={colors.mutedText} />}
      <View style={styles.stockBadge}><Text style={styles.stockText}>{isAvailable ? `${product.inventory} available` : 'Out of stock'}</Text></View>
    </View>
    <View style={styles.productBody}>
      <Text numberOfLines={1} style={styles.storeName}>{product.storeName}</Text>
      <Text numberOfLines={2} style={styles.productTitle}>{product.title}</Text>
      <Text style={styles.price}>{formatEHubPrice(product.salePrice ?? product.price)}</Text>
      {product.salePrice !== null ? <Text style={styles.oldPrice}>{formatEHubPrice(product.price)}</Text> : null}
    </View>
  </Pressable>;
}

type ProviderCardProps = { provider: EHubProvider; width: number; onOpen: (providerId: string) => void; actionLabel?: string };

export function EHubProviderCard({ provider, width, onOpen, actionLabel = 'View profile' }: ProviderCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const label = provider.kind === 'professional' ? 'Professional' : 'Storefront';
  const tags = [...new Set([...provider.categories, ...provider.services])].slice(0, 3);
  const place = provider.nationwide ? 'Nationwide' : provider.location || provider.serviceAreas[0] || '';
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${provider.name}`} onPress={() => onOpen(provider.id)} style={({ pressed }) => [styles.providerCard, { width }, pressed && styles.pressed]}>
    <View style={styles.cover}>
      {provider.coverUrl ? <CachedImage uri={provider.coverUrl} style={styles.fill} /> : null}
      <View style={styles.kindBadge}><Text style={styles.kindText}>{label}</Text></View>
    </View>
    <View style={styles.providerBody}>
      <View style={styles.providerTop}>
        <View style={styles.logo}>
          {provider.logoUrl ? <CachedImage uri={provider.logoUrl} style={styles.fill} accessibilityLabel={`${provider.name} logo`} /> : provider.kind === 'professional' ? <UserRound size={24} color={colors.mutedText} /> : <Building2 size={24} color={colors.mutedText} />}
        </View>
        <View style={styles.providerNameBlock}>
          <View style={styles.row}><Text numberOfLines={1} style={styles.providerName}>{provider.name}</Text>{provider.isVerified ? <BadgeCheck size={16} color={colors.accent} accessibilityLabel="Verified" /> : null}</View>
          {place ? <View style={styles.row}><MapPin size={13} color={colors.mutedText} /><Text numberOfLines={1} style={styles.meta}>{place}</Text></View> : null}
        </View>
      </View>
      <Text numberOfLines={2} style={styles.providerDescription}>{provider.description || `View this ${label.toLowerCase()} for current information and enquiry options.`}</Text>
      {provider.rating !== null ? <View style={styles.row}><Star size={13} color="#f59e0b" fill="#f59e0b" /><Text style={styles.ratingText}>{provider.rating.toFixed(1)}</Text><Text style={styles.meta}>({provider.reviewCount})</Text></View> : null}
      {tags.length ? <View style={styles.tags}>{tags.map((tag) => <View key={tag} style={styles.tag}><Text numberOfLines={1} style={styles.tagText}>{tag}</Text></View>)}</View> : null}
      <View style={styles.providerAction}><Text style={styles.linkText}>{actionLabel}</Text><ArrowRight size={15} color={colors.accentText} /></View>
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
    productImage: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, overflow: 'hidden' },
    stockBadge: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.85)' },
    stockText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
    productBody: { padding: 11, gap: 3 },
    storeName: { color: colors.accentText, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    productTitle: { minHeight: 36, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
    price: { marginTop: 3, color: colors.text, fontSize: 16, fontWeight: '900' },
    oldPrice: { color: colors.mutedText, fontSize: 11, fontWeight: '700', textDecorationLine: 'line-through' },
    providerCard: { overflow: 'hidden', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    cover: { height: 96, backgroundColor: colors.successSurface, overflow: 'hidden' },
    kindBadge: { position: 'absolute', left: 12, top: 12, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.85)' },
    kindText: { color: '#ffffff', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    providerBody: { padding: 14, gap: 9 },
    providerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    logo: { width: 62, height: 62, marginTop: -40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 18, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.control },
    providerNameBlock: { flex: 1, minWidth: 0, gap: 3 },
    providerName: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '900' },
    meta: { flexShrink: 1, color: colors.mutedText, fontSize: 12 },
    providerDescription: { minHeight: 36, color: colors.secondaryText, fontSize: 12, lineHeight: 18 },
    ratingText: { color: colors.text, fontSize: 12, fontWeight: '900' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { maxWidth: '100%', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.successSurface },
    tagText: { color: colors.successText, fontSize: 11, fontWeight: '800' },
    providerAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
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
