export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'archived';
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';
export type ProjectMembershipStatus = 'accepted' | 'pending';

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
};

export type CreateProjectInput = {
  name: string;
  description: string;
};
