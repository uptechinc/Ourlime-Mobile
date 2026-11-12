import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BookOpen, BookText, CheckCircle, ClipboardCheck, Clock, FolderOpen, GraduationCap, Library, Megaphone, MessageSquare,
  PenSquare, PlayCircle, Presentation, Search, Star, Users,
} from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import CategoryBrowser from '@/components/eLearning/course/CategoryBrowser';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useLearningOverview } from '@/lib/hooks/useLearningOverview';
import { useProfileResource } from '@/lib/hooks/useProfileResource';
import { AuthService } from '@/lib/services/AuthService';
import { COURSE_MAIN_CATEGORIES, getSubcategories } from '@/lib/constants/courseCategories';
import { ELearningHomeContentSkeleton, ELearningInlineStatsSkeleton } from '@/components/eLearning/ELearningSkeletons';
import type { Course, CourseAnnouncement, InstructorProfile } from '@/lib/types/course';

/** Web app/eLearning/page.tsx as it renders on a phone: welcome card, hero + search, course updates, tabbed materials. */
type LearningTab = 'materials' | 'resources' | 'tutors';
type Styles = ReturnType<typeof createStyles>;

const GREEN = '#10b981';
const POPULAR_TOPIC_COUNT = 3;
const COURSE_PREVIEW_COUNT = 9;
const UPDATE_PREVIEW_COUNT = 6;
const TUTOR_PREVIEW_COUNT = 5;
const SLIDE_INTERVAL_MS = 5000;
const authService = AuthService.getInstance();

// Web components/eLearning/heroSection slides (images, copy and green gradient overlays).
const HERO_SLIDES = [
  { image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=900&q=70', title: 'Welcome to Limes Academy', subtitle: 'Start your learning journey today', gradient: ['rgba(16,185,129,0.9)', 'rgba(34,197,94,0.72)', 'rgba(74,222,128,0.54)'] },
  { image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&q=70', title: 'Learn from the Best', subtitle: 'Expert instructors to guide your path', gradient: ['rgba(22,163,74,0.9)', 'rgba(16,185,129,0.72)', 'rgba(74,222,128,0.63)'] },
  { image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&q=70', title: 'Grow Your Skills', subtitle: 'Discover new opportunities', gradient: ['rgba(16,185,129,0.9)', 'rgba(74,222,128,0.72)', 'rgba(134,239,172,0.54)'] },
] as const;

const TABS: { id: LearningTab; label: string; icon: typeof BookOpen }[] = [
  { id: 'materials', label: 'Learning Materials', icon: BookOpen },
  { id: 'resources', label: 'Resources', icon: FolderOpen },
  { id: 'tutors', label: 'Tutors', icon: Users },
];

const catalogHref = (params: { category?: string; subcategory?: string; q?: string }): Href => {
  const query = Object.entries(params).filter(([, value]) => Boolean(value)).map(([key, value]) => `${key}=${encodeURIComponent(value ?? '')}`).join('&');
  return (query ? `/eLearning/courses?${query}` : '/eLearning/courses') as Href;
};

/** Web courseMessages formatAge. */
const formatAge = (createdAt?: string): string => {
  if (!createdAt) return '';
  const time = new Date(createdAt).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(time).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
};

const formatPrice = (price: number): string => `$${price.toFixed(2)}`;

export default function ELearningScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, instructorStatus, loading, refreshing, error, refresh } = useLearningOverview();
  const user = authService.getCurrentUser();
  const { resource: profileResource } = useProfileResource({ kind: 'own', userId: user?.uid ?? '' });
  const profile = profileResource.data?.profile;
  const isInstructor = instructorStatus !== 'none';
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<LearningTab>('materials');
  const [category, setCategory] = useState('All');
  const [subcategory, setSubcategory] = useState('');
  const [showAllTutors, setShowAllTutors] = useState(false);
  const allCourses = useMemo(() => data?.courses ?? [], [data?.courses]);

  const popularTopics = useMemo(() => {
    const counts = new Map<string, number>();
    allCourses.forEach((course) => counts.set(course.category, (counts.get(course.category) ?? 0) + 1));
    return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, POPULAR_TOPIC_COUNT).map(([topic]) => topic);
  }, [allCourses]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allCourses.forEach((course) => counts.set(course.category, (counts.get(course.category) ?? 0) + 1));
    return counts;
  }, [allCourses]);

  const subcategories = category === 'All' ? [] : getSubcategories(category);
  const filteredCourses = allCourses.filter((course) => (category === 'All' || course.category === category) && (!subcategory || course.subcategory === subcategory));

  const handleSearchSubmit = () => { router.push(catalogHref({ q: search.trim() })); };
  const handleSelectCategory = (next: string) => { setCategory(next); setSubcategory(''); };
  const handleOpenCourse = (courseId: string) => { router.push(('/eLearning/courses/' + courseId) as Href); };

  const quickLinks: { label: string; icon: typeof BookOpen; route: string }[] = [
    { label: 'Courses', icon: Library, route: '/eLearning/courses' },
    { label: 'My Learning', icon: PlayCircle, route: '/eLearning/my-learning' },
    { label: 'CXC Hub', icon: BookText, route: '/eLearning/cxc' },
    ...(isInstructor ? [
      { label: 'Create Course', icon: PenSquare, route: '/eLearning/instructor/create' },
      { label: 'Instructor', icon: Presentation, route: '/eLearning/instructor' },
      { label: 'Grading', icon: ClipboardCheck, route: '/eLearning/instructor' },
    ] : []),
  ];

  return (
    <View style={styles.screen}>
      <PageHeader title="E-Learning" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.screen}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.accent} />}
          contentContainerStyle={styles.content}
        >
          {profile ? (
            <View style={styles.card}>
              <View style={styles.welcomeRow}>
                {profile.profilePicture ? <Image source={{ uri: profile.profilePicture }} style={styles.welcomeAvatar} /> : (
                  <View style={[styles.welcomeAvatar, styles.initialAvatar]}><Text style={styles.initialText}>{(profile.firstName || profile.userName || '?').charAt(0).toUpperCase()}</Text></View>
                )}
                <View style={styles.flexCopy}>
                  <Text numberOfLines={1} style={styles.welcomeTitle}>Welcome back, {profile.firstName || profile.userName}</Text>
                  <Text numberOfLines={1} style={styles.muted}>@{profile.userName} · Pick up where you left off</Text>
                </View>
              </View>
              <View style={styles.welcomeStatsRow}>
                {data ? (
                  <View style={styles.inlineStats}>
                    <InlineStat value={String(data.stats.totalCourses)} label="Courses" styles={styles} />
                    <InlineStat value={data.stats.totalLearners.toLocaleString()} label="Learners" styles={styles} />
                    <InlineStat value={data.stats.averageRating.toFixed(1)} label="Avg rating" styles={styles} />
                  </View>
                ) : <ELearningInlineStatsSkeleton />}
                {!loading && !isInstructor ? (
                  <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/eLearning/instructor' as Href)} style={styles.becomeInstructor}>
                    <GraduationCap size={16} color="#ffffff" />
                    <Text style={styles.becomeInstructorText}>Become an instructor</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickLinksDivider} contentContainerStyle={styles.chipRow}>
                {quickLinks.map(({ label, icon: Icon, route }) => (
                  <TouchableOpacity key={label} accessibilityRole="link" onPress={() => router.push(route as Href)} style={styles.quickChip}>
                    <Icon size={16} color={colors.secondaryText} />
                    <Text style={styles.quickChipText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={[styles.card, styles.heroCard]}>
            <HeroBanner width={width - 32} styles={styles} surfaceColor={colors.surface} />
            <View style={styles.heroSearchArea}>
              <View style={styles.searchPill}>
                <Search size={18} color={colors.mutedText} />
                <TextInput value={search} onChangeText={setSearch} onSubmitEditing={handleSearchSubmit} returnKeyType="search" placeholder="Search courses or topics" placeholderTextColor={colors.mutedText} style={styles.searchInput} />
                <TouchableOpacity accessibilityRole="button" onPress={handleSearchSubmit} style={styles.searchButton}><Text style={styles.searchButtonText}>Search</Text></TouchableOpacity>
              </View>
              {popularTopics.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.popularRow}>
                  <Text style={styles.popularLabel}>Popular:</Text>
                  {popularTopics.map((topic) => (
                    <TouchableOpacity key={topic} accessibilityRole="link" onPress={() => router.push(catalogHref({ category: topic }))} style={styles.popularChip}>
                      <Text style={styles.popularChipText}>{topic}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          </View>

          {loading ? <ELearningHomeContentSkeleton /> : null}
          {!loading && error ? (
            <View style={styles.errorCard}>
              <Text style={styles.cardTitle}>E-Learning could not load</Text>
              <Text style={styles.muted}>{error}</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => void refresh(true)} style={styles.primaryPill}><Text style={styles.primaryPillText}>Try Again</Text></TouchableOpacity>
            </View>
          ) : null}

          {!loading && !error && data ? (
            <>
              <CourseUpdates announcements={data.announcements} cardWidth={(width - 64) * 0.85} onOpen={handleOpenCourse} styles={styles} colors={colors} />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {TABS.map(({ id, label, icon: Icon }) => {
                  const isActive = tab === id;
                  return (
                    <TouchableOpacity key={id} accessibilityRole="tab" accessibilityState={{ selected: isActive }} onPress={() => setTab(id)} style={[styles.tabChip, isActive && styles.tabChipActive]}>
                      <Icon size={16} color={isActive ? colors.canvas : colors.secondaryText} />
                      <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {tab === 'materials' ? (
                <View style={[styles.card, styles.materialsCard]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {['All', ...COURSE_MAIN_CATEGORIES].map((item) => {
                      const isActive = category === item;
                      const count = item === 'All' ? allCourses.length : categoryCounts.get(item) ?? 0;
                      return (
                        <TouchableOpacity key={item} onPress={() => handleSelectCategory(item)} style={[styles.categoryPill, isActive && styles.categoryPillActive]}>
                          <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>{item} ({count})</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  {subcategories.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, styles.subcategoryRow]}>
                      {['', ...subcategories].map((item) => {
                        const isActive = subcategory === item;
                        const count = allCourses.filter((course) => course.category === category && (!item || course.subcategory === item)).length;
                        return (
                          <TouchableOpacity key={item || 'all'} onPress={() => setSubcategory(item)} style={[styles.subcategoryChip, isActive && styles.subcategoryChipActive]}>
                            <Text style={[styles.subcategoryText, isActive && styles.subcategoryTextActive]}>{item || `All ${category}`} ({count})</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                  <View style={styles.divider} />
                  {filteredCourses.length ? (
                    <View style={styles.courseList}>
                      {filteredCourses.slice(0, COURSE_PREVIEW_COUNT).map((course) => <CourseCard key={course.id} course={course} onOpen={handleOpenCourse} styles={styles} colors={colors} />)}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <BookOpen size={28} color={colors.mutedText} />
                      <Text style={styles.cardTitle}>No courses found</Text>
                      <Text style={[styles.muted, styles.centerText]}>Try selecting a different category or subcategory</Text>
                    </View>
                  )}
                  {filteredCourses.length > COURSE_PREVIEW_COUNT ? (
                    <TouchableOpacity accessibilityRole="link" onPress={() => router.push(catalogHref({ category: category === 'All' ? undefined : category, subcategory }))} style={styles.viewAllButton}>
                      <Text style={styles.viewAllText}>View all {filteredCourses.length} courses</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {tab === 'resources' ? (
                <View style={styles.card}>
                  <CategoryBrowser
                    courses={allCourses}
                    onOpenCategory={(nextCategory, nextSubcategory) => router.push(catalogHref({ category: nextCategory, subcategory: nextSubcategory }))}
                    onOpenCxc={() => router.push('/eLearning/cxc' as Href)}
                  />
                </View>
              ) : null}

              {tab === 'tutors' ? (
                <TutorList instructors={data.instructors} showAll={showAllTutors} onToggleShowAll={() => setShowAllTutors((current) => !current)} styles={styles} colors={colors} />
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardSafeView>
    </View>
  );
}

type InlineStatProps = { value: string; label: string; styles: Styles };
function InlineStat({ value, label, styles }: InlineStatProps) {
  return <View style={styles.inlineStat}><Text style={styles.inlineStatValue}>{value}</Text><Text style={styles.inlineStatLabel}>{label}</Text></View>;
}

type HeroBannerProps = { width: number; styles: Styles; surfaceColor: string };
/** Logo on the left; three crossfading photos with a green gradient and a slanted left edge on the right. */
function HeroBanner({ width, styles, surfaceColor }: HeroBannerProps) {
  const opacities = useRef(HERO_SLIDES.map((_slide, index) => new Animated.Value(index === 0 ? 1 : 0))).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const slideWidth = width * 0.75;

  useEffect(() => {
    const timer = setInterval(() => setActiveIndex((current) => (current + 1) % HERO_SLIDES.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Animated.parallel(opacities.map((opacity, index) => Animated.timing(opacity, { toValue: index === activeIndex ? 1 : 0, duration: 700, useNativeDriver: true }))).start();
  }, [activeIndex, opacities]);

  return (
    <View style={styles.heroBanner}>
      <View style={styles.heroLogo}>
        <Image source={require('@/assets/images/limey-elearning.png')} style={styles.heroLogoImage} resizeMode="contain" />
        <Text style={styles.heroLogoCaption}>e-Learning</Text>
      </View>
      <View style={[styles.heroSlides, { width: slideWidth }]}>
        {HERO_SLIDES.map((slide, index) => (
          <Animated.View key={slide.title} style={[StyleSheet.absoluteFill, { opacity: opacities[index] }]}>
            <Image source={{ uri: slide.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient colors={[...slide.gradient]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            <View style={[styles.heroSlideCopy, { paddingLeft: slideWidth * 0.28 }]}>
              <Text numberOfLines={1} style={styles.heroSlideTitle}>{slide.title}</Text>
              <Text numberOfLines={1} style={styles.heroSlideSubtitle}>{slide.subtitle}</Text>
            </View>
          </Animated.View>
        ))}
        {/* clipPath polygon(25% 0, 100% 0, 100% 100%, 0 100%): cover the top-left triangle with the card colour. */}
        <View style={[styles.heroSlant, { borderTopColor: surfaceColor, borderRightWidth: slideWidth * 0.25 }]} />
      </View>
    </View>
  );
}

type CourseUpdatesProps = { announcements: CourseAnnouncement[]; cardWidth: number; onOpen: (courseId: string) => void; styles: Styles; colors: AppThemeColors };
function CourseUpdates({ announcements, cardWidth, onOpen, styles, colors }: CourseUpdatesProps) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}><MessageSquare size={20} color={GREEN} /><Text style={styles.sectionTitle}>Course updates</Text></View>
        <Text style={styles.countBadge}>{announcements.length} {announcements.length === 1 ? 'update' : 'updates'}</Text>
      </View>
      {announcements.length === 0 ? (
        <View style={styles.updatesEmpty}>
          <Megaphone size={20} color={colors.mutedText} />
          <Text style={[styles.muted, styles.flexCopy]}>No course updates yet. Announcements from courses you join will appear here.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast" contentContainerStyle={styles.updatesRow}>
          {announcements.slice(0, UPDATE_PREVIEW_COUNT).map((announcement) => (
            <TouchableOpacity key={announcement.id} accessibilityRole="button" onPress={() => onOpen(announcement.courseId)} style={[styles.updateCard, { width: cardWidth }]}>
              <View style={styles.updateAuthorRow}>
                {announcement.authorAvatar ? <Image source={{ uri: announcement.authorAvatar }} style={styles.updateAvatar} /> : (
                  <View style={[styles.updateAvatar, styles.updateAvatarFallback]}><Text style={styles.updateAvatarText}>{(announcement.authorName || '?').charAt(0).toUpperCase()}</Text></View>
                )}
                <View style={styles.flexCopy}>
                  <Text numberOfLines={1} style={styles.updateAuthor}>{announcement.authorName || 'Instructor'}</Text>
                  {formatAge(announcement.createdAt) ? <Text style={styles.meta}>{formatAge(announcement.createdAt)}</Text> : null}
                </View>
              </View>
              {announcement.important ? <Text style={styles.importantPill}>Important</Text> : null}
              <Text numberOfLines={1} style={styles.updateTitle}>{announcement.title}</Text>
              <Text numberOfLines={2} style={styles.muted}>{announcement.body}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

type CourseCardProps = { course: Course; onOpen: (courseId: string) => void; styles: Styles; colors: AppThemeColors };
function CourseCard({ course, onOpen, styles, colors }: CourseCardProps) {
  const image = course.thumbnail || course.image;
  return (
    <TouchableOpacity accessibilityRole="button" onPress={() => onOpen(course.id)} style={styles.courseCard}>
      <View style={styles.courseImageWrap}>
        {image ? <Image source={{ uri: image }} style={styles.courseImage} resizeMode="cover" /> : <View style={[styles.courseImage, styles.courseImageFallback]}><BookOpen size={30} color={colors.mutedText} /></View>}
        <Text style={styles.levelBadge}>{course.level}</Text>
      </View>
      <View style={styles.courseBody}>
        <Text numberOfLines={2} style={styles.courseTitle}>{course.title}</Text>
        <Text numberOfLines={1} style={styles.courseInstructor}>by {course.instructor.name}</Text>
        <View style={styles.courseMetaRow}>
          <View style={styles.metaItem}><Star size={14} color="#facc15" fill="#facc15" /><Text style={styles.meta}>{course.rating.toFixed(1)} ({course.totalRatings} {course.totalRatings === 1 ? 'rating' : 'ratings'})</Text></View>
          <View style={styles.metaItem}><Clock size={14} color={colors.mutedText} /><Text style={styles.meta}>{course.duration} {course.duration === 1 ? 'hour' : 'hours'}</Text></View>
        </View>
        <View style={styles.courseFooter}>
          {course.price === 0 ? (
            <View style={styles.metaItem}><CheckCircle size={15} color={GREEN} /><Text style={styles.freeText}>Free</Text></View>
          ) : <Text style={styles.priceText}>{formatPrice(course.price)}</Text>}
          <View style={styles.viewCourseButton}><Text style={styles.viewCourseText}>View Course</Text></View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

type TutorListProps = { instructors: InstructorProfile[]; showAll: boolean; onToggleShowAll: () => void; styles: Styles; colors: AppThemeColors };
function TutorList({ instructors, showAll, onToggleShowAll, styles, colors }: TutorListProps) {
  const visible = showAll ? instructors : instructors.slice(0, TUTOR_PREVIEW_COUNT);
  return (
    <View style={styles.card}>
      <View style={styles.sectionTitleRow}><Users size={20} color={GREEN} /><Text style={styles.sectionTitle}>Tutors</Text></View>
      {instructors.length === 0 ? <Text style={[styles.muted, styles.tutorEmpty]}>Verified instructor profiles will appear here.</Text> : (
        <View style={styles.tutorList}>
          {visible.map((instructor) => (
            <View key={instructor.id} style={styles.tutorRow}>
              {instructor.avatar ? <Image source={{ uri: instructor.avatar }} style={styles.tutorAvatar} /> : (
                <View style={[styles.tutorAvatar, styles.tutorAvatarFallback]}><Text style={styles.updateAvatarText}>{(instructor.name || '?').charAt(0).toUpperCase()}</Text></View>
              )}
              <View style={styles.flexCopy}>
                <Text numberOfLines={1} style={styles.cardTitle}>{instructor.name}</Text>
                <Text numberOfLines={1} style={styles.muted}>{instructor.specialties.join(', ') || 'Instructor'}</Text>
                <Text style={styles.meta}>★ {instructor.rating.toFixed(1)} · {instructor.totalCourses} {instructor.totalCourses === 1 ? 'course' : 'courses'} · {instructor.totalStudents} {instructor.totalStudents === 1 ? 'learner' : 'learners'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {instructors.length > TUTOR_PREVIEW_COUNT ? (
        <TouchableOpacity accessibilityRole="button" onPress={onToggleShowAll} style={styles.viewAllButton}>
          <Text style={[styles.viewAllText, { color: colors.accentText }]}>{showAll ? 'Show fewer' : `Show all ${instructors.length}`}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  flexCopy: { flex: 1, minWidth: 0 },
  centerText: { textAlign: 'center' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  meta: { color: colors.mutedText, fontSize: 12 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  welcomeAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.control },
  initialAvatar: { backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  welcomeTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  welcomeStatsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', rowGap: 12, columnGap: 16 },
  inlineStats: { flexDirection: 'row', gap: 20 },
  inlineStat: { alignItems: 'center' },
  inlineStatValue: { color: GREEN, fontSize: 16, fontWeight: '800' },
  inlineStatLabel: { color: colors.mutedText, fontSize: 12 },
  becomeInstructor: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  becomeInstructorText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  quickLinksDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 2 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, paddingHorizontal: 16, paddingVertical: 9 },
  quickChipText: { color: colors.secondaryText, fontSize: 14, fontWeight: '500' },

  heroCard: { padding: 0, gap: 0, overflow: 'hidden' },
  heroBanner: { height: 128, flexDirection: 'row', alignItems: 'center' },
  heroLogo: { width: 96, alignItems: 'center', paddingLeft: 12 },
  heroLogoImage: { width: 64, height: 64 },
  heroLogoCaption: { color: colors.mutedText, fontSize: 10, fontStyle: 'italic' },
  heroSlides: { position: 'absolute', right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  heroSlideCopy: { flex: 1, justifyContent: 'center', paddingRight: 24 },
  heroSlideTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  heroSlideSubtitle: { color: 'rgba(240,253,244,0.9)', fontSize: 12, marginTop: 4, maxWidth: 200 },
  heroSlant: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, borderTopWidth: 128, borderRightColor: 'transparent' },
  heroSearchArea: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16, gap: 12 },
  searchPill: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, paddingLeft: 16, paddingRight: 6 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
  searchButton: { height: 36, justifyContent: 'center', borderRadius: 999, backgroundColor: GREEN, paddingHorizontal: 16 },
  searchButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  popularRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  popularLabel: { color: colors.mutedText, fontSize: 12 },
  popularChip: { borderRadius: 999, backgroundColor: colors.successSurface, paddingHorizontal: 10, paddingVertical: 4 },
  popularChipText: { color: colors.accentText, fontSize: 12, fontWeight: '500' },

  errorCard: { backgroundColor: colors.destructiveSurface, borderRadius: 16, padding: 18, gap: 10 },
  primaryPill: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 18 },
  primaryPillText: { color: '#ffffff', fontWeight: '700' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  countBadge: { color: colors.accentText, backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, fontSize: 12, overflow: 'hidden' },
  updatesEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.control, borderRadius: 12, padding: 14 },
  updatesRow: { gap: 12 },
  updateCard: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, padding: 16, gap: 8 },
  updateAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  updateAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.successSurface },
  updateAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  updateAvatarText: { color: colors.accentText, fontWeight: '700' },
  updateAuthor: { color: colors.text, fontSize: 14, fontWeight: '600' },
  importantPill: { alignSelf: 'flex-start', backgroundColor: '#fef3c7', color: '#b45309', fontSize: 11, fontWeight: '600', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  updateTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },

  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tabChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  tabChipText: { color: colors.secondaryText, fontSize: 14, fontWeight: '500' },
  tabChipTextActive: { color: colors.canvas },

  materialsCard: { padding: 12 },
  categoryPill: { borderRadius: 999, backgroundColor: colors.control, paddingHorizontal: 16, paddingVertical: 9 },
  categoryPillActive: { backgroundColor: GREEN },
  categoryPillText: { color: colors.secondaryText, fontSize: 14, fontWeight: '500' },
  categoryPillTextActive: { color: '#ffffff' },
  subcategoryRow: { marginTop: -2 },
  subcategoryChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6 },
  subcategoryChipActive: { borderColor: GREEN, backgroundColor: colors.successSurface },
  subcategoryText: { color: colors.secondaryText, fontSize: 12 },
  subcategoryTextActive: { color: colors.accentText, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  courseList: { gap: 12 },
  courseCard: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, overflow: 'hidden' },
  courseImageWrap: { height: 128 },
  courseImage: { width: '100%', height: 128, backgroundColor: colors.border },
  courseImageFallback: { alignItems: 'center', justifyContent: 'center' },
  levelBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', color: '#111827', fontSize: 12, textTransform: 'capitalize', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  courseBody: { padding: 12 },
  courseTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  courseInstructor: { color: colors.mutedText, fontSize: 12, marginBottom: 10 },
  courseMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  courseFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  freeText: { color: GREEN, fontSize: 14, fontWeight: '600' },
  priceText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  viewCourseButton: { backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  viewCourseText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  viewAllButton: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: 'center' },
  viewAllText: { color: GREEN, fontSize: 14, fontWeight: '600' },

  tutorList: { gap: 14 },
  tutorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tutorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.successSurface },
  tutorAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  tutorEmpty: { paddingVertical: 8 },
});
