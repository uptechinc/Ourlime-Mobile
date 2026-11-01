import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Building2, Search } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubProviders } from '@/lib/hooks/useEHub';
import { EHubChip, EHubEmptyState, EHubGridSkeleton, EHubNotice, EHubProviderCard, useEHubLayout } from '@/components/ehub/EHubParts';
import type { EHubProviderKind } from '@/lib/types/ehubDiscovery';

type KindFilter = 'all' | EHubProviderKind;

// Same areas as the website's /ehub/discover.
const TRINIDAD_AND_TOBAGO_AREAS = ['All locations', 'Nationwide', 'Port of Spain', 'San Fernando', 'Chaguanas', 'Arima', 'Point Fortin', 'Couva', 'Sangre Grande', 'Tobago'];
const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Businesses & professionals' },
  { value: 'business', label: 'Businesses' },
  { value: 'professional', label: 'Professionals' },
];

/** The website's /ehub/discover: active businesses and professionals filtered by search, category, location and type. */
export default function EHubDiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; search?: string }>();
  const { colors } = useAppTheme();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors, layout.gutter), [colors, layout.gutter]);
  const [search, setSearch] = useState(params.search ?? '');
  const [category, setCategory] = useState('All categories');
  const [location, setLocation] = useState('All locations');
  const [kind, setKind] = useState<KindFilter>(params.kind === 'business' || params.kind === 'professional' ? params.kind : 'all');
  const providers = useEHubProviders({
    search,
    category: category === 'All categories' ? undefined : category,
    location: location === 'All locations' ? undefined : location,
    kind: kind === 'all' ? undefined : kind,
  });
  const providerList = useMemo(() => providers.data ?? [], [providers.data]);
  const categories = useMemo(() => ['All categories', ...[...new Set([...providerList.flatMap((provider) => [...provider.categories, ...provider.services]), ...(category === 'All categories' ? [] : [category])])].sort()], [category, providerList]);

  const handleOpenProvider = (providerId: string) => router.push(`/ehub/providers/${encodeURIComponent(providerId)}` as Href);

  return (
    <View style={styles.screen}>
      <PageHeader title="Discover" onBackPress={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={providers.isRefreshing} onRefresh={() => void providers.refresh()} tintColor={colors.accent} />} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={{ width: layout.contentWidth, paddingHorizontal: layout.gutter + 4 }}>
            <Text style={styles.heroEyebrow}>E-Hub discovery</Text>
            <Text style={[styles.heroTitle, layout.isTablet && styles.heroTitleWide]}>Find local businesses and professionals</Text>
            <Text style={styles.heroBody}>Explore active Ourlime business and professional profiles across Trinidad and Tobago. Enquiries are available; online booking is not yet active.</Text>
          </View>
        </View>

        <View style={[styles.body, { width: layout.contentWidth }]}>
          <View style={styles.filters}>
            <View style={styles.searchBox}>
              <Search size={18} color={colors.mutedText} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search services or names" placeholderTextColor={colors.mutedText} returnKeyType="search" accessibilityLabel="Search providers" style={styles.searchInput} />
            </View>
            <FilterRow label="Type" values={KIND_OPTIONS.map((option) => option.label)} selected={KIND_OPTIONS.find((option) => option.value === kind)?.label ?? ''} onSelect={(label) => setKind(KIND_OPTIONS.find((option) => option.label === label)?.value ?? 'all')} styles={styles} />
            <FilterRow label="Category" values={categories} selected={category} onSelect={setCategory} styles={styles} />
            <FilterRow label="Location" values={TRINIDAD_AND_TOBAGO_AREAS} selected={location} onSelect={setLocation} styles={styles} />
          </View>

          {providers.error ? <EHubNotice tone="error" text={providers.error} actionLabel="Try again" onAction={() => void providers.refresh()} /> : null}
          {providers.isLoading && !providers.data ? <EHubGridSkeleton count={layout.isTablet ? 4 : 2} width={layout.providerWidth} height={280} />
            : providerList.length ? <>
              <Text style={styles.count}>{providerList.length} {providerList.length === 1 ? 'provider' : 'providers'}</Text>
              <View style={[styles.grid, { gap: layout.gap }]}>{providerList.map((provider) => <EHubProviderCard key={provider.id} provider={provider} width={layout.providerWidth} onOpen={handleOpenProvider} actionLabel="View profile & enquire" />)}</View>
            </>
              : !providers.error ? <EHubEmptyState icon={<Building2 size={42} color={colors.mutedText} />} title="No matching providers yet" body="Try a broader category or location. Only active, real business profiles appear here." /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

type FilterRowProps = { label: string; values: string[]; selected: string; onSelect: (value: string) => void; styles: ReturnType<typeof createStyles> };

function FilterRow({ label, values, selected, onSelect, styles }: FilterRowProps) {
  return <View style={styles.filterRow}>
    <Text style={styles.filterLabel}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {values.map((value) => <EHubChip key={value} label={value} selected={selected === value} onPress={() => onSelect(value)} />)}
    </ScrollView>
  </View>;
}

const createStyles = (colors: AppThemeColors, gutter: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingBottom: 48, alignItems: 'center' },
  hero: { width: '100%', alignItems: 'center', paddingVertical: 34, backgroundColor: '#065f46' },
  heroEyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '900', letterSpacing: 1.8, textTransform: 'uppercase' },
  heroTitle: { marginTop: 8, color: '#ffffff', fontSize: 30, lineHeight: 35, fontWeight: '900' },
  heroTitleWide: { fontSize: 40, lineHeight: 45 },
  heroBody: { marginTop: 10, maxWidth: 640, color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 21 },
  body: { maxWidth: '100%', paddingHorizontal: gutter, paddingTop: 18, gap: 16 },
  filters: { padding: 12, gap: 12, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchBox: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, minHeight: 46, color: colors.text, fontSize: 15 },
  filterRow: { gap: 6 },
  filterLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  chips: { gap: 8 },
  count: { color: colors.mutedText, fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
