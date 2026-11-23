import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Circle, PlayCircle, X } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { lessonTypeLabel } from '@/components/eLearning/course/workspaceHelpers';
import { formatMinutes } from '@/components/eLearning/ELearningParts';
import type { CourseModule } from '@/lib/types/course';

type LessonOutlineSheetProps = {
  visible: boolean;
  modules: CourseModule[];
  currentLessonId: string | null;
  completedLessonIds: string[];
  onSelect: (lessonId: string) => void;
  onClose: () => void;
};

/**
 * The course outline as a bottom sheet, grouped by module with "2 of 5 done" per module. Each lesson row is 56dp with a
 * tick when completed and "Current" (as text, not only colour) on the lesson being viewed. Sits inside the bottom
 * safe area; tapping the scrim closes it.
 */
export default function LessonOutlineSheet({ visible, modules, currentLessonId, completedLessonIds, onSelect, onClose }: LessonOutlineSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const completed = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);
  const lessonTotal = modules.reduce((total, courseModule) => total + (courseModule.lessons?.length ?? 0), 0);
  const completedTotal = modules.reduce((total, courseModule) => total + (courseModule.lessons ?? []).filter((lesson) => completed.has(lesson.id)).length, 0);
  let lessonNumber = 0;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close course outline" onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.title}>Course outline</Text>
              <Text style={styles.subtitle}>{completedTotal} of {lessonTotal} lessons done</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}>
              <X size={22} color={colors.icon} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {modules.map((courseModule, moduleIndex) => {
              const lessons = courseModule.lessons ?? [];
              if (lessons.length === 0) return null;
              const doneInModule = lessons.filter((lesson) => completed.has(lesson.id)).length;
              return (
                <View key={courseModule.id} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text numberOfLines={2} style={styles.groupTitle}>Module {moduleIndex + 1} · {courseModule.title}</Text>
                    <Text style={styles.groupCount}>{doneInModule}/{lessons.length}</Text>
                  </View>
                  {lessons.map((lesson) => {
                    lessonNumber += 1;
                    const isCurrent = lesson.id === currentLessonId;
                    const isDone = completed.has(lesson.id);
                    const meta = [lessonTypeLabel(lesson.type), lesson.duration ? formatMinutes(lesson.duration) : null].filter(Boolean).join(' · ');
                    return (
                      <Pressable
                        key={lesson.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Lesson ${lessonNumber}, ${lesson.title}${isDone ? ', completed' : ''}${isCurrent ? ', current lesson' : ''}`}
                        accessibilityState={{ selected: isCurrent }}
                        android_ripple={{ color: colors.control }}
                        onPress={() => onSelect(lesson.id)}
                        style={[styles.row, isCurrent && styles.rowCurrent]}
                      >
                        {isDone ? <CheckCircle2 size={20} color={colors.accent} /> : isCurrent ? <PlayCircle size={20} color={colors.accentText} /> : <Circle size={20} color={colors.mutedText} />}
                        <View style={styles.flex}>
                          <Text numberOfLines={2} style={[styles.lessonTitle, isCurrent && styles.lessonTitleCurrent]}>{lessonNumber}. {lesson.title}</Text>
                          <Text numberOfLines={1} style={styles.lessonMeta}>{isCurrent ? `Current · ${meta}` : meta}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim },
  sheet: { maxHeight: '80%', backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 8, backgroundColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 4, paddingVertical: 4 },
  flex: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  subtitle: { color: colors.mutedText, fontSize: 13, marginTop: 2 },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 8, paddingBottom: 16, gap: 8 },
  group: { gap: 2 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  groupTitle: { flex: 1, color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  groupCount: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' },
  rowCurrent: { backgroundColor: colors.successSurface },
  lessonTitle: { color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  lessonTitleCurrent: { color: colors.successText, fontWeight: '700' },
  lessonMeta: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
});
