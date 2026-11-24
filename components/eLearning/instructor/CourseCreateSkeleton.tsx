import { useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { ELEARNING_GUTTER } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

/** Mirrors the course editor while the instructor check runs: step strip, the "Course details" card and the bottom bar. */
export default function CourseCreateSkeleton() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.fill}>
      <View style={styles.steps}>
        <Skeleton width={140} height={13} />
        <View style={styles.row}>{[0, 1, 2, 3].map((index) => <View key={index} style={styles.flex}><Skeleton height={4} borderRadius={2} /></View>)}</View>
      </View>
      <ScrollView scrollEnabled={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.column, { width: Math.min(width, 760) }]}>
          <View style={styles.card}>
            <Skeleton width={130} height={17} />
            <Skeleton width="70%" height={12} />
            {[48, 48, 120].map((height, index) => (
              <View key={index} style={styles.field}>
                <Skeleton width={index === 2 ? 150 : 110} height={13} />
                <Skeleton height={height} borderRadius={12} />
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Skeleton width={150} height={17} />
            <View style={styles.chips}>{[110, 70, 84, 96, 120].map((chipWidth) => <Skeleton key={chipWidth} width={chipWidth} height={40} borderRadius={20} />)}</View>
          </View>
        </View>
      </ScrollView>
      <View style={styles.bar}><Skeleton height={48} borderRadius={12} /></View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  steps: { gap: 8, paddingHorizontal: ELEARNING_GUTTER, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  scroll: { alignItems: 'center' },
  column: { padding: ELEARNING_GUTTER, gap: 16 },
  card: { padding: 16, gap: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 6 },
  field: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bar: { padding: 12, paddingHorizontal: ELEARNING_GUTTER, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
