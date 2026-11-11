import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ChevronLeft, Search, Star, Clock, Users, GraduationCap, CheckCircle2, X } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { CourseCatalogSkeleton } from '@/components/ui/Skeleton';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import type { CatalogPriceFilter, CatalogSort, Course, Enrollment } from '@/lib/types/course';

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'] as const;
const PRICE_FILTERS: CatalogPriceFilter[] = ['All', 'Free', 'Paid'];
const SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'recent', label: 'Most recent' },
  { value: 'rating', label: 'Top rated' },
];

type Level = (typeof LEVELS)[number];
type DialogState = { visible: boolean; type: 'error' | 'success'; title: string; message: string };

const createdTime = (course: Course): number => (typeof course.createdAt === 'string' ? Date.parse(course.createdAt) || 0 : 0);

/** The course catalog (web /eLearning/courses): search, category/level/price filters, sort, enrolled badges, quick enroll. */
export default function CoursesCatalogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; q?: string; subcategory?: string }>();
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();

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

  const renderPills = <T extends string>(options: readonly T[], selected: T, onSelect: (value: T) => void, label: (value: T) => string = (value) => value) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} keyboardShouldPersistTaps="handled">
      {options.map((option) => {
        const isActive = option.toLowerCase() === selected.toLowerCase();
        return (
          <TouchableOpacity
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(option)}
            style={[styles.pill, isActive ? { backgroundColor: '#10b981', borderColor: '#10b981' } : { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.pillText, { color: isActive ? '#ffffff' : colors.text }]}>{label(option)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.canvas }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Courses Catalog</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardSafeView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadCourses(); }} tintColor="#10b981" />}
      >
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.mutedText} />
          <TextInput
            placeholder="Search courses, topics, skills..."
            placeholderTextColor={colors.mutedText}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
              <X size={18} color={colors.mutedText} />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={[styles.filterLabel, { color: colors.mutedText }]}>Category</Text>
        {renderPills(categoryOptions, selectedCategory, (value) => { setSelectedCategory(value); setSubcategory(''); })}
        {subcategory ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setSubcategory('')} style={[styles.subcategoryChip, { backgroundColor: colors.successSurface }]}>
            <Text style={[styles.pillText, { color: colors.successText }]}>{subcategory}</Text>
            <X size={14} color={colors.successText} />
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.filterLabel, { color: colors.mutedText }]}>Level</Text>
        {renderPills(LEVELS, level, setLevel)}
        <Text style={[styles.filterLabel, { color: colors.mutedText }]}>Price</Text>
        {renderPills(PRICE_FILTERS, price, setPrice)}

        <View style={[styles.resultsBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.resultsText, { color: colors.mutedText }]}>
            {loading ? 'Loading courses…' : `${filteredCourses.length} ${filteredCourses.length === 1 ? 'result' : 'results'}`}
          </Text>
          <View style={styles.sortRow}>
            {SORTS.map((option) => (
              <TouchableOpacity
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: sort === option.value }}
                onPress={() => setSort(option.value)}
                style={[styles.sortChip, sort === option.value && { backgroundColor: colors.control }]}
              >
                <Text style={[styles.sortText, { color: sort === option.value ? colors.accentText : colors.mutedText }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {error && !loading ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.destructiveText }]}>{error}</Text>
            <TouchableOpacity onPress={() => { setLoading(true); void loadCourses(); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: colors.accentText, fontWeight: '800' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <CourseCatalogSkeleton />
        ) : filteredCourses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <GraduationCap size={44} color={colors.mutedText} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No courses found</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedText }]}>Try adjusting your search term or filters.</Text>
            {hasFilters ? (
              <TouchableOpacity accessibilityRole="button" onPress={handleClearFilters} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Clear All Filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.coursesGrid}>
            {filteredCourses.map((course) => {
              const isEnrolled = isActiveEnrollment(enrollments.get(course.id));
              const canQuickEnroll = !isEnrolled && !enrollments.has(course.id) && course.price === 0;
              return (
                <TouchableOpacity
                  key={course.id}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/eLearning/courses/${course.id}` as Href)}
                  style={[styles.courseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  {course.image ? <Image source={{ uri: course.image }} style={styles.courseImage} resizeMode="cover" /> : <View style={[styles.courseImage, { backgroundColor: colors.control }]} />}
                  {isEnrolled ? (
                    <View style={styles.enrolledBadge}>
                      <CheckCircle2 size={13} color="#ffffff" />
                      <Text style={styles.enrolledBadgeText}>Enrolled</Text>
                    </View>
                  ) : null}
                  <View style={styles.cardContent}>
                    <View style={styles.badgeRow}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{course.category.toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.levelBadgeText, { color: colors.mutedText }]}>{course.level}</Text>
                    </View>
                    <Text style={[styles.courseTitle, { color: colors.text }]} numberOfLines={2}>{course.title}</Text>
                    <Text style={[styles.instructorText, { color: colors.mutedText }]}>by {course.instructor.name}</Text>
                    <View style={styles.cardMetaRow}>
                      <View style={styles.metaItem}>
                        <Star size={14} color="#f59e0b" fill="#f59e0b" />
                        <Text style={[styles.metaText, { color: colors.text }]}>{course.rating.toFixed(1)} ({course.totalRatings})</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Clock size={14} color={colors.mutedText} />
                        <Text style={[styles.metaText, { color: colors.mutedText }]}>{course.duration}h</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Users size={14} color={colors.mutedText} />
                        <Text style={[styles.metaText, { color: colors.mutedText }]}>{course.enrolledStudents}</Text>
                      </View>
                      <Text style={[styles.priceText, { color: colors.text }]}>{isEnrolled ? 'Enrolled' : course.price === 0 ? 'Free' : `$${course.price}`}</Text>
                    </View>
                    {canQuickEnroll ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Enroll in ${course.title}`}
                        disabled={enrollingId !== null}
                        onPress={() => void handleEnroll(course)}
                        style={[styles.enrollBtn, { borderColor: colors.accent, opacity: enrollingId && enrollingId !== course.id ? 0.5 : 1 }]}
                      >
                        {enrollingId === course.id ? <ActivityIndicator size="small" color={colors.accentText} /> : <Text style={[styles.enrollBtnText, { color: colors.accentText }]}>Enroll</Text>}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
      </KeyboardSafeView>

      <CustomModal visible={dialog.visible} type={dialog.type} title={dialog.title} message={dialog.message} onClose={() => setDialog((current) => ({ ...current, visible: false }))} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scrollContent: { padding: 16, paddingBottom: 60, gap: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  filterLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  pills: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 13, fontWeight: '700' },
  subcategoryChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  resultsBar: { marginTop: 6, padding: 10, borderRadius: 14, borderWidth: 1, gap: 8 },
  resultsText: { fontSize: 13, fontWeight: '600' },
  sortRow: { flexDirection: 'row', gap: 6 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  sortText: { fontSize: 13, fontWeight: '800' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
  secondaryBtn: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  coursesGrid: { gap: 16, marginTop: 6 },
  courseCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  courseImage: { width: '100%', height: 180 },
  enrolledBadge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#059669' },
  enrolledBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  cardContent: { padding: 16, gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryBadge: { backgroundColor: '#10b98122', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryBadgeText: { color: '#059669', fontSize: 11, fontWeight: '800' },
  levelBadgeText: { fontSize: 12, textTransform: 'capitalize', fontWeight: '600' },
  courseTitle: { fontSize: 17, fontWeight: '800', lineHeight: 22 },
  instructorText: { fontSize: 13, fontWeight: '500' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '600' },
  priceText: { marginLeft: 'auto', fontSize: 13, fontWeight: '800' },
  enrollBtn: { minHeight: 42, marginTop: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  enrollBtnText: { fontSize: 14, fontWeight: '800' },
});
