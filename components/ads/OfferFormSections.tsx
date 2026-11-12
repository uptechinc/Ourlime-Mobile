import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { ADS_GREEN, AdsButton, AdsChip, AdsField, AdsOptionGroup } from '@/components/ads/AdsUi';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdDisplaySpecs, AdDisplayType, AudienceGender, PhysicalDisplayKind, PricingModel, SocialPlatform, SocialPostType } from '@/lib/types/adsMarketplace';

/*
 * Form sections shared by the create-offer wizard and the edit-offer page (the same fields and options as the
 * website's create-offer and edit pages).
 */

export const PLATFORM_OPTIONS: { value: SocialPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
];
export const POST_TYPE_OPTIONS: { value: SocialPostType; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'story', label: 'Story' },
  { value: 'reel', label: 'Reel' },
  { value: 'video', label: 'Video' },
];
export const PHYSICAL_KIND_OPTIONS: { value: PhysicalDisplayKind; label: string }[] = [
  { value: 'banner', label: 'Banner' },
  { value: 'poster', label: 'Poster' },
  { value: 'sign', label: 'Sign' },
  { value: 'billboard', label: 'Billboard' },
];
export const GENDER_OPTIONS: { value: AudienceGender; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];
export const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
];
export const PRICING_MODEL_OPTIONS: { value: PricingModel; label: string }[] = [
  { value: 'fixed', label: 'Fixed price' },
  { value: 'per_day', label: 'Per day' },
  { value: 'per_week', label: 'Per week' },
  { value: 'per_month', label: 'Per month' },
  { value: 'per_impression', label: 'Per impression' },
  { value: 'per_click', label: 'Per click' },
];

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  decimal?: boolean;
  fallback?: number;
};

/** A numeric text field that keeps what the user types (an empty field reads as the fallback, 0 by default). */
export function AdsNumberField({ label, value, onChange, required, hint, placeholder, decimal = false, fallback = 0 }: NumberFieldProps) {
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => {
    const parsed = decimal ? parseFloat(text) : parseInt(text, 10);
    if ((Number.isNaN(parsed) ? fallback : parsed) !== value) setText(value ? String(value) : '');
  }, [value, decimal, fallback, text]);
  return (
    <AdsField
      label={label}
      required={required}
      hint={hint}
      placeholder={placeholder}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      value={text}
      onChangeText={(nextText) => {
        setText(nextText);
        const parsed = decimal ? parseFloat(nextText) : parseInt(nextText, 10);
        onChange(Number.isNaN(parsed) ? fallback : parsed);
      }}
    />
  );
}

type TagsFieldProps = { tags: string[]; onChange: (tags: string[]) => void };

export function OfferTagsField({ tags, onChange }: TagsFieldProps) {
  const { colors } = useAppTheme();
  const [tagInput, setTagInput] = useState('');
  const addTag = (): void => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setTagInput('');
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <AdsField label="Tags" hint="Press Add to include a tag." placeholder="Add a tag" value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag} returnKeyType="done" />
        </View>
        <AdsButton label="Add" variant="secondary" icon={<Plus size={16} color={colors.text} />} onPress={addTag} style={{ marginBottom: 22 }} />
      </View>
      {tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tags.map((tag) => (
            <View key={tag} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: ADS_GREEN, backgroundColor: colors.successSurface, paddingLeft: 12, paddingRight: 6, paddingVertical: 5 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accentText }}>{tag}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${tag}`} hitSlop={6} onPress={() => onChange(tags.filter((existing) => existing !== tag))}>
                <X size={14} color={colors.accentText} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ReadOnlyValue({ label, value }: { label: string; value?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.secondaryText }}>{label}</Text>
      <AdsChip label={value || 'Not set'} />
    </View>
  );
}

type DisplaySpecsFieldsProps = {
  displayType: AdDisplayType | '';
  specs: AdDisplaySpecs;
  onSpecsChange: (specs: Partial<AdDisplaySpecs>) => void;
  estimatedReach: number;
  onEstimatedReachChange: (reach: number) => void;
  /** The edit page shows platform, post type and display format read-only (they can't change after creation). */
  readOnlyChoices?: boolean;
};

export function OfferDisplaySpecsFields({ displayType, specs, onSpecsChange, estimatedReach, onEstimatedReachChange, readOnlyChoices = false }: DisplaySpecsFieldsProps) {
  if (displayType === 'digital') {
    return (
      <View style={{ gap: 14 }}>
        <AdsField label="Website URL" placeholder="https://example.com" autoCapitalize="none" keyboardType="url" value={specs.websiteUrl ?? ''} onChangeText={(websiteUrl) => onSpecsChange({ websiteUrl })} />
        <AdsField label="App name" placeholder="My App" value={specs.appName ?? ''} onChangeText={(appName) => onSpecsChange({ appName })} />
        <AdsField label="Digital location" placeholder="e.g., Times Square, NYC" value={specs.digitalLocation ?? ''} onChangeText={(digitalLocation) => onSpecsChange({ digitalLocation })} />
        <AdsField label="Screen size" placeholder="e.g., 1920x1080" value={specs.screenSize ?? ''} onChangeText={(screenSize) => onSpecsChange({ screenSize })} />
      </View>
    );
  }
  if (displayType === 'social') {
    return (
      <View style={{ gap: 14 }}>
        {readOnlyChoices ? <ReadOnlyValue label="Platform" value={specs.platform} /> : <AdsOptionGroup label="Platform" required value={specs.platform} options={PLATFORM_OPTIONS} onChange={(platform) => onSpecsChange({ platform })} />}
        {readOnlyChoices ? <ReadOnlyValue label="Post type" value={specs.postType} /> : <AdsOptionGroup label="Post type" value={specs.postType} options={POST_TYPE_OPTIONS} onChange={(postType) => onSpecsChange({ postType })} />}
        <AdsNumberField label="Estimated reach" placeholder="10000" value={estimatedReach} onChange={onEstimatedReachChange} />
      </View>
    );
  }
  if (displayType === 'physical') {
    return (
      <View style={{ gap: 14 }}>
        <AdsField label="Physical location" required={!readOnlyChoices} placeholder="e.g., 123 Main St, New York, NY" value={specs.physicalLocation ?? ''} onChangeText={(physicalLocation) => onSpecsChange({ physicalLocation })} />
        <AdsField label="Display size" placeholder="e.g., 10ft x 20ft" value={specs.displaySize ?? ''} onChangeText={(displaySize) => onSpecsChange({ displaySize })} />
        {readOnlyChoices ? <ReadOnlyValue label="Display format" value={specs.displayType} /> : <AdsOptionGroup label="Display type" value={specs.displayType} options={PHYSICAL_KIND_OPTIONS} onChange={(kind) => onSpecsChange({ displayType: kind })} />}
      </View>
    );
  }
  return null;
}

export type OfferPricingValues = { basePrice: number; currency: string; pricingModel: PricingModel; minimumDuration: number; maximumDuration: number };

export function OfferPricingFields({ pricing, onChange }: { pricing: OfferPricingValues; onChange: (pricing: Partial<OfferPricingValues>) => void }) {
  return (
    <View style={{ gap: 14 }}>
      <AdsNumberField label="Base price" required decimal placeholder="100" value={pricing.basePrice} onChange={(basePrice) => onChange({ basePrice })} />
      <AdsOptionGroup label="Currency" value={pricing.currency} options={CURRENCY_OPTIONS} onChange={(currency) => onChange({ currency })} />
      <AdsOptionGroup label="Pricing model" value={pricing.pricingModel} options={PRICING_MODEL_OPTIONS} onChange={(pricingModel) => onChange({ pricingModel })} />
      <AdsNumberField label="Minimum duration (days)" value={pricing.minimumDuration} fallback={1} onChange={(minimumDuration) => onChange({ minimumDuration })} />
      <AdsNumberField label="Maximum duration (days)" value={pricing.maximumDuration} fallback={30} onChange={(maximumDuration) => onChange({ maximumDuration })} />
    </View>
  );
}
