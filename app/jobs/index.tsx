import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Briefcase, ClipboardList, Clock, Plus, Search, Settings2 } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PageHeader from '@/components/ui/PageHeader';
import { ProfessionalJobsList } from '@/components/jobs/ProfessionalJobsList';
import { QuickTasksList } from '@/components/jobs/QuickTasksList';
import JobCreationModal from '@/components/jobs/createJobsModal/jobCreationModal';
import { JobsService, type JobRecord } from '@/lib/job/JobsService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type JobTab = 'professional' | 'quickTask';
const jobsService = JobsService.getInstance();

export default function JobsPage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [activeTab, setActiveTab] = useState<JobTab>('professional');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const loadJobs = useCallback(async () => {
    setError('');
    try { setJobs(await jobsService.fetchJobs(30)); }
    catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : 'Jobs could not be loaded.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      const category = job.basic_info.category || job.category || 'Uncategorized';
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((leftCategory, rightCategory) => rightCategory[1] - leftCategory[1]);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (job.basic_info.type !== activeTab) return false;
      const category = job.basic_info.category || job.category || 'Uncategorized';
      if (selectedCategory && category !== selectedCategory) return false;
      if (!normalizedSearch) return true;
      return [job.basic_info.title, job.basic_info.description, category, job.category_specific.name ?? '', ...job.details.skills]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [activeTab, jobs, search, selectedCategory]);

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <PageHeader title="Jobs" onBackPress={() => router.back()} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadJobs(); }} tintColor="#10b981" />}>
      <View style={styles.hero}><Briefcase size={30} color="#052e16" /><View style={styles.heroCopy}><Text style={styles.heroTitle}>Find your next opportunity</Text><Text style={styles.heroText}>{jobs.length} live professional jobs and quick tasks</Text></View></View>
      <View style={styles.searchRow}><View style={styles.searchBox}><Search size={19} color={colors.mutedText} /><TextInput value={search} onChangeText={setSearch} placeholder="Search jobs, skills, companies…" placeholderTextColor={colors.mutedText} style={styles.searchInput} /></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="My applications" onPress={() => router.push('/jobs/applications' as Href)} style={styles.applicationsButton}><ClipboardList size={19} color="#ffffff" /></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Manage posted jobs" onPress={() => router.push('/jobs/manage')} style={styles.manageButton}><Settings2 size={19} color="#ffffff" /></TouchableOpacity></View>
      {categories.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><TouchableOpacity onPress={() => setSelectedCategory(null)} style={[styles.chip, !selectedCategory && styles.chipActive]}><Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>All</Text></TouchableOpacity>{categories.map(([category, count]) => <TouchableOpacity key={category} onPress={() => setSelectedCategory(category)} style={[styles.chip, selectedCategory === category && styles.chipActive]}><Text style={[styles.chipText, selectedCategory === category && styles.chipTextActive]}>{category} ({count})</Text></TouchableOpacity>)}</ScrollView> : null}
      <View style={styles.toolbar}><View style={styles.tabs}>{([{ id: 'professional', label: 'Professional', Icon: Briefcase }, { id: 'quickTask', label: 'Quick Tasks', Icon: Clock }] as const).map(({ id, label, Icon }) => <TouchableOpacity key={id} onPress={() => setActiveTab(id)} style={[styles.tab, activeTab === id && styles.tabActive]}><Icon size={17} color={activeTab === id ? '#ffffff' : '#10b981'} /><Text style={[styles.tabText, activeTab === id && styles.tabTextActive]}>{label}</Text></TouchableOpacity>)}</View><TouchableOpacity onPress={() => setModalOpen(true)} style={styles.addButton}><Plus size={18} color="#ffffff" /></TouchableOpacity></View>
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={() => void loadJobs()}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View> : null}
      {loading ? <ActivityIndicator size="large" color="#10b981" style={styles.loader} /> : activeTab === 'professional' ? <ProfessionalJobsList jobs={filteredJobs} /> : <QuickTasksList jobs={filteredJobs} />}
    </ScrollView>
    <JobCreationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => void loadJobs()} />
  </SafeAreaView>;
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, content: { paddingBottom: 50, gap: 16 }, hero: { marginHorizontal: 18, marginTop: 12, padding: 18, borderRadius: 20, backgroundColor: '#34d399', flexDirection: 'row', alignItems: 'center', gap: 12 }, heroCopy: { flex: 1 }, heroTitle: { color: '#052e16', fontSize: 21, fontWeight: '900' }, heroText: { color: '#065f46', marginTop: 4 }, searchRow: { marginHorizontal: 18, flexDirection: 'row', gap: 8 }, searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 13 }, searchInput: { flex: 1, color: colors.text, paddingVertical: 12 }, applicationsButton: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, manageButton: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' }, chips: { paddingHorizontal: 18, gap: 8 }, chip: { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, chipActive: { backgroundColor: '#10b981', borderColor: '#10b981' }, chipText: { color: colors.mutedText, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: '#ffffff' }, toolbar: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }, tabs: { flex: 1, flexDirection: 'row', gap: 8 }, tab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, tabActive: { backgroundColor: colors.accent, borderColor: colors.accent }, tabText: { color: colors.text, fontSize: 12, fontWeight: '800' }, tabTextActive: { color: colors.onAccent }, addButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, errorBox: { marginHorizontal: 18, backgroundColor: colors.destructiveSurface, padding: 14, borderRadius: 12 }, errorText: { color: colors.destructiveText }, retryText: { color: colors.successText, fontWeight: '800', marginTop: 8 }, loader: { marginVertical: 50 },
});
