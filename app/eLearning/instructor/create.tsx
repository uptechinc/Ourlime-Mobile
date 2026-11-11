import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { BookOpen, FileText, ImagePlus, Paperclip, Plus, Trash2, Video } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import CustomModal from '@/components/ui/CustomModal';
import { ChoiceChips, ErrorList, FormField, ListInput, Segmented, TagInput } from '@/components/eLearning/instructor/InstructorForm';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { COURSE_MAIN_CATEGORIES, getSubcategories } from '@/lib/constants/courseCategories';
import { instructorService, type CourseLevel, type NewCourse, type NewCourseLesson, type StagedCourseFile } from '@/lib/services/InstructorService';

const LEVELS: { value: CourseLevel; label: string }[] = [{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }];
/** "Document" is a text lesson with a file attached, as the website's curriculum step stores it (both apps render it). */
type LessonKind = 'text' | 'video' | 'document';
const LESSON_KINDS: { value: LessonKind; label: string }[] = [{ value: 'text', label: 'Text' }, { value: 'video', label: 'Video' }, { value: 'document', label: 'Document' }];
// instructors/{uid}/courseUploads accepts images, videos, PDF and Word files (storage.rules isDocument), up to 50 MB.
const DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const CONTENT_MAX_WIDTH = 760;

type PickedFile = { uri: string; name: string; mimeType?: string; size?: number };
type LessonDraft = { key: string; title: string; kind: LessonKind; content: string; duration: string; file: PickedFile | null };
type ModuleDraft = { key: string; title: string; description: string; lessons: LessonDraft[] };

let keyCounter = 0;
const nextKey = (): string => `draft-${Date.now()}-${keyCounter++}`;
const newLesson = (): LessonDraft => ({ key: nextKey(), title: '', kind: 'text', content: '', duration: '', file: null });
const newModule = (index: number): ModuleDraft => ({ key: nextKey(), title: `Module ${index + 1}`, description: '', lessons: [newLesson()] });
const cleanList = (values: string[]): string[] => values.map((value) => value.trim()).filter(Boolean);

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
  const [subcategory, setSubcategory] = useState('');
  const [level, setLevel] = useState<CourseLevel>('beginner');
  const [price, setPrice] = useState('0');
  const [tags, setTags] = useState<string[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [cover, setCover] = useState<PickedFile | null>(null);
  const [modules, setModules] = useState<ModuleDraft[]>([newModule(0)]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<'published' | 'pending_review' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [moduleToRemove, setModuleToRemove] = useState<string | null>(null);

  const subcategories = getSubcategories(category);

  const updateModule = (key: string, change: Partial<ModuleDraft>) => setModules((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  const updateLesson = (moduleKey: string, lessonKey: string, change: Partial<LessonDraft>) =>
    setModules((current) => current.map((item) => (item.key === moduleKey ? { ...item, lessons: item.lessons.map((lesson) => (lesson.key === lessonKey ? { ...lesson, ...change } : lesson)) } : item)));

  const handleSelectCategory = (value: string) => {
    setCategory(value);
    // Same default as the website: the first subcategory of the new category.
    setSubcategory(getSubcategories(value)[0] ?? '');
  };

  const handlePickCover = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.85 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setCover({ uri: asset.uri, name: asset.fileName ?? `cover-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize });
  };

  const handlePickLessonFile = async (moduleKey: string, lesson: LessonDraft) => {
    if (lesson.kind === 'video') {
      // The image picker reports the video's length, so the lesson duration fills itself in (like the website).
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      if ((asset.fileSize ?? 0) > MAX_FILE_BYTES) { setErrors([`${asset.fileName ?? 'This video'} is larger than 50 MB.`]); return; }
      const minutes = typeof asset.duration === 'number' && asset.duration > 0 ? Math.max(1, Math.round(asset.duration / 60000)) : 0;
      updateLesson(moduleKey, lesson.key, {
        file: { uri: asset.uri, name: asset.fileName ?? `video-${Date.now()}.mp4`, mimeType: asset.mimeType ?? 'video/mp4', size: asset.fileSize },
        ...(minutes > 0 && !lesson.duration ? { duration: String(minutes) } : {}),
      });
      return;
    }
    const picked = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_TYPES, copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if ((asset.size ?? 0) > MAX_FILE_BYTES) { setErrors([`${asset.name} is larger than 50 MB.`]); return; }
    updateLesson(moduleKey, lesson.key, { file: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size } });
  };

  // The website's minimums (course create page) plus what the server needs for each lesson.
  const validate = (): string[] => {
    const found: string[] = [];
    if (title.trim().length < 4) found.push('Course title must contain at least 4 characters.');
    if (shortDescription.trim().length < 10) found.push('Short description must contain at least 10 characters.');
    if (description.trim().length < 50) found.push('Detailed description must contain at least 50 characters.');
    if (!category) found.push('Choose a category.');
    if (cleanList(objectives).length === 0) found.push('Add at least one learning objective.');
    const priceValue = Number(price || '0');
    if (!Number.isFinite(priceValue) || priceValue < 0 || priceValue > 100000) found.push('Enter a price from 0 to 100000 (0 for a free course).');
    if (modules.length === 0) found.push('Add at least one curriculum module.');
    modules.forEach((module, moduleIndex) => {
      if (!module.title.trim()) found.push(`Module ${moduleIndex + 1} needs a title.`);
      if (module.lessons.length === 0) found.push(`Module ${moduleIndex + 1} needs at least one lesson.`);
      module.lessons.forEach((lesson, lessonIndex) => {
        const label = `Module ${moduleIndex + 1}, lesson ${lessonIndex + 1}`;
        if (!lesson.title.trim()) found.push(`${label} needs a title.`);
        if (lesson.kind === 'text' && !lesson.content.trim()) found.push(`${label} needs its text.`);
        if (lesson.kind !== 'text' && !lesson.file && !/^https:\/\//.test(lesson.content.trim())) found.push(`${label} needs a file or a link.`);
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
      const builtModules: NewCourse['modules'] = [];
      for (const module of modules) {
        const lessons: NewCourseLesson[] = [];
        for (const lesson of module.lessons) {
          const fileType: StagedCourseFile['type'] = lesson.kind === 'video' ? 'video' : lesson.file?.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'document';
          const file = lesson.file ? await instructorService.uploadCourseFile(lesson.file, fileType) : null;
          lessons.push({
            title: lesson.title.trim(),
            type: lesson.kind === 'video' ? 'video' : 'text',
            content: lesson.content.trim(),
            duration: Math.max(0, Math.floor(Number(lesson.duration) || 0)),
            file,
          });
        }
        builtModules.push({ title: module.title.trim(), description: module.description.trim(), lessons });
      }
      setProgress('Creating your course…');
      const created = await instructorService.createCourse({
        course: {
          title: title.trim(), shortDescription: shortDescription.trim(), description: description.trim(), category, subcategory, level,
          price: Math.round(Number(price || '0') * 100) / 100, tags: tags.length > 0 ? tags : [category], prerequisites: cleanList(prerequisites),
          learningObjectives: cleanList(objectives),
        },
        thumbnail,
        modules: builtModules,
      });
      setResult(created.status);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      console.error('[CreateCourseScreen.handleSubmit] Error:', message || 'Unknown error');
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
          <Text style={styles.doneText}>{result === 'published' ? 'Learners can find and enrol in it now. Add quizzes and assignments from your instructor dashboard.' : 'An administrator reviews courses from instructors who are not yet verified. It will go live once approved.'}</Text>
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
            <FormField label="Course title" required value={title} onChange={setTitle} placeholder="e.g. Introduction to Web Development" hint="At least 4 characters." maxLength={200} />
            <FormField label="Short description" required value={shortDescription} onChange={setShortDescription} hint="A one-line summary shown on course cards, 10–300 characters." maxLength={300} />
            <FormField label="Detailed description" required value={description} onChange={setDescription} multiline hint="What will students learn? Who is it for? At least 50 characters." />
            <ChoiceChips label="Category" required single options={COURSE_MAIN_CATEGORIES} selected={category ? [category] : []} onToggle={handleSelectCategory} />
            {subcategories.length > 0 ? <ChoiceChips label="Subcategory" single options={subcategories} selected={subcategory ? [subcategory] : []} onToggle={setSubcategory} /> : null}
            <Segmented label="Level" options={LEVELS} value={level} onChange={setLevel} />
            <FormField label="Price (USD)" value={price} onChange={(value) => setPrice(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" hint="Use 0 for a free course. Paid courses can't be bought yet, so learners can only enrol in free ones for now." />
            <TagInput label="Tags" values={tags} onChange={setTags} placeholder="e.g. javascript" hint="Help learners find the course. Up to 20." maximum={20} />
            <ListInput label="Learning objectives" required values={objectives} onChange={setObjectives} placeholder="e.g. Build a responsive web page" hint="What learners will be able to do. Add at least one." />
            <ListInput label="Prerequisites" values={prerequisites} onChange={setPrerequisites} placeholder="e.g. Basic computer skills" hint="Optional." />

            <Text style={styles.section}>Cover image</Text>
            <Pressable accessibilityRole="button" onPress={() => void handlePickCover()} style={styles.cover}>
              {cover ? <Image source={{ uri: cover.uri }} contentFit="cover" style={styles.coverImage} /> : <><ImagePlus size={28} color={colors.mutedText} /><Text style={styles.hint}>Add a 16:9 cover (optional)</Text></>}
            </Pressable>

            <Text style={styles.section}>Modules and lessons</Text>
            {modules.map((module, moduleIndex) => (
              <View key={module.key} style={styles.moduleCard}>
                <View style={styles.moduleHeader}>
                  <TextInput accessibilityLabel={`Module ${moduleIndex + 1} title`} value={module.title} onChangeText={(value) => updateModule(module.key, { title: value })} placeholder={`Module ${moduleIndex + 1} title`} placeholderTextColor={colors.mutedText} style={[styles.input, styles.flex]} />
                  {modules.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove module ${moduleIndex + 1}`} onPress={() => setModuleToRemove(module.key)} style={styles.iconButton}><Trash2 size={18} color={colors.destructiveText} /></Pressable> : null}
                </View>
                <TextInput accessibilityLabel={`Module ${moduleIndex + 1} description`} value={module.description} onChangeText={(value) => updateModule(module.key, { description: value })} placeholder="Module description (optional)" placeholderTextColor={colors.mutedText} multiline style={[styles.input, styles.shortMultiline]} />
                {module.lessons.map((lesson, lessonIndex) => (
                  <View key={lesson.key} style={styles.lessonCard}>
                    <View style={styles.moduleHeader}>
                      <Text style={styles.lessonNumber}>Lesson {lessonIndex + 1}</Text>
                      {module.lessons.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove lesson ${lessonIndex + 1}`} hitSlop={8} onPress={() => updateModule(module.key, { lessons: module.lessons.filter((item) => item.key !== lesson.key) })}><Trash2 size={16} color={colors.mutedText} /></Pressable> : null}
                    </View>
                    <TextInput accessibilityLabel="Lesson title" value={lesson.title} onChangeText={(value) => updateLesson(module.key, lesson.key, { title: value })} placeholder="Lesson title" placeholderTextColor={colors.mutedText} style={styles.input} />
                    <View style={styles.segment}>
                      {LESSON_KINDS.map((item) => (
                        <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: lesson.kind === item.value }} onPress={() => updateLesson(module.key, lesson.key, { kind: item.value, file: null })} style={[styles.segmentOption, lesson.kind === item.value && styles.segmentActive]}>
                          {item.value === 'video' ? <Video size={14} color={lesson.kind === item.value ? colors.text : colors.mutedText} /> : <FileText size={14} color={lesson.kind === item.value ? colors.text : colors.mutedText} />}
                          <Text style={[styles.segmentText, lesson.kind === item.value && styles.segmentTextActive]}>{item.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {lesson.kind !== 'text' ? (
                      <Pressable accessibilityRole="button" onPress={() => void handlePickLessonFile(module.key, lesson)} style={styles.fileButton}>
                        <Paperclip size={18} color={lesson.file ? colors.accentText : colors.mutedText} />
                        <Text style={styles.fileText} numberOfLines={1}>{lesson.file ? lesson.file.name : lesson.kind === 'video' ? 'Attach a video (up to 50 MB)' : 'Attach a PDF or Word file (up to 50 MB)'}</Text>
                      </Pressable>
                    ) : null}
                    <TextInput
                      accessibilityLabel={lesson.kind === 'text' ? 'Lesson text' : 'Lesson notes'}
                      value={lesson.content}
                      onChangeText={(value) => updateLesson(module.key, lesson.key, { content: value })}
                      placeholder={lesson.kind === 'text' ? 'Lesson text' : 'Notes for learners (optional)'}
                      placeholderTextColor={colors.mutedText}
                      multiline
                      style={[styles.input, lesson.kind === 'text' ? styles.multiline : styles.shortMultiline]}
                    />
                    <TextInput accessibilityLabel="Duration in minutes" value={lesson.duration} onChangeText={(value) => updateLesson(module.key, lesson.key, { duration: value.replace(/[^0-9]/g, '') })} placeholder="Duration in minutes (optional)" placeholderTextColor={colors.mutedText} keyboardType="number-pad" style={styles.input} />
                  </View>
                ))}
                <Pressable accessibilityRole="button" onPress={() => updateModule(module.key, { lessons: [...module.lessons, newLesson()] })} style={styles.addButton}><Plus size={16} color={colors.accentText} /><Text style={styles.addText}>Add lesson</Text></Pressable>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setModules((current) => [...current, newModule(current.length)])} style={styles.addButton}><Plus size={16} color={colors.accentText} /><Text style={styles.addText}>Add module</Text></Pressable>
            <Text style={styles.hint}>Quizzes and assignments are added after the course is created, from your instructor dashboard.</Text>

            <ErrorList errors={errors} />
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

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 12 },
  section: { marginTop: 10, color: colors.text, fontSize: 18, fontWeight: '900' },
  hint: { color: colors.mutedText, fontSize: 12 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  shortMultiline: { minHeight: 64, textAlignVertical: 'top' },
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
  error: { color: colors.destructiveText, fontSize: 13 },
  primaryButton: { minHeight: 50, marginTop: 6, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  doneText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
