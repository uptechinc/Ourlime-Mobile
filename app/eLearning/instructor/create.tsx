import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { BookOpen, Check, FileText, ImagePlus, Paperclip, Plus, Trash2, Video } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService, type CourseLevel, type NewCourseLesson, type StagedCourseFile } from '@/lib/services/InstructorService';

// Same categories as the website's course editor and instructor application.
const CATEGORIES = ['Information Technology', 'Science', 'Business', 'Language', 'Art', 'History', 'Mathematics', 'Engineering', 'Health Sciences', 'Social Sciences', 'CXC'];
const LEVELS: { value: CourseLevel; label: string }[] = [{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }];
const LESSON_TYPES: { value: NewCourseLesson['type']; label: string }[] = [{ value: 'text', label: 'Text' }, { value: 'video', label: 'Video' }, { value: 'document', label: 'Document' }];
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const CONTENT_MAX_WIDTH = 760;

type PickedFile = { uri: string; name: string; mimeType?: string; size?: number };
type LessonDraft = { key: string; title: string; type: NewCourseLesson['type']; content: string; duration: string; file: PickedFile | null };
type ModuleDraft = { key: string; title: string; lessons: LessonDraft[] };

let keyCounter = 0;
const nextKey = (): string => `draft-${Date.now()}-${keyCounter++}`;
const newLesson = (): LessonDraft => ({ key: nextKey(), title: '', type: 'text', content: '', duration: '', file: null });
const newModule = (index: number): ModuleDraft => ({ key: nextKey(), title: `Module ${index + 1}`, lessons: [newLesson()] });
const lines = (value: string): string[] => value.split('\n').map((line) => line.trim()).filter(Boolean);

/** Create a course from the app (the website's course creator): basics, cover, then modules of text, video or document lessons. */
export default function CreateCourseScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState<CourseLevel>('beginner');
  const [objectives, setObjectives] = useState('');
  const [prerequisites, setPrerequisites] = useState('');
  const [cover, setCover] = useState<PickedFile | null>(null);
  const [modules, setModules] = useState<ModuleDraft[]>([newModule(0)]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<'published' | 'pending_review' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [moduleToRemove, setModuleToRemove] = useState<string | null>(null);

  const updateModule = (key: string, change: Partial<ModuleDraft>) => setModules((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  const updateLesson = (moduleKey: string, lessonKey: string, change: Partial<LessonDraft>) =>
    setModules((current) => current.map((item) => (item.key === moduleKey ? { ...item, lessons: item.lessons.map((lesson) => (lesson.key === lessonKey ? { ...lesson, ...change } : lesson)) } : item)));

  const handlePickCover = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.85 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setCover({ uri: asset.uri, name: asset.fileName ?? `cover-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize });
  };

  const handlePickLessonFile = async (moduleKey: string, lesson: LessonDraft) => {
    const picked = await DocumentPicker.getDocumentAsync({ type: lesson.type === 'video' ? ['video/*'] : ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if ((asset.size ?? 0) > MAX_FILE_BYTES) { setErrors([`${asset.name} is larger than 50 MB.`]); return; }
    updateLesson(moduleKey, lesson.key, { file: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size } });
  };

  const validate = (): string[] => {
    const found: string[] = [];
    if (title.trim().length < 3) found.push('Give the course a title.');
    if (shortDescription.trim().length < 10) found.push('Add a short description (at least 10 characters).');
    if (description.trim().length < 30) found.push('Describe the course in at least 30 characters.');
    if (!category) found.push('Choose a category.');
    modules.forEach((module, moduleIndex) => {
      if (!module.title.trim()) found.push(`Module ${moduleIndex + 1} needs a title.`);
      if (module.lessons.length === 0) found.push(`Module ${moduleIndex + 1} needs at least one lesson.`);
      module.lessons.forEach((lesson, lessonIndex) => {
        const label = `Module ${moduleIndex + 1}, lesson ${lessonIndex + 1}`;
        if (!lesson.title.trim()) found.push(`${label} needs a title.`);
        if (lesson.type === 'text' && !lesson.content.trim()) found.push(`${label} needs its text.`);
        if (lesson.type !== 'text' && !lesson.file && !/^https:\/\//.test(lesson.content.trim())) found.push(`${label} needs a file or a link.`);
      });
    });
    return found;
  };

  const handleSubmit = async () => {
    const found = validate();
    setErrors(found);
    setSubmitError(null);
    if (found.length > 0) return;
    try {
      setProgress('Uploading files…');
      const thumbnail: StagedCourseFile | null = cover ? await instructorService.uploadCourseFile(cover, 'image') : null;
      const builtModules = [];
      for (const module of modules) {
        const lessons: NewCourseLesson[] = [];
        for (const lesson of module.lessons) {
          const file = lesson.file ? await instructorService.uploadCourseFile(lesson.file, lesson.type === 'video' ? 'video' : lesson.file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'document') : null;
          lessons.push({ title: lesson.title.trim(), type: lesson.type, content: lesson.content.trim(), duration: Math.max(0, Math.floor(Number(lesson.duration) || 0)), file });
        }
        builtModules.push({ title: module.title.trim(), description: '', lessons });
      }
      setProgress('Creating your course…');
      const created = await instructorService.createCourse({
        course: { title: title.trim(), shortDescription: shortDescription.trim(), description: description.trim(), category, level, price: 0, tags: [category], prerequisites: lines(prerequisites), learningObjectives: lines(objectives) },
        thumbnail,
        modules: builtModules,
      });
      setResult(created.status);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      setSubmitError(message.includes('instructor') ? 'Register as an instructor before creating a course.' : 'The course could not be created. Check your connection and try again.');
    } finally {
      setProgress(null);
    }
  };

  if (result) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <PageHeader title="Course created" onBackPress={() => router.back()} />
        <View style={styles.done}>
          <BookOpen size={44} color={colors.accent} />
          <Text style={styles.doneTitle}>{result === 'published' ? 'Your course is live' : 'Sent for review'}</Text>
          <Text style={styles.doneText}>{result === 'published' ? 'Learners can find and enrol in it now.' : 'An administrator reviews courses from instructors who are not yet verified. It will go live once approved.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/eLearning/instructor' as Href)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to instructor dashboard</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <PageHeader title="New course" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            <Text style={styles.section}>Basics</Text>
            <Field label="Title" value={title} onChange={setTitle} styles={styles} colors={colors} />
            <Field label="Short description" value={shortDescription} onChange={setShortDescription} hint="One or two lines shown on course cards." styles={styles} colors={colors} />
            <Field label="Description" value={description} onChange={setDescription} multiline styles={styles} colors={colors} />
            <Text style={styles.label}>Category</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((item) => (
                <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: category === item }} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipSelected]}>
                  {category === item ? <Check size={14} color={colors.onAccent} /> : null}
                  <Text style={[styles.chipText, category === item && styles.chipTextSelected]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Level</Text>
            <View style={styles.segment}>
              {LEVELS.map((item) => (
                <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: level === item.value }} onPress={() => setLevel(item.value)} style={[styles.segmentOption, level === item.value && styles.segmentActive]}>
                  <Text style={[styles.segmentText, level === item.value && styles.segmentTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="What learners will learn" value={objectives} onChange={setObjectives} multiline hint="One per line." styles={styles} colors={colors} />
            <Field label="Prerequisites (optional)" value={prerequisites} onChange={setPrerequisites} multiline hint="One per line." styles={styles} colors={colors} />
            <Text style={styles.hint}>Courses are free while payments are unavailable.</Text>

            <Text style={styles.section}>Cover image</Text>
            <Pressable accessibilityRole="button" onPress={() => void handlePickCover()} style={styles.cover}>
              {cover ? <Image source={{ uri: cover.uri }} contentFit="cover" style={styles.coverImage} /> : <><ImagePlus size={28} color={colors.mutedText} /><Text style={styles.hint}>Add a 16:9 cover (optional)</Text></>}
            </Pressable>

            <Text style={styles.section}>Modules and lessons</Text>
            {modules.map((module, moduleIndex) => (
              <View key={module.key} style={styles.moduleCard}>
                <View style={styles.moduleHeader}>
                  <TextInput value={module.title} onChangeText={(value) => updateModule(module.key, { title: value })} placeholder={`Module ${moduleIndex + 1} title`} placeholderTextColor={colors.mutedText} style={[styles.input, styles.flex]} />
                  {modules.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove module ${moduleIndex + 1}`} onPress={() => setModuleToRemove(module.key)} style={styles.iconButton}><Trash2 size={18} color={colors.destructiveText} /></Pressable> : null}
                </View>
                {module.lessons.map((lesson, lessonIndex) => (
                  <View key={lesson.key} style={styles.lessonCard}>
                    <View style={styles.moduleHeader}>
                      <Text style={styles.lessonNumber}>Lesson {lessonIndex + 1}</Text>
                      {module.lessons.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove lesson ${lessonIndex + 1}`} hitSlop={8} onPress={() => updateModule(module.key, { lessons: module.lessons.filter((item) => item.key !== lesson.key) })}><Trash2 size={16} color={colors.mutedText} /></Pressable> : null}
                    </View>
                    <TextInput value={lesson.title} onChangeText={(value) => updateLesson(module.key, lesson.key, { title: value })} placeholder="Lesson title" placeholderTextColor={colors.mutedText} style={styles.input} />
                    <View style={styles.segment}>
                      {LESSON_TYPES.map((item) => (
                        <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: lesson.type === item.value }} onPress={() => updateLesson(module.key, lesson.key, { type: item.value, file: null })} style={[styles.segmentOption, lesson.type === item.value && styles.segmentActive]}>
                          {item.value === 'video' ? <Video size={14} color={lesson.type === item.value ? colors.text : colors.mutedText} /> : <FileText size={14} color={lesson.type === item.value ? colors.text : colors.mutedText} />}
                          <Text style={[styles.segmentText, lesson.type === item.value && styles.segmentTextActive]}>{item.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {lesson.type === 'text' ? (
                      <TextInput value={lesson.content} onChangeText={(value) => updateLesson(module.key, lesson.key, { content: value })} placeholder="Lesson text" placeholderTextColor={colors.mutedText} multiline style={[styles.input, styles.multiline]} />
                    ) : (
                      <Pressable accessibilityRole="button" onPress={() => void handlePickLessonFile(module.key, lesson)} style={styles.fileButton}>
                        <Paperclip size={18} color={lesson.file ? colors.accentText : colors.mutedText} />
                        <Text style={styles.fileText} numberOfLines={1}>{lesson.file ? lesson.file.name : lesson.type === 'video' ? 'Attach a video (up to 50 MB)' : 'Attach a PDF, Word or PowerPoint file'}</Text>
                      </Pressable>
                    )}
                    <TextInput value={lesson.duration} onChangeText={(value) => updateLesson(module.key, lesson.key, { duration: value.replace(/[^0-9]/g, '') })} placeholder="Duration in minutes (optional)" placeholderTextColor={colors.mutedText} keyboardType="number-pad" style={styles.input} />
                  </View>
                ))}
                <Pressable accessibilityRole="button" onPress={() => updateModule(module.key, { lessons: [...module.lessons, newLesson()] })} style={styles.addButton}><Plus size={16} color={colors.accentText} /><Text style={styles.addText}>Add lesson</Text></Pressable>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setModules((current) => [...current, newModule(current.length)])} style={styles.addButton}><Plus size={16} color={colors.accentText} /><Text style={styles.addText}>Add module</Text></Pressable>

            {errors.length > 0 ? <View style={styles.errorBox}>{errors.slice(0, 6).map((error) => <Text key={error} style={styles.error}>• {error}</Text>)}</View> : null}
            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
            <Pressable accessibilityRole="button" disabled={Boolean(progress)} onPress={() => void handleSubmit()} style={[styles.primaryButton, Boolean(progress) && styles.disabled]}>
              <Text style={styles.primaryButtonText}>{progress ?? 'Create course'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardSafeView>
      <CustomModal
        visible={Boolean(moduleToRemove)}
        type="warning"
        title="Remove this module?"
        message="Its lessons will be removed from the course you are building."
        confirmText="Remove"
        cancelText="Keep"
        onConfirm={() => { setModules((current) => current.filter((item) => item.key !== moduleToRemove)); setModuleToRemove(null); }}
        onCancel={() => setModuleToRemove(null)}
        onClose={() => setModuleToRemove(null)}
      />
    </SafeAreaView>
  );
}

type FieldProps = { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; hint?: string; styles: ReturnType<typeof createStyles>; colors: AppThemeColors };

function Field({ label, value, onChange, multiline, hint, styles, colors }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} multiline={multiline} placeholderTextColor={colors.mutedText} style={[styles.input, multiline && styles.multiline]} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 12 },
  section: { marginTop: 10, color: colors.text, fontSize: 18, fontWeight: '900' },
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.mutedText, fontSize: 12 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: colors.onAccent },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.control },
  segmentOption: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.mutedText, fontSize: 13, fontWeight: '800' },
  segmentTextActive: { color: colors.text },
  cover: { aspectRatio: 16 / 9, maxHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  coverImage: { width: '100%', height: '100%' },
  moduleCard: { padding: 12, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  lessonCard: { padding: 12, gap: 8, borderRadius: 14, backgroundColor: colors.canvas },
  lessonNumber: { flex: 1, color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  fileButton: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  fileText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  addButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  addText: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  errorBox: { padding: 12, gap: 4, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  error: { color: colors.destructiveText, fontSize: 13 },
  primaryButton: { minHeight: 50, marginTop: 6, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  doneText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
