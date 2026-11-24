import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AlertTriangle, ChevronLeft, ChevronRight, Flag, Layers, Package } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { PanelHeader } from '@/components/projectManagement/ProjectPanelParts';
import { PROJECT_RIPPLE, ProjectPill } from '@/components/projectManagement/ProjectUiParts';
import { STATUS_LABELS, formatCalendarDate, parseCalendarString, toCalendarString } from '@/components/projectManagement/projectFormat';
import { projectScheduleRules, type ScheduleReason, type TaskPlan } from '@/lib/services/ProjectScheduleRules';
import type { Milestone, Priority, ProjectDeliverable, Task } from '@/lib/types/project';

type ProjectTimelinePanelProps = {
  tasks: Task[];
  milestones: Milestone[];
  /** Deliverable due dates, shown when the deliverables module is on. */
  deliverables?: ProjectDeliverable[];
  onSelectTask: (task: Task) => void;
};

const DAYS_TO_SHOW = 42;
const DAY_WIDTH = 28;
const DAY_MS = 24 * 60 * 60 * 1000;
const BAR_COLORS: { [priority in Priority]: string } = { urgent: '#e11d48', high: '#ea580c', medium: '#2563eb', low: '#047857' };

const dayStart = (date: Date): Date => { const copy = new Date(date); copy.setHours(0, 0, 0, 0); return copy; };

/** One reason in words, using task names (never an ID). */
export function scheduleReasonText(reason: ScheduleReason, titleOf: (taskId: string) => string): string {
  const names = (ids: string[]): string => ids.map(titleOf).join(', ');
  if (reason.kind === 'undated') return 'No dates yet, so it is not placed on the timeline.';
  if (reason.kind === 'waiting') return `Waits on ${names(reason.taskIds)}.`;
  if (reason.kind === 'unknown_dependency_date') return `${names(reason.taskIds)} has no due date, so when this can start is unknown.`;
  if (reason.kind === 'missing_dependency') return `${reason.taskIds.length === 1 ? 'A task it waited on was' : `${reason.taskIds.length} tasks it waited on were`} archived or deleted.`;
  if (reason.kind === 'conflict') return `Planned to start before ${titleOf(reason.taskId)} is due (${formatCalendarDate(reason.date)}).`;
  if (reason.kind === 'overdue') return `Past its due date (${formatCalendarDate(reason.date)}).`;
  return 'On the critical chain: if this slips, the latest finish moves too.';
}

/**
 * Tasks, milestones and deliverable due dates over six weeks, scrolled sideways, built from the same task data as the
 * list (website ProjectTimelineView). Dates are what people planned, not a forecast: undated tasks are listed apart,
 * and each row says why a task waits, conflicts or sits on the critical chain.
 */
export default function ProjectTimelinePanel({ tasks, milestones, deliverables = [], onSelectTask }: ProjectTimelinePanelProps) {
  const { colors } = useAppTheme();
  const [offsetDays, setOffsetDays] = useState(0);
  const today = toCalendarString(new Date());

  const plan = useMemo(() => projectScheduleRules.plan(
    tasks.map((task) => ({ id: task.id, status: task.status, startDate: task.startDate || null, dueDate: task.dueDate || null, dependencies: task.dependencies ?? [], archived: task.archived === true })),
    milestones.map((milestone) => ({ id: milestone.id, dueDate: milestone.dueDate || null, completed: milestone.completed })),
    today,
  ), [milestones, tasks, today]);
  const titleOf = useMemo(() => {
    const titles = new Map(tasks.map((task) => [task.id, task.title]));
    return (taskId: string): string => `"${titles.get(taskId) ?? 'a removed task'}"`;
  }, [tasks]);

  const startDate = useMemo(() => {
    const date = dayStart(new Date());
    date.setDate(date.getDate() - 7 + offsetDays);
    return date;
  }, [offsetDays]);
  const days = useMemo(() => Array.from({ length: DAYS_TO_SHOW }, (_, index) => { const date = new Date(startDate); date.setDate(startDate.getDate() + index); return date; }), [startDate]);
  const dayIndex = (value: string | null): number | null => { const date = value ? parseCalendarString(value) : null; return date ? Math.round((dayStart(date).getTime() - startDate.getTime()) / DAY_MS) : null; };
  const todayIndex = dayIndex(today) ?? -1;
  const gridWidth = DAYS_TO_SHOW * DAY_WIDTH;

  const placed = tasks.filter((task) => plan.tasks[task.id]?.start).sort((first, second) => (plan.tasks[first.id].start ?? '').localeCompare(plan.tasks[second.id].start ?? ''));
  const undated = tasks.filter((task) => plan.tasks[task.id] && !plan.tasks[task.id].start);
  const markers = [
    ...milestones.filter((milestone) => milestone.dueDate).map((milestone) => ({ id: `m_${milestone.id}`, label: milestone.name, date: milestone.dueDate, kind: 'milestone' as const, done: milestone.completed })),
    ...deliverables.filter((deliverable) => deliverable.dueDate).map((deliverable) => ({ id: `d_${deliverable.id}`, label: deliverable.title, date: deliverable.dueDate, kind: 'deliverable' as const, done: deliverable.status === 'accepted' })),
  ].sort((first, second) => first.date.localeCompare(second.date));
  const conflicts = Object.values(plan.tasks).filter((entry) => entry.conflict).length;

  const rowLabel = (task: Task, entry: TaskPlan): string => {
    const dates = entry.start === entry.end ? formatCalendarDate(entry.start) : `${formatCalendarDate(entry.start)} to ${formatCalendarDate(entry.end)}`;
    const reasons = entry.reasons.filter((reason) => reason.kind !== 'undated').map((reason) => scheduleReasonText(reason, titleOf)).join(' ');
    return `${task.title}. ${STATUS_LABELS[task.status]}. ${dates}. ${reasons} Opens the task.`;
  };

  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<Layers size={18} color={colors.accent} />}
        title="Timeline"
        description="Bars run from each task's start to its due date. These are the dates people planned, not a forecast; tasks without dates are listed below. Tap a task to change its dates."
        action={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Show the previous week" onPress={() => setOffsetDays((value) => value - 7)} android_ripple={PROJECT_RIPPLE} style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, overflow: 'hidden' }}><ChevronLeft size={18} color={colors.text} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to this week" onPress={() => setOffsetDays(0)} android_ripple={PROJECT_RIPPLE} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, overflow: 'hidden' }}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Today</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Show the next week" onPress={() => setOffsetDays((value) => value + 7)} android_ripple={PROJECT_RIPPLE} style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, overflow: 'hidden' }}><ChevronRight size={18} color={colors.text} /></Pressable>
          </View>
        )}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {plan.latestFinish ? <ProjectPill label={`Latest planned finish ${formatCalendarDate(plan.latestFinish)}`} tone="info" /> : null}
        {plan.criticalChain.length > 0 ? <ProjectPill label={`Critical chain: ${plan.criticalChain.length} ${plan.criticalChain.length === 1 ? 'task' : 'tasks'}`} tone="warning" /> : null}
        {conflicts > 0 ? <ProjectPill label={`${conflicts} date ${conflicts === 1 ? 'conflict' : 'conflicts'}`} tone="danger" /> : null}
      </View>

      {placed.length === 0 && markers.length === 0 ? (
        <Text style={{ color: colors.mutedText, fontSize: 13 }}>No task has dates yet. Add a start or due date to a task to place it here.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel="Timeline grid, scroll sideways">
          <View style={{ width: gridWidth, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
            <View style={{ height: 40, flexDirection: 'row', backgroundColor: colors.control }} importantForAccessibility="no-hide-descendants">
              {days.map((day, index) => (
                <View key={day.getTime()} style={{ width: DAY_WIDTH, alignItems: 'center', justifyContent: 'center', backgroundColor: index === todayIndex ? colors.successSurface : undefined }}>
                  <Text style={{ fontSize: 9, color: colors.mutedText }}>{day.getDate() === 1 || index === 0 ? day.toLocaleDateString('en-US', { month: 'short' }) : day.toLocaleDateString('en-US', { weekday: 'narrow' })}</Text>
                  <Text style={{ fontSize: 11, fontWeight: index === todayIndex ? '900' : '600', color: index === todayIndex ? colors.successText : colors.text }}>{day.getDate()}</Text>
                </View>
              ))}
            </View>
            {markers.map((marker) => {
              const index = dayIndex(marker.date);
              const inside = index !== null && index >= 0 && index < DAYS_TO_SHOW;
              return (
                <View key={marker.id} accessible accessibilityLabel={`${marker.kind === 'milestone' ? 'Milestone' : 'Deliverable'} ${marker.label}, due ${formatCalendarDate(marker.date)}${marker.done ? ', done' : ''}`} style={{ height: 32, borderTopWidth: 1, borderTopColor: colors.border, justifyContent: 'center' }}>
                  {inside ? (
                    <View style={{ position: 'absolute', left: Math.min(index * DAY_WIDTH, gridWidth - 150), flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: marker.kind === 'milestone' ? '#7c3aed' : '#0e7490', maxWidth: 150, opacity: marker.done ? 0.6 : 1 }}>
                      {marker.kind === 'milestone' ? <Flag size={10} color="#ffffff" /> : <Package size={10} color="#ffffff" />}
                      <Text numberOfLines={1} style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>{marker.label}</Text>
                    </View>
                  ) : <Text numberOfLines={1} style={{ paddingHorizontal: 8, color: colors.mutedText, fontSize: 11 }}>{marker.label} · {formatCalendarDate(marker.date)} (outside these weeks)</Text>}
                </View>
              );
            })}
            {placed.map((task) => {
              const entry = plan.tasks[task.id];
              const start = dayIndex(entry.start) ?? 0;
              const end = dayIndex(entry.end) ?? start;
              const visibleStart = Math.max(0, start);
              const visibleEnd = Math.min(DAYS_TO_SHOW - 1, end);
              const visible = visibleEnd >= 0 && visibleStart < DAYS_TO_SHOW && visibleEnd >= visibleStart;
              return (
                <Pressable key={task.id} onPress={() => onSelectTask(task)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={rowLabel(task, entry)} style={{ height: 46, borderTopWidth: 1, borderTopColor: colors.border, justifyContent: 'center', overflow: 'hidden' }}>
                  {todayIndex >= 0 && todayIndex < DAYS_TO_SHOW ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: todayIndex * DAY_WIDTH, width: DAY_WIDTH, backgroundColor: colors.successSurface, opacity: 0.5 }} /> : null}
                  {visible ? (
                    <View style={{ position: 'absolute', left: visibleStart * DAY_WIDTH + 1, width: Math.max((visibleEnd - visibleStart + 1) * DAY_WIDTH - 2, 26), height: 28, borderRadius: 8, backgroundColor: BAR_COLORS[task.priority], borderWidth: entry.critical ? 2 : 0, borderColor: '#f59e0b', justifyContent: 'center', paddingHorizontal: 6, opacity: task.status === 'done' ? 0.55 : 1 }}>
                      <Text numberOfLines={1} style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>{entry.conflict ? '! ' : ''}{task.title}</Text>
                    </View>
                  ) : <Text numberOfLines={1} style={{ paddingHorizontal: 8, color: colors.mutedText, fontSize: 11 }}>{task.title} · {formatCalendarDate(entry.start)} (outside these weeks)</Text>}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {placed.length > 0 ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <Text accessibilityRole="header" style={{ paddingHorizontal: 14, paddingTop: 12, color: colors.text, fontSize: 15, fontWeight: '800' }}>Dates and what they depend on</Text>
          {placed.map((task, index) => {
            const entry = plan.tasks[task.id];
            const notes = entry.reasons.filter((reason) => reason.kind !== 'undated');
            return (
              <Pressable key={task.id} onPress={() => onSelectTask(task)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={rowLabel(task, entry)} style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 3, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border, marginTop: index === 0 ? 6 : 0, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {entry.conflict ? <AlertTriangle size={14} color={colors.destructive} /> : null}
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' }}>{task.title}</Text>
                  <Text style={{ color: colors.mutedText, fontSize: 12 }}>{STATUS_LABELS[task.status]}</Text>
                </View>
                <Text style={{ color: colors.secondaryText, fontSize: 12 }}>{entry.start === entry.end ? formatCalendarDate(entry.start) : `${formatCalendarDate(entry.start)} to ${formatCalendarDate(entry.end)}`}</Text>
                {notes.map((reason) => <Text key={reason.kind} style={{ color: reason.kind === 'conflict' || reason.kind === 'overdue' ? colors.destructiveText : colors.mutedText, fontSize: 12, lineHeight: 17 }}>{scheduleReasonText(reason, titleOf)}</Text>)}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {undated.length > 0 ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <Text accessibilityRole="header" style={{ paddingHorizontal: 14, paddingTop: 12, color: colors.text, fontSize: 15, fontWeight: '800' }}>Not placed: no dates ({undated.length})</Text>
          {undated.map((task, index) => {
            const waiting = plan.tasks[task.id].reasons.find((reason) => reason.kind === 'waiting');
            return (
              <Pressable key={task.id} onPress={() => onSelectTask(task)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`${task.title}. No dates. ${waiting ? scheduleReasonText(waiting, titleOf) : ''} Opens the task.`} style={{ minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border, marginTop: index === 0 ? 6 : 0, overflow: 'hidden' }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{task.title}</Text>
                {waiting ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>{scheduleReasonText(waiting, titleOf)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
