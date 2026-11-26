import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ArrowLeft, Check, MessageCircle, Share2, ShoppingCart } from 'lucide-react-native';
import SaveButton from '@/components/ui/SaveButton';
import type { SaveTarget } from '@/lib/types/saved';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { EHubHeaderActions } from '@/components/ehub/EHubCommerceParts';
import { formatEHubPrice } from '@/components/ehub/EHubParts';
import { PRODUCT_DETAIL_GUTTER } from '@/components/ehub/productDetail/ProductDetailParts';

/** Height of the bar's row, under the status bar inset. */
export const PRODUCT_TOP_BAR_HEIGHT = 56;

type ProductTopBarProps = {
  title: string;
  /** Solid: surface background, divider and title. Otherwise transparent over the gallery with only the round buttons. */
  isSolid: boolean;
  /** Floats over the content (phones, under the gallery) instead of taking its own space. */
  isFloating: boolean;
  /** The product as a saved item; shows the Save button when given. */
  saveTarget?: SaveTarget | null;
  onBack: () => void;
  onShare?: () => void;
  onOpenCart: () => void;
};

/** Back, title (once the gallery has scrolled away), share, save and cart with its count. */
export function ProductTopBar({ title, isSolid, isFloating, saveTarget = null, onBack, onShare, onOpenCart }: ProductTopBarProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const solidProgress = useSharedValue(isSolid ? 1 : 0);
  useEffect(() => { solidProgress.value = withTiming(isSolid ? 1 : 0, { duration: 180 }); }, [isSolid, solidProgress]);
  const backgroundStyle = useAnimatedStyle(() => ({ opacity: solidProgress.value }));

  return <SafeAreaView edges={['top', 'left', 'right']} pointerEvents="box-none" style={isFloating ? styles.floating : null}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.solidBackground, backgroundStyle]} />
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} hitSlop={4} style={styles.roundButton}>
        <ArrowLeft size={22} color={colors.icon} />
      </Pressable>
      <Animated.View pointerEvents="none" style={[styles.titleWrap, backgroundStyle]}>
        <Text numberOfLines={1} accessibilityElementsHidden={!isSolid} importantForAccessibility={isSolid ? 'auto' : 'no-hide-descendants'} style={styles.title}>{title}</Text>
      </Animated.View>
      {onShare ? <Pressable accessibilityRole="button" accessibilityLabel="Share product" onPress={onShare} hitSlop={4} style={styles.roundButton}>
        <Share2 size={20} color={colors.icon} />
      </Pressable> : null}
      {saveTarget ? <SaveButton target={saveTarget} iconSize={20} style={styles.roundButton} /> : null}
      <View style={styles.roundButton}><EHubHeaderActions onOpenCart={onOpenCart} /></View>
    </View>
  </SafeAreaView>;
}

type ProductBottomBarProps = {
  price: number;
  originalPrice: number | null;
  isAvailable: boolean;
  /** Just added: the button briefly reads "Added" with a check. */
  isAdded?: boolean;
  onAddToCart: () => void;
  onMessage: () => void;
};

/** The sticky buying bar: price on the left, "Message seller" (icon) and the one primary "Add to cart". */
export function ProductBottomBar({ price, originalPrice, isAvailable, isAdded = false, onAddToCart, onMessage }: ProductBottomBarProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Narrow phones (360dp) drop the cart icon so the label never truncates next to the price.
  const isRoomy = useWindowDimensions().width >= 400;
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bottomBar}>
    <View style={styles.bottomRow}>
      <View accessible accessibilityLabel={`Price ${formatEHubPrice(price)}${originalPrice !== null ? `, was ${formatEHubPrice(originalPrice)}` : ''}`} style={styles.priceColumn}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.barPrice}>{formatEHubPrice(price)}</Text>
        {originalPrice !== null ? <Text numberOfLines={1} style={styles.barOldPrice}>{formatEHubPrice(originalPrice)}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Message the seller" onPress={onMessage} style={styles.iconButton}>
        <MessageCircle size={22} color={colors.text} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={!isAvailable ? 'Out of stock' : isAdded ? 'Added to cart. Tap to add another' : 'Add to cart'} accessibilityState={{ disabled: !isAvailable }} disabled={!isAvailable} onPress={onAddToCart} style={[styles.primaryButton, isAdded && styles.primaryAdded, !isAvailable && styles.primaryDisabled]}>
        {isAvailable && isAdded ? <Check size={18} color={colors.successText} strokeWidth={3} /> : isAvailable && isRoomy ? <ShoppingCart size={18} color="#ffffff" /> : null}
        <Text numberOfLines={1} style={[styles.primaryText, isAdded && styles.primaryTextAdded, !isAvailable && styles.primaryTextDisabled]}>{!isAvailable ? 'Out of stock' : isAdded ? 'Added' : 'Add to cart'}</Text>
      </Pressable>
    </View>
  </SafeAreaView>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    floating: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
    solidBackground: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    row: { height: PRODUCT_TOP_BAR_HEIGHT, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
    // The round surface backdrop keeps icons readable over any photo in light and dark mode.
    roundButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface },
    titleWrap: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
    title: { color: colors.text, fontSize: 16, fontWeight: '700' },
    bottomBar: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    bottomRow: { minHeight: 72, paddingHorizontal: PRODUCT_DETAIL_GUTTER, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    priceColumn: { flexShrink: 1, minWidth: 72, maxWidth: '38%', marginRight: 4 },
    barPrice: { color: colors.text, fontSize: 18, fontWeight: '900' },
    barOldPrice: { color: colors.mutedText, fontSize: 12, fontWeight: '600', textDecorationLine: 'line-through' },
    iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    primaryButton: { flex: 1, minWidth: 0, height: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: '#047857' },
    primaryDisabled: { backgroundColor: colors.disabled },
    primaryAdded: { backgroundColor: colors.successSurface, borderWidth: 1, borderColor: colors.successBorder },
    primaryTextAdded: { color: colors.successText },
    primaryText: { flexShrink: 1, color: '#ffffff', fontSize: 15, fontWeight: '800' },
    primaryTextDisabled: { color: colors.disabledText },
  });
}
