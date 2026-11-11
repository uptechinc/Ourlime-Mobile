import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View, type GestureResponderEvent } from 'react-native';
import { Check } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { MARKET_PRICE_CEILING, marketCatalogFilterService, type MarketCondition, type MarketFilters, type MarketSellerTypeFilter, type MarketSort } from '@/lib/services/MarketCatalogFilterService';
import MarketFormModal, { MarketButton } from '../MarketFormModal';

type ProductFilterProps = {
  filters: MarketFilters;
  sort: MarketSort;
  categories: string[];
  colors: { name: string; code: string | null }[];
  sizes: string[];
  onChange: (filters: MarketFilters) => void;
  onSortChange: (sort: MarketSort) => void;
  onClose: () => void;
};

export const MARKET_SORT_OPTIONS: { value: MarketSort; label: string }[] = [
  { value: 'default', label: 'Featured' },
  { value: 'newest', label: 'Newest Arrivals' },
  { value: 'price-low-high', label: 'Price: Low to High' },
  { value: 'price-high-low', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'popularity', label: 'Popularity / Most Viewed' },
];
const CONDITIONS: { value: MarketCondition; label: string }[] = [
  { value: 'new', label: 'Brand New' }, { value: 'like_new', label: 'Like New' }, { value: 'good', label: 'Good Condition' },
  { value: 'fair', label: 'Fair Condition' }, { value: 'refurbished', label: 'Refurbished' },
];
const SELLER_TYPES: { value: MarketSellerTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'business', label: 'Verified shops' }, { value: 'personal', label: 'Individual' },
];

const toggle = <TValue,>(values: TValue[], value: TValue): TValue[] => values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

/** Web components/market/filters/ProductFilter.tsx (after ad840e23) as the phone filter sheet. */
export default function ProductFilter({ filters, sort, categories, colors: colorOptions, sizes, onChange, onSortChange, onClose }: ProductFilterProps) {
  const { colors } = useAppTheme();
  const [maxPriceInput, setMaxPriceInput] = useState(String(filters.maxPrice));
  const parsedMax = marketCatalogFilterService.parseMaxPrice(maxPriceInput);
  const isPriceValid = parsedMax !== null;
  useEffect(() => { setMaxPriceInput(String(filters.maxPrice)); }, [filters.maxPrice]);

  const update = (patch: Partial<MarketFilters>) => onChange({ ...filters, ...patch });
  const handleApplyPrice = () => { if (parsedMax !== null) update({ maxPrice: parsedMax }); };
  const reset = () => { onChange({ ...filters, categories: [], conditions: [], colors: [], sizes: [], sellerType: 'all', inStockOnly: false, deliveryOnly: false, pickupOnly: false, favoritesOnly: false, maxPrice: MARKET_PRICE_CEILING }); onSortChange('default'); };

  const heading = (label: string) => <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</Text>;
  const chip = (key: string, label: string, pressed: boolean, onPress: () => void, swatch?: string | null) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: pressed }} onPress={onPress}
    style={{ minHeight: 42, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: pressed ? colors.accent : colors.border, backgroundColor: pressed ? colors.successSurface : colors.surface }}>
    {swatch !== undefined ? <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: swatch ?? label.toLowerCase(), alignItems: 'center', justifyContent: 'center' }}>{pressed ? <Check size={11} color="#ffffff" /> : null}</View> : null}
    <Text style={{ color: pressed ? colors.accentText : colors.secondaryText, fontSize: 12, fontWeight: '700' }}>{label}</Text>
  </Pressable>;
  const wrap = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 };

  return <MarketFormModal visible title="Filter and sort" onClose={onClose}>
    {heading('Sort by')}
    <View style={wrap}>{MARKET_SORT_OPTIONS.map((option) => chip(option.value, option.label, sort === option.value, () => onSortChange(option.value)))}</View>

    {heading('Availability & Shipping')}
    <View style={wrap}>
      {chip('stock', 'In stock only', filters.inStockOnly, () => update({ inStockOnly: !filters.inStockOnly }))}
      {chip('delivery', 'Delivery available', filters.deliveryOnly, () => update({ deliveryOnly: !filters.deliveryOnly }))}
      {chip('pickup', 'Pickup available', filters.pickupOnly, () => update({ pickupOnly: !filters.pickupOnly }))}
      {chip('favorites', 'Favorites only', filters.favoritesOnly, () => update({ favoritesOnly: !filters.favoritesOnly }))}
    </View>

    {heading('Seller Type')}
    <View accessibilityLabel="Seller type" style={wrap}>{SELLER_TYPES.map((option) => chip(option.value, option.label, filters.sellerType === option.value, () => update({ sellerType: option.value })))}</View>

    {heading(`Categories (${categories.length + 1})`)}
    <View style={wrap}>
      {chip('all', 'All categories', !filters.categories.length, () => update({ categories: [] }))}
      {categories.map((category) => chip(category, category, filters.categories.includes(category), () => update({ categories: toggle(filters.categories, category) })))}
    </View>

    {heading('Condition')}
    <View style={wrap}>{CONDITIONS.map((condition) => chip(condition.value, condition.label, filters.conditions.includes(condition.value), () => update({ conditions: toggle(filters.conditions, condition.value) })))}</View>

    {heading('Price range')}
    <PriceSlider value={isPriceValid && parsedMax !== null ? parsedMax : filters.maxPrice} onChange={(value) => setMaxPriceInput(String(value))} />
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Maximum price ($)</Text>
      <TextInput accessibilityLabel="Maximum price ($)" value={maxPriceInput} onChangeText={setMaxPriceInput} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={handleApplyPrice}
        style={{ minHeight: 48, paddingHorizontal: 14, color: colors.text, borderRadius: 12, borderWidth: 1, borderColor: isPriceValid ? colors.border : colors.destructiveText, backgroundColor: colors.input }} />
      <Text style={{ color: isPriceValid ? colors.mutedText : colors.destructiveText, fontSize: 12 }}>Enter a whole amount from 0 to 10,000.</Text>
    </View>
    <MarketButton label="Apply price" disabled={!isPriceValid} onPress={handleApplyPrice} />

    {colorOptions.length ? <>{heading('Colors')}<View style={wrap}>{colorOptions.map((color) => chip(color.name, color.name, filters.colors.includes(color.name), () => update({ colors: toggle(filters.colors, color.name) }), color.code))}</View></> : null}
    {sizes.length ? <>{heading('Sizes')}<View style={wrap}>{sizes.map((size) => chip(size, size, filters.sizes.includes(size), () => update({ sizes: toggle(filters.sizes, size) })))}</View></> : null}

    <MarketButton label="Show results" onPress={onClose} />
    <Pressable accessibilityRole="button" onPress={reset} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontWeight: '800' }}>Reset All Filters</Text></Pressable>
  </MarketFormModal>;
}

type PriceSliderProps = { value: number; onChange: (value: number) => void };
/** Maximum-price slider, 0–10,000 in whole dollars (web range input). */
function PriceSlider({ value, onChange }: PriceSliderProps) {
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(1);
  const ratio = Math.min(1, Math.max(0, value / MARKET_PRICE_CEILING));
  const handleTouch = (event: GestureResponderEvent) => {
    const next = Math.round(Math.min(1, Math.max(0, event.nativeEvent.locationX / width)) * MARKET_PRICE_CEILING);
    onChange(next);
  };
  return <View style={{ gap: 4 }}>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="Maximum price slider" accessibilityValue={{ min: 0, max: MARKET_PRICE_CEILING, now: value, text: `$${value.toLocaleString()}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => onChange(Math.min(MARKET_PRICE_CEILING, Math.max(0, value + (event.nativeEvent.actionName === 'increment' ? 100 : -100))))}
      onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
      onResponderGrant={handleTouch} onResponderMove={handleTouch}
      style={{ height: 44, justifyContent: 'center' }}>
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: colors.control, overflow: 'hidden' }}><View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: colors.accent }} /></View>
      <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(0, ratio * width - 12), width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.surface }} />
    </View>
    <Text style={{ color: colors.text, fontWeight: '800' }}>Up to ${value.toLocaleString()}</Text>
  </View>;
}
