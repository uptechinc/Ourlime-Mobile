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

/** users/{uid}.activeTimer (the website's persisted task timer). */
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
  isOwner?: boolean;
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
export type ProjectTransitionInput = { expectedStatus: ProjectStatus; toStatus: ProjectStatus; reason?: string };

/** Event types in projects/{id}/activity (website functions/src/ProjectActivityService.ts). Unknown types read as 'unknown'. */
export type ProjectActivityType =
  | 'project.created' | 'project.status_changed' | 'project.deleted' | 'project.ownership_transferred' | 'project.settings_changed'
  | 'member.invited' | 'member.invite_cancelled' | 'member.joined' | 'member.declined' | 'member.left' | 'member.removed' | 'member.role_changed'
  | 'milestone.created' | 'milestone.updated' | 'milestone.completed' | 'milestone.reopened' | 'milestone.deleted'
  | 'community.link_requested' | 'community.link_cancelled' | 'community.link_approved' | 'community.link_declined' | 'community.link_ended'
  | 'unknown';

/** One decoded activity event. Names are never stored; screens resolve actorId and subjectId from the loaded team. */
export type ProjectActivityEvent = {
  id: string;
  type: ProjectActivityType;
  actorId: string;
  subjectKind: 'project' | 'member' | 'email_invite' | 'milestone' | 'community' | 'unknown';
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
