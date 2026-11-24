import type { Milestone, Priority, Status, Task } from '@/lib/types/project';

/**
 * Read-only conclusions the eProjects screens draw from loaded tasks and milestones: what is overdue, what is waiting
 * on other work, the next milestone, suggested next steps and the task filters. Pure (no Firebase), so it is unit tested.
 * Dates are calendar strings ('YYYY-MM-DD'), compared as text and never shifted through UTC.
 */
export type TaskQuickFilter = 'all' | 'mine' | 'overdue' | 'blocked' | 'unassigned';

export type TaskFilters = {
  search: string;
  quick: TaskQuickFilter;
  priority: Priority | 'all';
  assigneeId: string;
  milestoneId: string;
};

export const DEFAULT_TASK_FILTERS: TaskFilters = { search: '', quick: 'all', priority: 'all', assigneeId: 'all', milestoneId: 'all' };

/** A task that needs someone's attention: past its due date, waiting on unfinished tasks, or both. */
export type AttentionItem = { task: Task; isOverdue: boolean; blockedBy: Task[] };

export type ProjectNextActionId =
  | 'add_first_task' | 'invite_member' | 'add_milestone' | 'assign_tasks' | 'review_overdue' | 'my_tasks' | 'add_purpose' | 'wrap_up';

export type ProjectNextAction = { id: ProjectNextActionId; title: string; detail: string };

/** The numbers a project card on the projects list shows. */
export type ProjectPulse = {
  openTasks: number;
  overdueTasks: number;
  myOpenTasks: number;
  blockedTasks: number;
  nextMilestone: Pick<Milestone, 'id' | 'name' | 'dueDate'> | null;
};

export type DueTone = 'danger' | 'warning' | 'neutral' | 'success';
export type DueLabel = { label: string; tone: DueTone };

export type NextActionInput = {
  tasks: Task[];
  milestones: Milestone[];
  /** Accepted members, the owner included. */
  memberCount: number;
  canManage: boolean;
  canWrite: boolean;
  hasPurpose: boolean;
  userId: string;
  today: string;
};

export const TASK_STATUS_ORDER: readonly Status[] = ['todo', 'in-progress', 'done'];
const PRIORITY_RANK: { [priority in Priority]: number } = { urgent: 0, high: 1, medium: 2, low: 3 };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MAX_NEXT_ACTIONS = 3;
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

export class ProjectInsightRules {
  /** Today's local calendar date. */
  public today(now: Date = new Date()): string {
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  /** A calendar date `days` after `from` ('YYYY-MM-DD'). */
  public addDays(from: string, days: number): string {
    const day = this.dayNumber(from);
    if (day === null) return '';
    const date = new Date((day + days) * 86400000);
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  public isOpen(task: Task): boolean {
    return task.status !== 'done';
  }

  public isOverdue(task: Task, today: string): boolean {
    const due = this.calendarDay(task.dueDate);
    return this.isOpen(task) && due !== '' && due < today;
  }

  public isAssignedTo(task: Task, userId: string): boolean {
    return Boolean(userId) && (task.assignedToAll === true || task.assignee === userId || (task.assignees ?? []).includes(userId));
  }

  public isUnassigned(task: Task): boolean {
    return task.assignedToAll !== true && !task.assignee && (task.assignees ?? []).length === 0;
  }

  /** The unfinished tasks this one depends on (dependencies that were deleted or archived are ignored). */
  public blockers(task: Task, tasksById: ReadonlyMap<string, Task>): Task[] {
    if (!this.isOpen(task)) return [];
    return (task.dependencies ?? []).flatMap((dependencyId) => {
      const dependency = tasksById.get(dependencyId);
      return dependency && dependency.id !== task.id && this.isOpen(dependency) ? [dependency] : [];
    });
  }

  public indexById(tasks: readonly Task[]): Map<string, Task> {
    return new Map(tasks.map((task) => [task.id, task]));
  }

  /** Overdue tasks first (oldest due date first), then tasks waiting on unfinished work. */
  public attention(tasks: readonly Task[], today: string): AttentionItem[] {
    const tasksById = this.indexById(tasks);
    return tasks
      .map((task): AttentionItem => ({ task, isOverdue: this.isOverdue(task, today), blockedBy: this.blockers(task, tasksById) }))
      .filter((item) => item.isOverdue || item.blockedBy.length > 0)
      .sort((first, second) => {
        if (first.isOverdue !== second.isOverdue) return first.isOverdue ? -1 : 1;
        const byDue = this.compareDue(first.task, second.task);
        return byDue !== 0 ? byDue : first.task.title.localeCompare(second.task.title);
      });
  }

  /** The earliest unfinished milestone with a date (overdue ones included), else the first undated one. */
  public nextMilestone(milestones: readonly Milestone[]): Milestone | null {
    const open = milestones.filter((milestone) => !milestone.completed);
    const dated = open.filter((milestone) => this.calendarDay(milestone.dueDate) !== '')
      .sort((first, second) => this.calendarDay(first.dueDate).localeCompare(this.calendarDay(second.dueDate)) || first.name.localeCompare(second.name));
    return dated[0] ?? open[0] ?? null;
  }

  /** Unfinished milestones by date (undated last), then completed ones. */
  public sortMilestones(milestones: readonly Milestone[]): Milestone[] {
    return [...milestones].sort((first, second) => {
      if (first.completed !== second.completed) return first.completed ? 1 : -1;
      const firstDue = this.calendarDay(first.dueDate);
      const secondDue = this.calendarDay(second.dueDate);
      if (firstDue && secondDue && firstDue !== secondDue) return firstDue.localeCompare(secondDue);
      if (firstDue !== secondDue) return firstDue ? -1 : 1;
      return first.name.localeCompare(second.name);
    });
  }

  public milestoneProgress(milestoneId: string, tasks: readonly Task[]): { done: number; total: number; percent: number } {
    const linked = tasks.filter((task) => task.milestoneId === milestoneId);
    const done = linked.filter((task) => task.status === 'done').length;
    return { done, total: linked.length, percent: linked.length > 0 ? Math.round((done / linked.length) * 100) : 0 };
  }

  public pulse(tasks: readonly Task[], milestones: readonly Milestone[], userId: string, today: string): ProjectPulse {
    const open = tasks.filter((task) => this.isOpen(task));
    const tasksById = this.indexById(tasks);
    const next = this.nextMilestone(milestones);
    return {
      openTasks: open.length,
      overdueTasks: open.filter((task) => this.isOverdue(task, today)).length,
      myOpenTasks: open.filter((task) => this.isAssignedTo(task, userId)).length,
      blockedTasks: open.filter((task) => this.blockers(task, tasksById).length > 0).length,
      nextMilestone: next ? { id: next.id, name: next.name, dueDate: next.dueDate } : null,
    };
  }

  /** Up to three suggested steps, most useful first. Only steps the viewer is allowed to take are offered. */
  public nextActions(input: NextActionInput): ProjectNextAction[] {
    const { tasks, milestones, memberCount, canManage, canWrite, hasPurpose, userId, today } = input;
    const actions: ProjectNextAction[] = [];
    const open = tasks.filter((task) => this.isOpen(task));
    const overdue = open.filter((task) => this.isOverdue(task, today));
    const unassigned = open.filter((task) => this.isUnassigned(task));
    const mine = open.filter((task) => this.isAssignedTo(task, userId));
    if (canWrite && tasks.length === 0) actions.push({ id: 'add_first_task', title: 'Add your first task', detail: 'Break the work into steps someone can pick up.' });
    if (overdue.length > 0) actions.push({ id: 'review_overdue', title: `Review ${plural(overdue.length, 'overdue task', 'overdue tasks')}`, detail: 'Finish them, move the date or hand them over.' });
    if (canManage && !hasPurpose) actions.push({ id: 'add_purpose', title: 'Write down the purpose', detail: 'One or two lines so everyone knows what success looks like.' });
    if (canManage && memberCount <= 1) actions.push({ id: 'invite_member', title: 'Invite someone to help', detail: 'Projects move faster with a second pair of hands.' });
    if (canWrite && milestones.length === 0 && tasks.length > 0) actions.push({ id: 'add_milestone', title: 'Set a milestone', detail: 'Mark the next checkpoint and the date you are aiming for.' });
    if (canWrite && unassigned.length > 0) actions.push({ id: 'assign_tasks', title: `Assign ${plural(unassigned.length, 'task', 'tasks')}`, detail: 'Nobody is on these yet.' });
    if (mine.length > 0) actions.push({ id: 'my_tasks', title: `You have ${plural(mine.length, 'open task', 'open tasks')}`, detail: 'See what is on your plate.' });
    if (canManage && tasks.length > 0 && open.length === 0) actions.push({ id: 'wrap_up', title: 'Every task is done', detail: 'Mark the project as completed, with a short note on the outcome.' });
    return actions.slice(0, MAX_NEXT_ACTIONS);
  }

  public filterTasks(tasks: readonly Task[], filters: TaskFilters, userId: string, today: string): Task[] {
    const term = filters.search.trim().toLowerCase();
    const tasksById = this.indexById(tasks);
    return tasks.filter((task) => {
      if (term && !`${task.title} ${task.description} ${task.tags.join(' ')}`.toLowerCase().includes(term)) return false;
      if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
      if (filters.assigneeId !== 'all' && !this.isAssignedTo(task, filters.assigneeId)) return false;
      if (filters.milestoneId !== 'all' && (task.milestoneId ?? '') !== filters.milestoneId) return false;
      if (filters.quick === 'mine') return this.isAssignedTo(task, userId);
      if (filters.quick === 'overdue') return this.isOverdue(task, today);
      if (filters.quick === 'blocked') return this.blockers(task, tasksById).length > 0;
      if (filters.quick === 'unassigned') return this.isOpen(task) && this.isUnassigned(task);
      return true;
    });
  }

  /** Overdue and soonest-due first, then by priority, then title. */
  public sortTasks(tasks: readonly Task[]): Task[] {
    return [...tasks].sort((first, second) => this.compareDue(first, second)
      || PRIORITY_RANK[first.priority] - PRIORITY_RANK[second.priority]
      || first.title.localeCompare(second.title));
  }

  public groupByStatus(tasks: readonly Task[]): { [status in Status]: Task[] } {
    const sorted = this.sortTasks(tasks);
    return {
      todo: sorted.filter((task) => task.status === 'todo'),
      'in-progress': sorted.filter((task) => task.status === 'in-progress'),
      done: sorted.filter((task) => task.status === 'done'),
    };
  }

  /** "Overdue by 2 days", "Due today", "Due tomorrow", "Due in 5 days" or "Due Dec 3"; null without a date. */
  public dueLabel(dueDate: string | null | undefined, today: string, isDone = false): DueLabel | null {
    const due = this.calendarDay(dueDate);
    const dueDay = this.dayNumber(due);
    const todayDay = this.dayNumber(today);
    if (dueDay === null || todayDay === null) return null;
    const days = dueDay - todayDay;
    const date = this.shortDate(due);
    if (isDone) return { label: `Due ${date}`, tone: 'neutral' };
    if (days < 0) return { label: `Overdue by ${plural(-days, 'day', 'days')}`, tone: 'danger' };
    if (days === 0) return { label: 'Due today', tone: 'warning' };
    if (days === 1) return { label: 'Due tomorrow', tone: 'warning' };
    if (days <= 6) return { label: `Due in ${days} days`, tone: 'neutral' };
    return { label: `Due ${date}`, tone: 'neutral' };
  }

  /** "Dec 3" this year, "Dec 3, 2027" otherwise. */
  public shortDate(value: string | null | undefined, today: string = this.today()): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
    if (!match) return '';
    const label = `${MONTH_NAMES[Number(match[2]) - 1] ?? match[2]} ${Number(match[3])}`;
    return match[1] === today.slice(0, 4) ? label : `${label}, ${match[1]}`;
  }

  private compareDue(first: Task, second: Task): number {
    const firstDue = this.calendarDay(first.dueDate);
    const secondDue = this.calendarDay(second.dueDate);
    if (firstDue === secondDue) return 0;
    if (!firstDue) return 1;
    if (!secondDue) return -1;
    return firstDue.localeCompare(secondDue);
  }

  private calendarDay(value: string | null | undefined): string {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? '');
    return match ? match[1] : '';
  }

  private dayNumber(value: string): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return null;
    return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
  }
}

export const projectInsightRules = new ProjectInsightRules();
