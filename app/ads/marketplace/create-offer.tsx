import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, MapPin, Monitor, Plus, Share2, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsFormSkeleton } from '@/components/ads/AdsSkeletons';
import { ADS_GREEN, AdsButton, AdsCard, AdsErrorState, AdsField, AdsHeading, AdsInfoRow, AdsOptionGroup, AdsScreen, AdsToggleChip, AdsToggleRow } from '@/components/ads/AdsUi';
import { AdsNumberField, GENDER_OPTIONS, OfferDisplaySpecsFields, OfferPricingFields, OfferTagsField, type OfferPricingValues } from '@/components/ads/OfferFormSections';
import DateTimeField from '@/components/ui/DateTimeField';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdDisplaySpecs, AdDisplayType, AdOfferInput, AudienceGender, OperatingHours } from '@/lib/types/adsMarketplace';

const STEPS = ['Basic Information', 'Display Type', 'Display Specifications', 'Audience Information', 'Pricing', 'Availability & Inventory', 'Review & Submit'];
const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type TimeSlot = { startDate: Date | null; endDate: Date | null; isAvailable: boolean };
type Audience = { minAge: number; maxAge: number; gender: AudienceGender; estimatedReach: number; averageEngagement: number };

/**
 * Create a new offer (website /ads/marketplace/create-offer): a seven-step wizard for verified hosts, with Save as
 * draft on every step before the review.
 */
export default function CreateOfferRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [hostId, setHostId] = useState<string | null>(null);
  const [isLoadingHost, setIsLoadingHost] = useState(true);
  const [hostError, setHostError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [displayType, setDisplayType] = useState<AdDisplayType | ''>('');
  const [displaySpecs, setDisplaySpecs] = useState<AdDisplaySpecs>({});
  const [audience, setAudience] = useState<Audience>({ minAge: 18, maxAge: 65, gender: 'all', estimatedReach: 0, averageEngagement: 0 });
  const [pricing, setPricing] = useState<OfferPricingValues>({ basePrice: 0, currency: 'USD', pricingModel: 'fixed', minimumDuration: 1, maximumDuration: 30 });
  const [totalInventory, setTotalInventory] = useState(1);
  const [hasTimeSlots, setHasTimeSlots] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [hasOperatingHours, setHasOperatingHours] = useState(false);
  const [operatingHours, setOperatingHours] = useState<OperatingHours>({});

  useEffect(() => {
    if (!adsMarketplaceService.currentUserId()) {
      toast.error('Please log in to create an offer');
      router.replace(adsRoutes.login);
      return;
    }
    let isActive = true;
    setIsLoadingHost(true);
    setHostError(null);
    adsMarketplaceService.getMyHost()
      .then((host) => {
        if (!isActive) return;
        if (!host) {
          toast.error('You must be a registered host to create offers');
          router.replace(adsRoutes.becomeHost);
          return;
        }
        if (host.verificationStatus !== 'verified') {
          toast.error('Your host account must be verified before creating offers');
          router.replace(adsRoutes.becomeHost);
          return;
        }
        setHostId(host.hostId);
        setIsLoadingHost(false);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setHostError(AdsMarketplaceService.errorMessage(error, 'Failed to load host information.'));
        setIsLoadingHost(false);
      });
    return () => {
      isActive = false;
    };
  }, [router, attempt]);

  const updateAudience = (update: Partial<Audience>): void => setAudience((previous) => ({ ...previous, ...update }));

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!title.trim() || !description.trim()) {
          toast.error('Title and description are required');
          return false;
        }
        return true;
      case 2:
        if (!displayType) {
          toast.error('Please select a display type');
          return false;
        }
        return true;
      case 3:
        if (displayType === 'digital' && !displaySpecs.websiteUrl && !displaySpecs.appName && !displaySpecs.digitalLocation) {
          toast.error('Please provide at least one digital specification');
          return false;
        }
        if (displayType === 'social' && !displaySpecs.platform) {
          toast.error('Please select a social media platform');
          return false;
        }
        if (displayType === 'physical' && !displaySpecs.physicalLocation) {
          toast.error('Please provide a physical location');
          return false;
        }
        return true;
      case 4:
        if (audience.estimatedReach <= 0) {
          toast.error('Estimated reach must be greater than 0');
          return false;
        }
        return true;
      case 5:
        if (pricing.basePrice <= 0) {
          toast.error('Base price must be greater than 0');
          return false;
        }
        return true;
      case 6:
        if (totalInventory <= 0) {
          toast.error('Total inventory must be greater than 0');
          return false;
        }
        if (hasOperatingHours && Object.values(operatingHours).some((hours) => !TIME_PATTERN.test(hours.start) || !TIME_PATTERN.test(hours.end))) {
          toast.error('Enter opening and closing times as HH:MM');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const buildOffer = (status: 'draft' | 'active'): AdOfferInput => {
    const offer: AdOfferInput = {
      title,
      description,
      displayType: displayType || undefined,
      displaySpecs,
      audienceInfo: {
        demographics: { ageRange: { min: audience.minAge, max: audience.maxAge }, gender: audience.gender, location: [] },
        interests: [],
        estimatedReach: audience.estimatedReach,
        averageEngagement: audience.averageEngagement,
      },
      pricing,
      category: category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      totalInventory,
      status,
    };
    const filledSlots = timeSlots.filter((slot) => slot.startDate && slot.endDate);
    if (hasTimeSlots && filledSlots.length > 0) {
      offer.availableTimeSlots = filledSlots.map((slot) => ({ startDate: slot.startDate?.toISOString() ?? '', endDate: slot.endDate?.toISOString() ?? '', isAvailable: slot.isAvailable }));
    }
    if (hasOperatingHours && Object.keys(operatingHours).length > 0) offer.operatingHours = operatingHours;
    return offer;
  };

  const submitOffer = async (status: 'draft' | 'active'): Promise<void> => {
    if (!hostId) {
      toast.error('Host information not loaded');
      return;
    }
    if (status === 'active' && !validateStep(currentStep)) return;
    const setBusy = status === 'draft' ? setIsSavingDraft : setIsSubmitting;
    setBusy(true);
    try {
      const offerId = await adsMarketplaceService.createOffer(hostId, buildOffer(status));
      toast.success(status === 'draft' ? 'Draft saved successfully' : 'Offer created successfully!');
      router.replace(adsRoutes.offer(offerId));
    } catch (error: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(error, status === 'draft' ? 'Failed to save draft' : 'Failed to create offer'));
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = (day: string): void => {
    setOperatingHours((previous) => {
      const next = { ...previous };
      if (next[day]) delete next[day];
      else next[day] = { start: '09:00', end: '17:00', isOpen: true };
      return next;
    });
  };
  const updateDay = (day: string, field: 'start' | 'end', value: string): void => {
    setOperatingHours((previous) => (previous[day] ? { ...previous, [day]: { ...previous[day], [field]: value } } : previous));
  };
  const updateSlot = (index: number, update: Partial<TimeSlot>): void => {
    setTimeSlots((previous) => previous.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...update } : slot)));
  };

  const renderStep = (): ReactNode => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <AdsField label="Offer title" required placeholder="e.g., Premium Billboard Space in Downtown" value={title} onChangeText={setTitle} />
            <AdsField label="Description" required multiline placeholder="Describe your ad space in detail..." value={description} onChangeText={setDescription} />
            <AdsField label="Category" placeholder="e.g., Outdoor Advertising, Digital Display" value={category} onChangeText={setCategory} />
            <OfferTagsField tags={tags} onChange={setTags} />
          </>
        );
      case 2:
        return (
          <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
            <ChoiceCard selected={displayType === 'digital'} title="Digital" description="Websites, apps and digital screens" icon={<Monitor size={20} color={displayType === 'digital' ? ADS_GREEN : colors.mutedText} />} onSelect={() => setDisplayType('digital')} />
            <ChoiceCard selected={displayType === 'social'} title="Social media" description="Instagram, Facebook, X, YouTube, TikTok" icon={<Share2 size={20} color={displayType === 'social' ? ADS_GREEN : colors.mutedText} />} onSelect={() => setDisplayType('social')} />
            <ChoiceCard selected={displayType === 'physical'} title="Physical" description="Billboards, banners and posters" icon={<MapPin size={20} color={displayType === 'physical' ? ADS_GREEN : colors.mutedText} />} onSelect={() => setDisplayType('physical')} />
          </View>
        );
      case 3:
        return (
          <OfferDisplaySpecsFields
            displayType={displayType}
            specs={displaySpecs}
            onSpecsChange={(update) => setDisplaySpecs((previous) => ({ ...previous, ...update }))}
            estimatedReach={audience.estimatedReach}
            onEstimatedReachChange={(estimatedReach) => updateAudience({ estimatedReach })}
          />
        );
      case 4:
        return (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><AdsNumberField label="Minimum age" value={audience.minAge} onChange={(minAge) => updateAudience({ minAge })} /></View>
              <View style={{ flex: 1 }}><AdsNumberField label="Maximum age" value={audience.maxAge} onChange={(maxAge) => updateAudience({ maxAge })} /></View>
            </View>
            <AdsOptionGroup label="Gender" value={audience.gender} options={GENDER_OPTIONS} onChange={(gender) => updateAudience({ gender })} />
            <AdsNumberField label="Estimated reach" required placeholder="10000" value={audience.estimatedReach} onChange={(estimatedReach) => updateAudience({ estimatedReach })} />
            <AdsNumberField label="Average engagement" placeholder="500" value={audience.averageEngagement} onChange={(averageEngagement) => updateAudience({ averageEngagement })} />
          </>
        );
      case 5:
        return <OfferPricingFields pricing={pricing} onChange={(update) => setPricing((previous) => ({ ...previous, ...update }))} />;
      case 6:
        return (
          <>
            <AdsNumberField label="Total inventory" required hint="Number of available ad slots" placeholder="1" fallback={1} value={totalInventory} onChange={setTotalInventory} />
            <AdsToggleRow label="Set specific time slots" description="Only allow bookings inside the date ranges you add." value={hasTimeSlots} onChange={setHasTimeSlots} />
            {hasTimeSlots ? (
              <View style={{ gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, padding: 12 }}>
                {timeSlots.map((slot, index) => (
                  <View key={index} style={{ gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
                    <DateTimeField label="Start date" mode="datetime" placeholder="Choose a start" value={slot.startDate} onChange={(startDate) => updateSlot(index, { startDate })} />
                    <DateTimeField label="End date" mode="datetime" placeholder="Choose an end" value={slot.endDate} minimumDate={slot.startDate ?? undefined} onChange={(endDate) => updateSlot(index, { endDate })} />
                    <AdsButton label="Remove time slot" variant="ghost" compact icon={<X size={16} color={colors.destructive} />} onPress={() => setTimeSlots((previous) => previous.filter((_, slotIndex) => slotIndex !== index))} />
                  </View>
                ))}
                <AdsButton label="Add time slot" variant="secondary" compact icon={<Plus size={16} color={colors.text} />} onPress={() => setTimeSlots((previous) => [...previous, { startDate: null, endDate: null, isAvailable: true }])} />
              </View>
            ) : null}
            <AdsToggleRow label="Set operating hours" description="Choose the days and hours your ad space is open." value={hasOperatingHours} onChange={setHasOperatingHours} />
            {hasOperatingHours ? (
              <View style={{ gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, padding: 12 }}>
                {DAYS_OF_WEEK.map((day) => (
                  <View key={day} style={{ gap: 8 }}>
                    <AdsToggleChip label={day.charAt(0).toUpperCase() + day.slice(1)} pressed={Boolean(operatingHours[day])} onChange={() => toggleDay(day)} />
                    {operatingHours[day] ? (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                        <View style={{ flex: 1 }}><AdsField label="Opens" placeholder="09:00" value={operatingHours[day].start} onChangeText={(value) => updateDay(day, 'start', value)} /></View>
                        <Text style={{ color: colors.mutedText, paddingBottom: 14 }}>to</Text>
                        <View style={{ flex: 1 }}><AdsField label="Closes" placeholder="17:00" value={operatingHours[day].end} onChangeText={(value) => updateDay(day, 'end', value)} /></View>
                      </View>
                    ) : <Text style={{ fontSize: 13, color: colors.mutedText }}>Closed</Text>}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        );
      default:
        return (
          <View style={{ gap: 10 }}>
            <AdsInfoRow label="Title" value={title} />
            <AdsInfoRow label="Display type" value={displayType} />
            <AdsInfoRow label="Price" value={`${pricing.currency} ${pricing.basePrice} (${pricing.pricingModel})`} />
            <AdsInfoRow label="Estimated reach" value={audience.estimatedReach.toLocaleString()} />
            <AdsInfoRow label="Inventory" value={`${totalInventory} slots`} />
          </View>
        );
    }
  };

  return (
    <AdsScreen
      title="Create Offer"
      loading={isLoadingHost}
      skeleton={<AdsFormSkeleton sections={2} />}
      footer={hostId ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {currentStep > 1 ? <AdsButton label="Back" variant="secondary" icon={<ArrowLeft size={16} color={colors.text} />} onPress={() => setCurrentStep((step) => Math.max(step - 1, 1))} style={{ flex: 1 }} /> : null}
            {currentStep < STEPS.length ? (
              <AdsButton label="Next" icon={<ArrowRight size={16} color="#ffffff" />} onPress={() => {
                if (validateStep(currentStep)) setCurrentStep((step) => Math.min(step + 1, STEPS.length));
              }} style={{ flex: 1 }} />
            ) : (
              <AdsButton label={isSubmitting ? 'Creating offer…' : 'Create offer'} loading={isSubmitting} onPress={() => void submitOffer('active')} style={{ flex: 1 }} />
            )}
          </View>
          {currentStep < STEPS.length ? <AdsButton label={isSavingDraft ? 'Saving…' : 'Save as draft'} variant="ghost" compact loading={isSavingDraft} onPress={() => void submitOffer('draft')} /> : null}
        </View>
      ) : undefined}
    >
      <AdsHeading title="Create new offer" subtitle="Fill in the details to create your ad offer" />
      {hostError ? <AdsErrorState message={hostError} onRetry={() => setAttempt((value) => value + 1)} /> : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLabel={`Step ${currentStep} of ${STEPS.length}`}>
            {STEPS.map((step, index) => (
              <View key={step} style={{ flexDirection: 'row', alignItems: 'center', flex: index < STEPS.length - 1 ? 1 : 0 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: index + 1 <= currentStep ? ADS_GREEN : colors.control }}>
                  {index + 1 < currentStep ? <Check size={14} color="#ffffff" strokeWidth={3} /> : <Text style={{ fontSize: 12, fontWeight: '800', color: index + 1 <= currentStep ? '#ffffff' : colors.mutedText }}>{index + 1}</Text>}
                </View>
                {index < STEPS.length - 1 ? <View style={{ flex: 1, height: 2, marginHorizontal: 3, borderRadius: 1, backgroundColor: index + 1 < currentStep ? ADS_GREEN : colors.border }} /> : null}
              </View>
            ))}
          </View>
          <AdsCard>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: colors.mutedText }}>STEP {currentStep} OF {STEPS.length}</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{STEPS[currentStep - 1]}</Text>
            </View>
            {renderStep()}
          </AdsCard>
        </>
      )}
    </AdsScreen>
  );
}

function ChoiceCard({ selected, title, description, icon, onSelect }: { selected: boolean; title: string; description: string; icon: ReactNode; onSelect: () => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      activeOpacity={0.85}
      onPress={onSelect}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 2, borderColor: selected ? ADS_GREEN : colors.border, backgroundColor: selected ? colors.successSurface : colors.surface, padding: 14 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{title}</Text>
        <Text style={{ fontSize: 13, color: colors.mutedText }}>{description}</Text>
      </View>
      {selected ? <Check size={18} color={ADS_GREEN} /> : null}
    </TouchableOpacity>
  );
}
