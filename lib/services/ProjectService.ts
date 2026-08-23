import {
  addDoc,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  serverTimestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { apiService } from '@/lib/services/ApiService';
import type {
  CreateProjectInput,
  ProjectMembershipStatus,
  ProjectRecord,
  ProjectRole,
  ProjectStatus,
  ProjectTeamMember,
} from '@/lib/types/project';

type ClaimProjectInvitesResponse = { success: boolean; claimed?: number };
type RespondProjectInviteResponse = { success: boolean; message?: string };

type ProjectDocument = {
  name?: unknown;
  description?: unknown;
  ownerId?: unknown;
  ownerName?: unknown;
  status?: unknown;
  progress?: unknown;
  totalTasks?: unknown;
  completedTasks?: unknown;
  color?: unknown;
  updatedAt?: unknown;
  teamMembers?: { [userId: string]: ProjectTeamMember };
};

export class ProjectService {
  private static instance: ProjectService;

  private constructor() {}

  public static getInstance(): ProjectService {
    if (!ProjectService.instance) ProjectService.instance = new ProjectService();
    return ProjectService.instance;
  }

  public async listForCurrentUser(): Promise<ProjectRecord[]> {
    const userId = this.requireUserId();
    const projectQuery = query(collection(db, 'projects'), where('memberUids', 'array-contains', userId));
    const snapshot = await getDocs(projectQuery);
    const projects = snapshot.docs.map((projectSnapshot) => this.mapProject(projectSnapshot, userId));
    const ownerIds = [...new Set(projects.map((project) => project.ownerId).filter(Boolean))];
    const ownerEntries = await Promise.all(ownerIds.map(async (ownerId) => [ownerId, await this.resolveUserName(ownerId)] as const));
    const ownerNames = new Map(ownerEntries);
    return projects
      .map((project) => ({ ...project, ownerName: project.ownerName || ownerNames.get(project.ownerId) || 'Project owner' }))
      .sort((leftProject, rightProject) => rightProject.updatedAt.getTime() - leftProject.updatedAt.getTime());
  }

  public async claimEmailInvites(): Promise<number> {
    const response = await apiService.request<ClaimProjectInvitesResponse>('/api/projects/invite', {
      method: 'POST',
      authenticated: true,
      body: { action: 'claim' },
    });
    return response.claimed ?? 0;
  }

  public async respondToInvite(projectId: string, action: 'accept' | 'decline'): Promise<void> {
    await apiService.request<RespondProjectInviteResponse>('/api/projects/respondInvite', {
      method: 'POST',
      authenticated: true,
      body: { projectId, action },
    });
  }

  public async createProject(input: CreateProjectInput): Promise<string> {
    const userId = this.requireUserId();
    const trimmedName = input.name.trim();
    if (!trimmedName) throw new Error('Project name is required.');
    const projectReference = await addDoc(collection(db, 'projects'), {
      name: trimmedName,
      description: input.description.trim(),
      ownerId: userId,
      memberUids: [userId],
      teamMembers: {
        [userId]: { role: 'owner', membershipStatus: 'accepted' },
      },
      status: 'active',
      visibility: 'private',
      totalTasks: 0,
      completedTasks: 0,
      progress: 0,
      color: 'bg-emerald-500',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return projectReference.id;
  }

  private requireUserId(): string {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('You must be signed in to use projects.');
    return userId;
  }

  private mapProject(snapshot: QueryDocumentSnapshot<DocumentData>, userId: string): ProjectRecord {
    const data = snapshot.data() as ProjectDocument;
    const membership = data.teamMembers?.[userId];
    const ownerId = this.readString(data.ownerId);
    const role = ownerId === userId ? 'owner' : this.readRole(membership?.role);
    const teamMemberValues = Object.values(data.teamMembers ?? {});
    return {
      id: snapshot.id,
      name: this.readString(data.name) || 'Untitled project',
      description: this.readString(data.description),
      ownerId,
      ownerName: this.readString(data.ownerName),
      status: this.readStatus(data.status),
      role,
      membershipStatus: this.readMembershipStatus(membership?.membershipStatus),
      invitedByName: this.readString(membership?.invitedByName) || undefined,
      totalTasks: this.readNumber(data.totalTasks),
      completedTasks: this.readNumber(data.completedTasks),
      teamMembers: teamMemberValues.filter((member) => member.membershipStatus !== 'pending').length,
      progress: this.readNumber(data.progress),
      color: this.readString(data.color) || 'bg-emerald-500',
      updatedAt: this.readDate(data.updatedAt),
    };
  }

  private async resolveUserName(userId: string): Promise<string> {
    try {
      const userDocument = await getDoc(doc(db, 'users', userId));
      const userData = userDocument.data();
      const fullName = [this.readString(userData?.firstName), this.readString(userData?.lastName)].filter(Boolean).join(' ');
      return this.readString(userData?.displayName)
        || fullName
        || this.readString(userData?.userName)
        || this.readString(userData?.email)
        || 'Project owner';
    } catch {
      return 'Project owner';
    }
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private readNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private readDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (value && typeof value === 'object' && 'toDate' in value) {
      const toDate = (value as { toDate?: unknown }).toDate;
      if (typeof toDate === 'function') return toDate.call(value) as Date;
    }
    return new Date(0);
  }

  private readRole(value: unknown): ProjectRole {
    return value === 'owner' || value === 'admin' || value === 'viewer' ? value : 'member';
  }

  private readStatus(value: unknown): ProjectStatus {
    if (value === 'completed' || value === 'on-hold' || value === 'archived') return value;
    if (value === 'on_hold') return 'on-hold';
    return 'active';
  }

  private readMembershipStatus(value: unknown): ProjectMembershipStatus {
    return value === 'pending' ? 'pending' : 'accepted';
  }
}

export const projectService = ProjectService.getInstance();
