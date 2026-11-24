import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock, Flag, Lightbulb, Link2, ListTodo, Target, Users } from 'lucide-react-native';
import {
  PROJECT_RIPPLE, ProjectAvatarStack, ProjectButton, ProjectPill, ProjectProgressBar, ProjectSection, projectStatusTone, type ProjectTone,
} from '@/components/projectManagement/ProjectUiParts';
import { STATUS_LABELS, auditLabel } from '@/components/projectManagement/projectFormat';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { TASK_STATUS_ORDER, projectInsightRules, type ProjectNextActionId, type TaskQuickFilter } from '@/lib/services/ProjectInsightRules';
import { projectLifecycleRules } from '@/lib/services/ProjectLifecycleRules';
import type { Milestone, ProjectRecord, Task, TeamMember } from '@/lib/types/project';

export type ProjectSectionId = 'overview' | 'tasks' | 'milestones' | 'team';

type ProjectOverviewPanelProps = {
  project: ProjectRecord;
  tasks: Task[];
  milestones: Milestone[];
  acceptedMembers: TeamMember[];
  pendingCount: number;
  currentUserId: string;
  canManage: boolean;
  canWrite: boolean;
  onOpenTask: (task: Task) => void;
  onShowTasks: (quick: TaskQuickFilter) => void;
  onShowSection: (section: ProjectSectionId) => void;
  onCreateTask: () => void;
  onInvite: () => void;
  onEditDetails: () => void;
  onAddMilestone: () => void;
  onChangeStatus: () => void;
  /** The project activity log panel (status and team changes). */
  activity: ReactNode;
  /** The sponsoring Community card (shown above the activity). */
  community?: ReactNode;
};

const MAX_ATTENTION = 5;
const MAX_TASK_UPDATES = 5;
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

function timeAgo(timestamp: string): string {
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) return '';
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** The project at a glance: purpose, stage, next milestone, what needs attention, suggested next steps, team and activity. */
export default function ProjectOverviewPanel({ project, tasks, milestones, acceptedMembers, pendingCount, currentUserId, canManage, canWrite, onOpenTask, onShowTasks, onShowSection, onCreateTask, onInvite, onEditDetails, onAddMilestone, onChangeStatus, activity, community }: ProjectOverviewPanelProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = projectInsightRules.today();
  const attention = useMemo(() => projectInsightRules.attention(tasks, today), [tasks, today]);
  const nextMilestone = useMemo(() => projectInsightRules.nextMilestone(milestones), [milestones]);
  const milestoneProgress = nextMilestone ? projectInsightRules.milestoneProgress(nextMilestone.id, tasks) : null;
  const milestoneDue = nextMilestone ? projectInsightRules.dueLabel(nextMilestone.dueDate, today) : null;
  const projectDue = projectInsightRules.dueLabel(project.dueDate, today, project.status === 'completed');
  const nextActions = projectInsightRules.nextActions({ tasks, milestones, memberCount: acceptedMembers.length, canManage, canWrite, hasPurpose: Boolean(project.description.trim()), userId: currentUserId, today });
  const counts = TASK_STATUS_ORDER.map((status) => ({ status, count: tasks.filter((task) => task.status === status).length }));
  const doneCount = counts.find((entry) => entry.status === 'done')?.count ?? 0;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : project.progress;
  const memberById = useMemo(() => new Map(acceptedMembers.map((member) => [member.id, member])), [acceptedMembers]);
  const nameOf = (userId: string): string => (userId === currentUserId ? 'You' : memberById.get(userId)?.name ?? 'Someone');
  const taskUpdates = useMemo(() => tasks
    .flatMap((task) => (task.auditLog ?? []).map((entry) => ({ ...entry, task })))
    .sort((first, second) => second.timestamp.localeCompare(first.timestamp))
    .slice(0, MAX_TASK_UPDATES), [tasks]);

  const handleAction = (id: ProjectNextActionId): void => {
    if (id === 'add_first_task') onCreateTask();
    else if (id === 'review_overdue') onShowTasks('overdue');
    else if (id === 'add_purpose') onEditDetails();
    else if (id === 'invite_member') onInvite();
    else if (id === 'add_milestone') onAddMilestone();
    else if (id === 'assign_tasks') onShowTasks('unassigned');
    else if (id === 'my_tasks') onShowTasks('mine');
    else onChangeStatus();
  };

  const toneFor = (tone: string | undefined): ProjectTone => (tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'neutral');

  return (
    <View style={{ gap: 14 }}>
      <ProjectSection title="Purpose" icon={<Target size={18} color={colors.accentText} />}>
        {project.description ? <Text style={styles.body}>{project.description}</Text> : (
          <Text style={styles.muted}>{canManage ? 'Say in a line or two what this project should achieve, so everyone works toward the same thing.' : 'No purpose written yet.'}</Text>
        )}
        <View style={styles.factRow}>
          <Text style={styles.fact}>Owner: <Text style={styles.factStrong}>{project.isOwner ? 'You' : project.ownerName || 'Project owner'}</Text></Text>
          {projectDue ? <View style={styles.inline}><CalendarDays size={14} color={colors.mutedText} /><Text style={styles.fact}>Target: <Text style={styles.factStrong}>{projectInsightRules.shortDate(project.dueDate, today)}</Text></Text></View> : null}
        </View>
        {canManage && !project.description ? <ProjectButton label="Add a purpose" variant="secondary" isCompact onPress={onEditDetails} /> : null}
      </ProjectSection>

      <ProjectSection title="Progress" icon={<ListTodo size={18} color={colors.accentText} />} action={<ProjectPill label={projectLifecycleRules.label(project.status)} tone={projectStatusTone(project.status)} />}>
        <View style={styles.progressRow}>
          <Text style={styles.body}>{tasks.length > 0 ? `${doneCount} of ${plural(tasks.length, 'task', 'tasks')} done` : 'No tasks yet'}</Text>
          <Text style={styles.percent}>{progress}%</Text>
        </View>
        <ProjectProgressBar value={progress} height={8} accessibilityLabel="Project progress" />
        <View style={styles.statRow}>
          {counts.map(({ status, count }) => (
            <Pressable key={status} onPress={() => onShowSection('tasks')} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`${STATUS_LABELS[status]}: ${count}. Open tasks`} style={styles.stat}>
              <Text style={styles.statValue}>{count}</Text>
              <Text numberOfLines={1} style={styles.statLabel}>{STATUS_LABELS[status]}</Text>
            </Pressable>
          ))}
        </View>
      </ProjectSection>

      <ProjectSection title="Next milestone" icon={<Flag size={18} color={colors.accentText} />} action={milestones.length > 0 ? <LinkButton label="All" onPress={() => onShowSection('milestones')} /> : undefined}>
        {nextMilestone ? (
          <Pressable onPress={() => onShowSection('milestones')} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`${nextMilestone.name}${milestoneDue ? `, ${milestoneDue.label}` : ''}. Open milestones`} style={{ gap: 8 }}>
            <Text numberOfLines={2} style={styles.strong}>{nextMilestone.name}</Text>
            {milestoneDue ? <ProjectPill label={milestoneDue.label} tone={toneFor(milestoneDue.tone)} /> : <Text style={styles.muted}>No date set</Text>}
            {milestoneProgress && milestoneProgress.total > 0 ? <>
              <Text style={styles.muted}>{milestoneProgress.done} of {plural(milestoneProgress.total, 'linked task', 'linked tasks')} done</Text>
              <ProjectProgressBar value={milestoneProgress.percent} accessibilityLabel={`${nextMilestone.name} progress`} />
            </> : <Text style={styles.muted}>No tasks linked yet.</Text>}
          </Pressable>
        ) : (
          <>
            <Text style={styles.muted}>{milestones.length > 0 ? 'Every milestone is complete.' : 'Milestones mark checkpoints, like "Venue booked" or "First release".'}</Text>
            {canWrite ? <ProjectButton label="Set a milestone" variant="secondary" isCompact onPress={onAddMilestone} /> : null}
          </>
        )}
      </ProjectSection>

      <ProjectSection title="Needs attention" icon={<AlertTriangle size={18} color={attention.length > 0 ? colors.destructiveText : colors.accentText} />} action={attention.length > MAX_ATTENTION ? <LinkButton label={`All ${attention.length}`} onPress={() => onShowTasks(attention.some((item) => item.isOverdue) ? 'overdue' : 'blocked')} /> : undefined}>
        {attention.length === 0 ? (
          <View style={styles.inline}><CheckCircle2 size={16} color={colors.accentText} /><Text style={styles.muted}>Nothing is overdue or waiting on other work.</Text></View>
        ) : attention.slice(0, MAX_ATTENTION).map((item) => {
          const due = projectInsightRules.dueLabel(item.task.dueDate, today);
          const reason = [item.isOverdue && due ? due.label : '', item.blockedBy.length > 0 ? `Waiting on ${item.blockedBy.map((blocker) => blocker.title).join(', ')}` : ''].filter(Boolean).join(' · ');
          return (
            <Pressable key={item.task.id} onPress={() => onOpenTask(item.task)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`${item.task.title}. ${reason}`} style={styles.listRow}>
              {item.isOverdue ? <Clock size={18} color={colors.destructiveText} /> : <Link2 size={18} color={colors.warningText} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={styles.rowTitle}>{item.task.title}</Text>
                <Text numberOfLines={2} style={[styles.rowDetail, { color: item.isOverdue ? colors.destructiveText : colors.warningText }]}>{reason}</Text>
              </View>
              <ChevronRight size={18} color={colors.mutedText} />
            </Pressable>
          );
        })}
      </ProjectSection>

      {nextActions.length > 0 ? (
        <ProjectSection title="Next steps" icon={<Lightbulb size={18} color={colors.accentText} />}>
          {nextActions.map((action) => (
            <Pressable key={action.id} onPress={() => handleAction(action.id)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`${action.title}. ${action.detail}`} style={styles.listRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={styles.rowTitle}>{action.title}</Text>
                <Text numberOfLines={2} style={styles.rowDetail}>{action.detail}</Text>
              </View>
              <ChevronRight size={18} color={colors.mutedText} />
            </Pressable>
          ))}
        </ProjectSection>
      ) : null}

      <ProjectSection title="Team" icon={<Users size={18} color={colors.accentText} />} action={<LinkButton label="See team" onPress={() => onShowSection('team')} />}>
        <View style={styles.inline}>
          <ProjectAvatarStack members={acceptedMembers} max={5} />
          <Text style={[styles.muted, { flexShrink: 1 }]}>{plural(acceptedMembers.length, 'member', 'members')}{pendingCount > 0 ? ` · ${pendingCount} invited` : ''}</Text>
        </View>
      </ProjectSection>

      {community}

      {activity}

      {taskUpdates.length > 0 ? (
        <ProjectSection title="Recent task updates" icon={<ListTodo size={18} color={colors.accentText} />}>
          {taskUpdates.map((entry) => (
            <Pressable key={`${entry.task.id}:${entry.id}`} onPress={() => onOpenTask(entry.task)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" style={styles.updateRow}>
              <Text style={styles.rowDetailStrong}><Text style={styles.factStrong}>{nameOf(entry.userId)}</Text> · {auditLabel(entry.action).toLowerCase()}</Text>
              <Text numberOfLines={1} style={styles.rowDetail}>{entry.task.title} · {timeAgo(entry.timestamp)}</Text>
            </Pressable>
          ))}
        </ProjectSection>
      ) : null}
    </View>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable onPress={onPress} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" hitSlop={6} style={{ minHeight: 36, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 8, overflow: 'hidden' }}>
    <Text style={{ color: colors.accentText, fontSize: 14, fontWeight: '700' }}>{label}</Text>
  </Pressable>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  strong: { color: colors.text, fontSize: 16, fontWeight: '800' },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  fact: { color: colors.mutedText, fontSize: 13 },
  factStrong: { color: colors.text, fontWeight: '700' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  percent: { color: colors.text, fontSize: 15, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, minHeight: 56, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.mutedText, fontSize: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 6, borderRadius: 10, overflow: 'hidden' },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowDetail: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  rowDetailStrong: { color: colors.secondaryText, fontSize: 13, lineHeight: 18 },
  updateRow: { gap: 1, minHeight: 44, justifyContent: 'center', borderRadius: 10, overflow: 'hidden' },
});
