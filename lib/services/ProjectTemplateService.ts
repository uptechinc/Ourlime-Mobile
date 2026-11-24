import { projectService } from './ProjectService';
import { projectInsightRules } from './ProjectInsightRules';
import type { FullTaskInput, Priority } from '@/lib/types/project';

/**
 * Project templates: a starting point for a new project (colour, wording and optional starter milestones and tasks).
 * A template only fills the create form and then creates ordinary milestones and tasks through the existing
 * ProjectService methods, so nothing about the stored project records changes. The list and ids are meant to match
 * the website's template list: personal goal, community initiative, class project, business service, event
 * production, volunteer campaign, software project and blank.
 */
export type ProjectTemplateId =
  | 'personal-goal' | 'community-initiative' | 'class-project' | 'business-service'
  | 'event-production' | 'volunteer-campaign' | 'software-project' | 'blank';

export type ProjectTemplateMilestone = { key: string; name: string; dueInDays: number };
export type ProjectTemplateTask = { title: string; description: string; priority: Priority; dueInDays: number; milestoneKey?: string };

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  summary: string;
  namePlaceholder: string;
  purposePlaceholder: string;
  /** Stored Tailwind colour class (same options as the colour picker). */
  color: string;
  /** Offer the invite picker after creating (a personal goal starts solo). */
  suggestInvite: boolean;
  milestones: readonly ProjectTemplateMilestone[];
  tasks: readonly ProjectTemplateTask[];
};

export type ProjectStarterPlan = {
  milestones: { key: string; name: string; dueDate: string }[];
  tasks: { title: string; description: string; priority: Priority; dueDate: string; milestoneKey: string }[];
};

export type ProjectStarterResult = { created: number; failed: number; total: number };

export type ProjectTemplateProgress = (done: number, total: number) => void;

export type ProjectFromTemplateInput = {
  templateId: ProjectTemplateId;
  name: string;
  description: string;
  color: string;
  dueDate: string | null;
  includeStarter: boolean;
  /** Day the starter plan's dates count from ('YYYY-MM-DD'), normally today. */
  startDate: string;
};

export type ProjectFromTemplateResult = { projectId: string; template: ProjectTemplate; starter: ProjectStarterResult | null };

const TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: 'personal-goal', name: 'Personal goal', summary: 'Turn a goal into small, dated steps you can tick off.',
    namePlaceholder: 'e.g. Run a 10K by March', purposePlaceholder: 'What will be different when you reach this goal?',
    color: 'bg-emerald-500', suggestInvite: false,
    milestones: [{ key: 'halfway', name: 'Halfway check-in', dueInDays: 14 }, { key: 'done', name: 'Goal reached', dueInDays: 30 }],
    tasks: [
      { title: 'Write down what success looks like', description: 'One or two sentences you can check yourself against.', priority: 'high', dueInDays: 1 },
      { title: 'Break the goal into weekly steps', description: '', priority: 'medium', dueInDays: 3 },
      { title: 'Block time for it in your week', description: '', priority: 'medium', dueInDays: 3 },
      { title: 'Review progress and adjust the plan', description: '', priority: 'medium', dueInDays: 14, milestoneKey: 'halfway' },
    ],
  },
  {
    id: 'community-initiative', name: 'Community initiative', summary: 'Rally members around a shared cause and keep everyone in step.',
    namePlaceholder: 'e.g. Neighbourhood clean-up', purposePlaceholder: 'Who benefits, and what will change for them?',
    color: 'bg-teal-500', suggestInvite: true,
    milestones: [{ key: 'plan', name: 'Plan agreed', dueInDays: 14 }, { key: 'launch', name: 'Launch day', dueInDays: 45 }],
    tasks: [
      { title: 'Describe the need and who benefits', description: '', priority: 'high', dueInDays: 3, milestoneKey: 'plan' },
      { title: 'Find co-organisers', description: 'Two or three people who can share the work.', priority: 'high', dueInDays: 7, milestoneKey: 'plan' },
      { title: 'List the resources and partners you need', description: '', priority: 'medium', dueInDays: 10, milestoneKey: 'plan' },
      { title: 'Agree roles and the next meeting', description: '', priority: 'medium', dueInDays: 14, milestoneKey: 'plan' },
      { title: 'Share an update with the community', description: '', priority: 'medium', dueInDays: 21 },
    ],
  },
  {
    id: 'class-project', name: 'Class project', summary: 'Group work with clear roles, a draft and a hand-in date.',
    namePlaceholder: 'e.g. Biology group report', purposePlaceholder: 'What is the brief, and how will it be marked?',
    color: 'bg-indigo-500', suggestInvite: true,
    milestones: [{ key: 'outline', name: 'Outline ready', dueInDays: 7 }, { key: 'submit', name: 'Final submission', dueInDays: 28 }],
    tasks: [
      { title: 'Read the brief and marking criteria together', description: '', priority: 'high', dueInDays: 2, milestoneKey: 'outline' },
      { title: 'Split the work and agree roles', description: '', priority: 'high', dueInDays: 3, milestoneKey: 'outline' },
      { title: 'Research and gather sources', description: '', priority: 'medium', dueInDays: 10 },
      { title: 'Draft each section', description: '', priority: 'medium', dueInDays: 18 },
      { title: 'Review together and polish', description: '', priority: 'medium', dueInDays: 25, milestoneKey: 'submit' },
      { title: 'Submit the final version', description: '', priority: 'urgent', dueInDays: 28, milestoneKey: 'submit' },
    ],
  },
  {
    id: 'business-service', name: 'Business service', summary: 'Deliver work for a client, from the brief to sign-off.',
    namePlaceholder: 'e.g. Website for Ana’s Bakery', purposePlaceholder: 'What does the client need, and by when?',
    color: 'bg-sky-500', suggestInvite: true,
    milestones: [{ key: 'scope', name: 'Scope agreed', dueInDays: 7 }, { key: 'delivery', name: 'Delivery', dueInDays: 30 }],
    tasks: [
      { title: 'Confirm the brief and budget with the client', description: '', priority: 'high', dueInDays: 2, milestoneKey: 'scope' },
      { title: 'Write the scope and timeline', description: '', priority: 'high', dueInDays: 5, milestoneKey: 'scope' },
      { title: 'Produce the first version', description: '', priority: 'medium', dueInDays: 18 },
      { title: 'Collect client feedback', description: '', priority: 'medium', dueInDays: 22 },
      { title: 'Deliver and confirm sign-off', description: '', priority: 'high', dueInDays: 30, milestoneKey: 'delivery' },
    ],
  },
  {
    id: 'event-production', name: 'Event production', summary: 'Venue, programme, people and promotion for one event.',
    namePlaceholder: 'e.g. Spring networking night', purposePlaceholder: 'Who is the event for, and what should they leave with?',
    color: 'bg-violet-500', suggestInvite: true,
    milestones: [{ key: 'venue', name: 'Venue and date confirmed', dueInDays: 14 }, { key: 'event', name: 'Event day', dueInDays: 45 }],
    tasks: [
      { title: 'Set the date, budget and audience', description: '', priority: 'high', dueInDays: 3, milestoneKey: 'venue' },
      { title: 'Book the venue', description: '', priority: 'high', dueInDays: 14, milestoneKey: 'venue' },
      { title: 'Plan the programme and speakers', description: '', priority: 'medium', dueInDays: 21 },
      { title: 'Promote the event', description: '', priority: 'medium', dueInDays: 30 },
      { title: 'Prepare the run sheet and helpers', description: '', priority: 'medium', dueInDays: 40, milestoneKey: 'event' },
      { title: 'Follow up and share photos', description: '', priority: 'low', dueInDays: 48 },
    ],
  },
  {
    id: 'volunteer-campaign', name: 'Volunteer campaign', summary: 'Recruit, brief and thank volunteers for a cause.',
    namePlaceholder: 'e.g. Food bank drive', purposePlaceholder: 'What are volunteers helping to achieve?',
    color: 'bg-rose-500', suggestInvite: true,
    milestones: [{ key: 'recruited', name: 'Volunteers recruited', dueInDays: 14 }, { key: 'campaign', name: 'Campaign day', dueInDays: 30 }],
    tasks: [
      { title: 'Define the volunteer roles you need', description: '', priority: 'high', dueInDays: 3, milestoneKey: 'recruited' },
      { title: 'Post the call for volunteers', description: '', priority: 'high', dueInDays: 5, milestoneKey: 'recruited' },
      { title: 'Brief and schedule volunteers', description: '', priority: 'medium', dueInDays: 20 },
      { title: 'Gather supplies', description: '', priority: 'medium', dueInDays: 25, milestoneKey: 'campaign' },
      { title: 'Thank volunteers and share the results', description: '', priority: 'medium', dueInDays: 33 },
    ],
  },
  {
    id: 'software-project', name: 'Software project', summary: 'Plan, build, test and ship a first release.',
    namePlaceholder: 'e.g. Booking app MVP', purposePlaceholder: 'What problem does it solve, and for whom?',
    color: 'bg-orange-500', suggestInvite: true,
    milestones: [{ key: 'design', name: 'Design ready', dueInDays: 14 }, { key: 'release', name: 'First release', dueInDays: 42 }],
    tasks: [
      { title: 'Write the problem statement and goals', description: '', priority: 'high', dueInDays: 3, milestoneKey: 'design' },
      { title: 'List the features for the first release', description: '', priority: 'high', dueInDays: 7, milestoneKey: 'design' },
      { title: 'Sketch the screens and data', description: '', priority: 'medium', dueInDays: 14, milestoneKey: 'design' },
      { title: 'Build the first feature', description: '', priority: 'medium', dueInDays: 28 },
      { title: 'Test with real users', description: '', priority: 'medium', dueInDays: 36 },
      { title: 'Release and collect feedback', description: '', priority: 'high', dueInDays: 42, milestoneKey: 'release' },
    ],
  },
  {
    id: 'blank', name: 'Blank project', summary: 'Start empty and add your own tasks and milestones.',
    namePlaceholder: 'Project name', purposePlaceholder: 'What should this project achieve?',
    color: 'bg-emerald-500', suggestInvite: true, milestones: [], tasks: [],
  },
];

export class ProjectTemplateService {
  private static instance: ProjectTemplateService;

  private constructor() {}

  public static getInstance(): ProjectTemplateService {
    if (!ProjectTemplateService.instance) ProjectTemplateService.instance = new ProjectTemplateService();
    return ProjectTemplateService.instance;
  }

  public list(): readonly ProjectTemplate[] {
    return TEMPLATES;
  }

  public get(id: ProjectTemplateId): ProjectTemplate {
    return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[TEMPLATES.length - 1];
  }

  public hasStarterContent(template: ProjectTemplate): boolean {
    return template.milestones.length + template.tasks.length > 0;
  }

  /** The template's milestones and tasks with real dates counted from `startDate` ('YYYY-MM-DD'). */
  public plan(template: ProjectTemplate, startDate: string): ProjectStarterPlan {
    return {
      milestones: template.milestones.map((milestone) => ({ key: milestone.key, name: milestone.name, dueDate: projectInsightRules.addDays(startDate, milestone.dueInDays) })),
      tasks: template.tasks.map((task) => ({
        title: task.title, description: task.description, priority: task.priority,
        dueDate: projectInsightRules.addDays(startDate, task.dueInDays), milestoneKey: task.milestoneKey ?? '',
      })),
    };
  }

  /**
   * Creates the project (always active, like every new project), then optionally the template's starter plan. The
   * project counts as created even if some or all starter items fail; the result says how many were added.
   */
  public async createFromTemplate(input: ProjectFromTemplateInput, onProgress?: (stage: 'project' | 'starter', done: number, total: number) => void): Promise<ProjectFromTemplateResult> {
    const template = this.get(input.templateId);
    onProgress?.('project', 0, 1);
    const projectId = await projectService.createProject({
      name: input.name, description: input.description, color: input.color, ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    });
    if (!input.includeStarter || !this.hasStarterContent(template)) return { projectId, template, starter: null };
    const plan = this.plan(template, input.startDate);
    const total = plan.milestones.length + plan.tasks.length;
    onProgress?.('starter', 0, total);
    try {
      const starter = await this.applyStarterContent(projectId, plan, input.color, (done, count) => onProgress?.('starter', done, count));
      return { projectId, template, starter };
    } catch (error: unknown) {
      console.error('[ProjectTemplateService.createFromTemplate] Error:', error instanceof Error ? error.message : error);
      return { projectId, template, starter: { created: 0, failed: total, total } };
    }
  }

  /**
   * Creates the planned milestones, then the tasks (assigned to the creator and linked to their milestone), one at a
   * time so the project's counters update in order. A failed item is skipped and counted; the project stays usable.
   */
  public async applyStarterContent(projectId: string, plan: ProjectStarterPlan, color: string, onProgress?: ProjectTemplateProgress): Promise<ProjectStarterResult> {
    const total = plan.milestones.length + plan.tasks.length;
    if (total === 0) return { created: 0, failed: 0, total: 0 };
    const { project, teamMembers } = await projectService.getProject(projectId);
    const milestoneIds = new Map<string, string>();
    let created = 0;
    let failed = 0;
    const report = (): void => onProgress?.(created + failed, total);
    for (const milestone of plan.milestones) {
      try {
        milestoneIds.set(milestone.key, await projectService.createMilestone(projectId, { name: milestone.name, dueDate: milestone.dueDate, color }));
        created += 1;
      } catch (error: unknown) {
        failed += 1;
        console.warn('[ProjectTemplateService.applyStarterContent] Error:', error instanceof Error ? error.message : 'milestone not created');
      }
      report();
    }
    for (const task of plan.tasks) {
      const fields: FullTaskInput = {
        title: task.title, description: task.description, status: 'todo', priority: task.priority,
        assignee: project.ownerId, assignees: project.ownerId ? [project.ownerId] : [], assignedToAll: false,
        startDate: '', dueDate: task.dueDate, estimatedTime: 0, tags: [], dependencies: [],
        milestoneId: milestoneIds.get(task.milestoneKey) ?? '',
      };
      try {
        await projectService.createFullTask(project, teamMembers, await projectService.newTaskId(), fields);
        created += 1;
      } catch (error: unknown) {
        failed += 1;
        console.warn('[ProjectTemplateService.applyStarterContent] Error:', error instanceof Error ? error.message : 'task not created');
      }
      report();
    }
    return { created, failed, total };
  }
}

export const projectTemplateService = ProjectTemplateService.getInstance();
