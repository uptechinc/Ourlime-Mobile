import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BadgeCheck, Building2, ChevronDown, ChevronRight, MapPin, MessageCircle, Minus, Plus, Star, Store } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { EHubProductCard } from '@/components/ehub/EHubParts';
import type { EHubCatalogProduct, EHubPublicStoreSummary } from '@/lib/types/ehubDiscovery';

/** Spacing and shape shared by the product page pieces (8pt grid, 16 gutters, 12–16 radii, hairline borders). */
export const PRODUCT_DETAIL_GUTTER = 16;
export const LOW_STOCK_THRESHOLD = 5;

export type ProductStockState = { tone: 'positive' | 'low' | 'none'; label: string; detail: string | null };

/** "In stock · 24 available", "Only 3 left" (5 or fewer), or "Out of stock". */
export function describeProductStock(inventory: number): ProductStockState {
  if (inventory <= 0) return { tone: 'none', label: 'Out of stock', detail: 'Message the seller to ask when it is back.' };
  if (inventory <= LOW_STOCK_THRESHOLD) return { tone: 'low', label: `Only ${inventory} left`, detail: null };
  return { tone: 'positive', label: 'In stock', detail: `${inventory} available` };
}

/** Whole-number percentage off, or null when there is no real discount. */
export function getDiscountPercent(currentPrice: number, originalPrice: number): number | null {
  if (originalPrice <= 0 || currentPrice >= originalPrice) return null;
  const percent = Math.round((1 - currentPrice / originalPrice) * 100);
  return percent > 0 ? percent : null;
}

type OptionPickerProps = { label: string; values: string[]; selectedValue: string; isDisabled: boolean; onSelect: (value: string) => void };

/** "Size: M" with chips; the selected chip is filled. Tapping it again clears the choice (choices are optional, as on the website). */
export function ProductOptionPicker({ label, values, selectedValue, isDisabled, onSelect }: OptionPickerProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.optionGroup}>
    <Text style={styles.optionLabel}>{label}: <Text style={selectedValue ? styles.optionLabelValue : styles.optionLabelHint}>{selectedValue || 'Choose one'}</Text></Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chipRow}>{values.map((value) => {
      const isSelected = selectedValue === value;
      return <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${label} ${value}`} accessibilityState={{ checked: isSelected, disabled: isDisabled }} disabled={isDisabled}
        onPress={() => onSelect(isSelected ? '' : value)} style={[styles.chip, isSelected && styles.chipSelected, isDisabled && styles.chipDisabled]}>
        <Text numberOfLines={1} style={[styles.chipText, isSelected && styles.chipTextSelected, isDisabled && styles.chipTextDisabled]}>{value}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

type QuantityStepperProps = { quantity: number; maximum: number; onChange: (quantity: number) => void };

export function ProductQuantityStepper({ quantity, maximum, onChange }: QuantityStepperProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canDecrease = quantity > 1;
  const canIncrease = quantity < maximum;
  return <View style={styles.quantityRow}>
    <Text style={styles.optionLabel}>Quantity</Text>
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel="Decrease quantity" accessibilityState={{ disabled: !canDecrease }} disabled={!canDecrease} onPress={() => onChange(quantity - 1)} style={[styles.stepperButton, !canDecrease && styles.dim]}>
        <Minus size={18} color={colors.text} />
      </Pressable>
      <Text accessibilityLiveRegion="polite" accessibilityLabel={`Quantity ${quantity}`} style={styles.stepperValue}>{quantity}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" accessibilityState={{ disabled: !canIncrease }} disabled={!canIncrease} onPress={() => onChange(quantity + 1)} style={[styles.stepperButton, !canIncrease && styles.dim]}>
        <Plus size={18} color={colors.text} />
      </Pressable>
    </View>
  </View>;
}

type InfoRowProps = { icon: ReactNode; title: string; body?: string | null; isMuted?: boolean };

/** One compact fulfilment/policy line: icon, a bold statement, an optional detail. */
export function ProductInfoRow({ icon, title, body, isMuted = false }: InfoRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View accessible accessibilityLabel={body ? `${title}. ${body}` : title} style={styles.infoRow}>
    <View style={[styles.infoIcon, isMuted && styles.infoIconMuted]}>{icon}</View>
    <View style={styles.flex}>
      <Text style={[styles.infoTitle, isMuted && styles.infoTitleMuted]}>{title}</Text>
      {body ? <Text style={styles.infoBody}>{body}</Text> : null}
    </View>
  </View>;
}

type DetailSectionProps = { title: string; children: ReactNode; isCollapsible?: boolean; isInitiallyOpen?: boolean; isFlush?: boolean };

/** A stacked page section with a heading; collapsible ones work as an accordion row. */
export function ProductDetailSection({ title, children, isCollapsible = false, isInitiallyOpen = true, isFlush = false }: DetailSectionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isOpen, setIsOpen] = useState(isInitiallyOpen);
  const isShown = !isCollapsible || isOpen;
  return <View style={[styles.section, isFlush && styles.sectionFlush]}>
    {isCollapsible ? <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: isOpen }} onPress={() => setIsOpen((current) => !current)} style={styles.accordionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={isOpen ? styles.chevronOpen : null}><ChevronDown size={20} color={colors.icon} /></View>
    </Pressable> : <Text accessibilityRole="header" style={[styles.sectionTitle, isFlush && styles.sectionTitleFlush]}>{title}</Text>}
    {isShown ? children : null}
  </View>;
}

const COLLAPSED_LINES = 5;

/** Long text clamped to five lines with "Read more"/"Show less". */
export function ProductExpandableText({ text }: { text: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isExpanded, setIsExpanded] = useState(false);
  // A length/line heuristic instead of onTextLayout: iOS reports only the visible lines once text is clamped.
  const isLong = text.length > 280 || text.split('\n').length > COLLAPSED_LINES;
  return <View style={styles.textBlock}>
    <Text numberOfLines={isLong && !isExpanded ? COLLAPSED_LINES : undefined} style={styles.bodyText}>{text}</Text>
    {isLong ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: isExpanded }} onPress={() => setIsExpanded((current) => !current)} hitSlop={8} style={styles.readMore}>
      <Text style={styles.readMoreText}>{isExpanded ? 'Show less' : 'Read more'}</Text>
    </Pressable> : null}
  </View>;
}

export type ProductSpec = { label: string; value: string };

export function ProductSpecList({ specs }: { specs: ProductSpec[] }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.specList}>{specs.map((spec, specIndex) => <View key={spec.label} style={[styles.specRow, specIndex > 0 && styles.specRowDivider]}>
    <Text style={styles.specLabel}>{spec.label}</Text>
    <Text style={styles.specValue}>{spec.value}</Text>
  </View>)}</View>;
}

type SellerCardProps = { store: EHubPublicStoreSummary; onViewStore: () => void; onMessage: () => void };

/** Logo, name, verified badge, rating and place, with "View store" and "Message". */
export function ProductSellerCard({ store, onViewStore, onMessage }: SellerCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasRating = store.rating !== null && store.reviewCount > 0;
  return <View style={styles.sellerCard}>
    <Pressable accessibilityRole="link" accessibilityLabel={`${store.storeName}${store.isVerified ? ', verified seller' : ''}. View store`} onPress={onViewStore} style={styles.sellerTop}>
      <View style={styles.sellerLogo}>{store.logoUrl ? <CachedImage uri={store.logoUrl} style={styles.fill} /> : <Building2 size={24} color={colors.mutedText} />}</View>
      <View style={styles.flex}>
        <View style={styles.sellerNameRow}>
          <Text numberOfLines={1} style={styles.sellerName}>{store.storeName}</Text>
          {store.isVerified ? <BadgeCheck size={16} color={colors.accentText} /> : null}
        </View>
        {store.isVerified ? <Text style={styles.verifiedText}>Verified seller identity</Text> : null}
        <View style={styles.sellerMetaRow}>
          {hasRating ? <View style={styles.metaItem}><Star size={13} color="#f59e0b" fill="#f59e0b" /><Text accessibilityLabel={`Seller rating ${store.rating?.toFixed(1)} out of 5 from ${store.reviewCount} ratings`} style={styles.metaText}>Seller rating {store.rating?.toFixed(1)} · {store.reviewCount} {store.reviewCount === 1 ? 'rating' : 'ratings'}</Text></View> : null}
          {store.location ? <View style={[styles.metaItem, styles.flexShrink]}><MapPin size={13} color={colors.mutedText} /><Text numberOfLines={1} style={styles.metaText}>{store.location}</Text></View> : null}
        </View>
      </View>
      <ChevronRight size={20} color={colors.mutedText} />
    </Pressable>
    {store.description ? <Text numberOfLines={3} style={styles.sellerDescription}>{store.description}</Text> : null}
    <View style={styles.sellerActions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${store.storeName}`} onPress={onViewStore} style={styles.outlineButton}>
        <Store size={17} color={colors.text} /><Text numberOfLines={1} style={styles.outlineButtonText}>View store</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Message ${store.storeName}`} onPress={onMessage} style={styles.outlineButton}>
        <MessageCircle size={17} color={colors.text} /><Text numberOfLines={1} style={styles.outlineButtonText}>Message</Text>
      </Pressable>
    </View>
  </View>;
}

type ProductRailProps = { title: string; products: EHubCatalogProduct[]; cardWidth: number; onOpen: (productId: string) => void };

/** A horizontally scrolling row of compact product cards ("More from this seller", "You may also like"). */
export function ProductRail({ title, products, cardWidth, onOpen }: ProductRailProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!products.length) return null;
  return <View style={styles.rail}>
    <Text accessibilityRole="header" style={[styles.sectionTitle, styles.railTitle]}>{title}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
      {products.map((product) => <EHubProductCard key={product.id} product={product} width={cardWidth} onOpen={onOpen} isCompact />)}
    </ScrollView>
  </View>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    flexShrink: { flexShrink: 1, minWidth: 0 },
    fill: { width: '100%', height: '100%' },
    dim: { opacity: 0.4 },
    optionGroup: { gap: 8 },
    optionLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
    optionLabelValue: { color: colors.text, fontWeight: '500' },
    optionLabelHint: { color: colors.mutedText, fontWeight: '500' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 44, minWidth: 48, maxWidth: '100%', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    chipSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
    chipDisabled: { backgroundColor: colors.control, borderColor: colors.control },
    chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
    chipTextSelected: { color: '#ffffff', fontWeight: '800' },
    chipTextDisabled: { color: colors.disabledText, textDecorationLine: 'line-through' },
    quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
    stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    stepperButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    stepperValue: { minWidth: 36, textAlign: 'center', color: colors.text, fontSize: 16, fontWeight: '800' },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    infoIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.successSurface },
    infoIconMuted: { backgroundColor: colors.control },
    infoTitle: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
    infoTitleMuted: { color: colors.mutedText },
    infoBody: { marginTop: 2, color: colors.mutedText, fontSize: 13, lineHeight: 18 },
    section: { paddingHorizontal: PRODUCT_DETAIL_GUTTER, paddingVertical: 16, gap: 12, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    sectionFlush: { paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent', borderTopWidth: 0, borderBottomWidth: 0 },
    sectionTitle: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '800' },
    sectionTitleFlush: { fontSize: 15 },
    accordionHeader: { minHeight: 44, marginVertical: -8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    chevronOpen: { transform: [{ rotate: '180deg' }] },
    textBlock: { gap: 4 },
    bodyText: { color: colors.secondaryText, fontSize: 15, lineHeight: 23 },
    readMore: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
    readMoreText: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
    specList: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
    specRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
    specRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    specLabel: { width: '36%', color: colors.mutedText, fontSize: 13, lineHeight: 19, fontWeight: '600' },
    specValue: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },
    sellerCard: { gap: 12 },
    sellerTop: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
    sellerLogo: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.control },
    sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
    sellerName: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
    verifiedText: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
    sellerMetaRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { flexShrink: 1, color: colors.mutedText, fontSize: 12, fontWeight: '600' },
    sellerDescription: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
    sellerActions: { flexDirection: 'row', gap: 8 },
    outlineButton: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    outlineButtonText: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
    rail: { paddingVertical: 16, gap: 12 },
    railTitle: { paddingHorizontal: PRODUCT_DETAIL_GUTTER },
    railContent: { paddingHorizontal: PRODUCT_DETAIL_GUTTER, gap: 12 },
  });
}
