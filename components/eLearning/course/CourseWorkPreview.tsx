import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ClipboardList, Eye, FileText, HelpCircle, Lock } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseLesson, CourseModule } from '@/lib/types/course';

type WorkItem = CourseLesson & { moduleTitle: string };

type CourseWorkPreviewProps = {
  modules: CourseModule[];
  /** Opens a preview item, or explains that the course must be joined first. */
  onOpenLesson: (lessonId: string, isPreview: boolean) => void;
};

/**
 * Web course page "Quizzes & Assignments" tab for visitors who have not enrolled: every quiz and assignment the
 * learner can see, grouped by kind with its module, and locked. The rules only release preview lessons before
 * enrollment, so the list is the course's preview quizzes and assignments.
 */
export default function CourseWorkPreview({ modules, onOpenLesson }: CourseWorkPreviewProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const items: WorkItem[] = modules.flatMap((courseModule) => (courseModule.lessons ?? []).map((lesson) => ({ ...lesson, moduleTitle: courseModule.title })));
  const quizzes = items.filter((item) => item.type === 'quiz');
  const assignments = items.filter((item) => item.type === 'assignment');

  return (
    <View style={styles.wrapper}>
      <View style={styles.notice}>
        <Lock size={15} color={colors.mutedText} />
        <Text style={styles.noticeText}>Enroll to unlock every quiz and assignment in this course.</Text>
      </View>
      {quizzes.length === 0 && assignments.length === 0 ? (
        <View style={styles.empty}>
          <ClipboardList size={44} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>No quizzes or assignments to preview</Text>
          <Text style={styles.muted}>Quizzes and assignments open once you join this course.</Text>
        </View>
      ) : null}
      <WorkGroup title="Quizzes" icon={<HelpCircle size={19} color="#a855f7" />} items={quizzes} onOpenLesson={onOpenLesson} styles={styles} colors={colors} />
      <WorkGroup title="Assignments" icon={<FileText size={19} color="#f97316" />} items={assignments} onOpenLesson={onOpenLesson} styles={styles} colors={colors} />
    </View>
  );
}

type WorkGroupProps = {
  title: string;
  icon: ReactElement;
  items: WorkItem[];
  onOpenLesson: (lessonId: string, isPreview: boolean) => void;
  styles: ReturnType<typeof createStyles>;
  colors: AppThemeColors;
};

function WorkGroup({ title, icon, items, onOpenLesson, styles, colors }: WorkGroupProps) {
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>{icon}<Text style={styles.groupTitle}>{title} ({items.length})</Text></View>
      {items.map((item) => {
        const isPreview = Boolean(item.isFree);
        return (
          <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}${isPreview ? ', preview' : ', locked'}`} activeOpacity={0.75} onPress={() => onOpenLesson(item.id, isPreview)} style={styles.row}>
            {item.type === 'quiz' ? <HelpCircle size={19} color="#a855f7" /> : <FileText size={19} color="#f97316" />}
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.muted} numberOfLines={2}>{item.description}</Text> : null}
              <Text style={styles.small}>Module: {item.moduleTitle}</Text>
            </View>
            <View style={styles.rowSide}>
              {item.duration ? <Text style={styles.small}>{item.duration} min</Text> : null}
              {isPreview ? <Eye size={16} color={colors.accentText} /> : <Lock size={16} color={colors.mutedText} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 16 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.control },
  noticeText: { flex: 1, color: colors.mutedText, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 28 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  small: { color: colors.mutedText, fontSize: 12 },
  group: { gap: 10 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSide: { alignItems: 'flex-end', gap: 6 },
});
