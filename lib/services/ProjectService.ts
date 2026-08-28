import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { apiService } from '@/lib/services/ApiService';
import type {
  Comment,
  CreateProjectInput,
  CreateTaskInput,
  FileAttachment,
  ProjectMembershipStatus,
  ProjectRecord,
  ProjectRole,
  ProjectStatus,
  ProjectTeamMember,
  Status,
  SubTask,
  Task,
  TeamMember,
  TimeEntry,
} from '@/lib/types/project';

type ClaimProjectInvitesResponse = { success: boolean; claimed?: number };
type RespondProjectInviteResponse = { success: boolean; message?: string };
type InviteProjectMemberResponse = { success: boolean; message?: string };

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
  memberUids?: string[];
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

  public async getProject(projectId: string): Promise<{ project: ProjectRecord; teamMembers: TeamMember[] }> {
    const userId = this.requireUserId();
    const projectDocument = await getDoc(doc(db, 'projects', projectId));
    if (!projectDocument.exists()) throw new Error('Project not found');
    const project = this.mapProject(projectDocument as QueryDocumentSnapshot<DocumentData>, userId);
    project.ownerName = await this.resolveUserName(project.ownerId);
    const data = projectDocument.data() as ProjectDocument;
    const rawMembers = data.teamMembers ?? {};
    const memberUserIds = Object.keys(rawMembers);
    const teamMembers: TeamMember[] = await Promise.all(
      memberUserIds.map(async (memberId) => {
        const memberData = rawMembers[memberId];
        const userProfile = await this.resolveUserProfile(memberId);
        return {
          id: memberId,
          name: userProfile.name,
          email: userProfile.email,
          avatar: userProfile.avatar,
          role: this.readRole(memberData?.role),
          membershipStatus: this.readMembershipStatus(memberData?.membershipStatus),
          status: 'online',
          isOwner: memberId === project.ownerId,
        };
      })
    );
    return { project, teamMembers };
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

  public async updateProjectSettings(projectId: string, updates: { name?: string; description?: string; status?: ProjectStatus }): Promise<void> {
    const projectReference = doc(db, 'projects', projectId);
    await updateDoc(projectReference, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  public async deleteProject(projectId: string): Promise<void> {
    await deleteDoc(doc(db, 'projects', projectId));
  }

  public async leaveProject(projectId: string): Promise<void> {
    const userId = this.requireUserId();
    const projectRef = doc(db, 'projects', projectId);
    const snapshot = await getDoc(projectRef);
    if (!snapshot.exists()) return;
    const data = snapshot.data() as ProjectDocument;
    const nextMembers = { ...(data.teamMembers ?? {}) };
    delete nextMembers[userId];
    const nextUids = (data.memberUids ?? []).filter((uid) => uid !== userId);
    await updateDoc(projectRef, {
      teamMembers: nextMembers,
      memberUids: nextUids,
      updatedAt: serverTimestamp(),
    });
  }

  public subscribeToTasks(projectId: string, onUpdate: (tasks: Task[]) => void, onError?: (error: Error) => void): () => void {
    const tasksQuery = collection(db, 'projects', projectId, 'tasks');
    return onSnapshot(
      tasksQuery,
      (snapshot) => {
        const tasks = snapshot.docs.map((docSnap) => this.mapTask(docSnap));
        onUpdate(tasks);
      },
      (error) => {
        if (onError) onError(error);
      }
    );
  }

  public async fetchTasks(projectId: string): Promise<Task[]> {
    const tasksSnapshot = await getDocs(collection(db, 'projects', projectId, 'tasks'));
    return tasksSnapshot.docs.map((docSnap) => this.mapTask(docSnap));
  }

  public async createTask(projectId: string, input: CreateTaskInput): Promise<string> {
    const userId = this.requireUserId();
    const taskData = {
      title: input.title.trim(),
      description: (input.description ?? '').trim(),
      status: input.status ?? 'todo',
      priority: input.priority ?? 'medium',
      assignee: input.assignee ?? userId,
      assignees: input.assignees ?? [input.assignee ?? userId],
      assignedToAll: false,
      createdBy: userId,
      dueDate: input.dueDate ?? new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subTasks: [],
      comments: [],
      attachments: [],
      timeEntries: [],
      estimatedTime: input.estimatedTime ?? 1,
      tags: input.tags ?? [],
      progress: 0,
      archived: false,
    };
    const taskReference = await addDoc(collection(db, 'projects', projectId, 'tasks'), taskData);
    await this.recalculateProjectStats(projectId);
    return taskReference.id;
  }

  public async updateTaskStatus(projectId: string, taskId: string, status: Status): Promise<void> {
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    await updateDoc(taskRef, {
      status,
      updatedAt: new Date().toISOString(),
      progress: status === 'done' ? 100 : status === 'in-progress' ? 50 : 0,
    });
    await this.recalculateProjectStats(projectId);
  }

  public async updateTask(projectId: string, taskId: string, updates: Partial<Task>): Promise<void> {
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    await updateDoc(taskRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await this.recalculateProjectStats(projectId);
  }

  public async deleteTask(projectId: string, taskId: string): Promise<void> {
    await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId));
    await this.recalculateProjectStats(projectId);
  }

  public async addSubTask(projectId: string, taskId: string, title: string): Promise<void> {
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) return;
    const task = this.mapTask(taskSnap);
    const newSubTask: SubTask = {
      id: `sub_${Date.now()}`,
      title: title.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const nextSubTasks = [...task.subTasks, newSubTask];
    const completedCount = nextSubTasks.filter((s) => s.completed).length;
    const progress = Math.round((completedCount / nextSubTasks.length) * 100);
    await updateDoc(taskRef, {
      subTasks: nextSubTasks,
      progress,
      updatedAt: new Date().toISOString(),
    });
  }

  public async toggleSubTask(projectId: string, taskId: string, subtaskId: string): Promise<void> {
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) return;
    const task = this.mapTask(taskSnap);
    const nextSubTasks = task.subTasks.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s));
    const completedCount = nextSubTasks.filter((s) => s.completed).length;
    const progress = nextSubTasks.length > 0 ? Math.round((completedCount / nextSubTasks.length) * 100) : task.progress;
    await updateDoc(taskRef, {
      subTasks: nextSubTasks,
      progress,
      updatedAt: new Date().toISOString(),
    });
  }

  public async addComment(projectId: string, taskId: string, content: string): Promise<void> {
    const userId = this.requireUserId();
    const userProfile = await this.resolveUserProfile(userId);
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) return;
    const task = this.mapTask(taskSnap);
    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      author: userProfile.name,
      avatar: userProfile.avatar,
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    await updateDoc(taskRef, {
      comments: [...task.comments, newComment],
      updatedAt: new Date().toISOString(),
    });
  }

  public async addTimeEntry(projectId: string, taskId: string, duration: number, description = ''): Promise<void> {
    const userId = this.requireUserId();
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) return;
    const task = this.mapTask(taskSnap);
    const newEntry: TimeEntry = {
      id: `time_${Date.now()}`,
      taskId,
      userId,
      startTime: new Date(Date.now() - duration * 60000).toISOString(),
      duration,
      description,
      date: new Date().toISOString().split('T')[0],
    };
    await updateDoc(taskRef, {
      timeEntries: [...task.timeEntries, newEntry],
      updatedAt: new Date().toISOString(),
    });
  }

  public async inviteMember(projectId: string, emailOrUserId: string, role: ProjectRole): Promise<void> {
    await apiService.request<InviteProjectMemberResponse>('/api/projects/invite', {
      method: 'POST',
      authenticated: true,
      body: {
        projectId,
        recipient: emailOrUserId,
        role,
      },
    });
  }

  public async changeMemberRole(projectId: string, targetUserId: string, role: ProjectRole): Promise<void> {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      [`teamMembers.${targetUserId}.role`]: role,
      updatedAt: serverTimestamp(),
    });
  }

  public async removeMember(projectId: string, targetUserId: string): Promise<void> {
    const projectRef = doc(db, 'projects', projectId);
    const snapshot = await getDoc(projectRef);
    if (!snapshot.exists()) return;
    const data = snapshot.data() as ProjectDocument;
    const nextMembers = { ...(data.teamMembers ?? {}) };
    delete nextMembers[targetUserId];
    const nextUids = (data.memberUids ?? []).filter((uid) => uid !== targetUserId);
    await updateDoc(projectRef, {
      teamMembers: nextMembers,
      memberUids: nextUids,
      updatedAt: serverTimestamp(),
    });
  }

  public async transferOwnership(projectId: string, newOwnerId: string): Promise<void> {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      ownerId: newOwnerId,
      [`teamMembers.${newOwnerId}.role`]: 'owner',
      updatedAt: serverTimestamp(),
    });
  }

  private async recalculateProjectStats(projectId: string): Promise<void> {
    try {
      const tasksSnapshot = await getDocs(collection(db, 'projects', projectId, 'tasks'));
      const tasks = tasksSnapshot.docs.map((docSnap) => this.mapTask(docSnap));
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === 'done').length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      await updateDoc(doc(db, 'projects', projectId), {
        totalTasks,
        completedTasks,
        progress,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-blocking background stat recalculation
    }
  }

  private mapTask(snapshot: QueryDocumentSnapshot<DocumentData> | DocumentData): Task {
    const data = (typeof snapshot.data === 'function' ? snapshot.data() : snapshot) as Record<string, unknown>;
    return {
      id: snapshot.id || this.readString(data.id),
      title: this.readString(data.title) || 'Untitled task',
      description: this.readString(data.description),
      status: data.status === 'done' || data.status === 'in-progress' ? data.status : 'todo',
      priority: data.priority === 'urgent' || data.priority === 'high' || data.priority === 'low' ? data.priority : 'medium',
      assignee: this.readString(data.assignee),
      assignees: Array.isArray(data.assignees) ? data.assignees.map((id) => this.readString(id)).filter(Boolean) : [],
      assignedToAll: data.assignedToAll === true,
      createdBy: this.readString(data.createdBy),
      dueDate: this.readString(data.dueDate),
      createdAt: this.readString(data.createdAt) || new Date().toISOString(),
      updatedAt: this.readString(data.updatedAt) || new Date().toISOString(),
      subTasks: Array.isArray(data.subTasks) ? (data.subTasks as SubTask[]) : [],
      comments: Array.isArray(data.comments) ? (data.comments as Comment[]) : [],
      attachments: Array.isArray(data.attachments) ? (data.attachments as FileAttachment[]) : [],
      timeEntries: Array.isArray(data.timeEntries) ? (data.timeEntries as TimeEntry[]) : [],
      estimatedTime: this.readNumber(data.estimatedTime, 1),
      tags: Array.isArray(data.tags) ? data.tags.map((tag) => this.readString(tag)).filter(Boolean) : [],
      progress: this.readNumber(data.progress, 0),
      archived: data.archived === true,
    };
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
      isOwner: ownerId === userId,
      membershipStatus: this.readMembershipStatus(membership?.membershipStatus),
      invitedByName: this.readString(membership?.invitedByName) || undefined,
      totalTasks: this.readNumber(data.totalTasks),
      completedTasks: this.readNumber(data.completedTasks),
      teamMembers: teamMemberValues.filter((member) => member.membershipStatus !== 'pending').length,
      progress: this.readNumber(data.progress),
      color: this.readString(data.color) || 'bg-emerald-500',
      updatedAt: this.readDate(data.updatedAt),
      memberUids: data.memberUids ?? [],
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

  private async resolveUserProfile(userId: string): Promise<{ name: string; email: string; avatar: string }> {
    try {
      const userDocument = await getDoc(doc(db, 'users', userId));
      const userData = userDocument.data();
      const fullName = [this.readString(userData?.firstName), this.readString(userData?.lastName)].filter(Boolean).join(' ');
      return {
        name: this.readString(userData?.displayName) || fullName || this.readString(userData?.userName) || 'User',
        email: this.readString(userData?.email),
        avatar: this.readString(userData?.profileImage) || this.readString(userData?.avatar) || '',
      };
    } catch {
      return { name: 'User', email: '', avatar: '' };
    }
  }

  private readString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }

  private readNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

