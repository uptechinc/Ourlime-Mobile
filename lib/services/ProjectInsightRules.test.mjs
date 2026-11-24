import { describe, expect, test } from 'bun:test';

const { projectInsightRules, DEFAULT_TASK_FILTERS } = await import('./ProjectInsightRules.ts');

const TODAY = '2026-11-24';
let sequence = 0;
const task = (fields = {}) => ({
  id: fields.id ?? `task${++sequence}`, title: fields.title ?? `Task ${sequence}`, description: '', status: 'todo', priority: 'medium',
  assignee: '', assignees: [], assignedToAll: false, createdBy: 'owner', dueDate: '', milestoneId: '', dependencies: [],
  createdAt: '', updatedAt: '', subTasks: [], comments: [], attachments: [], timeEntries: [], estimatedTime: 0, tags: [], progress: 0,
  ...fields,
});
const milestone = (fields = {}) => ({ id: fields.id ?? `m${++sequence}`, name: fields.name ?? 'Milestone', dueDate: '', color: 'bg-blue-500', completed: false, createdBy: 'owner', ...fields });

describe('ProjectInsightRules dates', () => {
  test('addDays crosses month and year ends without time zone drift', () => {
    expect(projectInsightRules.addDays('2026-11-24', 7)).toBe('2026-12-01');
    expect(projectInsightRules.addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(projectInsightRules.addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(projectInsightRules.addDays('not a date', 1)).toBe('');
  });

  test('dueLabel speaks in days and flags overdue work', () => {
    expect(projectInsightRules.dueLabel('2026-11-22', TODAY)).toEqual({ label: 'Overdue by 2 days', tone: 'danger' });
    expect(projectInsightRules.dueLabel('2026-11-23', TODAY)).toEqual({ label: 'Overdue by 1 day', tone: 'danger' });
    expect(projectInsightRules.dueLabel('2026-11-24', TODAY)).toEqual({ label: 'Due today', tone: 'warning' });
    expect(projectInsightRules.dueLabel('2026-11-25', TODAY)).toEqual({ label: 'Due tomorrow', tone: 'warning' });
    expect(projectInsightRules.dueLabel('2026-11-28', TODAY)).toEqual({ label: 'Due in 4 days', tone: 'neutral' });
    expect(projectInsightRules.dueLabel('2026-12-24', TODAY).label).toBe('Due Dec 24');
    expect(projectInsightRules.dueLabel('2027-01-05', TODAY).label).toBe('Due Jan 5, 2027');
    expect(projectInsightRules.dueLabel('', TODAY)).toBeNull();
    expect(projectInsightRules.dueLabel('2026-11-01', TODAY, true)).toEqual({ label: 'Due Nov 1', tone: 'neutral' });
  });

  test('today is the local calendar date', () => {
    expect(projectInsightRules.today(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('ProjectInsightRules attention and blockers', () => {
  test('a task waits only on unfinished dependencies that still exist', () => {
    const design = task({ id: 'design', status: 'in-progress' });
    const copy = task({ id: 'copy', status: 'done' });
    const build = task({ id: 'build', dependencies: ['design', 'copy', 'deleted', 'build'] });
    const byId = projectInsightRules.indexById([design, copy, build]);
    expect(projectInsightRules.blockers(build, byId).map((entry) => entry.id)).toEqual(['design']);
    expect(projectInsightRules.blockers({ ...build, status: 'done' }, byId)).toEqual([]);
  });

  test('attention lists overdue first (oldest first), then waiting tasks; done tasks never appear', () => {
    const late = task({ id: 'late', dueDate: '2026-11-20' });
    const later = task({ id: 'later', dueDate: '2026-11-10' });
    const finishedLate = task({ id: 'finished', dueDate: '2026-11-01', status: 'done' });
    const blocker = task({ id: 'blocker' });
    const waiting = task({ id: 'waiting', dependencies: ['blocker'] });
    const items = projectInsightRules.attention([late, later, finishedLate, blocker, waiting], TODAY);
    expect(items.map((item) => item.task.id)).toEqual(['later', 'late', 'waiting']);
    expect(items[2].blockedBy.map((entry) => entry.id)).toEqual(['blocker']);
    expect(items[0].isOverdue).toBe(true);
  });
});

describe('ProjectInsightRules milestones', () => {
  test('next milestone is the earliest open dated one, else the first undated', () => {
    const done = milestone({ id: 'done', dueDate: '2026-11-01', completed: true });
    const soon = milestone({ id: 'soon', dueDate: '2026-12-01' });
    const overdue = milestone({ id: 'overdue', dueDate: '2026-11-20' });
    const undated = milestone({ id: 'undated' });
    expect(projectInsightRules.nextMilestone([done, soon, overdue, undated]).id).toBe('overdue');
    expect(projectInsightRules.nextMilestone([done, undated]).id).toBe('undated');
    expect(projectInsightRules.nextMilestone([done])).toBeNull();
  });

  test('sortMilestones puts open dated first, undated next, completed last', () => {
    const sorted = projectInsightRules.sortMilestones([
      milestone({ id: 'c', completed: true, dueDate: '2026-10-01' }), milestone({ id: 'u', name: 'B' }),
      milestone({ id: 'd2', dueDate: '2026-12-10' }), milestone({ id: 'd1', dueDate: '2026-12-01' }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(['d1', 'd2', 'u', 'c']);
  });

  test('milestone progress counts linked tasks only', () => {
    const tasks = [task({ milestoneId: 'm', status: 'done' }), task({ milestoneId: 'm' }), task({ milestoneId: 'other', status: 'done' })];
    expect(projectInsightRules.milestoneProgress('m', tasks)).toEqual({ done: 1, total: 2, percent: 50 });
    expect(projectInsightRules.milestoneProgress('none', tasks)).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe('ProjectInsightRules pulse and next actions', () => {
  test('pulse counts open, overdue, mine and waiting tasks', () => {
    const blocker = task({ id: 'b', assignees: ['me'], assignee: 'me' });
    const pulse = projectInsightRules.pulse([
      blocker,
      task({ dueDate: '2026-11-01' }),
      task({ dependencies: ['b'], assignedToAll: true }),
      task({ status: 'done', assignee: 'me' }),
    ], [milestone({ id: 'next', name: 'Launch', dueDate: '2026-12-01' })], 'me', TODAY);
    expect(pulse).toEqual({ openTasks: 3, overdueTasks: 1, myOpenTasks: 2, blockedTasks: 1, nextMilestone: { id: 'next', name: 'Launch', dueDate: '2026-12-01' } });
  });

  test('an empty project suggests a first task, a purpose and a teammate (managers only)', () => {
    const base = { tasks: [], milestones: [], memberCount: 1, canManage: true, canWrite: true, hasPurpose: false, userId: 'me', today: TODAY };
    expect(projectInsightRules.nextActions(base).map((action) => action.id)).toEqual(['add_first_task', 'add_purpose', 'invite_member']);
    expect(projectInsightRules.nextActions({ ...base, canManage: false }).map((action) => action.id)).toEqual(['add_first_task']);
    expect(projectInsightRules.nextActions({ ...base, canManage: false, canWrite: false })).toEqual([]);
  });

  test('overdue work comes before setup suggestions, and a finished project suggests wrapping up', () => {
    const base = { milestones: [], memberCount: 3, canManage: true, canWrite: true, hasPurpose: true, userId: 'me', today: TODAY };
    const overdue = projectInsightRules.nextActions({ ...base, tasks: [task({ dueDate: '2026-11-01', assignee: 'me' })] });
    expect(overdue[0]).toMatchObject({ id: 'review_overdue', title: 'Review 1 overdue task' });
    expect(overdue.map((action) => action.id)).toContain('add_milestone');
    const finished = projectInsightRules.nextActions({ ...base, milestones: [milestone()], tasks: [task({ status: 'done', assignee: 'me' })] });
    expect(finished.map((action) => action.id)).toEqual(['wrap_up']);
  });
});

describe('ProjectInsightRules task filters', () => {
  const tasks = [
    task({ id: 'mine', title: 'Book the venue', assignee: 'me', assignees: ['me'], priority: 'high', milestoneId: 'm1' }),
    task({ id: 'late', title: 'Send invites', dueDate: '2026-11-01', assignee: 'ana', assignees: ['ana'] }),
    task({ id: 'open', title: 'Order food', tags: ['catering'] }),
    task({ id: 'wait', title: 'Print programme', dependencies: ['mine'], assignedToAll: true }),
  ];
  const ids = (filters) => projectInsightRules.filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, ...filters }, 'me', TODAY).map((entry) => entry.id);

  test('quick filters', () => {
    expect(ids({ quick: 'mine' })).toEqual(['mine', 'wait']);
    expect(ids({ quick: 'overdue' })).toEqual(['late']);
    expect(ids({ quick: 'blocked' })).toEqual(['wait']);
    expect(ids({ quick: 'unassigned' })).toEqual(['open']);
  });

  test('search covers title, description and tags; other filters combine', () => {
    expect(ids({ search: 'CATERING' })).toEqual(['open']);
    expect(ids({ priority: 'high' })).toEqual(['mine']);
    expect(ids({ assigneeId: 'ana' })).toEqual(['late', 'wait']);
    expect(ids({ milestoneId: 'm1' })).toEqual(['mine']);
    expect(ids({ milestoneId: '' })).toEqual(['late', 'open', 'wait']);
  });

  test('groupByStatus sorts each column by due date, then priority', () => {
    const grouped = projectInsightRules.groupByStatus([
      task({ id: 'a', priority: 'low' }), task({ id: 'b', priority: 'urgent' }), task({ id: 'c', dueDate: '2026-12-01' }), task({ id: 'd', status: 'done' }),
    ]);
    expect(grouped.todo.map((entry) => entry.id)).toEqual(['c', 'b', 'a']);
    expect(grouped.done.map((entry) => entry.id)).toEqual(['d']);
    expect(grouped['in-progress']).toEqual([]);
  });
});
