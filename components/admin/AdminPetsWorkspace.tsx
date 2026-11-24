import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import { toast } from 'sonner-native';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import { PET_HEALTH_LABELS, petsService } from '@/lib/services/PetsService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { PetListing } from '@/lib/types/pets';

type Decision = 'approved' | 'rejected';

const CONTACT_LABELS: Readonly<Record<PetListing['contactPreference'], string>> = { ourlime: 'Ourlime enquiry inbox', email: 'Email', phone: 'Phone' };

/** The website's /profile/admin/pet-adoption: approve pet listings waiting for review, or decline them with a reason. */
export default function AdminPetsWorkspace() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [listings, setListings] = useState<PetListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeListingId, setActiveListingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<{ [listingId: string]: string }>({});
  // A refused decision is shown on its own card; the page-level error is only for loading the list.
  const [decisionErrors, setDecisionErrors] = useState<{ [listingId: string]: string }>({});

  const loadListings = useCallback(async () => {
    try {
      setListings(await petsService.fetchModerationListings());
      setError(null);
    } catch (loadError: unknown) {
      console.error('[AdminPetsWorkspace.loadListings] Error:', loadError instanceof Error ? loadError.message : loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load listings to review.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadListings(); }, [loadListings]);

  const handleDecision = async (listing: PetListing, decision: Decision) => {
    const reason = reasons[listing.id]?.trim() ?? '';
    if (decision === 'rejected' && !reason) return;
    if (activeListingId) return;
    setActiveListingId(listing.id);
    setDecisionErrors((current) => ({ ...current, [listing.id]: '' }));
    try {
      await petsService.moderateListing(listing.id, decision, reason || undefined);
      setListings((current) => current.filter((entry) => entry.id !== listing.id));
      toast.success(decision === 'approved' ? `${listing.name} approved and listed.` : `${listing.name} declined.`);
    } catch (decisionError: unknown) {
      setDecisionErrors((current) => ({ ...current, [listing.id]: decisionError instanceof Error ? decisionError.message : 'Could not save the decision.' }));
    } finally {
      setActiveListingId(null);
    }
  };

  return <AdminWorkspaceShell title="Pet adoption" subtitle="Approve listings before they are public" loading={loading} refreshing={refreshing} error={error} onRefresh={() => { setRefreshing(true); void loadListings(); }}>
    {listings.length ? listings.map((listing) => {
      const isBusy = activeListingId === listing.id;
      const reason = reasons[listing.id] ?? '';
      return <View key={listing.id} style={styles.card}>
        {listing.imageUrls.length ? <View style={styles.photos}>{listing.imageUrls.slice(0, 3).map((imageUrl, index) => <Image key={imageUrl} source={{ uri: imageUrl }} style={styles.photo} accessibilityLabel={`${listing.name} photo ${index + 1}`} />)}</View> : null}
        <Pressable accessibilityRole="link" onPress={() => router.push(`/market/pets/${listing.id}` as Href)}><Text style={styles.name}>{listing.name} ›</Text></Pressable>
        <Text style={styles.meta}>{listing.breed || listing.petType} · {listing.age} · {listing.sex} · {listing.location}</Text>
        <Text style={styles.body}>{listing.description}</Text>
        <Text style={styles.body}><Text style={styles.strong}>Temperament: </Text>{listing.temperament}</Text>
        <Text style={styles.body}><Text style={styles.strong}>Vaccinated: </Text>{PET_HEALTH_LABELS[listing.vaccinationStatus]} · <Text style={styles.strong}>Sterilised: </Text>{PET_HEALTH_LABELS[listing.sterilisationStatus]}</Text>
        {listing.healthNotes ? <Text style={styles.body}><Text style={styles.strong}>Health: </Text>{listing.healthNotes}</Text> : null}
        <Text style={styles.body}><Text style={styles.strong}>Requirements: </Text>{listing.adoptionRequirements}</Text>
        <Text style={styles.body}><Text style={styles.strong}>Contact: </Text>{CONTACT_LABELS[listing.contactPreference]}{listing.contactDetail ? ` · ${listing.contactDetail}` : ''}</Text>
        <TouchableOpacity accessibilityRole="button" disabled={isBusy} onPress={() => void handleDecision(listing, 'approved')} style={[styles.button, { backgroundColor: colors.successSurface, opacity: isBusy ? 0.5 : 1 }]}>
          <Icon name="check" size={16} color={colors.successText} /><Text style={[styles.buttonText, { color: colors.successText }]}>Approve</Text>
        </TouchableOpacity>
        <TextInput accessibilityLabel="Reason for declining" value={reason} onChangeText={(text) => setReasons((current) => ({ ...current, [listing.id]: text }))}
          placeholder="Reason for declining" placeholderTextColor={colors.mutedText} multiline style={styles.reason} />
        <TouchableOpacity accessibilityRole="button" disabled={isBusy || !reason.trim()} onPress={() => void handleDecision(listing, 'rejected')}
          style={[styles.button, { backgroundColor: colors.destructiveSurface, opacity: isBusy || !reason.trim() ? 0.5 : 1 }]}>
          <Icon name="x" size={16} color={colors.destructiveText} /><Text style={[styles.buttonText, { color: colors.destructiveText }]}>Decline</Text>
        </TouchableOpacity>
        {decisionErrors[listing.id] ? <Text accessibilityRole="alert" style={styles.decisionError}>{decisionErrors[listing.id]}</Text> : null}
      </View>;
    }) : <Text style={styles.empty}>No pet listings are waiting for review.</Text>}
  </AdminWorkspaceShell>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { marginBottom: 12, padding: 16, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  photos: { flexDirection: 'row', gap: 8 },
  photo: { flex: 1, height: 96, borderRadius: 10, backgroundColor: colors.control },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  meta: { color: colors.mutedText, fontSize: 13 },
  body: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  strong: { fontWeight: '800', color: colors.text },
  reason: { minHeight: 64, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 14, textAlignVertical: 'top' },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10 },
  buttonText: { fontSize: 14, fontWeight: '800' },
  decisionError: { color: colors.destructiveText, fontSize: 13, fontWeight: '700' },
  empty: { padding: 24, textAlign: 'center', color: colors.mutedText, fontSize: 14 },
});
