import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import PageHeader from '@/components/ui/PageHeader';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { projectService } from '@/lib/services/ProjectService';
import { AuthService } from '@/lib/services/AuthService';
import type {
  CreateTaskInput,
  Priority,
  ProjectRecord,
  ProjectRole,
  ProjectStatus,
  Status,
  Task,
  TeamMember,
} from '@/lib/types/project';

const authService = AuthService.getInstance();

export default function ProjectBoardScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as string;
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const currentUserId = authService.getCurrentUser()?.uid ?? '';

  // Data State
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; message: string; type?: 'info' | 'success' | 'warning' | 'danger' } | null>(null);

  // Filters & Views
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [activeTabStatus, setActiveTabStatus] = useState<Status>('todo');

  // Modals
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Create Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [taskStatus, setTaskStatus] = useState<Status>('todo');
  const [taskAssignee, setTaskAssignee] = useState(currentUserId);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Detail Modal Subtask / Comment State
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [timeSpentMinutes, setTimeSpentMinutes] = useState('');

  // Invite Form State
  const [inviteRecipient, setInviteRecipient] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('member');
  const [inviting, setInviting] = useState(false);

  // Settings Form State
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('active');
  const [savingSettings, setSavingSettings] = useState(false);

  const createSwipeDismiss = useSwipeDismiss({ visible: createTaskOpen, onDismiss: () => setCreateTaskOpen(false), disabled: submittingTask });
  const detailSwipeDismiss = useSwipeDismiss({ visible: activeTask !== null, onDismiss: () => setActiveTask(null) });
  const inviteSwipeDismiss = useSwipeDismiss({ visible: inviteOpen, onDismiss: () => setInviteOpen(false), disabled: inviting });
  const settingsSwipeDismiss = useSwipeDismiss({ visible: settingsOpen, onDismiss: () => setSettingsOpen(false), disabled: savingSettings });

  // Load project details & subscribe to tasks
  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await projectService.getProject(projectId);
      setProject(data.project);
      setTeamMembers(data.teamMembers);
      setEditName(data.project.name);
      setEditDesc(data.project.description);
      setEditStatus(data.project.status);
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not load project', type: 'danger' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (!projectId) return;
    const unsubscribe = projectService.subscribeToTasks(
      projectId,
      (updatedTasks) => {
        setTasks(updatedTasks);
        if (activeTask) {
          const fresh = updatedTasks.find((t) => t.id === activeTask.id);
          if (fresh) setActiveTask(fresh);
        }
      },
      (err) => console.error('[Tasks subscribe error]', err)
    );
    return () => unsubscribe();
  }, [projectId, activeTask?.id]);

  // Handlers
  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      setFeedback({ title: 'Missing Title', message: 'Please provide a task title.', type: 'warning' });
      return;
    }
    setSubmittingTask(true);
    try {
      const input: CreateTaskInput = {
        title: taskTitle,
        description: taskDesc,
        status: taskStatus,
        priority: taskPriority,
        assignee: taskAssignee || currentUserId,
        dueDate: taskDueDate || undefined,
      };
      await projectService.createTask(projectId, input);
      setTaskTitle('');
      setTaskDesc('');
      setCreateTaskOpen(false);
      setFeedback({ title: 'Task Created', message: 'Your task has been added.', type: 'success' });
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not create task', type: 'danger' });
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleUpdateStatus = async (task: Task, nextStatus: Status) => {
    try {
      await projectService.updateTaskStatus(projectId, task.id, nextStatus);
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not update status', type: 'danger' });
    }
  };

  const handleAddSubtask = async () => {
    if (!activeTask || !newSubtaskTitle.trim()) return;
    try {
      await projectService.addSubTask(projectId, activeTask.id, newSubtaskTitle.trim());
      setNewSubtaskTitle('');
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not add subtask', type: 'danger' });
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!activeTask) return;
    try {
      await projectService.toggleSubTask(projectId, activeTask.id, subtaskId);
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not toggle subtask', type: 'danger' });
    }
  };

  const handleAddComment = async () => {
    if (!activeTask || !newCommentText.trim()) return;
    try {
      await projectService.addComment(projectId, activeTask.id, newCommentText.trim());
      setNewCommentText('');
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not post comment', type: 'danger' });
    }
  };

  const handleAddTimeEntry = async () => {
    if (!activeTask || !timeSpentMinutes.trim()) return;
    const minutes = parseInt(timeSpentMinutes, 10);
    if (isNaN(minutes) || minutes <= 0) return;
    try {
      await projectService.addTimeEntry(projectId, activeTask.id, minutes);
      setTimeSpentMinutes('');
      setFeedback({ title: 'Time Logged', message: `Logged ${minutes} minutes.`, type: 'success' });
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not log time', type: 'danger' });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await projectService.deleteTask(projectId, taskId);
      setActiveTask(null);
      setFeedback({ title: 'Task Deleted', message: 'The task has been removed.', type: 'info' });
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not delete task', type: 'danger' });
    }
  };

  const handleSendInvite = async () => {
    if (!inviteRecipient.trim()) return;
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

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await projectService.updateProjectSettings(projectId, {
        name: editName,
        description: editDesc,
        status: editStatus,
      });
      setSettingsOpen(false);
      setFeedback({ title: 'Settings Saved', message: 'Project details have been updated.', type: 'success' });
      void loadProject();
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not update project', type: 'danger' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      await projectService.deleteProject(projectId);
      setSettingsOpen(false);
      router.replace('/projectManagement');
    } catch (error: unknown) {
      setFeedback({ title: 'Error', message: error instanceof Error ? error.message : 'Could not delete project', type: 'danger' });
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch = !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
      return matchesSearch && matchesPriority;
    });
  }, [tasks, searchQuery, filterPriority]);

  const tasksByStatus = useMemo(() => {
    return {
      todo: filteredTasks.filter((t) => t.status === 'todo'),
      'in-progress': filteredTasks.filter((t) => t.status === 'in-progress'),
      done: filteredTasks.filter((t) => t.status === 'done'),
    };
  }, [filteredTasks]);

  const canManage = project?.role === 'owner' || project?.role === 'admin';

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <PageHeader title="Project Details" onBackPress={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading project board…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <PageHeader title="Project Details" onBackPress={() => router.back()} />
        <View style={styles.emptyContainer}>
          <Icon name="folder" size={48} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>Project Not Found</Text>
          <TouchableOpacity onPress={() => router.replace('/projectManagement')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to Projects</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <PageHeader title={project.name} onBackPress={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProject(); }} tintColor="#10b981" />}
      >
        {/* Project Header Banner */}
        <View style={styles.projectHero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.projectName}>{project.name}</Text>
              <Text style={styles.projectDesc}>{project.description || 'No description provided.'}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{project.status}</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Overall Progress</Text>
              <Text style={styles.progressValue}>{project.progress}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${project.progress}%` }]} />
            </View>
          </View>

          {/* Quick Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricNumber}>{tasks.length}</Text>
              <Text style={styles.metricLabel}>Total Tasks</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: '#f59e0b' }]}>{tasksByStatus['in-progress'].length}</Text>
              <Text style={styles.metricLabel}>In Progress</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: '#10b981' }]}>{tasksByStatus.done.length}</Text>
              <Text style={styles.metricLabel}>Completed</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricNumber}>{teamMembers.length}</Text>
              <Text style={styles.metricLabel}>Members</Text>
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.heroActions}>
            <TouchableOpacity onPress={() => setCreateTaskOpen(true)} style={styles.actionBtn}>
              <Icon name="plus" size={16} color="#ffffff" />
              <Text style={styles.actionBtnText}>New Task</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setInviteOpen(true)} style={styles.actionBtnSecondary}>
              <Icon name="user-plus" size={16} color={colors.text} />
              <Text style={styles.actionBtnTextSecondary}>Invite</Text>
            </TouchableOpacity>
            {canManage ? (
              <TouchableOpacity onPress={() => setSettingsOpen(true)} style={styles.actionBtnSecondary}>
                <Icon name="settings" size={16} color={colors.text} />
                <Text style={styles.actionBtnTextSecondary}>Settings</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Search & Filters */}
        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Icon name="search" size={16} color={colors.mutedText} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search tasks..."
              placeholderTextColor={colors.mutedText}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="x" size={16} color={colors.mutedText} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Priority Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.priorityFilterRow}>
            {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((pri) => (
              <TouchableOpacity
                key={pri}
                onPress={() => setFilterPriority(pri)}
                style={[styles.filterPill, filterPriority === pri && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, filterPriority === pri && styles.filterPillTextActive]}>
                  {pri.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* View Mode Switcher: Kanban status tabs */}
        <View style={styles.kanbanTabs}>
          {(['todo', 'in-progress', 'done'] as const).map((st) => {
            const count = tasksByStatus[st].length;
            const active = activeTabStatus === st;
            const label = st === 'todo' ? 'To Do' : st === 'in-progress' ? 'In Progress' : 'Done';
            return (
              <TouchableOpacity
                key={st}
                onPress={() => setActiveTabStatus(st)}
                style={[styles.kanbanTab, active && styles.kanbanTabActive]}
              >
                <Text style={[styles.kanbanTabText, active && styles.kanbanTabTextActive]}>
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Task Cards List */}
        <View style={styles.tasksContainer}>
          {tasksByStatus[activeTabStatus].length === 0 ? (
            <View style={styles.noTasksCard}>
              <Icon name="check-circle" size={36} color={colors.mutedText} />
              <Text style={styles.noTasksTitle}>No tasks in this column</Text>
              <Text style={styles.noTasksSubtitle}>Tap &quot;New Task&quot; above to create one.</Text>
            </View>
          ) : (
            tasksByStatus[activeTabStatus].map((task) => {
              const priorityColor = task.priority === 'urgent' ? '#ef4444' : task.priority === 'high' ? '#f97316' : task.priority === 'medium' ? '#f59e0b' : '#3b82f6';
              const isDone = task.status === 'done';
              const isInProgress = task.status === 'in-progress';
              return (
                <TouchableOpacity
                  key={task.id}
                  onPress={() => setActiveTask(task)}
                  activeOpacity={0.7}
                  style={styles.taskCard}
                >
                  <View style={styles.taskCardHeader}>
                    <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}18`, borderColor: priorityColor }]}>
                      <Text style={[styles.priorityText, { color: priorityColor }]}>{task.priority.toUpperCase()}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleUpdateStatus(task, isDone ? 'todo' : isInProgress ? 'done' : 'in-progress')}
                      style={[styles.quickStatusBtn, isDone && { backgroundColor: '#10b981' }]}
                    >
                      <Icon name={isDone ? 'check' : 'arrow-right'} size={14} color={isDone ? '#ffffff' : colors.text} />
                      <Text style={[styles.quickStatusText, isDone && { color: '#ffffff' }]}>
                        {isDone ? 'Done' : isInProgress ? 'Complete' : 'Start'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {task.description ? <Text numberOfLines={2} style={styles.taskCardDesc}>{task.description}</Text> : null}

                  {/* Subtask progress count */}
                  {task.subTasks.length > 0 ? (
                    <View style={styles.subtaskCountRow}>
                      <Icon name="check-square" size={13} color={colors.mutedText} />
                      <Text style={styles.subtaskCountText}>
                        {task.subTasks.filter((s) => s.completed).length} / {task.subTasks.length} subtasks
                      </Text>
                    </View>
                  ) : null}

                  {/* Footer with comments, date, & assignee */}
                  <View style={styles.taskCardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {task.comments.length > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Icon name="message-circle" size={13} color={colors.mutedText} />
                          <Text style={styles.metaSmallText}>{task.comments.length}</Text>
                        </View>
                      ) : null}
                      {task.dueDate ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Icon name="calendar" size={13} color={colors.mutedText} />
                          <Text style={styles.metaSmallText}>{task.dueDate}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Icon name="chevron-right" size={16} color={colors.mutedText} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 1. Create Task Modal */}
      <Modal visible={createTaskOpen} transparent animationType="none" onRequestClose={createSwipeDismiss.dismissWithAnimation}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalSheet, createSwipeDismiss.animatedStyle]}>
            <SwipeDismissHandle gesture={createSwipeDismiss.gesture} color={colors.border} animatedStyle={createSwipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close task creation" />
            <Text style={styles.modalHeading}>Create New Task</Text>

            <TextInput
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder="Task title *"
              placeholderTextColor={colors.mutedText}
              style={styles.modalInput}
            />

            <TextInput
              value={taskDesc}
              onChangeText={setTaskDesc}
              placeholder="Description (optional)"
              placeholderTextColor={colors.mutedText}
              multiline
              style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
            />

            <Text style={styles.inputLabel}>Priority</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['low', 'medium', 'high', 'urgent'] as const).map((pri) => (
                <TouchableOpacity
                  key={pri}
                  onPress={() => setTaskPriority(pri)}
                  style={[styles.pillSelect, taskPriority === pri && styles.pillSelectActive]}
                >
                  <Text style={[styles.pillSelectText, taskPriority === pri && styles.pillSelectTextActive]}>
                    {pri.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Initial Status</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['todo', 'in-progress', 'done'] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  onPress={() => setTaskStatus(st)}
                  style={[styles.pillSelect, taskStatus === st && styles.pillSelectActive]}
                >
                  <Text style={[styles.pillSelectText, taskStatus === st && styles.pillSelectTextActive]}>
                    {st === 'todo' ? 'To Do' : st === 'in-progress' ? 'In Progress' : 'Done'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setCreateTaskOpen(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleCreateTask()} disabled={submittingTask} style={styles.primaryButton}>
                {submittingTask ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.primaryButtonText}>Create Task</Text>}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* 2. Task Detail Modal */}
      <Modal visible={activeTask !== null} transparent animationType="none" onRequestClose={detailSwipeDismiss.dismissWithAnimation}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalSheet, detailSwipeDismiss.animatedStyle]}>
            <SwipeDismissHandle gesture={detailSwipeDismiss.gesture} color={colors.border} animatedStyle={detailSwipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close task details" />
            {activeTask ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={[styles.modalHeading, { flex: 1 }]}>{activeTask.title}</Text>
                  <TouchableOpacity onPress={() => setActiveTask(null)} style={{ padding: 4 }}>
                    <Icon name="x" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {activeTask.description ? (
                  <Text style={styles.detailDesc}>{activeTask.description}</Text>
                ) : null}

                {/* Status Switcher Row */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['todo', 'in-progress', 'done'] as const).map((st) => (
                    <TouchableOpacity
                      key={st}
                      onPress={() => void handleUpdateStatus(activeTask, st)}
                      style={[styles.pillSelect, activeTask.status === st && styles.pillSelectActive]}
                    >
                      <Text style={[styles.pillSelectText, activeTask.status === st && styles.pillSelectTextActive]}>
                        {st === 'todo' ? 'To Do' : st === 'in-progress' ? 'In Progress' : 'Done'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Subtasks Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionHeading}>Subtasks ({activeTask.subTasks.length})</Text>
                  {activeTask.subTasks.map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => void handleToggleSubtask(sub.id)}
                      style={styles.subtaskItem}
                    >
                      <Icon name={sub.completed ? 'check-square' : 'square'} size={18} color={sub.completed ? '#10b981' : colors.mutedText} />
                      <Text style={[styles.subtaskTitle, sub.completed && styles.subtaskCompleted]}>{sub.title}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <TextInput
                      value={newSubtaskTitle}
                      onChangeText={setNewSubtaskTitle}
                      placeholder="Add subtask..."
                      placeholderTextColor={colors.mutedText}
                      style={[styles.modalInput, { flex: 1 }]}
                    />
                    <TouchableOpacity onPress={() => void handleAddSubtask()} style={styles.primaryButtonSmall}>
                      <Icon name="plus" size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Comments Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionHeading}>Comments ({activeTask.comments.length})</Text>
                  {activeTask.comments.map((comm) => (
                    <View key={comm.id} style={styles.commentBubble}>
                      <Text style={styles.commentAuthor}>{comm.author}</Text>
                      <Text style={styles.commentText}>{comm.content}</Text>
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <TextInput
                      value={newCommentText}
                      onChangeText={setNewCommentText}
                      placeholder="Write a comment..."
                      placeholderTextColor={colors.mutedText}
                      style={[styles.modalInput, { flex: 1 }]}
                    />
                    <TouchableOpacity onPress={() => void handleAddComment()} style={styles.primaryButtonSmall}>
                      <Icon name="send" size={15} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Time Tracking Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionHeading}>Log Time (Minutes)</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      value={timeSpentMinutes}
                      onChangeText={setTimeSpentMinutes}
                      placeholder="e.g. 30"
                      keyboardType="numeric"
                      placeholderTextColor={colors.mutedText}
                      style={[styles.modalInput, { flex: 1 }]}
                    />
                    <TouchableOpacity onPress={() => void handleAddTimeEntry()} style={styles.primaryButtonSmall}>
                      <Text style={styles.primaryButtonText}>Log</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Delete Button */}
                <TouchableOpacity onPress={() => void handleDeleteTask(activeTask.id)} style={styles.dangerButton}>
                  <Icon name="trash-2" size={16} color="#ef4444" />
                  <Text style={styles.dangerButtonText}>Delete Task</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </Animated.View>
        </View>
      </Modal>

      {/* 3. Invite User Modal */}
      <Modal visible={inviteOpen} transparent animationType="none" onRequestClose={inviteSwipeDismiss.dismissWithAnimation}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalSheet, inviteSwipeDismiss.animatedStyle]}>
            <SwipeDismissHandle gesture={inviteSwipeDismiss.gesture} color={colors.border} animatedStyle={inviteSwipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close invite modal" />
            <Text style={styles.modalHeading}>Invite Team Member</Text>
            <Text style={styles.inputLabel}>Email Address or Username</Text>
            <TextInput
              value={inviteRecipient}
              onChangeText={setInviteRecipient}
              placeholder="user@example.com"
              autoCapitalize="none"
              placeholderTextColor={colors.mutedText}
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Role</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['member', 'admin', 'viewer'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setInviteRole(r)}
                  style={[styles.pillSelect, inviteRole === r && styles.pillSelectActive]}
                >
                  <Text style={[styles.pillSelectText, inviteRole === r && styles.pillSelectTextActive]}>
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setInviteOpen(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleSendInvite()} disabled={inviting || !inviteRecipient.trim()} style={styles.primaryButton}>
                {inviting ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.primaryButtonText}>Send Invite</Text>}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* 4. Project Settings Modal */}
      <Modal visible={settingsOpen} transparent animationType="none" onRequestClose={settingsSwipeDismiss.dismissWithAnimation}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalSheet, settingsSwipeDismiss.animatedStyle]}>
            <SwipeDismissHandle gesture={settingsSwipeDismiss.gesture} color={colors.border} animatedStyle={settingsSwipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close settings modal" />
            <Text style={styles.modalHeading}>Project Settings</Text>

            <Text style={styles.inputLabel}>Project Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top' }]}
            />

            <Text style={styles.inputLabel}>Status</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['active', 'completed', 'on-hold', 'archived'] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  onPress={() => setEditStatus(st)}
                  style={[styles.pillSelect, editStatus === st && styles.pillSelectActive]}
                >
                  <Text style={[styles.pillSelectText, editStatus === st && styles.pillSelectTextActive]}>
                    {st.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setSettingsOpen(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleSaveSettings()} disabled={savingSettings} style={styles.primaryButton}>
                {savingSettings ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.primaryButtonText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => void handleDeleteProject()} style={[styles.dangerButton, { marginTop: 12 }]}>
              <Icon name="trash-2" size={16} color="#ef4444" />
              <Text style={styles.dangerButtonText}>Delete Entire Project</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <CustomModal
        visible={feedback !== null}
        type={feedback?.type ?? 'info'}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        onClose={() => setFeedback(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    scrollContent: { padding: 16, paddingBottom: 48, gap: 16 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, fontSize: 14, color: colors.mutedText },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    projectHero: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 14,
    },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    projectName: { fontSize: 20, fontWeight: '900', color: colors.text },
    projectDesc: { fontSize: 13, color: colors.mutedText, marginTop: 4, lineHeight: 18 },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: '#d1fae5',
    },
    statusText: { fontSize: 11, fontWeight: '800', color: '#047857', textTransform: 'capitalize' },
    progressContainer: { gap: 6 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontSize: 12, fontWeight: '700', color: colors.mutedText },
    progressValue: { fontSize: 12, fontWeight: '800', color: '#10b981' },
    progressBarBg: { height: 7, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 999, backgroundColor: '#10b981' },
    metricsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: 14,
      padding: 12,
    },
    metricItem: { alignItems: 'center' },
    metricNumber: { fontSize: 16, fontWeight: '900', color: colors.text },
    metricLabel: { fontSize: 11, color: colors.mutedText, marginTop: 2 },
    heroActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#10b981',
    },
    actionBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
    actionBtnSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    actionBtnTextSecondary: { color: colors.text, fontWeight: '700', fontSize: 13 },
    filterSection: { gap: 10 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 42,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 14 },
    priorityFilterRow: { flexDirection: 'row', gap: 8 },
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterPillActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    filterPillText: { fontSize: 11, fontWeight: '700', color: colors.mutedText },
    filterPillTextActive: { color: '#ffffff' },
    kanbanTabs: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
    },
    kanbanTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
    kanbanTabActive: { backgroundColor: isDark ? '#1e293b' : '#ecfdf5' },
    kanbanTabText: { fontSize: 12, fontWeight: '700', color: colors.mutedText },
    kanbanTabTextActive: { color: '#047857', fontWeight: '800' },
    tasksContainer: { gap: 12 },
    noTasksCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 32,
      alignItems: 'center',
      gap: 8,
    },
    noTasksTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    noTasksSubtitle: { fontSize: 12, color: colors.mutedText },
    taskCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 8,
    },
    taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    priorityText: { fontSize: 10, fontWeight: '800' },
    quickStatusBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: colors.control,
    },
    quickStatusText: { fontSize: 11, fontWeight: '700', color: colors.text },
    taskTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    taskCardDesc: { fontSize: 13, color: colors.mutedText, lineHeight: 18 },
    subtaskCountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    subtaskCountText: { fontSize: 12, color: colors.mutedText, fontWeight: '600' },
    taskCardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    metaSmallText: { fontSize: 12, color: colors.mutedText },
    modalBackdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
      maxHeight: '85%',
      gap: 12,
    },
    modalHeading: { fontSize: 18, fontWeight: '900', color: colors.text },
    inputLabel: { fontSize: 12, fontWeight: '700', color: colors.mutedText, marginTop: 4 },
    modalInput: {
      backgroundColor: colors.control,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    pillSelect: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.control,
    },
    pillSelectActive: { backgroundColor: '#d1fae5', borderColor: '#10b981' },
    pillSelectText: { fontSize: 11, fontWeight: '700', color: colors.mutedText },
    pillSelectTextActive: { color: '#047857', fontWeight: '800' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    cancelButton: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: { color: colors.text, fontWeight: '700' },
    primaryButton: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#10b981',
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonSmall: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#10b981',
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: '#ffffff', fontWeight: '800' },
    detailDesc: { fontSize: 14, color: colors.text, lineHeight: 20 },
    detailSection: { gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    sectionHeading: { fontSize: 14, fontWeight: '800', color: colors.text },
    subtaskItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    subtaskTitle: { fontSize: 13, color: colors.text, flex: 1 },
    subtaskCompleted: { textDecorationLine: 'line-through', color: colors.mutedText },
    commentBubble: { backgroundColor: colors.control, padding: 10, borderRadius: 10, gap: 2 },
    commentAuthor: { fontSize: 12, fontWeight: '800', color: colors.text },
    commentText: { fontSize: 13, color: colors.text },
    dangerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: '#fef2f2',
      borderWidth: 1,
      borderColor: '#fecaca',
      marginTop: 8,
    },
    dangerButtonText: { color: '#ef4444', fontWeight: '800', fontSize: 13 },
  });
