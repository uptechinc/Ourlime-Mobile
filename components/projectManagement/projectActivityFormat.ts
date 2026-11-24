import type { ProjectActivityEvent } from '@/lib/types/project';

const STATUS_LABELS: { [status: string]: string } = { active: 'active', 'on-hold': 'paused', completed: 'completed', archived: 'archived' };
const statusLabel = (value: string): string => STATUS_LABELS[value] ?? (value ? value.replace(/[-_]+/g, ' ') : 'another status');
const roleLabel = (value: string): string => value || 'member';

/**
 * One readable line per activity event (same wording as the website's ProjectActivityPanel). Events store account
 * IDs only; `nameOf` resolves them from the loaded team ("Former member" for people no longer on it).
 */
export function describeProjectActivity(event: ProjectActivityEvent, nameOf: (userId: string) => string): string {
  const actor = nameOf(event.actorId);
  const subject = nameOf(event.subjectId);
  switch (event.type) {
    case 'project.created': return `${actor} created the project`;
    case 'project.status_changed': return `${actor} changed the status from ${statusLabel(event.from)} to ${statusLabel(event.to)}`;
    case 'project.deleted': return `${actor} deleted the project`;
    case 'project.ownership_transferred': return `${actor} made ${nameOf(event.to)} the owner`;
    case 'project.settings_changed': return `${actor} changed the ${event.changed.includes('planTier') ? 'plan' : 'automation settings'}`;
    case 'member.invited':
      if (event.subjectKind === 'email_invite') return `${actor} invited someone by email as ${roleLabel(event.role)}`;
      return `${actor} invited ${subject} as ${roleLabel(event.role)}`;
    case 'member.invite_cancelled': return `${actor} cancelled the invitation to ${subject}`;
    case 'member.joined': return `${actor} joined as ${roleLabel(event.role)}`;
    case 'member.declined': return `${actor} declined the invitation`;
    case 'member.left': return `${actor} left the project`;
    case 'member.removed': return `${actor} removed ${subject}`;
    case 'member.role_changed': return `${actor} changed ${subject}'s role from ${roleLabel(event.from)} to ${roleLabel(event.to)}`;
    default: return `${actor} updated the project`;
  }
}

/** "20 Nov, 10:05" in the phone's locale; "Just now" while the server timestamp is pending. */
export function formatActivityTime(at: Date | null): string {
  if (!at || !Number.isFinite(at.getTime())) return 'Just now';
  return at.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
