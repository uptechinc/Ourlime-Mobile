import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Info, Package, Pencil } from 'lucide-react-native';
import { SellerCheckRow } from '@/components/ehub/EHubSellerFormParts';
import { LISTING_CONDITIONS, LISTING_STEPS, SELLER_DISCLAIMER_TEXT, SELLER_GUIDANCE, marketListingFormService } from '@/lib/services/MarketListingFormService';
import { formatMarketPrice } from '@/lib/utils/formatMarketPrice';
import type { MarketListingEditor } from '@/lib/hooks/useMarketListingEditor';
import type { ListingEditorStep } from '@/lib/types/marketListing';
import { ListingIssues, ListingSection, useListingStyles } from '../ListingFormParts';

/** Website SaveProduct: a buyer-eye preview, a summary per step with edit links, and the Seller Listing Disclaimer. */
export default function ListingReviewStep({ editor }: { editor: MarketListingEditor }) {
  const { colors, styles } = useListingStyles();
  const local = useMemo(() => StyleSheet.create({
    preview: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    previewImage: { width: '100%', aspectRatio: 1.2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
    previewBody: { padding: 14, gap: 4 },
    eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
    title: { color: colors.text, fontSize: 18, fontWeight: '900' },
    price: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
    strike: { color: colors.mutedText, fontSize: 13, textDecorationLine: 'line-through' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
    summaryLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
    summaryValue: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'right' },
    editLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
    editText: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
    disclaimer: { padding: 12, gap: 6, borderRadius: 14, backgroundColor: colors.control },
    disclaimerTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
    disclaimerText: { color: colors.secondaryText, fontSize: 12, lineHeight: 18 },
    guidance: { padding: 12, gap: 4, borderRadius: 14, backgroundColor: colors.warningSurface },
    guidanceText: { color: colors.warningText, fontSize: 12, lineHeight: 17 },
    agree: { color: colors.text, fontSize: 13, fontWeight: '800', lineHeight: 19 },
  }), [colors]);
  const { form, update, setStep, stepErrors } = editor;
  const activeVariants = form.variants.filter((variant) => variant.status === 'active' && variant.price !== null);
  const minimum = activeVariants.length ? Math.min(...activeVariants.map((variant) => variant.price ?? 0)) : null;
  const stock = form.variants.reduce((total, variant) => total + (variant.status === 'active' ? variant.quantity ?? 0 : 0), 0);
  const cover = form.cover ? form.cover.kind === 'remote' ? form.cover.url : form.cover.uri : null;
  const outstanding = ([0, 1, 2] as const).flatMap((index) => stepErrors[index].map((issue) => `${LISTING_STEPS[index]}: ${issue}`));

  const summary: { step: ListingEditorStep; rows: [string, string][] }[] = [
    { step: 0, rows: [
      ['Category', form.category || '—'], ['Condition', LISTING_CONDITIONS.find((entry) => entry.value === form.condition)?.label ?? form.condition],
      ['Brand', form.brand || '—'], ['SKU', form.sku || '—'], ['Tags', form.tags.join(', ') || '—'],
      ['Contact', marketListingFormService.buildContactInfo(form).map((entry) => entry.value).join(' · ') || '—'],
    ] },
    { step: 1, rows: [['Cover image', form.cover ? 'Added' : 'Missing'], ['Gallery photos', String(form.gallery.length)]] },
    { step: 2, rows: [
      ['Variants', `${form.variants.length} (${activeVariants.length} active)`], ['Total stock', String(stock)],
      ['Delivery', form.deliveryAvailable ? `Yes · ${formatMarketPrice(form.currency, form.shippingCost ?? 0)}${form.estimatedShippingDays !== null ? ` · ~${form.estimatedShippingDays} days` : ''}` : 'No'],
      ['Pickup', form.pickupAvailable ? 'Yes' : 'No'], ['Returns', form.returnsAllowed ? 'Accepted' : 'Not accepted'], ['Warranty', form.warranty ? 'Included' : '—'],
    ] },
  ];

  return <View style={{ gap: 16 }}>
    <View style={local.preview}>
      <View style={local.previewImage}>{cover ? <Image source={{ uri: cover }} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityLabel="Listing preview" /> : <Package size={40} color={colors.mutedText} />}</View>
      <View style={local.previewBody}>
        <Text style={local.eyebrow}>{form.category || 'Category'}</Text>
        <Text style={local.title}>{form.title || 'Product title'}</Text>
        <Text style={styles.hint}>{form.shortDescription || 'Short description'}</Text>
        <Text style={local.price}>{minimum === null ? 'Price not set' : `${activeVariants.some((variant) => variant.price !== minimum) ? 'From ' : ''}${formatMarketPrice(form.currency, minimum)}`}</Text>
        {form.isOnSale && form.originalPrice !== null ? <Text style={local.strike}>{formatMarketPrice(form.currency, form.originalPrice)}</Text> : null}
      </View>
    </View>
    {summary.map((section) => <ListingSection key={section.step} title={LISTING_STEPS[section.step]}>
      {section.rows.map(([label, value]) => <View key={label} style={local.summaryRow}><Text style={local.summaryLabel}>{label}</Text><Text numberOfLines={2} style={local.summaryValue}>{value}</Text></View>)}
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${LISTING_STEPS[section.step]}`} onPress={() => setStep(section.step)} style={local.editLink}><Pencil size={13} color={colors.accentText} /><Text style={local.editText}>Edit</Text></Pressable>
    </ListingSection>)}
    <ListingIssues title="Complete the following before submitting:" issues={outstanding} />
    <ListingSection title="Seller Listing Disclaimer">
      <View style={local.disclaimer}>
        <Text style={local.disclaimerTitle}>Ownership & truth in advertising</Text>
        <Text style={local.disclaimerText}>{SELLER_DISCLAIMER_TEXT}</Text>
      </View>
      <View style={local.guidance}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Info size={13} color={colors.warningText} /><Text style={[local.guidanceText, { fontWeight: '900' }]}>Seller guidance checklist</Text></View>
        {SELLER_GUIDANCE.map((line) => <Text key={line} style={local.guidanceText}>• {line}</Text>)}
      </View>
      <SellerCheckRow checked={form.disclaimerAccepted} onChange={(disclaimerAccepted) => update({ disclaimerAccepted })} accessibilityLabel="I agree to the Seller Listing Disclaimer">
        <Text style={local.agree}>I have read and agree to the Seller Listing Disclaimer, Marketplace Policy, Prohibited Items Policy, Privacy Policy, and Terms of Use. *</Text>
      </SellerCheckRow>
      <Text style={styles.hint}>Every new or edited listing is reviewed by an administrator before it appears in the marketplace.</Text>
    </ListingSection>
  </View>;
}
