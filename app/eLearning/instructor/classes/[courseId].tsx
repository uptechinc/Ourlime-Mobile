import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarPlus, Plus, UserMinus, UserPlus, Users } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import ScheduleSheet from '@/components/eLearning/schedule/ScheduleSheet';
import { ELearningButton, ELearningChip, ELearningEmptyState, ELearningHeader, ELEARNING_GUTTER, StatusPill } from '@/components/eLearning/ELearningParts';
import { ChoiceChips, FieldMessage, FormField, ToggleRow } from '@/components/eLearning/instructor/InstructorForm';
import CohortFormSheet from '@/components/eLearning/instructor/classes/CohortFormSheet';
import SessionFormSheet from '@/components/eLearning/instructor/classes/SessionFormSheet';
import SessionRow from '@/components/eLearning/course/SessionRow';
import { formatWhen } from '@/components/eLearning/ELearningParts';
import { cohortJoinProblem, cohortSummary } from '@/lib/services/AssignmentPolicy';
import { instructorService } from '@/lib/services/InstructorService';
import { serverMessage, teachingWorkflowService } from '@/lib/services/TeachingWorkflowService';
import { settleAll } from '@/lib/utils/settleAll';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseCohort, CourseSession, RosterLearner } from '@/lib/types/course';

const CONTENT_MAX_WIDTH = 820;
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const EVERYONE = '__everyone__';
const NO_CLASS = '';
const NO_CLASS_LABEL = 'Not in a class';

/** A confirmation waiting for the instructor (archiving a class, removing an assistant, cancelling a session). */
type PendingConfirm =
  | { kind: 'archive'; cohort: CourseCohort }
  | { kind: 'removeAssistant'; cohort: CourseCohort; assistantId: string; name: string }
  | { kind: 'cancelSession'; session: CourseSession };

/**
 * The instructor's classes (cohorts) for one course: create, edit and archive classes; add or remove assistants by
 * username; require a class at enrollment or keep the course self-paced; see each class's roster (display-safe names,
 * progress) and move learners; schedule live classes, office hours and deadlines with an external join link.
 */
export default function InstructorClassesScreen() {
  const router = useRouter();
  const { courseId, title, cohorts: assistedParam } = useLocalSearchParams<{ courseId: string; title?: string; cohorts?: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const courseName = typeof title === 'string' && title ? title : undefined;
  // An assistant opens this from grading with the classes they assist: they schedule sessions for those classes only
  // (the server checks the same); classes, assistants and the roster stay with the instructor.
  const assistedCohortIds = useMemo(() => (typeof assistedParam === 'string' && assistedParam ? assistedParam.split(',').filter(Boolean) : null), [assistedParam]);
  const isAssistant = assistedCohortIds !== null;
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [cohorts, setCohorts] = useState<CourseCohort[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [cohortRequired, setCohortRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [editingCohort, setEditingCohort] = useState<CourseCohort | null>(null);
  const [isCohortFormOpen, setIsCohortFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<CourseSession | null>(null);
  const [isSessionFormOpen, setIsSessionFormOpen] = useState(false);
  const [assistantCohort, setAssistantCohort] = useState<CourseCohort | null>(null);
  const [assistantName, setAssistantName] = useState('');
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [isAddingAssistant, setIsAddingAssistant] = useState(false);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [rosterFilter, setRosterFilter] = useState<string>(EVERYONE);
  const [roster, setRoster] = useState<RosterLearner[]>([]);
  const [rosterTruncated, setRosterTruncated] = useState(false);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [movingLearner, setMovingLearner] = useState<RosterLearner | null>(null);
  const [moveTarget, setMoveTarget] = useState(NO_CLASS_LABEL);
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) { setIsLoading(false); return; }
    setLoadError(null);
    const [cohortResult, sessionResult, courseResult] = await settleAll([
      teachingWorkflowService.getCohorts(id),
      teachingWorkflowService.getSessions(id, showPastSessions ? 'all' : 'upcoming'),
      isAssistant ? Promise.resolve(null) : instructorService.getCourse(id),
    ] as const);
    if (cohortResult.status === 'fulfilled') setCohorts(cohortResult.value);
    else {
      console.error('[InstructorClassesScreen.load] Error:', cohortResult.reason instanceof Error ? cohortResult.reason.message : 'Unknown error');
      setLoadError('Classes could not be loaded. Check your connection and try again.');
    }
    if (sessionResult.status === 'fulfilled') setSessions(sessionResult.value);
    else console.warn('[InstructorClassesScreen.load] Sessions unavailable:', sessionResult.reason instanceof Error ? sessionResult.reason.message : 'Unknown error');
    if (courseResult.status === 'fulfilled' && courseResult.value) setCohortRequired(courseResult.value.cohortRequired);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [id, showPastSessions, isAssistant]);

  useEffect(() => { void load(); }, [load]);

  const loadRoster = useCallback(async () => {
    if (!id || isAssistant) return;
    setIsRosterLoading(true);
    setRosterError(null);
    try {
      const result = await teachingWorkflowService.getRoster(id, rosterFilter === EVERYONE ? null : rosterFilter);
      setRoster(result.learners);
      setRosterTruncated(result.truncated);
    } catch (error: unknown) {
      console.error('[InstructorClassesScreen.loadRoster] Error:', error instanceof Error ? error.message : 'Unknown error');
      setRosterError(serverMessage(error, 'The roster could not load.'));
    } finally {
      setIsRosterLoading(false);
    }
  }, [id, rosterFilter, isAssistant]);

  useEffect(() => { void loadRoster(); }, [loadRoster]);

  const cohortName = (cohortId: string): string => (cohortId ? cohorts.find((cohort) => cohort.id === cohortId)?.name ?? 'A class' : NO_CLASS_LABEL);
  const replaceCohort = (updated: CourseCohort) => setCohorts((current) => (current.some((cohort) => cohort.id === updated.id) ? current.map((cohort) => (cohort.id === updated.id ? updated : cohort)) : [...current, updated]));

  const handleRequirement = async (required: boolean) => {
    setCohortRequired(required);
    setActionError(null);
    try {
      await teachingWorkflowService.setCohortRequirement(id, required);
      setNotice(required ? 'New learners now choose a class when they enroll.' : 'Learners can enroll without a class again (self-paced).');
    } catch (error: unknown) {
      console.error('[InstructorClassesScreen.handleRequirement] Error:', error instanceof Error ? error.message : 'Unknown error');
      setCohortRequired(!required);
      setActionError(serverMessage(error, 'The setting could not be saved. Please try again.'));
    }
  };

  const handleAddAssistant = async () => {
    if (!assistantCohort || !assistantName.trim()) { setAssistantError('Enter the assistant\'s Ourlime username.'); return; }
    setIsAddingAssistant(true);
    setAssistantError(null);
    try {
      replaceCohort(await teachingWorkflowService.addAssistant(assistantCohort.id, assistantName));
      setNotice(`Assistant added to ${assistantCohort.name}. They can now grade that class's work.`);
      setAssistantCohort(null);
    } catch (error: unknown) {
      console.error('[InstructorClassesScreen.handleAddAssistant] Error:', error instanceof Error ? error.message : 'Unknown error');
      // The server explains who cannot be an assistant (minors, learners of this course, unknown usernames).
      setAssistantError(serverMessage(error, 'The assistant could not be added. Please try again.'));
    } finally {
      setIsAddingAssistant(false);
    }
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setIsConfirming(true);
    setActionError(null);
    try {
      if (pending.kind === 'archive') {
        replaceCohort(await teachingWorkflowService.archiveCohort(pending.cohort.id, pending.cohort.status === 'archived'));
      } else if (pending.kind === 'removeAssistant') {
        replaceCohort(await teachingWorkflowService.removeAssistant(pending.cohort.id, pending.assistantId));
      } else {
        const cancelled = await teachingWorkflowService.cancelSession(pending.session.id);
        setSessions((current) => current.map((session) => (session.id === cancelled.id ? cancelled : session)));
      }
      setPending(null);
    } catch (error: unknown) {
      console.error('[InstructorClassesScreen.handleConfirm] Error:', error instanceof Error ? error.message : 'Unknown error');
      setPending(null);
      setActionError(serverMessage(error, 'That change could not be saved. Please try again.'));
    } finally {
      setIsConfirming(false);
    }
  };

  const handleMove = async () => {
    if (!movingLearner) return;
    const target = moveTarget === NO_CLASS_LABEL ? NO_CLASS : cohorts.find((cohort) => cohort.name === moveTarget)?.id ?? NO_CLASS;
    setIsMoving(true);
    setMoveError(null);
    try {
      await teachingWorkflowService.assignLearner(id, movingLearner.userId, target);
      setNotice(`${movingLearner.displayName} is now in ${cohortName(target)}.`);
      setMovingLearner(null);
      void loadRoster();
      void load();
    } catch (error: unknown) {
      console.error('[InstructorClassesScreen.handleMove] Error:', error instanceof Error ? error.message : 'Unknown error');
      setMoveError(serverMessage(error, 'The learner could not be moved. Please try again.'));
    } finally {
      setIsMoving(false);
    }
  };

  const confirmCopy = (): { title: string; message: string; confirm: string } => {
    if (!pending) return { title: '', message: '', confirm: 'OK' };
    if (pending.kind === 'archive') {
      return pending.cohort.status === 'archived'
        ? { title: `Reopen ${pending.cohort.name}?`, message: 'Learners can join it again while its enrollment window is open.', confirm: 'Reopen' }
        : { title: `Close ${pending.cohort.name}?`, message: 'No one new can join. Its learners, their work and its assistants stay.', confirm: 'Close class' };
    }
    if (pending.kind === 'removeAssistant') return { title: `Remove ${pending.name}?`, message: `They will no longer see or grade ${pending.cohort.name}'s work.`, confirm: 'Remove' };
    return { title: 'Cancel this session?', message: `"${pending.session.title}" will show as cancelled and its join link is removed. This cannot be undone.`, confirm: 'Cancel session' };
  };
  const copy = confirmCopy();
  const activeCohorts = cohorts.filter((cohort) => cohort.status === 'active');
  const schedulableCohorts = isAssistant ? cohorts.filter((cohort) => assistedCohortIds.includes(cohort.id)) : cohorts;
  const canManageSession = (session: CourseSession): boolean => !isAssistant || (session.cohortId !== '' && assistedCohortIds.includes(session.cohortId));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title={isAssistant ? 'Sessions' : 'Classes and sessions'} subtitle={courseName} onBack={() => router.back()} />
      {isLoading ? (
        <View style={styles.centerFill}><ActivityIndicator color={colors.accent} /></View>
      ) : loadError && cohorts.length === 0 ? (
        <View style={styles.centerFill}>
          <ELearningEmptyState icon={<Users size={40} color={colors.mutedText} />} title="Classes could not load" hint={loadError} actionLabel="Try again" onAction={() => { setIsLoading(true); void load(); }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); void loadRoster(); }} tintColor={colors.accent} />}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            {notice ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`${notice} Dismiss`} onPress={() => setNotice(null)} style={styles.success}>
                <Text accessibilityLiveRegion="polite" style={styles.successText}>{notice}</Text>
              </Pressable>
            ) : null}
            <FieldMessage error={actionError ?? undefined} />

            {isAssistant ? (
              <Text style={styles.muted}>
                You assist {schedulableCohorts.length === 1 ? schedulableCohorts[0].name : `${schedulableCohorts.length} classes`} here. Schedule live classes, office hours and deadlines for {schedulableCohorts.length === 1 ? 'that class' : 'those classes'}; the instructor manages the classes themselves.
              </Text>
            ) : null}

            {!isAssistant ? <>
            <View style={styles.card}>
              <ToggleRow
                label="Learners must join a class"
                description={cohortRequired ? 'New learners pick an open class when they enroll.' : 'Off: learners can enroll and study at their own pace, and join a class if they want.'}
                value={cohortRequired}
                onChange={(required) => void handleRequirement(required)}
              />
            </View>

            {/* ── Classes ── */}
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Classes</Text>
              <ELearningButton label="New class" icon={<Plus size={16} color="#ffffff" />} onPress={() => { setEditingCohort(null); setIsCohortFormOpen(true); }} />
            </View>
            {cohorts.length === 0 ? (
              <ELearningEmptyState icon={<Users size={36} color={colors.mutedText} />} title="No classes yet" hint="This course is self-paced. Add a class to give learners dates, live sessions and assistants." />
            ) : cohorts.map((cohort) => {
              const problem = cohortJoinProblem(cohort, new Date());
              return (
                <View key={cohort.id} style={styles.card}>
                  <View style={styles.headRow}>
                    <Text style={[styles.cardTitle, styles.flexText]}>{cohort.name}</Text>
                    <StatusPill label={cohort.status === 'archived' ? 'Closed' : problem ?? 'Open to join'} tone={cohort.status === 'archived' ? 'neutral' : problem ? 'warning' : 'success'} />
                  </View>
                  {cohort.description ? <Text style={styles.body}>{cohort.description}</Text> : null}
                  <Text style={styles.muted}>{cohortSummary(cohort)}</Text>
                  {cohort.enrollmentOpensAt || cohort.enrollmentClosesAt ? (
                    <Text style={styles.muted}>Joining: {cohort.enrollmentOpensAt ? `from ${formatWhen(cohort.enrollmentOpensAt)}` : 'open now'}{cohort.enrollmentClosesAt ? ` until ${formatWhen(cohort.enrollmentClosesAt)}` : ''}</Text>
                  ) : null}
                  <Text style={styles.label}>Assistants</Text>
                  {cohort.assistants.length === 0 ? <Text style={styles.muted}>None. Assistants grade and answer review requests for this class only.</Text> : cohort.assistants.map((assistant) => (
                    <View key={assistant.id} style={styles.assistantRow}>
                      <Text style={[styles.body, styles.flexText]} numberOfLines={1}>{assistant.name}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${assistant.name}`} android_ripple={RIPPLE} onPress={() => setPending({ kind: 'removeAssistant', cohort, assistantId: assistant.id, name: assistant.name })} style={styles.iconButton}>
                        <UserMinus size={18} color={colors.destructiveText} />
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.actions}>
                    <ELearningButton label="Edit" variant="secondary" onPress={() => { setEditingCohort(cohort); setIsCohortFormOpen(true); }} />
                    {cohort.status === 'active' ? <ELearningButton label="Add assistant" variant="secondary" icon={<UserPlus size={16} color={colors.text} />} onPress={() => { setAssistantCohort(cohort); setAssistantName(''); setAssistantError(null); }} /> : null}
                    <ELearningButton label="Roster" variant="secondary" onPress={() => setRosterFilter(cohort.id)} />
                    <ELearningButton label={cohort.status === 'archived' ? 'Reopen' : 'Close'} variant={cohort.status === 'archived' ? 'secondary' : 'danger'} onPress={() => setPending({ kind: 'archive', cohort })} />
                  </View>
                </View>
              );
            })}

            {/* ── Roster ── */}
            <Text accessibilityRole="header" style={styles.sectionTitle}>Roster</Text>
            <Text style={styles.muted}>Names are shown as learners chose them; younger learners appear by first name and initial. Learners never see each other here.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <ELearningChip label="Everyone" isSelected={rosterFilter === EVERYONE} onPress={() => setRosterFilter(EVERYONE)} />
              <ELearningChip label={NO_CLASS_LABEL} isSelected={rosterFilter === NO_CLASS} onPress={() => setRosterFilter(NO_CLASS)} />
              {cohorts.map((cohort) => <ELearningChip key={cohort.id} label={cohort.name} isSelected={rosterFilter === cohort.id} onPress={() => setRosterFilter(cohort.id)} />)}
            </ScrollView>
            <View style={styles.card}>
              {isRosterLoading ? <ActivityIndicator color={colors.accent} /> : rosterError ? <FieldMessage error={rosterError} /> : roster.length === 0 ? (
                <Text style={styles.muted}>No learners here yet.</Text>
              ) : roster.map((learner) => (
                <View key={learner.userId} style={styles.learnerRow}>
                  <View style={styles.flexText}>
                    <Text style={styles.body} numberOfLines={1}>{learner.displayName}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{cohortName(learner.cohortId)} · {learner.progress}% complete{learner.enrollmentStatus === 'completed' ? ' · finished' : ''}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Move ${learner.displayName} to another class`} android_ripple={RIPPLE} onPress={() => { setMovingLearner(learner); setMoveTarget(cohortName(learner.cohortId)); setMoveError(null); }} style={styles.smallButton}>
                    <Text style={styles.smallButtonText}>Move</Text>
                  </Pressable>
                </View>
              ))}
              {rosterTruncated ? <Text style={styles.muted}>Showing the first 300 learners.</Text> : null}
            </View>
            </> : null}

            {/* ── Sessions ── */}
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Sessions</Text>
              <ELearningButton label="Schedule" icon={<CalendarPlus size={16} color="#ffffff" />} onPress={() => { setEditingSession(null); setIsSessionFormOpen(true); }} />
            </View>
            <View style={styles.chips}>
              <ELearningChip label="Upcoming" isSelected={!showPastSessions} onPress={() => setShowPastSessions(false)} />
              <ELearningChip label="Include past" isSelected={showPastSessions} onPress={() => setShowPastSessions(true)} />
            </View>
            <View style={styles.card}>
              {sessions.length === 0 ? <Text style={styles.muted}>No sessions scheduled. Add live classes, office hours or deadlines; learners see them under Upcoming.</Text> : sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  onEdit={canManageSession(session) ? () => { setEditingSession(session); setIsSessionFormOpen(true); } : undefined}
                  onCancel={canManageSession(session) ? () => setPending({ kind: 'cancelSession', session }) : undefined}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      <CohortFormSheet visible={isCohortFormOpen} courseId={id} cohort={editingCohort} onClose={() => setIsCohortFormOpen(false)} onSaved={(saved) => { replaceCohort(saved); setNotice(`${saved.name} saved.`); }} />
      <SessionFormSheet visible={isSessionFormOpen} courseId={id} cohorts={schedulableCohorts} allowWholeCourse={!isAssistant} session={editingSession} onClose={() => setIsSessionFormOpen(false)} onSaved={() => { setNotice('Session saved. Its learners are notified.'); void load(); }} />

      <ScheduleSheet
        visible={assistantCohort !== null}
        title="Add an assistant"
        description={assistantCohort ? `To ${assistantCohort.name}. Assistants grade this class's work and answer its review requests. They must be adults and cannot be learners in this course.` : undefined}
        onClose={() => { if (!isAddingAssistant) setAssistantCohort(null); }}
        footer={<>
          <ELearningButton label="Cancel" variant="secondary" isDisabled={isAddingAssistant} onPress={() => setAssistantCohort(null)} />
          <ELearningButton label="Add assistant" busyLabel="Adding…" isBusy={isAddingAssistant} onPress={() => void handleAddAssistant()} />
        </>}
      >
        <FormField label="Ourlime username" required value={assistantName} onChange={setAssistantName} placeholder="e.g. maya.r" autoCapitalize="none" maxLength={50} />
        <FieldMessage error={assistantError ?? undefined} />
      </ScheduleSheet>

      <ScheduleSheet
        visible={movingLearner !== null}
        title={movingLearner ? `Move ${movingLearner.displayName}` : 'Move learner'}
        description="Their current work moves with them, so the new class's assistants can grade it."
        onClose={() => { if (!isMoving) setMovingLearner(null); }}
        footer={<>
          <ELearningButton label="Cancel" variant="secondary" isDisabled={isMoving} onPress={() => setMovingLearner(null)} />
          <ELearningButton label="Move" busyLabel="Moving…" isBusy={isMoving} onPress={() => void handleMove()} />
        </>}
      >
        <ChoiceChips label="Class" options={[NO_CLASS_LABEL, ...activeCohorts.map((cohort) => cohort.name)]} selected={[moveTarget]} onToggle={setMoveTarget} single />
        <FieldMessage error={moveError ?? undefined} />
      </ScheduleSheet>

      <CustomModal
        visible={pending !== null}
        type={pending?.kind === 'archive' && pending.cohort.status === 'archived' ? 'info' : 'warning'}
        title={copy.title}
        message={copy.message}
        confirmText={copy.confirm}
        cancelText="Keep"
        isLoading={isConfirming}
        onConfirm={() => void handleConfirm()}
        onClose={() => { if (!isConfirming) setPending(null); }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: ELEARNING_GUTTER, gap: 14 },
  card: { padding: 14, gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flexText: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  assistantRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  learnerRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  smallButton: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  smallButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  success: { padding: 12, borderRadius: 12, backgroundColor: colors.successSurface },
  successText: { color: colors.successText, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
