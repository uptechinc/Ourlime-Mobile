export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'archived';
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
};

export type ProjectVisibility = 'public' | 'private';

/** Fields the website's project form edits beyond name and description. */
export type ProjectSettingsUpdate = {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  dueDate?: string | null;
  visibility?: ProjectVisibility;
  tags?: string[];
};

export type CreateProjectInput = {
  name: string;
  description: string;
  dueDate?: string | null;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  tags?: string[];
};

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
