import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AlertCircle, BookOpen, ChevronLeft, Clock, FileText, GraduationCap, ImagePlus, Plus, Trash2, Upload, Video, X } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import { ChoiceChips, ErrorList, FieldMessage, FormField, FormSection, ListInput, Segmented, TagInput } from '@/components/eLearning/instructor/InstructorForm';
import CourseFileLibrary from '@/components/eLearning/instructor/CourseFileLibrary';
import CourseFilePreview from '@/components/eLearning/instructor/CourseFilePreview';
import CoursePublishReview, { type CourseChecklistItem, type CourseSummaryRow } from '@/components/eLearning/instructor/CoursePublishReview';
import CourseCreateSkeleton from '@/components/eLearning/instructor/CourseCreateSkeleton';
import { ELearningButton, ELearningEmptyState, ELearningHeader, ELearningScrollView, ELEARNING_ACTION_GREEN, ELEARNING_GUTTER, StepProgress, StickyActionBar } from '@/components/eLearning/ELearningParts';
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
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

type PickedFile = { uri: string; name: string; mimeType?: string; size?: number };
type LessonDraft = { key: string; title: string; kind: LessonKind; content: string; duration: string; fileId: string | null };
type ModuleDraft = { key: string; title: string; description: string; lessons: LessonDraft[] };
type Gate = 'loading' | 'allowed' | 'denied' | 'error';
type BasicsField = 'title' | 'shortDescription' | 'description' | 'objectives' | 'price';
/** A curriculum problem, tied to the module or lesson card it belongs to so it can show there. */
type CurriculumIssue = { key: string; message: string };
type LessonRemoval = { moduleKey: string; lessonKey: string };

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
 * The step bar and the Back / Next bar stay on screen; problems show on the fields they belong to.
 */
export default function CreateCourseScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
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
  const [lessonToRemove, setLessonToRemove] = useState<LessonRemoval | null>(null);
  const [fileToRemove, setFileToRemove] = useState<CourseLibraryFile | null>(null);
  const [previewFile, setPreviewFile] = useState<CourseLibraryFile | null>(null);
  const [isLeaveVisible, setIsLeaveVisible] = useState(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);

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

  // Nothing is saved until Publish, so leaving with work in progress (back gesture, button or the header arrow) asks first.
  const hasWork = Boolean(title.trim() || shortDescription.trim() || description.trim() || cover || library.files.length > 0
    || modules.some((courseModule) => courseModule.lessons.some((lesson) => lesson.title.trim() || lesson.content.trim())));
  const shouldConfirmLeave = gate === 'allowed' && !result && hasWork;
  const shouldConfirmLeaveRef = useRef(shouldConfirmLeave);
  shouldConfirmLeaveRef.current = shouldConfirmLeave && !progress;
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!shouldConfirmLeaveRef.current) return;
    event.preventDefault();
    pendingLeaveRef.current = () => navigation.dispatch(event.data.action);
    setIsLeaveVisible(true);
  }), [navigation]);

  const subcategories = getSubcategories(category);
  const totalLessons = modules.reduce((count, courseModule) => count + courseModule.lessons.length, 0);
  const totalMinutes = modules.reduce((sum, courseModule) => sum + courseModule.lessons.reduce((lessonSum, lesson) => lessonSum + (Number(lesson.duration) || 0), 0), 0);
  const readyFiles = library.files.filter((file) => file.status === 'ready');

  const updateModule = (key: string, change: Partial<ModuleDraft>) => setModules((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  const updateLesson = (moduleKey: string, lessonKey: string, change: Partial<LessonDraft>) =>
    setModules((current) => current.map((item) => (item.key === moduleKey ? { ...item, lessons: item.lessons.map((lesson) => (lesson.key === lessonKey ? { ...lesson, ...change } : lesson)) } : item)));
  const removeLesson = ({ moduleKey, lessonKey }: LessonRemoval) =>
    setModules((current) => current.map((item) => (item.key === moduleKey ? { ...item, lessons: item.lessons.filter((lesson) => lesson.key !== lessonKey) } : item)));

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

  const handleRequestRemoveLesson = (moduleKey: string, lesson: LessonDraft) => {
    // An empty lesson goes straight away; one with writing in it asks first.
    if (!lesson.title.trim() && !lesson.content.trim() && !lesson.fileId) removeLesson({ moduleKey, lessonKey: lesson.key });
    else setLessonToRemove({ moduleKey, lessonKey: lesson.key });
  };

  // Step 1: the website's minimums (course create page), keyed by field so each shows under its input.
  const basicsErrors = (): Partial<Record<BasicsField, string>> => {
    const found: Partial<Record<BasicsField, string>> = {};
    if (title.trim().length < 4) found.title = 'Course title must contain at least 4 characters.';
    if (shortDescription.trim().length < 10) found.shortDescription = 'Short description must contain at least 10 characters.';
    if (description.trim().length < 50) found.description = 'Detailed description must contain at least 50 characters.';
    if (cleanList(objectives).length === 0) found.objectives = 'Add at least one learning objective.';
    const priceValue = Number(price || '0');
    if (!Number.isFinite(priceValue) || priceValue < 0 || priceValue > 100000) found.price = 'Enter a price from 0 to 100000 (0 for a free course).';
    return found;
  };
  const basicsMissing = (): string[] => Object.values(basicsErrors()).filter((message): message is string => Boolean(message));

  // Step 3: at least one module (website) plus what the server needs for each lesson.
  const curriculumIssues = (): CurriculumIssue[] => {
    const found: CurriculumIssue[] = [];
    if (modules.length === 0) found.push({ key: 'course', message: 'Add at least one curriculum module.' });
    modules.forEach((courseModule, moduleIndex) => {
      if (!courseModule.title.trim()) found.push({ key: courseModule.key, message: `Module ${moduleIndex + 1} needs a title.` });
      if (courseModule.lessons.length === 0) found.push({ key: courseModule.key, message: `Module ${moduleIndex + 1} needs at least one lesson.` });
      courseModule.lessons.forEach((lesson, lessonIndex) => {
        const label = `Module ${moduleIndex + 1}, lesson ${lessonIndex + 1}`;
        const file = library.find(lesson.fileId);
        if (!lesson.title.trim()) found.push({ key: lesson.key, message: `${label} needs a title.` });
        if (lesson.kind === 'text' && !lesson.content.trim()) found.push({ key: lesson.key, message: `${label} needs its text.` });
        if (lesson.kind !== 'text' && !file && !/^https:\/\//.test(lesson.content.trim())) found.push({ key: lesson.key, message: `${label} needs a file or a link.` });
        if (file?.status === 'uploading') found.push({ key: lesson.key, message: `${label}: wait for ${file.name} to finish uploading.` });
        if (file?.status === 'error') found.push({ key: lesson.key, message: `${label}: ${file.name} failed to upload. Remove it and upload it again.` });
      });
    });
    return found;
  };
  const curriculumMissing = (): string[] => curriculumIssues().map((issue) => issue.message);

  const missingFor = (stepNumber: number): string[] => (stepNumber === 1 ? basicsMissing() : stepNumber === 3 ? curriculumMissing() : []);
  const missing = missingFor(step);
  const fieldErrors = showMissing && step === 1 ? basicsErrors() : {};
  // On a card the "Module 1, lesson 2" prefix is redundant: "Needs a title.", "Wait for clip.mp4 to finish uploading."
  const issuesFor = (key: string): string[] => (showMissing && step === 3
    ? curriculumIssues().filter((issue) => issue.key === key).map((issue) => {
      const text = issue.message.replace(/^Module \d+, lesson \d+:? ?/, '');
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    : []);

  const checklist: CourseChecklistItem[] = [
    { label: 'Course title provided', done: title.trim().length >= 4 },
    { label: 'Short description provided', done: shortDescription.trim().length >= 10 },
    { label: 'Detailed description provided', done: description.trim().length >= 50 },
    { label: 'Category selected', done: Boolean(category) },
    { label: 'At least one module', done: modules.length > 0 },
    { label: 'At least one lesson', done: totalLessons > 0 },
    { label: 'Learning objectives defined', done: cleanList(objectives).length > 0 },
  ];
  const isChecklistDone = checklist.every((item) => item.done);
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

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });

  const goToStep = (next: number) => {
    setShowMissing(false);
    setErrors([]);
    setStep(next);
    scrollToTop();
  };

  const handleNext = () => {
    if (missing.length > 0) { setShowMissing(true); scrollToTop(); return; }
    goToStep(Math.min(STEPS.length, step + 1));
  };

  const handleSubmit = async () => {
    const found = [...basicsMissing(), ...curriculumMissing(), ...checklist.filter((item) => !item.done).map((item) => `${item.label.replace(/ provided| selected| defined/, '')} is missing.`)];
    const unique = Array.from(new Set(found));
    setErrors(unique);
    setSubmitError(null);
    if (unique.length > 0) { scrollToTop(); return; }
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
      setProgress('Publishing…');
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
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ELearningHeader title="New course" onBack={() => router.back()} />
        <CourseCreateSkeleton />
      </SafeAreaView>
    );
  }

  if (gate !== 'allowed') {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ELearningHeader title="New course" onBack={() => router.back()} />
        <View style={styles.centerFill}>
          <ELearningEmptyState
            icon={<GraduationCap size={44} color={colors.accentText} />}
            title={gate === 'error' ? 'Something went wrong' : 'Instructor access required'}
            hint={gate === 'error' ? 'We could not check your instructor account. Check your connection and try again.' : 'Register as an instructor to create and publish courses.'}
            actionLabel={gate === 'denied' ? 'Become an instructor' : undefined}
            onAction={gate === 'denied' ? () => router.replace('/eLearning/instructor/register' as Href) : undefined}
            secondaryActionLabel="Go back"
            onSecondaryAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (result) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ELearningHeader title="Course created" onBack={() => router.back()} />
        <View style={styles.centerFill}>
          <ELearningEmptyState
            icon={result === 'published' ? <BookOpen size={44} color={colors.accentText} /> : <Clock size={44} color={colors.warningText} />}
            title={result === 'published' ? 'Your course is live' : 'Sent for review'}
            hint={result === 'published' ? 'Learners can find and enrol in it now. Add quizzes and assignments from your instructor dashboard.' : 'Your course was saved and will be published once an administrator verifies your instructor profile.'}
            actionLabel="Back to instructor dashboard"
            onAction={() => router.replace('/eLearning/instructor' as Href)}
          />
        </View>
      </SafeAreaView>
    );
  }

  const columnWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const isPublishStep = step === STEPS.length;
  const barNote = isPublishStep && !isChecklistDone ? 'Complete every item on the checklist to publish.' : progress;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title="New course" subtitle={title.trim() || undefined} onBack={() => router.back()} />
      <StepProgress steps={STEPS} current={step - 1} onStepPress={progress ? undefined : (index) => goToStep(index + 1)} />
      <KeyboardSafeView style={styles.flex}>
        <ELearningScrollView scrollRef={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.column, { width: columnWidth }]}>
            {instructorStatus === 'pending' ? (
              <View style={styles.notice}>
                <Clock size={16} color={colors.warningText} />
                <Text style={[styles.noticeText, styles.flexText]}>Your instructor profile is waiting for verification, so this course will be sent for review when you publish it.</Text>
              </View>
            ) : null}
            {step < STEPS.length && showMissing && missing.length > 0 ? (
              <ErrorList errors={missing} title={`Fix ${missing.length === 1 ? 'this' : `these ${missing.length}`} to continue`} />
            ) : null}

            {step === 1 ? (
              <>
                <FormSection title="Course details" description="What learners see first in the catalog.">
                  <FormField label="Course title" required value={title} onChange={setTitle} placeholder="e.g. Financial Literacy Basics" hint="At least 4 characters." maxLength={200} minLength={4} error={fieldErrors.title} />
                  <FormField label="Short description" required value={shortDescription} onChange={setShortDescription} placeholder="One-line course summary" hint="A one-line summary, 10–300 characters." maxLength={300} minLength={10} error={fieldErrors.shortDescription} />
                  <FormField label="Detailed description" required value={description} onChange={setDescription} multiline placeholder="Describe the course in detail" hint="What will learners learn? Who is it for?" minLength={50} error={fieldErrors.description} />
                </FormSection>

                <FormSection title="Category and level">
                  <ChoiceChips label="Category" required single options={COURSE_MAIN_CATEGORIES} selected={category ? [category] : []} onToggle={handleSelectCategory} />
                  {subcategories.length > 0 ? <ChoiceChips label="Subcategory" single options={subcategories} selected={subcategory ? [subcategory] : []} onToggle={setSubcategory} /> : null}
                  <Segmented label="Level" options={LEVELS} value={level} onChange={setLevel} />
                </FormSection>

                <FormSection title="Price and thumbnail">
                  <FormField label="Price (USD)" hideOptional value={price} onChange={(value) => setPrice(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" hint="Use 0 for a free course. Paid courses can't be bought yet, so learners can only enrol in free ones for now." error={fieldErrors.price} />
                  <View style={styles.field}>
                    <Text style={styles.label}>Thumbnail <Text style={styles.optional}>(optional)</Text></Text>
                    {cover ? (
                      <View style={styles.coverRow}>
                        <Image source={{ uri: cover.uri }} contentFit="cover" style={styles.coverThumb} />
                        <View style={styles.flexText}>
                          <Text style={styles.fileName} numberOfLines={2}>{cover.name}</Text>
                          {cover.size ? <Text style={styles.hint}>{formatCourseFileSize(cover.size)}</Text> : null}
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel="Remove thumbnail" onPress={() => setCover(null)} android_ripple={RIPPLE} style={styles.iconButton}><X size={20} color={colors.mutedText} /></Pressable>
                      </View>
                    ) : (
                      <Pressable accessibilityRole="button" accessibilityLabel="Upload a thumbnail" onPress={() => void handlePickCover()} android_ripple={RIPPLE} style={styles.cover}>
                        <ImagePlus size={26} color={colors.mutedText} />
                        <Text style={styles.fileName}>Upload thumbnail</Text>
                        <Text style={styles.hint}>A 16:9 image from your gallery</Text>
                      </Pressable>
                    )}
                  </View>
                </FormSection>

                <FormSection title="Learning goals">
                  <ListInput label="Learning objectives" required values={objectives} onChange={setObjectives} placeholder="e.g. Build a monthly budget" hint="What learners will be able to do. Add at least one." error={fieldErrors.objectives} />
                  <ListInput label="Prerequisites" values={prerequisites} onChange={setPrerequisites} placeholder="e.g. Basic arithmetic" />
                  <TagInput label="Tags" values={tags} onChange={setTags} placeholder="Add a tag" hint="Help learners find the course. Up to 20." maximum={20} />
                </FormSection>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={styles.stepIntro}>Upload the videos and documents your lessons use. You can attach them to lessons in the next step, or skip this and upload from a lesson.</Text>
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
                <Text style={styles.stepIntro}>
                  Group your lessons into modules. {pluralizeText(modules.length, 'module')} · {pluralizeText(totalLessons, 'lesson')}{totalMinutes > 0 ? ` · ${formatMinutes(totalMinutes)}` : ''}
                </Text>
                {modules.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTitle}>No modules yet</Text>
                    <Text style={[styles.hint, styles.centerText]}>A module groups related lessons, like a chapter.</Text>
                  </View>
                ) : null}
                {modules.map((courseModule, moduleIndex) => {
                  const moduleIssues = issuesFor(courseModule.key);
                  return (
                    <View key={courseModule.key} style={[styles.moduleCard, moduleIssues.length > 0 && styles.cardError]}>
                      <View style={styles.cardHead}>
                        <View style={styles.flexText}>
                          <Text style={styles.eyebrow}>Module {moduleIndex + 1}</Text>
                          <Text style={styles.hint}>{pluralizeText(courseModule.lessons.length, 'lesson')}</Text>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Remove module ${moduleIndex + 1}`} onPress={() => setModuleToRemove(courseModule.key)} android_ripple={RIPPLE} style={styles.iconButtonBordered}>
                          <Trash2 size={18} color={colors.destructiveText} />
                        </Pressable>
                      </View>
                      <View style={styles.field}>
                        <Text style={styles.label}>Module title <Text style={styles.required}>*</Text></Text>
                        <TextInput accessibilityLabel={`Module ${moduleIndex + 1} title`} value={courseModule.title} onChangeText={(value) => updateModule(courseModule.key, { title: value })} placeholder="e.g. Getting started" placeholderTextColor={colors.mutedText} style={[styles.input, !courseModule.title.trim() && moduleIssues.length > 0 && styles.inputError]} />
                      </View>
                      <View style={styles.field}>
                        <Text style={styles.label}>Description <Text style={styles.optional}>(optional)</Text></Text>
                        <TextInput accessibilityLabel={`Module ${moduleIndex + 1} description`} value={courseModule.description} onChangeText={(value) => updateModule(courseModule.key, { description: value })} placeholder="What this module covers" placeholderTextColor={colors.mutedText} multiline style={[styles.input, styles.shortMultiline]} />
                      </View>
                      {moduleIssues.map((issue) => <FieldMessage key={issue} error={issue} />)}

                      {courseModule.lessons.map((lesson, lessonIndex) => {
                        const attached = library.find(lesson.fileId);
                        const options = lesson.kind === 'text' ? [] : library.files.filter((file) => ATTACHABLE[lesson.kind as Exclude<LessonKind, 'text'>].includes(file.kind) && file.status !== 'error' && file.id !== lesson.fileId);
                        const lessonIssues = issuesFor(lesson.key);
                        return (
                          <View key={lesson.key} style={[styles.lessonCard, lessonIssues.length > 0 && styles.cardError]}>
                            <View style={styles.cardHead}>
                              <Text style={[styles.eyebrow, styles.flexText]} numberOfLines={1}>Lesson {lessonIndex + 1}{lesson.title.trim() ? ` · ${lesson.title.trim()}` : ''}</Text>
                              <Pressable accessibilityRole="button" accessibilityLabel={`Remove lesson ${lessonIndex + 1}`} onPress={() => handleRequestRemoveLesson(courseModule.key, lesson)} android_ripple={RIPPLE} style={styles.iconButton}>
                                <Trash2 size={18} color={colors.mutedText} />
                              </Pressable>
                            </View>
                            <View style={styles.field}>
                              <Text style={styles.label}>Lesson title <Text style={styles.required}>*</Text></Text>
                              <TextInput accessibilityLabel={`Lesson ${lessonIndex + 1} title`} value={lesson.title} onChangeText={(value) => updateLesson(courseModule.key, lesson.key, { title: value })} placeholder="e.g. What is a budget?" placeholderTextColor={colors.mutedText} style={styles.input} />
                            </View>
                            <View style={styles.field}>
                              <Text style={styles.label}>Lesson type</Text>
                              <View accessibilityRole="radiogroup" style={styles.segment}>
                                {LESSON_KINDS.map((item) => {
                                  const isActive = lesson.kind === item.value;
                                  const Icon = item.value === 'video' ? Video : FileText;
                                  return (
                                    <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={`${item.label} lesson`} accessibilityState={{ checked: isActive }} onPress={() => updateLesson(courseModule.key, lesson.key, { kind: item.value, fileId: null })} android_ripple={RIPPLE} style={[styles.segmentOption, isActive && styles.segmentActive]}>
                                      <Icon size={15} color={isActive ? colors.text : colors.mutedText} />
                                      <Text numberOfLines={1} style={[styles.segmentText, isActive && styles.segmentTextActive]}>{item.label}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </View>
                            {lesson.kind !== 'text' ? (
                              <View style={styles.field}>
                                <Text style={styles.label}>{lesson.kind === 'video' ? 'Video' : 'File'}</Text>
                                {attached ? (
                                  <View style={styles.attachedRow}>
                                    {attached.kind === 'video' ? <Video size={18} color={colors.accentText} /> : <FileText size={18} color={colors.accentText} />}
                                    <View style={styles.flexText}>
                                      <Text style={styles.fileName} numberOfLines={2}>{attached.name}</Text>
                                      <Text style={[styles.hint, attached.status === 'error' && styles.errorText]}>{attached.status === 'uploading' ? 'Uploading…' : attached.status === 'error' ? 'Upload failed' : formatCourseFileSize(attached.size)}</Text>
                                    </View>
                                    <Pressable accessibilityRole="button" accessibilityLabel={`Detach ${attached.name}`} onPress={() => updateLesson(courseModule.key, lesson.key, { fileId: null })} android_ripple={RIPPLE} style={styles.iconButton}>
                                      <X size={18} color={colors.mutedText} />
                                    </Pressable>
                                  </View>
                                ) : null}
                                {options.length > 0 ? (
                                  <>
                                    <Text style={styles.hint}>{attached ? 'Or swap for a file from your library:' : 'Choose from your library:'}</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.attachChips}>
                                      {options.map((file) => (
                                        <Pressable key={file.id} accessibilityRole="button" accessibilityLabel={`Attach ${file.name}`} onPress={() => handleAttach(courseModule.key, lesson, file)} android_ripple={RIPPLE} style={styles.attachChip}>
                                          {file.kind === 'video' ? <Video size={14} color={colors.mutedText} /> : <FileText size={14} color={colors.mutedText} />}
                                          <Text style={styles.attachChipText} numberOfLines={1}>{file.name}</Text>
                                        </Pressable>
                                      ))}
                                    </ScrollView>
                                  </>
                                ) : null}
                                <Pressable accessibilityRole="button" onPress={() => void handleUploadForLesson(courseModule.key, lesson)} android_ripple={RIPPLE} style={styles.fileButton}>
                                  <Upload size={18} color={colors.accentText} />
                                  <Text style={styles.fileText} numberOfLines={2}>{lesson.kind === 'video' ? 'Upload a video (up to 50 MB)' : 'Upload a PDF or Word file (up to 50 MB)'}</Text>
                                </Pressable>
                              </View>
                            ) : null}
                            <View style={styles.field}>
                              <Text style={styles.label}>{lesson.kind === 'text' ? <>Lesson text <Text style={styles.required}>*</Text></> : <>Notes or link <Text style={styles.optional}>(optional with a file)</Text></>}</Text>
                              <TextInput
                                accessibilityLabel={lesson.kind === 'text' ? `Lesson ${lessonIndex + 1} text` : `Lesson ${lessonIndex + 1} notes or link`}
                                value={lesson.content}
                                onChangeText={(value) => updateLesson(courseModule.key, lesson.key, { content: value })}
                                placeholder={lesson.kind === 'text' ? 'Write the lesson' : 'Notes for learners, or an https:// link'}
                                placeholderTextColor={colors.mutedText}
                                multiline
                                style={[styles.input, lesson.kind === 'text' ? styles.multiline : styles.shortMultiline]}
                              />
                            </View>
                            <View style={styles.durationRow}>
                              <Text style={[styles.label, styles.flexText]}>Duration <Text style={styles.optional}>(optional)</Text></Text>
                              <TextInput accessibilityLabel={`Lesson ${lessonIndex + 1} duration in minutes`} value={lesson.duration} onChangeText={(value) => updateLesson(courseModule.key, lesson.key, { duration: value.replace(/[^0-9]/g, '') })} placeholder="0" placeholderTextColor={colors.mutedText} keyboardType="number-pad" maxLength={4} style={[styles.input, styles.durationInput]} />
                              <Text style={styles.hint}>min</Text>
                            </View>
                            {lessonIssues.map((issue) => <FieldMessage key={issue} error={issue} />)}
                          </View>
                        );
                      })}
                      <Pressable accessibilityRole="button" accessibilityLabel={`Add a lesson to module ${moduleIndex + 1}`} onPress={() => updateModule(courseModule.key, { lessons: [...courseModule.lessons, newLesson()] })} android_ripple={RIPPLE} style={styles.addButton}>
                        <Plus size={18} color={colors.accentText} /><Text style={styles.addText}>Add lesson</Text>
                      </Pressable>
                    </View>
                  );
                })}
                <Pressable accessibilityRole="button" onPress={() => setModules((current) => [...current, newModule(current.length)])} android_ripple={RIPPLE} style={[styles.addButton, styles.addModule]}>
                  <Plus size={18} color={colors.accentText} /><Text style={styles.addText}>Add module</Text>
                </Pressable>
                <Text style={styles.hint}>Quizzes and assignments are added after the course is created, from your instructor dashboard.</Text>
              </>
            ) : null}

            {isPublishStep ? (
              <>
                <CoursePublishReview summary={summary} checklist={checklist} />
                <ErrorList errors={errors} />
                {submitError ? (
                  <View accessibilityRole="alert" style={styles.submitError}>
                    <AlertCircle size={16} color={colors.destructiveText} />
                    <Text style={[styles.errorText, styles.flexText]}>{submitError}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </ELearningScrollView>
        <StickyActionBar note={barNote}>
          {step > 1 ? (
            <ELearningButton label="Back" variant="secondary" icon={<ChevronLeft size={18} color={colors.text} />} isDisabled={Boolean(progress)} onPress={() => goToStep(Math.max(1, step - 1))} style={styles.flex} />
          ) : null}
          {isPublishStep ? (
            <ELearningButton label="Publish course" busyLabel={progress ?? undefined} isBusy={Boolean(progress)} isDisabled={!isChecklistDone} onPress={() => void handleSubmit()} style={styles.primaryAction} />
          ) : (
            <ELearningButton label={`Next: ${STEPS[step]}`} accessibilityLabel={`Next step, ${STEPS[step]}`} onPress={handleNext} style={styles.primaryAction} />
          )}
        </StickyActionBar>
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
        visible={Boolean(lessonToRemove)}
        type="warning"
        title="Remove this lesson?"
        message="What you wrote for it will be lost. Files stay in your library."
        confirmText="Remove"
        cancelText="Keep"
        onConfirm={() => { if (lessonToRemove) removeLesson(lessonToRemove); setLessonToRemove(null); }}
        onCancel={() => setLessonToRemove(null)}
        onClose={() => setLessonToRemove(null)}
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
      <CustomModal
        visible={isLeaveVisible}
        type="warning"
        title="Leave without publishing?"
        message="This course is not saved yet. If you leave now, what you've entered will be lost."
        confirmText="Leave"
        cancelText="Keep editing"
        onConfirm={() => { setIsLeaveVisible(false); const leave = pendingLeaveRef.current; pendingLeaveRef.current = null; leave?.(); }}
        onCancel={() => { setIsLeaveVisible(false); pendingLeaveRef.current = null; }}
        onClose={() => { setIsLeaveVisible(false); pendingLeaveRef.current = null; }}
      />
    </SafeAreaView>
  );
}

const pluralizeText = (count: number, word: string): string => `${count} ${count === 1 ? word : `${word}s`}`;

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  primaryAction: { flex: 1.4 },
  centerFill: { flex: 1, justifyContent: 'center' },
  scroll: { alignItems: 'center', paddingBottom: 24 },
  column: { padding: ELEARNING_GUTTER, gap: 16 },
  notice: { padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, backgroundColor: colors.warningSurface },
  noticeText: { color: colors.warningText, fontSize: 13, lineHeight: 19 },
  stepIntro: { color: colors.secondaryText, fontSize: 14, lineHeight: 20 },
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  required: { color: colors.destructiveText },
  optional: { color: colors.mutedText, fontWeight: '500' },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  errorText: { color: colors.destructiveText, fontSize: 13, lineHeight: 18 },
  centerText: { textAlign: 'center' },
  eyebrow: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  inputError: { borderColor: colors.destructiveText },
  multiline: { minHeight: 140, textAlignVertical: 'top' },
  shortMultiline: { minHeight: 72, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.control },
  segmentOption: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, overflow: 'hidden' },
  segmentActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: ELEARNING_ACTION_GREEN },
  segmentText: { flexShrink: 1, color: colors.mutedText, fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: colors.text },
  cover: { height: 150, alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.canvas },
  coverRow: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas },
  coverThumb: { width: 96, height: 54, borderRadius: 8 },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  emptyBox: { paddingVertical: 24, paddingHorizontal: 16, gap: 4, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  moduleCard: { padding: 14, gap: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  cardError: { borderWidth: 1, borderColor: colors.destructiveText },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconButtonBordered: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  lessonCard: { padding: 12, gap: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  attachedRow: { minHeight: 56, paddingLeft: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: ELEARNING_ACTION_GREEN, backgroundColor: colors.surface },
  attachChips: { gap: 8 },
  attachChip: { maxWidth: 220, minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  attachChipText: { flexShrink: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  fileButton: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  fileText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  durationInput: { width: 88, textAlign: 'center' },
  addButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, overflow: 'hidden' },
  addModule: { backgroundColor: colors.surface },
  addText: { color: colors.accentText, fontSize: 15, fontWeight: '700' },
  submitError: { padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, backgroundColor: colors.destructiveSurface },
});
