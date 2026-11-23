import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { GraduationCap, PenSquare, Search, X } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { CourseCatalogResultsSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { CourseCard, ELearningChip, ELearningEmptyState, ELearningHeader, ELearningHeaderButton, ELEARNING_GUTTER } from '@/components/eLearning/ELearningParts';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import { instructorService } from '@/lib/services/InstructorService';
import type { CatalogPriceFilter, CatalogSort, Course, Enrollment } from '@/lib/types/course';

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'] as const;
const PRICE_FILTERS: CatalogPriceFilter[] = ['All', 'Free', 'Paid'];
const SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'recent', label: 'Newest' },
  { value: 'rating', label: 'Top rated' },
];
/** Rails ("Popular", "New", "Free") only appear when the catalog is unfiltered and big enough to be worth browsing. */
const RAIL_MIN_COURSES = 4;
const RAIL_SIZE = 8;
const CARD_GAP = 12;

type Level = (typeof LEVELS)[number];
type DialogState = { visible: boolean; type: 'error' | 'success'; title: string; message: string };
type Rail = { key: string; title: string; courses: Course[] };

const createdTime = (course: Course): number => (typeof course.createdAt === 'string' ? Date.parse(course.createdAt) || 0 : 0);

/** The course catalog (web /eLearning/courses): search, category/level/price filters, rails, sort, enrolled badges, quick enroll. */
export default function CoursesCatalogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; q?: string; subcategory?: string }>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const { activeUserId } = useAppData();
  // Web courses/page.tsx shows "Create Course" to instructors.
  const [isInstructor, setIsInstructor] = useState(false);
  useEffect(() => {
    if (!activeUserId) return;
    let isActive = true;
    void instructorService.getStatus(activeUserId)
      .then((status) => { if (isActive) setIsInstructor(status !== 'none'); })
      .catch(() => { if (isActive) setIsInstructor(false); });
    return () => { isActive = false; };
  }, [activeUserId]);

  const [courses, setCourses] = useState<Course[]>([]);
  const [fallbackCategories, setFallbackCategories] = useState<string[]>([]);
  const [enrollments, setEnrollments] = useState<Map<string, Enrollment>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState(typeof params.category === 'string' && params.category ? params.category : 'All');
  const [subcategory, setSubcategory] = useState(typeof params.subcategory === 'string' ? params.subcategory : '');
  const [search, setSearch] = useState(typeof params.q === 'string' ? params.q : '');
  const [level, setLevel] = useState<Level>('All');
  const [price, setPrice] = useState<CatalogPriceFilter>('All');
  const [sort, setSort] = useState<CatalogSort>('featured');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ visible: false, type: 'success', title: '', message: '' });

  // Links from the hub (topic chips, categories, search) open the catalog already filtered, like ?category= and ?q= on the web.
  useEffect(() => {
    if (typeof params.category === 'string') setSelectedCategory(params.category || 'All');
    if (typeof params.q === 'string') setSearch(params.q);
    setSubcategory(typeof params.subcategory === 'string' ? params.subcategory : '');
  }, [params.category, params.q, params.subcategory]);

  const loadCourses = useCallback(async () => {
    setError('');
    try {
      const [data, categoryData, enrollmentIndex] = await Promise.all([
        courseService.getCourses(),
        courseService.getCategories().catch((categoryError: unknown) => {
          console.warn('[CoursesCatalogScreen.loadCourses] Categories unavailable:', categoryError instanceof Error ? categoryError.message : 'Unknown error');
          return [];
        }),
        activeUserId
          ? courseService.getEnrollmentIndex(activeUserId).catch((enrollmentError: unknown) => {
            console.warn('[CoursesCatalogScreen.loadCourses] Enrollments unavailable:', enrollmentError instanceof Error ? enrollmentError.message : 'Unknown error');
            return new Map<string, Enrollment>();
          })
          : Promise.resolve(new Map<string, Enrollment>()),
      ]);
      setCourses(data);
      setFallbackCategories(categoryData.map((category) => category.name));
      setEnrollments(enrollmentIndex);
    } catch (loadError: unknown) {
      console.error('[CoursesCatalogScreen.loadCourses] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Courses could not be loaded. Check your connection and retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeUserId]);

  useEffect(() => { void loadCourses(); }, [loadCourses]);

  // Categories come from the courses themselves (like the website); the courseCategories collection is the fallback.
  const categoryOptions = useMemo(() => {
    const fromCourses = [...new Set(courses.map((course) => course.category).filter(Boolean))].sort((left, right) => left.localeCompare(right));
    const options = fromCourses.length ? fromCourses : [...new Set(fallbackCategories)];
    if (selectedCategory !== 'All' && !options.some((option) => option.toLowerCase() === selectedCategory.toLowerCase())) options.unshift(selectedCategory);
    return ['All', ...options];
  }, [courses, fallbackCategories, selectedCategory]);

  const filteredCourses = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const base = courses.filter((course) =>
      (!term || [course.title, course.description, ...course.tags].some((value) => value.toLocaleLowerCase().includes(term)))
      && (selectedCategory === 'All' || course.category.toLowerCase() === selectedCategory.toLowerCase())
      && (!subcategory || course.subcategory?.toLowerCase() === subcategory.toLowerCase())
      && (level === 'All' || course.level === level.toLowerCase())
      && (price === 'All' || (price === 'Free' ? course.price === 0 : course.price > 0)));
    if (sort === 'recent') return [...base].sort((left, right) => createdTime(right) - createdTime(left));
    if (sort === 'rating') return [...base].sort((left, right) => right.rating - left.rating);
    return [...base].sort((left, right) => Number(right.featured === true) - Number(left.featured === true));
  }, [courses, search, selectedCategory, subcategory, level, price, sort]);

  const hasFilters = Boolean(search.trim()) || selectedCategory !== 'All' || Boolean(subcategory) || level !== 'All' || price !== 'All';

  const rails = useMemo<Rail[]>(() => {
    if (hasFilters || courses.length < RAIL_MIN_COURSES) return [];
    const popular = [...courses].sort((left, right) => right.enrolledStudents - left.enrolledStudents).slice(0, RAIL_SIZE);
    const newest = [...courses].filter((course) => createdTime(course) > 0).sort((left, right) => createdTime(right) - createdTime(left)).slice(0, RAIL_SIZE);
    const free = courses.filter((course) => course.price === 0).slice(0, RAIL_SIZE);
    return [
      { key: 'popular', title: 'Popular', courses: popular },
      { key: 'new', title: 'New', courses: newest },
      { key: 'free', title: 'Free', courses: free },
    ].filter((rail) => rail.courses.length >= 2);
  }, [courses, hasFilters]);

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCategory('All');
    setSubcategory('');
    setLevel('All');
    setPrice('All');
  };

  const handleEnroll = async (course: Course) => {
    if (!activeUserId) { router.push('/login' as Href); return; }
    setEnrollingId(course.id);
    try {
      const enrollment = await courseService.enrollInCourse(activeUserId, course.id);
      setEnrollments((current) => new Map(current).set(course.id, enrollment));
      setDialog({ visible: true, type: 'success', title: 'You’re enrolled', message: `${course.title} is now in My Learning.` });
    } catch (enrollError: unknown) {
      console.error('[CoursesCatalogScreen.handleEnroll] Error:', enrollError instanceof Error ? enrollError.message : 'Unknown error');
      setDialog({ visible: true, type: 'error', title: 'Enrollment failed', message: 'This course could not be joined right now. Open the course for details or try again.' });
    } finally {
      setEnrollingId(null);
    }
  };

  const handleOpenCourse = (courseId: string) => router.push(`/eLearning/courses/${courseId}` as Href);

  // One column on phones, two from 600dp, three from 900dp.
  const contentWidth = width - ELEARNING_GUTTER * 2;
  const columns = width >= 900 ? 3 : width >= 600 ? 2 : 1;
  const cardWidth = Math.floor((contentWidth - CARD_GAP * (columns - 1)) / columns);
  const railCardWidth = Math.min(280, Math.round(contentWidth * 0.78));

  const renderCourse = (course: Course, cardSize: number) => {
    const enrollment = enrollments.get(course.id);
    const isEnrolled = isActiveEnrollment(enrollment);
    const canQuickEnroll = !isEnrolled && !enrollments.has(course.id) && course.price === 0;
    return <CourseCard
      key={course.id}
      course={course}
      width={cardSize}
      enrollment={isEnrolled ? enrollment : null}
      onOpen={handleOpenCourse}
      action={canQuickEnroll ? {
        label: 'Enroll free',
        accessibilityLabel: `Enroll in ${course.title} for free`,
        onPress: () => void handleEnroll(course),
        isBusy: enrollingId === course.id,
        isDisabled: enrollingId !== null && enrollingId !== course.id,
      } : undefined}
    />;
  };

  const renderChips = <T extends string>(label: string, options: readonly T[], selected: T, onSelect: (value: T) => void) => (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
        {options.map((option) => <ELearningChip key={option} label={option} isSelected={option.toLowerCase() === selected.toLowerCase()} onPress={() => onSelect(option)} />)}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ELearningHeader
        title="Courses"
        onBack={() => router.back()}
        right={isInstructor ? (
          <ELearningHeaderButton accessibilityLabel="Create course" onPress={() => router.push('/eLearning/instructor/create' as Href)}>
            <PenSquare size={21} color={colors.accentText} />
          </ELearningHeaderButton>
        ) : undefined}
      />

      <KeyboardSafeView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadCourses(); }} tintColor={colors.accent} />}
        >
          <View style={styles.searchBox}>
            <Search size={18} color={colors.mutedText} />
            <TextInput
              placeholder="Search courses, topics, skills"
              placeholderTextColor={colors.mutedText}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              accessibilityLabel="Search courses"
              style={styles.searchInput}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clearButton}>
                <X size={18} color={colors.mutedText} />
              </Pressable>
            ) : null}
          </View>

          {renderChips('Category', categoryOptions, selectedCategory, (value) => { setSelectedCategory(value); setSubcategory(''); })}
          {subcategory ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${subcategory} filter`} onPress={() => setSubcategory('')} style={styles.subcategoryChip}>
              <Text numberOfLines={1} style={styles.subcategoryText}>{subcategory}</Text>
              <X size={14} color={colors.successText} />
            </Pressable>
          ) : null}
          {renderChips('Level', LEVELS, level, setLevel)}
          {renderChips('Price', PRICE_FILTERS, price, setPrice)}

          {!loading && !error && rails.map((rail) => (
            <View key={rail.key} style={styles.rail}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>{rail.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={railCardWidth + CARD_GAP} contentContainerStyle={styles.railRow}>
                {rail.courses.map((course) => renderCourse(course, railCardWidth))}
              </ScrollView>
            </View>
          ))}

          <View style={styles.resultsBar}>
            <Text style={styles.resultsText}>
              {loading ? 'Loading courses…' : rails.length ? 'All courses' : `${filteredCourses.length} ${filteredCourses.length === 1 ? 'result' : 'results'}`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {SORTS.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Sort by ${option.label}`}
                  accessibilityState={{ selected: sort === option.value }}
                  onPress={() => setSort(option.value)}
                  style={[styles.sortChip, sort === option.value && styles.sortChipActive]}
                >
                  <Text numberOfLines={1} style={[styles.sortText, sort === option.value && styles.sortTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {error && !loading ? (
            <ELearningEmptyState
              icon={<GraduationCap size={40} color={colors.mutedText} />}
              title="Courses could not load"
              hint={error}
              actionLabel="Try again"
              onAction={() => { setLoading(true); void loadCourses(); }}
            />
          ) : loading ? (
            <CourseCatalogResultsSkeleton />
          ) : filteredCourses.length === 0 ? (
            <ELearningEmptyState
              icon={<GraduationCap size={40} color={colors.mutedText} />}
              title="No courses found"
              hint={hasFilters ? 'Try a different search or fewer filters.' : 'New courses appear here as instructors publish them.'}
              actionLabel={hasFilters ? 'Clear filters' : undefined}
              onAction={hasFilters ? handleClearFilters : undefined}
            />
          ) : (
            <View style={styles.coursesGrid}>
              {filteredCourses.map((course) => renderCourse(course, cardWidth))}
            </View>
          )}
        </ScrollView>
      </KeyboardSafeView>

      <CustomModal visible={dialog.visible} type={dialog.type} title={dialog.title} message={dialog.message} onClose={() => setDialog((current) => ({ ...current, visible: false }))} />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { padding: ELEARNING_GUTTER, paddingBottom: 48, gap: 16 },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 },
  searchInput: { flex: 1, minHeight: 44, color: colors.text, fontSize: 15, paddingVertical: 0 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filterGroup: { gap: 8 },
  filterLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  subcategoryChip: { alignSelf: 'flex-start', minHeight: 36, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.successSurface },
  subcategoryText: { flexShrink: 1, color: colors.successText, fontSize: 14, fontWeight: '600' },
  rail: { gap: 8 },
  railRow: { gap: CARD_GAP },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  resultsBar: { gap: 8, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  resultsText: { paddingTop: 8, color: colors.text, fontSize: 16, fontWeight: '700' },
  sortChip: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10 },
  sortChipActive: { backgroundColor: colors.control },
  sortText: { color: colors.mutedText, fontSize: 14, fontWeight: '600' },
  sortTextActive: { color: colors.accentText, fontWeight: '700' },
  coursesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
});
