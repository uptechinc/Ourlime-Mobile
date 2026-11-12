import type { AutomationRule, ProjectRecord } from '@/lib/types/project';

/** Kept identical to Ourlime-Web lib/projects/ProjectEntitlementService.ts (Free vs Premium project plans). */
export type ProjectTierLimits = {
  tierName: string;
  maxSubtasksPerTask: number;
  maxMilestones: number;
  maxFileUploadBytes: number;
};

export type EntitlementCheck = { allowed: boolean; max: number; reason?: string };

const FREE_LIMITS: ProjectTierLimits = { tierName: 'Free', maxSubtasksPerTask: 3, maxMilestones: 2, maxFileUploadBytes: 10 * 1024 * 1024 };
const PREMIUM_LIMITS: ProjectTierLimits = { tierName: 'Premium', maxSubtasksPerTask: Infinity, maxMilestones: Infinity, maxFileUploadBytes: 1024 * 1024 * 1024 };

type AutomationRuleDefinition = Omit<AutomationRule, 'enabled'>;

// Same rules and defaults as the website's project page (app/projectManagement/[projectId]/page.tsx).
const AUTOMATION_RULE_DEFINITIONS: AutomationRuleDefinition[] = [
  { id: '1', name: 'Auto-assign to team lead', trigger: 'Task created', action: 'Assign to team lead', isPremium: false },
  { id: '2', name: 'Due date reminders', trigger: '24h before due', action: 'Send notification', isPremium: true },
  { id: '3', name: 'Status change notifications', trigger: 'Status changed', action: 'Notify team', isPremium: true },
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

  public getLimits(project: ProjectRecord | null | undefined): ProjectTierLimits {
    return this.isPremium(project) ? PREMIUM_LIMITS : FREE_LIMITS;
  }

  public canAddSubtask(currentCount: number, project: ProjectRecord | null | undefined): EntitlementCheck {
    const limits = this.getLimits(project);
    if (currentCount >= limits.maxSubtasksPerTask) {
      return { allowed: false, max: limits.maxSubtasksPerTask, reason: `The ${limits.tierName} plan allows up to ${limits.maxSubtasksPerTask} subtasks per task. Upgrade to Premium for unlimited subtasks.` };
    }
    return { allowed: true, max: limits.maxSubtasksPerTask };
  }

  public canCreateMilestone(currentCount: number, project: ProjectRecord | null | undefined): EntitlementCheck {
    const limits = this.getLimits(project);
    if (currentCount >= limits.maxMilestones) {
      return { allowed: false, max: limits.maxMilestones, reason: `The ${limits.tierName} plan allows up to ${limits.maxMilestones} milestones per project. Upgrade to Premium for unlimited milestones.` };
    }
    return { allowed: true, max: limits.maxMilestones };
  }

  public automationRules(project: ProjectRecord | null | undefined): AutomationRule[] {
    return AUTOMATION_RULE_DEFINITIONS.map((definition) => ({
      ...definition,
      enabled: project?.automationRules?.[definition.id] ?? AUTOMATION_RULE_DEFAULTS[definition.id] ?? false,
    }));
  }

  public isAutomationRuleEnabled(project: ProjectRecord, ruleId: string): boolean {
    return project.automationRules?.[ruleId] ?? AUTOMATION_RULE_DEFAULTS[ruleId] ?? false;
  }
}

export const projectEntitlementService = ProjectEntitlementService.getInstance();
