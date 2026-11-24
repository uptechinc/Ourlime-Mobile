import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Users } from 'lucide-react-native';
import ScheduleSheet from '@/components/eLearning/schedule/ScheduleSheet';
import { ELearningButton, ELEARNING_ACTION_GREEN } from '@/components/eLearning/ELearningParts';
import { FieldMessage } from '@/components/eLearning/instructor/InstructorForm';
import { cohortJoinProblem, cohortSummary } from '@/lib/services/AssignmentPolicy';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseCohort } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const SELF_PACED = '__self_paced__';

type ClassPickerSheetProps = {
  visible: boolean;
  title: string;
  cohorts: CourseCohort[];
  /** Offer "Study at my own pace" (not when the instructor requires a class). */
  allowSelfPaced: boolean;
  confirmLabel: string;
  isBusy: boolean;
  error?: string | null;
  /** '' means self-paced (no class). */
  onConfirm: (cohortId: string) => void;
  onClose: () => void;
};

/**
 * Choose a class (cohort) when enrolling or later. Classes that are full, closed or not open yet are listed with the
 * reason and cannot be picked. Other learners are never shown, only how many places are taken.
 */
export default function ClassPickerSheet({ visible, title, cohorts, allowSelfPaced, confirmLabel, isBusy, error, onConfirm, onClose }: ClassPickerSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState<string | null>(null);
  const now = new Date();
  const visibleCohorts = cohorts.filter((cohort) => cohort.status === 'active');

  useEffect(() => {
    if (!visible) return;
    const firstOpen = visibleCohorts.find((cohort) => cohortJoinProblem(cohort, new Date()) === null);
    setSelected(firstOpen ? firstOpen.id : allowSelfPaced ? SELF_PACED : null);
    // Only when the sheet opens; later changes keep the learner's choice.
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const option = (key: string, label: string, detail: string, problem: string | null) => {
    const isSelected = selected === key;
    return (
      <Pressable
        key={key}
        accessibilityRole="radio"
        accessibilityLabel={[label, detail, problem].filter(Boolean).join(', ')}
        accessibilityState={{ checked: isSelected, disabled: Boolean(problem) }}
        disabled={Boolean(problem)}
        android_ripple={RIPPLE}
        onPress={() => setSelected(key)}
        style={[styles.option, isSelected && styles.optionSelected, problem ? styles.optionDisabled : null]}
      >
        <View style={[styles.radio, isSelected && styles.radioSelected]}>{isSelected ? <Check size={14} color="#ffffff" strokeWidth={3} /> : null}</View>
        <View style={styles.flexText}>
          <Text style={styles.optionTitle}>{label}</Text>
          {detail ? <Text style={styles.muted}>{detail}</Text> : null}
          {problem ? <Text style={[styles.muted, { color: colors.warningText }]}>{problem}</Text> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <ScheduleSheet
      visible={visible}
      title={title}
      description={allowSelfPaced ? 'Join a class to learn with a group on set dates, or study at your own pace.' : 'This course is taught in classes. Choose one to join.'}
      onClose={() => { if (!isBusy) onClose(); }}
      footer={<>
        <ELearningButton label="Cancel" variant="secondary" isDisabled={isBusy} onPress={onClose} />
        <ELearningButton label={confirmLabel} busyLabel="Please wait…" isBusy={isBusy} isDisabled={selected === null} onPress={() => { if (selected !== null) onConfirm(selected === SELF_PACED ? '' : selected); }} />
      </>}
    >
      <View accessibilityRole="radiogroup" style={styles.list}>
        {visibleCohorts.length === 0 ? (
          <View style={styles.empty}><Users size={20} color={colors.mutedText} /><Text style={styles.muted}>No classes are open right now.</Text></View>
        ) : visibleCohorts.map((cohort) => option(cohort.id, cohort.name, [cohort.description, cohortSummary(cohort)].filter(Boolean).join(' · '), cohortJoinProblem(cohort, now)))}
        {allowSelfPaced ? option(SELF_PACED, 'Study at my own pace', 'No class or fixed dates. You can join a class later.', null) : null}
      </View>
      <FieldMessage error={error ?? undefined} />
    </ScheduleSheet>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  list: { gap: 10 },
  option: { minHeight: 64, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  optionSelected: { borderColor: ELEARNING_ACTION_GREEN, borderWidth: 2 },
  optionDisabled: { opacity: 0.6 },
  radio: { width: 22, height: 22, marginTop: 2, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: ELEARNING_ACTION_GREEN, borderColor: ELEARNING_ACTION_GREEN },
  flexText: { flex: 1, minWidth: 0, gap: 2 },
  optionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
});
