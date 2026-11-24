import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'archived';
export type ProjectPlanTier = 'free' | 'premium';
/** Website useProjectDetails ProjectLoadError. */
export type ProjectLoadError = 'not-found' | 'permission-denied' | 'network-error' | 'unknown';
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export type ProjectMutationAction = 'create_project' | 'create_task' | 'invite' | 'add_subtask' | 'add_comment';

export type ProjectMutationCapability =
  | { allowed: true }
  | { allowed: false; reason: string };
export type ProjectMembershipStatus = 'accepted' | 'pending';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'todo' | 'in-progress' | 'done';

export type SubTask = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

export type Comment = {
  id: string;
  author: string;
  userId?: string;
  authorName?: string;
  content: string;
  timestamp: string;
  avatar?: string;
  editedAt?: string;
  mentions?: string[];
};

export type FileAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
};

export type TimeEntry = {
  id: string;
  taskId: string;
  userId: string;
  startTime: string;
  endTime?: string;
  duration: number; // in minutes
  description: string;
  date: string;
};

/** One entry of a task's history (same shape the website writes to tasks/{id}.auditLog). */
export type TaskAuditLogEntry = {
  id: string;
  action: string;
  detail: string;
  userId: string;
  timestamp: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assignee: string;
  assignees?: string[];
  assignedToAll?: boolean;
  createdBy: string;
  startDate?: string;
  dueDate: string;
  milestoneId?: string;
  dependencies?: string[];
  recurrence?: RecurrenceRule | null;
  version?: number;
  createdAt: string;
  updatedAt: string;
  subTasks: SubTask[];
  comments: Comment[];
  attachments: FileAttachment[];
  timeEntries: TimeEntry[];
  estimatedTime: number; // in hours
  tags: string[];
  progress: number; // 0-100
  archived?: boolean;
  auditLog?: TaskAuditLogEntry[];
  /** Server-derived dependency state (website functions/src/ProjectScheduleRules.ts); absent until the task changes after Phase 3. */
  schedule?: TaskScheduleState | null;
};

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecurrenceEndMode = 'never' | 'date' | 'count';
export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  endMode: RecurrenceEndMode;
  endDate?: string;
  endCount?: number;
};

/** projects/{id}/milestones/{milestoneId} (same fields the website writes). */
export type Milestone = {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  color: string;
  completed: boolean;
  createdBy: string;
  /** Member responsible for the milestone (optional; set on the website). */
  ownerId?: string;
  /** Shown to the project's clients and reviewers (milestone_share). */
  sharedWithStakeholders?: boolean;
};

/** projects/{id}/taskTemplates/{templateId} (same fields the website writes). */
export type TaskTemplate = {
  id: string;
  name: string;
  description: string;
  priority: Priority;
  assignee: string;
  assignees: string[];
  assignedToAll: boolean;
  dueDate: string;
  estimatedTime: number;
  tags: string[];
  subTasks: { title: string }[];
  createdBy: string;
};

export type TaskTemplateInput = Omit<TaskTemplate, 'id' | 'createdBy'>;

/** The member's running task timer (users/{uid}/private/projectTimer; legacy users/{uid}.activeTimer), shared with the website. */
export type ActiveTaskTimer = { taskId: string; projectId: string; startedAt: Date };

/** Website project page automation rules (enabled flags persist in projects/{id}.automationRules). */
export type AutomationRule = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  isPremium: boolean;
  enabled: boolean;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: ProjectRole;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  joinedAt?: string;
  membershipStatus?: ProjectMembershipStatus;
  /** A pending invitation that came by email and expired (website decision D3); owners and admins can resend it. */
  inviteExpired?: boolean;
  isOwner?: boolean;
};

/**
 * An email invitation as a project's owner and admins see it (mutateProjectMembership "email_invites"). It expires 14
 * days after it was sent; sending it again starts a new 14 days.
 */
export type ProjectEmailInvitation = {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'expired';
  /** ISO time it expires (or expired). */
  expiresAt: string;
};

export type ProjectTeamMember = {
  role?: ProjectRole;
  membershipStatus?: ProjectMembershipStatus;
  invitedBy?: string;
  invitedByName?: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  status: ProjectStatus;
  role: ProjectRole;
  membershipStatus: ProjectMembershipStatus;
  invitedByName?: string;
  totalTasks: number;
  completedTasks: number;
  teamMembers: number;
  progress: number;
  color: string;
  updatedAt: Date;
  createdAt: Date;
  dueDate: string | null;
  visibility: ProjectVisibility;
  tags: string[];
  isOwner?: boolean;
  memberUids?: string[];
  planTier: ProjectPlanTier;
  automationRules: { [ruleId: string]: boolean };
  /** When and by whom the status last changed through a lifecycle transition (null / '' for older projects). */
  statusChangedAt?: Date | null;
  statusChangedBy?: string;
  /** The project's link to a sponsoring Community (server-written; at most one waiting or approved). */
  communityLink?: ProjectCommunityLink | null;
  /** Optional modules a manager switched on or off (server-written; defaults in ProjectModuleRules). */
  modules: ProjectModuleFlags;
  /** projects/{id}/outcomes/{latestOutcomeId}: the outcome recorded when the project was last completed ('' when none). */
  latestOutcomeId: string;
};

/** projects/{id}.communityLink: 'declined' stays until the project asks again; an ended link is removed. */
export type ProjectCommunityLink = { communityId: string; communityName: string; status: 'pending' | 'active' | 'declined' };

/** A card in a Community's Projects section (safe fields only: no description, members or tasks). */
export type CommunityProjectCard = {
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  progress: number;
  ownerDisplayName: string;
  status: 'pending' | 'active' | 'declined' | 'ended';
};

export type CommunityProjectList = { active: CommunityProjectCard[]; pending: CommunityProjectCard[]; canDecide: boolean };

/** A Community the signed-in manager may ask to sponsor a project. */
export type CommunityLinkCandidate = { id: string; title: string; isPrivate: boolean };

export type CommunityLinkResultStatus = 'pending' | 'active' | 'declined' | 'ended' | 'none';

export type ProjectVisibility = 'public' | 'private';

/**
 * Fields the project form edits beyond name and description. Status is not one of them: it changes only through
 * ProjectService.transitionProject (server-checked and recorded in the project's activity log).
 */
export type ProjectSettingsUpdate = {
  name?: string;
  description?: string;
  color?: string;
  dueDate?: string | null;
  visibility?: ProjectVisibility;
  tags?: string[];
};

/** New projects always start active. */
export type CreateProjectInput = {
  name: string;
  description: string;
  color?: string;
  dueDate?: string | null;
  visibility?: ProjectVisibility;
  tags?: string[];
};

/** A status change request (mutateProjectMembership "transition"). */
export type ProjectTransitionInput = { expectedStatus: ProjectStatus; toStatus: ProjectStatus; reason?: string; outcome?: ProjectOutcomeInput };

/** Event types in projects/{id}/activity (website functions/src/ProjectActivityService.ts). Unknown types read as 'unknown'. */
export type ProjectActivityType =
  | 'project.created' | 'project.status_changed' | 'project.deleted' | 'project.ownership_transferred' | 'project.settings_changed'
  | 'member.invited' | 'member.invite_cancelled' | 'member.joined' | 'member.declined' | 'member.left' | 'member.removed' | 'member.role_changed'
  | 'milestone.created' | 'milestone.updated' | 'milestone.completed' | 'milestone.reopened' | 'milestone.deleted'
  | 'community.link_requested' | 'community.link_cancelled' | 'community.link_approved' | 'community.link_declined' | 'community.link_ended'
  | 'project.modules_changed' | 'project.outcome_recorded'
  | 'deliverable.created' | 'deliverable.updated' | 'deliverable.evidence_added' | 'deliverable.evidence_removed' | 'deliverable.submitted'
  | 'deliverable.accepted' | 'deliverable.changes_requested' | 'deliverable.reopened' | 'deliverable.shared' | 'deliverable.deleted'
  | 'register.created' | 'register.updated' | 'register.status_changed' | 'register.deleted'
  | 'stakeholder.invited' | 'stakeholder.joined' | 'stakeholder.declined' | 'stakeholder.left' | 'stakeholder.removed' | 'stakeholder.role_changed'
  | 'milestone.shared' | 'question.asked' | 'question.answered'
  | 'unknown';

export type ProjectActivitySubjectKind =
  | 'project' | 'member' | 'email_invite' | 'milestone' | 'community' | 'deliverable' | 'risk' | 'issue' | 'decision' | 'change_request'
  | 'stakeholder' | 'question' | 'outcome' | 'unknown';

/** One decoded activity event. Names are never stored; screens resolve actorId and subjectId from the loaded team. */
export type ProjectActivityEvent = {
  id: string;
  type: ProjectActivityType;
  actorId: string;
  subjectKind: ProjectActivitySubjectKind;
  subjectId: string;
  /** Null until the server timestamp resolves. */
  at: Date | null;
  from: string;
  to: string;
  role: string;
  reason: string;
  channel: string;
  changed: string[];
  /** Milestone or Community name stored with the event (project content, never a person's name). */
  title: string;
  /** community.link_ended: who ended it ('project', 'community' or 'system'). */
  by: string;
  selfApproved: boolean;
  /** Phase 3: register kind, deliverable revision, review role ('manager' | 'stakeholder' | 'team'), share flag, module lists. */
  kind: string;
  revision: number | null;
  byRole: string;
  shared: boolean | null;
  enabled: string[];
  disabled: string[];
  acceptedCount: number | null;
};

/** A page of activity; pass `cursor` back to load the next page (null when there are no more). */
export type ProjectActivityPage = { events: ProjectActivityEvent[]; cursor: ProjectActivityCursor | null };
/** Firestore position of the last event of a page. */
export type ProjectActivityCursor = QueryDocumentSnapshot<DocumentData>;

export type CreateTaskInput = {
  title: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  assignee?: string;
  assignees?: string[];
  dueDate?: string;
  estimatedTime?: number;
  tags?: string[];
};

/** Every field of the website's TaskCreationModal (sent to mutateProjectTask "create"). */
export type FullTaskInput = {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assignee: string;
  assignees: string[];
  assignedToAll: boolean;
  startDate: string;
  dueDate: string;
  estimatedTime: number;
  tags: string[];
  dependencies: string[];
  milestoneId: string;
  recurrence?: RecurrenceRule;
};

/** Editable task fields accepted by mutateProjectTask "update" (functions/src/TaskFieldService.ts). */
export type TaskFieldUpdate = Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'assignees' | 'assignedToAll' | 'startDate' | 'dueDate' | 'estimatedTime' | 'tags' | 'dependencies' | 'milestoneId'>> & { recurrence?: RecurrenceRule | null };

/** A file picked on the phone, waiting to be uploaded as a task attachment. */
export type PickedTaskFile = { uri: string; name: string; size: number; mimeType: string };

// ── eProjects Phase 3 (optional modules; server contracts in the website's functions/src/Project*Service.ts) ──

export type ProjectModuleFlags = { timeline: boolean; time: boolean; deliverables: boolean; registers: boolean; stakeholders: boolean };

/** Server-derived dependency state on a task (website functions/src/ProjectScheduleRules.ts). */
export type TaskScheduleState = { waitingOn: string[]; predecessorDue: { [taskId: string]: string }; earliestStart: string | null; conflict: boolean };

export type DeliverableStatus = 'draft' | 'submitted' | 'accepted' | 'changes_requested';
export type DeliverableEvidence = { id: string; kind: 'link' | 'file'; url: string; name: string; size?: number; type?: string; addedBy: string; addedAt: string };
export type RecordHistoryEntry = { at: string; actorId: string; action: string; changed: string[]; from: string; to: string; note: string; revision: number | null };
export type DeliverableReview = { decision: 'accepted' | 'changes_requested'; note: string; decidedBy: string; decidedRole: 'manager' | 'stakeholder'; decidedAt: string; revision: number; selfApproved: boolean };
/** projects/{p}/deliverables/{id}. */
export type ProjectDeliverable = {
  id: string;
  title: string;
  description: string;
  milestoneId: string;
  ownerId: string;
  dueDate: string;
  acceptanceCriteria: string[];
  evidence: DeliverableEvidence[];
  status: DeliverableStatus;
  reviewerIds: string[];
  sharedWithStakeholders: boolean;
  revision: number;
  review: DeliverableReview | null;
  history: RecordHistoryEntry[];
  createdBy: string;
};
export type DeliverableFieldsInput = { title: string; description: string; milestoneId: string; ownerId: string; dueDate: string; acceptanceCriteria: string[] };

export type ProjectRegisterKind = 'risk' | 'issue' | 'decision' | 'change_request';
export type RegisterLevel = 'low' | 'medium' | 'high';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
/** One record of projects/{p}/{risks|issues|decisions|changeRequests}; fields that do not apply to its kind are ''. */
export type ProjectRegisterRecord = {
  id: string;
  kind: ProjectRegisterKind;
  title: string;
  description: string;
  ownerId: string;
  dueDate: string;
  status: string;
  likelihood: RegisterLevel | '';
  impact: RegisterLevel | '';
  score: number;
  mitigation: string;
  severity: IssueSeverity | '';
  resolution: string;
  decision: string;
  rationale: string;
  decidedOn: string;
  reason: string;
  impactSummary: string;
  requestedBy: string;
  /** A change request's approval or rejection. */
  verdict: { status: string; by: string; at: string; note: string; selfApproved: boolean } | null;
  history: RecordHistoryEntry[];
  createdBy: string;
  updatedAt: Date | null;
};
export type RegisterFieldsInput = Partial<{
  title: string; description: string; ownerId: string; dueDate: string;
  likelihood: RegisterLevel; impact: RegisterLevel; mitigation: string;
  severity: IssueSeverity; resolution: string;
  decision: string; rationale: string; decidedOn: string;
  reason: string; impactSummary: string;
}>;

/** One private time entry (projects/{p}/timeEntries/{id}); only its author can read it. */
export type ProjectTimeEntry = {
  id: string;
  userId: string;
  taskId: string;
  minutes: number;
  date: string;
  note: string;
  source: 'manual' | 'timer' | 'legacy';
  status: 'active' | 'void';
  voidReason: string;
  corrections: { at: string; minutes: number; date: string; note: string; reason: string }[];
};
/** projects/{p}/timeTotals/summary (owners and admins only). */
export type ProjectTimeSummary = { totalMinutes: number; entryCount: number; byMember: { [uid: string]: number }; byTask: { [taskId: string]: number } };

export type StakeholderRole = 'client' | 'reviewer';
/** projectStakeholders/{projectId}_{uid}: a client or reviewer outside the project team. */
export type ProjectStakeholder = { id: string; projectId: string; uid: string; role: StakeholderRole; status: 'pending' | 'accepted'; invitedBy: string; projectName: string; expiresAt: Date | null };

export type PortalMilestone = { id: string; name: string; description: string; dueDate: string; completed: boolean };
export type PortalDeliverable = {
  id: string; title: string; description: string; milestoneId: string; dueDate: string; status: string; revision: number;
  acceptanceCriteria: string[]; evidence: { id: string; kind: string; url: string; name: string }[];
  canReview: boolean; review: { decision: string; note: string; decidedRole: string; decidedAt: string; revision: number } | null;
};
export type PortalQuestion = { id: string; body: string; askedByRole: string; mine: boolean; status: string; answer: string; answeredByRole: string; createdAt: string; answeredAt: string; deliverableId: string };
/** The stakeholder_portal answer: only what was shared with clients and reviewers. */
export type StakeholderPortal = {
  project: { id: string; name: string; status: string };
  viewer: { role: StakeholderRole | 'manager' | 'member'; status: 'pending' | 'accepted'; expiresAt: string };
  milestones: PortalMilestone[];
  deliverables: PortalDeliverable[];
  questions: PortalQuestion[];
};

export type ProjectOutcomeInput = { summary: string; beneficiaries: string; results: string; lessons: string };
/** projects/{p}/outcomes/{id}: recorded when the project is completed; members only, never published. */
export type ProjectOutcome = ProjectOutcomeInput & {
  id: string;
  acceptedDeliverables: { id: string; title: string; milestoneId: string; revision: number }[];
  acceptedCount: number;
  recordedBy: string;
  recordedAt: Date | null;
};

export type ReportTaskRow = { id: string; title: string; status: string; assignees: string[]; dueDate: string; milestoneId: string; estimateHours: number; waiting: boolean; conflict: boolean; overdue: boolean };
/** The server's bounded project report (project_report); every total comes from the server. */
export type ProjectReport = {
  generatedAt: string;
  project: { id: string; name: string; status: string; progress: number; endDate: string; statusChangedAt: string };
  modules: ProjectModuleFlags;
  truncated: string[];
  tasks: { total: number; todo: number; inProgress: number; done: number; overdue: number; waiting: number; conflicts: number; estimateHours: number; rows: ReportTaskRow[] };
  milestones: { id: string; name: string; dueDate: string; completed: boolean; taskCount: number; doneCount: number; sharedWithStakeholders: boolean }[];
  deliverables: { counts: { [status: string]: number }; rows: { id: string; title: string; status: string; milestoneId: string; dueDate: string; revision: number; ownerId: string }[] } | null;
  registers: {
    risks: { open: number; rows: { id: string; title: string; status: string; likelihood: string; impact: string; score: number; ownerId: string; dueDate: string }[] };
    issues: { open: number; rows: { id: string; title: string; status: string; severity: string; ownerId: string; dueDate: string }[] };
    changeRequests: { counts: { [status: string]: number } };
    decisions: number;
  } | null;
  time: { scope: 'team' | 'own'; totalMinutes: number; byTask: { taskId: string; minutes: number }[]; byMember: { userId: string; minutes: number }[] } | null;
  outcome: { summary: string; beneficiaries: string; results: string; lessons: string; acceptedCount: number; recordedAt: string; recordedBy: string } | null;
};
