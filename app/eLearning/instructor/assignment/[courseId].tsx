import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ClipboardList, FileText, Trash2, Upload } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import DateTimeField from '@/components/ui/DateTimeField';
import { ErrorList, FieldMessage, FormField, FormSection } from '@/components/eLearning/instructor/InstructorForm';
import AssignmentPolicyFields from '@/components/eLearning/instructor/AssignmentPolicyFields';
import RubricEditor from '@/components/eLearning/instructor/RubricEditor';
import { buildPolicyInput, buildRubricInput, NO_LATE_PENALTY, NO_RESUBMISSION, policyDraftFrom } from '@/lib/services/AssignmentPolicy';
import type { AssignmentPolicyDraft, RubricCriterionDraft } from '@/lib/types/instructor';
import { ELearningButton, ELearningEmptyState, ELearningHeader, ELearningScrollView, ELEARNING_GUTTER, StickyActionBar } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService } from '@/lib/services/InstructorService';
import type { AssignmentFile } from '@/lib/types/course';
import type { PickedUpload } from '@/lib/types/instructor';

const CONTENT_MAX_WIDTH = 760;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 20;
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
// Types storage.rules accepts in courseFiles/{courseId}/{uid}/.
const ATTACHMENT_TYPES = [
  'application/pdf', 'application/zip', 'application/msword', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/*', 'audio/*',
];

type AssignmentField = 'title' | 'instructions' | 'dueDate' | 'points';

const defaultDueDate = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(23, 59, 0, 0);
  return date;
};

const formatSize = (bytes?: number): string => (bytes && bytes > 0 ? (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`) : '');

/** Create an assignment for one of the instructor's courses (the website's assignment editor), in three grouped cards. */
export default function CreateAssignmentScreen() {
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
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(defaultDueDate());
  const [points, setPoints] = useState('100');
  const [policy, setPolicy] = useState<AssignmentPolicyDraft>(() => policyDraftFrom(false, NO_LATE_PENALTY, NO_RESUBMISSION));
  const [rubric, setRubric] = useState<RubricCriterionDraft[]>([]);
  const [attachments, setAttachments] = useState<PickedUpload[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isLeaveVisible, setIsLeaveVisible] = useState(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);

  const hasWork = Boolean(title.trim() || description.trim() || instructions.trim() || attachments.length > 0);
  const shouldConfirmLeaveRef = useRef(false);
  shouldConfirmLeaveRef.current = hasWork && !isDone && !progress;
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!shouldConfirmLeaveRef.current) return;
    event.preventDefault();
    pendingLeaveRef.current = () => navigation.dispatch(event.data.action);
    setIsLeaveVisible(true);
  }), [navigation]);

  const handlePickAttachments = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: ATTACHMENT_TYPES, multiple: true, copyToCacheDirectory: true });
    if (picked.canceled) return;
    const tooLarge = picked.assets.filter((asset) => (asset.size ?? 0) > MAX_ATTACHMENT_BYTES).map((asset) => asset.name);
    const accepted = picked.assets.filter((asset) => (asset.size ?? 0) <= MAX_ATTACHMENT_BYTES).map((asset): PickedUpload => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size }));
    setAttachments((current) => [...current, ...accepted].slice(0, MAX_ATTACHMENTS));
    setFileNotice(tooLarge.length > 0 ? `Larger than 10 MB, not added: ${tooLarge.join(', ')}` : null);
  };

  const fieldErrors = (): Partial<Record<AssignmentField, string>> => {
    const found: Partial<Record<AssignmentField, string>> = {};
    if (!title.trim()) found.title = 'Enter an assignment title.';
    if (!instructions.trim()) found.instructions = 'Add instructions for students.';
    if (!dueDate) found.dueDate = 'Choose a due date and time.';
    const value = Number(points);
    // With a rubric the assignment is worth the rubric's total, so the points field is not used.
    if (rubric.length === 0 && (!Number.isInteger(value) || value < 1 || value > 10000)) found.points = 'Points must be a whole number from 1 to 10000.';
    return found;
  };
  const rubricInput = buildRubricInput(rubric);
  const policyInput = buildPolicyInput(policy);
  const shownErrors = showErrors ? fieldErrors() : {};
  const errorList = [
    ...Object.values(shownErrors).filter((message): message is string => Boolean(message)),
    ...(showErrors ? [...policyInput.errors, ...rubricInput.errors] : []),
  ];

  const handleSave = async () => {
    const found = [...Object.values(fieldErrors()).filter(Boolean), ...policyInput.errors, ...rubricInput.errors];
    setShowErrors(true);
    setSaveError(null);
    if (found.length > 0 || !id || !dueDate) { scrollRef.current?.scrollTo({ y: 0, animated: true }); return; }
    try {
      const uploaded: AssignmentFile[] = [];
      for (const [index, file] of attachments.entries()) {
        setProgress(`Uploading ${index + 1} of ${attachments.length}…`);
        uploaded.push(await instructorService.uploadAssignmentAttachment(id, file));
      }
      setProgress('Saving…');
      await instructorService.createAssignment({
        // create_assessment checks points (0–10000) before it replaces them with the rubric's total.
        courseId: id, title, description, instructions, dueDate, points: rubricInput.rubric ? Math.min(10000, rubricInput.totalPoints) : Number(points),
        allowLateSubmission: policy.allowLateSubmission, attachments: uploaded,
        latePenalty: policyInput.latePenalty, resubmission: policyInput.resubmission, rubric: rubricInput.rubric,
      });
      setIsDone(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      console.error('[CreateAssignmentScreen.handleSave] Error:', message || 'Unknown error');
      setSaveError(message.includes('instructor') ? 'Only the course instructor can add assignments to this course.' : 'The assignment could not be created. Check your connection and try again.');
    } finally {
      setProgress(null);
    }
  };

  if (isDone) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ELearningHeader title="Assignment added" subtitle={courseName} onBack={() => router.back()} />
        <View style={styles.centerFill}>
          <ELearningEmptyState
            icon={<ClipboardList size={44} color={colors.accentText} />}
            title="Assignment added"
            hint="Students see it in the course's quizzes and assignments. Grade their work from Grading on your instructor dashboard."
            actionLabel="Done"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title="New assignment" subtitle={courseName} onBack={() => router.back()} />
      <KeyboardSafeView style={styles.flex}>
        <ELearningScrollView scrollRef={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            <ErrorList errors={errorList} title={`Fix ${errorList.length === 1 ? 'this' : `these ${errorList.length}`} to save`} />
            <FormSection title="What students do">
              <FormField label="Assignment title" required value={title} onChange={setTitle} placeholder="e.g. Financial Planning Project" maxLength={200} error={shownErrors.title} />
              <FormField label="Description" value={description} onChange={setDescription} multiline placeholder="A short overview" hint="Shown under the title in the assignment list." />
              <FormField label="Instructions" required value={instructions} onChange={setInstructions} multiline placeholder="Step-by-step instructions for students" error={shownErrors.instructions} />
            </FormSection>

            <FormSection title="Due date and grading">
              <View style={styles.field}>
                <DateTimeField label="Due date" mode="datetime" required value={dueDate} onChange={setDueDate} placeholder="Choose the due date and time" minimumDate={new Date()} />
                <FieldMessage error={shownErrors.dueDate} />
              </View>
              {rubric.length === 0 ? (
                <FormField label="Points" required value={points} onChange={(value) => setPoints(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={5} hint="The highest score you can give." error={shownErrors.points} />
              ) : (
                <Text style={styles.hint}>Points follow the rubric: {rubricInput.totalPoints} in total.</Text>
              )}
            </FormSection>

            <FormSection title="Late work and resubmissions" description="The server enforces these: late work is refused unless you accept it, and penalties apply when you grade.">
              <AssignmentPolicyFields draft={policy} onChange={setPolicy} />
            </FormSection>

            <FormSection title="Rubric" description="Optional. Learners see it before handing in; you grade by picking one level per criterion.">
              <RubricEditor criteria={rubric} onChange={setRubric} />
            </FormSection>

            <FormSection title="Reference files" description="Optional. PDF, Word, ZIP, images and more, up to 10 MB each.">
              {attachments.map((file, index) => (
                <View key={`${file.uri}-${index}`} style={styles.fileRow}>
                  <FileText size={18} color={colors.accentText} />
                  <View style={styles.flexText}>
                    <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
                    {file.size ? <Text style={styles.hint}>{formatSize(file.size)}</Text> : null}
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} onPress={() => setAttachments((current) => current.filter((_entry, position) => position !== index))} android_ripple={RIPPLE} style={styles.iconButton}>
                    <Trash2 size={18} color={colors.mutedText} />
                  </Pressable>
                </View>
              ))}
              {attachments.length < MAX_ATTACHMENTS ? (
                <Pressable accessibilityRole="button" onPress={() => void handlePickAttachments()} android_ripple={RIPPLE} style={styles.dropZone}>
                  <Upload size={20} color={colors.accentText} />
                  <Text style={styles.dropTitle}>{attachments.length > 0 ? 'Add more files' : 'Add files'}</Text>
                </Pressable>
              ) : <Text style={styles.hint}>You've added the most files an assignment can have ({MAX_ATTACHMENTS}).</Text>}
              {fileNotice ? <FieldMessage error={fileNotice} /> : null}
            </FormSection>
            {saveError ? <FieldMessage error={saveError} /> : null}
          </View>
        </ELearningScrollView>
        <StickyActionBar note={progress}>
          <ELearningButton label="Save assignment" busyLabel="Saving…" isBusy={Boolean(progress)} onPress={() => void handleSave()} style={styles.flex} />
        </StickyActionBar>
      </KeyboardSafeView>
      <CustomModal
        visible={isLeaveVisible}
        type="warning"
        title="Leave without saving?"
        message="This assignment is not saved yet. If you leave now, what you've entered will be lost."
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
  field: { gap: 6 },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  dropZone: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.canvas, overflow: 'hidden' },
  dropTitle: { color: colors.accentText, fontSize: 15, fontWeight: '700' },
  fileRow: { minHeight: 56, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
