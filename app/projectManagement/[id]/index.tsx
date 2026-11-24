import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Archive, Clock, Download, FileText, FolderKanban, FolderOpen, Layers, LogOut, MoreHorizontal, Pencil, Sparkles, Timer, Users,
} from 'lucide-react-native';
import { toast } from 'sonner-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import CustomModal from '@/components/ui/CustomModal';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { ProjectBoardSkeleton } from '@/components/projectManagement/ProjectSkeletons';
import CreateTaskSheet from '@/components/projectManagement/CreateTaskSheet';
import TaskDetailSheet from '@/components/projectManagement/TaskDetailSheet';
import ProjectFormSheet, { type ProjectFormValues } from '@/components/projectManagement/ProjectFormSheet';
import ProjectSettingsExtras from '@/components/projectManagement/ProjectSettingsExtras';
import ProjectUpgradeSheet from '@/components/projectManagement/ProjectUpgradeSheet';
import ProjectMilestonesPanel from '@/components/projectManagement/ProjectMilestonesPanel';
import ProjectTimelinePanel from '@/components/projectManagement/ProjectTimelinePanel';
import ProjectWorkloadPanel from '@/components/projectManagement/ProjectWorkloadPanel';
import ProjectFilesPanel from '@/components/projectManagement/ProjectFilesPanel';
import ProjectTimesheetsPanel from '@/components/projectManagement/ProjectTimesheetsPanel';
import SessionRetryBanner from '@/components/projectManagement/SessionRetryBanner';
import ProjectFriendPickerModal from '@/components/projectManagement/ProjectFriendPickerModal';
import ProjectLifecycleSheet from '@/components/projectManagement/ProjectLifecycleSheet';
import ProjectStatusBanner from '@/components/projectManagement/ProjectStatusBanner';
import ProjectActivityPanel from '@/components/projectManagement/ProjectActivityPanel';
import ProjectActionSheet from '@/components/projectManagement/ProjectActionSheet';
import ProjectModuleSheet from '@/components/projectManagement/ProjectModuleSheet';
import ProjectOverviewPanel, { type ProjectSectionId } from '@/components/projectManagement/ProjectOverviewPanel';
import ProjectTasksPanel, { type TaskView } from '@/components/projectManagement/ProjectTasksPanel';
import ProjectTeamPanel from '@/components/projectManagement/ProjectTeamPanel';
import ProjectCommunityLinkCard from '@/components/projectManagement/ProjectCommunityLinkCard';
import { ROLE_LABELS } from '@/components/projectManagement/ProjectCard';
import {
  PROJECT_GUTTER, PROJECT_RIPPLE, ProjectAvatarStack, ProjectButton, ProjectEmptyState, ProjectIconButton, ProjectPill, ProjectProgressBar,
  ProjectScreenHeader, ProjectSegmented, ProjectSheetRow, projectStatusTone,
} from '@/components/projectManagement/ProjectUiParts';
import { projectColorHex } from '@/components/projectManagement/projectColors';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { projectService } from '@/lib/services/ProjectService';
import { projectEntitlementService } from '@/lib/services/ProjectEntitlementService';
import { projectExportService } from '@/lib/services/ProjectExportService';
import { projectLifecycleRules } from '@/lib/services/ProjectLifecycleRules';
import { DEFAULT_TASK_FILTERS, type TaskFilters, type TaskQuickFilter } from '@/lib/services/ProjectInsightRules';
import type {
  ActiveTaskTimer, Milestone, ProjectEmailInvitation, ProjectLoadError, ProjectRecord, ProjectRole, ProjectStatus, ProjectTeamMember, Status, Task, TaskTemplate, TeamMember,
} from '@/lib/types/project';

type ModuleView = 'files' | 'timeline' | 'workload' | 'timesheets';
type CreateTaskTarget = { status?: Status; milestoneId?: string };

const SECTIONS: { value: ProjectSectionId; label: string }[] = [
  { value: 'overview', label: 'Overview' }, { value: 'tasks', label: 'Tasks' }, { value: 'milestones', label: 'Milestones' }, { value: 'team', label: 'Team' },
];
const MODULE_TITLES: { [module in ModuleView]: string } = { files: 'Files', timeline: 'Timeline', workload: 'Workload', timesheets: 'Timesheets' };

// Same messages as the website's project page error states.
const LOAD_ERRORS: { [error in ProjectLoadError]: { title: string; message: string; retry: boolean } } = {
  'not-found': { title: 'Project not found', message: 'This project does not exist or may have been deleted.', retry: false },
  'permission-denied': { title: 'No access', message: 'You do not have permission to view this project. It may be private, or you may have been removed from it.', retry: false },
  'network-error': { title: 'Connection problem', message: 'We could not reach the server. Check your connection and try again.', retry: true },
  unknown: { title: 'Something went wrong', message: 'An unexpected error occurred while loading this project.', retry: true },
};

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

export default function ProjectBoardScreen() {
  const router = useRouter();
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const projectId = id as string;
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { activeUserId, nativeSession } = useAppData();
  const currentUserId = activeUserId ?? '';
  const sessionReady = Boolean(activeUserId);
  const mutationReady = Boolean(activeUserId && nativeSession.uid === activeUserId && nativeSession.status === 'ready');
  const cachedProject = projectService.getCachedProject(projectId);

  // Data
  const { getDecision } = usePageAccess();
  const requestGeneration = useRef(0);
  const [project, setProject] = useState<ProjectRecord | null>(cachedProject);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTaskTimer | null>(null);
  const [loading, setLoading] = useState(cachedProject === null);
  const [loadError, setLoadError] = useState<ProjectLoadError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; message: string; type?: 'info' | 'success' | 'warning' | 'danger' } | null>(null);

  const pageCanMutate = getDecision('/projectManagement').canMutate;
  const writeCapability = projectService.getMutationCapability('create_task', project, { signedIn: Boolean(activeUserId), sessionReady: mutationReady, pageCanMutate });
  const inviteCapability = projectService.getMutationCapability('invite', project, { signedIn: Boolean(activeUserId), sessionReady: mutationReady, pageCanMutate });
  const canWrite = writeCapability.allowed;
  const canInvite = inviteCapability.allowed;
  const canManageSettings = project?.role === 'owner' || project?.role === 'admin';

  // Email invitations (pending and expired) for owners and admins, loaded with the Team section.
  const [emailInvitations, setEmailInvitations] = useState<ProjectEmailInvitation[]>([]);

  // Sections, views and sheets
  const [section, setSection] = useState<ProjectSectionId>('overview');
  const [taskView, setTaskView] = useState<TaskView>('list');
  const [taskFilters, setTaskFilters] = useState<TaskFilters>(DEFAULT_TASK_FILTERS);
  // Move/complete is locked while that task's change saves (a fast second tap used to skip a column).
  const [statusBusyTaskId, setStatusBusyTaskId] = useState<string | null>(null);
  const inviteOpenedRef = useRef(false);
  const [createTaskTarget, setCreateTaskTarget] = useState<CreateTaskTarget | null>(null);
  const [milestoneCreateOpen, setMilestoneCreateOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moduleView, setModuleView] = useState<ModuleView | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'summary' | null>(null);
  // Status actions sheet: null when closed; initialTarget opens straight on one confirmation (the banner's Restore).
  const [lifecycleSheet, setLifecycleSheet] = useState<{ initialTarget: ProjectStatus | null } | null>(null);

  // Invite form
  const [inviteRecipient, setInviteRecipient] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('member');
  const [inviting, setInviting] = useState(false);
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const inviteSwipeDismiss = useSwipeDismiss({ visible: inviteOpen, onDismiss: () => setInviteOpen(false), disabled: inviting });

  const activeTask = useMemo(() => (activeTaskId ? tasks.find((task) => task.id === activeTaskId) ?? null : null), [activeTaskId, tasks]);

  useEffect(() => {
    if (!projectId || !activeUserId) return;
    const availableProject = projectService.getCachedProject(projectId);
    if (!availableProject) return;
    setProject(availableProject);
    setLoading(false);
  }, [activeUserId, projectId]);

  useEffect(() => {
    if (!projectId || !sessionReady) return;
    return projectService.subscribeToProject(
      projectId,
      (updatedProject) => { setProject(updatedProject); setLoadError(null); setLoading(false); },
      (error) => {
        ++requestGeneration.current;
        setProject(null); setTasks([]); setActiveTaskId(null); setLoading(false);
        setLoadError(projectService.classifyLoadError(error));
      },
    );
  }, [projectId, sessionReady]);

  const loadProject = useCallback(async () => {
    if (!projectId || !sessionReady) return;
    const generation = ++requestGeneration.current;
    try {
      const data = await projectService.getProject(projectId);
      if (generation !== requestGeneration.current) return;
      setProject(data.project);
      setTeamMembers(data.teamMembers);
      setLoadError(null);
    } catch (error: unknown) {
      if (generation !== requestGeneration.current) return;
      setLoadError(projectService.classifyLoadError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, sessionReady]);

  useEffect(() => {
    if (sessionReady) void loadProject();
    else setLoading(nativeSession.status === 'bridging' || nativeSession.status === 'idle');
  }, [loadProject, nativeSession.status, sessionReady]);

  // Live tasks, milestones, task templates and the persisted task timer (same listeners as the website).
  useEffect(() => {
    if (!projectId || !sessionReady) return;
    const unsubscribers = [
      projectService.subscribeToTasks(projectId, setTasks, (error) => { setTasks([]); setActiveTaskId(null); setFeedback({ title: 'Task access changed', message: projectMessage(error), type: 'danger' }); }),
      projectService.subscribeToMilestones(projectId, setMilestones, () => setMilestones([])),
      projectService.subscribeToTaskTemplates(projectId, setTaskTemplates, () => setTaskTemplates([])),
      projectService.subscribeToActiveTimer((timer) => setActiveTimer(timer && timer.projectId === projectId ? timer : null)),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [projectId, sessionReady]);

  const loadEmailInvitations = useCallback(async () => {
    if (!projectId || !canInvite) { setEmailInvitations([]); return; }
    try {
      setEmailInvitations(await projectService.listEmailInvites(projectId));
    } catch (error: unknown) {
      console.error('[ProjectBoardScreen.loadEmailInvitations] Error:', error);
    }
  }, [canInvite, projectId]);

  useEffect(() => {
    if (section === 'team') void loadEmailInvitations();
  }, [loadEmailInvitations, section]);

  // A project created from the list arrives with ?invite=1: open the friend picker once (website "Initial Members").
  useEffect(() => {
    if (invite !== '1' || inviteOpenedRef.current || !project || !canInvite) return;
    inviteOpenedRef.current = true;
    setFriendPickerOpen(true);
  }, [canInvite, invite, project]);

  const handleMoveTask = async (task: Task, nextStatus: Status): Promise<void> => {
    if (!writeCapability.allowed) { setFeedback({ title: 'Task update unavailable', message: writeCapability.reason, type: 'warning' }); return; }
    if (statusBusyTaskId) return;
    setStatusBusyTaskId(task.id);
    try {
      await projectService.updateTaskStatus(projectId, task.id, nextStatus);
    } catch (error: unknown) {
      setFeedback({ title: 'Could not move the task', message: error instanceof Error ? error.message : 'Please try again.', type: 'danger' });
    } finally {
      setStatusBusyTaskId(null);
    }
  };

  const handleOpenCreateTask = (target: CreateTaskTarget = {}): void => {
    if (!writeCapability.allowed) { setFeedback({ title: 'New task unavailable', message: writeCapability.reason, type: 'warning' }); return; }
    setCreateTaskTarget(target);
  };

  const handleSendInvite = async () => {
    if (!inviteCapability.allowed) { setFeedback({ title: 'Invitations unavailable', message: inviteCapability.reason, type: 'warning' }); return; }
    if (!inviteRecipient.trim()) { setFeedback({ title: 'Who should we invite?', message: 'Choose a friend or enter an email or username.', type: 'warning' }); return; }
    setInviting(true);
    try {
      await projectService.inviteMember(projectId, inviteRecipient.trim(), inviteRole);
      setInviteRecipient('');
      setInviteOpen(false);
      toast.success('Invitation sent');
      void loadProject();
      void loadEmailInvitations();
    } catch (error: unknown) {
      setFeedback({ title: 'Invitation not sent', message: error instanceof Error ? error.message : 'Could not send the invitation.', type: 'danger' });
    } finally {
      setInviting(false);
    }
  };

  const handleOpenInvite = (): void => {
    if (!inviteCapability.allowed) { setFeedback({ title: 'Invitations unavailable', message: inviteCapability.reason, type: 'warning' }); return; }
    setInviteOpen(true);
  };

  const handleSaveSettings = async (values: ProjectFormValues): Promise<void> => {
    await projectService.updateProjectSettings(projectId, values);
    toast.success('Project updated');
    setSettingsOpen(false);
    void loadProject();
  };

  /** Pause, resume, complete, archive, restore or reopen, checked against the status this screen shows. */
  const handleTransition = async (toStatus: ProjectStatus, reason: string): Promise<void> => {
    if (!project) return;
    await projectService.transitionProject(projectId, { expectedStatus: project.status, toStatus, reason });
    setProject((current) => current ? { ...current, status: toStatus, statusChangedAt: new Date(), statusChangedBy: currentUserId } : current);
    void loadProject();
  };

  const handleDeleteProject = async (): Promise<void> => {
    await projectService.deleteProject(projectId);
    setSettingsOpen(false);
    router.replace('/projectManagement');
  };

  const handleLeaveProject = async (): Promise<void> => {
    if (leaving) return;
    setLeaving(true);
    try {
      await projectService.leaveProject(projectId);
      setLeaveConfirmOpen(false);
      router.replace('/projectManagement');
    } catch (error: unknown) {
      setLeaveConfirmOpen(false);
      setFeedback({ title: 'Could not leave', message: error instanceof Error ? error.message : 'Please try again.', type: 'danger' });
    } finally {
      setLeaving(false);
    }
  };

  const handleToggleAutoAssign = async (): Promise<void> => {
    if (!project) return;
    const nextEnabled = !projectEntitlementService.isAutomationRuleEnabled(project, '1');
    try {
      await projectService.updateProjectPlan(projectId, { automationRules: { ...project.automationRules, '1': nextEnabled } });
      toast.success(nextEnabled ? 'New unassigned tasks go to the owner' : 'New tasks stay unassigned unless someone is picked');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'The setting could not be saved.');
    }
  };

  const handleExport = async (kind: 'csv' | 'summary'): Promise<void> => {
    if (!project || exporting) return;
    setExporting(kind);
    try {
      if (kind === 'csv') await projectExportService.exportTasksToCsv(project, tasks, teamMembers);
      else await projectExportService.exportProjectSummary(project, tasks, teamMembers, milestones);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'The export could not be created.');
    } finally {
      setExporting(null);
    }
  };

  const pendingInvites = useMemo(() => teamMembers.filter((member) => !member.isOwner && member.membershipStatus === 'pending'), [teamMembers]);
  const acceptedMembers = useMemo(() => teamMembers.filter((member) => member.isOwner || member.membershipStatus !== 'pending'), [teamMembers]);
  const existingMembersRecord = useMemo<Record<string, ProjectTeamMember>>(() => {
    const map: Record<string, ProjectTeamMember> = {};
    for (const member of teamMembers) map[member.id] = { role: member.role, membershipStatus: member.membershipStatus };
    return map;
  }, [teamMembers]);

  const handleOpenTask = (task: Task): void => { setModuleView(null); setActiveTaskId(task.id); };
  const handleShowTasks = (quick: TaskQuickFilter): void => { setTaskFilters({ ...DEFAULT_TASK_FILTERS, quick }); setSection('tasks'); };
  const handleAddMilestone = (): void => { setSection('milestones'); setMilestoneCreateOpen(true); };

  if (!activeUserId) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <ProjectScreenHeader title="E-Projects" onBack={() => router.back()} />
        <ProjectEmptyState icon={<FolderOpen size={40} color={colors.mutedText} />} title="Sign in to view this project" />
      </SafeAreaView>
    );
  }

  if (loading || !sessionReady) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <ProjectScreenHeader title="Project" onBack={() => router.back()} />
        <ScrollView showsVerticalScrollIndicator={false}><ProjectBoardSkeleton /></ScrollView>
      </SafeAreaView>
    );
  }

  if (!project) {
    const config = LOAD_ERRORS[loadError ?? 'not-found'];
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <ProjectScreenHeader title="Project" onBack={() => router.back()} />
        <View style={styles.errorContainer}>
          <ProjectEmptyState
            icon={<FolderOpen size={44} color={colors.mutedText} />}
            title={config.title}
            hint={config.message}
            actionLabel={config.retry ? 'Try again' : undefined}
            onAction={config.retry ? () => { setLoading(true); setLoadError(null); void loadProject(); } : undefined}
            secondaryLabel="Back to projects"
            onSecondary={() => router.replace('/projectManagement')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isPremium = projectEntitlementService.isPremium(project);
  const activeTimerTask = activeTimer ? tasks.find((task) => task.id === activeTimer.taskId) ?? null : null;
  const doneCount = tasks.filter((task) => task.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : project.progress;
  const fileCount = tasks.reduce((sum, task) => sum + task.attachments.length, 0);
  const statusChangedByName = project.statusChangedBy
    ? project.statusChangedBy === currentUserId ? 'you' : teamMembers.find((member) => member.id === project.statusChangedBy)?.name ?? 'a former member'
    : '';
  const closeMoreThen = (action: () => void) => (): void => { setMoreOpen(false); action(); };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <ProjectScreenHeader
        title={project.name}
        subtitle={`${projectLifecycleRules.label(project.status)} · ${project.isOwner ? 'Owner' : ROLE_LABELS[project.role]}`}
        onBack={() => router.back()}
        right={<ProjectIconButton accessibilityLabel="Project menu" accessibilityHint="Status, details, files, timeline, exports and more" onPress={() => setMoreOpen(true)}><MoreHorizontal size={22} color={colors.icon} /></ProjectIconButton>}
      />
      <SessionRetryBanner />

      <ScrollView
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProject(); }} tintColor="#10b981" />}
      >
        <View style={styles.top}>
          <View style={styles.identity}>
            <View style={styles.identityRow}>
              <View style={[styles.tile, { backgroundColor: projectColorHex(project.color) }]}><FolderKanban size={22} color="#ffffff" /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text numberOfLines={3} style={styles.name}>{project.name}</Text>
                <View style={styles.pills}>
                  <ProjectPill label={projectLifecycleRules.label(project.status)} tone={projectStatusTone(project.status)} />
                  <ProjectPill label={project.isOwner ? 'Owner' : ROLE_LABELS[project.role]} tone="neutral" />
                </View>
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <View style={styles.progressRow}>
                <Text style={styles.muted}>{tasks.length > 0 ? `${doneCount} of ${plural(tasks.length, 'task', 'tasks')} done` : 'No tasks yet'}</Text>
                <Text style={styles.percent}>{progress}%</Text>
              </View>
              <ProjectProgressBar value={progress} accessibilityLabel="Project progress" />
            </View>
            <Pressable onPress={() => setSection('team')} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`${plural(acceptedMembers.length, 'member', 'members')}. Open team`} style={styles.teamRow}>
              <ProjectAvatarStack members={acceptedMembers} max={5} size={26} />
              <Text numberOfLines={1} style={[styles.muted, { flexShrink: 1 }]}>{plural(acceptedMembers.length, 'member', 'members')}{pendingInvites.length > 0 ? ` · ${pendingInvites.length} invited` : ''}</Text>
            </Pressable>
          </View>

          <ProjectStatusBanner
            status={project.status}
            changedAt={project.statusChangedAt}
            changedByName={statusChangedByName}
            canManage={canManageSettings}
            onReactivate={() => setLifecycleSheet({ initialTarget: 'active' })}
          />

          {activeTimerTask ? (
            <Pressable onPress={() => handleOpenTask(activeTimerTask)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`Timer running on ${activeTimerTask.title}. Open the task`} style={styles.timerBanner}>
              <Timer size={18} color={colors.successText} />
              <Text numberOfLines={1} style={styles.timerText}>Timer running · {activeTimerTask.title}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.tabs}>
          <ProjectSegmented accessibilityLabel="Project sections" value={section} onChange={setSection} options={SECTIONS} />
        </View>

        <View style={styles.sectionBody}>
          {section === 'overview' ? (
            <ProjectOverviewPanel
              project={project}
              tasks={tasks}
              milestones={milestones}
              acceptedMembers={acceptedMembers}
              pendingCount={pendingInvites.length}
              currentUserId={currentUserId}
              canManage={canManageSettings && project.status === 'active'}
              canWrite={canWrite}
              onOpenTask={handleOpenTask}
              onShowTasks={handleShowTasks}
              onShowSection={setSection}
              onCreateTask={() => handleOpenCreateTask()}
              onInvite={handleOpenInvite}
              onEditDetails={() => setSettingsOpen(true)}
              onAddMilestone={handleAddMilestone}
              onChangeStatus={() => setLifecycleSheet({ initialTarget: project.status === 'active' ? 'completed' : null })}
              activity={(
                <ProjectActivityPanel
                  projectId={projectId}
                  teamMembers={teamMembers}
                  currentUserId={currentUserId}
                  refreshKey={`${project.status}|${project.statusChangedAt?.getTime() ?? 0}|${project.communityLink?.status ?? ''}|${teamMembers.map((member) => `${member.id}:${member.role}:${member.membershipStatus ?? ''}`).join(',')}`}
                />
              )}
              community={<ProjectCommunityLinkCard project={project} canManage={canManageSettings} />}
            />
          ) : null}
          {section === 'tasks' ? (
            <ProjectTasksPanel
              tasks={tasks}
              milestones={milestones}
              acceptedMembers={acceptedMembers}
              currentUserId={currentUserId}
              canWrite={canWrite}
              busyTaskId={statusBusyTaskId}
              activeTimerTaskId={activeTimer?.taskId ?? null}
              view={taskView}
              onChangeView={setTaskView}
              filters={taskFilters}
              onChangeFilters={setTaskFilters}
              onOpenTask={handleOpenTask}
              onMoveTask={(task, status) => void handleMoveTask(task, status)}
              onCreateTask={(status) => handleOpenCreateTask(status ? { status } : {})}
            />
          ) : null}
          {section === 'milestones' ? (
            <ProjectMilestonesPanel
              project={project}
              milestones={milestones}
              tasks={tasks}
              canEdit={canWrite}
              currentUserId={currentUserId}
              isCreateOpen={milestoneCreateOpen}
              onOpenCreate={() => { if (canWrite) setMilestoneCreateOpen(true); else setFeedback({ title: 'Milestones are read-only', message: writeCapability.reason, type: 'warning' }); }}
              onCloseCreate={() => setMilestoneCreateOpen(false)}
              onOpenTask={handleOpenTask}
              onAddTask={(milestoneId) => handleOpenCreateTask({ milestoneId })}
            />
          ) : null}
          {section === 'team' ? (
            <ProjectTeamPanel
              project={project}
              teamMembers={teamMembers}
              currentUserId={currentUserId}
              canInvite={canInvite}
              onInvite={handleOpenInvite}
              onChangeRole={async (member, role) => { await projectService.changeMemberRole(projectId, member.id, role); await loadProject(); }}
              onRemove={async (member) => {
                if (member.membershipStatus === 'pending') await projectService.cancelInvite(projectId, member.id);
                else await projectService.removeMember(projectId, member.id);
                await loadProject();
              }}
              onTransfer={async (member) => { await projectService.transferOwnership(projectId, member.id); await loadProject(); }}
              onResendInvite={async (member) => { await projectService.resendInvite(projectId, member.id); if (member.inviteExpired) await loadProject(); }}
              emailInvitations={emailInvitations}
              onResendEmailInvite={async (invitation) => { await projectService.resendEmailInvite(projectId, invitation); await loadEmailInvitations(); }}
              autoAssignEnabled={projectEntitlementService.isAutomationRuleEnabled(project, '1')}
              onToggleAutoAssign={handleToggleAutoAssign}
              onLeave={() => setLeaveConfirmOpen(true)}
            />
          ) : null}
        </View>
      </ScrollView>

      {/* Project menu: status, details, optional modules, exports */}
      <ProjectActionSheet visible={moreOpen} title={project.name} subtitle={`${projectLifecycleRules.label(project.status)} · ${plural(tasks.length, 'task', 'tasks')}`} onClose={() => setMoreOpen(false)}>
        {canManageSettings ? <ProjectSheetRow label="Project status…" detail="Pause, complete, archive or restore" icon={<Archive size={18} color={colors.icon} />} onPress={closeMoreThen(() => setLifecycleSheet({ initialTarget: null }))} /> : null}
        <ProjectSheetRow label={canManageSettings ? 'Edit details' : 'Project details'} detail="Name, purpose, colour, target date and tags" icon={<Pencil size={18} color={colors.icon} />} onPress={closeMoreThen(() => setSettingsOpen(true))} />
        <ProjectSheetRow label="Files" detail={fileCount > 0 ? `${plural(fileCount, 'file', 'files')} attached to tasks` : 'Files attached to tasks'} icon={<FileText size={18} color={colors.icon} />} onPress={closeMoreThen(() => setModuleView('files'))} />
        <ProjectSheetRow label="Timeline" detail="Tasks and milestones across four weeks" icon={<Layers size={18} color={colors.icon} />} onPress={closeMoreThen(() => setModuleView('timeline'))} />
        <ProjectSheetRow label="Workload" detail="How much open work each person has" icon={<Users size={18} color={colors.icon} />} onPress={closeMoreThen(() => setModuleView('workload'))} />
        <ProjectSheetRow label="Timesheets" detail={isPremium ? 'Time logged on tasks, with CSV export' : 'Time logged on tasks'} icon={<Clock size={18} color={colors.icon} />} onPress={closeMoreThen(() => setModuleView('timesheets'))} />
        <ProjectSheetRow label="Export tasks (CSV)" detail="A spreadsheet of every task" icon={exporting === 'csv' ? <ActivityIndicator size="small" color={colors.accent} /> : <Download size={18} color={colors.icon} />} onPress={closeMoreThen(() => void handleExport('csv'))} />
        <ProjectSheetRow label="Export summary" detail="A readable report of the project" icon={exporting === 'summary' ? <ActivityIndicator size="small" color={colors.accent} /> : <FileText size={18} color={colors.icon} />} onPress={closeMoreThen(() => void handleExport('summary'))} />
        {canManageSettings && !isPremium ? <ProjectSheetRow label="Premium plan" detail="Adds timesheet export" icon={<Sparkles size={18} color={colors.icon} />} onPress={closeMoreThen(() => setUpgradeOpen(true))} /> : null}
        {!project.isOwner ? <ProjectSheetRow label="Leave project" tone="danger" icon={<LogOut size={18} color={colors.destructive} />} onPress={closeMoreThen(() => setLeaveConfirmOpen(true))} /> : null}
      </ProjectActionSheet>

      <ProjectModuleSheet visible={moduleView !== null} title={moduleView ? MODULE_TITLES[moduleView] : ''} subtitle={project.name} onClose={() => setModuleView(null)}>
        {moduleView === 'files' ? <ProjectFilesPanel project={project} tasks={tasks} teamMembers={teamMembers} onOpenUpgrade={() => setUpgradeOpen(true)} onSelectTask={handleOpenTask} /> : null}
        {moduleView === 'timeline' ? <ProjectTimelinePanel tasks={tasks} milestones={milestones} onSelectTask={handleOpenTask} /> : null}
        {moduleView === 'workload' ? <ProjectWorkloadPanel tasks={tasks} teamMembers={acceptedMembers} onSelectTask={handleOpenTask} /> : null}
        {moduleView === 'timesheets' ? <ProjectTimesheetsPanel project={project} tasks={tasks} teamMembers={teamMembers} onOpenUpgrade={() => { setModuleView(null); setUpgradeOpen(true); }} /> : null}
      </ProjectModuleSheet>

      {currentUserId ? (
        <CreateTaskSheet
          visible={createTaskTarget !== null}
          project={project}
          currentUserId={currentUserId}
          teamMembers={teamMembers}
          tasks={tasks}
          milestones={milestones}
          taskTemplates={taskTemplates}
          initialStatus={createTaskTarget?.status}
          initialMilestoneId={createTaskTarget?.milestoneId}
          onClose={() => setCreateTaskTarget(null)}
          onCreated={() => void loadProject()}
        />
      ) : null}

      <TaskDetailSheet
        task={activeTask}
        project={project}
        teamMembers={teamMembers}
        milestones={milestones}
        tasks={tasks}
        currentUserId={currentUserId}
        canWrite={canWrite}
        writeBlockedReason={writeCapability.allowed ? '' : writeCapability.reason}
        activeTimer={activeTimer}
        onClose={() => setActiveTaskId(null)}
        onOpenTask={(task) => setActiveTaskId(task.id)}
      />

      {/* Invite (website InviteUserModal) */}
      <Modal visible={inviteOpen} transparent animationType="none" onRequestClose={inviteSwipeDismiss.dismissWithAnimation}>
        <KeyboardSafeView style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalSheet, inviteSwipeDismiss.animatedStyle]}>
            <SwipeDismissHandle gesture={inviteSwipeDismiss.gesture} color={colors.border} animatedStyle={inviteSwipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close" />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
              <Text accessibilityRole="header" style={styles.modalHeading}>Invite people</Text>
              <Text style={styles.muted}>They will see the project once they accept.</Text>
              <ProjectButton label="Choose from your friends" variant="secondary" icon={<Users size={18} color={colors.text} />} onPress={() => { setInviteOpen(false); setFriendPickerOpen(true); }} />
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or by email or username</Text>
                <View style={styles.dividerLine} />
              </View>
              <TextInput value={inviteRecipient} onChangeText={setInviteRecipient} placeholder="name@example.com or username" autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.mutedText} accessibilityLabel="Email or username" style={styles.modalInput} />
              <Text style={styles.label}>Their role</Text>
              <ProjectSegmented
                accessibilityLabel="Role"
                value={inviteRole}
                onChange={setInviteRole}
                options={(project.isOwner ? (['member', 'admin', 'viewer'] as const) : (['member', 'viewer'] as const)).map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
              />
              <View style={styles.modalActions}>
                <ProjectButton label="Cancel" variant="secondary" onPress={() => setInviteOpen(false)} isDisabled={inviting} style={{ flex: 1 }} />
                <ProjectButton label="Send invite" busyLabel="Sending…" isBusy={inviting} isDisabled={!inviteRecipient.trim()} onPress={() => void handleSendInvite()} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardSafeView>
      </Modal>

      {/* Project details (website ProjectSettingsModal) */}
      <ProjectFormSheet
        visible={settingsOpen}
        project={project}
        title={canManageSettings ? 'Edit details' : 'Project details'}
        readOnly={!canManageSettings}
        onClose={() => setSettingsOpen(false)}
        onSubmit={handleSaveSettings}
        footer={(
          <ProjectSettingsExtras project={project} onDelete={handleDeleteProject} />
        )}
      />

      <ProjectLifecycleSheet
        visible={lifecycleSheet !== null}
        projectName={project.name}
        status={project.status}
        initialTarget={lifecycleSheet?.initialTarget ?? null}
        onClose={() => setLifecycleSheet(null)}
        onConfirm={handleTransition}
        onStale={() => void loadProject()}
      />

      <ProjectUpgradeSheet
        visible={upgradeOpen}
        projectName={project.name}
        currentTier={project.planTier}
        onClose={() => setUpgradeOpen(false)}
        onUpgrade={() => projectService.updateProjectPlan(projectId, { planTier: 'premium' })}
      />

      <ProjectFriendPickerModal
        visible={friendPickerOpen}
        onClose={() => setFriendPickerOpen(false)}
        projectId={projectId}
        projectName={project.name}
        existingMembers={existingMembersRecord}
        onMemberInvited={() => { void loadProject(); toast.success('Invitation sent'); }}
      />

      <CustomModal
        visible={leaveConfirmOpen}
        type="danger"
        title="Leave project?"
        message={`You will lose access to ${project.name}. Someone on the project can invite you back.`}
        confirmText={leaving ? 'Leaving…' : 'Leave project'}
        cancelText="Stay"
        isLoading={leaving}
        onConfirm={() => void handleLeaveProject()}
        onCancel={() => setLeaveConfirmOpen(false)}
        onClose={() => setLeaveConfirmOpen(false)}
      />

      <CustomModal visible={feedback !== null} type={feedback?.type ?? 'info'} title={feedback?.title ?? ''} message={feedback?.message ?? ''} onClose={() => setFeedback(null)} />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    errorContainer: { flex: 1, justifyContent: 'center', padding: PROJECT_GUTTER },
    top: { paddingHorizontal: PROJECT_GUTTER, paddingTop: PROJECT_GUTTER, gap: 12 },
    identity: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 14 },
    identityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    tile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    name: { color: colors.text, fontSize: 20, fontWeight: '800', lineHeight: 26 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    percent: { color: colors.text, fontSize: 14, fontWeight: '800' },
    muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
    teamRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderRadius: 12, overflow: 'hidden' },
    timerBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.successSurface, borderWidth: 1, borderColor: isDark ? '#065f46' : '#a7f3d0', overflow: 'hidden' },
    timerText: { flex: 1, color: colors.successText, fontSize: 14, fontWeight: '700' },
    tabs: { paddingHorizontal: PROJECT_GUTTER, paddingVertical: 10, backgroundColor: colors.canvas },
    sectionBody: { paddingHorizontal: PROJECT_GUTTER, paddingTop: 4 },
    modalBackdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '88%' },
    modalHeading: { fontSize: 18, fontWeight: '800', color: colors.text },
    label: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    dividerText: { fontSize: 12, color: colors.mutedText, fontWeight: '600' },
    modalInput: { minHeight: 48, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: colors.text },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  });

function projectMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('permission-denied')) return 'You no longer have access to this project.';
  if (message.includes('auth/') || message.includes('signed in') || message.includes('account changed')) return 'Your secure session changed. Please retry.';
  if (message.includes('network') || message.includes('unavailable')) return 'The project could not connect. Check your connection and retry.';
  return 'The project could not be loaded. Please retry.';
}
