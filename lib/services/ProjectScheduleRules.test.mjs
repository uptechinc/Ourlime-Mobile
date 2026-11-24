import { describe, expect, test } from 'bun:test';

const { projectScheduleRules } = await import('./ProjectScheduleRules.ts');
const { projectModuleRules, PROJECT_MODULE_DEFAULTS } = await import('./ProjectModuleRules.ts');

const TODAY = '2026-11-24';
const task = (id, fields = {}) => ({ id, status: 'todo', startDate: null, dueDate: null, dependencies: [], archived: false, ...fields });

describe('ProjectModuleRules (copy of the server rules)', () => {
  test('timeline and time log stay on by default; the advanced modules start off', () => {
    expect(PROJECT_MODULE_DEFAULTS).toEqual({ timeline: true, time: true, deliverables: false, registers: false, stakeholders: false });
    expect(projectModuleRules.read(undefined)).toEqual(PROJECT_MODULE_DEFAULTS);
  });

  test('stored booleans win; malformed values read as the default', () => {
    const modules = projectModuleRules.read({ timeline: false, deliverables: true, registers: 'yes', stakeholders: null, unknown: true });
    expect(modules).toEqual({ timeline: false, time: true, deliverables: true, registers: false, stakeholders: false });
    expect(projectModuleRules.enabled({ registers: true }, 'registers')).toBe(true);
    expect(projectModuleRules.isModule('budget')).toBe(false);
  });
});

describe('ProjectScheduleRules.derive', () => {
  test('waits on open dependencies and starts after the latest dependency due date', () => {
    const schedule = projectScheduleRules.derive({ startDate: '2026-12-01', dueDate: '2026-12-05' }, [
      { id: 'a', status: 'done', dueDate: '2026-11-20', available: true },
      { id: 'b', status: 'in-progress', dueDate: '2026-12-03', available: true },
      { id: 'c', status: 'todo', dueDate: null, available: true },
      { id: 'gone', status: 'todo', dueDate: '2027-01-01', available: false },
    ]);
    expect(schedule.waitingOn).toEqual(['b', 'c']);
    expect(schedule.predecessorDue).toEqual({ a: '2026-11-20', b: '2026-12-03' });
    expect(schedule.earliestStart).toBe('2026-12-03');
    expect(schedule.conflict).toBe(true);
  });

  test('applyPredecessor moves only that dependency', () => {
    const stored = { waitingOn: ['a', 'b'], predecessorDue: { a: '2026-12-01', b: '2026-12-10' }, earliestStart: '2026-12-10', conflict: false };
    const next = projectScheduleRules.applyPredecessor(stored, { startDate: '2026-12-11' }, { id: 'b', status: 'done', dueDate: '2026-12-20', available: true });
    expect(next.waitingOn).toEqual(['a']);
    expect(next.earliestStart).toBe('2026-12-20');
    expect(next.conflict).toBe(true);
    expect(projectScheduleRules.same(next, projectScheduleRules.read(next))).toBe(true);
  });
});

describe('ProjectScheduleRules.plan', () => {
  test('explains undated, waiting, conflicting and overdue work, and marks the critical chain', () => {
    const plan = projectScheduleRules.plan([
      task('design', { startDate: '2026-11-01', dueDate: '2026-11-20' }),
      task('build', { startDate: '2026-11-15', dueDate: '2026-12-10', dependencies: ['design'] }),
      task('launch', { startDate: '2026-12-11', dueDate: '2026-12-12', dependencies: ['build', 'missing'] }),
      task('notes', { dependencies: ['design'] }),
      task('old', { status: 'done', dueDate: '2026-10-01' }),
      task('hidden', { archived: true, dueDate: '2030-01-01' }),
    ], [{ id: 'm1', dueDate: '2026-12-01', completed: false }], TODAY);
    expect(plan.tasks.hidden).toBeUndefined();
    expect(plan.undatedCount).toBe(1);
    expect(plan.tasks.notes.reasons.map((reason) => reason.kind)).toEqual(['undated', 'waiting']);
    expect(plan.tasks.build.conflict).toBe(true);
    expect(plan.tasks.build.drivingTaskId).toBe('design');
    expect(plan.tasks.design.reasons.some((reason) => reason.kind === 'overdue')).toBe(true);
    expect(plan.tasks.launch.reasons.some((reason) => reason.kind === 'missing_dependency')).toBe(true);
    expect(plan.criticalChain).toEqual(['design', 'build', 'launch']);
    expect(plan.latestFinish).toBe('2026-12-12');
    expect(plan.tasks.old.critical).toBe(false);
  });

  test('a cycle in stored data cannot loop the critical chain', () => {
    const plan = projectScheduleRules.plan([
      task('a', { dueDate: '2026-12-02', dependencies: ['b'] }),
      task('b', { dueDate: '2026-12-01', dependencies: ['a'] }),
    ], [], TODAY);
    expect(plan.criticalChain.length).toBeLessThanOrEqual(2);
  });
});
