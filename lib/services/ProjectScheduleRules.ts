/**
 * Task dependencies and dates (eProjects Phase 3). A task's `dependencies` lists the tasks it waits on (finish to
 * start). The server keeps a small derived `schedule` on each task so every client can explain blocked work without
 * loading the whole graph:
 * - waitingOn: dependencies that are not done yet (an archived or deleted dependency no longer blocks);
 * - predecessorDue: each open or done dependency's due date, by task ID (only those that have one);
 * - earliestStart: the latest of those due dates, the first day this task can reasonably start;
 * - conflict: the task is dated to start (or finish) before earliestStart.
 * The server recalculates a task when its own dates, status or dependencies change, and the bounded set of tasks
 * that depend on it (at most DEPENDENT_RECALC_LIMIT) when its status, due date or availability changes.
 * plan() is the timeline's view of the same data: it explains dates instead of pretending to know them.
 * A copy of the website's functions/src/ProjectScheduleRules.ts, which the server uses to store each task's schedule;
 * keep the two in step.
 */
export type TaskSchedule = { waitingOn: string[]; predecessorDue: { [taskId: string]: string }; earliestStart: string | null; conflict: boolean };
export type SchedulePredecessor = { id: string; status: string; dueDate: string | null; available: boolean };
export type ScheduleTask = { id: string; status: string; startDate: string | null; dueDate: string | null; dependencies: string[]; archived: boolean };
export type ScheduleMilestone = { id: string; dueDate: string | null; completed: boolean };
export type ScheduleReason =
  | { kind: 'undated' }
  | { kind: 'waiting'; taskIds: string[] }
  | { kind: 'unknown_dependency_date'; taskIds: string[] }
  | { kind: 'missing_dependency'; taskIds: string[] }
  | { kind: 'conflict'; taskId: string; date: string }
  | { kind: 'critical' }
  | { kind: 'overdue'; date: string };
export type TaskPlan = {
  id: string;
  start: string | null;
  end: string | null;
  earliestStart: string | null;
  drivingTaskId: string | null;
  waitingOn: string[];
  conflict: boolean;
  critical: boolean;
  reasons: ScheduleReason[];
};
export type ProjectPlan = { tasks: { [taskId: string]: TaskPlan }; criticalChain: string[]; latestFinish: string | null; undatedCount: number };

/** Most tasks that depend on one task which a single change recalculates; the rest catch up on their next change. */
export const DEPENDENT_RECALC_LIMIT = 50;
/** Most dependencies one task may have (the task field validator enforces the same). */
export const DEPENDENCY_LIMIT = 50;

const day = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  return value.slice(0, 10);
};
const latest = (dates: readonly string[]): string | null => dates.reduce<string | null>((max, date) => (max === null || date > max ? date : max), null);

export class ProjectScheduleRules {
  public day(value: unknown): string | null {
    return day(value);
  }

  /** A task's schedule from its own dates and its dependencies as they are now. */
  public derive(task: { startDate?: unknown; dueDate?: unknown }, predecessors: readonly SchedulePredecessor[]): TaskSchedule {
    const waitingOn: string[] = [];
    const predecessorDue: { [taskId: string]: string } = {};
    for (const predecessor of predecessors.slice(0, DEPENDENCY_LIMIT)) {
      if (!predecessor.available) continue;
      if (predecessor.status !== 'done') waitingOn.push(predecessor.id);
      const due = day(predecessor.dueDate);
      if (due) predecessorDue[predecessor.id] = due;
    }
    return this.finish(task, waitingOn, predecessorDue);
  }

  /** The schedule of a dependent after one of its dependencies changed: only that dependency's entries move. */
  public applyPredecessor(stored: unknown, task: { startDate?: unknown; dueDate?: unknown }, predecessor: SchedulePredecessor): TaskSchedule {
    const current = this.read(stored);
    const waitingOn = current.waitingOn.filter((id) => id !== predecessor.id);
    const predecessorDue = { ...current.predecessorDue };
    delete predecessorDue[predecessor.id];
    if (predecessor.available) {
      if (predecessor.status !== 'done') waitingOn.push(predecessor.id);
      const due = day(predecessor.dueDate);
      if (due) predecessorDue[predecessor.id] = due;
    }
    return this.finish(task, waitingOn, predecessorDue);
  }

  /** A stored schedule, tolerantly (absent or malformed reads as empty). */
  public read(stored: unknown): TaskSchedule {
    const source = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as { [key: string]: unknown } : {};
    const waitingOn = Array.isArray(source.waitingOn) ? source.waitingOn.filter((id): id is string => typeof id === 'string').slice(0, DEPENDENCY_LIMIT) : [];
    const predecessorDue: { [taskId: string]: string } = {};
    if (source.predecessorDue && typeof source.predecessorDue === 'object' && !Array.isArray(source.predecessorDue)) {
      for (const [id, value] of Object.entries(source.predecessorDue as { [key: string]: unknown })) {
        const due = day(value);
        if (due) predecessorDue[id] = due;
      }
    }
    return { waitingOn, predecessorDue, earliestStart: typeof source.earliestStart === 'string' ? source.earliestStart : null, conflict: source.conflict === true };
  }

  /** True when two schedules store the same values (so an unchanged dependent is not rewritten). */
  public same(first: TaskSchedule, second: TaskSchedule): boolean {
    const key = (schedule: TaskSchedule) => JSON.stringify([[...schedule.waitingOn].sort(), Object.keys(schedule.predecessorDue).sort().map((id) => [id, schedule.predecessorDue[id]]), schedule.earliestStart, schedule.conflict]);
    return key(first) === key(second);
  }

  /**
   * The timeline's reading of the project: for every live task its placed dates (or none), what it waits on, which
   * dependency sets its earliest start, conflicts, and the critical chain: the run of driving dependencies behind the
   * open task that finishes last. Bounded by the tasks passed in (both clients load at most a project's live tasks).
   */
  public plan(tasks: readonly ScheduleTask[], milestones: readonly ScheduleMilestone[] = [], today: string = new Date().toISOString().slice(0, 10)): ProjectPlan {
    const byId = new Map(tasks.filter((task) => !task.archived).map((task) => [task.id, task]));
    const plans: { [taskId: string]: TaskPlan } = {};
    let undatedCount = 0;
    for (const task of byId.values()) {
      const start = day(task.startDate) ?? day(task.dueDate);
      const end = day(task.dueDate) ?? day(task.startDate);
      const reasons: ScheduleReason[] = [];
      const waitingOn: string[] = [];
      const unknown: string[] = [];
      const missing: string[] = [];
      let drivingTaskId: string | null = null;
      let earliestStart: string | null = null;
      for (const dependencyId of task.dependencies.slice(0, DEPENDENCY_LIMIT)) {
        const dependency = byId.get(dependencyId);
        if (!dependency) { missing.push(dependencyId); continue; }
        if (dependency.status !== 'done') waitingOn.push(dependencyId);
        const due = day(dependency.dueDate);
        if (!due) { if (dependency.status !== 'done') unknown.push(dependencyId); continue; }
        if (earliestStart === null || due > earliestStart) { earliestStart = due; drivingTaskId = dependencyId; }
      }
      const conflict = earliestStart !== null && start !== null && (start < earliestStart || (end !== null && end < earliestStart));
      if (!start) { reasons.push({ kind: 'undated' }); undatedCount += 1; }
      if (waitingOn.length) reasons.push({ kind: 'waiting', taskIds: waitingOn });
      if (unknown.length) reasons.push({ kind: 'unknown_dependency_date', taskIds: unknown });
      if (missing.length) reasons.push({ kind: 'missing_dependency', taskIds: missing });
      if (conflict && drivingTaskId && earliestStart) reasons.push({ kind: 'conflict', taskId: drivingTaskId, date: earliestStart });
      if (task.status !== 'done' && end && end < today) reasons.push({ kind: 'overdue', date: end });
      plans[task.id] = { id: task.id, start, end, earliestStart, drivingTaskId, waitingOn, conflict, critical: false, reasons };
    }
    const openEnds = [...byId.values()].filter((task) => task.status !== 'done' && plans[task.id].end).map((task) => ({ id: task.id, end: plans[task.id].end as string }));
    const milestoneEnds = milestones.filter((milestone) => !milestone.completed).map((milestone) => day(milestone.dueDate)).filter((date): date is string => Boolean(date));
    const latestFinish = latest([...openEnds.map((entry) => entry.end), ...milestoneEnds]);
    const criticalChain: string[] = [];
    const last = openEnds.reduce<{ id: string; end: string } | null>((best, entry) => (best === null || entry.end > best.end ? entry : best), null);
    let cursor = last?.id ?? null;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor) && criticalChain.length < byId.size) {
      seen.add(cursor);
      criticalChain.unshift(cursor);
      plans[cursor].critical = true;
      plans[cursor].reasons.push({ kind: 'critical' });
      cursor = plans[cursor].drivingTaskId;
    }
    return { tasks: plans, criticalChain, latestFinish, undatedCount };
  }

  private finish(task: { startDate?: unknown; dueDate?: unknown }, waitingOn: string[], predecessorDue: { [taskId: string]: string }): TaskSchedule {
    const earliestStart = latest(Object.values(predecessorDue));
    const start = day(task.startDate) ?? day(task.dueDate);
    const end = day(task.dueDate);
    const conflict = earliestStart !== null && ((start !== null && start < earliestStart) || (end !== null && end < earliestStart));
    return { waitingOn: [...new Set(waitingOn)].slice(0, DEPENDENCY_LIMIT), predecessorDue, earliestStart, conflict };
  }
}

export const projectScheduleRules = new ProjectScheduleRules();
