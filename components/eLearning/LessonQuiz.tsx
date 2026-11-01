import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Circle, HelpCircle, XCircle } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseQuizQuestion } from '@/lib/types/course';

type LessonQuizProps = {
  questions: CourseQuizQuestion[];
  isCompleted: boolean;
  /** Sends the answers (option index per question, -1 when skipped); resolves with the server's score, if any. */
  onSubmit: (answers: number[]) => Promise<number | null>;
};

/** Multiple-choice quiz for a lesson, like the website's quiz page: answer, submit, then see the score and the answers. */
export default function LessonQuiz({ questions, isCompleted, onSubmit }: LessonQuizProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (questions.length === 0) {
    return (
      <View style={styles.card}>
        <HelpCircle size={28} color={colors.mutedText} />
        <Text style={styles.emptyTitle}>No questions yet</Text>
        <Text style={styles.muted}>This quiz does not have any questions configured yet. Please check back later.</Text>
      </View>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((question, index) => question.correctIndex !== undefined && answers[index] === question.correctIndex).length;

  const handleSelect = (questionIndex: number, optionIndex: number) => {
    if (isSubmitted) return;
    setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const serverScore = await onSubmit(questions.map((_, index) => answers[index] ?? -1));
      setScore(serverScore ?? Math.round((correctCount / questions.length) * 100));
      setIsSubmitted(true);
    } catch (submitError: unknown) {
      console.error('[LessonQuiz.handleSubmit] Error:', submitError instanceof Error ? submitError.message : 'Unknown error');
      setError('Your answers could not be submitted. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setScore(null);
    setIsSubmitted(false);
  };

  return (
    <View style={styles.wrapper}>
      {isSubmitted ? (
        <View style={[styles.card, styles.resultCard]}>
          <Text style={styles.resultScore}>{score}%</Text>
          <Text style={styles.resultLabel}>{correctCount} of {questions.length} correct</Text>
          <Pressable accessibilityRole="button" onPress={handleRetake} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Retake quiz</Text>
          </Pressable>
        </View>
      ) : isCompleted ? (
        <Text style={styles.muted}>You already completed this quiz. You can take it again to practise.</Text>
      ) : null}

      {questions.map((question, questionIndex) => (
        <View key={question.id} style={styles.card}>
          <Text style={styles.questionNumber}>Question {questionIndex + 1} of {questions.length}</Text>
          <Text style={styles.questionTitle}>{question.title}</Text>
          <View style={styles.options}>
            {question.options.map((option, optionIndex) => {
              const isSelected = answers[questionIndex] === optionIndex;
              const isCorrect = question.correctIndex === optionIndex;
              const showCorrect = isSubmitted && isCorrect;
              const showWrong = isSubmitted && isSelected && !isCorrect;
              return (
                <Pressable
                  key={optionIndex}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, disabled: isSubmitted }}
                  onPress={() => handleSelect(questionIndex, optionIndex)}
                  style={[styles.option, isSelected && styles.optionSelected, showCorrect && styles.optionCorrect, showWrong && styles.optionWrong]}
                >
                  {showCorrect ? <CheckCircle2 size={20} color="#059669" />
                    : showWrong ? <XCircle size={20} color="#dc2626" />
                    : isSelected ? <CheckCircle2 size={20} color={colors.accent} />
                    : <Circle size={20} color={colors.mutedText} />}
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          {isSubmitted && question.explanation ? <Text style={styles.explanation}>{question.explanation}</Text> : null}
        </View>
      ))}

      {!isSubmitted ? (
        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting || answeredCount < questions.length}
            onPress={() => void handleSubmit()}
            style={[styles.primaryButton, (isSubmitting || answeredCount < questions.length) && styles.disabled]}
          >
            <Text style={styles.primaryButtonText}>{isSubmitting ? 'Submitting…' : `Submit answers (${answeredCount}/${questions.length})`}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 14 },
  card: { padding: 16, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  resultCard: { alignItems: 'center' },
  resultScore: { color: colors.accentText, fontSize: 40, fontWeight: '900' },
  resultLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  questionNumber: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  questionTitle: { color: colors.text, fontSize: 17, fontWeight: '800', lineHeight: 24 },
  options: { gap: 8 },
  option: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas },
  optionSelected: { borderColor: colors.accent },
  optionCorrect: { borderColor: '#059669', backgroundColor: 'rgba(16,185,129,0.14)' },
  optionWrong: { borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.12)' },
  optionText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 21 },
  explanation: { color: colors.mutedText, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  footer: { gap: 8 },
  error: { color: colors.destructiveText, fontSize: 13 },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
