import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight, BadgeCheck, Bone, Cat, Dog, Heart, MapPin, PawPrint, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Stethoscope, Store,
  type LucideIcon,
} from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { EMPTY_PET_FILTERS, PET_LOCATIONS, PET_TYPE_COUNTS, PET_TYPES, SAMPLE_PET_LISTINGS, petsService } from '@/lib/services/PetsService';
import type { CreatePetInterestInput, CreatePetListingInput, PetListing, PetListingMode, PetType, PetsFilterValues } from '@/lib/types/pets';
import { PetCreateListingSheet, PetDetailsSheet, PetFilterSheet, PetInterestSheet, PetSafetyGuideSheet, PetShelterSheet } from './PetsModals';

const HERO = '#173f35';
const HERO_DARK = '#0d2a24';
const LIME = '#d9f36a';
const PET_TYPE_ICONS: Readonly<Record<PetType, LucideIcon>> = { Dogs: Dog, Cats: Cat, 'Small pets': Bone, Other: PawPrint };

/** The website's /market/pets (PetsMarketPageContent) laid out for phones. */
export default function PetsScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const router = useRouter();
  const [listings, setListings] = useState<PetListing[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listingMode, setListingMode] = useState<PetListingMode>('adoption');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritePetIds, setFavoritePetIds] = useState<string[]>([]);
  const [selectedPetType, setSelectedPetType] = useState<PetType | null>(null);
  const [selectedLocation, setSelectedLocation] = useState('All locations');
  const [filterValues, setFilterValues] = useState<PetsFilterValues>(EMPTY_PET_FILTERS);
  const [selectedListing, setSelectedListing] = useState<PetListing | null>(null);
  const [interestListing, setInterestListing] = useState<PetListing | null>(null);
  const [isShelterOpen, setIsShelterOpen] = useState(false);
  const [isSafetyGuideOpen, setIsSafetyGuideOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadListings = useCallback(async () => {
    try {
      setListings(await petsService.fetchListings());
      setLoadState('ready');
      setLoadError('');
    } catch (error: unknown) {
      console.error('[PetsScreen.loadListings] Error:', error instanceof Error ? error.message : 'Unknown error');
      setLoadError(error instanceof Error && error.message.startsWith('Sign in') ? error.message : 'Could not load pet listings. Pull down to try again.');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void loadListings();
    void petsService.loadFavorites().then(setFavoritePetIds);
  }, [loadListings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadListings();
    setIsRefreshing(false);
  };

  const visibleListings = useMemo(() => petsService.filter([...listings, ...SAMPLE_PET_LISTINGS], {
    mode: listingMode, search: searchQuery, petType: selectedPetType, location: selectedLocation, filters: filterValues,
  }), [filterValues, listingMode, listings, searchQuery, selectedLocation, selectedPetType]);
  const activeFilterCount = Number(filterValues.isVaccinatedOnly) + Number(filterValues.isVerifiedOnly) + Number(filterValues.isUrgentOnly);

  const handleFavoriteToggle = (petId: string) => {
    setFavoritePetIds((current) => {
      const next = current.includes(petId) ? current.filter((favoriteId) => favoriteId !== petId) : [...current, petId];
      void petsService.saveFavorites(next);
      return next;
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedPetType(null);
    setSelectedLocation('All locations');
    setFilterValues(EMPTY_PET_FILTERS);
  };

  const handleCreateListing = async (input: CreatePetListingInput) => {
    const created = await petsService.createListing(input);
    setListings((current) => [created, ...current.filter((listing) => listing.id !== created.id)]);
    setListingMode(created.mode);
    resetFilters();
  };

  const handleInterestOpen = (listing: PetListing) => {
    setSelectedListing(null);
    setInterestListing(listing);
  };

  const handleInterestSubmit = async (listing: PetListing, input: CreatePetInterestInput) => {
    await petsService.createInterest(listing, input);
  };

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Market" onPress={() => router.canGoBack() ? router.back() : router.replace('/market' as Href)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Pets & Adoption</Text>
        <View style={styles.headerSubtitleRow}><ShieldCheck color={colors.accentText} size={12} /><Text style={styles.headerSubtitle}>Welfare-first community listings</Text></View>
      </View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={colors.accent} colors={[colors.accent]} />}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroRing} />
        <PawPrint color="rgba(255,255,255,0.05)" size={190} style={styles.heroPaw} />
        <View style={styles.heroBadge}><Sparkles color="#e9f8ac" size={14} /><Text style={styles.heroBadgeText}>Ourlime pets</Text></View>
        <Text accessibilityRole="header" style={styles.heroTitle}>Your new best friend might be nearby.</Text>
        <Text style={styles.heroText}>Adopt, rehome, or find a pet through people and shelters in your community—all in one safer place.</Text>
        <View style={styles.heroActions}>
          <Pressable accessibilityRole="button" onPress={() => setIsCreateOpen(true)} style={styles.heroPrimary}><Plus color={HERO} size={16} /><Text style={styles.heroPrimaryText}>List a pet</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setIsSafetyGuideOpen(true)} style={styles.heroSecondary}><Text style={styles.heroSecondaryText}>How adoption works</Text><ArrowRight color="#ffffff" size={16} /></Pressable>
        </View>
        <View style={styles.heroStats}>
          {[['183', 'Pets nearby'], ['46', 'Adopted this month'], ['12', 'Verified shelters']].map(([value, label]) => <View key={label} style={{ flex: 1 }}>
            <Text style={styles.heroStatValue}>{value}</Text><Text style={styles.heroStatLabel}>{label}</Text>
          </View>)}
        </View>
      </View>

      <View style={styles.card}>
        <View accessibilityRole="tablist" style={styles.modeToggle}>
          {(['adoption', 'sale'] as const).map((mode) => {
            const selected = listingMode === mode;
            return <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setListingMode(mode)} style={[styles.modeButton, selected && styles.modeButtonActive]}>
              <Text style={[styles.modeText, selected && styles.modeTextActive]}>{mode === 'adoption' ? 'Adopt a pet' : 'Pets for sale'}</Text>
            </Pressable>;
          })}
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search color={colors.mutedText} size={18} />
            <TextInput accessibilityLabel="Search pets" value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by pet, breed, or location" placeholderTextColor={colors.mutedText} returnKeyType="search" style={styles.searchInput} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={activeFilterCount ? `Filters, ${activeFilterCount} on` : 'Filters'} onPress={() => setIsFilterOpen(true)} style={styles.filterButton}>
            <SlidersHorizontal color={isDark ? HERO : '#ffffff'} size={18} />
            {activeFilterCount ? <Text style={styles.filterCount}>{activeFilterCount}</Text> : null}
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationRow}>
          {PET_LOCATIONS.map((location) => {
            const selected = location === selectedLocation;
            return <Pressable key={location} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setSelectedLocation(location)} style={[styles.locationChip, selected && styles.locationChipActive]}>
              <MapPin color={selected ? colors.onAccent : colors.accentText} size={13} />
              <Text style={[styles.locationText, selected && styles.locationTextActive]}>{location}</Text>
            </Pressable>;
          })}
        </ScrollView>
      </View>

      <View style={styles.typeGrid}>
        {PET_TYPES.map((petType) => {
          const TypeIcon = PET_TYPE_ICONS[petType];
          const selected = selectedPetType === petType;
          return <Pressable key={petType} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setSelectedPetType((current) => current === petType ? null : petType)} style={[styles.typeCard, selected && styles.typeCardActive]}>
            <View style={[styles.typeIcon, selected && styles.typeIconActive]}><TypeIcon color={selected ? (isDark ? HERO : '#ffffff') : colors.accentText} size={20} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeTitle}>{petType}</Text>
              <Text style={styles.typeCount}>{PET_TYPE_COUNTS[petType]} nearby</Text>
            </View>
          </Pressable>;
        })}
      </View>

      <View style={styles.sectionHeading}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Near you</Text>
          <Text style={styles.sectionTitle}>{listingMode === 'adoption' ? 'Ready for a loving home' : 'Responsible local listings'}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.viewAll}><Text style={styles.viewAllText}>View all</Text><ArrowRight color={colors.accentText} size={15} /></Pressable>
      </View>

      {loadState === 'loading' ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>Loading listings…</Text></View> : null}
      {loadState === 'error' ? <Text accessibilityRole="alert" style={styles.errorText}>{loadError}</Text> : null}

      {visibleListings.length ? visibleListings.map((listing) => {
        const isFavorite = favoritePetIds.includes(listing.id);
        return <Pressable key={listing.id} accessibilityRole="button" accessibilityLabel={`View ${listing.name}, ${listing.breed}`} onPress={() => setSelectedListing(listing)} style={styles.petCard}>
          <View style={styles.petImageWrap}>
            {listing.imageUrl ? <Image source={{ uri: listing.imageUrl }} resizeMode="cover" style={styles.petImage} /> : <PawPrint color={colors.mutedText} size={40} />}
            <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent']} style={styles.petImageShade} />
            <View style={styles.petBadges}>
              {listing.moderationStatus === 'pending' ? <Text style={[styles.badge, styles.badgePending]}>PENDING REVIEW</Text> : null}
              {listing.isUrgent ? <Text style={[styles.badge, styles.badgeUrgent]}>NEEDS A HOME SOON</Text> : null}
              {listing.isVerified ? <View style={[styles.badgeRow, styles.badgeVerified]}><BadgeCheck color="#065f46" size={13} /><Text style={styles.badgeVerifiedText}>Verified</Text></View> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={isFavorite ? `Remove ${listing.name} from favorites` : `Save ${listing.name} to favorites`} hitSlop={6} onPress={() => handleFavoriteToggle(listing.id)} style={styles.favorite}>
              <Heart color={isFavorite ? '#f43f5e' : colors.secondaryText} fill={isFavorite ? '#f43f5e' : 'transparent'} size={20} />
            </Pressable>
          </View>
          <View style={styles.petBody}>
            <View style={styles.petTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.petName}>{listing.name}</Text>
                <Text style={styles.petBreed}>{listing.breed}</Text>
              </View>
              <Text style={[styles.price, listing.mode === 'sale' && styles.priceSale]}>{listing.priceLabel}</Text>
            </View>
            <View style={styles.tagRow}>
              <Text style={styles.tag}>{listing.age}</Text>
              <Text style={styles.tag}>{listing.sex}</Text>
              {listing.isVaccinated ? <View style={[styles.tagRowItem, styles.tagVaccinated]}><Stethoscope color={colors.successText} size={13} /><Text style={styles.tagVaccinatedText}>Vaccinated</Text></View> : null}
            </View>
            <View style={styles.petFooter}>
              <View style={styles.petLocation}><MapPin color={colors.accentText} size={15} /><Text numberOfLines={1} style={styles.petLocationText}>{listing.location} · {listing.distance}</Text></View>
              <View style={styles.petArrow}><ArrowRight color="#ffffff" size={16} /></View>
            </View>
          </View>
        </Pressable>;
      }) : <View style={styles.empty}>
        <PawPrint color={colors.mutedText} size={40} />
        <Text style={styles.emptyTitle}>No matching pets found</Text>
        <Text style={styles.emptyText}>Try another breed, name, or location.</Text>
      </View>}

      <View style={styles.spotlight}>
        <PawPrint color={isDark ? 'rgba(110,231,183,0.06)' : 'rgba(6,78,59,0.06)'} size={180} style={styles.spotlightPaw} />
        <View style={styles.spotlightBadge}><BadgeCheck color={colors.accentText} size={15} /><Text style={styles.spotlightBadgeText}>Shelter spotlight</Text></View>
        <Text style={styles.spotlightTitle}>Tardieu's Kitten & Puppy Sanctuary</Text>
        <Text style={styles.spotlightText}>Helping vulnerable animals recover, feel safe, and find permanent homes with caring families.</Text>
        <Pressable accessibilityRole="button" onPress={() => setIsShelterOpen(true)} style={styles.spotlightButton}><Text style={styles.spotlightButtonText}>View shelter profile</Text><ArrowRight color={isDark ? HERO : '#ffffff'} size={16} /></Pressable>
      </View>

      <View style={styles.safety}>
        <View style={styles.safetyIcon}><ShieldCheck color={LIME} size={24} /></View>
        <Text style={styles.safetyTitle}>Protect every paw.</Text>
        <Text style={styles.safetyText}>Never send a deposit before meeting the pet. Check health records and report any listing that raises a welfare concern.</Text>
        <Pressable accessibilityRole="button" onPress={() => setIsSafetyGuideOpen(true)} style={styles.safetyLink}><Text style={styles.safetyLinkText}>Read our pet safety guide</Text><ArrowRight color={isDark ? '#fcd34d' : '#9c4f00'} size={15} /></Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/market' as Href)} style={styles.supplies}>
        <View style={styles.suppliesIcon}><Store color={colors.accentText} size={20} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.suppliesTitle}>Looking for pet supplies instead?</Text>
          <Text style={styles.suppliesText}>Food, carriers, toys, grooming, and more are in the main Market.</Text>
          <View style={styles.suppliesLink}><Text style={styles.suppliesLinkText}>Browse pet supplies</Text><ArrowRight color={colors.accentText} size={14} /></View>
        </View>
      </Pressable>
    </ScrollView>

    <PetDetailsSheet listing={selectedListing} onInterest={handleInterestOpen} onClose={() => setSelectedListing(null)} />
    <PetShelterSheet visible={isShelterOpen} onClose={() => setIsShelterOpen(false)} />
    <PetSafetyGuideSheet visible={isSafetyGuideOpen} onClose={() => setIsSafetyGuideOpen(false)} />
    <PetFilterSheet visible={isFilterOpen} values={filterValues} onApply={(values) => { setFilterValues(values); setIsFilterOpen(false); }} onClose={() => setIsFilterOpen(false)} />
    <PetCreateListingSheet visible={isCreateOpen} onCreate={handleCreateListing} onClose={() => setIsCreateOpen(false)} />
    <PetInterestSheet listing={interestListing} onSubmit={handleInterestSubmit} onClose={() => setInterestListing(null)} />
  </SafeAreaView>;
}

const createStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: isDark ? '#07110f' : '#f7f7f2' },
  header: { minHeight: 64, paddingHorizontal: 8, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 34, lineHeight: 36 },
  headerTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  headerSubtitleRow: { marginTop: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerSubtitle: { color: colors.mutedText, fontSize: 11, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  hero: { overflow: 'hidden', padding: 22, paddingTop: 24, borderRadius: 28, backgroundColor: isDark ? HERO_DARK : HERO },
  heroGlow: { position: 'absolute', right: -60, top: -90, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(215,242,100,0.16)' },
  heroRing: { position: 'absolute', right: 40, bottom: -200, width: 300, height: 300, borderRadius: 150, borderWidth: 56, borderColor: 'rgba(255,255,255,0.04)' },
  heroPaw: { position: 'absolute', right: -16, bottom: -28, transform: [{ rotate: '-18deg' }] },
  heroBadge: { alignSelf: 'flex-start', marginBottom: 16, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.1)' },
  heroBadgeText: { color: '#e9f8ac', fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  heroTitle: { color: '#ffffff', fontSize: 34, lineHeight: 35, fontWeight: '900', letterSpacing: -1.2 },
  heroText: { marginTop: 14, color: 'rgba(236,253,245,0.78)', fontSize: 15, lineHeight: 23 },
  heroActions: { marginTop: 22, gap: 10 },
  heroPrimary: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: LIME },
  heroPrimaryText: { color: HERO, fontSize: 14, fontWeight: '900' },
  heroSecondary: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.1)' },
  heroSecondaryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  heroStats: { marginTop: 24, paddingTop: 18, flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  heroStatValue: { color: LIME, fontSize: 24, fontWeight: '900' },
  heroStatLabel: { marginTop: 2, color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  card: { padding: 10, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#101817' : colors.surface },
  modeToggle: { padding: 4, flexDirection: 'row', gap: 4, borderRadius: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' },
  modeButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  modeButtonActive: { backgroundColor: isDark ? LIME : '#ffffff', shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  modeText: { color: colors.mutedText, fontSize: 14, fontWeight: '800' },
  modeTextActive: { color: isDark ? '#142d27' : '#065f46' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBox: { flex: 1, minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#0a1211' : '#ffffff' },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  filterButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: isDark ? LIME : '#020617' },
  filterCount: { position: 'absolute', top: -5, right: -4, minWidth: 19, height: 19, borderRadius: 10, overflow: 'hidden', textAlign: 'center', lineHeight: 19, color: '#ffffff', backgroundColor: '#dc2626', fontSize: 10, fontWeight: '900' },
  locationRow: { gap: 8, paddingRight: 4 },
  locationChip: { minHeight: 38, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 19, borderWidth: 1, borderColor: colors.border },
  locationChipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  locationText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  locationTextActive: { color: colors.onAccent },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: { width: '48%', flexGrow: 1, minHeight: 72, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#101817' : colors.surface },
  typeCardActive: { borderColor: isDark ? '#bef264' : colors.accent, borderWidth: 2 },
  typeIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: isDark ? 'rgba(52,211,153,0.1)' : '#ecfdf5' },
  typeIconActive: { backgroundColor: isDark ? '#bef264' : '#047857' },
  typeTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  typeCount: { color: colors.mutedText, fontSize: 11, marginTop: 1 },
  sectionHeading: { marginTop: 4, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  sectionTitle: { marginTop: 2, color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  viewAll: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { color: colors.accentText, fontSize: 13, fontWeight: '900' },
  loading: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.mutedText, fontSize: 13 },
  errorText: { padding: 12, borderRadius: 12, overflow: 'hidden', color: colors.destructiveText, backgroundColor: colors.destructiveSurface, fontSize: 13, lineHeight: 18 },
  petCard: { overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#101817' : colors.surface },
  petImageWrap: { height: 230, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#17211f' : '#e2e8f0' },
  petImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  petImageShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 90 },
  petBadges: { position: 'absolute', top: 14, left: 14, right: 64, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  badgePending: { color: '#075985', backgroundColor: '#f0f9ff' },
  badgeUrgent: { color: '#a34d00', backgroundColor: '#fff1dd' },
  badgeRow: { paddingHorizontal: 9, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999 },
  badgeVerified: { backgroundColor: 'rgba(255,255,255,0.95)' },
  badgeVerifiedText: { color: '#065f46', fontSize: 11, fontWeight: '900' },
  favorite: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: isDark ? '#101817' : '#ffffff', elevation: 3, shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  petBody: { padding: 16 },
  petTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  petName: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  petBreed: { marginTop: 1, color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  price: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, overflow: 'hidden', color: colors.successText, backgroundColor: colors.successSurface, fontSize: 12, fontWeight: '900' },
  priceSale: { color: isDark ? '#bef264' : '#365314', backgroundColor: isDark ? 'rgba(190,242,100,0.1)' : '#ecfccb' },
  tagRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, overflow: 'hidden', color: colors.secondaryText, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', fontSize: 12, fontWeight: '700' },
  tagRowItem: { paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9 },
  tagVaccinated: { backgroundColor: colors.successSurface },
  tagVaccinatedText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  petFooter: { marginTop: 14, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9' },
  petLocation: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  petLocationText: { flexShrink: 1, color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  petArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#020617' },
  empty: { paddingVertical: 48, paddingHorizontal: 20, alignItems: 'center', gap: 6, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: isDark ? '#101817' : colors.surface },
  emptyTitle: { marginTop: 8, color: colors.text, fontSize: 17, fontWeight: '900' },
  emptyText: { color: colors.mutedText, fontSize: 13, textAlign: 'center' },
  spotlight: { marginTop: 12, overflow: 'hidden', padding: 22, borderRadius: 28, backgroundColor: isDark ? '#10251f' : '#e8efdf' },
  spotlightPaw: { position: 'absolute', right: -10, bottom: -36, transform: [{ rotate: '12deg' }] },
  spotlightBadge: { alignSelf: 'flex-start', marginBottom: 14, paddingHorizontal: 11, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#ffffff' },
  spotlightBadgeText: { color: colors.accentText, fontSize: 12, fontWeight: '900' },
  spotlightTitle: { color: colors.text, fontSize: 26, lineHeight: 30, fontWeight: '900', letterSpacing: -0.6 },
  spotlightText: { marginTop: 10, color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  spotlightButton: { alignSelf: 'flex-start', marginTop: 18, minHeight: 46, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: isDark ? LIME : HERO },
  spotlightButtonText: { color: isDark ? '#142d27' : '#ffffff', fontSize: 14, fontWeight: '900' },
  safety: { padding: 22, borderRadius: 28, backgroundColor: isDark ? '#211b12' : '#fff3df' },
  safetyIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: HERO },
  safetyTitle: { marginTop: 16, color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  safetyText: { marginTop: 8, color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  safetyLink: { marginTop: 14, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  safetyLinkText: { color: isDark ? '#fcd34d' : '#9c4f00', fontSize: 14, fontWeight: '900' },
  supplies: { padding: 18, flexDirection: 'row', gap: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#101817' : colors.surface },
  suppliesIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' },
  suppliesTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  suppliesText: { marginTop: 3, color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  suppliesLink: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  suppliesLinkText: { color: colors.accentText, fontSize: 13, fontWeight: '900' },
});
