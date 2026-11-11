import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, HelpCircle, Plus, Trash2, X } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import { ErrorList, FormButton, FormField, Segmented } from '@/components/eLearning/instructor/InstructorForm';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService } from '@/lib/services/InstructorService';
import type { QuizQuestionInput, QuizQuestionType } from '@/lib/types/instructor';

const CONTENT_MAX_WIDTH = 760;
const MAX_OPTIONS = 10;
const QUESTION_TYPES: { value: QuizQuestionType; label: string }[] = [{ value: 'mcq', label: 'Multiple choice' }, { value: 'tf', label: 'True / False' }, { value: 'short', label: 'Short answer' }];
const TRUE_FALSE = ['True', 'False'];

type QuestionDraft = { key: string; title: string; type: QuizQuestionType; options: string[]; correctIndex: number | null; points: string };

let keyCounter = 0;
const nextKey = (): string => `q${Date.now()}_${keyCounter++}`;
const newQuestion = (): QuestionDraft => ({ key: nextKey(), title: '', type: 'mcq', options: ['', ''], correctIndex: null, points: '1' });

/** Create a quiz for one of the instructor's courses (the website's quiz editor): multiple choice, true/false and short answer. */
export default function CreateQuizScreen() {
  const router = useRouter();
  const { courseId, title: courseTitle } = useLocalSearchParams<{ courseId: string; title?: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const updateQuestion = (key: string, change: Partial<QuestionDraft>) => setQuestions((current) => current.map((question) => (question.key === key ? { ...question, ...change } : question)));

  const handleChangeType = (question: QuestionDraft, type: QuizQuestionType) => {
    if (type === question.type) return;
    updateQuestion(question.key, {
      type,
      correctIndex: null,
      options: type === 'mcq' ? (question.type === 'mcq' ? question.options : ['', '']) : type === 'tf' ? TRUE_FALSE : [],
    });
  };

  const validate = (): string[] => {
    const found: string[] = [];
    if (!title.trim()) found.push('Enter a quiz title.');
    if (questions.length === 0) found.push('Add at least one question.');
    questions.forEach((question, index) => {
      const label = `Question ${index + 1}`;
      if (!question.title.trim()) found.push(`${label} needs its question text.`);
      const points = Number(question.points);
      if (!Number.isInteger(points) || points < 0 || points > 1000) found.push(`${label}: points must be a whole number from 0 to 1000.`);
      if (question.type === 'mcq') {
        if (question.options.filter((option) => option.trim()).length < 2) found.push(`${label} needs at least two options.`);
        if (question.options.some((option) => !option.trim())) found.push(`${label} has an empty option.`);
      }
      if (question.type !== 'short' && question.correctIndex === null) found.push(`${label}: mark the correct answer.`);
    });
    return found;
  };

  const handleSave = async () => {
    const found = validate();
    setErrors(found);
    setSaveError(null);
    if (found.length > 0 || !id) return;
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
      setSaveError(message.includes('instructor') ? 'Only the course instructor can add quizzes to this course.' : 'The quiz could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isDone) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <PageHeader title="Quiz created" onBackPress={() => router.back()} />
        <View style={styles.done}>
          <HelpCircle size={44} color={colors.accent} />
          <Text style={styles.doneTitle}>Quiz added</Text>
          <Text style={styles.doneText}>Enrolled learners see it with the course's quizzes and assignments.</Text>
          <FormButton label="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <PageHeader title="New quiz" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            {typeof courseTitle === 'string' && courseTitle ? <Text style={styles.course} numberOfLines={2}>{courseTitle}</Text> : null}
            <FormField label="Quiz title" required value={title} onChange={setTitle} placeholder="e.g. Module 1 check-in" maxLength={200} />
            <FormField label="Description" value={description} onChange={setDescription} multiline placeholder="What the quiz covers (optional)" />
            <Text style={styles.hint}>The quiz is added to the course's assessments module.</Text>

            <Text style={styles.section}>Questions</Text>
            {questions.map((question, index) => (
              <View key={question.key} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.number}>Question {index + 1}</Text>
                  {questions.length > 1 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Delete question ${index + 1}`} hitSlop={8} onPress={() => setQuestions((current) => current.filter((item) => item.key !== question.key))}>
                      <Trash2 size={16} color={colors.mutedText} />
                    </Pressable>
                  ) : null}
                </View>
                <TextInput accessibilityLabel={`Question ${index + 1} text`} value={question.title} onChangeText={(value) => updateQuestion(question.key, { title: value })} placeholder="Question" placeholderTextColor={colors.mutedText} multiline style={[styles.input, styles.shortMultiline]} />
                <Segmented options={QUESTION_TYPES} value={question.type} onChange={(type) => handleChangeType(question, type)} />
                <View style={styles.row}>
                  <Text style={[styles.label, styles.flex]}>Points</Text>
                  <TextInput accessibilityLabel={`Question ${index + 1} points`} value={question.points} onChangeText={(value) => updateQuestion(question.key, { points: value.replace(/[^0-9]/g, '') })} keyboardType="number-pad" style={[styles.input, styles.pointsInput]} />
                </View>

                {question.type === 'short' ? (
                  <Text style={styles.note}>Short answers are graded by you.</Text>
                ) : (
                  <View accessibilityRole="radiogroup" style={styles.options}>
                    <Text style={styles.hint}>Tap the circle next to the correct answer.</Text>
                    {(question.type === 'tf' ? TRUE_FALSE : question.options).map((option, optionIndex) => {
                      const isCorrect = question.correctIndex === optionIndex;
                      return (
                        <View key={`${question.key}-${optionIndex}`} style={styles.row}>
                          <Pressable
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isCorrect }}
                            accessibilityLabel={`Mark option ${optionIndex + 1} as correct`}
                            hitSlop={6}
                            onPress={() => updateQuestion(question.key, { correctIndex: optionIndex })}
                            style={[styles.radio, isCorrect && styles.radioChecked]}
                          >
                            {isCorrect ? <Check size={14} color={colors.onAccent} strokeWidth={3} /> : null}
                          </Pressable>
                          {question.type === 'tf' ? (
                            <Text style={[styles.tfText, styles.flex]}>{option}</Text>
                          ) : (
                            <TextInput
                              accessibilityLabel={`Option ${optionIndex + 1}`}
                              value={option}
                              onChangeText={(value) => updateQuestion(question.key, { options: question.options.map((entry, position) => (position === optionIndex ? value : entry)) })}
                              placeholder={`Option ${optionIndex + 1}`}
                              placeholderTextColor={colors.mutedText}
                              style={[styles.input, styles.flex]}
                            />
                          )}
                          {question.type === 'mcq' && question.options.length > 2 ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Remove option ${optionIndex + 1}`}
                              hitSlop={6}
                              onPress={() => updateQuestion(question.key, {
                                options: question.options.filter((_entry, position) => position !== optionIndex),
                                correctIndex: question.correctIndex === null || question.correctIndex === optionIndex ? null : question.correctIndex > optionIndex ? question.correctIndex - 1 : question.correctIndex,
                              })}
                            >
                              <X size={18} color={colors.mutedText} />
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })}
                    {question.type === 'mcq' && question.options.length < MAX_OPTIONS ? (
                      <Pressable accessibilityRole="button" onPress={() => updateQuestion(question.key, { options: [...question.options, ''] })} style={styles.inlineAdd}>
                        <Plus size={14} color={colors.accentText} /><Text style={styles.inlineAddText}>Add option</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>
            ))}
            {questions.length < 100 ? (
              <Pressable accessibilityRole="button" onPress={() => setQuestions((current) => [...current, newQuestion()])} style={styles.addButton}>
                <Plus size={16} color={colors.accentText} /><Text style={styles.addText}>Add question</Text>
              </Pressable>
            ) : null}

            <ErrorList errors={errors} />
            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
            <FormButton label={isSaving ? 'Saving…' : 'Save quiz'} disabled={isSaving} onPress={() => void handleSave()} />
          </View>
        </ScrollView>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 12 },
  course: { color: colors.mutedText, fontSize: 13, fontWeight: '700' },
  section: { marginTop: 10, color: colors.text, fontSize: 18, fontWeight: '900' },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.mutedText, fontSize: 12 },
  note: { padding: 12, borderRadius: 12, backgroundColor: colors.control, color: colors.secondaryText, fontSize: 13 },
  card: { padding: 12, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { flex: 1, color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  shortMultiline: { minHeight: 64, textAlignVertical: 'top' },
  pointsInput: { width: 90, textAlign: 'center' },
  options: { gap: 8 },
  radio: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.input },
  radioChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  tfText: { minHeight: 44, textAlignVertical: 'center', paddingVertical: 12, color: colors.text, fontSize: 15, fontWeight: '700' },
  inlineAdd: { minHeight: 36, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  inlineAddText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
  addButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  addText: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  error: { color: colors.destructiveText, fontSize: 13 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  doneText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
