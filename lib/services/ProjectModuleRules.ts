/**
 * Optional project modules (eProjects Phase 3). A simple project stays simple: the advanced modules are off until a
 * project manager (owner or accepted admin) switches them on in project settings. Timeline and time log were already
 * visible on every project before Phase 3, so they stay on unless a manager switches them off.
 * Stored server-side only as projects/{id}.modules (the client settings rule does not allow the field).
 * A copy of the website's functions/src/ProjectModuleRules.ts, which the server enforces; keep the two in step.
 */
export type ProjectModuleId = 'timeline' | 'time' | 'deliverables' | 'registers' | 'stakeholders';
export type ProjectModules = { [id in ProjectModuleId]: boolean };

export const PROJECT_MODULE_IDS: readonly ProjectModuleId[] = ['timeline', 'time', 'deliverables', 'registers', 'stakeholders'];

export const PROJECT_MODULE_DEFAULTS: ProjectModules = {
  timeline: true,
  time: true,
  deliverables: false,
  registers: false,
  stakeholders: false,
};

/** What each module is, in the words both clients show in settings. */
export const PROJECT_MODULE_COPY: { [id in ProjectModuleId]: { label: string; description: string } } = {
  timeline: { label: 'Dependencies and timeline', description: 'Tasks that wait on other tasks, and a timeline of task and milestone dates.' },
  time: { label: 'Time log', description: 'Members log time on tasks. Each person sees their own entries; managers see totals.' },
  deliverables: { label: 'Deliverables and sign-off', description: 'What each milestone hands over, its acceptance criteria, evidence and review.' },
  registers: { label: 'Risks, issues, decisions and changes', description: 'Registers for risks and issues, a searchable decision log and change requests that need manager approval.' },
  stakeholders: { label: 'Client and reviewer access', description: 'Invite people outside the team to see chosen milestones and deliverables, ask questions and sign off.' },
};

export class ProjectModuleRules {
  public isModule(value: unknown): value is ProjectModuleId {
    return typeof value === 'string' && (PROJECT_MODULE_IDS as readonly string[]).includes(value);
  }

  /** The project's modules: stored booleans over the defaults; anything malformed reads as the default. */
  public read(stored: unknown): ProjectModules {
    const source = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as { [key: string]: unknown } : {};
    const modules: ProjectModules = { ...PROJECT_MODULE_DEFAULTS };
    for (const id of PROJECT_MODULE_IDS) if (typeof source[id] === 'boolean') modules[id] = source[id] as boolean;
    return modules;
  }

  public enabled(stored: unknown, id: ProjectModuleId): boolean {
    return this.read(stored)[id];
  }
}

export const projectModuleRules = new ProjectModuleRules();
