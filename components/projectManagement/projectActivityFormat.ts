import type { ProjectActivityEvent } from '@/lib/types/project';

const STATUS_LABELS: { [status: string]: string } = { active: 'active', 'on-hold': 'paused', completed: 'completed', archived: 'archived' };
const statusLabel = (value: string): string => STATUS_LABELS[value] ?? (value ? value.replace(/[-_]+/g, ' ') : 'another status');
const roleLabel = (value: string): string => value || 'member';
const quoted = (title: string): string => (title ? `"${title}"` : 'a milestone');
const community = (title: string): string => title || 'a Community';

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
    case 'milestone.created': return `${actor} added the milestone ${quoted(event.title)}`;
    case 'milestone.updated': return `${actor} edited the milestone ${quoted(event.title)}`;
    case 'milestone.completed': return `${actor} completed the milestone ${quoted(event.title)}`;
    case 'milestone.reopened': return `${actor} reopened the milestone ${quoted(event.title)}`;
    case 'milestone.deleted': return `${actor} deleted the milestone ${quoted(event.title)}`;
    // Community admins who answer a request are usually not on the team, so these lines name the Community instead.
    case 'community.link_requested': return `${actor} asked ${community(event.title)} to sponsor the project`;
    case 'community.link_cancelled': return `${actor} withdrew the request to ${community(event.title)}`;
    case 'community.link_approved': return event.selfApproved ? `${actor} linked the project to ${community(event.title)}` : `${community(event.title)} approved the link to this project`;
    case 'community.link_declined': return `${community(event.title)} declined the link to this project`;
    case 'community.link_ended':
      if (event.by === 'community') return `${community(event.title)} removed its link to this project`;
      if (event.by === 'system') return `The link to ${community(event.title)} ended`;
      return `${actor} removed the link to ${community(event.title)}`;
    default: return `${actor} updated the project`;
  }
}

/** "20 Nov, 10:05" in the phone's locale; "Just now" while the server timestamp is pending. */
export function formatActivityTime(at: Date | null): string {
  if (!at || !Number.isFinite(at.getTime())) return 'Just now';
  return at.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
