import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  ArrowUpRight, Banknote, Briefcase, Building2, ClipboardList, Code, GraduationCap, Heart, MapPin, Palette, Plus, Search, Settings2,
  ShoppingBag, SlidersHorizontal, Sparkles, TrendingUp, Utensils, Wrench, X, Zap, type LucideIcon,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PageHeader from '@/components/ui/PageHeader';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { ProfessionalJobsList } from '@/components/jobs/ProfessionalJobsList';
import { QuickTasksList } from '@/components/jobs/QuickTasksList';
import JobCreationModal from '@/components/jobs/createJobsModal/jobCreationModal';
import QuickTaskCreationModal from '@/components/jobs/createJobsModal/QuickTaskCreationModal';
import IdentityVerificationModal from '@/components/jobs/IdentityVerificationModal';
import JobApplicationModal from '@/components/jobs/applyJobs/JobApplicationModal';
import JobDetailsModal from '@/components/jobs/JobDetailsModal';
import JobFiltersSheet, { EMPTY_JOB_FILTERS, getActiveJobFilterChips, type JobFiltersState, type JobSortOption } from '@/components/jobs/JobFiltersSheet';
import { JobsListSkeleton } from '@/components/jobs/JobsSkeletons';
import { JobsService, type JobRecord } from '@/lib/job/JobsService';
import { jobCategoryPopularity } from '@/lib/job/JobCategoryPopularity';
import { jobListFilterService } from '@/lib/job/JobListFilterService';
import { useJobsViewer } from '@/lib/hooks/useJobsViewer';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type JobTab = 'professional' | 'quickTask';
type CategoryCard = { name: string; count: number };

const jobsService = JobsService.getInstance();
const PAGE_SIZE = 12;
const CATEGORY_ICONS: { [category: string]: LucideIcon } = {
  Development: Code, Design: Palette, Marketing: TrendingUp, Business: Building2, Teaching: GraduationCap, Education: GraduationCap,
  Plumbing: Wrench, Banking: Banknote, Finance: Banknote, Retail: ShoppingBag, Sales: ShoppingBag, 'Food Service': Utensils, Healthcare: Heart,
};
const CATEGORY_COLORS: { [category: string]: string } = {
  Development: '#3b82f6', Design: '#a855f7', Marketing: '#ec4899', Business: '#10b981', Teaching: '#eab308', Education: '#eab308', Plumbing: '#f97316',
  Banking: '#22c55e', Finance: '#22c55e', Retail: '#14b8a6', Sales: '#14b8a6', 'Food Service': '#f43f5e', Healthcare: '#ef4444',
};
const formatCount = (count: number, unit: 'job' | 'task'): string => `${count} ${count === 1 ? unit : `${unit}s`}`;

/** Jobs page (web app/jobs/page.tsx): search, categories, create, filters, professional jobs and quick tasks. */
export default function JobsPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; apply?: string; job?: string }>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const viewer = useJobsViewer();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [activeTab, setActiveTab] = useState<JobTab>(params.type === 'quickTask' ? 'quickTask' : 'professional');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationTerm, setLocationTerm] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [filters, setFilters] = useState<JobFiltersState>(EMPTY_JOB_FILTERS);
  const [sortBy, setSortBy] = useState<JobSortOption>('newest');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isQuickTaskModalOpen, setIsQuickTaskModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [applyJob, setApplyJob] = useState<JobRecord | null>(null);
  const [detailJob, setDetailJob] = useState<JobRecord | null>(null);
  const [handledLinkJobId, setHandledLinkJobId] = useState('');

  const loadJobs = useCallback(async () => {
    setError('');
    try { setJobs(await jobsService.fetchJobs(200)); }
    catch (loadError: unknown) {
      console.error('[JobsPage.loadJobs] Error:', loadError);
      setError('Something went wrong. Please check your connection and try again.');
    }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);
  useEffect(() => { if (params.type === 'quickTask' || params.type === 'professional') setActiveTab(params.type); }, [params.type]);

  // A category picked on one tab may not exist on the other, and the list starts again from the top.
  useEffect(() => { setActiveCategory(''); setVisibleCount(PAGE_SIZE); }, [activeTab]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchQuery, locationQuery, activeCategory, filters, sortBy]);

  const tabJobs = useMemo(() => jobs.filter((job) => job.basic_info.type === activeTab), [activeTab, jobs]);
  const categories = useMemo<CategoryCard[]>(() => jobCategoryPopularity.rank(tabJobs.map((job) => ({
    category: job.basic_info.category || job.category || null,
    createdAtMs: job.basic_info.createdAt ? job.basic_info.createdAt.seconds * 1000 : null,
  }))).map(({ name, count }) => ({ name, count })), [tabJobs]);
  const filteredJobs = useMemo(() => jobListFilterService.apply(tabJobs, { category: activeCategory, search: searchQuery, location: locationQuery, filters, sort: sortBy }), [activeCategory, filters, locationQuery, searchQuery, sortBy, tabJobs]);
  const visibleJobs = filteredJobs.slice(0, visibleCount);
  const unit: 'job' | 'task' = activeTab === 'quickTask' ? 'task' : 'job';
  const hasNarrowing = jobListFilterService.hasNarrowing({ category: activeCategory, search: searchQuery, location: locationQuery, filters });
  const filterChips = getActiveJobFilterChips(filters, sortBy, setFilters, setSortBy);

  const requireVerified = (): boolean => {
    if (viewer.isVerified) return true;
    setIsVerificationModalOpen(true);
    return false;
  };
  const handleApply = useCallback((job: JobRecord) => {
    if (!viewer.isVerified) { setIsVerificationModalOpen(true); return; }
    setApplyJob(job);
  }, [viewer.isVerified]);

  // Shared links: /jobs?apply=<id> opens the application (web), /jobs?job=<id> opens the details.
  useEffect(() => {
    const linkedJobId = params.apply || params.job;
    if (!linkedJobId || loading || !viewer.isViewerLoaded || handledLinkJobId === linkedJobId) return;
    setHandledLinkJobId(linkedJobId);
    const linkedJob = jobs.find((job) => job.id === linkedJobId);
    if (!linkedJob) { router.push(`/jobs/${encodeURIComponent(linkedJobId)}` as Href); return; }
    setActiveTab(linkedJob.basic_info.type);
    if (params.apply && !viewer.appliedJobIds.has(linkedJob.id) && linkedJob.basic_info.userId !== viewer.userId) handleApply(linkedJob);
    else setDetailJob(linkedJob);
  }, [handleApply, handledLinkJobId, jobs, loading, params.apply, params.job, router, viewer.appliedJobIds, viewer.isViewerLoaded, viewer.userId]);

  const handleCategory = (name: string): void => setActiveCategory((current) => (current === name ? '' : name));
  const handleSearch = (): void => { setSearchQuery(searchTerm); setLocationQuery(locationTerm); };
  const clearFilters = (): void => {
    setActiveCategory(''); setSearchTerm(''); setSearchQuery(''); setLocationTerm(''); setLocationQuery(''); setFilters(EMPTY_JOB_FILTERS); setSortBy('newest');
  };

  const renderCategoryCard = (category: CategoryCard, grid: boolean) => {
    const Icon = CATEGORY_ICONS[category.name] ?? Briefcase;
    const isActive = activeCategory === category.name;
    return (
      <TouchableOpacity key={category.name} accessibilityRole="button" accessibilityState={{ selected: isActive }} onPress={() => handleCategory(category.name)} style={[styles.categoryCard, grid ? styles.categoryCardGrid : styles.categoryCardSlide, isActive && styles.categoryCardActive]}>
        <View style={[styles.categoryIcon, { backgroundColor: CATEGORY_COLORS[category.name] ?? '#9ca3af' }]}><Icon size={22} color="#ffffff" /></View>
        <Text numberOfLines={1} style={styles.categoryName}>{category.name}</Text>
        <Text style={styles.categoryCount}>{formatCount(category.count, unit)} open</Text>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (loading) return <JobsListSkeleton variant={activeTab} />;
    if (error) {
      return (
        <View style={styles.stateBox}>
          <View style={[styles.stateIcon, { backgroundColor: colors.destructiveSurface }]}><X size={30} color={colors.destructiveText} /></View>
          <Text style={styles.stateTitle}>Something went wrong</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => { setLoading(true); void loadJobs(); }} style={styles.stateButton}><Text style={styles.stateButtonText}>Try Again</Text></TouchableOpacity>
        </View>
      );
    }
    if (filteredJobs.length === 0) {
      return (
        <View style={styles.stateBox}>
          <View style={[styles.stateIcon, { backgroundColor: colors.control }]}><Search size={30} color={colors.mutedText} /></View>
          <Text style={styles.stateTitle}>{hasNarrowing ? `No matching ${unit}s` : `No open ${activeTab === 'quickTask' ? 'quick tasks' : 'professional jobs'} right now`}</Text>
          <Text style={styles.stateText}>{hasNarrowing ? 'Try adjusting your filters or search terms.' : 'New listings appear here as soon as they are posted.'}</Text>
          {hasNarrowing ? <TouchableOpacity accessibilityRole="button" onPress={clearFilters} style={styles.stateButton}><Text style={styles.stateButtonText}>Clear All Filters</Text></TouchableOpacity> : null}
        </View>
      );
    }
    const listProps = { jobs: visibleJobs, savedJobIds: viewer.savedJobIds, appliedJobIds: viewer.appliedJobIds, onToggleSave: (jobId: string) => void viewer.toggleSave(jobId), onApply: handleApply, onViewDetails: setDetailJob };
    return (
      <>
        {activeTab === 'professional' ? <ProfessionalJobsList {...listProps} /> : <QuickTasksList {...listProps} />}
        {visibleCount < filteredJobs.length ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setVisibleCount((count) => count + PAGE_SIZE)} style={styles.showMore}><Text style={styles.showMoreText}>Show more</Text></TouchableOpacity>
        ) : <Text style={styles.endText}>You&apos;ve reached the end of the list</Text>}
      </>
    );
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Jobs" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadJobs(); void viewer.refreshViewer(); }} tintColor={colors.accent} />}
          onScroll={({ nativeEvent }) => {
            // Infinite scroll, like the website: the next page loads near the bottom.
            if (loading || visibleCount >= filteredJobs.length) return;
            if (nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 400) setVisibleCount((count) => count + PAGE_SIZE);
          }}
          scrollEventThrottle={200}
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}><Sparkles size={14} color="#22c55e" /><Text style={styles.heroBadgeText}>{loading || error ? 'Explore job opportunities' : `${tabJobs.length} open ${activeTab === 'quickTask' ? (tabJobs.length === 1 ? 'quick task' : 'quick tasks') : (tabJobs.length === 1 ? 'professional job' : 'professional jobs')}`}</Text></View>
            <Text style={styles.heroTitle}>Find Your Next <Text style={{ color: '#84cc16' }}>Career</Text> <Text style={{ color: '#0ea5e9' }}>Opportunity</Text></Text>
            <Text style={styles.heroText}>Discover exciting jobs that match your skills and ambitions 🚀</Text>
          </View>

          <View style={styles.searchCard}>
            <View style={styles.searchField}><Search size={18} color={colors.mutedText} /><TextInput value={searchTerm} onChangeText={setSearchTerm} onSubmitEditing={handleSearch} returnKeyType="search" placeholder="Job title, keywords or company" placeholderTextColor={colors.mutedText} style={styles.searchInput} accessibilityLabel="Search jobs by title, keyword or company" /></View>
            <View style={styles.searchDivider} />
            <View style={styles.searchField}><MapPin size={18} color={colors.mutedText} /><TextInput value={locationTerm} onChangeText={setLocationTerm} onSubmitEditing={handleSearch} returnKeyType="search" placeholder="Location" placeholderTextColor={colors.mutedText} style={styles.searchInput} accessibilityLabel="Location" /></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search jobs" onPress={handleSearch} style={styles.searchButton}><Search size={17} color={colors.onAccent} /><Text style={styles.searchButtonText}>Search Jobs</Text></TouchableOpacity>
          </View>

          <View style={styles.quickLinks}>
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/jobs/applications' as Href)} style={styles.quickLink}><ClipboardList size={16} color={colors.accentText} /><Text style={styles.quickLinkText}>My applications</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/jobs/manage' as Href)} style={styles.quickLink}><Settings2 size={16} color={colors.accentText} /><Text style={styles.quickLinkText}>Manage my jobs</Text></TouchableOpacity>
          </View>

          {categories.length > 0 || activeCategory || searchQuery || locationQuery ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {categories.slice(0, 8).map((category) => (
                <TouchableOpacity key={category.name} accessibilityRole="button" accessibilityState={{ selected: activeCategory === category.name }} onPress={() => handleCategory(category.name)} style={[styles.chip, activeCategory === category.name && styles.chipActive]}>
                  <Text style={[styles.chipText, activeCategory === category.name && styles.chipTextActive]}>{category.name} <Text style={styles.chipCount}>{category.count}</Text></Text>
                </TouchableOpacity>
              ))}
              {activeCategory || searchQuery || locationQuery ? (
                <TouchableOpacity accessibilityRole="button" onPress={clearFilters} style={styles.clearChip}><X size={14} color={colors.destructiveText} /><Text style={styles.clearChipText}>Clear</Text></TouchableOpacity>
              ) : null}
            </ScrollView>
          ) : null}

          <View style={styles.createRow}>
            <TouchableOpacity accessibilityRole="button" onPress={() => { if (requireVerified()) setIsQuickTaskModalOpen(true); }} style={styles.createQuickTask}><Zap size={17} color={colors.accentText} /><Text style={styles.createQuickTaskText}>Create Quick Task</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => { if (requireVerified()) setIsJobModalOpen(true); }} style={styles.createJob}><Plus size={17} color={colors.onAccent} /><Text style={styles.createJobText}>Create Job</Text></TouchableOpacity>
          </View>

          {categories.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Popular <Text style={{ color: colors.accentText }}>{activeTab === 'quickTask' ? 'Task' : 'Job'} Categories</Text></Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => setShowAllCategories((visible) => !visible)} style={styles.viewAll}><Text style={styles.viewAllText}>{showAllCategories ? 'Show Less' : 'View All'}</Text><ArrowUpRight size={15} color={colors.successText} /></TouchableOpacity>
              </View>
              {showAllCategories
                ? <View style={styles.categoryGrid}>{categories.map((category) => renderCategoryCard(category, true))}</View>
                : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{categories.slice(0, 10).map((category) => renderCategoryCard(category, false))}</ScrollView>}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.listTitle}>{activeTab === 'professional' ? 'Professional' : 'Quick'} <Text style={{ color: colors.accentText }}>{activeTab === 'quickTask' ? 'Tasks' : 'Jobs'}</Text></Text>
            <View style={styles.tabs}>
              {([{ id: 'professional', label: 'Professional Jobs' }, { id: 'quickTask', label: 'Quick Tasks' }] as const).map(({ id, label }) => (
                <TouchableOpacity key={id} accessibilityRole="tab" accessibilityState={{ selected: activeTab === id }} onPress={() => setActiveTab(id)} style={[styles.tab, activeTab === id && styles.tabActive]}><Text style={[styles.tabText, activeTab === id && styles.tabTextActive]}>{label}</Text></TouchableOpacity>
              ))}
            </View>
            <View style={styles.filterRow}>
              <TouchableOpacity accessibilityRole="button" onPress={() => setIsFiltersOpen(true)} style={styles.filterButton}><SlidersHorizontal size={16} color={colors.text} /><Text style={styles.filterButtonText}>Filters{filterChips.length ? ` (${filterChips.length})` : ''}</Text></TouchableOpacity>
              {!loading && !error ? <Text style={styles.resultText}>Showing <Text style={styles.resultCount}>{filteredJobs.length}</Text> {filteredJobs.length === 1 ? 'result' : 'results'}</Text> : null}
            </View>
            {filterChips.length ? (
              <View style={styles.activeChips}>
                {filterChips.map((chip) => <TouchableOpacity key={chip.key} accessibilityLabel={`Remove ${chip.label}`} onPress={chip.onRemove} style={styles.activeChip}><Text style={styles.activeChipText}>{chip.label}</Text><X size={12} color={colors.successText} /></TouchableOpacity>)}
              </View>
            ) : null}
          </View>

          {renderContent()}
        </ScrollView>
      </KeyboardSafeView>

      <JobFiltersSheet visible={isFiltersOpen} filters={filters} sort={sortBy} totalResults={loading || error ? null : filteredJobs.length} onFiltersChange={setFilters} onSortChange={setSortBy} onClose={() => setIsFiltersOpen(false)} />
      <JobCreationModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onCreated={() => void loadJobs()} />
      <QuickTaskCreationModal isOpen={isQuickTaskModalOpen} onClose={() => setIsQuickTaskModalOpen(false)} onCreated={() => void loadJobs()} />
      <IdentityVerificationModal isOpen={isVerificationModalOpen} onClose={() => setIsVerificationModalOpen(false)} verificationStatus={viewer.verificationStatus} />
      <JobDetailsModal isOpen={detailJob !== null} job={detailJob} isApplied={detailJob ? viewer.appliedJobIds.has(detailJob.id) : false} onClose={() => setDetailJob(null)} onApply={handleApply} />
      {applyJob ? (
        <JobApplicationModal isOpen job={applyJob} jobType={applyJob.basic_info.type} onClose={() => setApplyJob(null)} onApplied={() => viewer.markApplied(applyJob.id)} />
      ) : null}
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingBottom: 50, gap: 16 },
  hero: { marginHorizontal: 16, marginTop: 14, alignItems: 'center', gap: 8 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  heroBadgeText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center', lineHeight: 30 },
  heroText: { color: colors.secondaryText, fontSize: 14, textAlign: 'center' },
  searchCard: { marginHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 8, gap: 4 },
  searchField: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 10, fontSize: 14 },
  searchDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 10 },
  searchButton: { marginTop: 4, minHeight: 44, borderRadius: 999, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  searchButtonText: { color: colors.onAccent, fontWeight: '800' },
  quickLinks: { marginHorizontal: 16, flexDirection: 'row', gap: 8 },
  quickLink: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  quickLinkText: { color: colors.accentText, fontWeight: '800', fontSize: 13 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.successSurface, borderColor: colors.accent },
  chipText: { color: colors.secondaryText, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.successText },
  chipCount: { color: colors.mutedText },
  clearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.destructiveSurface, borderWidth: 1, borderColor: colors.destructiveText },
  clearChipText: { color: colors.destructiveText, fontSize: 13, fontWeight: '700' },
  createRow: { marginHorizontal: 16, flexDirection: 'row', gap: 8 },
  createQuickTask: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.surface },
  createQuickTaskText: { color: colors.accentText, fontWeight: '800', fontSize: 14 },
  createJob: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.accent },
  createJobText: { color: colors.onAccent, fontWeight: '800', fontSize: 14 },
  section: { gap: 12 },
  sectionHeader: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { flex: 1, color: colors.text, fontSize: 19, fontWeight: '900' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  viewAllText: { color: colors.successText, fontWeight: '800', fontSize: 13 },
  categoryRow: { paddingHorizontal: 16, gap: 12 },
  categoryGrid: { marginHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4, justifyContent: 'center' },
  categoryCardSlide: { width: 160, minHeight: 140 },
  categoryCardGrid: { flexBasis: '47%', flexGrow: 1, minHeight: 130 },
  categoryCardActive: { borderColor: colors.accent },
  categoryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  categoryName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  categoryCount: { color: colors.mutedText, fontSize: 13 },
  listTitle: { marginHorizontal: 16, color: colors.text, fontSize: 24, fontWeight: '900' },
  tabs: { marginHorizontal: 16, flexDirection: 'row', gap: 8 },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: colors.onAccent },
  filterRow: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterButtonText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  resultText: { color: colors.mutedText, fontSize: 13 },
  resultCount: { color: colors.text, fontWeight: '800' },
  activeChips: { marginHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  activeChipText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  stateBox: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24 },
  stateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stateTitle: { color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateText: { color: colors.mutedText, textAlign: 'center' },
  stateButton: { marginTop: 8, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 },
  stateButtonText: { color: colors.onAccent, fontWeight: '800' },
  showMore: { alignSelf: 'center', marginTop: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 22, paddingVertical: 9 },
  showMoreText: { color: colors.secondaryText, fontWeight: '800', fontSize: 13 },
  endText: { color: colors.mutedText, fontSize: 13, textAlign: 'center', paddingVertical: 6 },
});
