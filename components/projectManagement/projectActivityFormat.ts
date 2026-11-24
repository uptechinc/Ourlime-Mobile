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
    // Phase 3. Clients and reviewers are not on the team, so lines they act in say "A client" or "A reviewer".
    case 'project.modules_changed': {
      const words = (ids: string[]): string => ids.map((id) => MODULE_WORDS[id] ?? id).join(', ');
      const parts = [event.enabled.length ? `switched on ${words(event.enabled)}` : '', event.disabled.length ? `switched off ${words(event.disabled)}` : ''].filter(Boolean);
      return `${actor} ${parts.join(' and ') || 'changed the project modules'}`;
    }
    case 'project.outcome_recorded': return `${actor} recorded the outcome report${event.acceptedCount !== null ? ` with ${event.acceptedCount} accepted ${event.acceptedCount === 1 ? 'deliverable' : 'deliverables'}` : ''}`;
    case 'deliverable.created': return `${actor} added the deliverable ${titled(event.title, 'a deliverable')}`;
    case 'deliverable.updated': return `${actor} edited the deliverable ${titled(event.title, 'a deliverable')}`;
    case 'deliverable.evidence_added': return `${actor} added ${event.kind === 'file' ? 'a file' : 'a link'} as evidence to ${titled(event.title, 'a deliverable')}`;
    case 'deliverable.evidence_removed': return `${actor} removed evidence from ${titled(event.title, 'a deliverable')}`;
    case 'deliverable.submitted': return `${actor} submitted ${titled(event.title, 'a deliverable')} for review${event.revision ? ` (version ${event.revision})` : ''}`;
    case 'deliverable.accepted': return `${event.byRole === 'stakeholder' ? 'A client or reviewer' : actor} accepted ${titled(event.title, 'a deliverable')}${event.revision ? ` (version ${event.revision})` : ''}`;
    case 'deliverable.changes_requested': return `${event.byRole === 'stakeholder' ? 'A client or reviewer' : actor} asked for changes to ${titled(event.title, 'a deliverable')}`;
    case 'deliverable.reopened': return `${actor} reopened ${titled(event.title, 'a deliverable')}`;
    case 'deliverable.shared': return event.shared === false ? `${actor} stopped sharing ${titled(event.title, 'a deliverable')}` : `${actor} shared ${titled(event.title, 'a deliverable')} with clients and reviewers`;
    case 'deliverable.deleted': return `${actor} deleted the deliverable ${titled(event.title, 'a deliverable')}`;
    case 'register.created': return `${actor} added the ${REGISTER_WORDS[event.kind] ?? 'record'} ${titled(event.title, '')}`.trim();
    case 'register.updated': return `${actor} edited the ${REGISTER_WORDS[event.kind] ?? 'record'} ${titled(event.title, '')}`.trim();
    case 'register.status_changed': return `${actor} moved the ${REGISTER_WORDS[event.kind] ?? 'record'} ${titled(event.title, '')} from ${statusLabel(event.from)} to ${statusLabel(event.to)}`;
    case 'register.deleted': return `${actor} deleted the ${REGISTER_WORDS[event.kind] ?? 'record'} ${titled(event.title, '')}`.trim();
    case 'stakeholder.invited': return `${actor} invited a ${event.role === 'reviewer' ? 'reviewer' : 'client'} to see shared work`;
    case 'stakeholder.joined': return `A ${event.role === 'reviewer' ? 'reviewer' : 'client'} accepted the invitation`;
    case 'stakeholder.declined': return `A ${event.role === 'reviewer' ? 'reviewer' : 'client'} declined the invitation`;
    case 'stakeholder.left': return `A ${event.role === 'reviewer' ? 'reviewer' : 'client'} left`;
    case 'stakeholder.removed': return `${actor} removed a ${event.role === 'reviewer' ? 'reviewer' : 'client'}`;
    case 'stakeholder.role_changed': return `${actor} changed a ${event.from || 'client'} to a ${event.to || 'reviewer'}`;
    case 'milestone.shared': return event.shared === false ? `${actor} stopped sharing ${quoted(event.title)}` : `${actor} shared the milestone ${quoted(event.title)} with clients and reviewers`;
    case 'question.asked': return event.byRole === 'stakeholder' ? 'A client asked a question' : `${actor} asked the clients a question`;
    case 'question.answered': return event.byRole === 'stakeholder' ? 'A client or reviewer answered a question' : `${actor} answered a client's question`;
    default: return `${actor} updated the project`;
  }
}

const MODULE_WORDS: { [id: string]: string } = { timeline: 'the timeline', time: 'the time log', deliverables: 'deliverables', registers: 'risks and decisions', stakeholders: 'client and reviewer access' };
const REGISTER_WORDS: { [kind: string]: string } = { risk: 'risk', issue: 'issue', decision: 'decision', change_request: 'change request' };
function titled(title: string, fallback: string): string { return title ? `"${title}"` : fallback; }

/** "20 Nov, 10:05" in the phone's locale; "Just now" while the server timestamp is pending. */
export function formatActivityTime(at: Date | null): string {
  if (!at || !Number.isFinite(at.getTime())) return 'Just now';
  return at.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
