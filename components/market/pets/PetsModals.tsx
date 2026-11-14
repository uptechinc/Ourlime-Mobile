import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CheckCircle2, ImagePlus, X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { MAX_PET_PHOTOS, PET_HEALTH_LABELS } from '@/lib/services/PetsService';
import {
  PET_HEALTH_STATUSES, PET_LOCATIONS, PET_SEXES, PET_TYPES,
  type CreatePetInterestInput, type CreatePetListingInput, type PetContactPreference, type PetListing, type PetPhotoPick,
} from '@/lib/types/pets';
import PetsSheet, { PetsButton, PetsChoiceRow, PetsErrorText, PetsField, PetsLabel } from './PetsSheet';

const INITIAL_FORM: CreatePetListingInput = {
  name: '', petType: 'Dogs', breed: '', age: '', sex: 'Unknown', location: '', description: '', temperament: '',
  vaccinationStatus: 'unknown', sterilisationStatus: 'unknown', healthNotes: '', adoptionRequirements: '', contactPreference: 'ourlime',
};
const HEALTH_OPTIONS = PET_HEALTH_STATUSES.map((status) => ({ value: status, label: PET_HEALTH_LABELS[status] }));
const CONTACT_OPTIONS: readonly { value: PetContactPreference; label: string }[] = [
  { value: 'ourlime', label: 'Ourlime enquiry inbox' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' },
];

function DoneState({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return <View style={{ alignItems: 'center', paddingVertical: 18, gap: 14 }}>
    <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.successSurface }}>
      <CheckCircle2 color={colors.successText} size={28} />
    </View>
    <Text style={{ color: colors.secondaryText, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{message}</Text>
  </View>;
}

type PetCreateListingSheetProps = { visible: boolean; onCreate: (input: CreatePetListingInput, photos: PetPhotoPick[]) => Promise<void>; onClose: () => void };
/** The website's PetsCreateListingModal ("Submit a pet for adoption"): every field, 1–6 photos, location from a list. */
export function PetCreateListingSheet({ visible, onCreate, onClose }: PetCreateListingSheetProps) {
  const { colors } = useAppTheme();
  const [form, setForm] = useState<CreatePetListingInput>(INITIAL_FORM);
  const [photos, setPhotos] = useState<PetPhotoPick[]>([]);
  const [isCreated, setIsCreated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (visible) { setIsCreated(false); setError(''); } }, [visible]);
  if (!visible) return null;

  const updateField = <FieldName extends keyof CreatePetListingInput>(field: FieldName, value: CreatePetListingInput[FieldName]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddPhotos = async () => {
    const room = MAX_PET_PHOTOS - photos.length;
    if (room <= 0) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 1 });
      if (result.canceled) return;
      const picked = result.assets.map((asset): PetPhotoPick => ({ uri: asset.uri, width: asset.width, height: asset.height }));
      setPhotos((current) => [...current, ...picked].slice(0, MAX_PET_PHOTOS));
      setError('');
    } catch (pickError: unknown) {
      console.warn('[PetCreateListingSheet.handleAddPhotos] Error:', pickError instanceof Error ? pickError.message : 'picker failed');
      setError('Your photos could not be opened. Try again.');
    }
  };

  const handleSubmit = async () => {
    const missing = [
      !form.name.trim() && 'pet name', !form.age.trim() && 'approximate age', !form.location && 'location',
      !form.description.trim() && 'description', !form.temperament.trim() && 'temperament', !form.adoptionRequirements.trim() && 'adoption requirements',
    ].filter((field): field is string => Boolean(field));
    if (missing.length) { setError(`Fill in the ${missing.join(', ')}.`); return; }
    if (!photos.length) { setError('Add at least one clear photograph of the pet.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      await onCreate({ ...form, breed: form.breed?.trim() || undefined, healthNotes: form.healthNotes?.trim() || undefined }, photos);
      setIsCreated(true);
      setForm(INITIAL_FORM);
      setPhotos([]);
    } catch (submissionError: unknown) {
      setError(submissionError instanceof Error ? submissionError.message : 'Could not submit the listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCreated) {
    return <PetsSheet visible title="Submitted for review" onClose={onClose} footer={<PetsButton label="Done" onPress={onClose} />}>
      <DoneState message="An adoption moderator must approve the listing before it becomes public." />
    </PetsSheet>;
  }
  return <PetsSheet visible title="Submit a pet for adoption" description="Ourlime adoption listings never include checkout or payment. Every submission is reviewed before publication." onClose={onClose} busy={isSubmitting}
    footer={<><PetsButton variant="secondary" label="Cancel" disabled={isSubmitting} onPress={onClose} /><PetsButton label={isSubmitting ? 'Uploading…' : 'Submit for review'} busy={isSubmitting} onPress={() => void handleSubmit()} /></>}>
    <PetsField label="Pet name" value={form.name} onChangeText={(value) => updateField('name', value)} editable={!isSubmitting} maxLength={80} />
    <PetsChoiceRow label="Animal type" options={PET_TYPES.map((type) => ({ value: type, label: type }))} value={form.petType} onChange={(value) => updateField('petType', value)} disabled={isSubmitting} />
    <PetsField label="Breed" optional value={form.breed ?? ''} onChangeText={(value) => updateField('breed', value)} editable={!isSubmitting} maxLength={100} placeholder="Leave blank if you're not sure" />
    <PetsField label="Approximate age" value={form.age} onChangeText={(value) => updateField('age', value)} editable={!isSubmitting} maxLength={60} placeholder="e.g. About 2 years" />
    <PetsChoiceRow label="Sex" options={PET_SEXES.map((sex) => ({ value: sex, label: sex }))} value={form.sex} onChange={(value) => updateField('sex', value)} disabled={isSubmitting} />
    <PetsChoiceRow label="Location in Trinidad and Tobago" options={PET_LOCATIONS.map((place) => ({ value: place, label: place }))} value={form.location} onChange={(value) => updateField('location', value)} disabled={isSubmitting} />
    <PetsField label="Description" multiline value={form.description} onChangeText={(value) => updateField('description', value)} editable={!isSubmitting} maxLength={3000} />
    <PetsField label="Temperament" multiline value={form.temperament} onChangeText={(value) => updateField('temperament', value)} editable={!isSubmitting} maxLength={1500} />
    <PetsChoiceRow label="Vaccinations" options={HEALTH_OPTIONS} value={form.vaccinationStatus} onChange={(value) => updateField('vaccinationStatus', value)} disabled={isSubmitting} />
    <PetsChoiceRow label="Sterilised" options={HEALTH_OPTIONS} value={form.sterilisationStatus} onChange={(value) => updateField('sterilisationStatus', value)} disabled={isSubmitting} />
    <PetsField label="Health information" optional multiline value={form.healthNotes ?? ''} onChangeText={(value) => updateField('healthNotes', value)} editable={!isSubmitting} maxLength={1500} />
    <PetsField label="Adoption requirements" multiline value={form.adoptionRequirements} onChangeText={(value) => updateField('adoptionRequirements', value)} editable={!isSubmitting} maxLength={2000} />
    <PetsChoiceRow label="Preferred enquiry method" options={CONTACT_OPTIONS} value={form.contactPreference} onChange={(value) => updateField('contactPreference', value)} disabled={isSubmitting} />
    <View style={{ gap: 6 }}>
      <PetsLabel label={`Photographs (1–${MAX_PET_PHOTOS})`} />
      <Text style={{ color: colors.mutedText, fontSize: 12 }}>The first photo is the cover.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {photos.map((photo, index) => <View key={photo.uri} style={{ width: 76, height: 76, overflow: 'hidden', borderRadius: 12, backgroundColor: colors.control }}>
          <Image source={{ uri: photo.uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityLabel={`Pet photo ${index + 1}`} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} disabled={isSubmitting} hitSlop={6} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}
            style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <X color="#ffffff" size={13} />
          </Pressable>
        </View>)}
        {photos.length < MAX_PET_PHOTOS ? <Pressable accessibilityRole="button" accessibilityLabel="Add pet photos" disabled={isSubmitting} onPress={() => void handleAddPhotos()}
          style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: colors.successSurface }}>
          <ImagePlus color={colors.accentText} size={20} />
          <Text style={{ color: colors.accentText, fontSize: 10, fontWeight: '800' }}>Add photos</Text>
        </Pressable> : null}
      </View>
    </View>
    {error ? <PetsErrorText message={error} /> : null}
  </PetsSheet>;
}

type PetInterestSheetProps = { listing: PetListing | null; onSubmit: (listing: PetListing, input: CreatePetInterestInput) => Promise<void>; onClose: () => void };
/** The website's PetsInterestModal: name, email or phone, and a message for the carer. */
export function PetInterestSheet({ listing, onSubmit, onClose }: PetInterestSheetProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setIsSent(false); setError(''); }, [listing?.id]);
  if (!listing) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !contact.trim() || !message.trim()) { setError('Fill in your name, contact details and a message.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      await onSubmit(listing, { name: name.trim(), contact: contact.trim(), message: message.trim() });
      setIsSent(true);
      setName(''); setContact(''); setMessage('');
    } catch (submissionError: unknown) {
      setError(submissionError instanceof Error ? submissionError.message : 'Could not send your enquiry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return <PetsSheet visible title="Interest saved" onClose={onClose} footer={<PetsButton label="Done" onPress={onClose} />}>
      <DoneState message={`Your enquiry about ${listing.name} was sent to the carer.`} />
    </PetsSheet>;
  }
  return <PetsSheet visible title={`Interested in ${listing.name}?`} description="Share a few details for the carer." onClose={onClose} busy={isSubmitting}
    footer={<><PetsButton variant="secondary" label="Cancel" disabled={isSubmitting} onPress={onClose} /><PetsButton label={isSubmitting ? 'Sending…' : 'Send enquiry'} busy={isSubmitting} onPress={() => void handleSubmit()} /></>}>
    <PetsField label="Your name" value={name} onChangeText={setName} editable={!isSubmitting} maxLength={100} />
    <PetsField label="Email or phone" value={contact} onChangeText={setContact} editable={!isSubmitting} maxLength={160} keyboardType="email-address" />
    <PetsField label="Your message" multiline value={message} onChangeText={setMessage} editable={!isSubmitting} maxLength={1000} placeholder={`Tell the carer about your home and why ${listing.name} would be a good fit.`} />
    {error ? <PetsErrorText message={error} /> : null}
  </PetsSheet>;
}
