import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { BookOpen, BookText, Calendar, ChevronRight, ClipboardCheck, GraduationCap, Library, Megaphone, PlayCircle, Presentation, Search, Users } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import CachedImage from '@/components/ui/CachedImage';
import UserAvatar from '@/components/ui/UserAvatar';
import ClassSchedule from '@/components/eLearning/schedule/ClassSchedule';
import { ELearningHubSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { CourseCard, ELearningEmptyState, ELEARNING_ACTION_GREEN, ELEARNING_GUTTER, ProgressBar, formatWhen, roundProgress } from '@/components/eLearning/ELearningParts';
import { lessonHref, pluralize } from '@/components/eLearning/course/workspaceHelpers';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useLearningOverview } from '@/lib/hooks/useLearningOverview';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService } from '@/lib/services/CourseService';
import { COURSE_MAIN_CATEGORIES, getSubcategories } from '@/lib/constants/courseCategories';
import type { CourseAnnouncement, Enrollment, InstructorProfile } from '@/lib/types/course';
import type { LucideIcon } from 'lucide-react-native';

type HubSection = 'courses' | 'schedule';
type Styles = ReturnType<typeof createStyles>;
type Shortcut = { key: string; label: string; hint: string; icon: LucideIcon; route: string };

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const COURSE_PREVIEW_COUNT = 6;
const TUTOR_PREVIEW_COUNT = 5;
const CONTINUE_THUMB_WIDTH = 96;
const CONTINUE_THUMB_HEIGHT = 54;

const catalogHref = (params: { category?: string; subcategory?: string; q?: string }): Href => {
  const query = Object.entries(params).filter(([, value]) => Boolean(value)).map(([key, value]) => `${key}=${encodeURIComponent(value ?? '')}`).join('&');
  return (query ? `/eLearning/courses?${query}` : '/eLearning/courses') as Href;
};

/**
 * The E-Learning hub, learner first: search, the course to continue, shortcuts (My learning, all courses, CXC revision,
 * the instructor workspace), real course announcements, then courses by category and verified instructors. Everything
 * shown comes from Firestore; sections with nothing in them are left out instead of being filled with sample content.
 * No stock photos or carousels, so it opens quickly on a slow connection.
 */
export default function ELearningScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeUserId } = useAppData();
  const { data, instructorStatus, loading, refreshing, error, refresh } = useLearningOverview();
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<HubSection>('courses');
  const [category, setCategory] = useState('All');
  const [subcategory, setSubcategory] = useState('');
  const [showAllTutors, setShowAllTutors] = useState(false);
  const courses = useMemo(() => data?.courses ?? [], [data?.courses]);
  const enrollments = data?.enrollments ?? new Map<string, Enrollment>();
  const isInstructor = instructorStatus !== 'none';
  const continueItem = data ? courseService.continueLearning(courses, data.enrollments) : null;
  const activeEnrollmentCount = [...enrollments.values()].filter((enrollment) => enrollment.status === 'active' || enrollment.status === 'completed').length;

  // Only categories that have courses get a chip, so no chip leads to an empty list.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    courses.forEach((course) => counts.set(course.category, (counts.get(course.category) ?? 0) + 1));
    const known = (COURSE_MAIN_CATEGORIES as readonly string[]).filter((name) => counts.has(name));
    const other = [...counts.keys()].filter((name) => !known.includes(name)).sort((left, right) => left.localeCompare(right));
    return [...known, ...other].map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [courses]);
  const subcategories = category === 'All' ? [] : getSubcategories(category).filter((name) => courses.some((course) => course.category === category && course.subcategory === name));
  const filtered = courses.filter((course) => (category === 'All' || course.category === category) && (!subcategory || course.subcategory === subcategory));

  const shortcuts: Shortcut[] = [
    { key: 'mine', label: 'My learning', hint: activeEnrollmentCount ? pluralize(activeEnrollmentCount, 'course', 'courses') : 'Your courses', icon: PlayCircle, route: '/eLearning/my-learning' },
    { key: 'all', label: 'All courses', hint: courses.length ? pluralize(courses.length, 'course', 'courses') : 'Catalog', icon: Library, route: '/eLearning/courses' },
    { key: 'cxc', label: 'CXC revision', hint: 'CSEC and CAPE', icon: BookText, route: '/eLearning/cxc' },
    isInstructor
      ? { key: 'teach', label: 'Instructor', hint: 'Courses and grading', icon: Presentation, route: '/eLearning/instructor' }
      : { key: 'teach', label: 'Teach', hint: 'Become an instructor', icon: GraduationCap, route: '/eLearning/instructor' },
  ];

  const handleSearch = () => router.push(catalogHref({ q: search.trim() }));
  const handleOpenCourse = (courseId: string) => router.push(`/eLearning/courses/${encodeURIComponent(courseId)}` as Href);
  const handleCategory = (next: string) => { setCategory(next); setSubcategory(''); };

  return (
    <View style={styles.screen}>
      <PageHeader title="E-Learning" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.screen}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.accent} />}
          contentContainerStyle={styles.content}
        >
          <View style={styles.searchBox}>
            <Search size={18} color={colors.mutedText} />
            <TextInput
              accessibilityLabel="Search courses"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              placeholder="Search courses"
              placeholderTextColor={colors.mutedText}
              numberOfLines={1}
              style={styles.searchInput}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={handleSearch} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.searchButton}>
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          </View>

          {loading ? <ELearningHubSkeleton /> : error ? (
            <ELearningEmptyState icon={<BookOpen size={40} color={colors.mutedText} />} title="E-Learning could not load" hint={error} actionLabel="Try again" onAction={() => void refresh(true)} />
          ) : data ? (
            <>
              {continueItem ? (
                <View style={styles.card}>
                  <Text style={styles.eyebrow}>Continue learning</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${continueItem.course.title}`} onPress={() => handleOpenCourse(continueItem.course.id)} android_ripple={RIPPLE} style={styles.continueRow}>
                    <View style={styles.continueThumb}>
                      {continueItem.course.thumbnail || continueItem.course.image
                        ? <CachedImage uri={continueItem.course.thumbnail || continueItem.course.image} style={{ width: CONTINUE_THUMB_WIDTH, height: CONTINUE_THUMB_HEIGHT }} />
                        : <BookOpen size={22} color={colors.mutedText} />}
                    </View>
                    <View style={styles.flex}>
                      <Text numberOfLines={2} style={styles.continueTitle}>{continueItem.course.title}</Text>
                      <Text numberOfLines={1} style={styles.muted}>{roundProgress(continueItem.enrollment.progress)}% complete · {continueItem.course.instructor.name}</Text>
                    </View>
                  </Pressable>
                  <ProgressBar value={continueItem.enrollment.progress} accessibilityLabel={`${continueItem.course.title} progress`} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`${continueItem.enrollment.progress > 0 ? 'Resume' : 'Start'} ${continueItem.course.title}`} onPress={() => router.push(lessonHref(continueItem.course.id))} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.primaryButton}>
                    <PlayCircle size={18} color="#ffffff" />
                    <Text numberOfLines={1} style={styles.primaryButtonText}>{continueItem.enrollment.progress > 0 ? 'Resume where you left off' : 'Start the first lesson'}</Text>
                  </Pressable>
                </View>
              ) : activeEnrollmentCount === 0 ? (
                <View style={styles.card}>
                  <Text accessibilityRole="header" style={styles.sectionTitle}>Learn at your own pace</Text>
                  <Text style={styles.muted}>Enroll in a free course and your progress, quizzes and grades are kept here. Lessons work on mobile data; videos only load when you press play.</Text>
                </View>
              ) : null}

              <View style={styles.shortcutGrid}>
                {shortcuts.map(({ key, label, hint, icon: Icon, route }) => (
                  <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label}, ${hint}`} onPress={() => router.push(route as Href)} android_ripple={RIPPLE} style={styles.shortcut}>
                    <Icon size={20} color={colors.accentText} />
                    <View style={styles.flex}>
                      <Text numberOfLines={1} style={styles.shortcutLabel}>{label}</Text>
                      <Text numberOfLines={1} style={styles.shortcutHint}>{hint}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              {isInstructor ? (
                <Pressable accessibilityRole="button" onPress={() => router.push('/eLearning/instructor/grading' as Href)} android_ripple={RIPPLE} style={styles.linkRow}>
                  <ClipboardCheck size={18} color={colors.icon} />
                  <Text numberOfLines={1} style={[styles.linkRowText, styles.flex]}>Grade your learners' work</Text>
                  <ChevronRight size={18} color={colors.mutedText} />
                </Pressable>
              ) : null}

              {data.announcements.length > 0 ? <Announcements announcements={data.announcements} width={width} onOpen={handleOpenCourse} styles={styles} colors={colors} /> : null}

              <View accessibilityRole="tablist" style={styles.segment}>
                {([['courses', 'Courses', BookOpen], ['schedule', 'My schedule', Calendar]] as const).map(([id, label, Icon]) => {
                  const isActive = section === id;
                  return (
                    <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: isActive }} onPress={() => setSection(id)} android_ripple={RIPPLE} style={[styles.segmentItem, isActive && styles.segmentItemActive]}>
                      <Icon size={16} color={isActive ? '#ffffff' : colors.secondaryText} />
                      <Text numberOfLines={1} style={[styles.segmentText, isActive && styles.segmentTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {section === 'schedule' ? (
                <View style={styles.card}><ClassSchedule userId={activeUserId} /></View>
              ) : courses.length === 0 ? (
                <ELearningEmptyState
                  icon={<BookOpen size={40} color={colors.mutedText} />}
                  title="No courses published yet"
                  hint={isInstructor ? 'Your published courses will be the first ones here.' : 'Courses appear here as instructors publish them.'}
                  actionLabel={isInstructor ? 'Open the instructor workspace' : undefined}
                  onAction={isInstructor ? () => router.push('/eLearning/instructor' as Href) : undefined}
                />
              ) : (
                <View style={styles.coursesBlock}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
                    {[{ name: 'All', count: courses.length }, ...categories].map((item) => (
                      <CategoryChip key={item.name} label={`${item.name} (${item.count})`} isSelected={category === item.name} onPress={() => handleCategory(item.name)} styles={styles} />
                    ))}
                  </ScrollView>
                  {subcategories.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {['', ...subcategories].map((item) => (
                        <CategoryChip key={item || 'all'} label={item || `All ${category}`} isSelected={subcategory === item} onPress={() => setSubcategory(item)} styles={styles} isSecondary />
                      ))}
                    </ScrollView>
                  ) : null}
                  {filtered.slice(0, COURSE_PREVIEW_COUNT).map((course) => (
                    <CourseCard key={course.id} course={course} width={width - ELEARNING_GUTTER * 2} enrollment={enrollments.get(course.id) ?? null} onOpen={handleOpenCourse} />
                  ))}
                  {filtered.length > COURSE_PREVIEW_COUNT || category !== 'All' ? (
                    <Pressable accessibilityRole="link" onPress={() => router.push(catalogHref({ category: category === 'All' ? undefined : category, subcategory }))} android_ripple={RIPPLE} style={styles.outlineButton}>
                      <Text style={styles.outlineButtonText}>{filtered.length > COURSE_PREVIEW_COUNT ? `See all ${filtered.length} courses` : 'Filter and sort in the catalog'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}

              {section === 'courses' && data.instructors.length > 0 ? (
                <Tutors instructors={data.instructors} showAll={showAllTutors} onToggle={() => setShowAllTutors((current) => !current)} styles={styles} colors={colors} />
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardSafeView>
    </View>
  );
}

type CategoryChipProps = { label: string; isSelected: boolean; onPress: () => void; styles: Styles; isSecondary?: boolean };

function CategoryChip({ label, isSelected, onPress, styles, isSecondary = false }: CategoryChipProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={onPress} android_ripple={RIPPLE} style={[styles.chip, isSecondary && styles.chipSecondary, isSelected && styles.chipSelected]}>
      <Text numberOfLines={1} style={[styles.chipText, isSelected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

type AnnouncementsProps = { announcements: CourseAnnouncement[]; width: number; onOpen: (courseId: string) => void; styles: Styles; colors: AppThemeColors };

/** Announcements instructors posted in the learner's courses (only shown when there are some). */
function Announcements({ announcements, width, onOpen, styles, colors }: AnnouncementsProps) {
  const cardWidth = Math.round((width - ELEARNING_GUTTER * 2) * 0.86);
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <Megaphone size={18} color={colors.icon} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>Course announcements</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast" contentContainerStyle={styles.chipRow}>
        {announcements.slice(0, 6).map((announcement) => (
          <Pressable key={announcement.id} accessibilityRole="button" accessibilityLabel={`${announcement.important ? 'Important: ' : ''}${announcement.title}, from ${announcement.authorName}`} onPress={() => onOpen(announcement.courseId)} android_ripple={RIPPLE} style={[styles.announcement, { width: cardWidth }]}>
            {announcement.important ? <Text style={styles.importantPill}>Important</Text> : null}
            <Text numberOfLines={2} style={styles.announcementTitle}>{announcement.title}</Text>
            <Text numberOfLines={3} style={styles.muted}>{announcement.body}</Text>
            <Text numberOfLines={1} style={styles.meta}>{[announcement.authorName, formatWhen(announcement.createdAt)].filter(Boolean).join(' · ')}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

type TutorsProps = { instructors: InstructorProfile[]; showAll: boolean; onToggle: () => void; styles: Styles; colors: AppThemeColors };

/** Verified instructors. Counts and ratings appear only when they are recorded, so nobody reads "0.0 · 0 courses". */
function Tutors({ instructors, showAll, onToggle, styles, colors }: TutorsProps) {
  const visible = showAll ? instructors : instructors.slice(0, TUTOR_PREVIEW_COUNT);
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeaderRow}>
        <Users size={18} color={colors.icon} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>Instructors</Text>
      </View>
      {visible.map((instructor) => {
        const facts = [
          instructor.totalCourses > 0 ? pluralize(instructor.totalCourses, 'course', 'courses') : null,
          instructor.totalStudents > 0 ? pluralize(instructor.totalStudents, 'learner', 'learners') : null,
          instructor.rating > 0 ? `★ ${instructor.rating.toFixed(1)}` : null,
        ].filter(Boolean).join(' · ');
        return (
          <View key={instructor.id} accessible accessibilityLabel={[instructor.name, instructor.specialties.join(', '), facts].filter(Boolean).join(', ')} style={styles.tutorRow}>
            <UserAvatar profileImage={instructor.avatar} firstName={instructor.name} size={44} />
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.tutorName}>{instructor.name}</Text>
              <Text numberOfLines={1} style={styles.muted}>{instructor.specialties.join(', ') || 'Verified instructor'}</Text>
              {facts ? <Text numberOfLines={1} style={styles.meta}>{facts}</Text> : null}
            </View>
          </View>
        );
      })}
      {instructors.length > TUTOR_PREVIEW_COUNT ? (
        <Pressable accessibilityRole="button" onPress={onToggle} android_ripple={RIPPLE} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>{showAll ? 'Show fewer' : `Show all ${instructors.length}`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: ELEARNING_GUTTER, paddingBottom: 40, gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  meta: { color: colors.mutedText, fontSize: 12 },
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { padding: 16, gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  sectionBlock: { gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },

  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  searchInput: { flex: 1, minWidth: 0, minHeight: 44, color: colors.text, fontSize: 15, paddingVertical: 0 },
  searchButton: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 10, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  searchButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  continueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, overflow: 'hidden' },
  continueThumb: { width: CONTINUE_THUMB_WIDTH, height: CONTINUE_THUMB_HEIGHT, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  continueTitle: { color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  primaryButton: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  primaryButtonText: { flexShrink: 1, color: '#ffffff', fontSize: 15, fontWeight: '800' },

  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcut: { flexGrow: 1, flexBasis: '45%', minWidth: 0, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  shortcutLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  shortcutHint: { color: colors.mutedText, fontSize: 12, marginTop: 1 },
  linkRow: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, backgroundColor: colors.control, overflow: 'hidden', marginTop: -8 },
  linkRowText: { color: colors.text, fontSize: 14, fontWeight: '700' },

  announcement: { padding: 14, gap: 6, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  announcementTitle: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  importantPill: { alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.warningSurface, color: colors.warningText, fontSize: 12, fontWeight: '700' },

  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  segmentItem: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 8, overflow: 'hidden' },
  segmentItemActive: { backgroundColor: ELEARNING_ACTION_GREEN },
  segmentText: { color: colors.secondaryText, fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: '#ffffff' },

  coursesBlock: { gap: 12 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  chipSecondary: { backgroundColor: colors.control, borderColor: colors.control },
  chipSelected: { backgroundColor: ELEARNING_ACTION_GREEN, borderColor: ELEARNING_ACTION_GREEN },
  chipText: { color: colors.secondaryText, fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: '#ffffff', fontWeight: '700' },
  outlineButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  outlineButtonText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },

  tutorRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tutorName: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
