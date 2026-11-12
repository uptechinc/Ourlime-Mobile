import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { COURSE_MAIN_CATEGORIES, COURSE_SUBCATEGORIES } from '@/lib/constants/courseCategories';
import type { Course } from '@/lib/types/course';

type CategoryBrowserProps = {
  courses: Course[];
  onOpenCategory: (category: string, subcategory?: string) => void;
  onOpenCxc: () => void;
  /** "View all" opens the full catalog (web Resources panel header link). */
  onViewAll?: () => void;
};

/** Browse by main category with live course counts, expanding to subcategories (web eLearning Resources panel). */
export default function CategoryBrowser({ courses, onOpenCategory, onOpenCxc, onViewAll }: CategoryBrowserProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    courses.forEach((course) => result.set(course.category.toLowerCase(), (result.get(course.category.toLowerCase()) ?? 0) + 1));
    return result;
  }, [courses]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <BookOpen size={19} color={colors.accentText} />
        <Text style={styles.title}>Browse by category</Text>
        {onViewAll ? (
          <Pressable accessibilityRole="link" onPress={onViewAll} hitSlop={8} style={styles.viewAll}>
            <Text style={styles.viewAllText}>View all</Text>
          </Pressable>
        ) : null}
      </View>
      {COURSE_MAIN_CATEGORIES.map((category) => {
        const count = counts.get(category.toLowerCase()) ?? 0;
        const isExpanded = expanded === category;
        return (
          <View key={category}>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${category}, ${count} courses`}
                onPress={() => (category === 'CXC' ? onOpenCxc() : onOpenCategory(category))}
                style={styles.rowMain}
              >
                <Text style={styles.rowText} numberOfLines={1}>{category}</Text>
                {count > 0 ? <Text style={styles.count}>{count}</Text> : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${isExpanded ? 'Hide' : 'Show'} ${category} subcategories`}
                accessibilityState={{ expanded: isExpanded }}
                hitSlop={6}
                onPress={() => setExpanded(isExpanded ? null : category)}
                style={styles.expand}
              >
                {isExpanded ? <ChevronDown size={18} color={colors.mutedText} /> : <ChevronRight size={18} color={colors.mutedText} />}
              </Pressable>
            </View>
            {isExpanded ? (
              <View style={styles.subcategories}>
                {COURSE_SUBCATEGORIES[category].map((subcategory) => (
                  <Pressable
                    key={subcategory}
                    accessibilityRole="link"
                    onPress={() => (category === 'CXC' ? onOpenCxc() : onOpenCategory(category, subcategory))}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{subcategory}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 14, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  viewAll: { paddingVertical: 4, paddingHorizontal: 6 },
  viewAllText: { color: colors.accentText, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  rowText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  count: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  expand: { width: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  subcategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 6, paddingBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.control },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
