import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle, BadgeCheck, CalendarDays, CheckCircle2, Clock3, FileCheck2, HandCoins, HeartHandshake, Heart, MapPin, PawPrint, Phone, ShieldCheck, Stethoscope,
  type LucideIcon,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { EMPTY_PET_FILTERS, PET_SAFETY_STEPS, PET_SHELTERS, PET_TYPES, type PetSafetyStepKey } from '@/lib/services/PetsService';
import type { CreatePetInterestInput, CreatePetListingInput, PetListing, PetListingMode, PetType, PetsFilterValues } from '@/lib/types/pets';
import PetsSheet, { PetsButton, PetsErrorText, PetsField, PetsToggleRow } from './PetsSheet';

const formatListedAge = (createdAt: string | undefined): string => {
  if (!createdAt) return 'Listed 2 days ago';
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (!Number.isFinite(days) || days < 1) return 'Listed today';
  return days === 1 ? 'Listed yesterday' : `Listed ${days} days ago`;
};

type StatusTone = 'positive' | 'warning' | 'neutral';
function StatusCard({ icon: StatusIcon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: StatusTone }) {
  const { colors } = useAppTheme();
  const palette = tone === 'positive' ? { background: colors.successSurface, color: colors.successText }
    : tone === 'warning' ? { background: colors.warningSurface, color: colors.warningText } : { background: colors.control, color: colors.secondaryText };
  return <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: palette.background }}>
    <StatusIcon color={palette.color} size={18} />
    <Text style={{ marginTop: 8, color: palette.color, opacity: 0.75, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Text>
    <Text style={{ marginTop: 3, color: palette.color, fontSize: 12, fontWeight: '700', lineHeight: 15 }}>{value}</Text>
  </View>;
}

type PetDetailsSheetProps = { listing: PetListing | null; onInterest: (listing: PetListing) => void; onClose: () => void };
/** Website PetsPetDetailsModal: photo and price, verification/rehoming/health cards, about and safe-meeting notes. */
export function PetDetailsSheet({ listing, onInterest, onClose }: PetDetailsSheetProps) {
  const { colors } = useAppTheme();
  if (!listing) return null;
  return <PetsSheet visible title={`Meet ${listing.name}`} description={`${listing.breed} · ${listing.age} · ${listing.sex}`} onClose={onClose}
    footer={<><PetsButton variant="secondary" label="Keep browsing" onPress={onClose} /><PetsButton label="I'm interested" icon={<Heart color="#ffffff" size={16} />} onPress={() => onInterest(listing)} /></>}>
    <View style={{ height: 240, overflow: 'hidden', borderRadius: 18, backgroundColor: colors.control }}>
      {listing.imageUrl ? <Image source={{ uri: listing.imageUrl }} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityLabel={`${listing.name}, ${listing.breed}`} /> : null}
      <LinearGradient colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.55)']} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
      <Text style={{ position: 'absolute', left: 14, bottom: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.95)', color: '#065f46', fontSize: 12, fontWeight: '800' }}>{listing.priceLabel}</Text>
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <StatusCard icon={BadgeCheck} label="Identity" value={listing.isVerified ? 'Verified listing' : 'Not yet verified'} tone={listing.isVerified ? 'positive' : 'neutral'} />
      <StatusCard icon={AlertTriangle} label="Rehoming" value={listing.isUrgent ? 'Home needed soon' : 'Standard timeline'} tone={listing.isUrgent ? 'warning' : 'neutral'} />
      <StatusCard icon={Stethoscope} label="Health" value={listing.isVaccinated ? 'Vaccinated' : 'Ask about vaccines'} tone={listing.isVaccinated ? 'positive' : 'neutral'} />
    </View>
    <View style={{ padding: 14, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>About {listing.name}</Text>
      <Text style={{ color: colors.secondaryText, fontSize: 13, lineHeight: 20 }}>Friendly, curious, and ready to meet a caring family. Ask the current carer about temperament, daily routines, diet, and how {listing.name} behaves around children or other animals.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><MapPin color={colors.accent} size={15} /><Text style={{ color: colors.secondaryText, fontSize: 13 }}>{listing.location} · {listing.distance}</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><CalendarDays color={colors.accent} size={15} /><Text style={{ color: colors.secondaryText, fontSize: 13 }}>{formatListedAge(listing.createdAt)}</Text></View>
      </View>
    </View>
    <View style={{ padding: 14, flexDirection: 'row', gap: 10, borderRadius: 16, backgroundColor: colors.successSurface }}>
      <ShieldCheck color={colors.successText} size={18} />
      <Text style={{ flex: 1, color: colors.successText, fontSize: 12, lineHeight: 18 }}><Text style={{ fontWeight: '900' }}>Meet safely.</Text> Visit the pet in person, review health records, and never send a deposit before confirming the listing.</Text>
    </View>
  </PetsSheet>;
}

function DoneState({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return <View style={{ paddingVertical: 18, alignItems: 'center', gap: 12 }}>
    <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.successSurface }}><CheckCircle2 color={colors.successText} size={28} /></View>
    <Text style={{ color: colors.secondaryText, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{message}</Text>
  </View>;
}

type PetInterestSheetProps = { listing: PetListing | null; onSubmit: (listing: PetListing, input: CreatePetInterestInput) => Promise<void>; onClose: () => void };
/** Website PetsInterestModal: name, contact and a message for the carer. */
export function PetInterestSheet({ listing, onSubmit, onClose }: PetInterestSheetProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (listing) { setIsSent(false); setError(''); } }, [listing]);
  if (!listing) return null;
  const canSubmit = Boolean(name.trim() && contact.trim() && message.trim());

  const handleSubmit = async () => {
    if (!canSubmit) { setError('Fill in your name, contact and message.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      await onSubmit(listing, { name: name.trim(), contact: contact.trim(), message: message.trim() });
      setIsSent(true);
      setMessage('');
    } catch (submissionError: unknown) {
      setError(submissionError instanceof Error ? submissionError.message : 'Could not send enquiry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return <PetsSheet visible title="Interest saved" onClose={onClose} footer={<PetsButton label="Done" onPress={onClose} />}>
      <DoneState message={`Your enquiry about ${listing.name} was saved for the carer.`} />
    </PetsSheet>;
  }
  return <PetsSheet visible title={`Interested in ${listing.name}?`} description="Share a few details for the carer." onClose={onClose} busy={isSubmitting}
    footer={<><PetsButton variant="secondary" label="Cancel" disabled={isSubmitting} onPress={onClose} /><PetsButton label={isSubmitting ? 'Sending enquiry…' : 'Send enquiry'} busy={isSubmitting} onPress={() => void handleSubmit()} /></>}>
    <PetsField label="Your name" value={name} onChangeText={setName} editable={!isSubmitting} maxLength={100} />
    <PetsField label="Email or phone" value={contact} onChangeText={setContact} editable={!isSubmitting} maxLength={160} keyboardType="email-address" />
    <PetsField label="Your message" value={message} onChangeText={setMessage} editable={!isSubmitting} maxLength={1000} multiline placeholder={`Tell the carer why ${listing.name} may be a good fit...`} />
    {error ? <PetsErrorText message={error} /> : null}
  </PetsSheet>;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  const { colors } = useAppTheme();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: colors.control }}>
    {options.map((option) => {
      const selected = option.value === value;
      return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onChange(option.value)}
        style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: selected ? colors.surface : 'transparent' }}>
        <Text style={{ color: selected ? colors.accentText : colors.mutedText, fontSize: 13, fontWeight: '800' }}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

type PetCreateListingSheetProps = { visible: boolean; onCreate: (input: CreatePetListingInput) => Promise<void>; onClose: () => void };
/** Website PetsCreateListingModal: name, breed, age, location, animal type, adoption or sale, vaccinations. */
export function PetCreateListingSheet({ visible, onCreate, onClose }: PetCreateListingSheetProps) {
  const { colors } = useAppTheme();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [petType, setPetType] = useState<PetType>('Dogs');
  const [mode, setMode] = useState<PetListingMode>('adoption');
  const [isVaccinated, setIsVaccinated] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!visible) { setIsCreated(false); setError(''); } }, [visible]);
  if (!visible) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !breed.trim() || !age.trim() || !location.trim()) { setError('Fill in the pet name, breed, age and location.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      await onCreate({ name, breed, age, location, petType, mode, isVaccinated });
      setIsCreated(true);
      setName(''); setBreed(''); setAge(''); setLocation(''); setIsVaccinated(false);
    } catch (submissionError: unknown) {
      setError(submissionError instanceof Error ? submissionError.message : 'Could not create listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCreated) {
    return <PetsSheet visible title="Listing added" onClose={onClose} footer={<PetsButton label="View listings" onPress={onClose} />}>
      <DoneState message="Your listing was submitted for review. It shows as Pending review until an administrator approves it." />
    </PetsSheet>;
  }
  return <PetsSheet visible title="List a pet" description="Listings are reviewed before everyone can see them." onClose={onClose} busy={isSubmitting}
    footer={<><PetsButton variant="secondary" label="Cancel" disabled={isSubmitting} onPress={onClose} /><PetsButton label={isSubmitting ? 'Submitting for review…' : 'Submit for review'} busy={isSubmitting} onPress={() => void handleSubmit()} /></>}>
    <PetsField label="Pet name" value={name} onChangeText={setName} editable={!isSubmitting} maxLength={80} />
    <PetsField label="Breed" value={breed} onChangeText={setBreed} editable={!isSubmitting} maxLength={100} />
    <PetsField label="Age" value={age} onChangeText={setAge} editable={!isSubmitting} maxLength={40} placeholder="e.g. 2 years" />
    <PetsField label="Location" value={location} onChangeText={setLocation} editable={!isSubmitting} maxLength={120} />
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Animal type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PET_TYPES.map((type) => {
          const selected = type === petType;
          return <Pressable key={type} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setPetType(type)}
            style={{ minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.surface }}>
            <Text style={{ color: selected ? colors.onAccent : colors.secondaryText, fontSize: 13, fontWeight: '700' }}>{type}</Text>
          </Pressable>;
        })}
      </View>
    </View>
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Listing type</Text>
      <Segmented label="Listing type" value={mode} onChange={setMode} options={[{ value: 'adoption', label: 'Adoption' }, { value: 'sale', label: 'Sale' }]} />
    </View>
    <PetsToggleRow label="Vaccinations are up to date" value={isVaccinated} onValueChange={setIsVaccinated} />
    {error ? <PetsErrorText message={error} /> : null}
  </PetsSheet>;
}

type PetFilterSheetProps = { visible: boolean; values: PetsFilterValues; onApply: (values: PetsFilterValues) => void; onClose: () => void };
/** Website PetsFilterModal: vaccinated, verified and urgent toggles. */
export function PetFilterSheet({ visible, values, onApply, onClose }: PetFilterSheetProps) {
  const [draft, setDraft] = useState<PetsFilterValues>(values);
  useEffect(() => { if (visible) setDraft(values); }, [visible, values]);
  if (!visible) return null;
  const toggle = (field: keyof PetsFilterValues) => setDraft((current) => ({ ...current, [field]: !current[field] }));
  return <PetsSheet visible title="Filter pets" onClose={onClose}
    footer={<><PetsButton variant="secondary" label="Clear" onPress={() => setDraft(EMPTY_PET_FILTERS)} /><PetsButton label="Apply filters" onPress={() => onApply(draft)} /></>}>
    <PetsToggleRow label="Vaccinated pets only" value={draft.isVaccinatedOnly} onValueChange={() => toggle('isVaccinatedOnly')} />
    <PetsToggleRow label="Verified listings only" value={draft.isVerifiedOnly} onValueChange={() => toggle('isVerifiedOnly')} />
    <PetsToggleRow label="Urgent rehoming only" value={draft.isUrgentOnly} onValueChange={() => toggle('isUrgentOnly')} />
  </PetsSheet>;
}

const SAFETY_ICONS: Readonly<Record<PetSafetyStepKey, LucideIcon>> = { meet: HeartHandshake, ownership: FileCheck2, health: Stethoscope, deposit: HandCoins };

/** Website PetsSafetyGuideModal: four steps and a warning. */
export function PetSafetyGuideSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useAppTheme();
  if (!visible) return null;
  return <PetsSheet visible title="Pet safety guide" description="Before you commit to adopting or buying a pet." onClose={onClose} footer={<PetsButton label="I understand" onPress={onClose} />}>
    {PET_SAFETY_STEPS.map((step, index) => {
      const StepIcon = SAFETY_ICONS[step.key];
      return <View key={step.key} style={{ padding: 14, flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.successSurface }}><StepIcon color={colors.successText} size={20} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.mutedText, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>Step {index + 1}</Text>
          <Text style={{ marginTop: 2, color: colors.text, fontSize: 14, fontWeight: '800' }}>{step.title}</Text>
          <Text style={{ marginTop: 4, color: colors.secondaryText, fontSize: 13, lineHeight: 19 }}>{step.description}</Text>
        </View>
      </View>;
    })}
    <View style={{ padding: 14, flexDirection: 'row', gap: 10, borderRadius: 16, backgroundColor: colors.destructiveSurface }}>
      <CheckCircle2 color={colors.destructiveText} size={18} />
      <Text style={{ flex: 1, color: colors.destructiveText, fontSize: 12, lineHeight: 18 }}><Text style={{ fontWeight: '900' }}>Trust your instincts.</Text> Leave the meeting and report the listing if the pet appears neglected, the details change, or you feel pressured to pay quickly.</Text>
    </View>
  </PetsSheet>;
}

/** Website PetsShelterDetailsModal: the verified partner shelters. */
export function PetShelterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useAppTheme();
  if (!visible) return null;
  const detail = (Icon: LucideIcon, value: string) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Icon color={colors.accent} size={15} /><Text style={{ flexShrink: 1, color: colors.secondaryText, fontSize: 12 }}>{value}</Text></View>;
  return <PetsSheet visible title="Discover local shelters" description="Verified partners helping animals recover and find safe, permanent homes." onClose={onClose} footer={<PetsButton label="Done exploring" onPress={onClose} />}>
    {PET_SHELTERS.map((shelter) => <View key={shelter.name} style={{ padding: 14, flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.successSurface }}><PawPrint color={colors.successText} size={20} /></View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{shelter.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.successSurface }}><BadgeCheck color={colors.successText} size={11} /><Text style={{ color: colors.successText, fontSize: 10, fontWeight: '800' }}>Verified</Text></View>
        </View>
        <Text style={{ color: colors.mutedText, fontSize: 13 }}>{shelter.specialty}</Text>
        <View style={{ marginTop: 6, gap: 6 }}>
          {detail(MapPin, shelter.location)}
          {detail(Clock3, shelter.hours)}
          {detail(Phone, shelter.phone)}
          {detail(HeartHandshake, `${shelter.availablePets} pets available`)}
        </View>
      </View>
    </View>)}
  </PetsSheet>;
}
