import type { AutomationRule, ProjectRecord } from '@/lib/types/project';

/**
 * Free vs Premium project plans (Ourlime-Web lib/projects/ProjectEntitlementService.ts). The Free-plan caps of 3
 * subtasks per task and 2 milestones per project were enforced only in the client, with no product reason, so the app
 * no longer applies them (audit D6). Premium currently gates only the timesheet CSV export.
 */
type AutomationRuleDefinition = Omit<AutomationRule, 'enabled'> & {
  /** False for rules that are stored but that nothing carries out yet; the app hides those (audit D7). */
  hasExecutor: boolean;
};

// Same rules and defaults as the website's project page (app/projectManagement/[projectId]/page.tsx).
const AUTOMATION_RULE_DEFINITIONS: AutomationRuleDefinition[] = [
  { id: '1', name: 'Auto-assign to team lead', trigger: 'Task created', action: 'Assign to team lead', isPremium: false, hasExecutor: true },
  { id: '2', name: 'Due date reminders', trigger: '24h before due', action: 'Send notification', isPremium: true, hasExecutor: false },
  { id: '3', name: 'Status change notifications', trigger: 'Status changed', action: 'Notify team', isPremium: true, hasExecutor: false },
];
const AUTOMATION_RULE_DEFAULTS: { [ruleId: string]: boolean } = { '1': true };

export class ProjectEntitlementService {
  private static instance: ProjectEntitlementService;

  private constructor() {}

  public static getInstance(): ProjectEntitlementService {
    if (!ProjectEntitlementService.instance) ProjectEntitlementService.instance = new ProjectEntitlementService();
    return ProjectEntitlementService.instance;
  }

  public isPremium(project: ProjectRecord | null | undefined): boolean {
    return project?.planTier === 'premium';
  }

  /** Only the rules something actually carries out (today: auto-assign, applied when a task is created). */
  public automationRules(project: ProjectRecord | null | undefined): AutomationRule[] {
    return AUTOMATION_RULE_DEFINITIONS.filter((definition) => definition.hasExecutor).map(({ hasExecutor: _hasExecutor, ...definition }) => ({
      ...definition,
      enabled: project?.automationRules?.[definition.id] ?? AUTOMATION_RULE_DEFAULTS[definition.id] ?? false,
    }));
  }

  public isAutomationRuleEnabled(project: ProjectRecord, ruleId: string): boolean {
    return project.automationRules?.[ruleId] ?? AUTOMATION_RULE_DEFAULTS[ruleId] ?? false;
  }
}

export const projectEntitlementService = ProjectEntitlementService.getInstance();
