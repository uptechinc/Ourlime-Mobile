import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Heart, ImageIcon, MapPin, ShoppingBag, Star, Truck } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { MarketProduct } from '@/lib/types/reliability';

type MarketProductCardProps = {
  product: MarketProduct;
  favorite: boolean;
  onOpen: (product: MarketProduct) => void;
  onToggleFavorite: (productId: string) => void;
  onQuickAdd: (product: MarketProduct) => void;
};

function priceLabel(product: MarketProduct): string {
  const available = product.variants.filter((variant) => variant.available && variant.currency);
  if (!available.length) return 'Price unavailable';
  const currencies = [...new Set(available.map((variant) => variant.currency))];
  if (currencies.length !== 1) return 'Multiple currencies';
  const minimum = Math.min(...available.map((variant) => variant.price));
  const prefix = available.some((variant) => variant.price !== minimum) ? 'From ' : '';
  return `${prefix}${currencies[0]} ${minimum.toFixed(2)}`;
}

export default function MarketProductCard({ product, favorite, onOpen, onToggleFavorite, onQuickAdd }: MarketProductCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const handleFavorite = (event: GestureResponderEvent) => { event.stopPropagation(); onToggleFavorite(product.id); };
  const handleQuickAdd = (event: GestureResponderEvent) => { event.stopPropagation(); onQuickAdd(product); };
  const condition = product.condition?.replace('_', ' ');
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${product.title}`} onPress={() => onOpen(product)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.imageFrame}>
      {product.images[0] ? <Image source={{ uri: product.images[0] }} resizeMode="cover" style={styles.image} /> : <View style={styles.imageFallback}><ImageIcon color={colors.mutedText} size={28} /><Text style={styles.fallbackText}>Image unavailable</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={favorite ? `Remove ${product.title} from favorites` : `Save ${product.title} to favorites`} onPress={handleFavorite} hitSlop={8} style={styles.favoriteButton}>
        <Heart size={19} color={favorite ? '#dc2626' : colors.text} fill={favorite ? '#dc2626' : 'transparent'} />
      </Pressable>
      {product.isOnSale ? <View style={styles.saleBadge}><Text style={styles.saleText}>SALE</Text></View> : null}
      {!product.available ? <View style={styles.unavailableBadge}><Text style={styles.unavailableText}>Unavailable</Text></View> : null}
    </View>
    <View style={styles.body}>
      <Text numberOfLines={1} style={styles.category}>{product.category || 'Marketplace'}</Text>
      <Text numberOfLines={2} style={styles.title}>{product.title}</Text>
      {product.rating !== null ? <View style={styles.metadataRow}><Star size={13} color="#f59e0b" fill="#f59e0b" /><Text style={styles.metadataText}>{product.rating.toFixed(1)}{product.ratingCount ? ` (${product.ratingCount})` : ''}</Text></View> : <Text style={styles.metadataText}>No ratings yet</Text>}
      <Text numberOfLines={1} style={styles.seller}>{product.sellerName}</Text>
      <View style={styles.fulfilmentRow}>
        {product.deliveryAvailable ? <Truck size={14} color={colors.accentText} /> : null}
        {product.pickupAvailable ? <MapPin size={14} color={colors.accentText} /> : null}
        {condition ? <Text numberOfLines={1} style={styles.condition}>{condition}</Text> : null}
      </View>
      <View style={styles.footer}>
        <View style={{ flex: 1 }}><Text style={styles.price}>{priceLabel(product)}</Text>{product.isOnSale && product.originalPrice !== null ? <Text style={styles.originalPrice}>{product.originalPrice.toFixed(2)}</Text> : null}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Add ${product.title} to cart`} disabled={!product.available} onPress={handleQuickAdd} style={[styles.cartButton, !product.available && styles.disabled]}><ShoppingBag size={18} color="#ffffff" /></Pressable>
      </View>
    </View>
  </Pressable>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { flexBasis: '47%', flexGrow: 1, maxWidth: '49%', minWidth: 150, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  pressed: { opacity: 0.82 },
  imageFrame: { height: 158, backgroundColor: colors.control },
  image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  fallbackText: { color: colors.mutedText, fontSize: 11 },
  favoriteButton: { position: 'absolute', right: 9, top: 9, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
  saleBadge: { position: 'absolute', left: 9, top: 9, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#dc2626' },
  saleText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  unavailableBadge: { position: 'absolute', left: 9, bottom: 9, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.elevated },
  unavailableText: { color: colors.mutedText, fontSize: 10, fontWeight: '800' },
  body: { padding: 11, gap: 5 },
  category: { color: colors.accentText, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  title: { minHeight: 38, color: colors.text, fontSize: 14, fontWeight: '800', lineHeight: 19 },
  metadataRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metadataText: { color: colors.mutedText, fontSize: 11 },
  seller: { color: colors.secondaryText, fontSize: 11 },
  fulfilmentRow: { minHeight: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  condition: { flex: 1, color: colors.mutedText, fontSize: 10, textTransform: 'capitalize' },
  footer: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { color: colors.text, fontSize: 13, fontWeight: '900' },
  originalPrice: { color: colors.mutedText, fontSize: 10, textDecorationLine: 'line-through' },
  cartButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accent },
  disabled: { backgroundColor: colors.disabled },
});
