import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { buildRubricInput, emptyCriterionDraft, newRubricId, RUBRIC_MAX_CRITERIA, RUBRIC_MAX_LEVELS } from '@/lib/services/AssignmentPolicy';
import type { RubricCriterionDraft, RubricLevelDraft } from '@/lib/types/instructor';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

type RubricEditorProps = {
  criteria: RubricCriterionDraft[];
  onChange: (criteria: RubricCriterionDraft[]) => void;
};

/**
 * Builds an assignment rubric: criteria, each with levels and points. Learners see it before they hand in, graders
 * pick one level per criterion, and the assignment is worth the sum of each criterion's best level. No criteria means
 * the assignment is graded with a single score instead.
 */
export default function RubricEditor({ criteria, onChange }: RubricEditorProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { totalPoints } = buildRubricInput(criteria);

  const updateCriterion = (criterionId: string, change: Partial<RubricCriterionDraft>) =>
    onChange(criteria.map((criterion) => (criterion.id === criterionId ? { ...criterion, ...change } : criterion)));
  const updateLevel = (criterion: RubricCriterionDraft, levelId: string, change: Partial<RubricLevelDraft>) =>
    updateCriterion(criterion.id, { levels: criterion.levels.map((level) => (level.id === levelId ? { ...level, ...change } : level)) });

  return (
    <View style={styles.wrapper}>
      {criteria.length > 0 ? <Text accessibilityLiveRegion="polite" style={styles.total}>Worth {totalPoints} {totalPoints === 1 ? 'point' : 'points'} (each criterion's best level, added up)</Text> : null}
      {criteria.map((criterion, criterionIndex) => (
        <View key={criterion.id} style={styles.criterion}>
          <View style={styles.row}>
            <Text style={styles.criterionLabel}>Criterion {criterionIndex + 1}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove criterion ${criterionIndex + 1}`} android_ripple={RIPPLE} onPress={() => onChange(criteria.filter((entry) => entry.id !== criterion.id))} style={styles.iconButton}>
              <Trash2 size={18} color={colors.mutedText} />
            </Pressable>
          </View>
          <TextInput accessibilityLabel={`Criterion ${criterionIndex + 1} name`} value={criterion.title} onChangeText={(title) => updateCriterion(criterion.id, { title })} placeholder="e.g. Argument" placeholderTextColor={colors.mutedText} maxLength={200} style={styles.input} />
          <TextInput accessibilityLabel={`Criterion ${criterionIndex + 1} description`} value={criterion.description} onChangeText={(description) => updateCriterion(criterion.id, { description })} placeholder="What it looks at (optional)" placeholderTextColor={colors.mutedText} maxLength={1000} style={styles.input} />
          {criterion.levels.map((level, levelIndex) => (
            <View key={level.id} style={styles.levelRow}>
              <TextInput accessibilityLabel={`Level ${levelIndex + 1} name`} value={level.title} onChangeText={(title) => updateLevel(criterion, level.id, { title })} placeholder="Level name" placeholderTextColor={colors.mutedText} maxLength={200} style={[styles.input, styles.flex]} />
              <TextInput accessibilityLabel={`Level ${levelIndex + 1} points`} value={level.points} onChangeText={(points) => updateLevel(criterion, level.id, { points: points.replace(/[^0-9]/g, '') })} keyboardType="number-pad" maxLength={4} placeholder="Pts" placeholderTextColor={colors.mutedText} style={[styles.input, styles.points]} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove level ${levelIndex + 1}`} disabled={criterion.levels.length <= 1} android_ripple={RIPPLE} onPress={() => updateCriterion(criterion.id, { levels: criterion.levels.filter((entry) => entry.id !== level.id) })} style={[styles.iconButton, criterion.levels.length <= 1 && styles.disabled]}>
                <Trash2 size={16} color={colors.mutedText} />
              </Pressable>
            </View>
          ))}
          {criterion.levels.length < RUBRIC_MAX_LEVELS ? (
            <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => updateCriterion(criterion.id, { levels: [...criterion.levels, { id: newRubricId('l'), title: '', description: '', points: '0' }] })} style={styles.addButton}>
              <Plus size={16} color={colors.accentText} /><Text style={styles.addText}>Add level</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {criteria.length < RUBRIC_MAX_CRITERIA ? (
        <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => onChange([...criteria, emptyCriterionDraft()])} style={styles.dashedButton}>
          <Plus size={18} color={colors.accentText} /><Text style={styles.addText}>{criteria.length === 0 ? 'Add a rubric' : 'Add criterion'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 12 },
  total: { color: colors.text, fontSize: 14, fontWeight: '700' },
  criterion: { padding: 12, gap: 8, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  criterionLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
  flex: { flex: 1 },
  points: { width: 70, textAlign: 'center' },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  disabled: { opacity: 0.4 },
  addButton: { minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, overflow: 'hidden' },
  dashedButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, overflow: 'hidden' },
  addText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
});
