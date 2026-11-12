import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { HelpCircle, X } from 'lucide-react-native';
import { SellerField, SellerNumberField, SellerToggleRow } from '@/components/ehub/EHubSellerFormParts';
import { QUICK_WEIGHT_UNITS, SIZE_BASE_ID, STANDARD_SIZE_NAMES, WEIGHT_BASE_ID, getCategoryVariantPresets, marketListingFormService } from '@/lib/services/MarketListingFormService';
import type { MarketListingEditor } from '@/lib/hooks/useMarketListingEditor';
import type { ListingDimensionUnit, ListingWeightUnit } from '@/lib/types/marketListing';
import { ListingInput, ListingSection, OptionChips, useListingStyles } from '../ListingFormParts';

const DIMENSION_UNITS: readonly { value: ListingDimensionUnit; label: string }[] = [{ value: 'cm', label: 'cm' }, { value: 'in', label: 'in' }];
const WEIGHT_UNITS: readonly { value: ListingWeightUnit; label: string }[] = [{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }, { value: 'g', label: 'g' }];

const GUIDE_STEPS: readonly { title: string; body: string }[] = [
  { title: 'Select colours', body: 'Tap a base colour or type a custom colour name and tap Add. Every listing needs at least one colour.' },
  { title: 'Select sizes', body: 'Use the quick presets for your category (sizes, storage, volumes, formats, rim sizes) or type a custom value and tap Add. Add weights with the Weight row.' },
  { title: 'Set prices & inventory', body: 'Every colour × size combination becomes a variant. Enter a price and stock for each, or use Apply to all to fill them at once.' },
];

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
    guideToggle: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, backgroundColor: colors.successSurface },
    guideToggleText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
    guide: { padding: 14, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface },
    guideStep: { color: colors.accentText, fontSize: 13, fontWeight: '900' },
    guideBody: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
    groupTitle: { color: colors.secondaryText, fontSize: 12, fontWeight: '800' },
    selectedChip: { backgroundColor: colors.accent, borderColor: colors.accent },
    selectedChipText: { color: '#ffffff' },
  }), [colors]);
  const { form, update, updateVariant, setCurrency, baseColors } = editor;
  const [colorText, setColorText] = useState('');
  const [sizeText, setSizeText] = useState('');
  const [sizeNumber, setSizeNumber] = useState('');
  const [standardSize, setStandardSize] = useState<string | null>(null);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [weightText, setWeightText] = useState('');
  const presets = getCategoryVariantPresets(form.category);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  // Web PricingDetails bulk edit: one price / stock applied to every combination at once.
  const [bulkPrice, setBulkPrice] = useState<number | null>(null);
  const [bulkQuantity, setBulkQuantity] = useState<number | null>(null);
  const handleApplyToAll = () => {
    form.variants.forEach((variant) => updateVariant(variant.id, {
      ...(bulkPrice !== null ? { price: bulkPrice } : {}),
      ...(bulkQuantity !== null ? { quantity: bulkQuantity } : {}),
    }));
  };

  const addColor = (name: string, baseId: string) => {
    setOptionError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    if (form.colors.some((color) => color.name.toLowerCase() === trimmed.toLowerCase())) { setOptionError(`Colour "${trimmed}" is already added.`); return; }
    if (form.colors.length >= 30) { setOptionError('A listing supports at most 30 colours.'); return; }
    update({ colors: [...form.colors, marketListingFormService.createColor(trimmed.slice(0, 100), baseId)] });
  };
  const addSize = (name: string, baseId?: string): boolean => {
    setOptionError(null);
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (form.sizes.some((size) => size.name.toLowerCase() === trimmed.toLowerCase())) { setOptionError(`Size variant "${trimmed}" is already added.`); return false; }
    if (form.sizes.length >= 30) { setOptionError('A listing supports at most 30 sizes.'); return false; }
    update({ sizes: [...form.sizes, marketListingFormService.createSize(trimmed.slice(0, 100), baseId)] });
    return true;
  };
  // Website handleAddStandardSize / handleAddCustomSize: "<name> (<number>)" when a size number is given.
  const withNumber = (name: string) => `${name.trim()}${sizeNumber.trim() ? ` (${sizeNumber.trim()})` : ''}`;
  const handleAddStandardSize = () => {
    if (!standardSize) return;
    if (addSize(withNumber(standardSize), SIZE_BASE_ID)) setSizeNumber('');
  };
  const handleAddCustomSize = () => {
    if (!sizeText.trim()) { setOptionError('Please enter a custom size name.'); return; }
    const name = presets.usesStandardSizes ? withNumber(sizeText) : sizeText;
    if (addSize(name, presets.usesStandardSizes ? SIZE_BASE_ID : undefined)) { setSizeText(''); setSizeNumber(''); }
  };
  const handleAddWeight = () => {
    const value = weightText.trim();
    if (!value || !Number.isFinite(Number(value)) || Number(value) <= 0) { setOptionError(`Please enter a numerical weight value for ${weightUnit}.`); return; }
    if (addSize(`${value} ${weightUnit}`, WEIGHT_BASE_ID)) setWeightText('');
  };
  const handleCustomColor = () => {
    const match = baseColors.find((color) => color.name === colorText.trim().toLowerCase());
    addColor(colorText, match?.id ?? `base_col_${colorText.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`);
    setColorText('');
  };
  const availableBaseColors = baseColors.filter((base) => !form.colors.some((color) => color.name.toLowerCase() === base.name));

  return <View style={{ gap: 16 }}>
    {/* Website "How to Add Product Variants" quick guide. */}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: showGuide }} onPress={() => setShowGuide((current) => !current)} style={local.guideToggle}>
      <HelpCircle size={17} color={colors.accentText} /><Text style={local.guideToggleText}>How to add product variants</Text>
    </Pressable>
    {showGuide ? <View style={local.guide}>
      <View style={local.variantHead}><Text style={local.variantTitle}>Quick guide: variants & pricing</Text><Pressable accessibilityRole="button" accessibilityLabel="Close guide" hitSlop={8} onPress={() => setShowGuide(false)}><X size={17} color={colors.mutedText} /></Pressable></View>
      {GUIDE_STEPS.map((step, index) => <View key={step.title} style={{ gap: 3 }}>
        <Text style={local.guideStep}>{index + 1}. {step.title}</Text>
        <Text style={local.guideBody}>{step.body}</Text>
      </View>)}
    </View> : null}
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

    <ListingSection title="Sizes & specifications" description={`Optional. ${presets.hint}`}>
      {form.sizes.length ? <View style={styles.chipWrap}>{form.sizes.map((size) => <Pressable key={size.id} accessibilityRole="button" accessibilityLabel={`Remove ${size.name}`} onPress={() => update({ sizes: form.sizes.filter((entry) => entry.id !== size.id) })} style={local.option}>
        <Text style={[local.optionText, { textTransform: 'none' }]}>{size.name}</Text><X size={13} color={colors.accentText} />
      </Pressable>)}</View> : null}
      {presets.groups.map((group) => <View key={group.title} style={{ gap: 8 }}>
        <Text style={local.groupTitle}>{group.title}</Text>
        <View style={styles.chipWrap}>
          {group.options.filter((option) => !form.sizes.some((entry) => entry.name.toLowerCase() === option.toLowerCase())).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`Add ${option}`} onPress={() => addSize(option, SIZE_BASE_ID)} style={local.baseChip}><Text style={[local.baseChipText, { textTransform: 'none' }]}>+ {option}</Text></Pressable>)}
        </View>
      </View>)}
      {presets.usesStandardSizes ? <View style={{ gap: 8 }}>
        <View style={styles.chipWrap}>
          {STANDARD_SIZE_NAMES.map((name) => { const isSelected = standardSize === name; return <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => setStandardSize(isSelected ? null : name)} style={[local.baseChip, isSelected ? local.selectedChip : null]}><Text style={[local.baseChipText, isSelected ? local.selectedChipText : null]}>{name}</Text></Pressable>; })}
        </View>
        {standardSize ? <View style={local.addRow}>
          <TextInput value={sizeNumber} onChangeText={setSizeNumber} keyboardType="numeric" placeholder="Size number (optional, e.g. 2, 10)" placeholderTextColor={colors.mutedText} accessibilityLabel={`${standardSize} size number`} style={local.addInput} />
          <Pressable accessibilityRole="button" onPress={handleAddStandardSize} style={local.addButton}><Text style={local.addText}>Add {standardSize}</Text></Pressable>
        </View> : null}
      </View> : null}
      <Text style={local.groupTitle}>{presets.customLabel}</Text>
      <View style={local.addRow}>
        <TextInput value={sizeText} onChangeText={setSizeText} onSubmitEditing={handleAddCustomSize} placeholder={presets.customPlaceholder} placeholderTextColor={colors.mutedText} accessibilityLabel={presets.customLabel} style={local.addInput} />
        {presets.usesStandardSizes && !standardSize ? <TextInput value={sizeNumber} onChangeText={setSizeNumber} keyboardType="numeric" placeholder="Value" placeholderTextColor={colors.mutedText} accessibilityLabel="Custom size number (optional)" style={[local.addInput, { flex: 0, width: 72 }]} /> : null}
        <Pressable accessibilityRole="button" onPress={handleAddCustomSize} style={local.addButton}><Text style={local.addText}>Add</Text></Pressable>
      </View>
      <Text style={local.groupTitle}>Weight</Text>
      <View style={styles.chipWrap}>
        {QUICK_WEIGHT_UNITS.map((unit) => { const isSelected = weightUnit === unit.value; return <Pressable key={unit.value} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => setWeightUnit(unit.value)} style={[local.baseChip, isSelected ? local.selectedChip : null]}><Text style={[local.baseChipText, isSelected ? local.selectedChipText : null]}>{unit.label}</Text></Pressable>; })}
      </View>
      <View style={local.addRow}>
        <TextInput value={weightText} onChangeText={setWeightText} onSubmitEditing={handleAddWeight} keyboardType="decimal-pad" placeholder={`e.g. 2.5, 10, 50 (${weightUnit})`} placeholderTextColor={colors.mutedText} accessibilityLabel={`Weight value in ${weightUnit}`} style={local.addInput} />
        <Pressable accessibilityRole="button" onPress={handleAddWeight} style={local.addButton}><Text style={local.addText}>Add {weightUnit.toUpperCase()}</Text></Pressable>
      </View>
      {optionError ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText, fontSize: 12, fontWeight: '700' }}>{optionError}</Text> : null}
    </ListingSection>

    <ListingSection title={`Variant pricing (${form.variants.length})`} description="Price must be above 0 and at most 100,000; stock is a whole number. Turn off a variant to stop selling it.">
      {form.variants.length > 1 ? <View style={local.variant}>
        <Text style={local.variantTitle}>Apply to all {form.variants.length} variants</Text>
        <View style={styles.row}>
          <View style={styles.flex}><SellerNumberField label={`Price (${form.currency || '—'})`} allowEmpty value={bulkPrice} onChangeValue={setBulkPrice} /></View>
          <View style={styles.flex}><SellerNumberField label="Stock" isInteger allowEmpty value={bulkQuantity} onChangeValue={setBulkQuantity} /></View>
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: bulkPrice === null && bulkQuantity === null }} disabled={bulkPrice === null && bulkQuantity === null} onPress={handleApplyToAll} style={[local.addButton, { alignItems: 'center' }, bulkPrice === null && bulkQuantity === null ? { opacity: 0.5 } : null]}>
          <Text style={local.addText}>Apply to all</Text>
        </Pressable>
      </View> : null}
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
