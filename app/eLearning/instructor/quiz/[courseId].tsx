import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Check, HelpCircle, Plus, Trash2, X } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import { ErrorList, FieldMessage, FormField, FormSection, Segmented } from '@/components/eLearning/instructor/InstructorForm';
import { ELearningButton, ELearningEmptyState, ELearningHeader, ELearningScrollView, ELEARNING_ACTION_GREEN, ELEARNING_GUTTER, StickyActionBar } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService } from '@/lib/services/InstructorService';
import type { QuizQuestionInput, QuizQuestionType } from '@/lib/types/instructor';

const CONTENT_MAX_WIDTH = 760;
const MAX_OPTIONS = 10;
const MAX_QUESTIONS = 100;
const QUESTION_TYPES: { value: QuizQuestionType; label: string }[] = [{ value: 'mcq', label: 'Multiple choice' }, { value: 'tf', label: 'True / False' }, { value: 'short', label: 'Short answer' }];
const TRUE_FALSE = ['True', 'False'];
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

type QuestionDraft = { key: string; title: string; type: QuizQuestionType; options: string[]; correctIndex: number | null; points: string };

let keyCounter = 0;
const nextKey = (): string => `q${Date.now()}_${keyCounter++}`;
const newQuestion = (): QuestionDraft => ({ key: nextKey(), title: '', type: 'mcq', options: ['', ''], correctIndex: null, points: '1' });
const optionLetter = (index: number): string => String.fromCharCode(65 + index);

/** What is wrong with one question, worded for its own card ("Needs at least two answers."). */
const questionProblems = (question: QuestionDraft): string[] => {
  const found: string[] = [];
  if (!question.title.trim()) found.push('Write the question.');
  const points = Number(question.points);
  if (!Number.isInteger(points) || points < 0 || points > 1000) found.push('Points must be a whole number from 0 to 1000.');
  if (question.type === 'mcq') {
    if (question.options.filter((option) => option.trim()).length < 2) found.push('Needs at least two answers.');
    if (question.options.some((option) => !option.trim())) found.push('Fill in or remove the empty answer.');
  }
  if (question.type !== 'short' && question.correctIndex === null) found.push('Mark the correct answer.');
  return found;
};

/**
 * Create a quiz for one of the instructor's courses (the website's quiz editor): multiple choice, true/false and short
 * answer. Each question is its own card that can be moved or removed; problems show on the card they belong to.
 */
export default function CreateQuizScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { courseId, title: courseTitle } = useLocalSearchParams<{ courseId: string; title?: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const courseName = typeof courseTitle === 'string' && courseTitle ? courseTitle : undefined;
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [questionToRemove, setQuestionToRemove] = useState<string | null>(null);
  const [isLeaveVisible, setIsLeaveVisible] = useState(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);

  // The quiz is saved only by Save quiz, so leaving with questions written asks first.
  const hasWork = Boolean(title.trim() || description.trim() || questions.some((question) => question.title.trim() || question.options.some((option) => option.trim())));
  const shouldConfirmLeaveRef = useRef(false);
  shouldConfirmLeaveRef.current = hasWork && !isDone && !isSaving;
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!shouldConfirmLeaveRef.current) return;
    event.preventDefault();
    pendingLeaveRef.current = () => navigation.dispatch(event.data.action);
    setIsLeaveVisible(true);
  }), [navigation]);

  const updateQuestion = (key: string, change: Partial<QuestionDraft>) => setQuestions((current) => current.map((question) => (question.key === key ? { ...question, ...change } : question)));

  const moveQuestion = (index: number, offset: -1 | 1) => setQuestions((current) => {
    const target = index + offset;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const handleChangeType = (question: QuestionDraft, type: QuizQuestionType) => {
    if (type === question.type) return;
    updateQuestion(question.key, {
      type,
      correctIndex: null,
      options: type === 'mcq' ? (question.type === 'mcq' ? question.options : ['', '']) : type === 'tf' ? TRUE_FALSE : [],
    });
  };

  const handleRequestRemove = (question: QuestionDraft) => {
    if (!question.title.trim() && !question.options.some((option) => option.trim())) setQuestions((current) => current.filter((item) => item.key !== question.key));
    else setQuestionToRemove(question.key);
  };

  const validate = (): string[] => {
    const found: string[] = [];
    if (!title.trim()) found.push('Enter a quiz title.');
    if (questions.length === 0) found.push('Add at least one question.');
    questions.forEach((question, index) => {
      questionProblems(question).forEach((problem) => found.push(`Question ${index + 1}: ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`));
    });
    return found;
  };

  const errors = showErrors ? validate() : [];
  const totalPoints = questions.reduce((sum, question) => sum + (Number(question.points) || 0), 0);

  const handleSave = async () => {
    const found = validate();
    setShowErrors(true);
    setSaveError(null);
    if (found.length > 0 || !id) { scrollRef.current?.scrollTo({ y: 0, animated: true }); return; }
    setIsSaving(true);
    try {
      const built: QuizQuestionInput[] = questions.map((question) => ({
        id: question.key,
        title: question.title,
        type: question.type,
        options: question.type === 'short' ? [] : question.type === 'tf' ? TRUE_FALSE : question.options,
        ...(question.type !== 'short' && question.correctIndex !== null ? { correctIndex: question.correctIndex } : {}),
        points: Number(question.points),
      }));
      await instructorService.createQuiz({ courseId: id, title, description, questions: built });
      setIsDone(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      console.error('[CreateQuizScreen.handleSave] Error:', message || 'Unknown error');
      setSaveError(message.includes('instructor') ? 'Only the course instructor can add quizzes to this course.' : 'The quiz could not be saved. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartAnother = () => {
    setTitle('');
    setDescription('');
    setQuestions([newQuestion()]);
    setShowErrors(false);
    setSaveError(null);
    setIsDone(false);
  };

  if (isDone) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ELearningHeader title="Quiz added" subtitle={courseName} onBack={() => router.back()} />
        <View style={styles.centerFill}>
          <ELearningEmptyState
            icon={<HelpCircle size={44} color={colors.accentText} />}
            title="Quiz added"
            hint="Enrolled learners see it with the course's quizzes and assignments."
            actionLabel="Done"
            onAction={() => router.back()}
            secondaryActionLabel="Add another quiz"
            onSecondaryAction={handleStartAnother}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title="New quiz" subtitle={courseName} onBack={() => router.back()} />
      <KeyboardSafeView style={styles.flex}>
        <ELearningScrollView scrollRef={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            <ErrorList errors={errors} title={`Fix ${errors.length === 1 ? 'this' : `these ${errors.length}`} to save`} />
            <FormSection title="Quiz details" description="The quiz is added to the course's assessments module.">
              <FormField label="Quiz title" required value={title} onChange={setTitle} placeholder="e.g. Module 1 check-in" maxLength={200} error={showErrors && !title.trim() ? 'Enter a quiz title.' : undefined} />
              <FormField label="Description" value={description} onChange={setDescription} multiline placeholder="What the quiz covers" />
            </FormSection>

            <View style={styles.sectionHead}>
              <Text accessibilityRole="header" style={[styles.section, styles.flexText]}>Questions</Text>
              <Text style={styles.muted}>{questions.length} {questions.length === 1 ? 'question' : 'questions'} · {totalPoints} {totalPoints === 1 ? 'point' : 'points'}</Text>
            </View>

            {questions.map((question, index) => {
              const problems = showErrors ? questionProblems(question) : [];
              const options = question.type === 'tf' ? TRUE_FALSE : question.options;
              return (
                <View key={question.key} style={[styles.card, problems.length > 0 && styles.cardError]}>
                  <View style={styles.cardHead}>
                    <Text style={[styles.eyebrow, styles.flexText]}>Question {index + 1}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Move question ${index + 1} up`} accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => moveQuestion(index, -1)} android_ripple={RIPPLE} style={[styles.iconButton, index === 0 && styles.dimmed]}>
                      <ArrowUp size={18} color={colors.icon} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Move question ${index + 1} down`} accessibilityState={{ disabled: index === questions.length - 1 }} disabled={index === questions.length - 1} onPress={() => moveQuestion(index, 1)} android_ripple={RIPPLE} style={[styles.iconButton, index === questions.length - 1 && styles.dimmed]}>
                      <ArrowDown size={18} color={colors.icon} />
                    </Pressable>
                    {questions.length > 1 ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Delete question ${index + 1}`} onPress={() => handleRequestRemove(question)} android_ripple={RIPPLE} style={styles.iconButton}>
                        <Trash2 size={18} color={colors.destructiveText} />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Question <Text style={styles.required}>*</Text></Text>
                    <TextInput accessibilityLabel={`Question ${index + 1} text`} value={question.title} onChangeText={(value) => updateQuestion(question.key, { title: value })} placeholder="Type the question" placeholderTextColor={colors.mutedText} multiline style={[styles.input, styles.shortMultiline]} />
                  </View>
                  <Segmented label="Answer type" options={QUESTION_TYPES} value={question.type} onChange={(type) => handleChangeType(question, type)} />

                  {question.type === 'short' ? (
                    <Text style={styles.note}>Learners type their own answer. Short answers are graded by you.</Text>
                  ) : (
                    <View style={styles.field}>
                      <Text style={styles.label}>Answers</Text>
                      <Text style={styles.hint}>Tap the circle next to the correct answer.</Text>
                      <View accessibilityRole="radiogroup" style={styles.options}>
                        {options.map((option, optionIndex) => {
                          const isCorrect = question.correctIndex === optionIndex;
                          const answerName = question.type === 'tf' ? option : `Answer ${optionLetter(optionIndex)}`;
                          return (
                            <View key={`${question.key}-${optionIndex}`} style={[styles.optionRow, isCorrect && styles.optionRowCorrect]}>
                              <Pressable
                                accessibilityRole="radio"
                                accessibilityState={{ checked: isCorrect }}
                                accessibilityLabel={`Mark ${answerName} as correct`}
                                onPress={() => updateQuestion(question.key, { correctIndex: optionIndex })}
                                android_ripple={{ ...RIPPLE, borderless: true }}
                                style={styles.radioHit}
                              >
                                <View style={[styles.radio, isCorrect && styles.radioChecked]}>{isCorrect ? <Check size={14} color="#ffffff" strokeWidth={3} /> : null}</View>
                              </Pressable>
                              {question.type === 'tf' ? (
                                <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={() => updateQuestion(question.key, { correctIndex: optionIndex })} style={styles.optionTextHit}>
                                  <Text style={styles.tfText}>{option}</Text>
                                </Pressable>
                              ) : (
                                <TextInput
                                  accessibilityLabel={answerName}
                                  value={option}
                                  onChangeText={(value) => updateQuestion(question.key, { options: question.options.map((entry, position) => (position === optionIndex ? value : entry)) })}
                                  placeholder={answerName}
                                  placeholderTextColor={colors.mutedText}
                                  style={styles.optionInput}
                                />
                              )}
                              {isCorrect ? <Text style={styles.correctTag}>Correct</Text> : null}
                              {question.type === 'mcq' && question.options.length > 2 ? (
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove ${answerName}`}
                                  onPress={() => updateQuestion(question.key, {
                                    options: question.options.filter((_entry, position) => position !== optionIndex),
                                    correctIndex: question.correctIndex === null || question.correctIndex === optionIndex ? null : question.correctIndex > optionIndex ? question.correctIndex - 1 : question.correctIndex,
                                  })}
                                  android_ripple={{ ...RIPPLE, borderless: true }}
                                  style={styles.iconButton}
                                >
                                  <X size={18} color={colors.mutedText} />
                                </Pressable>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                      {question.type === 'mcq' && question.options.length < MAX_OPTIONS ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Add an answer to question ${index + 1}`} onPress={() => updateQuestion(question.key, { options: [...question.options, ''] })} android_ripple={RIPPLE} style={styles.inlineAdd}>
                          <Plus size={16} color={colors.accentText} /><Text style={styles.inlineAddText}>Add answer</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )}

                  <View style={styles.pointsRow}>
                    <Text style={[styles.label, styles.flexText]}>Points</Text>
                    <TextInput accessibilityLabel={`Question ${index + 1} points`} value={question.points} onChangeText={(value) => updateQuestion(question.key, { points: value.replace(/[^0-9]/g, '') })} keyboardType="number-pad" maxLength={4} style={[styles.input, styles.pointsInput]} />
                    <Text style={styles.hint}>pts</Text>
                  </View>
                  {problems.map((problem) => <FieldMessage key={problem} error={problem} />)}
                </View>
              );
            })}
            {questions.length < MAX_QUESTIONS ? (
              <Pressable accessibilityRole="button" onPress={() => setQuestions((current) => [...current, newQuestion()])} android_ripple={RIPPLE} style={styles.addButton}>
                <Plus size={18} color={colors.accentText} /><Text style={styles.addText}>Add question</Text>
              </Pressable>
            ) : null}
            {saveError ? <FieldMessage error={saveError} /> : null}
          </View>
        </ELearningScrollView>
        <StickyActionBar>
          <ELearningButton label="Save quiz" busyLabel="Saving…" isBusy={isSaving} onPress={() => void handleSave()} style={styles.flex} />
        </StickyActionBar>
      </KeyboardSafeView>
      <CustomModal
        visible={Boolean(questionToRemove)}
        type="warning"
        title="Delete this question?"
        message="The question and its answers will be removed from this quiz."
        confirmText="Delete"
        cancelText="Keep"
        onConfirm={() => { setQuestions((current) => current.filter((item) => item.key !== questionToRemove)); setQuestionToRemove(null); }}
        onCancel={() => setQuestionToRemove(null)}
        onClose={() => setQuestionToRemove(null)}
      />
      <CustomModal
        visible={isLeaveVisible}
        type="warning"
        title="Leave without saving?"
        message="This quiz is not saved yet. If you leave now, its questions will be lost."
        confirmText="Leave"
        cancelText="Keep editing"
        onConfirm={() => { setIsLeaveVisible(false); const leave = pendingLeaveRef.current; pendingLeaveRef.current = null; leave?.(); }}
        onCancel={() => { setIsLeaveVisible(false); pendingLeaveRef.current = null; }}
        onClose={() => { setIsLeaveVisible(false); pendingLeaveRef.current = null; }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  centerFill: { flex: 1, justifyContent: 'center' },
  scroll: { alignItems: 'center', paddingBottom: 24 },
  column: { padding: ELEARNING_GUTTER, gap: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 13 },
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  required: { color: colors.destructiveText },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  note: { padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.control, color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  card: { padding: 14, gap: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  cardError: { borderWidth: 1, borderColor: colors.destructiveText },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: -8, marginTop: -6 },
  eyebrow: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dimmed: { opacity: 0.35 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  shortMultiline: { minHeight: 72, textAlignVertical: 'top' },
  options: { gap: 8 },
  optionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  optionRowCorrect: { borderColor: ELEARNING_ACTION_GREEN, backgroundColor: colors.successSurface },
  radioHit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: colors.mutedText, backgroundColor: colors.surface },
  radioChecked: { borderColor: ELEARNING_ACTION_GREEN, backgroundColor: ELEARNING_ACTION_GREEN },
  optionInput: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 10, color: colors.text, fontSize: 16 },
  optionTextHit: { flex: 1, minHeight: 48, justifyContent: 'center' },
  tfText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  correctTag: { color: colors.successText, fontSize: 12, fontWeight: '800', paddingHorizontal: 6 },
  inlineAdd: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  inlineAddText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointsInput: { width: 88, textAlign: 'center' },
  addButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  addText: { color: colors.accentText, fontSize: 15, fontWeight: '700' },
});
