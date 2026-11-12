import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import { Clock, Download, FileText, Flag, FolderOpen, LayoutGrid, Layers, LogOut, Paperclip, Repeat, Link2, Sparkles, Users } from 'lucide-react-native';
import { toast } from 'sonner-native';
import PageHeader from '@/components/ui/PageHeader';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import CustomModal from '@/components/ui/CustomModal';
import UserAvatar from '@/components/ui/UserAvatar';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { ProjectBoardSkeleton } from '@/components/projectManagement/ProjectSkeletons';
import ProjectBoardSidebar from '@/components/projectManagement/ProjectBoardSidebar';
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
import { projectColorHex } from '@/components/projectManagement/projectColors';
import { formatCalendarDate, formatDuration, priorityColor, taskMinutes } from '@/components/projectManagement/projectFormat';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { projectService } from '@/lib/services/ProjectService';
import { projectEntitlementService } from '@/lib/services/ProjectEntitlementService';
import { projectExportService } from '@/lib/services/ProjectExportService';
import type {
  ActiveTaskTimer,
  Milestone,
  Priority,
  ProjectLoadError,
  ProjectRecord,
  ProjectRole,
  ProjectTeamMember,
  Status,
  Task,
  TaskTemplate,
  TeamMember,
} from '@/lib/types/project';

type MainTab = 'board' | 'timeline' | 'workload' | 'files' | 'milestones' | 'timesheets';
const MAIN_TABS: { id: MainTab; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'board', label: 'Tasks & Board', Icon: LayoutGrid }, { id: 'timeline', label: 'Gantt Timeline', Icon: Layers },
  { id: 'workload', label: 'Workload', Icon: Users }, { id: 'files', label: 'Files', Icon: FileText },
  { id: 'milestones', label: 'Milestones', Icon: Flag }, { id: 'timesheets', label: 'Timesheets', Icon: Clock },
];

// Same messages as the website's project page error states.
const LOAD_ERRORS: { [error in ProjectLoadError]: { title: string; message: string; retry: boolean } } = {
  'not-found': { title: 'Project Not Found', message: 'The project you are looking for does not exist or may have been deleted.', retry: false },
  'permission-denied': { title: 'Access Denied', message: 'You do not have permission to view this project. It may be private, or you may have been removed from it.', retry: false },
  'network-error': { title: 'Network Error', message: 'We could not reach the server. Check your connection and try again.', retry: true },
  unknown: { title: 'Something Went Wrong', message: 'An unexpected error occurred while loading this project.', retry: true },
};

const formatProjectStatus = (status: string): string => status === 'on-hold' ? 'On hold' : status;

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
  const canManage = inviteCapability.allowed;
  const canManageSettings = project?.role === 'owner' || project?.role === 'admin';

  // Filters & views
  const [mainTab, setMainTab] = useState<MainTab>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [activeTabStatus, setActiveTabStatus] = useState<Status>('todo');
  // Start/Complete is locked while that task's change saves (a fast second tap used to skip a column).
  const [statusBusyTaskId, setStatusBusyTaskId] = useState<string | null>(null);
  const inviteOpenedRef = useRef(false);

  // Modals
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'summary' | null>(null);

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

  // A project created from the list arrives with ?invite=1: open the invite picker once (website "Initial Members").
  useEffect(() => {
    if (invite !== '1' || inviteOpenedRef.current || !project || !canManage) return;
    inviteOpenedRef.current = true;
    setFriendPickerOpen(true);
  }, [canManage, invite, project]);

  const handleUpdateStatus = async (task: Task, nextStatus: Status) => {
    if (!writeCapability.allowed) { setFeedback({ title: 'Task update unavailable', message: writeCapability.reason, type: 'warning' }); return; }
    if (statusBusyTaskId) return;
    setStatusBusyTaskId(task.id);
    try {
      await projectService.updateTaskStatus(projectId, task.id, nextStatus);
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not update status', type: 'danger' });
    } finally {
      setStatusBusyTaskId(null);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteCapability.allowed) { setFeedback({ title: 'Invitations unavailable', message: inviteCapability.reason, type: 'warning' }); return; }
    if (!inviteRecipient.trim()) { setFeedback({ title: 'Recipient required', message: 'Choose a friend or enter an email or username.', type: 'warning' }); return; }
    setInviting(true);
    try {
      await projectService.inviteMember(projectId, inviteRecipient.trim(), inviteRole);
      setInviteRecipient('');
      setInviteOpen(false);
      setFeedback({ title: 'Invitation Sent', message: 'The team member has been invited.', type: 'success' });
      void loadProject();
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not send invitation', type: 'danger' });
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (targetUid: string) => {
    try {
      await projectService.cancelInvite(projectId, targetUid);
      void loadProject();
      setFeedback({ title: 'Invite Cancelled', message: 'The invitation has been cancelled.', type: 'info' });
    } catch {
      setFeedback({ title: 'Error', message: 'Could not cancel invitation', type: 'danger' });
    }
  };

  const handleResendInvite = async (targetUid: string) => {
    try {
      await projectService.resendInvite(projectId, targetUid);
      setFeedback({ title: 'Invite Resent', message: 'The invitation reminder has been sent.', type: 'success' });
    } catch {
      setFeedback({ title: 'Error', message: 'Could not resend invitation', type: 'danger' });
    }
  };

  const handleOpenInvite = (): void => {
    if (!inviteCapability.allowed) { setFeedback({ title: 'Invitations unavailable', message: inviteCapability.reason, type: 'warning' }); return; }
    setInviteOpen(true);
  };

  const handleSaveSettings = async (values: ProjectFormValues): Promise<void> => {
    await projectService.updateProjectSettings(projectId, values);
    toast.success('Settings updated');
    setSettingsOpen(false);
    void loadProject();
  };

  const handleArchiveToggle = async (): Promise<void> => {
    if (!project) return;
    const archiving = project.status !== 'archived';
    await projectService.updateProjectSettings(projectId, { status: archiving ? 'archived' : 'active' });
    setSettingsOpen(false);
    // Website archiveProject returns to the project list; unarchiving stays on the board.
    if (archiving) router.replace('/projectManagement');
    else void loadProject();
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

  // Website handleToggleAutomationRule: Premium rules open the upgrade sheet on Free projects.
  const handleToggleAutomationRule = async (ruleId: string): Promise<void> => {
    if (!project) return;
    const rule = projectEntitlementService.automationRules(project).find((entry) => entry.id === ruleId);
    if (!rule) return;
    if (rule.isPremium && !projectEntitlementService.isPremium(project)) { setUpgradeOpen(true); return; }
    if (!canManageSettings) { toast.error('Only the project owner or an admin can change automation settings.'); return; }
    const nextEnabled = !projectEntitlementService.isAutomationRuleEnabled(project, ruleId);
    try {
      await projectService.updateProjectPlan(projectId, { automationRules: { ...project.automationRules, [ruleId]: nextEnabled } });
      toast.success(nextEnabled ? `${rule.name} enabled.` : `${rule.name} disabled.`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not save the automation setting.');
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

  const pendingInvites = useMemo(() => teamMembers.filter((member) => member.membershipStatus === 'pending'), [teamMembers]);
  const existingMembersRecord = useMemo<Record<string, ProjectTeamMember>>(() => {
    const map: Record<string, ProjectTeamMember> = {};
    for (const member of teamMembers) map[member.id] = { role: member.role, membershipStatus: member.membershipStatus };
    return map;
  }, [teamMembers]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = !term || task.title.toLowerCase().includes(term) || task.description.toLowerCase().includes(term);
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    const matchesAssignee = filterAssignee === 'all' || task.assignee === filterAssignee || (task.assignees ?? []).includes(filterAssignee) || task.assignedToAll === true;
    return matchesSearch && matchesPriority && matchesAssignee;
  }), [tasks, searchQuery, filterPriority, filterAssignee]);

  const tasksByStatus = useMemo(() => ({
    todo: filteredTasks.filter((task) => task.status === 'todo'),
    'in-progress': filteredTasks.filter((task) => task.status === 'in-progress'),
    done: filteredTasks.filter((task) => task.status === 'done'),
  }), [filteredTasks]);

  const totalMinutes = useMemo(() => tasks.reduce((sum, task) => sum + taskMinutes(task), 0), [tasks]);
  // Website "Due date reminders": open tasks due within 24 hours.
  const dueSoonCount = useMemo(() => {
    const now = Date.now();
    return tasks.filter((task) => {
      if (task.status === 'done' || !task.dueDate) return false;
      const due = new Date(`${task.dueDate.slice(0, 10)}T23:59:59`).getTime();
      return Number.isFinite(due) && due >= now && due - now <= 24 * 60 * 60 * 1000;
    }).length;
  }, [tasks]);

  const handleSelectTask = (task: Task): void => setActiveTaskId(task.id);

  if (!activeUserId) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <PageHeader title="E-Projects" onBackPress={() => router.back()} />
        <View style={styles.loadingContainer}><Text style={styles.loadingText}>Sign in to view this project.</Text></View>
      </SafeAreaView>
    );
  }

  if (loading || !sessionReady) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <PageHeader title="Project Details" onBackPress={() => router.back()} />
        <ScrollView showsVerticalScrollIndicator={false}><ProjectBoardSkeleton /></ScrollView>
      </SafeAreaView>
    );
  }

  if (!project) {
    const config = LOAD_ERRORS[loadError ?? 'not-found'];
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <PageHeader title="Project Details" onBackPress={() => router.back()} />
        <View style={styles.emptyContainer}>
          <FolderOpen size={48} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>{config.title}</Text>
          <Text style={[styles.loadingText, { textAlign: 'center' }]}>{config.message}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {config.retry ? (
              <TouchableOpacity onPress={() => { setLoading(true); setLoadError(null); void loadProject(); }} style={[styles.primaryButton, { paddingHorizontal: 20 }]}>
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => router.replace('/projectManagement')} style={[styles.cancelButton, { paddingHorizontal: 20 }]}>
              <Text style={styles.cancelButtonText}>Back to Projects</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isPremium = projectEntitlementService.isPremium(project);
  const acceptedMemberCount = teamMembers.filter((member) => member.isOwner || member.membershipStatus !== 'pending').length;
  const activeTimerTask = activeTimer ? tasks.find((task) => task.id === activeTimer.taskId) ?? null : null;
  const openUpgrade = (): void => setUpgradeOpen(true);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title={project.name} onBackPress={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProject(); }} tintColor="#10b981" />}
      >
        {/* Project header (website ProjectHeader) */}
        <View style={styles.projectHero}>
          <View style={styles.heroTop}>
            <View style={[styles.colorTile, { backgroundColor: projectColorHex(project.color) }]}><FolderOpen size={18} color="#ffffff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.projectName}>{project.name}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                <Text style={[styles.planBadge, isPremium ? styles.planBadgePremium : null]}>{isPremium ? '★ Premium' : 'Free Plan'}</Text>
                <Text style={styles.statusBadge}>{formatProjectStatus(project.status)}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.projectDesc}>{project.description || 'No description provided.'}</Text>
          {project.dueDate ? <Text style={styles.metaSmallText}>Due {formatCalendarDate(project.dueDate)}</Text> : null}

          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}><Text style={styles.progressLabel}>Overall Progress</Text><Text style={styles.progressValue}>{project.progress}%</Text></View>
            <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${project.progress}%` }]} /></View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}><Text style={styles.metricNumber}>{tasks.length}</Text><Text style={styles.metricLabel}>{tasks.length === 1 ? 'Total Task' : 'Total Tasks'}</Text></View>
            <View style={styles.metricItem}><Text style={styles.metricNumber}>{formatDuration(totalMinutes)}</Text><Text style={styles.metricLabel}>Time Tracked</Text></View>
          </View>
          {project.role !== 'owner' ? (
            <TouchableOpacity onPress={() => setLeaveConfirmOpen(true)} style={styles.leaveButton}>
              <LogOut size={15} color="#ffffff" /><Text style={styles.leaveButtonText}>Leave Project</Text>
            </TouchableOpacity>
          ) : null}
          <SessionRetryBanner />
        </View>

        {/* Stats overview (website ProjectStatsOverview) */}
        <View style={styles.statsGrid}>
          {[
            { label: 'To Do', value: tasks.filter((task) => task.status === 'todo').length, color: '#64748b' },
            { label: 'In Progress', value: tasks.filter((task) => task.status === 'in-progress').length, color: '#3b82f6' },
            { label: 'Completed', value: tasks.filter((task) => task.status === 'done').length, color: '#10b981' },
            { label: 'Team Members', value: acceptedMemberCount, color: '#8b5cf6' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Sub-navigation tabs, export and upgrade */}
        <View style={styles.tabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {MAIN_TABS.map(({ id: tabId, label, Icon: TabIcon }) => {
              const selected = mainTab === tabId;
              return (
                <TouchableOpacity key={tabId} onPress={() => setMainTab(tabId)} style={[styles.mainTab, selected && styles.mainTabActive]}>
                  <TabIcon size={15} color={selected ? colors.accent : colors.mutedText} />
                  <Text style={[styles.mainTabText, selected && styles.mainTabTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.tabActions}>
            <TouchableOpacity disabled={exporting !== null} onPress={() => void handleExport('csv')} style={styles.exportButton}>
              {exporting === 'csv' ? <ActivityIndicator size="small" color={colors.accent} /> : <Download size={14} color={colors.mutedText} />}<Text style={styles.exportText}>CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={exporting !== null} onPress={() => void handleExport('summary')} style={styles.exportButton}>
              {exporting === 'summary' ? <ActivityIndicator size="small" color={colors.accent} /> : <FileText size={14} color={colors.mutedText} />}<Text style={styles.exportText}>Summary</Text>
            </TouchableOpacity>
            {isPremium ? (
              <View style={styles.premiumPill}><Sparkles size={12} color={colors.successText} /><Text style={styles.premiumPillText}>Premium</Text></View>
            ) : (
              <TouchableOpacity onPress={openUpgrade} style={styles.upgradeButton}><Sparkles size={14} color="#ffffff" /><Text style={styles.upgradeText}>Upgrade</Text></TouchableOpacity>
            )}
          </View>
        </View>

        {mainTab === 'board' ? (
          <>
            <View style={styles.toolbarCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={[styles.sectionTitle, { flex: 1 }]}>Task Management</Text>
                {project.role !== 'viewer' ? (
                  <TouchableOpacity onPress={() => { if (!writeCapability.allowed) { setFeedback({ title: 'New task unavailable', message: writeCapability.reason, type: 'warning' }); return; } setCreateTaskOpen(true); }} style={[styles.actionBtn, !canWrite && { opacity: 0.58 }]}>
                    <Icon name="plus" size={16} color="#ffffff" /><Text style={styles.actionBtnText}>New Task</Text>
                  </TouchableOpacity>
                ) : null}
                {canManageSettings ? (
                  <TouchableOpacity onPress={() => setSettingsOpen(true)} style={styles.actionBtnSecondary}>
                    <Icon name="settings" size={16} color={colors.text} /><Text style={styles.actionBtnTextSecondary}>Settings</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.searchBar}>
                <Icon name="search" size={16} color={colors.mutedText} style={{ marginRight: 8 }} />
                <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search tasks..." placeholderTextColor={colors.mutedText} style={styles.searchInput} />
                {searchQuery ? <TouchableOpacity onPress={() => setSearchQuery('')}><Icon name="x" size={16} color={colors.mutedText} /></TouchableOpacity> : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.priorityFilterRow}>
                {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((priority) => (
                  <TouchableOpacity key={priority} onPress={() => setFilterPriority(priority)} style={[styles.filterPill, filterPriority === priority && styles.filterPillActive]}>
                    <Text style={[styles.filterPillText, filterPriority === priority && styles.filterPillTextActive]}>{priority === 'all' ? 'ALL PRIORITIES' : priority.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {teamMembers.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.priorityFilterRow}>
                  {[{ id: 'all', name: 'All members' }, ...teamMembers.filter((member) => member.isOwner || member.membershipStatus !== 'pending').map((member) => ({ id: member.id, name: member.id === currentUserId ? 'Me' : member.name }))].map((option) => (
                    <TouchableOpacity key={option.id} onPress={() => setFilterAssignee(option.id)} style={[styles.filterPill, filterAssignee === option.id && styles.filterPillActive]}>
                      <Text numberOfLines={1} style={[styles.filterPillText, filterAssignee === option.id && styles.filterPillTextActive]}>{option.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}
            </View>

            {/* Kanban columns as status tabs */}
            <View style={styles.kanbanTabs}>
              {(['todo', 'in-progress', 'done'] as const).map((status) => {
                const active = activeTabStatus === status;
                const label = status === 'todo' ? 'To Do' : status === 'in-progress' ? 'In Progress' : 'Done';
                return (
                  <TouchableOpacity key={status} onPress={() => setActiveTabStatus(status)} style={[styles.kanbanTab, active && styles.kanbanTabActive]}>
                    <Text style={[styles.kanbanTabText, active && styles.kanbanTabTextActive]}>{label} ({tasksByStatus[status].length})</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.tasksContainer}>
              {tasksByStatus[activeTabStatus].length === 0 ? (
                <View style={styles.noTasksCard}>
                  <Icon name="check-circle" size={36} color={colors.mutedText} />
                  <Text style={styles.noTasksTitle}>No tasks in this column</Text>
                  <Text style={styles.noTasksSubtitle}>{project.role !== 'viewer' ? 'Tap "New Task" above to create one.' : 'Tasks will appear here.'}</Text>
                </View>
              ) : tasksByStatus[activeTabStatus].map((task) => {
                const color = priorityColor(task.priority);
                const isDone = task.status === 'done';
                const isInProgress = task.status === 'in-progress';
                const milestone = task.milestoneId ? milestones.find((entry) => entry.id === task.milestoneId) : undefined;
                const assigneeIds = task.assignedToAll ? [] : [...new Set([task.assignee, ...(task.assignees ?? [])].filter(Boolean))];
                return (
                  <TouchableOpacity key={task.id} onPress={() => handleSelectTask(task)} activeOpacity={0.7} style={styles.taskCard}>
                    <View style={styles.taskCardHeader}>
                      <View style={[styles.priorityBadge, { backgroundColor: `${color}18`, borderColor: color }]}><Text style={[styles.priorityText, { color }]}>{task.priority.toUpperCase()}</Text></View>
                      {canWrite ? (
                        <TouchableOpacity onPress={() => void handleUpdateStatus(task, isDone ? 'todo' : isInProgress ? 'done' : 'in-progress')} disabled={statusBusyTaskId !== null} style={[styles.quickStatusBtn, isDone && { backgroundColor: '#10b981' }, statusBusyTaskId === task.id && { opacity: 0.5 }]}>
                          <Icon name={isDone ? 'check' : 'arrow-right'} size={14} color={isDone ? '#ffffff' : colors.text} />
                          <Text style={[styles.quickStatusText, isDone && { color: '#ffffff' }]}>{isDone ? 'Done' : isInProgress ? 'Complete' : 'Start'}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {task.description ? <Text numberOfLines={2} style={styles.taskCardDesc}>{task.description}</Text> : null}
                    {milestone || task.recurrence || (task.dependencies?.length ?? 0) > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {milestone ? <View style={styles.tinyBadge}><Flag size={11} color="#9333ea" /><Text numberOfLines={1} style={[styles.tinyBadgeText, { color: '#9333ea', maxWidth: 140 }]}>{milestone.name}</Text></View> : null}
                        {task.recurrence ? <View style={styles.tinyBadge}><Repeat size={11} color="#2563eb" /><Text style={[styles.tinyBadgeText, { color: '#2563eb' }]}>Repeats</Text></View> : null}
                        {(task.dependencies?.length ?? 0) > 0 ? <View style={styles.tinyBadge}><Link2 size={11} color="#d97706" /><Text style={[styles.tinyBadgeText, { color: '#d97706' }]}>{task.dependencies?.length}</Text></View> : null}
                      </View>
                    ) : null}
                    {task.subTasks.length > 0 ? (
                      <View style={styles.subtaskCountRow}>
                        <Icon name="check-square" size={13} color={colors.mutedText} />
                        <Text style={styles.subtaskCountText}>{task.subTasks.filter((subTask) => subTask.completed).length} / {task.subTasks.length} subtasks</Text>
                      </View>
                    ) : null}
                    <View style={styles.taskCardFooter}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, flexWrap: 'wrap' }}>
                        {task.assignedToAll ? <Text style={styles.metaSmallText}>All team</Text> : (
                          <View style={{ flexDirection: 'row' }}>
                            {assigneeIds.slice(0, 3).map((memberId, index) => {
                              const member = teamMembers.find((entry) => entry.id === memberId);
                              return <View key={memberId} style={{ marginLeft: index === 0 ? 0 : -6 }}><UserAvatar profileImage={member?.avatar} firstName={member?.name} size={22} /></View>;
                            })}
                          </View>
                        )}
                        {task.comments.length > 0 ? <View style={styles.metaInline}><Icon name="message-circle" size={13} color={colors.mutedText} /><Text style={styles.metaSmallText}>{task.comments.length}</Text></View> : null}
                        {task.attachments.length > 0 ? <View style={styles.metaInline}><Paperclip size={12} color={colors.mutedText} /><Text style={styles.metaSmallText}>{task.attachments.length}</Text></View> : null}
                        {task.dueDate ? <View style={styles.metaInline}><Icon name="calendar" size={13} color={colors.mutedText} /><Text style={styles.metaSmallText}>{formatCalendarDate(task.dueDate)}</Text></View> : null}
                        {activeTimer?.taskId === task.id ? <View style={styles.metaInline}><Clock size={12} color={colors.accent} /><Text style={[styles.metaSmallText, { color: colors.accent, fontWeight: '800' }]}>Timer</Text></View> : null}
                      </View>
                      <Icon name="chevron-right" size={16} color={colors.mutedText} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        {mainTab === 'timeline' ? <ProjectTimelinePanel project={project} tasks={filteredTasks} milestones={milestones} onOpenUpgrade={openUpgrade} onSelectTask={handleSelectTask} /> : null}
        {mainTab === 'workload' ? <ProjectWorkloadPanel project={project} tasks={tasks} teamMembers={teamMembers} onOpenUpgrade={openUpgrade} onSelectTask={handleSelectTask} /> : null}
        {mainTab === 'files' ? <ProjectFilesPanel project={project} tasks={tasks} teamMembers={teamMembers} onOpenUpgrade={openUpgrade} onSelectTask={handleSelectTask} /> : null}
        {mainTab === 'milestones' ? <ProjectMilestonesPanel project={project} milestones={milestones} tasks={tasks} canEdit={project.role !== 'viewer' && canWrite} onOpenUpgrade={openUpgrade} /> : null}
        {mainTab === 'timesheets' ? <ProjectTimesheetsPanel project={project} tasks={tasks} teamMembers={teamMembers} onOpenUpgrade={openUpgrade} /> : null}

        {/* Website right sidebar: time tracking, team, automation, recent activity */}
        <ProjectBoardSidebar
          tasks={tasks}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          isOwner={project.isOwner === true}
          onChangeRole={async (member, role) => { await projectService.changeMemberRole(projectId, member.id, role); await loadProject(); setFeedback({ title: 'Role updated', message: `${member.name} is now ${role === 'admin' ? 'an' : 'a'} ${role}.`, type: 'success' }); }}
          onRemove={async (member) => { await projectService.removeMember(projectId, member.id); await loadProject(); setFeedback({ title: member.membershipStatus === 'pending' ? 'Invitation cancelled' : 'Member removed', message: `${member.name} was removed from the project.`, type: 'info' }); }}
          onTransfer={async (member) => { await projectService.transferOwnership(projectId, member.id); await loadProject(); setFeedback({ title: 'Ownership transferred', message: `${member.name} is now the project owner.`, type: 'success' }); }}
          totalMinutes={totalMinutes}
          activeTimerTaskTitle={activeTimerTask ? activeTimerTask.title : null}
          canInvite={canManage}
          onInvite={handleOpenInvite}
          automationRules={projectEntitlementService.automationRules(project)}
          isPremiumPlan={isPremium}
          canManageAutomation={canManageSettings}
          dueSoonCount={dueSoonCount}
          onToggleAutomationRule={(ruleId) => void handleToggleAutomationRule(ruleId)}
        />
      </ScrollView>

      {currentUserId ? (
        <CreateTaskSheet
          visible={createTaskOpen}
          project={project}
          currentUserId={currentUserId}
          teamMembers={teamMembers}
          tasks={tasks}
          milestones={milestones}
          taskTemplates={taskTemplates}
          onClose={() => setCreateTaskOpen(false)}
          onCreated={() => void loadProject()}
        />
      ) : null}

      <TaskDetailSheet
        task={activeTask}
        project={project}
        teamMembers={teamMembers}
        milestones={milestones}
        currentUserId={currentUserId}
        canWrite={canWrite}
        writeBlockedReason={writeCapability.allowed ? '' : writeCapability.reason}
        activeTimer={activeTimer}
        onClose={() => setActiveTaskId(null)}
        onOpenUpgrade={openUpgrade}
      />

      {/* Invite team member (website InviteUserModal) */}
      <Modal visible={inviteOpen} transparent animationType="none" onRequestClose={inviteSwipeDismiss.dismissWithAnimation}>
        <KeyboardSafeView style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalSheet, inviteSwipeDismiss.animatedStyle]}>
            <SwipeDismissHandle gesture={inviteSwipeDismiss.gesture} color={colors.border} animatedStyle={inviteSwipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close invite modal" />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalHeading}>Invite Team Member</Text>
              <TouchableOpacity onPress={() => { setInviteOpen(false); setFriendPickerOpen(true); }} style={styles.friendPickerButton}>
                <Icon name="users" size={18} color="#10b981" /><Text style={styles.friendPickerText}>Choose from Friends List</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ marginHorizontal: 10, fontSize: 12, color: colors.mutedText, fontWeight: '600' }}>OR INVITE BY EMAIL</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>
              <Text style={styles.inputLabel}>Email Address or Username</Text>
              <TextInput value={inviteRecipient} onChangeText={setInviteRecipient} placeholder="user@example.com" autoCapitalize="none" placeholderTextColor={colors.mutedText} style={styles.modalInput} />
              <Text style={styles.inputLabel}>Role</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(project.isOwner ? (['member', 'admin', 'viewer'] as const) : (['member', 'viewer'] as const)).map((role) => (
                  <TouchableOpacity key={role} onPress={() => setInviteRole(role)} style={[styles.pillSelect, inviteRole === role && styles.pillSelectActive]}>
                    <Text style={[styles.pillSelectText, inviteRole === role && styles.pillSelectTextActive]}>{role.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setInviteOpen(false)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => void handleSendInvite()} disabled={inviting || !inviteRecipient.trim()} style={styles.primaryButton}>
                  {inviting ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.primaryButtonText}>Send Invite</Text>}
                </TouchableOpacity>
              </View>
              {pendingInvites.length > 0 ? (
                <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                  <Text style={[styles.inputLabel, { marginBottom: 8 }]}>Pending Invitations ({pendingInvites.length})</Text>
                  {pendingInvites.map((member) => (
                    <View key={member.id} style={styles.pendingRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>{member.email || member.name || member.id}</Text>
                        <Text style={{ fontSize: 11, color: colors.mutedText }}>Role: {member.role}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity onPress={() => void handleResendInvite(member.id)} style={[styles.smallPill, { backgroundColor: '#10b98118' }]}><Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>Resend</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => void handleCancelInvite(member.id)} style={[styles.smallPill, { backgroundColor: '#ef444418' }]}><Text style={{ fontSize: 12, fontWeight: '700', color: '#ef4444' }}>Cancel</Text></TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </Animated.View>
        </KeyboardSafeView>
      </Modal>

      {/* Project settings (website ProjectSettingsModal) */}
      <ProjectFormSheet
        visible={settingsOpen}
        project={project}
        title="Project settings"
        readOnly={!canManageSettings}
        onClose={() => setSettingsOpen(false)}
        onSubmit={handleSaveSettings}
        footer={(
          <ProjectSettingsExtras
            project={project}
            teamMembers={teamMembers}
            currentUserId={currentUserId}
            onChangeRole={async (member, role) => { await projectService.changeMemberRole(projectId, member.id, role); await loadProject(); }}
            onRemove={async (member) => { await projectService.removeMember(projectId, member.id); await loadProject(); }}
            onTransfer={async (member) => { await projectService.transferOwnership(projectId, member.id); await loadProject(); }}
            onArchiveToggle={handleArchiveToggle}
            onDelete={handleDeleteProject}
          />
        )}
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
        onMemberInvited={() => { void loadProject(); setFeedback({ type: 'success', title: 'Invitation Sent', message: 'Friend has been invited to the project.' }); }}
      />

      <CustomModal
        visible={leaveConfirmOpen}
        type="danger"
        title="Leave project?"
        message={`Leave ${project.name}? You will lose access to this project.`}
        confirmText={leaving ? 'Leaving…' : 'Leave project'}
        cancelText="Cancel"
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
    scrollContent: { padding: 16, paddingBottom: 48, gap: 16 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 4, fontSize: 14, color: colors.mutedText },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    projectHero: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    colorTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    projectName: { fontSize: 20, fontWeight: '900', color: colors.text },
    projectDesc: { fontSize: 13, color: colors.mutedText, lineHeight: 18 },
    planBadge: { fontSize: 11, fontWeight: '800', color: colors.secondaryText, backgroundColor: colors.control, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
    planBadgePremium: { color: '#78350f', backgroundColor: '#fde68a' },
    statusBadge: { fontSize: 11, fontWeight: '800', color: '#047857', backgroundColor: '#d1fae5', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', textTransform: 'capitalize' },
    progressContainer: { gap: 6 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontSize: 12, fontWeight: '700', color: colors.mutedText },
    progressValue: { fontSize: 12, fontWeight: '800', color: '#10b981' },
    progressBarBg: { height: 7, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 999, backgroundColor: '#10b981' },
    metricsRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderRadius: 14, padding: 12 },
    metricItem: { alignItems: 'center' },
    metricNumber: { fontSize: 18, fontWeight: '900', color: colors.text },
    metricLabel: { fontSize: 11, color: colors.mutedText, marginTop: 2 },
    leaveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 12, backgroundColor: '#ef4444' },
    leaveButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: { flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 4 },
    statLabel: { fontSize: 12, color: colors.mutedText, fontWeight: '700' },
    statValue: { fontSize: 22, fontWeight: '900' },
    tabBar: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 8, gap: 8 },
    mainTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    mainTabActive: { backgroundColor: isDark ? '#053b31' : '#ecfdf5' },
    mainTabText: { fontSize: 13, fontWeight: '700', color: colors.mutedText },
    mainTabTextActive: { color: colors.accent, fontWeight: '900' },
    tabActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
    exportButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    exportText: { fontSize: 12, fontWeight: '700', color: colors.secondaryText },
    upgradeButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#d97706' },
    upgradeText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },
    premiumPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.successSurface },
    premiumPillText: { fontSize: 12, fontWeight: '800', color: colors.successText },
    toolbarCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
    sectionTitle: { fontSize: 17, fontWeight: '900', color: colors.text },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#10b981' },
    actionBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
    actionBtnSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    actionBtnTextSecondary: { color: colors.text, fontWeight: '700', fontSize: 13 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.control, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 42 },
    searchInput: { flex: 1, color: colors.text, fontSize: 14 },
    priorityFilterRow: { flexDirection: 'row', gap: 8 },
    filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    filterPillActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    filterPillText: { fontSize: 11, fontWeight: '700', color: colors.mutedText },
    filterPillTextActive: { color: '#ffffff' },
    kanbanTabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 4 },
    kanbanTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
    kanbanTabActive: { backgroundColor: isDark ? '#1e293b' : '#ecfdf5' },
    kanbanTabText: { fontSize: 12, fontWeight: '700', color: colors.mutedText },
    kanbanTabTextActive: { color: '#047857', fontWeight: '800' },
    tasksContainer: { gap: 12 },
    noTasksCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 32, alignItems: 'center', gap: 8 },
    noTasksTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    noTasksSubtitle: { fontSize: 12, color: colors.mutedText },
    taskCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
    taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    priorityText: { fontSize: 10, fontWeight: '800' },
    quickStatusBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.control },
    quickStatusText: { fontSize: 11, fontWeight: '700', color: colors.text },
    taskTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    taskCardDesc: { fontSize: 13, color: colors.mutedText, lineHeight: 18 },
    tinyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.control },
    tinyBadgeText: { fontSize: 10, fontWeight: '800' },
    subtaskCountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    subtaskCountText: { fontSize: 12, color: colors.mutedText, fontWeight: '600' },
    taskCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
    metaInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaSmallText: { fontSize: 12, color: colors.mutedText },
    modalBackdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '88%', gap: 12 },
    modalHeading: { fontSize: 18, fontWeight: '900', color: colors.text },
    friendPickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: isDark ? '#1e293b' : '#ecfdf5', borderWidth: 1, borderColor: '#10b981', marginVertical: 12 },
    friendPickerText: { fontSize: 14, fontWeight: '700', color: '#10b981' },
    inputLabel: { fontSize: 12, fontWeight: '700', color: colors.mutedText, marginTop: 4, marginBottom: 6 },
    modalInput: { backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text, marginBottom: 8 },
    pillSelect: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
    pillSelectActive: { backgroundColor: '#d1fae5', borderColor: '#10b981' },
    pillSelectText: { fontSize: 11, fontWeight: '700', color: colors.mutedText },
    pillSelectTextActive: { color: '#047857', fontWeight: '800' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    cancelButton: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    cancelButtonText: { color: colors.text, fontWeight: '700' },
    primaryButton: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
    primaryButtonText: { color: '#ffffff', fontWeight: '800' },
    pendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    smallPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  });

function projectMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('permission-denied')) return 'You no longer have access to this project.';
  if (message.includes('auth/') || message.includes('signed in') || message.includes('account changed')) return 'Your secure session changed. Please retry.';
  if (message.includes('network') || message.includes('unavailable')) return 'The project could not connect. Check your connection and retry.';
  return 'The project could not be loaded. Please retry.';
}
