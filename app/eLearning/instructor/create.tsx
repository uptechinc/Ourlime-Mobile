import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AlertCircle, BookOpen, ChevronLeft, ChevronRight, FileText, GraduationCap, ImagePlus, Plus, Trash2, Upload, Video, X } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import CustomModal from '@/components/ui/CustomModal';
import { ChoiceChips, ErrorList, FormField, ListInput, Segmented, TagInput } from '@/components/eLearning/instructor/InstructorForm';
import CourseFileLibrary from '@/components/eLearning/instructor/CourseFileLibrary';
import CourseFilePreview from '@/components/eLearning/instructor/CourseFilePreview';
import CoursePublishReview, { type CourseChecklistItem, type CourseSummaryRow } from '@/components/eLearning/instructor/CoursePublishReview';
import CourseCreateSkeleton from '@/components/eLearning/instructor/CourseCreateSkeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { useCourseFileLibrary } from '@/lib/hooks/useCourseFileLibrary';
import { formatCourseFileSize } from '@/lib/helpers/courseFiles';
import { COURSE_MAIN_CATEGORIES, getSubcategories } from '@/lib/constants/courseCategories';
import { instructorService, type CourseLevel, type InstructorStatus, type NewCourse, type NewCourseLesson, type StagedCourseFile } from '@/lib/services/InstructorService';
import type { CourseFileKind, CourseLibraryFile } from '@/lib/types/instructor';

const LEVELS: { value: CourseLevel; label: string }[] = [{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }];
/** "Document" is a text lesson with a file attached, as the website's curriculum step stores it (both apps render it). */
type LessonKind = 'text' | 'video' | 'document';
const LESSON_KINDS: { value: LessonKind; label: string }[] = [{ value: 'text', label: 'Text' }, { value: 'video', label: 'Video' }, { value: 'document', label: 'Document' }];
const ATTACHABLE: Record<Exclude<LessonKind, 'text'>, readonly CourseFileKind[]> = { video: ['video'], document: ['pdf', 'document', 'image'] };
/** The website's four steps (CourseStepper). */
const STEPS = ['Basics', 'Content', 'Curriculum', 'Publish'] as const;
const CONTENT_MAX_WIDTH = 760;
const DEFAULT_CATEGORY = COURSE_MAIN_CATEGORIES[0];

type PickedFile = { uri: string; name: string; mimeType?: string; size?: number };
type LessonDraft = { key: string; title: string; kind: LessonKind; content: string; duration: string; fileId: string | null };
type ModuleDraft = { key: string; title: string; description: string; lessons: LessonDraft[] };
type Gate = 'loading' | 'allowed' | 'denied' | 'error';

let keyCounter = 0;
const nextKey = (): string => `draft-${Date.now()}-${keyCounter++}`;
const newLesson = (): LessonDraft => ({ key: nextKey(), title: '', kind: 'text', content: '', duration: '', fileId: null });
const newModule = (index: number): ModuleDraft => ({ key: nextKey(), title: `Module ${index + 1}`, description: '', lessons: [newLesson()] });
const cleanList = (values: string[]): string[] => values.map((value) => value.trim()).filter(Boolean);
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
};

/**
 * Create a course from the app (the website's /eLearning/courses/create): Basics, Content (file library), Curriculum
 * (modules of text, video or document lessons with library files attached) and Publish (summary and readiness checklist).
 */
export default function CreateCourseScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const library = useCourseFileLibrary();
  const [gate, setGate] = useState<Gate>('loading');
  const [instructorStatus, setInstructorStatus] = useState<InstructorStatus>('none');
  const [step, setStep] = useState(1);
  const [showMissing, setShowMissing] = useState(false);
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [subcategory, setSubcategory] = useState(getSubcategories(DEFAULT_CATEGORY)[0] ?? '');
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
  const [fileToRemove, setFileToRemove] = useState<CourseLibraryFile | null>(null);
  const [previewFile, setPreviewFile] = useState<CourseLibraryFile | null>(null);

  // Like the website, only registered instructors (pending or verified) can open the course creator.
  useEffect(() => {
    if (!activeUserId) { setGate('denied'); return; }
    let active = true;
    void instructorService.getStatus(activeUserId)
      .then((status) => { if (!active) return; setInstructorStatus(status); setGate(status === 'none' ? 'denied' : 'allowed'); })
      .catch((statusError: unknown) => {
        console.error('[CreateCourseScreen.checkInstructor] Error:', statusError instanceof Error ? statusError.message : 'Unknown error');
        if (active) setGate('error');
      });
    return () => { active = false; };
  }, [activeUserId]);

  const subcategories = getSubcategories(category);
  const totalLessons = modules.reduce((count, courseModule) => count + courseModule.lessons.length, 0);
  const totalMinutes = modules.reduce((sum, courseModule) => sum + courseModule.lessons.reduce((lessonSum, lesson) => lessonSum + (Number(lesson.duration) || 0), 0), 0);
  const readyFiles = library.files.filter((file) => file.status === 'ready');

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

  /** Attaches a library file; a video's length fills an empty duration (like the website). */
  const handleAttach = (moduleKey: string, lesson: LessonDraft, file: CourseLibraryFile) => {
    updateLesson(moduleKey, lesson.key, {
      fileId: lesson.fileId === file.id ? null : file.id,
      ...(lesson.fileId !== file.id && file.durationMinutes && !lesson.duration ? { duration: String(file.durationMinutes) } : {}),
    });
  };

  /** Uploads a new file into the library and attaches it to the lesson straight away (the website's per-module Upload). */
  const handleUploadForLesson = async (moduleKey: string, lesson: LessonDraft) => {
    const added = lesson.kind === 'video' ? await library.addMedia('videos', false) : await library.addDocuments(false);
    const file = added[0];
    if (!file) return;
    updateLesson(moduleKey, lesson.key, {
      fileId: file.id,
      ...(file.durationMinutes && !lesson.duration ? { duration: String(file.durationMinutes) } : {}),
      ...(!lesson.title.trim() ? { title: file.name.replace(/\.[^/.]+$/, '') } : {}),
    });
  };

  const handleRemoveFile = () => {
    if (!fileToRemove) return;
    library.remove(fileToRemove.id);
    setModules((current) => current.map((item) => ({ ...item, lessons: item.lessons.map((lesson) => (lesson.fileId === fileToRemove.id ? { ...lesson, fileId: null } : lesson)) })));
    if (previewFile?.id === fileToRemove.id) setPreviewFile(null);
    setFileToRemove(null);
  };

  // Step 1: the website's minimums (course create page).
  const basicsMissing = (): string[] => {
    const found: string[] = [];
    if (title.trim().length < 4) found.push('Course title must contain at least 4 characters.');
    if (shortDescription.trim().length < 10) found.push('Short description must contain at least 10 characters.');
    if (description.trim().length < 50) found.push('Detailed description must contain at least 50 characters.');
    if (cleanList(objectives).length === 0) found.push('Add at least one learning objective.');
    const priceValue = Number(price || '0');
    if (!Number.isFinite(priceValue) || priceValue < 0 || priceValue > 100000) found.push('Enter a price from 0 to 100000 (0 for a free course).');
    return found;
  };

  // Step 3: at least one module (website) plus what the server needs for each lesson.
  const curriculumMissing = (): string[] => {
    const found: string[] = [];
    if (modules.length === 0) found.push('Add at least one curriculum module.');
    modules.forEach((courseModule, moduleIndex) => {
      if (!courseModule.title.trim()) found.push(`Module ${moduleIndex + 1} needs a title.`);
      if (courseModule.lessons.length === 0) found.push(`Module ${moduleIndex + 1} needs at least one lesson.`);
      courseModule.lessons.forEach((lesson, lessonIndex) => {
        const label = `Module ${moduleIndex + 1}, lesson ${lessonIndex + 1}`;
        const file = library.find(lesson.fileId);
        if (!lesson.title.trim()) found.push(`${label} needs a title.`);
        if (lesson.kind === 'text' && !lesson.content.trim()) found.push(`${label} needs its text.`);
        if (lesson.kind !== 'text' && !file && !/^https:\/\//.test(lesson.content.trim())) found.push(`${label} needs a file or a link.`);
        if (file?.status === 'uploading') found.push(`${label}: wait for ${file.name} to finish uploading.`);
        if (file?.status === 'error') found.push(`${label}: ${file.name} failed to upload. Remove it and upload it again.`);
      });
    });
    return found;
  };

  const missingFor = (stepNumber: number): string[] => (stepNumber === 1 ? basicsMissing() : stepNumber === 3 ? curriculumMissing() : []);
  const missing = missingFor(step);

  const checklist: CourseChecklistItem[] = [
    { label: 'Course title provided', done: title.trim().length >= 4 },
    { label: 'Short description provided', done: shortDescription.trim().length >= 10 },
    { label: 'Detailed description provided', done: description.trim().length >= 50 },
    { label: 'Category selected', done: Boolean(category) },
    { label: 'At least one module', done: modules.length > 0 },
    { label: 'At least one lesson', done: totalLessons > 0 },
    { label: 'Learning objectives defined', done: cleanList(objectives).length > 0 },
  ];
  const summary: CourseSummaryRow[] = [
    { label: 'Title', value: title.trim() || '—' },
    { label: 'Category', value: subcategory ? `${category} · ${subcategory}` : category },
    { label: 'Level', value: LEVELS.find((item) => item.value === level)?.label ?? level },
    { label: 'Price', value: Number(price || '0') > 0 ? `$${Number(price).toFixed(2)}` : 'Free' },
    { label: 'Modules', value: String(modules.length) },
    { label: 'Lessons', value: String(totalLessons) },
    { label: 'Duration', value: formatMinutes(totalMinutes) },
    { label: 'Files', value: String(readyFiles.length) },
  ];

  const goToStep = (next: number) => {
    setShowMissing(false);
    setErrors([]);
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleNext = () => {
    if (missing.length > 0) { setShowMissing(true); return; }
    goToStep(Math.min(STEPS.length, step + 1));
  };

  const handleSubmit = async () => {
    const found = [...basicsMissing(), ...curriculumMissing(), ...checklist.filter((item) => !item.done).map((item) => `${item.label.replace(/ provided| selected| defined/, '')} is missing.`)];
    const unique = Array.from(new Set(found));
    setErrors(unique);
    setSubmitError(null);
    if (unique.length > 0) return;
    try {
      setProgress('Uploading cover…');
      const thumbnail: StagedCourseFile | null = cover ? await instructorService.uploadCourseFile(cover, 'image') : null;
      const builtModules: NewCourse['modules'] = modules.map((courseModule) => ({
        title: courseModule.title.trim(),
        description: courseModule.description.trim(),
        lessons: courseModule.lessons.map((lesson): NewCourseLesson => {
          const file = lesson.kind === 'text' ? undefined : library.find(lesson.fileId);
          return {
            title: lesson.title.trim(),
            type: lesson.kind === 'video' ? 'video' : 'text',
            content: lesson.content.trim(),
            duration: Math.max(0, Math.floor(Number(lesson.duration) || 0)),
            file: file?.status === 'ready' && file.path ? { path: file.path, name: file.name, type: file.kind, size: file.size } : null,
          };
        }),
      }));
      setProgress('Publishing your course…');
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
      setSubmitError(message.includes('instructor') ? 'Register as an instructor before creating a course.' : `The course could not be published${message ? `: ${message}` : '.'} Check your connection and try again.`);
    } finally {
      setProgress(null);
    }
  };

  if (gate === 'loading') {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <PageHeader title="New course" onBackPress={() => router.back()} />
        <CourseCreateSkeleton />
      </SafeAreaView>
    );
  }

  if (gate !== 'allowed') {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <PageHeader title="New course" onBackPress={() => router.back()} />
        <View style={styles.done}>
          <GraduationCap size={44} color={colors.accent} />
          <Text style={styles.doneTitle}>{gate === 'error' ? 'Something went wrong' : 'Instructor access required'}</Text>
          <Text style={styles.doneText}>{gate === 'error' ? 'We could not check your instructor account. Check your connection and try again.' : 'You need to register as an instructor to create and publish courses.'}</Text>
          {gate === 'denied' ? (
            <Pressable accessibilityRole="button" onPress={() => router.replace('/eLearning/instructor/register' as Href)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Become an instructor</Text></Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Go back</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (result) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <PageHeader title="Course created" onBackPress={() => router.back()} />
        <View style={styles.done}>
          <BookOpen size={44} color={colors.accent} />
          <Text style={styles.doneTitle}>{result === 'published' ? 'Your course is live' : 'Sent for review'}</Text>
          <Text style={styles.doneText}>{result === 'published' ? 'Learners can find and enrol in it now. Add quizzes and assignments from your instructor dashboard.' : 'Your course was saved and will be published once an administrator verifies your instructor profile.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/eLearning/instructor' as Href)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to instructor dashboard</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const columnWidth = Math.min(width, CONTENT_MAX_WIDTH);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <PageHeader title="New course" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.flex}>
        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.column, { width: columnWidth }]}>
            <View accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of ${STEPS.length}: ${STEPS[step - 1]}`} style={styles.stepper}>
              {STEPS.map((label, index) => {
                const stepNumber = index + 1;
                const isDone = stepNumber < step;
                const isActive = stepNumber === step;
                return (
                  <Pressable key={label} accessibilityRole="button" accessibilityLabel={`Go to ${label}`} disabled={stepNumber >= step} onPress={() => goToStep(stepNumber)} style={styles.stepItem}>
                    <View style={[styles.stepBar, (isDone || isActive) && styles.stepBarActive]} />
                    <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]} numberOfLines={1}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {instructorStatus === 'pending' ? <Text style={styles.notice}>Your instructor profile is waiting for verification, so this course will be sent for review when you publish it.</Text> : null}

            {step === 1 ? (
              <>
                <Text style={styles.section}>Basics</Text>
                <FormField label="Course title" required value={title} onChange={setTitle} placeholder="e.g. Financial Literacy Basics" hint="At least 4 characters." maxLength={200} />
                <ChoiceChips label="Category" required single options={COURSE_MAIN_CATEGORIES} selected={category ? [category] : []} onToggle={handleSelectCategory} />
                {subcategories.length > 0 ? <ChoiceChips label="Subcategory" single options={subcategories} selected={subcategory ? [subcategory] : []} onToggle={setSubcategory} /> : null}
                <FormField label="Short description" required value={shortDescription} onChange={setShortDescription} placeholder="One-line course summary" hint="A one-line summary, 10–300 characters." maxLength={300} />
                <FormField label="Detailed description" required value={description} onChange={setDescription} multiline placeholder="Describe the course in detail" hint="What will students learn? Who is it for? At least 50 characters." />
                <Segmented label="Level" options={LEVELS} value={level} onChange={setLevel} />
                <FormField label="Price (USD)" value={price} onChange={(value) => setPrice(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0 for free course" hint="Use 0 for a free course. Paid courses can't be bought yet, so learners can only enrol in free ones for now." />
                <Text style={styles.label}>Thumbnail</Text>
                {cover ? (
                  <View style={styles.coverRow}>
                    <Image source={{ uri: cover.uri }} contentFit="cover" style={styles.coverThumb} />
                    <View style={styles.flex}>
                      <Text style={styles.fileName} numberOfLines={1}>{cover.name}</Text>
                      {cover.size ? <Text style={styles.hint}>{formatCourseFileSize(cover.size)}</Text> : null}
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Remove thumbnail" hitSlop={8} onPress={() => setCover(null)} style={styles.iconButton}><X size={18} color={colors.mutedText} /></Pressable>
                  </View>
                ) : (
                  <Pressable accessibilityRole="button" onPress={() => void handlePickCover()} style={styles.cover}>
                    <ImagePlus size={28} color={colors.mutedText} />
                    <Text style={styles.fileName}>Upload thumbnail</Text>
                    <Text style={styles.hint}>A 16:9 image (optional)</Text>
                  </Pressable>
                )}
                <TagInput label="Tags" values={tags} onChange={setTags} placeholder="Add a tag" hint="Help learners find the course. Up to 20." maximum={20} />
                <ListInput label="Learning objectives" required values={objectives} onChange={setObjectives} placeholder="Add a learning objective" hint="What learners will be able to do. Add at least one." />
                <ListInput label="Prerequisites" values={prerequisites} onChange={setPrerequisites} placeholder="Add a prerequisite" hint="Optional." />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={styles.section}>Content</Text>
                <CourseFileLibrary
                  files={library.files}
                  error={library.error}
                  onAddMedia={() => void library.addMedia('all', true)}
                  onAddDocuments={() => void library.addDocuments(true)}
                  onPreview={setPreviewFile}
                  onRemove={setFileToRemove}
                />
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Text style={styles.section}>Curriculum</Text>
                <Text style={styles.hint}>Group your lessons into modules. Video and document lessons use files from your library, or upload one here.</Text>
                {modules.length === 0 ? <View style={styles.emptyBox}><Text style={styles.hint}>No modules created yet. Add your first module below.</Text></View> : null}
                {modules.map((courseModule, moduleIndex) => (
                  <View key={courseModule.key} style={styles.moduleCard}>
                    <View style={styles.moduleHeader}>
                      <TextInput accessibilityLabel={`Module ${moduleIndex + 1} title`} value={courseModule.title} onChangeText={(value) => updateModule(courseModule.key, { title: value })} placeholder={`Module ${moduleIndex + 1} title`} placeholderTextColor={colors.mutedText} style={[styles.input, styles.flex]} />
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove module ${moduleIndex + 1}`} onPress={() => setModuleToRemove(courseModule.key)} style={styles.iconButtonBordered}><Trash2 size={18} color={colors.destructiveText} /></Pressable>
                    </View>
                    <TextInput accessibilityLabel={`Module ${moduleIndex + 1} description`} value={courseModule.description} onChangeText={(value) => updateModule(courseModule.key, { description: value })} placeholder="Module description (optional)" placeholderTextColor={colors.mutedText} multiline style={[styles.input, styles.shortMultiline]} />
                    {courseModule.lessons.length === 0 ? <Text style={[styles.hint, styles.centerText]}>No lessons in this module yet.</Text> : null}
                    {courseModule.lessons.map((lesson, lessonIndex) => {
                      const attached = library.find(lesson.fileId);
                      const options = lesson.kind === 'text' ? [] : library.files.filter((file) => ATTACHABLE[lesson.kind as Exclude<LessonKind, 'text'>].includes(file.kind) && file.status !== 'error');
                      return (
                        <View key={lesson.key} style={styles.lessonCard}>
                          <View style={styles.moduleHeader}>
                            <Text style={styles.lessonNumber}>Lesson {lessonIndex + 1}</Text>
                            <Pressable accessibilityRole="button" accessibilityLabel={`Remove lesson ${lessonIndex + 1}`} hitSlop={8} onPress={() => updateModule(courseModule.key, { lessons: courseModule.lessons.filter((item) => item.key !== lesson.key) })}><Trash2 size={16} color={colors.mutedText} /></Pressable>
                          </View>
                          <TextInput accessibilityLabel="Lesson title" value={lesson.title} onChangeText={(value) => updateLesson(courseModule.key, lesson.key, { title: value })} placeholder="Lesson title" placeholderTextColor={colors.mutedText} style={styles.input} />
                          <View style={styles.segment}>
                            {LESSON_KINDS.map((item) => (
                              <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: lesson.kind === item.value }} onPress={() => updateLesson(courseModule.key, lesson.key, { kind: item.value, fileId: null })} style={[styles.segmentOption, lesson.kind === item.value && styles.segmentActive]}>
                                {item.value === 'video' ? <Video size={14} color={lesson.kind === item.value ? colors.text : colors.mutedText} /> : <FileText size={14} color={lesson.kind === item.value ? colors.text : colors.mutedText} />}
                                <Text style={[styles.segmentText, lesson.kind === item.value && styles.segmentTextActive]}>{item.label}</Text>
                              </Pressable>
                            ))}
                          </View>
                          {lesson.kind !== 'text' ? (
                            <View style={styles.attachBlock}>
                              <Text style={styles.attachLabel}>{attached ? `Attached: ${attached.name}${attached.status === 'uploading' ? ' (uploading…)' : ''}` : lesson.kind === 'video' ? 'Attach a video' : 'Attach a PDF, Word file or image'}</Text>
                              {options.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachChips}>
                                  {options.map((file) => {
                                    const isSelected = lesson.fileId === file.id;
                                    return (
                                      <Pressable key={file.id} accessibilityRole="radio" accessibilityState={{ checked: isSelected }} accessibilityLabel={`Attach ${file.name}`} onPress={() => handleAttach(courseModule.key, lesson, file)} style={[styles.attachChip, isSelected && styles.attachChipActive]}>
                                        {file.kind === 'video' ? <Video size={13} color={isSelected ? colors.onAccent : colors.mutedText} /> : <FileText size={13} color={isSelected ? colors.onAccent : colors.mutedText} />}
                                        <Text style={[styles.attachChipText, isSelected && styles.attachChipTextActive]} numberOfLines={1}>{file.name}</Text>
                                      </Pressable>
                                    );
                                  })}
                                </ScrollView>
                              ) : null}
                              <Pressable accessibilityRole="button" onPress={() => void handleUploadForLesson(courseModule.key, lesson)} style={styles.fileButton}>
                                <Upload size={16} color={colors.mutedText} />
                                <Text style={styles.fileText}>{lesson.kind === 'video' ? 'Upload a video (up to 50 MB)' : 'Upload a PDF or Word file (up to 50 MB)'}</Text>
                              </Pressable>
                            </View>
                          ) : null}
                          <TextInput
                            accessibilityLabel={lesson.kind === 'text' ? 'Lesson text' : 'Lesson notes'}
                            value={lesson.content}
                            onChangeText={(value) => updateLesson(courseModule.key, lesson.key, { content: value })}
                            placeholder={lesson.kind === 'text' ? 'Lesson text' : 'Notes for learners, or an https:// link (optional with a file)'}
                            placeholderTextColor={colors.mutedText}
                            multiline
                            style={[styles.input, lesson.kind === 'text' ? styles.multiline : styles.shortMultiline]}
                          />
                          <TextInput accessibilityLabel="Duration in minutes" value={lesson.duration} onChangeText={(value) => updateLesson(courseModule.key, lesson.key, { duration: value.replace(/[^0-9]/g, '') })} placeholder="Duration in minutes (optional)" placeholderTextColor={colors.mutedText} keyboardType="number-pad" style={styles.input} />
                        </View>
                      );
                    })}
                    <Pressable accessibilityRole="button" onPress={() => updateModule(courseModule.key, { lessons: [...courseModule.lessons, newLesson()] })} style={styles.addButton}><Plus size={16} color={colors.accentText} /><Text style={styles.addText}>Add lesson</Text></Pressable>
                  </View>
                ))}
                <Pressable accessibilityRole="button" onPress={() => setModules((current) => [...current, newModule(current.length)])} style={styles.addButton}><Plus size={16} color={colors.accentText} /><Text style={styles.addText}>Add module</Text></Pressable>
                <Text style={styles.hint}>Quizzes and assignments are added after the course is created, from your instructor dashboard.</Text>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <Text style={styles.section}>Publish</Text>
                <CoursePublishReview summary={summary} checklist={checklist} />
                <ErrorList errors={errors} />
                {submitError ? <Text accessibilityRole="alert" style={styles.error}>{submitError}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(progress) || checklist.some((item) => !item.done)}
                  onPress={() => void handleSubmit()}
                  style={[styles.primaryButton, (Boolean(progress) || checklist.some((item) => !item.done)) && styles.disabled]}
                >
                  <Text style={styles.primaryButtonText}>{progress ?? 'Publish course'}</Text>
                </Pressable>
              </>
            ) : null}

            {step < STEPS.length && showMissing && missing.length > 0 ? (
              <View accessibilityRole="alert" style={styles.missingBox}>
                <AlertCircle size={16} color={colors.warningText} />
                <View style={styles.flex}>
                  <Text style={styles.missingTitle}>To continue, complete the following:</Text>
                  {missing.slice(0, 8).map((item) => <Text key={item} style={styles.missingItem}>• {item}</Text>)}
                </View>
              </View>
            ) : null}
            <View style={styles.navRow}>
              <Pressable accessibilityRole="button" disabled={step === 1 || Boolean(progress)} onPress={() => goToStep(Math.max(1, step - 1))} style={[styles.navButton, styles.flex, (step === 1 || Boolean(progress)) && styles.disabled]}>
                <ChevronLeft size={16} color={colors.text} /><Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              {step < STEPS.length ? (
                <Pressable accessibilityRole="button" onPress={handleNext} style={[styles.navButton, styles.navPrimary, styles.flex]}>
                  <Text style={styles.primaryButtonText}>Next</Text><ChevronRight size={16} color={colors.onAccent} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardSafeView>
      <CourseFilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
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
      <CustomModal
        visible={Boolean(fileToRemove)}
        type="warning"
        title="Remove this file?"
        message={`"${fileToRemove?.name ?? ''}" will be removed from your library and from any lesson it is attached to.`}
        confirmText="Remove"
        cancelText="Keep"
        onConfirm={handleRemoveFile}
        onCancel={() => setFileToRemove(null)}
        onClose={() => setFileToRemove(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 12 },
  stepper: { flexDirection: 'row', gap: 6 },
  stepItem: { flex: 1, gap: 6 },
  stepBar: { height: 5, borderRadius: 3, backgroundColor: colors.control },
  stepBarActive: { backgroundColor: colors.accent },
  stepLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  stepLabelActive: { color: colors.text, fontWeight: '900' },
  notice: { padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.warningSurface, color: colors.warningText, fontSize: 13, lineHeight: 19 },
  section: { marginTop: 4, color: colors.text, fontSize: 20, fontWeight: '900' },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  centerText: { textAlign: 'center', paddingVertical: 8 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  shortMultiline: { minHeight: 64, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.control },
  segmentOption: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.mutedText, fontSize: 13, fontWeight: '800' },
  segmentTextActive: { color: colors.text },
  cover: { aspectRatio: 16 / 9, maxHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  coverRow: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  coverThumb: { width: 112, height: 63, borderRadius: 8 },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  emptyBox: { paddingVertical: 24, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  moduleCard: { padding: 12, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconButtonBordered: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  lessonCard: { padding: 12, gap: 8, borderRadius: 14, backgroundColor: colors.canvas },
  lessonNumber: { flex: 1, color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  attachBlock: { gap: 8 },
  attachLabel: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  attachChips: { gap: 8 },
  attachChip: { maxWidth: 220, minHeight: 36, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  attachChipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  attachChipText: { flexShrink: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
  attachChipTextActive: { color: colors.onAccent },
  fileButton: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  fileText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  addButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  addText: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  error: { color: colors.destructiveText, fontSize: 13 },
  missingBox: { padding: 12, flexDirection: 'row', gap: 8, borderRadius: 12, backgroundColor: colors.warningSurface },
  missingTitle: { color: colors.warningText, fontSize: 13, fontWeight: '800' },
  missingItem: { marginTop: 2, color: colors.warningText, fontSize: 12, lineHeight: 17 },
  navRow: { marginTop: 4, flexDirection: 'row', gap: 10 },
  navButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  navPrimary: { borderColor: colors.accent, backgroundColor: colors.accent },
  primaryButton: { minHeight: 50, marginTop: 6, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 46, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  doneText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
