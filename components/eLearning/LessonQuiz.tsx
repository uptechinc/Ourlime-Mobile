import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Circle, HelpCircle, History, Lock, MinusCircle, XCircle } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { ELEARNING_ACTION_GREEN, ProgressBar, formatWhen } from '@/components/eLearning/ELearningParts';
import type { CourseQuizQuestion, QuizAttemptRecord, QuizAttemptResult, QuizAttemptSummary, QuizQuestionResult } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

type LessonQuizProps = {
  questions: CourseQuizQuestion[];
  isCompleted: boolean;
  /** Attempts the quiz allows; null means unlimited. */
  maxAttempts: number | null;
  /** The learner's record from their enrollment (attempts used, best score). */
  summary: QuizAttemptSummary | null;
  /** The learner's past attempts, newest first. */
  history: QuizAttemptRecord[];
  /**
   * Sends one attempt with the answers aligned by question index like the website quiz page: the option index, or -1 when
   * skipped or for a short-answer question. Resolves with the attempt the server marked. A retry passes the same
   * operationId, so the server returns that attempt instead of recording another.
   */
  onSubmit: (answers: number[], operationId: string) => Promise<QuizAttemptResult | null>;
  /** "Attempt 1 of 3 used" style wording (CourseService.attemptAllowanceText). */
  allowanceText: (attemptsUsed: number, maxAttempts: number | null) => string;
  /** The score screen's primary action (e.g. "Next lesson"). */
  onContinue?: () => void;
  continueLabel?: string;
};

const isShortAnswer = (question: CourseQuizQuestion): boolean => question.type === 'short_answer' || question.options.length === 0;
const scoreText = (percent: number | null | undefined): string => (typeof percent === 'number' ? `${Math.round(percent)}%` : 'Not scored');
const newOperationId = (): string => `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

/** The server's refusal code (functions/failed-precondition → failed-precondition), when there is one. */
function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code.replace(/^functions\//, '');
  return '';
}

/**
 * A lesson quiz like the website's quiz page (multiple choice, true/false, short answer), one question per screen. The
 * server marks every attempt with its own answer key: this screen never scores. After submitting it shows the server's
 * score, the best score (the one that counts), attempts used and left, and the per-question feedback the quiz releases.
 */
export default function LessonQuiz({ questions, isCompleted, maxAttempts, summary, history, onSubmit, allowanceText, onContinue, continueLabel = 'Continue' }: LessonQuizProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // One id per attempt, kept until the server records it: retrying after a lost connection never records it twice.
  const operationIdRef = useRef<string | null>(null);

  if (questions.length === 0) {
    return (
      <View style={[styles.card, styles.centerCard]}>
        <HelpCircle size={28} color={colors.mutedText} />
        <Text style={styles.emptyTitle}>No questions yet</Text>
        <Text style={[styles.muted, styles.centerText]}>This quiz does not have any questions configured yet. Please check back later.</Text>
      </View>
    );
  }

  const attemptsUsed = result?.attemptsUsed ?? summary?.attempts ?? 0;
  const bestPercent = result?.bestPercent ?? summary?.bestPercent ?? null;
  const limitReached = maxAttempts !== null && attemptsUsed >= maxAttempts;
  const isAnswered = (index: number): boolean => {
    const question = questions[index];
    return isShortAnswer(question) ? Boolean(textAnswers[index]?.trim()) : answers[index] !== undefined;
  };
  const answeredCount = questions.filter((_question, index) => isAnswered(index)).length;
  const totalPoints = questions.reduce((total, question) => total + (question.points ?? 0), 0);
  const isLastQuestion = questionIndex === questions.length - 1;
  const question = questions[questionIndex];

  const handleSelect = (optionIndex: number) => {
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
    operationIdRef.current ??= newOperationId();
    setIsSubmitting(true);
    setError(null);
    setHint(null);
    try {
      // Every question keeps its slot so the server marks answers[index] against the right question.
      const attempt = await onSubmit(questions.map((item, index) => (isShortAnswer(item) ? -1 : answers[index] ?? -1)), operationIdRef.current);
      if (attempt) setResult(attempt);
      else setError('Your answers were saved.');
    } catch (submitError: unknown) {
      console.error('[LessonQuiz.handleSubmit] Error:', submitError instanceof Error ? submitError.message : 'Unknown error');
      const code = errorCode(submitError);
      if (code === 'failed-precondition' || code === 'invalid-argument') {
        // The attempt limit was reached (perhaps on another device) or the quiz changed: the server says which.
        if (code === 'failed-precondition') operationIdRef.current = null;
        setError(submitError instanceof Error && submitError.message ? submitError.message : 'This attempt could not be recorded.');
      } else {
        setError('Your answers could not be submitted. Check your connection and try again; your answers are still here.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = () => {
    operationIdRef.current = null;
    setAnswers({});
    setTextAnswers({});
    setResult(null);
    setQuestionIndex(0);
    setError(null);
    setHint(null);
  };

  const historyList = history.length > 0 ? (
    <View style={[styles.card, styles.historyCard]}>
      <View style={styles.historyHeader}>
        <History size={16} color={colors.mutedText} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>Your attempts</Text>
      </View>
      {history.map((attempt) => (
        <View key={attempt.id} accessible accessibilityLabel={`Attempt ${attempt.attemptNumber}, ${scoreText(attempt.percent)}`} style={styles.historyRow}>
          <Text style={styles.historyLabel} numberOfLines={1}>Attempt {attempt.attemptNumber}{attempt.submittedAt ? <Text style={styles.muted}> · {formatWhen(attempt.submittedAt)}</Text> : null}</Text>
          <Text style={styles.historyScore}>{scoreText(attempt.percent)}</Text>
        </View>
      ))}
    </View>
  ) : null;

  const continueButton = onContinue ? (
    <Pressable accessibilityRole="button" onPress={onContinue} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={[styles.primaryButton, styles.flex]}>
      <Text numberOfLines={1} style={styles.primaryButtonText}>{continueLabel}</Text>
    </Pressable>
  ) : null;

  if (result) {
    const remaining = result.attemptsRemaining;
    const reviewed = result.feedbackReleased ? result.results ?? [] : [];
    return (
      <View style={styles.wrapper}>
        <View accessibilityLiveRegion="polite" style={[styles.card, styles.centerCard]}>
          <Text style={styles.eyebrow}>Attempt {result.attemptNumber} submitted</Text>
          {result.percent !== null ? (
            <>
              <Text accessibilityRole="header" style={styles.resultScore}>{result.percent}%</Text>
              <Text style={[styles.resultLabel, styles.centerText]}>{result.correctCount} of {result.markableCount} correct · {result.score} of {result.maxScore} {result.maxScore === 1 ? 'point' : 'points'}</Text>
            </>
          ) : (
            <Text accessibilityRole="header" style={[styles.resultLabel, styles.centerText]}>This quiz is not scored. Your answers were saved.</Text>
          )}
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Best score (counts)</Text>
              <Text style={styles.statValue}>{scoreText(result.bestPercent)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Attempts</Text>
              <Text style={styles.statText}>{allowanceText(result.attemptsUsed, result.maxAttempts)}</Text>
            </View>
          </View>
        </View>

        {reviewed.length > 0 ? (
          <View style={styles.reviewList}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Question by question</Text>
            {reviewed.map((item) => <QuestionFeedback key={item.questionId} result={item} question={questions[item.index]} styles={styles} colors={colors} />)}
          </View>
        ) : result.percent !== null ? (
          <Text style={styles.muted}>Your instructor shares the score only for this quiz.</Text>
        ) : null}

        <View style={styles.actions}>
          {remaining === 0 ? (
            <View accessible accessibilityLabel="No attempts left" style={[styles.lockedNote, styles.flex]}>
              <Lock size={16} color={colors.mutedText} />
              <Text numberOfLines={1} style={styles.lockedText}>No attempts left</Text>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={handleRetake} android_ripple={RIPPLE} style={[styles.secondaryButton, styles.flex]}>
              <Text numberOfLines={1} style={styles.secondaryButtonText}>{remaining === null ? 'Try again' : `Try again (${remaining} left)`}</Text>
            </Pressable>
          )}
          {continueButton}
        </View>
        {historyList}
      </View>
    );
  }

  if (limitReached) {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.card, styles.centerCard]}>
          <Lock size={28} color={colors.mutedText} />
          <Text accessibilityRole="header" style={[styles.emptyTitle, styles.centerText]}>{allowanceText(attemptsUsed, maxAttempts)}</Text>
          <Text style={[styles.muted, styles.centerText]}>This quiz is finished for you. Your best score is the one that counts.</Text>
          <Text style={styles.statLabel}>Best score</Text>
          <Text style={styles.resultScore}>{scoreText(bestPercent)}</Text>
          {error ? <Text accessibilityRole="alert" style={styles.hint}>{error}</Text> : null}
        </View>
        {continueButton ? <View style={styles.actions}>{continueButton}</View> : null}
        {historyList}
      </View>
    );
  }

  const typeLabel = question.type === 'true_false' ? 'True or false' : isShortAnswer(question) ? 'Short answer' : 'Choose one';

  return (
    <View style={styles.wrapper}>
      {isCompleted ? <Text style={styles.muted}>You already completed this quiz. You can take it again; your best score counts.</Text> : null}
      <Text style={styles.attemptLine}>
        Attempt {attemptsUsed + 1} · {allowanceText(attemptsUsed, maxAttempts)}{bestPercent !== null ? ` · Best ${scoreText(bestPercent)}` : ''}
      </Text>
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
          <>
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
            <Text style={styles.muted}>Short answers are not scored automatically.</Text>
          </>
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
                  android_ripple={RIPPLE}
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
          android_ripple={RIPPLE}
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
          <Text numberOfLines={1} style={styles.primaryButtonText}>{isSubmitting ? 'Submitting…' : isLastQuestion ? (error ? 'Submit again' : 'Submit') : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

type QuestionFeedbackProps = {
  result: QuizQuestionResult;
  question: CourseQuizQuestion | undefined;
  styles: ReturnType<typeof createStyles>;
  colors: AppThemeColors;
};

/** One question as the server marked it: Correct / Incorrect / Not scored in words and an icon, never colour alone. */
function QuestionFeedback({ result, question, styles, colors }: QuestionFeedbackProps) {
  const options = question?.options ?? [];
  const chosen = result.chosenIndex >= 0 ? options[result.chosenIndex] : undefined;
  const correctOption = typeof result.correctIndex === 'number' ? options[result.correctIndex] : undefined;
  const status = !result.scored ? 'Not scored' : result.correct ? 'Correct' : 'Incorrect';
  const tone = !result.scored ? colors.mutedText : result.correct ? colors.successText : colors.destructiveText;
  const Icon = !result.scored ? MinusCircle : result.correct ? CheckCircle2 : XCircle;
  return (
    <View accessible accessibilityLabel={`Question ${result.index + 1}: ${status}`} style={[styles.card, styles.reviewCard]}>
      <View style={styles.reviewHeader}>
        <Icon size={18} color={tone} />
        <Text style={[styles.reviewStatus, { color: tone }]}>{status}</Text>
        <Text style={styles.reviewNumber}>Question {result.index + 1}{result.scored ? ` · ${result.earned}/${result.points}` : ''}</Text>
      </View>
      <Text style={styles.reviewQuestion}>{question?.title ?? `Question ${result.index + 1}`}</Text>
      {result.scored ? <Text style={styles.reviewLine}><Text style={styles.reviewKey}>Your answer: </Text>{chosen ?? 'Skipped'}</Text> : null}
      {result.scored && !result.correct && correctOption !== undefined ? <Text style={styles.reviewLine}><Text style={styles.reviewKey}>Correct answer: </Text>{correctOption}</Text> : null}
      {result.explanation ? <Text style={styles.explanation}>{result.explanation}</Text> : null}
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
  attemptLine: { color: colors.secondaryText, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  statRow: { marginTop: 6, flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  stat: { flex: 1, minWidth: 0, padding: 10, gap: 2, borderRadius: 12, backgroundColor: colors.control },
  statLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statText: { color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
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
  lockedNote: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: colors.control },
  lockedText: { color: colors.mutedText, fontSize: 14, fontWeight: '700' },
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
  historyCard: { gap: 4 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  historyRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  historyLabel: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, fontWeight: '700' },
  historyScore: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
