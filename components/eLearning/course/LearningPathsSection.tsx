import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { CheckCircle2, Circle, CircleDot, Lightbulb, MinusCircle, Route } from 'lucide-react-native';
import { ProgressBar } from '@/components/eLearning/ELearningParts';
import { learningDepthService } from '@/lib/services/LearningDepthService';
import { learnerCourseStateLabel } from '@/lib/services/LearningDepthRules';
import { settleAll } from '@/lib/utils/settleAll';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseSuggestion, LearnerCourseState, LearningPath } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

type LearningPathsSectionProps = { reloadKey: number };

/**
 * The catalog's suggestions and learning paths for the signed-in learner. Every suggestion shows the real signals
 * behind it (the next course in a path they started, a completed course it builds on, the same topic); there is no
 * score, and the learner can always pick any course below. A path shows the learner's progress and the next course with
 * the reason it is next. Both are extras: if they fail to load, the plain catalog stays.
 */
export default function LearningPathsSection({ reloadKey }: LearningPathsSectionProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [suggestions, setSuggestions] = useState<CourseSuggestion[]>([]);

  useEffect(() => {
    let isActive = true;
    void settleAll([learningDepthService.getPaths(), learningDepthService.getSuggestions()] as const).then(([pathResult, suggestionResult]) => {
      if (!isActive) return;
      if (pathResult.status === 'fulfilled') setPaths(pathResult.value);
      else console.warn('[LearningPathsSection.load] Paths unavailable:', pathResult.reason instanceof Error ? pathResult.reason.message : 'Unknown error');
      if (suggestionResult.status === 'fulfilled') setSuggestions(suggestionResult.value);
      else console.warn('[LearningPathsSection.load] Suggestions unavailable:', suggestionResult.reason instanceof Error ? suggestionResult.reason.message : 'Unknown error');
    });
    return () => { isActive = false; };
  }, [reloadKey]);

  const openCourse = (courseId: string) => router.push(`/eLearning/courses/${encodeURIComponent(courseId)}` as Href);
  const stateIcon = (state: LearnerCourseState) => {
    if (state === 'completed') return <CheckCircle2 size={16} color={colors.successText} />;
    if (state === 'in_progress') return <CircleDot size={16} color={colors.warningText} />;
    if (state === 'unavailable') return <MinusCircle size={16} color={colors.mutedText} />;
    return <Circle size={16} color={colors.mutedText} />;
  };

  if (paths.length === 0 && suggestions.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {suggestions.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.headingRow}><Lightbulb size={18} color={colors.warningText} /><Text accessibilityRole="header" style={styles.heading}>Suggested for you</Text></View>
          <Text style={styles.muted}>Based only on courses you finished and paths you started.</Text>
          {suggestions.map((suggestion) => (
            <Pressable key={suggestion.courseId} accessibilityRole="button" accessibilityLabel={`${suggestion.title}. Why: ${suggestion.reasons.join(' ')}`} android_ripple={RIPPLE} onPress={() => openCourse(suggestion.courseId)} style={styles.card}>
              <Text style={styles.title} numberOfLines={2}>{suggestion.title}</Text>
              {suggestion.category || suggestion.instructorName ? <Text style={styles.muted} numberOfLines={1}>{[suggestion.category, suggestion.instructorName].filter(Boolean).join(' · ')}</Text> : null}
              <Text style={styles.reason}>Why: {suggestion.reasons.join(' ')}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {paths.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.headingRow}><Route size={18} color={colors.accentText} /><Text accessibilityRole="header" style={styles.heading}>Learning paths</Text></View>
          {paths.map((path) => {
            const progress = path.progress;
            const next = progress?.nextCourseId ? path.courses.find((course) => course.courseId === progress.nextCourseId) : null;
            const stateOf = (courseId: string, available: boolean): LearnerCourseState => progress?.steps.find((step) => step.courseId === courseId)?.state ?? (available ? 'not_started' : 'unavailable');
            return (
              <View key={path.id} style={styles.card}>
                <Text style={styles.title}>{path.title}</Text>
                <Text style={styles.muted}>{`${path.courses.length} courses · By ${path.ownerName}`}</Text>
                {path.description ? <Text style={styles.body} numberOfLines={3}>{path.description}</Text> : null}
                {progress ? (
                  <View style={styles.progress}>
                    <ProgressBar value={progress.percent} accessibilityLabel={`${path.title} progress`} />
                    <Text style={styles.muted}>{progress.completedCount} of {progress.availableCount} completed · {progress.percent}%</Text>
                  </View>
                ) : null}
                {path.courses.map((course, index) => {
                  const state = stateOf(course.courseId, course.available);
                  const canOpen = course.available || state === 'completed' || state === 'in_progress';
                  return (
                    <Pressable
                      key={course.courseId}
                      accessibilityRole="button"
                      accessibilityLabel={`${index + 1}. ${course.title}, ${learnerCourseStateLabel(state)}`}
                      accessibilityState={{ disabled: !canOpen }}
                      disabled={!canOpen}
                      android_ripple={RIPPLE}
                      onPress={() => openCourse(course.courseId)}
                      style={styles.step}
                    >
                      <Text style={styles.stepNumber}>{index + 1}.</Text>
                      {stateIcon(state)}
                      <Text style={[styles.stepTitle, !canOpen ? styles.mutedTitle : null]} numberOfLines={1}>{course.title}</Text>
                      <Text style={styles.stepState}>{learnerCourseStateLabel(state)}</Text>
                    </Pressable>
                  );
                })}
                {next && progress ? (
                  <View style={styles.next}>
                    <Text style={styles.reason}>Why this is next: {progress.nextReason}</Text>
                    <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => openCourse(next.courseId)} style={styles.nextButton}>
                      <Text style={styles.nextButtonText} numberOfLines={1}>{stateOf(next.courseId, true) === 'in_progress' ? 'Continue' : 'Next'}: {next.title}</Text>
                    </Pressable>
                  </View>
                ) : progress?.nextReason ? <Text style={styles.reason}>{progress.nextReason}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrap: { gap: 20, marginTop: 8 },
  section: { gap: 10 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '800' },
  card: { padding: 14, gap: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  reason: { color: colors.successText, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  progress: { gap: 4, marginTop: 4 },
  step: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, overflow: 'hidden' },
  stepNumber: { width: 22, textAlign: 'right', color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  stepTitle: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, fontWeight: '600' },
  mutedTitle: { color: colors.mutedText },
  stepState: { color: colors.mutedText, fontSize: 12 },
  next: { gap: 8, marginTop: 4, padding: 10, borderRadius: 12, backgroundColor: colors.successSurface },
  nextButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#047857', overflow: 'hidden' },
  nextButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
