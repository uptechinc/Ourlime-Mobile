import type { ProjectStatus } from '@/lib/types/project';

/**
 * Which project status changes the app offers, and when a reason is needed. A copy of the website's
 * functions/src/ProjectLifecycleRules.ts, which the server enforces; keep the two in step.
 */
export type ProjectTransitionKind = 'pause' | 'resume' | 'complete' | 'archive' | 'restore' | 'reopen';

export const PROJECT_TRANSITION_REASON_LIMIT = 500;

const TRANSITIONS: { [from in ProjectStatus]: readonly ProjectStatus[] } = {
  active: ['on-hold', 'completed', 'archived'],
  'on-hold': ['active', 'completed', 'archived'],
  completed: ['active', 'archived'],
  archived: ['active'],
};

export type ProjectTransitionCopy = {
  menuLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  doneMessage: string;
  reasonLabel: string;
  tone: 'success' | 'warning' | 'danger';
};

const COPY: { [kind in ProjectTransitionKind]: ProjectTransitionCopy } = {
  pause: { menuLabel: 'Pause project', title: 'Pause this project?', confirmLabel: 'Pause', doneMessage: 'Project paused', reasonLabel: 'Note for the team (optional)', tone: 'warning',
    description: 'Nobody can add or change tasks or milestones while it is paused. You can resume it at any time.' },
  resume: { menuLabel: 'Resume project', title: 'Resume this project?', confirmLabel: 'Resume', doneMessage: 'Project resumed', reasonLabel: 'Note for the team (optional)', tone: 'success',
    description: 'The team can add and change tasks and milestones again.' },
  complete: { menuLabel: 'Mark as completed', title: 'Mark as completed?', confirmLabel: 'Mark completed', doneMessage: 'Project marked as completed', reasonLabel: 'Completion note (optional)', tone: 'success',
    description: 'The project becomes read-only. You can reopen it later if more work comes up.' },
  archive: { menuLabel: 'Archive project', title: 'Archive this project?', confirmLabel: 'Archive', doneMessage: 'Project archived', reasonLabel: 'Why are you archiving it?', tone: 'danger',
    description: 'The project becomes read-only for everyone and moves out of active work. Nothing is deleted, and you can restore it later.' },
  restore: { menuLabel: 'Restore project', title: 'Restore this project?', confirmLabel: 'Restore', doneMessage: 'Project restored', reasonLabel: 'Note for the team (optional)', tone: 'success',
    description: 'The project becomes active again and the team can add and change work.' },
  reopen: { menuLabel: 'Reopen project', title: 'Reopen this project?', confirmLabel: 'Reopen', doneMessage: 'Project reopened', reasonLabel: 'Why are you reopening it?', tone: 'success',
    description: 'The project becomes active again and the team can add and change work.' },
};

export class ProjectLifecycleRules {
  public targets(from: ProjectStatus): ProjectStatus[] {
    return [...(TRANSITIONS[from] ?? [])];
  }

  public canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
    return this.targets(from).includes(to);
  }

  /** Archiving and reopening a completed project need a reason; other moves take an optional note. */
  public reasonRequired(from: ProjectStatus, to: ProjectStatus): boolean {
    return to === 'archived' || (from === 'completed' && to === 'active');
  }

  public kind(from: ProjectStatus, to: ProjectStatus): ProjectTransitionKind {
    if (to === 'archived') return 'archive';
    if (to === 'completed') return 'complete';
    if (to === 'on-hold') return 'pause';
    if (from === 'archived') return 'restore';
    if (from === 'completed') return 'reopen';
    return 'resume';
  }

  public copy(from: ProjectStatus, to: ProjectStatus): ProjectTransitionCopy {
    return COPY[this.kind(from, to)];
  }

  /** Display name for a status (stored "on-hold" shows as "Paused"). */
  public label(status: ProjectStatus): string {
    return status === 'on-hold' ? 'Paused' : status === 'completed' ? 'Completed' : status === 'archived' ? 'Archived' : 'Active';
  }
}

export const projectLifecycleRules = new ProjectLifecycleRules();
