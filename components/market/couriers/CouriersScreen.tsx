import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { ArrowRight, Search, Truck } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { courierService } from '@/lib/services/CourierService';
import { COURIER_SERVICE_AREAS, COURIER_STATUS_LABELS, type Courier } from '@/lib/types/couriers';
import CourierCard from './CourierCard';
import { CourierCardsSkeleton } from './CouriersSkeletons';

const HERO = '#173f35';
const LIME = '#d9f36a';

/** The website's /market/couriers: the courier directory, with registration for delivery businesses. */
export default function CouriersScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const router = useRouter();
  const { profile } = usePageAccess();
  const isSignedIn = Boolean(profile?.uid);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [ownCourier, setOwnCourier] = useState<Courier | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('all');

  const loadCouriers = useCallback(async () => {
    try {
      setCouriers(await courierService.fetchCouriers());
      setLoadState('ready');
      setLoadError('');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Could not load couriers.');
      setLoadState('error');
    }
  }, []);

  useEffect(() => { void loadCouriers(); }, [loadCouriers]);
  // The member's own registration status, refreshed when they come back from the registration form.
  useFocusEffect(useCallback(() => {
    if (!isSignedIn) return;
    courierService.fetchOwnCourier().then(setOwnCourier).catch(() => setOwnCourier(null));
  }, [isSignedIn]));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCouriers();
    setIsRefreshing(false);
  };

  const visibleCouriers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
    return couriers.filter((courier) => (selectedArea === 'all' || courier.islandWide || courier.serviceAreas.some((area) => area === selectedArea))
      && (!normalizedSearch || [courier.businessName, courier.contactName, courier.description].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))));
  }, [couriers, searchQuery, selectedArea]);

  const handleRegister = () => router.push((isSignedIn ? '/market/couriers/register' : '/(auth)/login') as Href);
  const statusTone = ownCourier?.status === 'approved' ? styles.statusPositive : ownCourier?.status === 'pending' ? styles.statusPending : styles.statusNegative;

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Market" onPress={() => router.canGoBack() ? router.back() : router.replace('/market' as Href)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Couriers</Text>
        <Text style={styles.headerSubtitle}>Lime Market and E-Hub deliveries</Text>
      </View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={colors.accent} colors={[colors.accent]} />}>
      <View style={styles.hero}>
        <Truck color="rgba(255,255,255,0.05)" size={170} style={styles.heroIcon} />
        <View style={styles.heroBadge}><Truck color={LIME} size={14} /><Text style={styles.heroBadgeText}>Lime Market and E-Hub deliveries</Text></View>
        <Text accessibilityRole="header" style={styles.heroTitle}>Couriers</Text>
        <Text style={styles.heroText}>Find a delivery service near you. Every courier is reviewed by Ourlime before it is listed. Sellers can name their preferred couriers, and buyers can pick the one they know.</Text>
        <Pressable accessibilityRole="button" onPress={handleRegister} style={styles.heroPrimary}>
          <Text style={styles.heroPrimaryText}>{ownCourier ? 'Edit your courier service' : 'Register your courier service'}</Text><ArrowRight color={HERO} size={16} />
        </Pressable>
      </View>
      {ownCourier ? <Text style={[styles.status, statusTone]}>
        <Text style={{ fontWeight: '900' }}>{ownCourier.businessName}: </Text>{COURIER_STATUS_LABELS[ownCourier.status]}.{ownCourier.status === 'pending' ? ' An Ourlime administrator will review it soon.' : ''}{ownCourier.rejectionReason && ownCourier.status !== 'approved' ? ` Reason: ${ownCourier.rejectionReason}` : ''}
      </Text> : null}

      <View style={styles.searchBox}>
        <Search color={colors.mutedText} size={18} />
        <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search courier name" placeholderTextColor={colors.mutedText} accessibilityLabel="Search couriers" style={styles.searchInput} returnKeyType="search" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityLabel="Delivers to">
        {['all', ...COURIER_SERVICE_AREAS].map((area) => {
          const selected = selectedArea === area;
          return <Pressable key={area} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setSelectedArea(area)} style={[styles.chip, selected && styles.chipActive]}>
            <Text style={[styles.chipText, selected && styles.chipTextActive]}>{area === 'all' ? 'All areas' : area}</Text>
          </Pressable>;
        })}
      </ScrollView>

      {loadState === 'loading' ? <CourierCardsSkeleton />
        : loadState === 'error' ? <View style={styles.message}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setLoadState('loading'); void loadCouriers(); }} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
        : visibleCouriers.length ? visibleCouriers.map((courier) => <CourierCard key={courier.id} courier={courier} />)
        : <View style={styles.empty}>
          <Truck color={colors.mutedText} size={40} />
          <Text style={styles.emptyTitle}>{couriers.length ? 'No couriers match' : 'No couriers listed yet'}</Text>
          <Text style={styles.emptyText}>{couriers.length ? 'Try another area or search.' : 'Run a delivery service? Register it and be the first one listed.'}</Text>
        </View>}
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: isDark ? colors.canvas : '#f7f7f2' },
  header: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, color: colors.mutedText, fontSize: 11, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  hero: { overflow: 'hidden', padding: 22, gap: 12, borderRadius: 28, backgroundColor: HERO },
  heroIcon: { position: 'absolute', right: -24, bottom: -34 },
  heroBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  heroTitle: { color: '#ffffff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  heroText: { color: '#ecfdf5', fontSize: 14, lineHeight: 21 },
  heroPrimary: { alignSelf: 'flex-start', marginTop: 4, minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: LIME },
  heroPrimaryText: { color: '#142d27', fontSize: 14, fontWeight: '900' },
  status: { padding: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1, fontSize: 13, lineHeight: 19 },
  statusPositive: { borderColor: colors.successSurface, backgroundColor: colors.successSurface, color: colors.successText },
  statusPending: { borderColor: colors.warningSurface, backgroundColor: colors.warningSurface, color: colors.warningText },
  statusNegative: { borderColor: colors.destructiveSurface, backgroundColor: colors.destructiveSurface, color: colors.destructiveText },
  searchBox: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  chipRow: { gap: 8, paddingRight: 16 },
  chip: { minHeight: 38, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.onAccent },
  message: { padding: 24, alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  errorText: { color: colors.destructiveText, fontSize: 14, textAlign: 'center' },
  retry: { minHeight: 42, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12, backgroundColor: '#047857' },
  retryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  empty: { paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center', gap: 6, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { marginTop: 8, color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: colors.mutedText, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
