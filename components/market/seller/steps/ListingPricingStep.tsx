import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { SellerField, SellerNumberField, SellerToggleRow } from '@/components/ehub/EHubSellerFormParts';
import { QUICK_SIZES, marketListingFormService } from '@/lib/services/MarketListingFormService';
import type { MarketListingEditor } from '@/lib/hooks/useMarketListingEditor';
import type { ListingDimensionUnit, ListingWeightUnit } from '@/lib/types/marketListing';
import { ListingInput, ListingSection, OptionChips, useListingStyles } from '../ListingFormParts';

const DIMENSION_UNITS: readonly { value: ListingDimensionUnit; label: string }[] = [{ value: 'cm', label: 'cm' }, { value: 'in', label: 'in' }];
const WEIGHT_UNITS: readonly { value: ListingWeightUnit; label: string }[] = [{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }, { value: 'g', label: 'g' }];

/**
 * Website PricingDetails: listing currency, colour and size/weight options with a price, stock and availability for
 * every combination, plus the delivery, returns, warranty, dimensions and weight details the listing model stores.
 */
export default function ListingPricingStep({ editor }: { editor: MarketListingEditor }) {
  const { colors, styles } = useListingStyles();
  const local = useMemo(() => StyleSheet.create({
    option: { minHeight: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 17, backgroundColor: colors.successSurface },
    optionText: { color: colors.accentText, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
    baseChip: { minHeight: 34, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    baseChipText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addInput: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 14 },
    addButton: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, backgroundColor: colors.control },
    addText: { color: colors.text, fontSize: 13, fontWeight: '800' },
    variant: { padding: 12, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas },
    variantHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    variantTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '900', textTransform: 'capitalize' },
    small: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  }), [colors]);
  const { form, update, updateVariant, setCurrency, baseColors } = editor;
  const [colorText, setColorText] = useState('');
  const [sizeText, setSizeText] = useState('');
  const [optionError, setOptionError] = useState<string | null>(null);

  const addColor = (name: string, baseId: string) => {
    setOptionError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    if (form.colors.some((color) => color.name.toLowerCase() === trimmed.toLowerCase())) { setOptionError(`Colour "${trimmed}" is already added.`); return; }
    if (form.colors.length >= 30) { setOptionError('A listing supports at most 30 colours.'); return; }
    update({ colors: [...form.colors, marketListingFormService.createColor(trimmed.slice(0, 100), baseId)] });
  };
  const addSize = (name: string) => {
    setOptionError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    if (form.sizes.some((size) => size.name.toLowerCase() === trimmed.toLowerCase())) { setOptionError(`Size variant "${trimmed}" is already added.`); return; }
    if (form.sizes.length >= 30) { setOptionError('A listing supports at most 30 sizes.'); return; }
    update({ sizes: [...form.sizes, marketListingFormService.createSize(trimmed.slice(0, 100))] });
  };
  const handleCustomColor = () => {
    const match = baseColors.find((color) => color.name === colorText.trim().toLowerCase());
    addColor(colorText, match?.id ?? `base_col_${colorText.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`);
    setColorText('');
  };
  const availableBaseColors = baseColors.filter((base) => !form.colors.some((color) => color.name.toLowerCase() === base.name));

  return <View style={{ gap: 16 }}>
    <ListingSection title="Pricing" description="Set the listing currency and, optionally, a compare-at price.">
      <ListingInput label="Listing currency (three-letter code)" required autoCapitalize="characters" maxLength={3} value={form.currency} onChangeText={setCurrency} placeholder="e.g. TTD, USD, CAD" />
      <View style={styles.row}>
        <View style={styles.flex}><SellerNumberField label="Original price" allowEmpty value={form.originalPrice} onChangeValue={(originalPrice) => update({ originalPrice })} /></View>
        <View style={styles.flex}><SellerNumberField label="Sale price" allowEmpty value={form.salePrice} onChangeValue={(salePrice) => update({ salePrice })} /></View>
      </View>
      <SellerToggleRow label="On sale" description="Show the sale price against the original price." value={form.isOnSale} onChange={(isOnSale) => update({ isOnSale })} />
    </ListingSection>

    <ListingSection title="Colours" description="Select at least one colour. Every colour × size combination gets its own price and stock.">
      {form.colors.length ? <View style={styles.chipWrap}>{form.colors.map((color) => <Pressable key={color.id} accessibilityRole="button" accessibilityLabel={`Remove ${color.name}`} onPress={() => update({ colors: form.colors.filter((entry) => entry.id !== color.id) })} style={local.option}>
        <Text style={local.optionText}>{color.name}</Text><X size={13} color={colors.accentText} />
      </Pressable>)}</View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {availableBaseColors.map((base) => <Pressable key={base.id} accessibilityRole="button" accessibilityLabel={`Add ${base.name}`} onPress={() => addColor(base.name, base.id)} style={local.baseChip}><Text style={local.baseChipText}>+ {base.name}</Text></Pressable>)}
      </ScrollView>
      <View style={local.addRow}>
        <TextInput value={colorText} onChangeText={setColorText} onSubmitEditing={handleCustomColor} placeholder="Custom colour (e.g. Forest green)" placeholderTextColor={colors.mutedText} accessibilityLabel="Custom colour" style={local.addInput} />
        <Pressable accessibilityRole="button" onPress={handleCustomColor} style={local.addButton}><Text style={local.addText}>Add</Text></Pressable>
      </View>
    </ListingSection>

    <ListingSection title="Sizes & weights" description="Optional. Add clothing sizes, numeric sizes or weights (e.g. 5 lbs).">
      {form.sizes.length ? <View style={styles.chipWrap}>{form.sizes.map((size) => <Pressable key={size.id} accessibilityRole="button" accessibilityLabel={`Remove ${size.name}`} onPress={() => update({ sizes: form.sizes.filter((entry) => entry.id !== size.id) })} style={local.option}>
        <Text style={[local.optionText, { textTransform: 'none' }]}>{size.name}</Text><X size={13} color={colors.accentText} />
      </Pressable>)}</View> : null}
      <View style={styles.chipWrap}>
        {QUICK_SIZES.filter((size) => !form.sizes.some((entry) => entry.name === size)).map((size) => <Pressable key={size} accessibilityRole="button" accessibilityLabel={`Add size ${size}`} onPress={() => addSize(size)} style={local.baseChip}><Text style={[local.baseChipText, { textTransform: 'none' }]}>+ {size}</Text></Pressable>)}
      </View>
      <View style={local.addRow}>
        <TextInput value={sizeText} onChangeText={setSizeText} onSubmitEditing={() => { addSize(sizeText); setSizeText(''); }} placeholder="Custom size or weight (e.g. 42, 5 lbs)" placeholderTextColor={colors.mutedText} accessibilityLabel="Custom size or weight" style={local.addInput} />
        <Pressable accessibilityRole="button" onPress={() => { addSize(sizeText); setSizeText(''); }} style={local.addButton}><Text style={local.addText}>Add</Text></Pressable>
      </View>
      {optionError ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText, fontSize: 12, fontWeight: '700' }}>{optionError}</Text> : null}
    </ListingSection>

    <ListingSection title={`Variant pricing (${form.variants.length})`} description="Price must be above 0 and at most 100,000; stock is a whole number. Turn off a variant to stop selling it.">
      {form.variants.map((variant) => <View key={variant.id} style={[local.variant, variant.status === 'inactive' ? { opacity: 0.6 } : null]}>
        <View style={local.variantHead}>
          <Text style={local.variantTitle}>{marketListingFormService.variantLabel(form, variant)}</Text>
          <Text style={local.small}>{variant.status === 'active' ? 'Active' : 'Inactive'}</Text>
          <Switch value={variant.status === 'active'} onValueChange={(isActive) => updateVariant(variant.id, { status: isActive ? 'active' : 'inactive' })} accessibilityLabel={`${marketListingFormService.variantLabel(form, variant)} available`} trackColor={{ true: colors.accent, false: colors.disabled }} thumbColor="#ffffff" />
        </View>
        <View style={styles.row}>
          <View style={styles.flex}><SellerNumberField label={`Price (${form.currency || '—'})`} required allowEmpty value={variant.price} onChangeValue={(price) => updateVariant(variant.id, { price })} /></View>
          <View style={styles.flex}><SellerNumberField label="Stock" required isInteger allowEmpty value={variant.quantity} onChangeValue={(quantity) => updateVariant(variant.id, { quantity })} /></View>
        </View>
      </View>)}
    </ListingSection>

    <ListingSection title="Delivery & pickup">
      <SellerToggleRow label="Delivery available" description="You ship or deliver the item to the buyer." value={form.deliveryAvailable} onChange={(deliveryAvailable) => update({ deliveryAvailable })} />
      <SellerToggleRow label="Pickup available" description="The buyer can collect the item from you." value={form.pickupAvailable} onChange={(pickupAvailable) => update({ pickupAvailable })} />
      {form.deliveryAvailable ? <View style={styles.row}>
        <View style={styles.flex}><SellerNumberField label="Shipping cost" allowEmpty value={form.shippingCost} onChangeValue={(shippingCost) => update({ shippingCost })} /></View>
        <View style={styles.flex}><SellerNumberField label="Est. shipping days" isInteger allowEmpty value={form.estimatedShippingDays} onChangeValue={(estimatedShippingDays) => update({ estimatedShippingDays })} /></View>
      </View> : null}
    </ListingSection>

    <ListingSection title="Returns & warranty">
      <SellerToggleRow label="Returns accepted" description="Buyers may return the item under your return policy." value={form.returnsAllowed} onChange={(returnsAllowed) => update({ returnsAllowed })} />
      {form.returnsAllowed ? <ListingInput label="Return policy" multiline maxLength={5000} value={form.returnPolicy} onChangeText={(returnPolicy) => update({ returnPolicy })} placeholder="e.g. Returns within 14 days in original condition." /> : null}
      <ListingInput label="Refund policy" multiline maxLength={5000} value={form.refundPolicy} onChangeText={(refundPolicy) => update({ refundPolicy })} placeholder="How and when refunds are issued." />
      <ListingInput label="Warranty" multiline maxLength={5000} value={form.warranty} onChangeText={(warranty) => update({ warranty })} placeholder="e.g. 6-month manufacturer warranty." />
    </ListingSection>

    <ListingSection title="Dimensions & weight" description="Optional. Helps buyers and couriers plan delivery.">
      <View style={styles.row}>
        <View style={styles.flex}><SellerNumberField label="Length" allowEmpty value={form.dimensionLength} onChangeValue={(dimensionLength) => update({ dimensionLength })} /></View>
        <View style={styles.flex}><SellerNumberField label="Width" allowEmpty value={form.dimensionWidth} onChangeValue={(dimensionWidth) => update({ dimensionWidth })} /></View>
        <View style={styles.flex}><SellerNumberField label="Height" allowEmpty value={form.dimensionHeight} onChangeValue={(dimensionHeight) => update({ dimensionHeight })} /></View>
      </View>
      <SellerField label="Dimension unit"><OptionChips accessibilityLabel="Dimension unit" options={DIMENSION_UNITS} value={form.dimensionUnit} onChange={(dimensionUnit) => update({ dimensionUnit })} /></SellerField>
      <SellerNumberField label="Weight" allowEmpty value={form.weightValue} onChangeValue={(weightValue) => update({ weightValue })} />
      <SellerField label="Weight unit"><OptionChips accessibilityLabel="Weight unit" options={WEIGHT_UNITS} value={form.weightUnit} onChange={(weightUnit) => update({ weightUnit })} /></SellerField>
    </ListingSection>
  </View>;
}
