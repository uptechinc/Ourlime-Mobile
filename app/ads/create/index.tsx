import { useState } from 'react';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Calendar, DollarSign, LayoutGrid, MousePointer } from 'lucide-react-native';
import AdPreviewCard, { type AdPreviewCreative } from '@/components/ads/AdPreviewCard';
import { pickAdsMedia } from '@/components/ads/adsPickers';
import { ADS_GREEN, AdsButton, AdsCard, AdsField, AdsInfoRow, AdsNotice, AdsOptionGroup, AdsScreen, AdsToggleChip } from '@/components/ads/AdsUi';
import CustomModal from '@/components/ui/CustomModal';
import DateTimeField from '@/components/ui/DateTimeField';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const STEPS = ['Objective', 'Creative', 'Placement', 'Budget and schedule', 'Review'];
const CONTEXT_TOPICS = ['Food and drink', 'Shopping', 'Arts and culture', 'Sports and recreation', 'Local events'] as const;
type ContextTopic = (typeof CONTEXT_TOPICS)[number];
type BudgetPlan = { amount: number; currency: 'TTD' | 'USD'; start: Date; end: Date; timeZone: string };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * The website's "Create an ad preview" builder (/ads/create): objective, creative, placement topics, budget and
 * schedule, review. Preview only, as on the website: nothing is saved, charged or submitted.
 */
export default function CreateAdRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [showDiscard, setShowDiscard] = useState(false);
  const [creative, setCreative] = useState<AdPreviewCreative>({});
  const [topics, setTopics] = useState<ContextTopic[]>([]);
  const [amount, setAmount] = useState('50');
  const [currency, setCurrency] = useState<'TTD' | 'USD'>('TTD');
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [budget, setBudget] = useState<BudgetPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleClose = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/ads');
  };
  const goTo = (index: number): void => {
    setError(null);
    setStepIndex(index);
  };
  const updateCreative = (update: Partial<AdPreviewCreative>): void => setCreative((previous) => ({ ...previous, ...update }));

  const handlePickImage = async (): Promise<void> => {
    const [file] = await pickAdsMedia('images', false);
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.mimeType ?? '') || !file.size || file.size > MAX_IMAGE_BYTES) {
      setError('Choose a JPG, PNG, or WebP image up to 5 MB.');
      return;
    }
    updateCreative({ imageUri: file.uri });
    setError(null);
  };

  const handleCreativeContinue = (): void => {
    if (!creative.sponsorName?.trim() || !creative.headline?.trim() || !creative.primaryText?.trim()) {
      setError('Enter a sponsor name, headline, and ad copy.');
      return;
    }
    if (!creative.imageUri || !creative.imageAlt?.trim()) {
      setError('Add an image and describe it for people using screen readers.');
      return;
    }
    const destination = creative.destinationUrl?.trim() ?? '';
    try {
      const url = new URL(destination);
      if (url.protocol !== 'https:' || url.username || url.password) {
        setError('Enter an HTTPS destination without embedded credentials.');
        return;
      }
      updateCreative({ destinationUrl: url.href });
    } catch {
      setError('Enter a valid HTTPS destination.');
      return;
    }
    goTo(2);
  };

  const amountValue = Number(amount);
  const isBudgetValid = /^\d+(\.\d{1,2})?$/.test(amount) && amountValue >= 5 && amountValue <= 10000;
  const isScheduleValid = Boolean(start && end && start.getTime() > Date.now() && end.getTime() > start.getTime());
  const dateFormat = (date: Date): string => date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const renderNav = (onContinue: () => void, continueDisabled = false) => (
    <View style={{ gap: 10 }}>
      {error ? <AdsNotice tone="danger" message={error} /> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {stepIndex > 0 ? <AdsButton label="Back" variant="secondary" icon={<ArrowLeft size={16} color={colors.text} />} onPress={() => goTo(stepIndex - 1)} style={{ flex: 1 }} /> : <View style={{ flex: 1 }} />}
        <AdsButton label="Continue" icon={<ArrowRight size={16} color={continueDisabled ? colors.disabledText : '#ffffff'} />} onPress={onContinue} disabled={continueDisabled} style={{ flex: 1 }} />
      </View>
    </View>
  );

  const renderStep = () => {
    switch (stepIndex) {
      case 0:
        return (
          <>
            <StepHeader title="Campaign objective" description="Plan an ad that sends people to a page you choose." />
            <AdsCard>
              <SectionTitle icon={<MousePointer size={16} color={colors.mutedText} />} title="Drive traffic" />
              <Text style={{ fontSize: 14, color: colors.secondaryText }}>Preview a sponsored public feed ad with an HTTPS destination.</Text>
            </AdsCard>
            {renderNav(() => goTo(1))}
          </>
        );
      case 1:
        return (
          <>
            <StepHeader title="Design your ad" description="Add the sponsor, destination, and image for a labeled public feed preview." />
            <AdsCard>
              <AdsField label="Sponsor display name" maxLength={80} value={creative.sponsorName ?? ''} onChangeText={(sponsorName) => updateCreative({ sponsorName })} />
              <AdsField label="Headline" maxLength={80} value={creative.headline ?? ''} onChangeText={(headline) => updateCreative({ headline })} />
              <AdsField label="Ad copy" multiline maxLength={280} value={creative.primaryText ?? ''} onChangeText={(primaryText) => updateCreative({ primaryText })} />
              <AdsField label="Destination URL" placeholder="https://example.com" autoCapitalize="none" keyboardType="url" value={creative.destinationUrl ?? ''} onChangeText={(destinationUrl) => updateCreative({ destinationUrl })} />
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.secondaryText }}>Ad image</Text>
                <Text style={{ fontSize: 12, color: colors.mutedText }}>JPG, PNG, or WebP up to 5 MB. The image stays on this phone.</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <AdsButton label={creative.imageUri ? 'Change image' : 'Choose image'} variant="secondary" onPress={() => void handlePickImage()} style={{ flex: 1 }} />
                  {creative.imageUri ? <AdsButton label="Remove image" variant="secondary" onPress={() => updateCreative({ imageUri: undefined })} style={{ flex: 1 }} /> : null}
                </View>
              </View>
              <AdsField label="Image description" maxLength={160} value={creative.imageAlt ?? ''} onChangeText={(imageAlt) => updateCreative({ imageAlt })} />
            </AdsCard>
            <AdPreviewCard creative={creative} />
            {renderNav(handleCreativeContinue)}
          </>
        );
      case 2:
        return (
          <>
            <StepHeader title="Choose a content context" description="Choose topics for the public feed placement preview. Topics describe the surrounding content." />
            <AdsCard>
              <SectionTitle icon={<LayoutGrid size={16} color={colors.mutedText} />} title="Public feed topics" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CONTEXT_TOPICS.map((topic) => (
                  <AdsToggleChip
                    key={topic}
                    label={topic}
                    pressed={topics.includes(topic)}
                    onChange={(pressed) => setTopics((previous) => (pressed ? [...previous, topic] : previous.filter((selected) => selected !== topic)))}
                  />
                ))}
              </View>
              <Text style={{ fontSize: 13, color: colors.mutedText }}>Community placements require an eligibility check and approval. Reach estimates are unavailable for this preview.</Text>
            </AdsCard>
            {renderNav(() => goTo(3), topics.length === 0)}
          </>
        );
      case 3:
        return (
          <>
            <StepHeader title="Plan your budget and schedule" description="Set a total spending cap and a fixed window for the campaign preview." />
            <AdsCard>
              <SectionTitle icon={<DollarSign size={16} color={colors.mutedText} />} title="Budget plan" />
              <AdsField label="Maximum total spend" hint="Enter 5 to 10,000 in your selected currency." keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
              <AdsOptionGroup label="Currency" value={currency} options={[{ value: 'TTD', label: 'TTD' }, { value: 'USD', label: 'USD' }]} onChange={setCurrency} />
              <Text style={{ fontSize: 13, color: colors.mutedText }}>This preview has no charges or price quote.</Text>
            </AdsCard>
            <AdsCard>
              <SectionTitle icon={<Calendar size={16} color={colors.mutedText} />} title="Schedule" />
              <DateTimeField label="Start date and time" mode="datetime" placeholder="Choose a start" value={start} onChange={setStart} minimumDate={new Date()} />
              <DateTimeField label="End date and time" mode="datetime" placeholder="Choose an end" value={end} onChange={setEnd} minimumDate={start ?? new Date()} />
              <Text style={{ fontSize: 13, color: colors.mutedText }}>Times use {timeZone}. Choose a future start and an end after the start.</Text>
            </AdsCard>
            {renderNav(() => {
              if (!isBudgetValid || !isScheduleValid || !start || !end) return;
              setBudget({ amount: amountValue, currency, start, end, timeZone });
              goTo(4);
            }, !isBudgetValid || !isScheduleValid)}
          </>
        );
      default:
        return (
          <>
            <StepHeader title="Review campaign preview" description="Check the creative, placement, schedule, and planned spending cap." />
            <AdPreviewCard creative={creative} />
            <AdsCard title="Campaign plan">
              <AdsInfoRow label="Objective" value="Drive traffic" />
              <AdsInfoRow label="Placement" value="Public feed" />
              <AdsInfoRow label="Content topics" value={topics.join(', ')} />
              {budget ? (
                <>
                  <AdsInfoRow label="Maximum planned spend" value={`${budget.currency} ${budget.amount.toFixed(2)}`} />
                  <AdsInfoRow label="Starts" value={dateFormat(budget.start)} />
                  <AdsInfoRow label="Ends" value={dateFormat(budget.end)} />
                  <AdsInfoRow label="Time zone" value={budget.timeZone} valueStyle="muted" />
                </>
              ) : null}
              <AdsNotice tone="success" message="Preview only. Closing this builder discards your draft. Delivery, review submission, and payment are unavailable." />
            </AdsCard>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AdsButton label="Back to edit" variant="secondary" onPress={() => goTo(3)} style={{ flex: 1 }} />
              <AdsButton label="Close preview" onPress={handleClose} style={{ flex: 1 }} />
            </View>
          </>
        );
    }
  };

  return (
    <AdsScreen title="Create an ad preview" onBackPress={() => setShowDiscard(true)}>
      <Text style={{ fontSize: 13, color: colors.mutedText }}>Plan a sponsored public feed ad.</Text>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${stepIndex + 1} of ${STEPS.length}, ${STEPS[stepIndex]}`}>
        {STEPS.map((step, index) => (
          <View key={step} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: index <= stepIndex ? ADS_GREEN : colors.control }}>
              <Text style={{ color: index <= stepIndex ? '#ffffff' : colors.mutedText, fontWeight: '800' }}>{index + 1}</Text>
            </View>
            {index === stepIndex ? <Text style={{ fontSize: 10, fontWeight: '700', color: colors.secondaryText, textAlign: 'center' }}>{step}</Text> : null}
          </View>
        ))}
      </View>
      {renderStep()}
      <CustomModal
        visible={showDiscard}
        type="warning"
        title="Discard campaign preview?"
        message="Your draft will be cleared and you will return to Ads."
        confirmText="Discard preview"
        cancelText="Keep editing"
        onConfirm={() => {
          setShowDiscard(false);
          handleClose();
        }}
        onCancel={() => setShowDiscard(false)}
        onClose={() => setShowDiscard(false)}
      />
    </AdsScreen>
  );
}

function StepHeader({ title, description }: { title: string; description: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>{title}</Text>
      <Text style={{ fontSize: 13, color: colors.mutedText }}>{description}</Text>
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon}
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{title}</Text>
    </View>
  );
}
