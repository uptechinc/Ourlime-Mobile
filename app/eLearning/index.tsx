import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Bell, BookOpen, ChevronRight, ClipboardCheck, GraduationCap, PenSquare, Search, Star, Users } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import CategoryBrowser from '@/components/eLearning/course/CategoryBrowser';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useLearningOverview } from '@/lib/hooks/useLearningOverview';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

type LearningTab = 'courses' | 'resources' | 'tutors';

const pluralize = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;
const POPULAR_TOPIC_COUNT = 6;
const catalogHref = (params: { category?: string; subcategory?: string; q?: string }): Href => {
  const query = Object.entries(params).filter(([, value]) => Boolean(value)).map(([key, value]) => `${key}=${encodeURIComponent(value ?? '')}`).join('&');
  return (query ? `/eLearning/courses?${query}` : '/eLearning/courses') as Href;
};

export default function ELearningScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors, width), [colors, width]);
  const { data, instructorStatus, loading, refreshing, error, refresh } = useLearningOverview();
  const isInstructor = instructorStatus !== 'none';
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<LearningTab>('courses');
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const courses = (data?.courses ?? []).filter((course) => !normalizedSearch || [course.title, course.description, ...course.tags].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)));

  // The categories with the most courses, so the shortcuts never lead to an empty catalog (web HeroSection).
  const popularTopics = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.courses ?? []).forEach((course) => counts.set(course.category, (counts.get(course.category) ?? 0) + 1));
    return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, POPULAR_TOPIC_COUNT).map(([category]) => category);
  }, [data?.courses]);

  const handleRetry = () => { void refresh(true); };
  const handleSearchSubmit = () => { router.push(catalogHref({ q: search.trim() })); };

  return (
    <View style={styles.safeArea}>
      <PageHeader title="E-Learning" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.accent} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}><GraduationCap size={32} color="#ffffff" /></View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>LIMES ACADEMY</Text>
            <Text style={styles.heroTitle}>Learn at your pace</Text>
            <Text style={styles.heroText}>Courses, CXC resources, assignments, and progress in one place.</Text>
          </View>
        </View>

        <View style={styles.search}>
          <Search size={19} color={colors.mutedText} />
          <TextInput value={search} onChangeText={setSearch} onSubmitEditing={handleSearchSubmit} returnKeyType="search" placeholder="Search courses and skills" placeholderTextColor={colors.mutedText} style={styles.searchInput} />
        </View>

        {popularTopics.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics} keyboardShouldPersistTaps="handled">
            <Text style={styles.topicsLabel}>Popular:</Text>
            {popularTopics.map((topic) => (
              <TouchableOpacity key={topic} accessibilityRole="link" onPress={() => router.push(catalogHref({ category: topic }))} style={styles.topicChip}>
                <Text style={styles.topicText}>{topic}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {data ? (
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statValue}>{data.stats.totalCourses}</Text><Text style={styles.statLabel}>Courses</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{data.stats.totalLearners}</Text><Text style={styles.statLabel}>Learners</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{data.stats.averageRating.toFixed(1)}</Text><Text style={styles.statLabel}>Avg rating</Text></View>
          </View>
        ) : null}

        <View style={styles.quickGrid}>
          <QuickAction title="Browse courses" detail="Explore the catalog" icon={<BookOpen size={23} color="#ffffff" />} color="#059669" wide onPress={() => router.push('/eLearning/courses' as Href)} styles={styles} />
          <QuickAction title="My learning" detail="Resume your progress" icon={<GraduationCap size={23} color="#ffffff" />} color="#2563eb" onPress={() => router.push('/eLearning/my-learning' as Href)} styles={styles} />
          <QuickAction title="CXC hub" detail="CSEC and CAPE" icon={<BookOpen size={23} color="#ffffff" />} color="#7c3aed" onPress={() => router.push('/eLearning/cxc' as Href)} styles={styles} />
          {/* Existing instructors get their tools instead of the sign-up call to action (web hub quick links). */}
          {loading ? null : isInstructor ? (
            <>
              <QuickAction title="Create course" detail="Build and publish a course" icon={<PenSquare size={23} color="#ffffff" />} color="#0f766e" onPress={() => router.push('/eLearning/instructor/create' as Href)} styles={styles} />
              <QuickAction title="Grading" detail="Your courses and submissions" icon={<ClipboardCheck size={23} color="#ffffff" />} color="#b45309" onPress={() => router.push('/eLearning/instructor' as Href)} styles={styles} />
            </>
          ) : (
            <QuickAction title="Teach on Ourlime" detail="Become an instructor" icon={<Users size={23} color="#ffffff" />} color="#0f766e" wide onPress={() => router.push('/eLearning/instructor' as Href)} styles={styles} />
          )}
        </View>

        {loading ? (
          <>
            <View style={styles.sectionHeader}>
              <Skeleton width={140} height={18} />
              <Skeleton width={28} height={18} borderRadius={9} />
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Skeleton width="70%" height={16} />
              <SkeletonText lines={2} lineHeight={12} />
              <Skeleton width="30%" height={10} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginVertical: 4 }}>
              <Skeleton width={80} height={34} borderRadius={17} />
              <Skeleton width={80} height={34} borderRadius={17} />
              <Skeleton width={80} height={34} borderRadius={17} />
            </View>
            {[1, 2, 3].map((item) => (
              <View key={item} style={[styles.courseCard, { backgroundColor: colors.surface }]}>
                <Skeleton width={80} height={80} borderRadius={12} />
                <View style={[styles.courseCopy, { gap: 8 }]}>
                  <Skeleton width="85%" height={16} />
                  <Skeleton width="50%" height={12} />
                  <Skeleton width="40%" height={10} />
                </View>
              </View>
            ))}
          </>
        ) : null}
        {!loading && error ? (
          <View style={styles.errorCard}><Text style={styles.cardTitle}>E-Learning could not load</Text><Text style={styles.muted}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={handleRetry} style={styles.retry}><Text style={styles.retryText}>Try Again</Text></TouchableOpacity></View>
        ) : null}

        {!loading && !error ? (
          <>
            <View style={styles.sectionHeader}><View style={styles.sectionTitleRow}><Bell size={20} color={colors.accentText} /><Text style={styles.sectionTitle}>Course updates</Text></View><Text style={styles.count}>{data?.announcements.length ?? 0}</Text></View>
            {(data?.announcements.length ?? 0) === 0 ? <EmptyCard title="No course updates" detail="Announcements from courses you join will appear here." styles={styles} /> :
              data?.announcements.slice(0, 5).map((announcement) => {
                const courseTitle = data.courses.find((course) => course.id === announcement.courseId)?.title;
                return (
                  <TouchableOpacity key={announcement.id} accessibilityRole="button" onPress={() => router.push(('/eLearning/courses/' + announcement.courseId) as Href)} style={styles.card}>
                    <Text style={styles.cardTitle}>{announcement.important ? 'Important: ' : ''}{announcement.title}</Text>
                    <Text numberOfLines={3} style={styles.muted}>{announcement.body}</Text>
                    <Text style={styles.meta}>{[announcement.authorName, courseTitle].filter(Boolean).join(' · ')}</Text>
                  </TouchableOpacity>
                );
              })}

            <View style={styles.tabs}>
              {(['courses', 'resources', 'tutors'] as const).map((item) => <TouchableOpacity key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.activeTab]}><Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item[0].toUpperCase() + item.slice(1)}</Text></TouchableOpacity>)}
            </View>

            {tab === 'courses' && courses.length > 8 ? (
              <TouchableOpacity accessibilityRole="link" onPress={() => router.push(catalogHref({ q: search.trim() }))} style={styles.viewAll}>
                <Text style={styles.viewAllText}>View all {courses.length} courses</Text>
                <ChevronRight size={18} color={colors.accentText} />
              </TouchableOpacity>
            ) : null}
            {tab === 'courses' && (courses.length ? courses.slice(0, 8).map((course) => (
              <TouchableOpacity key={course.id} onPress={() => router.push(('/eLearning/courses/' + course.id) as Href)} style={styles.courseCard}>
                {course.image ? <Image source={{ uri: course.image }} style={styles.courseImage} /> : <View style={[styles.courseImage, styles.imageFallback]}><BookOpen size={28} color={colors.mutedText} /></View>}
                <View style={styles.courseCopy}><Text numberOfLines={2} style={styles.cardTitle}>{course.title}</Text><Text style={styles.muted}>{course.instructor.name}</Text><View style={styles.metaRow}><Star size={14} color="#f59e0b" /><Text style={styles.meta}>{course.rating.toFixed(1)} · {course.duration}h · {course.price === 0 ? 'Free' : 'Payments unavailable'}</Text></View></View>
                <ChevronRight size={20} color={colors.icon} />
              </TouchableOpacity>
            )) : <EmptyCard title="No published courses" detail="Published courses will appear here when instructors add them." styles={styles} />)}

            {tab === 'resources' ? (
              <CategoryBrowser
                courses={data?.courses ?? []}
                onOpenCategory={(category, subcategory) => router.push(catalogHref({ category, subcategory }))}
                onOpenCxc={() => router.push('/eLearning/cxc' as Href)}
              />
            ) : null}

            {tab === 'tutors' && ((data?.instructors.length ?? 0) ? data?.instructors.map((instructor) => <View key={instructor.id} style={styles.tutorCard}>{instructor.avatar ? <Image source={{ uri: instructor.avatar }} style={styles.avatar} /> : <View style={[styles.avatar, styles.imageFallback]}><Users size={24} color={colors.mutedText} /></View>}<View style={styles.courseCopy}><Text style={styles.cardTitle}>{instructor.name}</Text><Text style={styles.muted}>{instructor.specialties.join(' · ') || 'Instructor'}</Text><Text style={styles.meta}>{pluralize(instructor.totalCourses, 'course', 'courses')} · {pluralize(instructor.totalStudents, 'learner', 'learners')}</Text></View></View>) : <EmptyCard title="No verified tutors" detail="Verified instructor profiles will appear here." styles={styles} />)}
          </>
        ) : null}
        <Text style={styles.themeNote}>Theme: {isDark ? 'Dark' : 'Light'} · Payments are unavailable in this release.</Text>
      </ScrollView>
      </KeyboardSafeView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;
type QuickActionProps = { title: string; detail: string; icon: ReactElement; color: string; wide?: boolean; onPress: () => void; styles: Styles };
function QuickAction({ title, detail, icon, color, wide = false, onPress, styles }: QuickActionProps) {
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={[styles.quickAction, wide && styles.quickActionWide, { backgroundColor: color }]}>{icon}<Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickDetail}>{detail}</Text></TouchableOpacity>;
}
type EmptyCardProps = { title: string; detail: string; styles: Styles };
function EmptyCard({ title, detail, styles }: EmptyCardProps) { return <View style={styles.emptyCard}><BookOpen size={28} color={styles.muted.color} /><Text style={styles.cardTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>; }

const createStyles = (colors: AppThemeColors, width: number) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 16, paddingBottom: 48, gap: 16 },
  hero: { minHeight: 150, borderRadius: 24, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#047857' },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 }, eyebrow: { color: '#a7f3d0', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, heroTitle: { color: '#ffffff', fontSize: width < 360 ? 22 : 26, fontWeight: '900', marginTop: 4 }, heroText: { color: '#d1fae5', fontSize: 13, lineHeight: 19, marginTop: 5 },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 }, quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickAction: { flexGrow: 1, flexBasis: '46%', maxWidth: '49%', minHeight: 112, borderRadius: 18, padding: 15, justifyContent: 'flex-end' }, quickActionWide: { flexBasis: '100%', maxWidth: '100%' }, quickTitle: { color: '#ffffff', fontWeight: '900', fontSize: 16, marginTop: 9 }, quickDetail: { color: 'rgba(255,255,255,0.86)', fontSize: 12, marginTop: 2 },
  center: { alignItems: 'center', paddingVertical: 44, gap: 12 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, count: { color: colors.accentText, backgroundColor: colors.successSurface, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 16, gap: 7 }, errorCard: { backgroundColor: colors.destructiveSurface, borderRadius: 17, padding: 18, gap: 10 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 }, meta: { color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 18 }, retryText: { color: colors.onAccent, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderRadius: 15, padding: 4, backgroundColor: colors.control }, tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, activeTab: { backgroundColor: colors.selectedControl }, tabText: { color: colors.mutedText, fontWeight: '700' }, activeTabText: { color: colors.selectedText },
  courseCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 10 },
  courseImage: { width: 82, height: 82, borderRadius: 13, backgroundColor: colors.control }, imageFallback: { alignItems: 'center', justifyContent: 'center' }, courseCopy: { flex: 1, gap: 4 }, metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emptyCard: { minHeight: 145, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 20, gap: 7 },
  tutorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14 }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.control },
  topics: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topicsLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  topicChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  topicText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statValue: { color: colors.accentText, fontSize: 20, fontWeight: '900' },
  statLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  viewAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  viewAllText: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  themeNote: { color: colors.mutedText, fontSize: 11, textAlign: 'center', marginTop: 8 },
});
