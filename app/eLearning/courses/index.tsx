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
import { useRouter, type Href } from 'expo-router';
import {
  ChevronLeft,
  Search,
  Star,
  Clock,
  Users,
  GraduationCap,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { courseService } from '@/lib/services/CourseService';
import type { Course } from '@/lib/types/course';

const CATEGORIES = ['All', 'Technology', 'CSEC Prep', 'Business', 'Languages', 'Science'];

export default function CoursesCatalogScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await courseService.getCourses(selectedCategory, search);
      setCourses(data);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, search]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const filteredCourses = useMemo(() => {
    if (selectedCategory === 'All') return courses;
    return courses.filter((c) => c.category === selectedCategory);
  }, [courses, selectedCategory]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Courses Catalog</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadCourses();
            }}
            tintColor="#10b981"
          />
        }
      >
        {/* Search Box */}
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.mutedText} />
          <TextInput
            placeholder="Search courses, topics, skills..."
            placeholderTextColor={colors.mutedText}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPills}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.categoryPill,
                selectedCategory === cat
                  ? { backgroundColor: '#10b981', borderColor: '#10b981' }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  { color: selectedCategory === cat ? '#ffffff' : colors.text },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Course List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={[styles.loadingText, { color: colors.mutedText }]}>Discovering courses...</Text>
          </View>
        ) : filteredCourses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <GraduationCap size={44} color={colors.mutedText} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No courses found in this category.</Text>
          </View>
        ) : (
          <View style={styles.coursesGrid}>
            {filteredCourses.map((course) => (
              <TouchableOpacity
                key={course.id}
                activeOpacity={0.85}
                onPress={() => router.push(`/eLearning/courses/${course.id}` as Href)}
                style={[styles.courseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Image
                  source={{ uri: course.image }}
                  style={styles.courseImage}
                  resizeMode="cover"
                />
                <View style={styles.cardContent}>
                  <View style={styles.badgeRow}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{course.category.toUpperCase()}</Text>
                    </View>
                    <View style={styles.levelBadge}>
                      <Text style={[styles.levelBadgeText, { color: colors.mutedText }]}>{course.level}</Text>
                    </View>
                  </View>

                  <Text style={[styles.courseTitle, { color: colors.text }]} numberOfLines={2}>
                    {course.title}
                  </Text>
                  <Text style={[styles.instructorText, { color: colors.mutedText }]}>
                    by {course.instructor.name}
                  </Text>

                  <View style={styles.cardMetaRow}>
                    <View style={styles.metaItem}>
                      <Star size={14} color="#f59e0b" fill="#f59e0b" />
                      <Text style={[styles.metaText, { color: colors.text }]}>
                        {course.rating} ({course.totalRatings})
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Clock size={14} color={colors.mutedText} />
                      <Text style={[styles.metaText, { color: colors.mutedText }]}>{course.duration}h</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Users size={14} color={colors.mutedText} />
                      <Text style={[styles.metaText, { color: colors.mutedText }]}>{course.enrolledStudents}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
    gap: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  categoryPills: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  coursesGrid: {
    gap: 16,
  },
  courseCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  courseImage: {
    width: '100%',
    height: 180,
  },
  cardContent: {
    padding: 16,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    backgroundColor: '#10b98122',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
  levelBadge: {
    paddingHorizontal: 6,
  },
  levelBadgeText: {
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  courseTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  instructorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
