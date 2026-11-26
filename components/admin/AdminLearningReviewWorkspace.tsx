import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { toast } from 'sonner-native';
import AdminButton from './AdminButton';
import AdminDialog from './AdminDialog';
import AdminListRow from './AdminListRow';
import AdminReviewCard, { AdminReasonField } from './AdminReviewCard';
import AdminScreen, { type AdminScreenState } from './AdminScreen';
import AdminState from './AdminState';
import AdminToolbar from './AdminToolbar';
import { radius, space, type } from '@/lib/admin/adminTokens';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
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
type InstructorCardProps = { instructor: InstructorReviewItem; onDecide: (decision: LearningReviewDecision) => void };
type CourseCardProps = { course: CourseReviewItem; onDecide: (decision: LearningReviewDecision) => void };
type DocumentLink = { label: string; url: string };
type OutlineState = { status: 'loading' } | { status: 'ready'; outline: CourseReviewOutline } | { status: 'error'; message: string };

const REASON_MAX_LENGTH = 1000;
const FALLBACK_COURSE_IMAGE = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3';
const APPLICATION_TYPE_LABELS: { [applicationType: string]: string } = { individual: 'Individual instructor', school: 'School', training_company: 'Training company' };

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

const isLearningTab = (value: string): value is LearningReviewTab => value === 'instructors' || value === 'courses';

/** The website's /profile/admin/elearning-review: approve or decline instructor applications and courses waiting for review. */
export default function AdminLearningReviewWorkspace({ initialTab }: AdminLearningReviewWorkspaceProps) {
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
  const hasLoaded = useRef(false);
  // Synchronous guard: a quick second tap on Confirm arrives before `isSaving` disables the button.
  const savingRef = useRef(false);

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
    if (!target || reasonInvalid || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setDecisionError(null);
    try {
      if (target.kind === 'instructor') await instructorService.reviewInstructor(target.id, target.decision, trimmedReason);
      else await instructorService.reviewCourse(target.id, target.decision, trimmedReason);
      setQueue((current) => current && (target.kind === 'instructor'
        ? { ...current, instructors: current.instructors.filter((instructor) => instructor.id !== target.id) }
        : { ...current, courses: current.courses.filter((course) => course.id !== target.id) }));
      // A toast replaces the old inline notice, which never cleared.
      toast.success(`${target.name}: ${target.decision === 'approve' ? (target.kind === 'course' ? 'published' : 'approved') : 'declined'}. Nobody is emailed or notified.`);
      setTarget(null);
      // The menu's pending approvals count follows the decision.
      void pendingApprovalsService.fetchSummary(true).catch(() => undefined);
    } catch (saveError: unknown) {
      console.error(`[AdminLearningReviewWorkspace.handleConfirmDecision] Error: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
      setDecisionError(saveError instanceof Error && saveError.message ? saveError.message : 'Could not save the decision.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const instructors = queue?.instructors ?? [];
  const courses = queue?.courses ?? [];
  const total = instructors.length + courses.length;
  const dialogCopy = target ? formatDialogCopy(target) : null;

  const screenState: AdminScreenState = loading ? { kind: 'loading', variant: 'list' } : error ? { kind: 'error', message: error } : { kind: 'ready' };

  return (
    <AdminScreen
      title="E-Learning review"
      subtitle={queue ? `${total} waiting for a decision` : 'Instructor applications and courses'}
      state={screenState}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      toolbar={(
        <AdminToolbar
          segments={{
            value: tab,
            options: [
              { value: 'instructors', label: 'Instructors', count: queue ? instructors.length : undefined },
              { value: 'courses', label: 'Courses', count: queue ? courses.length : undefined },
            ],
            onChange: (next) => {
              if (isLearningTab(next)) setTab(next);
            },
          }}
        />
      )}
    >
      <View style={{ gap: space.md }}>
        {tab === 'instructors'
          ? instructors.length
            ? instructors.map((instructor) => (
              <InstructorCard
                key={instructor.id}
                instructor={instructor}
                onDecide={(decision) => handleOpenDecision({ kind: 'instructor', id: instructor.id, name: instructor.name, decision })}
              />
            ))
            : <AdminState kind="empty" icon="award" title="No instructor applications are waiting for review." />
          : courses.length
            ? courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onDecide={(decision) => handleOpenDecision({ kind: 'course', id: course.id, name: course.title, decision })}
              />
            ))
            : <AdminState kind="empty" icon="book-open" title="No courses are waiting for review." />}
      </View>

      <AdminDialog
        visible={Boolean(target)}
        title={dialogCopy?.title ?? ''}
        description={dialogCopy?.description}
        confirmLabel={dialogCopy?.confirm}
        tone={needsReason ? 'danger' : 'positive'}
        icon={needsReason ? 'x-circle' : 'check-circle'}
        busy={isSaving}
        confirmDisabled={reasonInvalid}
        onConfirm={() => void handleConfirmDecision()}
        onClose={handleCloseDecision}
      >
        {needsReason ? (
          <AdminReasonField
            label="Reason for declining"
            value={reason}
            onChangeText={setReason}
            editable={!isSaving}
            maxLength={REASON_MAX_LENGTH}
            placeholder="What needs to change before this can be approved?"
            error={decisionError}
          />
        ) : decisionError ? (
          <AdminState kind="inlineError" message={decisionError} />
        ) : null}
      </AdminDialog>
    </AdminScreen>
  );
}

function InstructorCard({ instructor, onDecide }: InstructorCardProps) {
  const { colors } = useAppTheme();
  const documents = mapDocumentLinks(instructor);
  const meta = [instructor.jobTitle, instructor.email, `Submitted ${formatDate(instructor.submittedAt)}`].filter(Boolean).join(' · ');
  return (
    <AdminReviewCard
      title={instructor.name}
      subtitle={APPLICATION_TYPE_LABELS[instructor.applicationType] ?? humanize(instructor.applicationType)}
      meta={meta}
      status={{ label: 'Waiting for review', tone: 'pending' }}
      leading={{ kind: 'avatar', uri: instructor.avatar || undefined, name: instructor.name, userId: instructor.id }}
      details={[
        { label: 'Qualification', value: instructor.highestQualification },
        { label: 'Experience', value: formatPlural(instructor.yearsOfExperience, 'year') },
        { label: 'Expertise', value: instructor.fieldsOfExpertise.join(', ') },
        { label: 'Subjects', value: instructor.subjectCategories.join(', ') },
        { label: 'Languages', value: instructor.languagesTaught.join(', ') },
        { label: 'Organization', value: [instructor.organizationName, instructor.organizationWebsite].filter(Boolean).join(' · ') },
        { label: 'Teaching experience', value: instructor.previousTeachingExperience },
        { label: 'Courses they plan to teach', value: instructor.intendedCoursesDescription },
        { label: 'Bio', value: instructor.bio },
      ]}
      inlineAction={{ key: 'approve', label: 'Approve', icon: 'check', tone: 'positive', onPress: () => onDecide('approve') }}
      overflowActions={[{ key: 'decline', label: 'Decline…', icon: 'x', tone: 'danger', onPress: () => onDecide('decline') }]}
    >
      <View style={{ gap: space.sm }}>
        <Text style={[type.label, { color: colors.mutedText }]}>Documents</Text>
        {documents.length ? documents.map((document) => (
          <AdminListRow
            key={document.url}
            title={document.label}
            leading={{ kind: 'icon', name: 'file-text' }}
            inlineAction={{ key: 'open', label: 'Open', icon: 'external-link', tone: 'neutral', onPress: () => { void Linking.openURL(document.url).catch(() => undefined); } }}
          />
        )) : <Text style={[type.meta, { color: colors.mutedText }]}>No documents attached.</Text>}
      </View>
    </AdminReviewCard>
  );
}

function CourseCard({ course, onDecide }: CourseCardProps) {
  const { colors } = useAppTheme();
  const [outline, setOutline] = useState<OutlineState | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // The rules hide lessons of unpublished courses from clients (and the app's course page shows published courses only),
  // so the outline comes from the server.
  const loadOutline = () => {
    setOutline({ status: 'loading' });
    instructorService.getCourseReviewOutline(course.id)
      .then((loaded) => setOutline({ status: 'ready', outline: loaded }))
      .catch((loadError: unknown) => setOutline({ status: 'error', message: loadError instanceof Error && loadError.message ? loadError.message : 'Could not load the lessons.' }));
  };

  const handleToggleOutline = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (!next || (outline && outline.status !== 'error')) return;
    loadOutline();
  };

  const meta = [
    `By ${course.instructorName}${course.instructorVerified ? '' : ' (not verified yet)'}`,
    humanize(course.level),
    formatPlural(course.moduleCount, 'module'),
    formatPlural(course.lessonCount, 'lesson'),
    course.price > 0 ? `$${course.price.toFixed(2)}` : 'Free',
    `Submitted ${formatDate(course.submittedAt)}`,
  ].filter(Boolean).join(' · ');

  return (
    <AdminReviewCard
      title={course.title}
      subtitle={course.shortDescription || undefined}
      meta={meta}
      status={{ label: `Waiting for review${course.category ? ` · ${course.category}` : ''}`, tone: 'pending' }}
      media={{ kind: 'cover', uri: course.image || FALLBACK_COURSE_IMAGE, label: course.title }}
      inlineAction={{ key: 'approve', label: 'Publish', icon: 'check', tone: 'positive', onPress: () => onDecide('approve') }}
      overflowActions={[{ key: 'decline', label: 'Decline…', icon: 'x', tone: 'danger', onPress: () => onDecide('decline') }]}
    >
      <View style={{ gap: space.sm, padding: isOpen ? space.md : 0, borderRadius: radius.md, borderWidth: isOpen ? 1 : 0, borderColor: colors.border, backgroundColor: isOpen ? colors.control : 'transparent' }}>
        <AdminButton
          label={isOpen ? 'Hide modules and lessons' : 'Show modules and lessons'}
          icon={isOpen ? 'chevron-up' : 'chevron-down'}
          tone="neutral"
          emphasis="ghost"
          onPress={handleToggleOutline}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
        />
        {isOpen && outline ? (
          <View style={{ gap: space.md }}>
            {outline.status === 'loading' ? <ActivityIndicator size="small" color={colors.accentText} /> : null}
            {outline.status === 'error' ? <AdminState kind="inlineError" message={outline.message} onRetry={loadOutline} /> : null}
            {outline.status === 'ready' && !outline.outline.modules.length ? <Text style={[type.meta, { color: colors.mutedText }]}>This course has no modules.</Text> : null}
            {outline.status === 'ready' ? outline.outline.modules.map((module, moduleIndex) => (
              <View key={module.id} style={{ gap: space.xs }}>
                <Text style={[type.bodyStrong, { color: colors.text }]}>{moduleIndex + 1}. {module.title}</Text>
                {module.lessons.length ? module.lessons.map((lesson) => (
                  <View key={lesson.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingLeft: space.md }}>
                    <Text style={[type.body, { flex: 1, color: colors.secondaryText }]}>{lesson.title}</Text>
                    <Text style={[type.meta, { color: colors.mutedText }]}>{[humanize(lesson.type), formatMinutes(lesson.duration)].filter(Boolean).join(' · ')}</Text>
                  </View>
                )) : <Text style={[type.meta, { color: colors.mutedText, paddingLeft: space.md }]}>No lessons in this module.</Text>}
              </View>
            )) : null}
            {outline.status === 'ready' && outline.outline.totalMinutes > 0 ? <Text style={[type.meta, { color: colors.mutedText }]}>Total length {formatMinutes(outline.outline.totalMinutes)}</Text> : null}
          </View>
        ) : null}
      </View>
    </AdminReviewCard>
  );
}
