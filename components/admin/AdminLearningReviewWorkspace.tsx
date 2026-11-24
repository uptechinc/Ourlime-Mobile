import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import AdminDialog from './AdminDialog';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService } from '@/lib/services/InstructorService';
import { pendingApprovalsService } from '@/lib/services/PendingApprovalsService';
import type {
  CourseReviewItem,
  CourseReviewOutline,
  InstructorReviewItem,
  LearningReviewDecision,
  LearningReviewQueue,
  LearningReviewTab,
  LearningReviewTarget,
} from '@/lib/types/learningReview';

type AdminLearningReviewWorkspaceProps = { initialTab: LearningReviewTab };
type WorkspaceStyles = ReturnType<typeof createStyles>;
type InstructorCardProps = { instructor: InstructorReviewItem; styles: WorkspaceStyles; colors: AppThemeColors; onDecide: (decision: LearningReviewDecision) => void };
type CourseCardProps = { course: CourseReviewItem; styles: WorkspaceStyles; colors: AppThemeColors; onDecide: (decision: LearningReviewDecision) => void };
type DecisionButtonsProps = { label: string; styles: WorkspaceStyles; colors: AppThemeColors; onDecide: (decision: LearningReviewDecision) => void };
type DetailProps = { label: string; value: string; styles: WorkspaceStyles };
type EmptyStateProps = { text: string; styles: WorkspaceStyles; colors: AppThemeColors };
type DocumentLink = { label: string; url: string };
type OutlineState = { status: 'loading' } | { status: 'ready'; outline: CourseReviewOutline } | { status: 'error'; message: string };

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const REASON_MAX_LENGTH = 1000;
const FALLBACK_COURSE_IMAGE = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3';
const APPLICATION_TYPE_LABELS: { [type: string]: string } = { individual: 'Individual instructor', school: 'School', training_company: 'Training company' };

const humanize = (value: string): string => (value ? value.replace(/[_-]+/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase()) : '');
const formatDate = (value: string | null): string => (value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unknown');
const formatMinutes = (minutes: number): string => {
  if (minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
};
const formatPlural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
const mapDocumentLinks = (instructor: InstructorReviewItem): DocumentLink[] => [
  ...(instructor.resumeUrl ? [{ label: 'Resume', url: instructor.resumeUrl }] : []),
  ...instructor.certificateUrls.map((url, index) => ({ label: instructor.certificateUrls.length > 1 ? `Certificate ${index + 1}` : 'Certificate', url })),
  ...(instructor.sampleLessonUrl ? [{ label: 'Sample lesson', url: instructor.sampleLessonUrl }] : []),
  ...(instructor.proofOfAuthorizationUrl ? [{ label: 'Proof of authorization', url: instructor.proofOfAuthorizationUrl }] : []),
];

const formatDialogCopy = (target: LearningReviewTarget): { title: string; description: string; confirm: string } => {
  if (target.kind === 'instructor') {
    return target.decision === 'approve'
      ? { title: `Approve ${target.name}?`, description: 'They become a verified instructor and their new courses publish straight away. Courses already waiting stay in the Courses tab.', confirm: 'Approve' }
      : { title: `Decline ${target.name}?`, description: 'The application stays unverified and leaves the queue until they apply again. Nobody is notified.', confirm: 'Decline' };
  }
  return target.decision === 'approve'
    ? { title: `Publish "${target.name}"?`, description: 'The course becomes public in E-Learning and members can enrol.', confirm: 'Publish' }
    : { title: `Decline "${target.name}"?`, description: 'The course goes back to draft, private to its instructor, with your reason kept on it. Nobody is notified.', confirm: 'Decline' };
};

/** The website's /profile/admin/elearning-review: approve or decline instructor applications and courses waiting for review. */
export default function AdminLearningReviewWorkspace({ initialTab }: AdminLearningReviewWorkspaceProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { authorization, loading: accessLoading } = usePageAccess();
  const [tab, setTab] = useState<LearningReviewTab>(initialTab);
  const [queue, setQueue] = useState<LearningReviewQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<LearningReviewTarget | null>(null);
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const loadQueue = useCallback(async () => {
    try {
      setQueue(await instructorService.getReviewQueue());
      setError(null);
      hasLoaded.current = true;
    } catch (loadError: unknown) {
      console.error(`[AdminLearningReviewWorkspace.loadQueue] Error: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
      setError(loadError instanceof Error ? loadError.message : 'Could not load the review queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (accessLoading || !authorization.isAdmin) return;
    void loadQueue();
  }, [accessLoading, authorization.isAdmin, loadQueue]));

  const handleRefresh = () => {
    setRefreshing(true);
    void loadQueue();
  };

  const handleOpenDecision = (next: LearningReviewTarget) => {
    setTarget(next);
    setReason('');
    setDecisionError(null);
  };

  const handleCloseDecision = () => {
    if (isSaving) return;
    setTarget(null);
  };

  const trimmedReason = reason.trim();
  const needsReason = target?.decision === 'decline';
  const reasonInvalid = needsReason && (!trimmedReason || trimmedReason.length > REASON_MAX_LENGTH);

  const handleConfirmDecision = async () => {
    if (!target || reasonInvalid) return;
    setIsSaving(true);
    setDecisionError(null);
    try {
      if (target.kind === 'instructor') await instructorService.reviewInstructor(target.id, target.decision, trimmedReason);
      else await instructorService.reviewCourse(target.id, target.decision, trimmedReason);
      setQueue((current) => current && (target.kind === 'instructor'
        ? { ...current, instructors: current.instructors.filter((instructor) => instructor.id !== target.id) }
        : { ...current, courses: current.courses.filter((course) => course.id !== target.id) }));
      setNotice(`${target.name}: ${target.decision === 'approve' ? (target.kind === 'course' ? 'published' : 'approved') : 'declined'}.`);
      setTarget(null);
      // The menu's pending approvals count follows the decision.
      void pendingApprovalsService.fetchSummary(true).catch(() => undefined);
    } catch (saveError: unknown) {
      console.error(`[AdminLearningReviewWorkspace.handleConfirmDecision] Error: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
      setDecisionError(saveError instanceof Error && saveError.message ? saveError.message : 'Could not save the decision.');
    } finally {
      setIsSaving(false);
    }
  };

  const instructors = queue?.instructors ?? [];
  const courses = queue?.courses ?? [];
  const total = instructors.length + courses.length;
  const dialogCopy = target ? formatDialogCopy(target) : null;
  const tabs: { value: LearningReviewTab; label: string; count: number }[] = [
    { value: 'instructors', label: 'Instructors', count: instructors.length },
    { value: 'courses', label: 'Courses', count: courses.length },
  ];

  return <AdminWorkspaceShell title="E-Learning review" subtitle={queue ? `${total} waiting for a decision` : 'Instructor applications and courses'} loading={loading} refreshing={refreshing} error={error} onRefresh={handleRefresh}>
    <View style={styles.tabs}>
      {tabs.map((option) => {
        const selected = tab === option.value;
        return <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected }} android_ripple={RIPPLE} onPress={() => setTab(option.value)} style={[styles.tab, selected ? styles.tabSelected : null]}>
          <Text style={[styles.tabText, selected ? styles.tabTextSelected : null]}>{option.label} · {option.count}</Text>
        </Pressable>;
      })}
    </View>

    {notice ? <View style={styles.notice}>
      <Icon name="check-circle" size={16} color={colors.successText} />
      <Text style={styles.noticeText}>{notice} Nobody is emailed or notified.</Text>
    </View> : null}

    {tab === 'instructors'
      ? instructors.length
        ? instructors.map((instructor) => <InstructorCard key={instructor.id} instructor={instructor} styles={styles} colors={colors}
          onDecide={(decision) => handleOpenDecision({ kind: 'instructor', id: instructor.id, name: instructor.name, decision })} />)
        : <EmptyState text="No instructor applications are waiting for review." styles={styles} colors={colors} />
      : courses.length
        ? courses.map((course) => <CourseCard key={course.id} course={course} styles={styles} colors={colors}
          onDecide={(decision) => handleOpenDecision({ kind: 'course', id: course.id, name: course.title, decision })} />)
        : <EmptyState text="No courses are waiting for review." styles={styles} colors={colors} />}

    <AdminDialog
      visible={Boolean(target)}
      title={dialogCopy?.title ?? ''}
      description={dialogCopy?.description}
      confirmLabel={dialogCopy?.confirm}
      tone={needsReason ? 'danger' : 'positive'}
      busy={isSaving}
      confirmDisabled={reasonInvalid}
      onConfirm={() => void handleConfirmDecision()}
      onClose={handleCloseDecision}
    >
      {needsReason ? <View>
        <Text style={styles.reasonLabel}>Reason for declining</Text>
        <TextInput accessibilityLabel="Reason for declining" value={reason} onChangeText={setReason} editable={!isSaving} multiline maxLength={REASON_MAX_LENGTH + 200}
          placeholder="What needs to change before this can be approved?" placeholderTextColor={colors.mutedText} style={styles.reasonInput} />
        <Text style={[styles.reasonCount, trimmedReason.length > REASON_MAX_LENGTH ? { color: colors.destructiveText } : null]}>{trimmedReason.length}/{REASON_MAX_LENGTH}</Text>
      </View> : null}
      {decisionError ? <Text accessibilityRole="alert" style={styles.decisionError}>{decisionError}</Text> : null}
    </AdminDialog>
  </AdminWorkspaceShell>;
}

function InstructorCard({ instructor, styles, colors, onDecide }: InstructorCardProps) {
  const documents = mapDocumentLinks(instructor);
  const meta = [instructor.jobTitle, instructor.email, `Submitted ${formatDate(instructor.submittedAt)}`].filter(Boolean).join(' · ');
  return <View style={styles.card}>
    <View style={styles.cardHeader}>
      {instructor.avatar
        ? <Image source={{ uri: instructor.avatar }} style={styles.avatar} contentFit="cover" accessibilityIgnoresInvertColors />
        : <View style={[styles.avatar, styles.avatarFallback]}><Icon name="award" size={20} color={colors.mutedText} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={styles.waiting}>Waiting for review</Text>
        <Text style={styles.name}>{instructor.name}</Text>
        <Text style={styles.meta}>{APPLICATION_TYPE_LABELS[instructor.applicationType] ?? humanize(instructor.applicationType)}</Text>
      </View>
    </View>
    <Text style={styles.meta}>{meta}</Text>
    <Detail label="Qualification" value={instructor.highestQualification} styles={styles} />
    <Detail label="Experience" value={formatPlural(instructor.yearsOfExperience, 'year')} styles={styles} />
    <Detail label="Expertise" value={instructor.fieldsOfExpertise.join(', ')} styles={styles} />
    <Detail label="Subjects" value={instructor.subjectCategories.join(', ')} styles={styles} />
    <Detail label="Languages" value={instructor.languagesTaught.join(', ')} styles={styles} />
    <Detail label="Organization" value={[instructor.organizationName, instructor.organizationWebsite].filter(Boolean).join(' · ')} styles={styles} />
    <Detail label="Teaching experience" value={instructor.previousTeachingExperience} styles={styles} />
    <Detail label="Courses they plan to teach" value={instructor.intendedCoursesDescription} styles={styles} />
    <Detail label="Bio" value={instructor.bio} styles={styles} />
    <View style={styles.documents}>
      {documents.length ? documents.map((document) => <Pressable key={document.url} accessibilityRole="link" accessibilityLabel={`Open ${document.label}`} android_ripple={RIPPLE}
        onPress={() => { void Linking.openURL(document.url).catch(() => undefined); }} style={styles.documentButton}>
        <Icon name="file-text" size={15} color={colors.text} />
        <Text style={styles.documentText}>{document.label}</Text>
        <Icon name="external-link" size={13} color={colors.mutedText} />
      </Pressable>) : <Text style={styles.meta}>No documents attached.</Text>}
    </View>
    <DecisionButtons label={instructor.name} styles={styles} colors={colors} onDecide={onDecide} />
  </View>;
}

function CourseCard({ course, styles, colors, onDecide }: CourseCardProps) {
  const [outline, setOutline] = useState<OutlineState | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // The rules hide lessons of unpublished courses from clients (and the app's course page shows published courses only),
  // so the outline comes from the server.
  const handleToggleOutline = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (!next || (outline && outline.status !== 'error')) return;
    setOutline({ status: 'loading' });
    instructorService.getCourseReviewOutline(course.id)
      .then((loaded) => setOutline({ status: 'ready', outline: loaded }))
      .catch((loadError: unknown) => setOutline({ status: 'error', message: loadError instanceof Error && loadError.message ? loadError.message : 'Could not load the lessons.' }));
  };

  const meta = [
    `By ${course.instructorName}${course.instructorVerified ? '' : ' (not verified yet)'}`,
    humanize(course.level),
    formatPlural(course.moduleCount, 'module'),
    formatPlural(course.lessonCount, 'lesson'),
    course.price > 0 ? `$${course.price.toFixed(2)}` : 'Free',
    `Submitted ${formatDate(course.submittedAt)}`,
  ].filter(Boolean).join(' · ');

  return <View style={styles.card}>
    <Image source={{ uri: course.image || FALLBACK_COURSE_IMAGE }} style={styles.cover} contentFit="cover" accessibilityIgnoresInvertColors />
    <Text style={styles.waiting}>Waiting for review{course.category ? ` · ${course.category}` : ''}</Text>
    <Text style={styles.name}>{course.title}</Text>
    {course.shortDescription ? <Text numberOfLines={3} style={styles.body}>{course.shortDescription}</Text> : null}
    <Text style={styles.meta}>{meta}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} android_ripple={RIPPLE} onPress={handleToggleOutline} style={styles.outlineToggle}>
      <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text} />
      <Text style={styles.outlineToggleText}>{isOpen ? 'Hide modules and lessons' : 'Show modules and lessons'}</Text>
    </Pressable>
    {isOpen && outline ? <View style={styles.outline}>
      {outline.status === 'loading' ? <ActivityIndicator size="small" color={colors.successText} /> : null}
      {outline.status === 'error' ? <Text style={styles.decisionError}>{outline.message}</Text> : null}
      {outline.status === 'ready' && !outline.outline.modules.length ? <Text style={styles.meta}>This course has no modules.</Text> : null}
      {outline.status === 'ready' ? outline.outline.modules.map((module, moduleIndex) => <View key={module.id} style={{ gap: 4 }}>
        <Text style={styles.outlineModule}>{moduleIndex + 1}. {module.title}</Text>
        {module.lessons.length ? module.lessons.map((lesson) => <View key={lesson.id} style={styles.outlineLesson}>
          <Text style={[styles.body, { flex: 1 }]}>{lesson.title}</Text>
          <Text style={styles.meta}>{[humanize(lesson.type), formatMinutes(lesson.duration)].filter(Boolean).join(' · ')}</Text>
        </View>) : <Text style={styles.meta}>No lessons in this module.</Text>}
      </View>) : null}
      {outline.status === 'ready' && outline.outline.totalMinutes > 0 ? <Text style={styles.meta}>Total length {formatMinutes(outline.outline.totalMinutes)}</Text> : null}
    </View> : null}
    <DecisionButtons label={course.title} styles={styles} colors={colors} onDecide={onDecide} />
  </View>;
}

function DecisionButtons({ label, styles, colors, onDecide }: DecisionButtonsProps) {
  return <View style={styles.decisions}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Approve ${label}`} android_ripple={RIPPLE} onPress={() => onDecide('approve')} style={[styles.decisionButton, { backgroundColor: colors.successSurface }]}>
      <Icon name="check" size={16} color={colors.successText} /><Text style={[styles.decisionText, { color: colors.successText }]}>Approve</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Decline ${label}`} android_ripple={RIPPLE} onPress={() => onDecide('decline')} style={[styles.decisionButton, { backgroundColor: colors.destructiveSurface }]}>
      <Icon name="x" size={16} color={colors.destructiveText} /><Text style={[styles.decisionText, { color: colors.destructiveText }]}>Decline</Text>
    </Pressable>
  </View>;
}

function Detail({ label, value, styles }: DetailProps) {
  if (!value) return null;
  return <Text style={styles.body} numberOfLines={5}><Text style={styles.strong}>{label}: </Text>{value}</Text>;
}

function EmptyState({ text, styles, colors }: EmptyStateProps) {
  return <View style={styles.emptyState}>
    <Icon name="check-circle" size={30} color={colors.successText} />
    <Text style={styles.emptyText}>{text}</Text>
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  tab: { flex: 1, minHeight: 40, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  tabSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  tabText: { color: colors.mutedText, fontSize: 13, fontWeight: '800' },
  tabTextSelected: { color: colors.successText },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: colors.successSurface },
  noticeText: { flex: 1, color: colors.successText, fontSize: 13, fontWeight: '700' },
  card: { marginBottom: 12, padding: 16, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.control },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: colors.control },
  waiting: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden', fontSize: 11, fontWeight: '800', color: colors.warningText, backgroundColor: colors.warningSurface },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  meta: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  body: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  strong: { fontWeight: '800', color: colors.text },
  documents: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  documentButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, overflow: 'hidden' },
  documentText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  outlineToggle: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 4, borderRadius: 8, overflow: 'hidden' },
  outlineToggleText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  outline: { gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  outlineModule: { color: colors.text, fontSize: 14, fontWeight: '800' },
  outlineLesson: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 10 },
  decisions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  decisionButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, overflow: 'hidden' },
  decisionText: { fontSize: 14, fontWeight: '800' },
  reasonLabel: { marginBottom: 6, color: colors.text, fontSize: 13, fontWeight: '800' },
  reasonInput: { minHeight: 96, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 14, textAlignVertical: 'top' },
  reasonCount: { marginTop: 4, textAlign: 'right', color: colors.mutedText, fontSize: 11 },
  decisionError: { marginTop: 10, color: colors.destructiveText, fontSize: 13, fontWeight: '700' },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyText: { color: colors.mutedText, fontSize: 14, textAlign: 'center' },
});
