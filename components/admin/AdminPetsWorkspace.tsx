import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { toast } from 'sonner-native';
import AdminDialog from './AdminDialog';
import AdminReviewCard, { AdminReasonField } from './AdminReviewCard';
import AdminScreen, { type AdminScreenState } from './AdminScreen';
import { space } from '@/lib/admin/adminTokens';
import { PET_HEALTH_LABELS, petsService } from '@/lib/services/PetsService';
import type { PetListing } from '@/lib/types/pets';

type Decision = 'approved' | 'rejected';

const CONTACT_LABELS: Readonly<Record<PetListing['contactPreference'], string>> = { ourlime: 'Ourlime enquiry inbox', email: 'Email', phone: 'Phone' };

/** The website's /profile/admin/pet-adoption: approve pet listings waiting for review, or decline them with a reason. */
export default function AdminPetsWorkspace() {
  const router = useRouter();
  const [listings, setListings] = useState<PetListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeListingId, setActiveListingId] = useState<string | null>(null);
  // A refused approval is shown on its own card, a refused decline inside its dialog; the page-level error is only for loading.
  const [decisionErrors, setDecisionErrors] = useState<{ [listingId: string]: string }>({});
  const [declineTarget, setDeclineTarget] = useState<PetListing | null>(null);
  const [reason, setReason] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  // In-flight guard: one decision at a time.
  const activeRef = useRef(false);

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

  const handleDecision = async (listing: PetListing, decision: Decision, decisionReason: string): Promise<boolean> => {
    const trimmedReason = decisionReason.trim();
    if (decision === 'rejected' && !trimmedReason) return false;
    if (activeRef.current) return false;
    activeRef.current = true;
    setActiveListingId(listing.id);
    setDecisionErrors((current) => ({ ...current, [listing.id]: '' }));
    try {
      await petsService.moderateListing(listing.id, decision, trimmedReason || undefined);
      setListings((current) => current.filter((entry) => entry.id !== listing.id));
      toast.success(decision === 'approved' ? `${listing.name} approved and listed.` : `${listing.name} declined.`);
      return true;
    } catch (decisionError: unknown) {
      console.error('[AdminPetsWorkspace.handleDecision] Error:', decisionError instanceof Error ? decisionError.message : decisionError);
      const message = decisionError instanceof Error ? decisionError.message : 'Could not save the decision.';
      if (decision === 'approved') setDecisionErrors((current) => ({ ...current, [listing.id]: message }));
      else setDialogError(message);
      return false;
    } finally {
      activeRef.current = false;
      setActiveListingId(null);
    }
  };

  const openDecline = (listing: PetListing) => {
    setDeclineTarget(listing);
    setReason('');
    setDialogError(null);
  };

  const handleConfirmDecline = async () => {
    if (!declineTarget) return;
    const saved = await handleDecision(declineTarget, 'rejected', reason);
    if (saved) setDeclineTarget(null);
  };

  const screenState: AdminScreenState = loading
    ? { kind: 'loading', variant: 'list' }
    : error
      ? { kind: 'error', message: error }
      : listings.length
        ? { kind: 'ready' }
        : { kind: 'empty', icon: 'heart', title: 'No pet listings are waiting for review.', description: 'New listings appear here before they are public.' };

  const isDeclineBusy = Boolean(declineTarget && activeListingId === declineTarget.id);

  return (
    <AdminScreen
      title="Pet adoption"
      subtitle={loading || error ? 'Approve listings before they are public' : `${listings.length} waiting · approve before they are public`}
      state={screenState}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void loadListings(); }}
    >
      <View style={{ gap: space.md }}>
        {listings.map((listing) => (
          <AdminReviewCard
            key={listing.id}
            title={listing.name}
            subtitle={[listing.breed || listing.petType, listing.age, listing.sex, listing.location].filter(Boolean).join(' · ')}
            status={{ label: 'Waiting for review', tone: 'pending' }}
            media={{ kind: 'strip', uris: listing.imageUrls, label: listing.name }}
            onPress={() => router.push(`/market/pets/${listing.id}` as Href)}
            accessibilityHint="Opens the pet profile"
            details={[
              { label: 'About', value: listing.description },
              { label: 'Temperament', value: listing.temperament },
              { label: 'Health', value: `Vaccinated: ${PET_HEALTH_LABELS[listing.vaccinationStatus]} · Sterilised: ${PET_HEALTH_LABELS[listing.sterilisationStatus]}` },
              { label: 'Health notes', value: listing.healthNotes ?? '' },
              { label: 'Requirements', value: listing.adoptionRequirements },
              { label: 'Contact', value: `${CONTACT_LABELS[listing.contactPreference]}${listing.contactDetail ? ` · ${listing.contactDetail}` : ''}` },
            ]}
            inlineAction={{
              key: 'approve',
              label: 'Approve',
              icon: 'check',
              tone: 'positive',
              busy: activeListingId === listing.id && !declineTarget,
              disabled: Boolean(activeListingId),
              onPress: () => void handleDecision(listing, 'approved', ''),
            }}
            overflowActions={[{ key: 'decline', label: 'Decline…', icon: 'x', tone: 'danger', disabled: Boolean(activeListingId), onPress: () => openDecline(listing) }]}
            error={decisionErrors[listing.id] || undefined}
          />
        ))}
      </View>

      <AdminDialog
        visible={Boolean(declineTarget)}
        title={`Decline ${declineTarget?.name ?? ''}?`}
        description="The listing is not published. The reason is kept on the listing."
        confirmLabel="Decline"
        tone="danger"
        busy={isDeclineBusy}
        confirmDisabled={!reason.trim()}
        onConfirm={() => void handleConfirmDecline()}
        onClose={() => {
          if (!isDeclineBusy) setDeclineTarget(null);
        }}
      >
        <AdminReasonField
          label="Reason for declining (required)"
          value={reason}
          onChangeText={(next) => {
            setReason(next);
            if (dialogError) setDialogError(null);
          }}
          editable={!isDeclineBusy}
          placeholder="Reason for declining"
          error={dialogError}
        />
      </AdminDialog>
    </AdminScreen>
  );
}
