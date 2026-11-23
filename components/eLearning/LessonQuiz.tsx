import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Circle, HelpCircle, XCircle } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { ELEARNING_ACTION_GREEN, ProgressBar } from '@/components/eLearning/ELearningParts';
import type { CourseQuizQuestion } from '@/lib/types/course';

type LessonQuizProps = {
  questions: CourseQuizQuestion[];
  isCompleted: boolean;
  /**
   * Sends the answers aligned by question index like the website quiz page: the option index, or -1 when skipped or for
   * a short-answer question (not auto-scored). Resolves with the server's score, if any.
   */
  onSubmit: (answers: number[]) => Promise<number | null>;
  /** The score screen's primary action (e.g. "Next lesson"); without it only "Retake quiz" is offered. */
  onContinue?: () => void;
  continueLabel?: string;
};

const isShortAnswer = (question: CourseQuizQuestion): boolean => question.type === 'short_answer' || question.options.length === 0;

/**
 * A lesson quiz like the website's quiz page (multiple choice, true/false, short answer), one question per screen with
 * "Question 3 of 10", then a score screen that reviews every marked question (your answer, the right one, the
 * explanation) with Retake and Continue. Only questions with a correct option are scored, as on the server.
 */
export default function LessonQuiz({ questions, isCompleted, onSubmit, onContinue, continueLabel = 'Continue' }: LessonQuizProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  if (questions.length === 0) {
    return (
      <View style={[styles.card, styles.centerCard]}>
        <HelpCircle size={28} color={colors.mutedText} />
        <Text style={styles.emptyTitle}>No questions yet</Text>
        <Text style={[styles.muted, styles.centerText]}>This quiz does not have any questions configured yet. Please check back later.</Text>
      </View>
    );
  }

  const isAnswered = (index: number): boolean => {
    const question = questions[index];
    return isShortAnswer(question) ? Boolean(textAnswers[index]?.trim()) : answers[index] !== undefined;
  };
  const answeredCount = questions.filter((_question, index) => isAnswered(index)).length;
  const correctCount = questions.filter((question, index) => question.correctIndex !== undefined && answers[index] === question.correctIndex).length;
  // Only questions with a correct option are marked; short answers are not part of the score (as on the server).
  const markableCount = questions.filter((question) => question.correctIndex !== undefined).length;
  const totalPoints = questions.reduce((total, question) => total + (question.points ?? 0), 0);
  const hasShortAnswers = questions.some(isShortAnswer);
  const isLastQuestion = questionIndex === questions.length - 1;
  const question = questions[questionIndex];

  const handleSelect = (optionIndex: number) => {
    if (isSubmitted) return;
    setHint(null);
    setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }));
  };

  const handleSubmit = async () => {
    // Every question must be answered (as before); jump to the first gap instead of leaving a dead Submit button.
    const firstUnanswered = questions.findIndex((_question, index) => !isAnswered(index));
    if (firstUnanswered >= 0) {
      setQuestionIndex(firstUnanswered);
      setHint(`Answer question ${firstUnanswered + 1} to submit (${answeredCount} of ${questions.length} answered).`);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setHint(null);
    try {
      // Every question keeps its slot so the server scores answers[index] against the right question.
      const serverScore = await onSubmit(questions.map((item, index) => isShortAnswer(item) ? -1 : answers[index] ?? -1));
      setScore(serverScore ?? (markableCount ? Math.round((correctCount / markableCount) * 100) : 100));
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
    setTextAnswers({});
    setScore(null);
    setQuestionIndex(0);
    setIsSubmitted(false);
    setError(null);
    setHint(null);
  };

  if (isSubmitted) {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.card, styles.centerCard]}>
          <Text style={styles.eyebrow}>Your score</Text>
          <Text style={styles.resultScore}>{score}%</Text>
          <Text style={styles.resultLabel}>{markableCount ? `${correctCount} of ${markableCount} correct` : 'Answers submitted'}</Text>
          {hasShortAnswers ? <Text style={[styles.muted, styles.centerText]}>Short answers are not scored automatically.</Text> : null}
        </View>

        {markableCount > 0 ? (
          <View style={styles.reviewList}>
            <Text style={styles.sectionTitle}>Review</Text>
            {questions.map((item, index) => {
              if (item.correctIndex === undefined) return null;
              const chosen = answers[index];
              const isCorrect = chosen === item.correctIndex;
              return (
                <View key={item.id} style={[styles.card, styles.reviewCard]}>
                  <View style={styles.reviewHeader}>
                    {isCorrect ? <CheckCircle2 size={18} color={colors.successText} /> : <XCircle size={18} color={colors.destructiveText} />}
                    <Text style={[styles.reviewStatus, { color: isCorrect ? colors.successText : colors.destructiveText }]}>{isCorrect ? 'Correct' : 'Incorrect'}</Text>
                    <Text style={styles.reviewNumber}>Question {index + 1}</Text>
                  </View>
                  <Text style={styles.reviewQuestion}>{item.title}</Text>
                  {!isCorrect ? <Text style={styles.reviewLine}><Text style={styles.reviewKey}>Your answer: </Text>{chosen !== undefined ? item.options[chosen] : 'Skipped'}</Text> : null}
                  <Text style={styles.reviewLine}><Text style={styles.reviewKey}>Correct answer: </Text>{item.options[item.correctIndex]}</Text>
                  {item.explanation ? <Text style={styles.explanation}>{item.explanation}</Text> : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={handleRetake} android_ripple={{ color: colors.control }} style={[styles.secondaryButton, styles.flex]}>
            <Text numberOfLines={1} style={styles.secondaryButtonText}>Retake quiz</Text>
          </Pressable>
          {onContinue ? (
            <Pressable accessibilityRole="button" onPress={onContinue} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={[styles.primaryButton, styles.flex]}>
              <Text numberOfLines={1} style={styles.primaryButtonText}>{continueLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const typeLabel = question.type === 'true_false' ? 'True or false' : isShortAnswer(question) ? 'Short answer' : 'Choose one';

  return (
    <View style={styles.wrapper}>
      {isCompleted ? <Text style={styles.muted}>You already completed this quiz. You can take it again to practise.</Text> : null}
      <Text style={styles.muted}>{questions.length} {questions.length === 1 ? 'question' : 'questions'}{totalPoints > 0 ? ` · ${totalPoints} ${totalPoints === 1 ? 'point' : 'points'}` : ''} · {answeredCount} answered</Text>

      <View style={styles.card}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionNumber}>Question {questionIndex + 1} of {questions.length}</Text>
          <Text style={styles.questionNumber}>{question.points ? `${question.points} ${question.points === 1 ? 'pt' : 'pts'}` : typeLabel}</Text>
        </View>
        <ProgressBar value={((questionIndex + 1) / questions.length) * 100} height={4} accessibilityLabel="Quiz position" />
        <Text accessibilityRole="header" style={styles.questionTitle}>{question.title}</Text>
        {question.points ? <Text style={styles.muted}>{typeLabel}</Text> : null}

        {isShortAnswer(question) ? (
          <TextInput
            value={textAnswers[questionIndex] ?? ''}
            onChangeText={(text) => { setHint(null); setTextAnswers((current) => ({ ...current, [questionIndex]: text })); }}
            placeholder="Type your answer…"
            placeholderTextColor={colors.mutedText}
            multiline
            maxLength={2000}
            accessibilityLabel={`Answer to question ${questionIndex + 1}`}
            style={styles.textAnswer}
          />
        ) : (
          <View accessibilityRole="radiogroup" style={styles.options}>
            {question.options.map((option, optionIndex) => {
              const isSelected = answers[questionIndex] === optionIndex;
              return (
                <Pressable
                  key={optionIndex}
                  accessibilityRole="radio"
                  accessibilityLabel={option}
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => handleSelect(optionIndex)}
                  android_ripple={{ color: colors.control }}
                  style={[styles.option, isSelected && styles.optionSelected]}
                >
                  {isSelected ? <CheckCircle2 size={22} color={colors.accentText} /> : <Circle size={22} color={colors.mutedText} />}
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {hint ? <Text accessibilityRole="alert" style={styles.hint}>{hint}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous question"
          accessibilityState={{ disabled: questionIndex === 0 }}
          disabled={questionIndex === 0}
          onPress={() => { setHint(null); setQuestionIndex((index) => Math.max(0, index - 1)); }}
          style={[styles.secondaryButton, styles.flex, questionIndex === 0 && styles.disabled]}
        >
          <Text numberOfLines={1} style={styles.secondaryButtonText}>Previous</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: isSubmitting }}
          disabled={isSubmitting}
          onPress={() => (isLastQuestion ? void handleSubmit() : setQuestionIndex((index) => Math.min(questions.length - 1, index + 1)))}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          style={[styles.primaryButton, styles.flex, isSubmitting && styles.disabled]}
        >
          <Text numberOfLines={1} style={styles.primaryButtonText}>{isSubmitting ? 'Submitting…' : isLastQuestion ? 'Submit' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 12 },
  flex: { flex: 1 },
  card: { padding: 16, gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  centerCard: { alignItems: 'center', gap: 6 },
  centerText: { textAlign: 'center' },
  eyebrow: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  resultScore: { color: colors.accentText, fontSize: 44, fontWeight: '900' },
  resultLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  questionNumber: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  questionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', lineHeight: 25 },
  textAnswer: { minHeight: 110, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15, textAlignVertical: 'top' },
  options: { gap: 8 },
  option: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas, overflow: 'hidden' },
  optionSelected: { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.successSurface },
  optionText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 21 },
  optionTextSelected: { fontWeight: '700' },
  hint: { color: colors.warningText, backgroundColor: colors.warningSurface, borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 19 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 8 },
  primaryButton: { minHeight: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  reviewList: { gap: 8 },
  reviewCard: { gap: 6 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewStatus: { fontSize: 14, fontWeight: '800' },
  reviewNumber: { marginLeft: 'auto', color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  reviewQuestion: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  reviewLine: { color: colors.text, fontSize: 14, lineHeight: 20 },
  reviewKey: { color: colors.mutedText, fontWeight: '700' },
  explanation: { color: colors.secondaryText, fontSize: 13, lineHeight: 19, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
