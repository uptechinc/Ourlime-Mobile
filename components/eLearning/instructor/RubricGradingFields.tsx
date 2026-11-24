import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { ELEARNING_ACTION_GREEN } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { AssignmentRubric } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

/** The grader's choices: one level per criterion and optional feedback per criterion. */
export type RubricChoices = { levels: { [criterionId: string]: string }; feedback: { [criterionId: string]: string } };

type RubricGradingFieldsProps = {
  rubric: AssignmentRubric;
  value: RubricChoices;
  onChange: (value: RubricChoices) => void;
};

/** Grade with a rubric: pick one level in every criterion (radio buttons with their points), with optional feedback. */
export default function RubricGradingFields({ rubric, value, onChange }: RubricGradingFieldsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.wrapper}>
      {rubric.criteria.map((criterion) => (
        <View key={criterion.id} style={styles.criterion}>
          <Text style={styles.title}>{criterion.title} <Text style={styles.muted}>· up to {criterion.maxPoints}</Text></Text>
          {criterion.description ? <Text style={styles.muted}>{criterion.description}</Text> : null}
          <View accessibilityRole="radiogroup" accessibilityLabel={criterion.title} style={styles.levels}>
            {criterion.levels.map((level) => {
              const isSelected = value.levels[criterion.id] === level.id;
              return (
                <Pressable
                  key={level.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${level.title}, ${level.points} points`}
                  accessibilityState={{ checked: isSelected }}
                  android_ripple={RIPPLE}
                  onPress={() => onChange({ ...value, levels: { ...value.levels, [criterion.id]: level.id } })}
                  style={[styles.level, isSelected && styles.levelSelected]}
                >
                  {isSelected ? <Check size={14} color="#ffffff" strokeWidth={3} /> : null}
                  <Text style={[styles.levelText, isSelected && styles.levelTextSelected]}>{level.title} · {level.points}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            accessibilityLabel={`Feedback on ${criterion.title}`}
            value={value.feedback[criterion.id] ?? ''}
            onChangeText={(text) => onChange({ ...value, feedback: { ...value.feedback, [criterion.id]: text } })}
            placeholder="Feedback on this criterion (optional)"
            placeholderTextColor={colors.mutedText}
            multiline
            maxLength={2000}
            style={styles.input}
          />
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 10 },
  criterion: { padding: 12, gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  muted: { color: colors.mutedText, fontSize: 12, fontWeight: '500' },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  level: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  levelSelected: { backgroundColor: ELEARNING_ACTION_GREEN, borderColor: ELEARNING_ACTION_GREEN },
  levelText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  levelTextSelected: { color: '#ffffff' },
  input: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 14, textAlignVertical: 'top' },
});
