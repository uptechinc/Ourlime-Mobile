import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { CheckCircle2, Heart, MapPin, PawPrint, ShieldCheck, Syringe, type LucideIcon } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { PET_ADOPTION_STATUS_LABELS, PET_HEALTH_LABELS, petsService } from '@/lib/services/PetsService';
import { PET_ADOPTION_STATUSES, type CreatePetInterestInput, type PetAdoptionStatus, type PetListing } from '@/lib/types/pets';
import { PetInterestSheet } from './PetsModals';
import { PetDetailSkeleton } from './PetsSkeletons';

const MODERATION_LABELS: Readonly<Record<PetListing['moderationStatus'], string>> = {
  pending: 'Waiting for a moderator to approve it', approved: 'Approved', rejected: 'Not approved', removed: 'Removed by a moderator',
};

/** The website's /market/pets/[petId] (PetAdoptionDetailPageContent), plus adoption status for the pet's carer. */
export default function PetDetailScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { profile } = usePageAccess();
  const viewerId = profile?.uid ?? null;
  const [listing, setListing] = useState<PetListing | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [interestListing, setInterestListing] = useState<PetListing | null>(null);
  const [statusError, setStatusError] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const loadListing = useCallback(async () => {
    if (!petId) return;
    try {
      setListing(await petsService.fetchListing(petId));
      setError('');
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this pet.');
    } finally {
      setIsLoading(false);
    }
  }, [petId]);

  useEffect(() => { void loadListing(); }, [loadListing]);

  const isOwner = Boolean(listing && viewerId && listing.ownerId === viewerId);
  const photos = listing?.imageUrls ?? [];
  const shownPhoto = photos[Math.min(photoIndex, Math.max(photos.length - 1, 0))];

  const handleEnquiry = () => {
    if (!listing) return;
    if (!viewerId) { router.push('/(auth)/login' as Href); return; }
    setInterestListing(listing);
  };

  const handleInterest = async (pet: PetListing, input: CreatePetInterestInput) => {
    await petsService.createInterest(pet.id, input);
  };

  const handleStatus = async (status: PetAdoptionStatus) => {
    if (!listing || status === listing.adoptionStatus) return;
    setIsUpdatingStatus(true);
    setStatusError('');
    try {
      await petsService.updateAdoptionStatus(listing.id, status);
      setListing({ ...listing, adoptionStatus: status });
    } catch (updateError: unknown) {
      setStatusError(updateError instanceof Error ? updateError.message : 'Could not update the adoption status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const header = <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Pets for Adoption" onPress={() => router.canGoBack() ? router.back() : router.replace('/market/pets' as Href)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
    <Text numberOfLines={1} style={styles.headerTitle}>{listing ? `Meet ${listing.name}` : 'Pets for Adoption'}</Text>
  </View>;

  if (isLoading) return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>{header}<PetDetailSkeleton /></SafeAreaView>;
  if (!listing || error) {
    return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>{header}
      <View style={styles.unavailable}>
        <PawPrint color={colors.mutedText} size={40} />
        <Text style={styles.unavailableTitle}>Listing unavailable</Text>
        <Text style={styles.muted}>{error || 'Pet listing was not found.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/market/pets' as Href)}><Text style={styles.link}>Browse adoption listings</Text></Pressable>
      </View>
    </SafeAreaView>;
  }

  const canEnquire = listing.adoptionStatus === 'available' && listing.moderationStatus === 'approved' && !isOwner;
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    {header}
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.photo}>
        {shownPhoto ? <Image source={{ uri: shownPhoto }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityLabel={`${listing.name}, ${listing.breed ?? listing.petType}`} /> : <PawPrint color={colors.mutedText} size={56} />}
      </View>
      {photos.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel="Pet photos">
        {photos.map((photo, index) => <Pressable key={photo} accessibilityRole="button" accessibilityLabel={`Show photo ${index + 1}`} accessibilityState={{ selected: photo === shownPhoto }} onPress={() => setPhotoIndex(index)}
          style={[styles.thumb, photo === shownPhoto && styles.thumbActive]}>
          <Image source={{ uri: photo }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
        </Pressable>)}
      </ScrollView> : null}

      <View style={styles.card}>
        <Text style={styles.status}>{PET_ADOPTION_STATUS_LABELS[listing.adoptionStatus]}</Text>
        <Text accessibilityRole="header" style={styles.title}>Meet {listing.name}</Text>
        <Text style={styles.muted}>{listing.breed || listing.petType} · {listing.age} · {listing.sex}</Text>
        <View style={styles.location}><MapPin color={colors.accentText} size={16} /><Text style={styles.locationText}>{listing.location}</Text></View>
        {isOwner && listing.moderationStatus !== 'approved' ? <Text style={styles.moderation}>{MODERATION_LABELS[listing.moderationStatus]}{listing.moderationReason ? `: ${listing.moderationReason}` : ''}</Text> : null}
        <DetailSection title="About" value={listing.description} styles={styles} />
        <DetailSection title="Temperament" value={listing.temperament} styles={styles} />
        <DetailSection title="Adoption requirements" value={listing.adoptionRequirements} styles={styles} />
        {listing.healthNotes ? <DetailSection title="Health notes" value={listing.healthNotes} styles={styles} /> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatusTile icon={Syringe} label="Vaccinations" value={PET_HEALTH_LABELS[listing.vaccinationStatus]} styles={styles} colors={colors} />
          <StatusTile icon={CheckCircle2} label="Sterilised" value={PET_HEALTH_LABELS[listing.sterilisationStatus]} styles={styles} colors={colors} />
        </View>

        {isOwner && listing.moderationStatus === 'approved' ? <View style={{ gap: 8 }}>
          <Text style={styles.sectionTitle}>Adoption status</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PET_ADOPTION_STATUSES.map((status) => {
              const selected = status === listing.adoptionStatus;
              return <Pressable key={status} accessibilityRole="radio" accessibilityState={{ selected, disabled: isUpdatingStatus }} disabled={isUpdatingStatus} onPress={() => void handleStatus(status)}
                style={[styles.statusChip, selected && styles.statusChipActive]}>
                <Text style={[styles.statusChipText, selected && styles.statusChipTextActive]}>{PET_ADOPTION_STATUS_LABELS[status]}</Text>
              </Pressable>;
            })}
          </View>
          {statusError ? <Text style={styles.errorText}>{statusError}</Text> : null}
        </View> : null}

        {isOwner ? null : <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canEnquire }} disabled={!canEnquire} onPress={handleEnquiry} style={[styles.enquire, !canEnquire && styles.enquireDisabled]}>
          <Heart color="#ffffff" size={17} />
          <Text style={styles.enquireText}>{canEnquire ? 'Send adoption enquiry' : 'Not accepting enquiries'}</Text>
        </Pressable>}
        <View style={styles.safety}>
          <ShieldCheck color={colors.warningText} size={16} />
          <Text style={styles.safetyText}>Never send payment or a deposit. Meet safely and confirm health information directly with the carer.</Text>
        </View>
      </View>
    </ScrollView>
    <PetInterestSheet listing={interestListing} onSubmit={handleInterest} onClose={() => setInterestListing(null)} />
  </SafeAreaView>;
}

type Styles = ReturnType<typeof createStyles>;
function DetailSection({ title, value, styles }: { title: string; value: string; styles: Styles }) {
  return <View style={{ gap: 4 }}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.body}>{value}</Text></View>;
}
function StatusTile({ icon: Icon, label, value, styles, colors }: { icon: LucideIcon; label: string; value: string; styles: Styles; colors: AppThemeColors }) {
  return <View style={styles.tile}><Icon color={colors.successText} size={19} /><Text style={styles.tileLabel}>{label}</Text><Text style={styles.tileValue}>{value}</Text></View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  photo: { height: 320, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.control },
  thumb: { width: 72, height: 72, overflow: 'hidden', borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: colors.accent },
  card: { padding: 18, gap: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  status: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.successSurface, color: colors.successText, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  muted: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { color: colors.secondaryText, fontSize: 14, fontWeight: '700' },
  moderation: { padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.warningSurface, color: colors.warningText, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  body: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  tile: { flex: 1, padding: 14, gap: 4, borderRadius: 14, backgroundColor: colors.successSurface },
  tileLabel: { marginTop: 4, color: colors.successText, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  tileValue: { color: colors.successText, fontSize: 14 },
  statusChip: { minHeight: 38, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statusChipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  statusChipText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  statusChipTextActive: { color: colors.onAccent },
  errorText: { color: colors.destructiveText, fontSize: 13 },
  enquire: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: '#047857' },
  enquireDisabled: { backgroundColor: colors.disabled },
  enquireText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  safety: { padding: 12, flexDirection: 'row', gap: 8, borderRadius: 12, backgroundColor: colors.warningSurface },
  safetyText: { flex: 1, color: colors.warningText, fontSize: 12, lineHeight: 18 },
  unavailable: { margin: 16, padding: 28, alignItems: 'center', gap: 10, borderRadius: 22, backgroundColor: colors.surface },
  unavailableTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  link: { marginTop: 6, color: colors.accentText, fontSize: 14, fontWeight: '800' },
});
