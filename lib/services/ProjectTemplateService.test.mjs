import { beforeEach, describe, expect, mock, test } from 'bun:test';

// The template service only calls existing ProjectService methods; record those calls.
const calls = [];
let failingTaskTitles = new Set();
let milestoneFailure = false;
let getProjectFailure = false;
let ids = 0;
mock.module('./ProjectService', () => ({
  projectService: {
    createProject: async (input) => { calls.push(['createProject', input]); return 'project1'; },
    getProject: async (projectId) => {
      calls.push(['getProject', projectId]);
      if (getProjectFailure) throw new Error('offline');
      return { project: { id: projectId, ownerId: 'owner1', automationRules: {} }, teamMembers: [{ id: 'owner1' }] };
    },
    createMilestone: async (projectId, input) => {
      calls.push(['createMilestone', projectId, input]);
      if (milestoneFailure) throw new Error('denied');
      return `milestone-${input.name}`;
    },
    newTaskId: async () => `task${++ids}`,
    createFullTask: async (project, teamMembers, taskId, fields) => {
      calls.push(['createFullTask', project.id, taskId, fields]);
      if (failingTaskTitles.has(fields.title)) throw new Error('network');
    },
  },
}));

const { projectTemplateService } = await import('./ProjectTemplateService.ts');

beforeEach(() => {
  calls.length = 0; failingTaskTitles = new Set(); milestoneFailure = false; getProjectFailure = false; ids = 0;
});

describe('ProjectTemplateService definitions', () => {
  test('offers the same eight templates as the website, in order', () => {
    expect(projectTemplateService.list().map((template) => template.id)).toEqual([
      'personal-goal', 'community-initiative', 'class-project', 'business-service', 'event-production', 'volunteer-campaign', 'software-project', 'blank',
    ]);
  });

  test('every task links only to a milestone of its own template, and dates are in the future', () => {
    for (const template of projectTemplateService.list()) {
      const keys = new Set(template.milestones.map((milestone) => milestone.key));
      for (const task of template.tasks) {
        if (task.milestoneKey) expect(keys.has(task.milestoneKey)).toBe(true);
        expect(task.dueInDays).toBeGreaterThan(0);
        expect(task.title.length).toBeLessThanOrEqual(200);
      }
      expect(new Set(template.tasks.map((task) => task.title)).size).toBe(template.tasks.length);
    }
    expect(projectTemplateService.hasStarterContent(projectTemplateService.get('blank'))).toBe(false);
    expect(projectTemplateService.get('personal-goal').suggestInvite).toBe(false);
  });

  test('plan dates count from the start day', () => {
    const plan = projectTemplateService.plan(projectTemplateService.get('personal-goal'), '2026-11-24');
    expect(plan.milestones).toEqual([{ key: 'halfway', name: 'Halfway check-in', dueDate: '2026-12-08' }, { key: 'done', name: 'Goal reached', dueDate: '2026-12-24' }]);
    expect(plan.tasks[0]).toMatchObject({ title: 'Write down what success looks like', dueDate: '2026-11-25', milestoneKey: '' });
    expect(plan.tasks[3]).toMatchObject({ milestoneKey: 'halfway', dueDate: '2026-12-08' });
  });
});

describe('ProjectTemplateService.createFromTemplate', () => {
  const input = { templateId: 'class-project', name: 'Biology report', description: 'Group report', color: 'bg-indigo-500', dueDate: '2026-12-20', includeStarter: true, startDate: '2026-11-24' };

  test('creates the project, then milestones, then tasks linked to them and assigned to the owner', async () => {
    const progress = [];
    const result = await projectTemplateService.createFromTemplate(input, (stage, done, total) => progress.push([stage, done, total]));
    expect(result.projectId).toBe('project1');
    expect(result.starter).toEqual({ created: 8, failed: 0, total: 8 });
    expect(calls[0]).toEqual(['createProject', { name: 'Biology report', description: 'Group report', color: 'bg-indigo-500', dueDate: '2026-12-20' }]);
    const kinds = calls.map((call) => call[0]);
    expect(kinds.indexOf('createMilestone')).toBeLessThan(kinds.indexOf('createFullTask'));
    const milestones = calls.filter((call) => call[0] === 'createMilestone');
    expect(milestones.map((call) => call[2])).toEqual([
      { name: 'Outline ready', dueDate: '2026-12-01', color: 'bg-indigo-500' },
      { name: 'Final submission', dueDate: '2026-12-22', color: 'bg-indigo-500' },
    ]);
    const tasks = calls.filter((call) => call[0] === 'createFullTask').map((call) => call[3]);
    expect(tasks).toHaveLength(6);
    expect(tasks[0]).toMatchObject({ title: 'Read the brief and marking criteria together', status: 'todo', assignee: 'owner1', assignees: ['owner1'], assignedToAll: false, milestoneId: 'milestone-Outline ready', dueDate: '2026-11-26' });
    expect(tasks[2].milestoneId).toBe('');
    expect(tasks.every((fields) => fields.recurrence === undefined)).toBe(true);
    expect(progress[0]).toEqual(['project', 0, 1]);
    expect(progress.at(-1)).toEqual(['starter', 8, 8]);
  });

  test('without the starter plan (or for a blank project) only the project is created', async () => {
    const skipped = await projectTemplateService.createFromTemplate({ ...input, includeStarter: false, dueDate: null });
    expect(skipped.starter).toBeNull();
    expect(calls).toEqual([['createProject', { name: 'Biology report', description: 'Group report', color: 'bg-indigo-500' }]]);
    calls.length = 0;
    const blank = await projectTemplateService.createFromTemplate({ ...input, templateId: 'blank' });
    expect(blank.starter).toBeNull();
    expect(calls.map((call) => call[0])).toEqual(['createProject']);
  });

  test('a failed starter item is skipped and counted; the project still counts as created', async () => {
    failingTaskTitles = new Set(['Draft each section']);
    milestoneFailure = true;
    const result = await projectTemplateService.createFromTemplate(input);
    expect(result.starter).toEqual({ created: 5, failed: 3, total: 8 });
    const tasks = calls.filter((call) => call[0] === 'createFullTask').map((call) => call[3]);
    expect(tasks.every((fields) => fields.milestoneId === '')).toBe(true);
  });

  test('if the project cannot be read back, every starter item is reported as not added', async () => {
    getProjectFailure = true;
    const result = await projectTemplateService.createFromTemplate(input);
    expect(result.projectId).toBe('project1');
    expect(result.starter).toEqual({ created: 0, failed: 8, total: 8 });
  });

  test('a refused project create reaches the caller and no starter items are attempted', async () => {
    const { projectService } = await import('./ProjectService');
    const create = projectService.createProject;
    projectService.createProject = async () => { throw new Error('Project name is required.'); };
    try {
      await expect(projectTemplateService.createFromTemplate({ ...input, name: '' })).rejects.toThrow('Project name is required.');
      expect(calls).toEqual([]);
    } finally {
      projectService.createProject = create;
    }
  });
});
