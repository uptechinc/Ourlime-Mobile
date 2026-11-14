import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { ArrowRight, HeartHandshake, Inbox, MapPin, PawPrint, Plus, Search, ShieldCheck } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { PET_ADOPTION_STATUS_LABELS, petsService } from '@/lib/services/PetsService';
import { PET_ADOPTION_STATUSES, PET_TYPES, type CreatePetListingInput, type PetAdoptionStatus, type PetListing, type PetPhotoPick, type PetType } from '@/lib/types/pets';
import { PetListingsSkeleton } from './PetsSkeletons';
import { PetCreateListingSheet } from './PetsModals';

export const PETS_HERO = '#173f35';
const LIME = '#d9f36a';

type ChipProps = { label: string; selected: boolean; onPress: () => void; styles: ReturnType<typeof createStyles> };
function Chip({ label, selected, onPress, styles }: ChipProps) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipActive]}>
    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
  </Pressable>;
}

/** The website's /market/pets (PetsMarketPageContent): adoption-only listings with search and filters. */
export default function PetsScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const router = useRouter();
  const { profile } = usePageAccess();
  const isSignedIn = Boolean(profile?.uid);
  const [listings, setListings] = useState<PetListing[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPetType, setSelectedPetType] = useState<PetType | 'all'>('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<PetAdoptionStatus | 'all'>('available');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadListings = useCallback(async () => {
    try {
      setListings(await petsService.fetchListings());
      setLoadState('ready');
      setLoadError('');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Could not load adoption listings.');
      setLoadState('error');
    }
  }, []);

  useEffect(() => { void loadListings(); }, [loadListings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadListings();
    setIsRefreshing(false);
  };

  const locations = useMemo(() => [...new Set(listings.map((listing) => listing.location))].sort(), [listings]);
  const visibleListings = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
    return listings.filter((listing) => {
      const matchesSearch = !normalizedSearch || [listing.name, listing.breed ?? '', listing.location, listing.description]
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      return matchesSearch
        && (selectedPetType === 'all' || listing.petType === selectedPetType)
        && (selectedLocation === 'all' || listing.location === selectedLocation)
        && (selectedStatus === 'all' || listing.adoptionStatus === selectedStatus);
    });
  }, [listings, searchQuery, selectedLocation, selectedPetType, selectedStatus]);

  const handleSubmitPet = () => {
    if (!isSignedIn) { router.push('/(auth)/login' as Href); return; }
    setIsCreateOpen(true);
  };

  const handleCreate = async (input: CreatePetListingInput, photos: PetPhotoPick[]) => {
    await petsService.createListing(input, photos);
  };

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Market" onPress={() => router.canGoBack() ? router.back() : router.replace('/market' as Href)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Pets for Adoption</Text>
        <View style={styles.headerSubtitleRow}><ShieldCheck color={colors.accentText} size={12} /><Text style={styles.headerSubtitle}>Member-only, welfare-first enquiries</Text></View>
      </View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={colors.accent} colors={[colors.accent]} />}>
      <View style={styles.hero}>
        <PawPrint color="rgba(255,255,255,0.05)" size={180} style={styles.heroPaw} />
        <View style={styles.heroBadge}><ShieldCheck color={LIME} size={14} /><Text style={styles.heroBadgeText}>Member-only, welfare-first enquiries</Text></View>
        <Text accessibilityRole="header" style={styles.heroTitle}>Pets for Adoption</Text>
        <Text style={styles.heroText}>Find a companion or help a pet find a safe home. Listings are moderated, and this section never supports animal sales, checkout, or payments.</Text>
        <View style={styles.heroActions}>
          <Pressable accessibilityRole="button" onPress={handleSubmitPet} style={styles.heroPrimary}><Plus color={PETS_HERO} size={16} /><Text style={styles.heroPrimaryText}>Submit a pet for adoption</Text></Pressable>
          {isSignedIn ? <Pressable accessibilityRole="button" onPress={() => router.push('/market/pets/enquiries' as Href)} style={styles.heroSecondary}><Inbox color="#ffffff" size={16} /><Text style={styles.heroSecondaryText}>Manage enquiries</Text></Pressable> : null}
        </View>
      </View>

      <Pressable accessibilityRole="link" onPress={() => router.push('/market/pets/programme' as Href)} style={styles.programme}>
        <HeartHandshake color={colors.successText} size={24} />
        <View style={{ flex: 1 }}>
          <Text style={styles.programmeTitle}>Ourlime Adoption Programme</Text>
          <Text style={styles.programmeText}>A foundation for member adoption support and application tracking. Ourlime does not currently claim to operate a licensed adoption agency.</Text>
          <View style={styles.programmeLink}><Text style={styles.programmeLinkText}>How it works</Text><ArrowRight color={colors.successText} size={14} /></View>
        </View>
      </Pressable>

      <View style={styles.searchBox}>
        <Search color={colors.mutedText} size={18} />
        <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search name, breed, or location" placeholderTextColor={colors.mutedText} accessibilityLabel="Search adoption listings" style={styles.searchInput} returnKeyType="search" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityLabel="Animal type">
        <Chip label="All animal types" selected={selectedPetType === 'all'} onPress={() => setSelectedPetType('all')} styles={styles} />
        {PET_TYPES.map((petType) => <Chip key={petType} label={petType} selected={selectedPetType === petType} onPress={() => setSelectedPetType(petType)} styles={styles} />)}
      </ScrollView>
      {locations.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityLabel="Location">
        <Chip label="All locations" selected={selectedLocation === 'all'} onPress={() => setSelectedLocation('all')} styles={styles} />
        {locations.map((location) => <Chip key={location} label={location} selected={selectedLocation === location} onPress={() => setSelectedLocation(location)} styles={styles} />)}
      </ScrollView> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityLabel="Adoption status">
        <Chip label="All statuses" selected={selectedStatus === 'all'} onPress={() => setSelectedStatus('all')} styles={styles} />
        {PET_ADOPTION_STATUSES.map((status) => <Chip key={status} label={PET_ADOPTION_STATUS_LABELS[status]} selected={selectedStatus === status} onPress={() => setSelectedStatus(status)} styles={styles} />)}
      </ScrollView>

      {loadState === 'loading' ? <PetListingsSkeleton count={3} />
        : loadState === 'error' ? <View style={styles.message}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setLoadState('loading'); void loadListings(); }} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
        : visibleListings.length ? visibleListings.map((listing) => <Pressable key={listing.id} accessibilityRole="button" accessibilityLabel={`${listing.name}, ${listing.breed || listing.petType}, ${listing.location}`}
          onPress={() => router.push(`/market/pets/${encodeURIComponent(listing.id)}` as Href)} style={styles.card}>
          <View style={styles.cardImage}>
            {listing.imageUrls[0] ? <Image source={{ uri: listing.imageUrls[0] }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : <PawPrint color={colors.mutedText} size={48} />}
            <Text style={styles.statusPill}>{PET_ADOPTION_STATUS_LABELS[listing.adoptionStatus]}</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{listing.name}</Text>
                <Text style={styles.cardMeta}>{listing.breed || listing.petType} · {listing.age}</Text>
              </View>
              <ArrowRight color={colors.accentText} size={20} />
            </View>
            <Text numberOfLines={2} style={styles.cardDescription}>{listing.description}</Text>
            <View style={styles.cardLocation}><MapPin color={colors.accentText} size={15} /><Text style={styles.cardLocationText}>{listing.location}</Text></View>
          </View>
        </Pressable>)
        : <View style={styles.empty}>
          <PawPrint color={colors.mutedText} size={40} />
          <Text style={styles.emptyTitle}>No matching adoption listings</Text>
          <Text style={styles.emptyText}>Try changing the animal type, location, or status.</Text>
        </View>}
    </ScrollView>
    <PetCreateListingSheet visible={isCreateOpen} onCreate={handleCreate} onClose={() => setIsCreateOpen(false)} />
  </SafeAreaView>;
}

const createStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: isDark ? colors.canvas : '#f7f7f2' },
  header: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  headerSubtitleRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerSubtitle: { color: colors.mutedText, fontSize: 11, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  hero: { overflow: 'hidden', padding: 22, gap: 12, borderRadius: 28, backgroundColor: PETS_HERO },
  heroPaw: { position: 'absolute', right: -30, bottom: -30 },
  heroBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  heroTitle: { color: '#ffffff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  heroText: { color: '#ecfdf5', fontSize: 14, lineHeight: 21 },
  heroActions: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  heroPrimary: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: LIME },
  heroPrimaryText: { color: '#142d27', fontSize: 14, fontWeight: '900' },
  heroSecondary: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  heroSecondaryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  programme: { padding: 16, flexDirection: 'row', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: isDark ? colors.border : '#a7f3d0', backgroundColor: colors.successSurface },
  programmeTitle: { color: colors.successText, fontSize: 15, fontWeight: '900' },
  programmeText: { marginTop: 4, color: colors.successText, fontSize: 13, lineHeight: 19 },
  programmeLink: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  programmeLinkText: { color: colors.successText, fontSize: 13, fontWeight: '800' },
  searchBox: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  chipRow: { gap: 8, paddingRight: 16 },
  chip: { minHeight: 38, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.onAccent },
  card: { overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardImage: { height: 240, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  statusPill: { position: 'absolute', top: 14, left: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.95)', color: '#065f46', fontSize: 12, fontWeight: '900' },
  cardBody: { padding: 16, gap: 10 },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  cardMeta: { marginTop: 3, color: colors.mutedText, fontSize: 13 },
  cardDescription: { color: colors.secondaryText, fontSize: 13, lineHeight: 20 },
  cardLocation: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardLocationText: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  message: { padding: 24, alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.surface },
  errorText: { color: colors.destructiveText, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.accent },
  retryText: { color: colors.onAccent, fontSize: 13, fontWeight: '800' },
  empty: { paddingVertical: 44, paddingHorizontal: 20, alignItems: 'center', gap: 8, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  emptyText: { color: colors.mutedText, fontSize: 13, textAlign: 'center' },
});
