import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRightLeft, CheckCircle2, Circle, Clock, Flag, Link2, ListChecks, MessageCircle, Paperclip } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { PROJECT_RIPPLE, ProjectPill, type ProjectTone } from '@/components/projectManagement/ProjectUiParts';
import { STATUS_LABELS, priorityColor } from '@/components/projectManagement/projectFormat';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { projectInsightRules } from '@/lib/services/ProjectInsightRules';
import type { Task, TeamMember } from '@/lib/types/project';

type ProjectTaskCardProps = {
  task: Task;
  today: string;
  /** Accepted members by id, to show who is on the task. */
  memberById: ReadonlyMap<string, TeamMember>;
  milestoneName?: string;
  /** Unfinished tasks this one depends on. */
  blockedByCount: number;
  canWrite: boolean;
  isBusy: boolean;
  isTimerRunning: boolean;
  /** List rows get a done/undo toggle in front; board cards show the priority on top. */
  variant: 'list' | 'board';
  onOpen: (task: Task) => void;
  onMove: (task: Task) => void;
  onToggleDone: (task: Task) => void;
};

const PRIORITY_LABEL = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' } as const;

/** One task in the list or on the board. Tap opens it; "Move" changes its column without dragging. */
export default function ProjectTaskCard({ task, today, memberById, milestoneName, blockedByCount, canWrite, isBusy, isTimerRunning, variant, onOpen, onMove, onToggleDone }: ProjectTaskCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDone = task.status === 'done';
  const due = projectInsightRules.dueLabel(task.dueDate, today, isDone);
  const assigneeIds = task.assignedToAll ? [] : [...new Set([task.assignee, ...(task.assignees ?? [])].filter(Boolean))];
  const checklistDone = task.subTasks.filter((subTask) => subTask.completed).length;
  const showPriority = variant === 'board' || task.priority === 'urgent' || task.priority === 'high';
  const dueTone: ProjectTone = due?.tone === 'danger' ? 'danger' : due?.tone === 'warning' ? 'warning' : 'neutral';
  const summary = [
    task.title, STATUS_LABELS[task.status], `${PRIORITY_LABEL[task.priority]} priority`, due?.label ?? '',
    blockedByCount > 0 ? `Waiting on ${blockedByCount} ${blockedByCount === 1 ? 'task' : 'tasks'}` : '',
    task.subTasks.length > 0 ? `Checklist ${checklistDone} of ${task.subTasks.length}` : '',
    task.assignedToAll ? 'Assigned to everyone' : assigneeIds.length === 0 ? 'Unassigned' : '',
  ].filter(Boolean).join('. ');

  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      {variant === 'list' ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={isDone ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
          accessibilityState={{ checked: isDone, disabled: !canWrite || isBusy, busy: isBusy }}
          disabled={!canWrite || isBusy}
          onPress={() => onToggleDone(task)}
          android_ripple={{ ...PROJECT_RIPPLE, borderless: true }}
          style={styles.toggle}
        >
          {isBusy ? <ActivityIndicator size="small" color={colors.accent} /> : isDone ? <CheckCircle2 size={24} color={colors.accent} /> : <Circle size={24} color={canWrite ? colors.mutedText : colors.border} />}
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={summary} accessibilityHint="Opens the task" onPress={() => onOpen(task)} android_ripple={PROJECT_RIPPLE} style={[styles.body, variant === 'list' && { paddingLeft: 0 }]}>
        {showPriority ? (
          <View style={styles.priorityRow}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor(task.priority) }]} />
            <Text style={styles.priorityText}>{PRIORITY_LABEL[task.priority]}</Text>
            {isTimerRunning ? <View style={styles.inline}><Clock size={12} color={colors.accentText} /><Text style={[styles.meta, { color: colors.accentText, fontWeight: '700' }]}>Timer on</Text></View> : null}
          </View>
        ) : null}
        <Text numberOfLines={3} style={[styles.title, isDone && styles.titleDone]}>{task.title}</Text>
        {due || blockedByCount > 0 ? (
          <View style={styles.pills}>
            {due ? <ProjectPill label={due.label} tone={dueTone} /> : null}
            {blockedByCount > 0 ? <ProjectPill label={`Waiting on ${blockedByCount}`} tone="warning" icon={<Link2 size={12} color={colors.warningText} />} /> : null}
          </View>
        ) : null}
        <View style={styles.metaRow}>
          {task.assignedToAll ? <Text style={styles.meta}>Everyone</Text> : assigneeIds.length === 0 ? <Text style={styles.meta}>Unassigned</Text> : (
            <View style={styles.avatars}>
              {assigneeIds.slice(0, 3).map((memberId, index) => {
                const member = memberById.get(memberId);
                return <View key={memberId} style={{ marginLeft: index === 0 ? 0 : -6 }}><UserAvatar userId={memberId} profileImage={member?.avatar} firstName={member?.name} size={22} /></View>;
              })}
            </View>
          )}
          {task.subTasks.length > 0 ? <View style={styles.inline}><ListChecks size={13} color={colors.mutedText} /><Text style={styles.meta}>{checklistDone}/{task.subTasks.length}</Text></View> : null}
          {task.comments.length > 0 ? <View style={styles.inline}><MessageCircle size={13} color={colors.mutedText} /><Text style={styles.meta}>{task.comments.length}</Text></View> : null}
          {task.attachments.length > 0 ? <View style={styles.inline}><Paperclip size={13} color={colors.mutedText} /><Text style={styles.meta}>{task.attachments.length}</Text></View> : null}
          {milestoneName ? <View style={[styles.inline, styles.shrink]}><Flag size={13} color={colors.mutedText} /><Text numberOfLines={1} style={[styles.meta, styles.shrink]}>{milestoneName}</Text></View> : null}
        </View>
      </Pressable>
      {canWrite ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Move ${task.title}`} accessibilityHint="Choose To do, In progress or Done" disabled={isBusy} onPress={() => onMove(task)} android_ripple={{ ...PROJECT_RIPPLE, borderless: true }} style={styles.move}>
          <ArrowRightLeft size={18} color={colors.icon} />
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  cardDone: { opacity: 0.8 },
  toggle: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  body: { flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 12, gap: 6 },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  titleDone: { color: colors.mutedText, textDecorationLine: 'line-through' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  avatars: { flexDirection: 'row' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrink: { flexShrink: 1, minWidth: 0 },
  meta: { color: colors.mutedText, fontSize: 12 },
  move: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
});
