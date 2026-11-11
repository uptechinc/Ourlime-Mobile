import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, ChevronDown, ChevronRight, Circle } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import CustomModal from '@/components/ui/CustomModal';
import { CourseDetailSkeleton } from '@/components/ui/Skeleton';
import LessonTypeIcon from '@/components/eLearning/course/LessonTypeIcon';
import ModuleResources from '@/components/eLearning/course/ModuleResources';
import WorkspaceScreenState from '@/components/eLearning/course/WorkspaceScreenState';
import { courseHref, lessonHref, pluralize } from '@/components/eLearning/course/workspaceHelpers';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useCourseWorkspace } from '@/lib/hooks/useCourseWorkspace';
import { isActiveEnrollment } from '@/lib/services/CourseService';

/** Course modules with per-module completion, lessons and resources (web /eLearning/courses/[id]/modules). */
export default function CourseModulesScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { workspace, loading, refreshing, error, refresh } = useCourseWorkspace(id);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [openError, setOpenError] = useState(false);
  const modules = useMemo(() => workspace?.modules ?? [], [workspace]);
  const enrollment = workspace?.enrollment ?? null;
  const completed = new Set(enrollment?.completedLessons ?? []);
  const lessonCount = modules.reduce((total, courseModule) => total + (courseModule.lessons?.length ?? 0), 0);

  useEffect(() => {
    if (modules.length > 0) setExpanded((current) => (current.length ? current : [modules[0].id]));
  }, [modules]);

  const toggle = (moduleId: string) => setExpanded((current) => current.includes(moduleId) ? current.filter((item) => item !== moduleId) : [...current, moduleId]);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Modules" onBackPress={() => router.back()} />
      {loading ? (
        <ScrollView contentContainerStyle={styles.padded}><CourseDetailSkeleton /></ScrollView>
      ) : !workspace || !isActiveEnrollment(enrollment) ? (
        <WorkspaceScreenState message={error ?? 'Enroll in this course to see its modules.'} actionLabel="Back to course" onAction={() => router.replace(courseHref(id))} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.accent} />}>
          <Text style={styles.title} numberOfLines={2}>{workspace.course.title}</Text>
          <Text style={styles.muted}>{pluralize(modules.length, 'Module', 'Modules')} • {pluralize(lessonCount, 'Lesson', 'Lessons')}</Text>
          {modules.length === 0 ? <Text style={styles.muted}>This course has no published modules yet.</Text> : null}
          {modules.map((courseModule, index) => {
            const lessons = courseModule.lessons ?? [];
            const completedInModule = lessons.filter((lesson) => completed.has(lesson.id)).length;
            const isModuleDone = lessons.length > 0 && completedInModule === lessons.length;
            const isExpanded = expanded.includes(courseModule.id);
            return (
              <View key={courseModule.id} style={styles.module}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: isExpanded }} onPress={() => toggle(courseModule.id)} style={styles.moduleHeader}>
                  {isExpanded ? <ChevronDown size={20} color={colors.mutedText} /> : <ChevronRight size={20} color={colors.mutedText} />}
                  <View style={styles.flex}>
                    <View style={styles.inline}>
                      <Text style={styles.moduleTitle}>Module {index + 1}: {courseModule.title}</Text>
                      {isModuleDone ? <CheckCircle2 size={16} color="#16a34a" /> : null}
                    </View>
                    <Text style={styles.small}>{completedInModule} / {pluralize(lessons.length, 'item', 'items')} completed</Text>
                  </View>
                </Pressable>
                {isExpanded ? (
                  <View style={styles.moduleBody}>
                    {lessons.map((lesson) => (
                      <Pressable key={lesson.id} accessibilityRole="button" onPress={() => router.push(lessonHref(id, lesson.id))} style={styles.lessonRow}>
                        {completed.has(lesson.id) ? <CheckCircle2 size={20} color="#16a34a" /> : <Circle size={20} color={colors.border} />}
                        <View style={styles.lessonIcon}><LessonTypeIcon type={lesson.type} size={16} /></View>
                        <View style={styles.flex}>
                          <Text style={styles.lessonTitle}>{lesson.title}</Text>
                          <Text style={styles.small}>
                            {[pluralize(lesson.duration ?? 0, 'minute', 'minutes'), lesson.type === 'quiz' || lesson.type === 'assignment' ? `${lesson.points ?? 0} pts` : null].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <ChevronRight size={16} color={colors.mutedText} />
                      </Pressable>
                    ))}
                    {lessons.length === 0 ? <Text style={[styles.small, styles.emptyModule]}>No content available in this module yet.</Text> : null}
                    <ModuleResources resources={courseModule.resources ?? []} onOpenError={() => setOpenError(true)} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
      <CustomModal visible={openError} type="error" title="Could not open" message="This resource could not be opened on this device." onClose={() => setOpenError(false)} />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  padded: { padding: 16 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 13 },
  module: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  moduleBody: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  flex: { flex: 1, gap: 3 },
  moduleTitle: { color: colors.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  small: { color: colors.mutedText, fontSize: 12 },
  lessonRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lessonIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  lessonTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  emptyModule: { paddingVertical: 14, textAlign: 'center', fontStyle: 'italic' },
});
