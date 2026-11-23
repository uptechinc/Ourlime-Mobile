import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowUpDown, ChevronRight, ClipboardList, MapPin, Plus, Search, Settings2, SlidersHorizontal, Sparkles, X, Zap } from 'lucide-react-native';
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
import JobFiltersSheet, { EMPTY_JOB_FILTERS, JOB_SORT_SHORT_LABELS, getActiveJobFilterChips, type JobFiltersState, type JobSortOption } from '@/components/jobs/JobFiltersSheet';
import { JOBS_ACTION_GREEN, JobChip } from '@/components/jobs/JobCardParts';
import { JobsListSkeleton } from '@/components/jobs/JobsSkeletons';
import { JobsService, type JobRecord } from '@/lib/job/JobsService';
import { jobCategoryPopularity } from '@/lib/job/JobCategoryPopularity';
import { jobListFilterService } from '@/lib/job/JobListFilterService';
import { useJobsViewer } from '@/lib/hooks/useJobsViewer';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

type JobTab = 'professional' | 'quickTask';
type CategoryCard = { name: string; count: number };
type QuickFilter = { key: 'locationType' | 'employmentType'; value: string; professionalOnly: boolean };

const jobsService = JobsService.getInstance();
const PAGE_SIZE = 12;
const COLLAPSED_CATEGORY_COUNT = 8;
/** One-tap filters above the list (the same values as the Filters sheet, so the chips and the sheet stay in sync). */
const QUICK_FILTERS: QuickFilter[] = [
  { key: 'locationType', value: 'Remote', professionalOnly: false },
  { key: 'employmentType', value: 'Full-time', professionalOnly: true },
  { key: 'employmentType', value: 'Part-time', professionalOnly: true },
  { key: 'locationType', value: 'On-site', professionalOnly: false },
  { key: 'locationType', value: 'Hybrid', professionalOnly: false },
  { key: 'employmentType', value: 'Contract', professionalOnly: true },
];
const TABS: { id: JobTab; label: string }[] = [{ id: 'professional', label: 'Jobs' }, { id: 'quickTask', label: 'Quick tasks' }];

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
  const sheetFilterCount = filterChips.filter((chip) => chip.key !== 'sort').length;
  const searchChips = [
    ...(searchQuery ? [{ key: 'search', label: `“${searchQuery}”`, onRemove: () => { setSearchTerm(''); setSearchQuery(''); } }] : []),
    ...(locationQuery ? [{ key: 'location', label: `Near ${locationQuery}`, onRemove: () => { setLocationTerm(''); setLocationQuery(''); } }] : []),
    ...(activeCategory ? [{ key: 'activeCategory', label: activeCategory, onRemove: () => setActiveCategory('') }] : []),
  ];
  const appliedChips = [...searchChips, ...filterChips];
  const appliedCount = searchChips.length + sheetFilterCount;
  const quickFilters = QUICK_FILTERS.filter((quickFilter) => !quickFilter.professionalOnly || activeTab === 'professional');
  const visibleCategories = showAllCategories ? categories : categories.slice(0, COLLAPSED_CATEGORY_COUNT);

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
  const handleQuickFilter = (quickFilter: QuickFilter): void => {
    setFilters((current) => ({ ...current, [quickFilter.key]: current[quickFilter.key] === quickFilter.value ? '' : quickFilter.value }));
  };
  const clearFilters = (): void => {
    setActiveCategory(''); setSearchTerm(''); setSearchQuery(''); setLocationTerm(''); setLocationQuery(''); setFilters(EMPTY_JOB_FILTERS); setSortBy('newest');
  };

  const renderContent = () => {
    if (loading) return <JobsListSkeleton variant={activeTab} />;
    if (error) {
      return (
        <View style={styles.stateBox}>
          <View style={[styles.stateIcon, { backgroundColor: colors.destructiveSurface }]}><X size={30} color={colors.destructiveText} /></View>
          <Text style={styles.stateTitle}>Something went wrong</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void loadJobs(); }} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.stateButton}><Text style={styles.stateButtonText}>Try again</Text></Pressable>
        </View>
      );
    }
    if (filteredJobs.length === 0) {
      return (
        <View style={styles.stateBox}>
          <View style={[styles.stateIcon, { backgroundColor: colors.control }]}><Search size={30} color={colors.mutedText} /></View>
          <Text style={styles.stateTitle}>{hasNarrowing ? `No matching ${unit}s` : `No open ${activeTab === 'quickTask' ? 'quick tasks' : 'jobs'} right now`}</Text>
          <Text style={styles.stateText}>{hasNarrowing ? 'Try removing a filter or searching for something broader.' : 'New listings appear here as soon as they are posted.'}</Text>
          {hasNarrowing
            ? <Pressable accessibilityRole="button" onPress={clearFilters} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.stateButton}><Text style={styles.stateButtonText}>Clear all filters</Text></Pressable>
            : <Pressable accessibilityRole="button" onPress={() => { if (requireVerified()) (activeTab === 'quickTask' ? setIsQuickTaskModalOpen : setIsJobModalOpen)(true); }} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.stateButton}><Text style={styles.stateButtonText}>{activeTab === 'quickTask' ? 'Post a quick task' : 'Post a job'}</Text></Pressable>}
        </View>
      );
    }
    const listProps = { jobs: visibleJobs, savedJobIds: viewer.savedJobIds, appliedJobIds: viewer.appliedJobIds, onToggleSave: (jobId: string) => void viewer.toggleSave(jobId), onApply: handleApply, onViewDetails: setDetailJob };
    return (
      <>
        {activeTab === 'professional' ? <ProfessionalJobsList {...listProps} /> : <QuickTasksList {...listProps} />}
        {visibleCount < filteredJobs.length ? (
          <Pressable accessibilityRole="button" onPress={() => setVisibleCount((count) => count + PAGE_SIZE)} android_ripple={{ color: colors.control }} style={styles.showMore}><Text style={styles.showMoreText}>Show more</Text></Pressable>
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
            <View style={styles.heroBadge}><Sparkles size={14} color={colors.successText} /><Text numberOfLines={1} style={styles.heroBadgeText}>{loading || error ? 'Explore opportunities' : `${tabJobs.length} open ${activeTab === 'quickTask' ? (tabJobs.length === 1 ? 'quick task' : 'quick tasks') : (tabJobs.length === 1 ? 'job' : 'jobs')}`}</Text></View>
            <Text accessibilityRole="header" style={styles.heroTitle}>Find your next <Text style={{ color: colors.accentText }}>opportunity</Text></Text>
          </View>

          <View style={styles.searchCard}>
            <View style={styles.searchField}><Search size={18} color={colors.mutedText} /><TextInput value={searchTerm} onChangeText={setSearchTerm} onSubmitEditing={handleSearch} returnKeyType="search" placeholder="Job title, keyword or company" placeholderTextColor={colors.mutedText} style={styles.searchInput} accessibilityLabel="Search jobs by title, keyword or company" /></View>
            <View style={styles.searchDivider} />
            <View style={styles.searchField}><MapPin size={18} color={colors.mutedText} /><TextInput value={locationTerm} onChangeText={setLocationTerm} onSubmitEditing={handleSearch} returnKeyType="search" placeholder="Location" placeholderTextColor={colors.mutedText} style={styles.searchInput} accessibilityLabel="Location" /></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Search jobs" onPress={handleSearch} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.searchButton}><Search size={17} color="#ffffff" /><Text style={styles.searchButtonText}>Search</Text></Pressable>
          </View>

          <View style={styles.quickLinks}>
            <Pressable accessibilityRole="button" accessibilityLabel="My applications" onPress={() => router.push('/jobs/applications' as Href)} android_ripple={{ color: colors.control }} style={styles.quickLink}><ClipboardList size={18} color={colors.accentText} /><Text numberOfLines={1} style={styles.quickLinkText}>Applications</Text><ChevronRight size={16} color={colors.mutedText} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="My listings" onPress={() => router.push('/jobs/manage' as Href)} android_ripple={{ color: colors.control }} style={styles.quickLink}><Settings2 size={18} color={colors.accentText} /><Text numberOfLines={1} style={styles.quickLinkText}>Listings</Text><ChevronRight size={16} color={colors.mutedText} /></Pressable>
          </View>

          <View accessibilityRole="tablist" style={styles.tabs}>
            {TABS.map(({ id, label }) => (
              <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: activeTab === id }} onPress={() => setActiveTab(id)} style={[styles.tab, activeTab === id && styles.tabActive]}><Text numberOfLines={1} style={[styles.tabText, activeTab === id && styles.tabTextActive]}>{label}</Text></Pressable>
            ))}
          </View>

          <View style={styles.createRow}>
            <Pressable accessibilityRole="button" onPress={() => { if (requireVerified()) setIsQuickTaskModalOpen(true); }} android_ripple={{ color: colors.control }} style={styles.createQuickTask}><Zap size={17} color={colors.accentText} /><Text numberOfLines={1} style={styles.createQuickTaskText}>Post task</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { if (requireVerified()) setIsJobModalOpen(true); }} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.createJob}><Plus size={17} color="#ffffff" /><Text numberOfLines={1} style={styles.createJobText}>Post job</Text></Pressable>
          </View>

          {categories.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text accessibilityRole="header" numberOfLines={1} style={styles.sectionTitle}>Categories</Text>
                {categories.length > COLLAPSED_CATEGORY_COUNT ? (
                  <Pressable accessibilityRole="button" onPress={() => setShowAllCategories((visible) => !visible)} style={styles.viewAll}><Text style={styles.viewAllText}>{showAllCategories ? 'Show less' : `See all ${categories.length}`}</Text></Pressable>
                ) : null}
              </View>
              {showAllCategories
                ? <View style={styles.chipWrap}>{visibleCategories.map((category) => <JobChip key={category.name} label={`${category.name} · ${category.count}`} accessibilityLabel={`${category.name}, ${category.count} open`} isSelected={activeCategory === category.name} onPress={() => handleCategory(category.name)} />)}</View>
                : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>{visibleCategories.map((category) => <JobChip key={category.name} label={`${category.name} · ${category.count}`} accessibilityLabel={`${category.name}, ${category.count} open`} isSelected={activeCategory === category.name} onPress={() => handleCategory(category.name)} />)}</ScrollView>}
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.filterRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Filters${sheetFilterCount ? `, ${sheetFilterCount} applied` : ''}`} onPress={() => setIsFiltersOpen(true)} android_ripple={{ color: colors.control }} style={[styles.filterButton, sheetFilterCount > 0 && styles.filterButtonActive]}>
                <SlidersHorizontal size={16} color={sheetFilterCount ? colors.successText : colors.text} />
                <Text style={[styles.filterButtonText, sheetFilterCount > 0 && styles.filterButtonTextActive]}>Filters</Text>
                {sheetFilterCount ? <View style={styles.countBadge}><Text style={styles.countBadgeText}>{sheetFilterCount}</Text></View> : null}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Sort by ${JOB_SORT_SHORT_LABELS[sortBy]}. Change sort`} onPress={() => setIsFiltersOpen(true)} android_ripple={{ color: colors.control }} style={styles.filterButton}>
                <ArrowUpDown size={16} color={colors.text} /><Text numberOfLines={1} style={styles.filterButtonText}>{JOB_SORT_SHORT_LABELS[sortBy]}</Text>
              </Pressable>
              {!loading && !error ? <Text numberOfLines={1} style={styles.resultText}><Text style={styles.resultCount}>{filteredJobs.length}</Text> {filteredJobs.length === 1 ? 'result' : 'results'}</Text> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipScroll}>
              {quickFilters.map((quickFilter) => <JobChip key={`${quickFilter.key}-${quickFilter.value}`} label={quickFilter.value} isSelected={filters[quickFilter.key] === quickFilter.value} onPress={() => handleQuickFilter(quickFilter)} />)}
            </ScrollView>
            {appliedChips.length ? (
              <View style={styles.appliedBox}>
                <View style={styles.appliedHeader}>
                  <Text style={styles.appliedText}>{appliedCount ? `${appliedCount} ${appliedCount === 1 ? 'filter' : 'filters'} applied` : 'Custom sort'}</Text>
                  <Pressable accessibilityRole="button" onPress={clearFilters} hitSlop={8} style={styles.clearAll}><Text style={styles.clearAllText}>Clear all</Text></Pressable>
                </View>
                <View style={styles.activeChips}>
                  {appliedChips.map((chip) => (
                    <Pressable key={chip.key} accessibilityRole="button" accessibilityLabel={`Remove ${chip.label}`} onPress={chip.onRemove} hitSlop={4} style={styles.activeChip}>
                      <Text numberOfLines={1} style={styles.activeChipText}>{chip.label}</Text><X size={14} color={colors.successText} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          {renderContent()}
        </ScrollView>
      </KeyboardSafeView>

      <JobFiltersSheet visible={isFiltersOpen} filters={filters} sort={sortBy} totalResults={loading || error ? null : filteredJobs.length} unit={unit} onFiltersChange={setFilters} onSortChange={setSortBy} onClose={() => setIsFiltersOpen(false)} />
      <JobCreationModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onCreated={() => void loadJobs()} />
      <QuickTaskCreationModal isOpen={isQuickTaskModalOpen} onClose={() => setIsQuickTaskModalOpen(false)} onCreated={() => void loadJobs()} />
      <IdentityVerificationModal isOpen={isVerificationModalOpen} onClose={() => setIsVerificationModalOpen(false)} verificationStatus={viewer.verificationStatus} />
      <JobDetailsModal
        isOpen={detailJob !== null}
        job={detailJob}
        isApplied={detailJob ? viewer.appliedJobIds.has(detailJob.id) : false}
        isSaved={detailJob ? viewer.savedJobIds.has(detailJob.id) : false}
        onToggleSave={(jobId) => void viewer.toggleSave(jobId)}
        onClose={() => setDetailJob(null)}
        onApply={handleApply}
      />
      {applyJob ? (
        <JobApplicationModal isOpen job={applyJob} jobType={applyJob.basic_info.type} onClose={() => setApplyJob(null)} onApplied={() => viewer.markApplied(applyJob.id)} />
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    flex: { flex: 1 },
    content: { paddingBottom: 48, gap: 16 },
    hero: { marginHorizontal: 16, marginTop: 16, gap: 8 },
    heroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
    heroBadgeText: { color: colors.successText, fontSize: 12, fontWeight: '800' },
    heroTitle: { color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 30 },
    searchCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, padding: 8, gap: 4 },
    searchField: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
    searchInput: { flex: 1, minHeight: 44, color: colors.text, fontSize: 14 },
    searchDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 8 },
    searchButton: { marginTop: 4, minHeight: 48, borderRadius: 12, overflow: 'hidden', backgroundColor: JOBS_ACTION_GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    searchButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
    quickLinks: { marginHorizontal: 16, flexDirection: 'row', gap: 8 },
    quickLink: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, overflow: 'hidden', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    quickLinkText: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 13 },
    tabs: { marginHorizontal: 16, flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: colors.control },
    tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    tabActive: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    tabText: { color: colors.mutedText, fontSize: 14, fontWeight: '700' },
    tabTextActive: { color: colors.text, fontWeight: '900' },
    createRow: { marginHorizontal: 16, flexDirection: 'row', gap: 8 },
    createQuickTask: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface },
    createQuickTaskText: { color: colors.accentText, fontWeight: '800', fontSize: 14 },
    createJob: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN },
    createJobText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
    section: { gap: 8 },
    sectionHeader: { marginHorizontal: 16, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    sectionTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' },
    viewAll: { minHeight: 44, justifyContent: 'center', paddingLeft: 8 },
    viewAllText: { color: colors.accentText, fontWeight: '800', fontSize: 14 },
    chipScroll: { paddingHorizontal: 16, paddingVertical: 4, gap: 8 },
    chipWrap: { marginHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterRow: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
    filterButton: { flexShrink: 0, maxWidth: 150, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, overflow: 'hidden', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    filterButtonActive: { borderColor: colors.accent, backgroundColor: colors.successSurface },
    filterButtonText: { flexShrink: 1, color: colors.text, fontWeight: '700', fontSize: 13 },
    filterButtonTextActive: { color: colors.successText },
    countBadge: { minWidth: 20, height: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: JOBS_ACTION_GREEN },
    countBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
    resultText: { flex: 1, textAlign: 'right', color: colors.mutedText, fontSize: 13 },
    resultCount: { color: colors.text, fontWeight: '800' },
    appliedBox: { marginHorizontal: 16, gap: 8 },
    appliedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    appliedText: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
    clearAll: { minHeight: 32, justifyContent: 'center' },
    clearAllText: { color: colors.destructiveText, fontSize: 13, fontWeight: '800' },
    activeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    activeChip: { maxWidth: '100%', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 12 },
    activeChipText: { flexShrink: 1, color: colors.successText, fontSize: 13, fontWeight: '700' },
    stateBox: { marginHorizontal: 16, alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 20, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    stateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    stateTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
    stateText: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    stateButton: { marginTop: 8, minHeight: 44, justifyContent: 'center', overflow: 'hidden', backgroundColor: JOBS_ACTION_GREEN, borderRadius: 12, paddingHorizontal: 20 },
    stateButtonText: { color: '#ffffff', fontWeight: '800' },
    showMore: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', overflow: 'hidden', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 24 },
    showMoreText: { color: colors.text, fontWeight: '800', fontSize: 14 },
    endText: { color: colors.mutedText, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  });
}
