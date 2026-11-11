import { View } from 'react-native';
import { SellerChipField, SellerField } from '@/components/ehub/EHubSellerFormParts';
import { LISTING_CONDITIONS } from '@/lib/services/MarketListingFormService';
import type { MarketListingEditor } from '@/lib/hooks/useMarketListingEditor';
import { ListingInput, ListingSection, OptionChips, useListingStyles } from '../ListingFormParts';

/** Website BasicInfo step: title, category, condition, descriptions, brand, SKU, tags and how buyers contact the seller. */
export default function ListingBasicInfoStep({ editor }: { editor: MarketListingEditor }) {
  const { styles } = useListingStyles();
  const { form, update, categories } = editor;
  const categoryOptions = form.category && !categories.some((option) => option.value === form.category)
    ? [{ value: form.category, label: form.category }, ...categories]
    : categories;
  return <View style={{ gap: 16 }}>
    <ListingSection title="Product details" description="Buyers see these first. Be accurate about what you are selling.">
      <ListingInput label="Product title" required counter maxLength={100} value={form.title} onChangeText={(title) => update({ title })} placeholder="Enter your product title" />
      <SellerField label="Category" required>
        <OptionChips accessibilityLabel="Category" options={categoryOptions} value={form.category} onChange={(category) => update({ category })} />
      </SellerField>
      <SellerField label="Condition" required>
        <OptionChips accessibilityLabel="Condition" options={LISTING_CONDITIONS} value={form.condition} onChange={(condition) => update({ condition })} />
      </SellerField>
      <ListingInput label="Short description" required counter maxLength={150} hint="10–150 characters, shown on product cards." value={form.shortDescription} onChangeText={(shortDescription) => update({ shortDescription })} placeholder="Brief description of your product" />
      <ListingInput label="Detailed description" required multiline maxLength={50000} hint="At least 50 characters. Include defects, missing parts or prior use." value={form.longDescription} onChangeText={(longDescription) => update({ longDescription })} placeholder="Provide a detailed description of your product" />
      <View style={styles.row}>
        <View style={styles.flex}><ListingInput label="Brand" maxLength={200} value={form.brand} onChangeText={(brand) => update({ brand })} /></View>
        <View style={styles.flex}><ListingInput label="SKU" maxLength={200} autoCapitalize="characters" value={form.sku} onChangeText={(sku) => update({ sku })} /></View>
      </View>
      <SellerChipField label="Tags" values={form.tags} onChange={(tags) => update({ tags: tags.slice(0, 30).map((tag) => tag.slice(0, 100)) })} placeholder="Add a tag" />
    </ListingSection>
    <ListingSection title="Contact information" description="At least one contact method is required. Buyers use it to arrange delivery or pickup.">
      <ListingInput label="Phone" keyboardType="phone-pad" autoCapitalize="none" value={form.contactPhone} onChangeText={(contactPhone) => update({ contactPhone })} placeholder="Enter your phone number" />
      <ListingInput label="Email" keyboardType="email-address" autoCapitalize="none" value={form.contactEmail} onChangeText={(contactEmail) => update({ contactEmail })} placeholder="Enter your email address" />
      <ListingInput label="Website" keyboardType="url" autoCapitalize="none" value={form.contactWebsite} onChangeText={(contactWebsite) => update({ contactWebsite })} placeholder="https://your-website.com" />
    </ListingSection>
  </View>;
}
