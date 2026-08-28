export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'archived';
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';
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
  isOwner?: boolean;
  memberUids?: string[];
};

export type CreateProjectInput = {
  name: string;
  description: string;
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

