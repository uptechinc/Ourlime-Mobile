import { useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

/** Mirrors the course editor while the instructor check runs: step bar, step label, Basics fields and the Back / Next bar. */
export default function CourseCreateSkeleton() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ScrollView scrollEnabled={false} contentContainerStyle={styles.scroll}>
      <View style={[styles.column, { width: Math.min(width, 760) }]}>
        <View style={styles.row}>{[0, 1, 2, 3].map((index) => <View key={index} style={styles.flex}><Skeleton height={5} borderRadius={3} /></View>)}</View>
        <Skeleton width={150} height={12} />
        <Skeleton width={120} height={20} />
        {[48, 48, 110].map((height, index) => (
          <View key={index} style={styles.field}>
            <Skeleton width={index === 2 ? 150 : 110} height={13} />
            <Skeleton height={height} borderRadius={12} />
          </View>
        ))}
        <Skeleton width={90} height={13} />
        <View style={styles.chips}>{[110, 70, 84, 96, 120].map((chipWidth) => <Skeleton key={chipWidth} width={chipWidth} height={40} borderRadius={20} />)}</View>
        <View style={styles.nav}>
          <View style={styles.flex}><Skeleton height={50} borderRadius={14} /></View>
          <View style={styles.flex}><Skeleton height={50} borderRadius={14} /></View>
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  scroll: { alignItems: 'center', backgroundColor: colors.canvas },
  column: { padding: 16, gap: 14 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 6 },
  field: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nav: { marginTop: 10, flexDirection: 'row', gap: 10 },
});
