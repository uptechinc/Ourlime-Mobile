import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { ChevronDown, ChevronUp, ClipboardList, Plus, Search, SlidersHorizontal, X } from 'lucide-react-native';
import FilterSheet, { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import ProjectTaskCard from '@/components/projectManagement/ProjectTaskCard';
import TaskMoveSheet from '@/components/projectManagement/TaskMoveSheet';
import {
  PROJECT_GUTTER, PROJECT_RIPPLE, ProjectButton, ProjectChip, ProjectEmptyState, ProjectRefScrollView, ProjectSegmented,
} from '@/components/projectManagement/ProjectUiParts';
import { STATUS_LABELS } from '@/components/projectManagement/projectFormat';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { DEFAULT_TASK_FILTERS, TASK_STATUS_ORDER, projectInsightRules, type TaskFilters, type TaskQuickFilter } from '@/lib/services/ProjectInsightRules';
import type { Milestone, Priority, Status, Task, TeamMember } from '@/lib/types/project';

export type TaskView = 'list' | 'board';

type ProjectTasksPanelProps = {
  tasks: Task[];
  milestones: Milestone[];
  /** Accepted members (the owner included). */
  acceptedMembers: TeamMember[];
  currentUserId: string;
  canWrite: boolean;
  busyTaskId: string | null;
  activeTimerTaskId: string | null;
  view: TaskView;
  onChangeView: (view: TaskView) => void;
  filters: TaskFilters;
  onChangeFilters: (filters: TaskFilters) => void;
  onOpenTask: (task: Task) => void;
  onMoveTask: (task: Task, status: Status) => void;
  onCreateTask: (status?: Status) => void;
};

const QUICK_FILTERS: { value: TaskQuickFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'mine', label: 'Mine' }, { value: 'overdue', label: 'Overdue' },
  { value: 'blocked', label: 'Waiting' }, { value: 'unassigned', label: 'Unassigned' },
];
const PRIORITY_FILTERS: { value: Priority | 'all'; label: string }[] = [
  { value: 'all', label: 'Any priority' }, { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
];
const NO_MILESTONE = 'none';
const COLUMN_GAP = 12;

/** Tasks as a list grouped by status, or as a board of swipeable columns. Moving uses a "Move to…" sheet, not drag. */
export default function ProjectTasksPanel({ tasks, milestones, acceptedMembers, currentUserId, canWrite, busyTaskId, activeTimerTaskId, view, onChangeView, filters, onChangeFilters, onOpenTask, onMoveTask, onCreateTask }: ProjectTasksPanelProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [moveTarget, setMoveTarget] = useState<Task | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [boardColumn, setBoardColumn] = useState<Status>('todo');
  const boardRef = useRef<ScrollView | null>(null);
  const today = projectInsightRules.today();

  const memberById = useMemo(() => new Map(acceptedMembers.map((member) => [member.id, member])), [acceptedMembers]);
  const milestoneNames = useMemo(() => new Map(milestones.map((milestone) => [milestone.id, milestone.name])), [milestones]);
  const tasksById = useMemo(() => projectInsightRules.indexById(tasks), [tasks]);
  const visibleTasks = useMemo(() => projectInsightRules.filterTasks(tasks, filters, currentUserId, today), [currentUserId, filters, tasks, today]);
  const grouped = useMemo(() => projectInsightRules.groupByStatus(visibleTasks), [visibleTasks]);
  const quickCounts = useMemo(() => Object.fromEntries(QUICK_FILTERS.map((quick) => [quick.value, projectInsightRules.filterTasks(tasks, { ...filters, quick: quick.value }, currentUserId, today).length])) as { [key in TaskQuickFilter]: number }, [currentUserId, filters, tasks, today]);
  const advancedCount = (filters.priority !== 'all' ? 1 : 0) + (filters.assigneeId !== 'all' ? 1 : 0) + (filters.milestoneId !== 'all' ? 1 : 0);
  const hasAnyFilter = advancedCount > 0 || filters.quick !== 'all' || Boolean(filters.search.trim());

  const columnWidth = Math.min(Math.max(240, width - PROJECT_GUTTER * 2 - 28), 380);
  const viewport = width - PROJECT_GUTTER * 2;

  const filterGroups: FilterGroup[] = [
    { key: 'priority', label: 'Priority', options: PRIORITY_FILTERS, value: filters.priority, defaultValue: 'all' },
    { key: 'assignee', label: 'Assigned to', options: [{ value: 'all', label: 'Anyone' }, ...acceptedMembers.map((member) => ({ value: member.id, label: member.id === currentUserId ? 'Me' : member.name }))], value: filters.assigneeId, defaultValue: 'all' },
    ...(milestones.length > 0 ? [{ key: 'milestone', label: 'Milestone', options: [{ value: 'all', label: 'Any milestone' }, { value: NO_MILESTONE, label: 'No milestone' }, ...milestones.map((milestone) => ({ value: milestone.id, label: milestone.name }))], value: filters.milestoneId === '' ? NO_MILESTONE : filters.milestoneId, defaultValue: 'all' }] : []),
  ];

  const handleApplyFilters = (values: FilterValues): void => {
    const priority = PRIORITY_FILTERS.find((option) => option.value === readSingleFilter(values, 'priority'))?.value ?? 'all';
    const assigneeId = readSingleFilter(values, 'assignee') ?? 'all';
    const milestoneValue = readSingleFilter(values, 'milestone') ?? 'all';
    onChangeFilters({ ...filters, priority, assigneeId, milestoneId: milestoneValue === NO_MILESTONE ? '' : milestoneValue });
  };

  const handleToggleDone = (task: Task): void => onMoveTask(task, task.status === 'done' ? 'todo' : 'done');

  const scrollToColumn = (status: Status): void => {
    setBoardColumn(status);
    boardRef.current?.scrollTo({ x: TASK_STATUS_ORDER.indexOf(status) * (columnWidth + COLUMN_GAP), animated: true });
  };

  const handleBoardScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (columnWidth + COLUMN_GAP));
    const status = TASK_STATUS_ORDER[Math.max(0, Math.min(TASK_STATUS_ORDER.length - 1, index))];
    if (status !== boardColumn) setBoardColumn(status);
  };

  const renderCard = (task: Task, variant: 'list' | 'board') => (
    <ProjectTaskCard
      key={task.id}
      task={task}
      today={today}
      memberById={memberById}
      milestoneName={task.milestoneId ? milestoneNames.get(task.milestoneId) : undefined}
      blockedByCount={projectInsightRules.blockers(task, tasksById).length}
      canWrite={canWrite}
      isBusy={busyTaskId === task.id}
      isTimerRunning={activeTimerTaskId === task.id}
      variant={variant}
      onOpen={onOpenTask}
      onMove={setMoveTarget}
      onToggleDone={handleToggleDone}
    />
  );

  const addButton = (status: Status) => canWrite ? (
    <Pressable onPress={() => onCreateTask(status)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`Add a task to ${STATUS_LABELS[status]}`} style={styles.addRow}>
      <Plus size={16} color={colors.accentText} /><Text style={styles.addText}>Add task</Text>
    </Pressable>
  ) : null;

  if (tasks.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <ProjectEmptyState
          icon={<ClipboardList size={36} color={colors.accentText} />}
          title="No tasks yet"
          hint={canWrite ? 'Break the work into steps. Each task can have an owner, a due date and a checklist.' : 'Tasks will appear here when the team adds them.'}
          actionLabel={canWrite ? 'Add the first task' : undefined}
          onAction={canWrite ? () => onCreateTask() : undefined}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.mutedText} />
          <TextInput value={filters.search} onChangeText={(search) => onChangeFilters({ ...filters, search })} placeholder="Search tasks" placeholderTextColor={colors.mutedText} accessibilityLabel="Search tasks" returnKeyType="search" style={styles.searchInput} />
          {filters.search ? <Pressable onPress={() => onChangeFilters({ ...filters, search: '' })} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} style={styles.iconSlot}><X size={18} color={colors.mutedText} /></Pressable> : null}
        </View>
        <Pressable onPress={() => setFiltersOpen(true)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={advancedCount > 0 ? `More filters, ${advancedCount} on` : 'More filters'} style={[styles.filterButton, advancedCount > 0 && styles.filterButtonOn]}>
          <SlidersHorizontal size={18} color={advancedCount > 0 ? '#ffffff' : colors.icon} />
          {advancedCount > 0 ? <Text style={styles.filterBadge}>{advancedCount}</Text> : null}
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
        {QUICK_FILTERS.map((quick) => <ProjectChip key={quick.value} label={quick.label} count={quickCounts[quick.value]} isSelected={filters.quick === quick.value} onPress={() => onChangeFilters({ ...filters, quick: quick.value })} accessibilityLabel={`${quick.label} tasks, ${quickCounts[quick.value]}`} />)}
      </ScrollView>
      <View style={styles.viewRow}>
        <View style={{ width: 170 }}>
          <ProjectSegmented accessibilityLabel="Task view" value={view} onChange={onChangeView} options={[{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }]} />
        </View>
        {canWrite ? <ProjectButton label="New task" icon={<Plus size={18} color="#ffffff" />} isCompact onPress={() => onCreateTask(view === 'board' ? boardColumn : undefined)} style={{ flex: 1 }} /> : <View style={{ flex: 1 }} />}
      </View>

      {visibleTasks.length === 0 ? (
        <View style={styles.emptyCard}>
          <ProjectEmptyState icon={<Search size={30} color={colors.mutedText} />} title="No tasks match" hint="Try another filter or search." secondaryLabel={hasAnyFilter ? 'Clear filters' : undefined} onSecondary={hasAnyFilter ? () => onChangeFilters(DEFAULT_TASK_FILTERS) : undefined} />
        </View>
      ) : view === 'list' ? (
        <View style={{ gap: 18 }}>
          {TASK_STATUS_ORDER.map((status) => {
            const items = grouped[status];
            const isDoneGroup = status === 'done';
            if (items.length === 0 && (isDoneGroup || filters.quick !== 'all')) return null;
            const collapsed = isDoneGroup && !showDone && filters.quick === 'all' && items.length > 0;
            return (
              <View key={status} style={{ gap: 8 }}>
                <View style={styles.groupHeader}>
                  <Text accessibilityRole="header" style={styles.groupTitle}>{STATUS_LABELS[status]}</Text>
                  <Text style={styles.groupCount}>{items.length}</Text>
                  <View style={{ flex: 1 }} />
                  {isDoneGroup && filters.quick === 'all' ? (
                    <Pressable onPress={() => setShowDone((current) => !current)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={showDone ? 'Hide done tasks' : 'Show done tasks'} style={styles.groupToggle}>
                      <Text style={styles.addText}>{showDone ? 'Hide' : 'Show'}</Text>
                      {showDone ? <ChevronUp size={16} color={colors.accentText} /> : <ChevronDown size={16} color={colors.accentText} />}
                    </Pressable>
                  ) : null}
                </View>
                {collapsed ? null : items.length === 0 ? <Text style={styles.groupEmpty}>Nothing here.</Text> : items.map((task) => renderCard(task, 'list'))}
                {!isDoneGroup ? addButton(status) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <ProjectSegmented accessibilityLabel="Board column" value={boardColumn} onChange={scrollToColumn} options={TASK_STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status], count: grouped[status].length }))} />
          <ProjectRefScrollView
            scrollRef={boardRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={columnWidth + COLUMN_GAP}
            decelerationRate="fast"
            disableIntervalMomentum
            onMomentumScrollEnd={handleBoardScrollEnd}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: COLUMN_GAP, paddingRight: Math.max(0, viewport - columnWidth) }}
          >
            {TASK_STATUS_ORDER.map((status) => (
              <View key={status} accessibilityLabel={`${STATUS_LABELS[status]} column, ${grouped[status].length} tasks`} style={[styles.column, { width: columnWidth }]}>
                <View style={styles.groupHeader}>
                  <Text accessibilityRole="header" style={styles.groupTitle}>{STATUS_LABELS[status]}</Text>
                  <Text style={styles.groupCount}>{grouped[status].length}</Text>
                </View>
                {grouped[status].length === 0 ? <Text style={styles.groupEmpty}>No tasks in this column.</Text> : grouped[status].map((task) => renderCard(task, 'board'))}
                {addButton(status)}
              </View>
            ))}
          </ProjectRefScrollView>
          <Text style={styles.hint}>Swipe to see the other columns. Use the arrows on a card to move it.</Text>
        </View>
      )}

      <TaskMoveSheet task={moveTarget} onClose={() => setMoveTarget(null)} onMove={onMoveTask} onOpen={onOpenTask} />
      <FilterSheet visible={filtersOpen} title="Filter tasks" groups={filterGroups} applyLabel="Show tasks" onApply={handleApplyFilters} onClose={() => setFiltersOpen(false)} />
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  emptyCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, minHeight: 48, color: colors.text, fontSize: 15 },
  iconSlot: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filterButton: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  filterButtonOn: { backgroundColor: '#047857', borderColor: '#047857' },
  filterBadge: { position: 'absolute', top: 4, right: 6, color: '#ffffff', fontSize: 10, fontWeight: '800' },
  chipRow: { gap: 8, paddingVertical: 2 },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  groupTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  groupCount: { color: colors.mutedText, fontSize: 13, fontWeight: '700', backgroundColor: colors.control, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' },
  groupToggle: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingHorizontal: 8, borderRadius: 10, overflow: 'hidden' },
  groupEmpty: { color: colors.mutedText, fontSize: 13, paddingVertical: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, overflow: 'hidden' },
  addText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  column: { padding: 10, gap: 8, borderRadius: 16, backgroundColor: colors.control },
  hint: { color: colors.mutedText, fontSize: 12, textAlign: 'center' },
});
