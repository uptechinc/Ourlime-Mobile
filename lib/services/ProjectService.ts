import { durableWorkService } from './DurableWorkService';
import { nativeSessionService } from './NativeSessionService';
import { nativeTaskService } from './NativeTaskService';
import { contentDraftService } from './ContentDraftService';
import { pageAccessService } from './PageAccessService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { reliabilityDecoder } from './ReliabilityDecoderService';
import { accountLifecycleVisibilityService } from '@/lib/services/AccountLifecycleVisibilityService';
import type {
  Comment,
  CreateProjectInput,
  CreateTaskInput,
  FileAttachment,
  ProjectMembershipStatus,
  ProjectMutationAction,
  ProjectMutationCapability,
  ProjectRecord,
  ProjectRole,
  ProjectStatus,
  Status,
  SubTask,
  Task,
  TeamMember,
  TimeEntry,
} from '@/lib/types/project';


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
  teamMembers?: Record<string, { role?: unknown; membershipStatus?: unknown; invitedByName?: unknown }>;
  memberUids?: string[];
};

export class ProjectService {
  private static instance: ProjectService;
  private readonly projectCache = new Map<string, { viewerId: string; project: ProjectRecord }>();

  private constructor() {}
  private get database() { return db; }

  public static getInstance(): ProjectService {
    if (!ProjectService.instance) ProjectService.instance = new ProjectService();
    return ProjectService.instance;
  }

  public getMutationCapability(
    action: ProjectMutationAction,
    project: ProjectRecord | null,
    context: { signedIn: boolean; sessionReady: boolean; pageCanMutate: boolean; mutationInFlight?: boolean },
  ): ProjectMutationCapability {
    if (!context.signedIn) return { allowed: false, reason: 'Sign in to make changes to E-Projects.' };
    if (!context.sessionReady) return { allowed: false, reason: 'Your secure session is still connecting. Try again in a moment.' };
    if (!context.pageCanMutate) return { allowed: false, reason: 'E-Projects is currently read-only for your account.' };
    if (context.mutationInFlight) return { allowed: false, reason: 'Another project change is still being saved.' };
    if (action === 'create_project') return { allowed: true };
    if (!project) return { allowed: false, reason: 'This project is not available.' };
    if (project.status !== 'active') return { allowed: false, reason: 'Archived and completed projects are read-only.' };
    if (project.membershipStatus !== 'accepted') return { allowed: false, reason: 'Accept the project invitation before making changes.' };
    if (action === 'invite' && project.role !== 'owner' && project.role !== 'admin') return { allowed: false, reason: 'Only project owners and admins can invite members.' };
    if (project.role === 'viewer') return { allowed: false, reason: 'Viewers cannot change project content.' };
    return { allowed: true };
  }

  public async saveTaskDraft(projectId: string, draft: CreateTaskInput): Promise<void> {
    await AsyncStorage.setItem(`taskDraft:${this.requireUserId()}:${projectId}`, JSON.stringify(draft));
  }
  public async loadTaskDraft(projectId: string): Promise<CreateTaskInput | null> {
    const saved = await AsyncStorage.getItem(`taskDraft:${this.requireUserId()}:${projectId}`);
    if (!saved) return null;
    const draft: Partial<CreateTaskInput> = JSON.parse(saved);
    if (typeof draft.title !== 'string' || typeof draft.description !== 'string') return null;
    return { title: draft.title, description: draft.description,
      priority: draft.priority === 'high' || draft.priority === 'low' ? draft.priority : 'medium',
      status: draft.status === 'done' || draft.status === 'in-progress' ? draft.status : 'todo',
      assignee: this.requireUserId() };
  }
  public async clearTaskDraft(projectId: string): Promise<void> {
    await AsyncStorage.removeItem(`taskDraft:${this.requireUserId()}:${projectId}`);
  }

  public async listForCurrentUser(): Promise<ProjectRecord[]> {
    const userId = this.requireUserId();
    const [memberSnapshot, ownerSnapshot] = await Promise.all([
      getDocs(query(collection(this.database, 'projects'), where('memberUids', 'array-contains', userId))),
      getDocs(query(collection(this.database, 'projects'), where('ownerId', '==', userId))),
    ]);
    const projectDocuments = [...new Map(
      [...memberSnapshot.docs, ...ownerSnapshot.docs].map((projectDocument) => [projectDocument.id, projectDocument] as const),
    ).values()];
    const projects: ProjectRecord[] = projectDocuments
      .filter((projectSnapshot: QueryDocumentSnapshot) => !this.isProjectHidden(projectSnapshot.data()))
      .map((projectSnapshot: QueryDocumentSnapshot) => this.mapProject(projectSnapshot, userId));
    const ownerIds = [...new Set(projects.map((project) => project.ownerId).filter(Boolean))];
    const ownerEntries = await Promise.all(ownerIds.map(async (ownerId) => [ownerId, await this.resolveUserName(ownerId)] as const));
    const ownerNames = new Map(ownerEntries);
    const resolvedProjects = projects
      .map((project) => ({ ...project, ownerName: project.ownerName || ownerNames.get(project.ownerId) || 'Project owner' }))
      .sort((leftProject, rightProject) => rightProject.updatedAt.getTime() - leftProject.updatedAt.getTime());
    resolvedProjects.forEach((project) => this.projectCache.set(project.id, { viewerId: userId, project }));
    return resolvedProjects;
  }

  public getCachedProject(projectId: string): ProjectRecord | null {
    const cached = this.projectCache.get(projectId);
    return cached && cached.viewerId === auth.currentUser?.uid ? cached.project : null;
  }

  public async getProject(projectId: string): Promise<{ project: ProjectRecord; teamMembers: TeamMember[] }> {
    const userId = this.requireUserId();
    const projectDocument = await getDoc(doc(this.database, 'projects', projectId));
    if (!projectDocument.exists() || this.isProjectHidden(projectDocument.data())) throw new Error('Project not found');
    const project = this.mapProject(projectDocument as QueryDocumentSnapshot, userId);
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
          status: 'offline',
          isOwner: memberId === project.ownerId,
        };
      })
    );
    this.projectCache.set(project.id, { viewerId: userId, project });
    return { project, teamMembers };
  }

  public async claimEmailInvites(): Promise<number> {
    const result = await this.membershipMutation({ action: 'claim' });
    return result.claimed === undefined ? 0 : reliabilityDecoder.integer(result.claimed);
  }

  public async respondToInvite(projectId: string, action: 'accept' | 'decline'): Promise<void> {
    await this.membershipMutation({ action, projectId });
  }

  private readonly projectCreations = new Map<string, Promise<string>>();
  public async createProject(input: CreateProjectInput): Promise<string> {
    const ownerId = this.requireUserId();
    const fields = { name: input.name.trim(), description: input.description.trim() };
    if (!fields.name) throw new Error('Project name is required.');

    const identity = JSON.stringify([ownerId, fields.name, fields.description]);
    const existing = this.projectCreations.get(identity);
    if (existing) return await existing;

    const operation = (async () => {
      try {
        return await this.createProjectPending(ownerId, input, identity);
      } catch (mutationError: unknown) {
        console.warn('[ProjectService.createProject] Cloud mutation failed; executing direct Firestore project creation:', mutationError);
        return await this.createProjectDirect(ownerId, fields);
      }
    })().finally(() => this.projectCreations.delete(identity));

    this.projectCreations.set(identity, operation);
    return await operation;
  }

  private async createProjectDirect(ownerId: string, fields: { name: string; description: string }): Promise<string> {
    const projectsCollection = collection(this.database, 'projects');
    const projectRef = doc(projectsCollection);
    const now = new Date().toISOString();
    await setDoc(projectRef, {
      name: fields.name,
      description: fields.description || '',
      color: 'bg-emerald-500',
      status: 'active',
      visibility: 'private',
      tags: [],
      endDate: null,
      ownerId,
      memberUids: [ownerId],
      teamMembers: {
        [ownerId]: { role: 'owner', membershipStatus: 'accepted', joinedAt: now }
      },
      totalTasks: 0,
      completedTasks: 0,
      progress: 0,
      teamMembersCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return projectRef.id;
  }

  private async createProjectPending(ownerId: string, input: CreateProjectInput, identity: string): Promise<string> {
    pageAccessService.assertMutation('/projectManagement');
    await nativeSessionService.ensure(ownerId);
    const fields = { name: input.name.trim(), description: input.description.trim() };
    if (!fields.name) throw new Error('Project name is required.');
    const key = `create-project:${identity}`;
    const previous = await durableWorkService.read(ownerId, 'mutation', key, (value) => {
      const record = reliabilityDecoder.object(value);
      if (typeof record.projectId !== 'string') throw new Error('Saved project creation needs recovery.');
      return { projectId: record.projectId };
    });
    const projectId = previous?.value.projectId ?? await contentDraftService.newId();
    const revision = previous?.revision ?? await durableWorkService.write(ownerId, 'mutation', key, { projectId }, 0);
    nativeSessionService.assertOwner(ownerId);
    await this.membershipMutation({ action: 'create', projectId, fields });
    await durableWorkService.remove(ownerId, 'mutation', key, revision);
    return projectId;
  }

  public async updateProjectSettings(projectId: string, updates: { name?: string; description?: string; status?: ProjectStatus }): Promise<void> {
    await nativeSessionService.ensure(this.requireUserId());
    pageAccessService.assertMutation('/projectManagement');
    const projectReference = doc(this.database, 'projects', projectId);
    await updateDoc(projectReference, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  public async deleteProject(projectId: string): Promise<void> {
    await this.membershipMutation({ action: 'delete_project', projectId });
  }

  public async leaveProject(projectId: string): Promise<void> {
    await this.membershipMutation({ action: 'leave', projectId });
  }

  public subscribeToTasks(projectId: string, onUpdate: (tasks: Task[]) => void, onError?: (error: Error) => void): () => void {
    let active = true;
    this.requireUserId();
    const unsubscribe = onSnapshot(collection(this.database, 'projects', projectId, 'tasks'), (snapshot) => {
        if (!active) return;
        try { onUpdate(snapshot.docs.map((document: QueryDocumentSnapshot) => this.mapTask(document)).filter((task: Task) => !task.archived)); }
        catch (error: unknown) { onError?.(error instanceof Error ? error : new Error('Task access changed.')); }
      }, (error) => onError?.(error));
    return () => { active = false; unsubscribe?.(); };
  }
  public subscribeToProject(projectId: string, onUpdate: (project: ProjectRecord) => void, onError: (error: Error) => void): () => void {
    let active = true;
    const ownerId = this.requireUserId();
    const unsubscribe = onSnapshot(doc(this.database, 'projects', projectId), (snapshot) => {
        if (!active) return;
        try {
          if (!snapshot.exists() || accountLifecycleVisibilityService.isHidden(snapshot.data())) throw new Error('Project access is no longer available.');
          const project = this.mapProject(snapshot as QueryDocumentSnapshot, ownerId);
          this.projectCache.set(project.id, { viewerId: ownerId, project });
          onUpdate(project);
        } catch (error: unknown) { onError(error instanceof Error ? error : new Error('Project access changed.')); }
      }, (error) => { if (active) onError(error); });
    return () => { active = false; unsubscribe?.(); };
  }

  public async fetchTasks(projectId: string): Promise<Task[]> {
    this.requireUserId();
    const tasksSnapshot = await getDocs(collection(this.database, 'projects', projectId, 'tasks'));
    return tasksSnapshot.docs.filter((docSnap: QueryDocumentSnapshot) => docSnap.data().archived !== true).map((docSnap: QueryDocumentSnapshot) => this.mapTask(docSnap));
  }

  public async createTask(projectId: string, input: CreateTaskInput): Promise<string> {
    pageAccessService.assertMutation('/projectManagement');
    const ownerId = this.requireUserId();
    const draft = await contentDraftService.create(ownerId, 'task', { title: input.title, description: input.description ?? '', status: input.status ?? 'todo', priority: input.priority ?? 'medium', assignee: input.assignee ?? ownerId, assignees: input.assignees ?? [input.assignee ?? ownerId], dueDate: input.dueDate ?? null, estimatedTime: input.estimatedTime ?? 1, tags: input.tags ?? [] }, projectId);
    return (await contentDraftService.publish(draft)).destinationId;
  }
  public async updateTaskStatus(projectId: string, taskId: string, status: Status): Promise<void> {
    await nativeSessionService.ensure(this.requireUserId());
    await nativeTaskService.mutate(this.requireUserId(), projectId, taskId, { action: 'update', payload: { status } });
  }
  public async updateTask(projectId: string, taskId: string, updates: Partial<Task>): Promise<void> {
    await nativeSessionService.ensure(this.requireUserId());
    await nativeTaskService.mutate(this.requireUserId(), projectId, taskId, { action: 'update', payload: updates });
  }
  public async deleteTask(projectId: string, taskId: string): Promise<void> {
    await nativeSessionService.ensure(this.requireUserId());
    await nativeTaskService.mutate(this.requireUserId(), projectId, taskId, { action: 'delete', payload: {} });
  }
  public async addSubTask(projectId: string, taskId: string, title: string): Promise<void> {
    await nativeSessionService.ensure(this.requireUserId());
    await nativeTaskService.mutate(this.requireUserId(), projectId, taskId, { action: 'add_subtask', payload: { title } });
  }
  public async toggleSubTask(projectId: string, taskId: string, subtaskId: string): Promise<void> {
    await nativeSessionService.ensure(this.requireUserId());
    await nativeTaskService.mutate(this.requireUserId(), projectId, taskId, { action: 'toggle_subtask', payload: { subtaskId } });
  }
  public async addComment(projectId: string, taskId: string, content: string): Promise<void> {
    await nativeSessionService.ensure(this.requireUserId());
    await nativeTaskService.mutate(this.requireUserId(), projectId, taskId, { action: 'comment', payload: { content } });
  }
  public async addTimeEntry(projectId: string, taskId: string, duration: number, description = ''): Promise<void> {
    await nativeSessionService.ensure(this.requireUserId());
    await nativeTaskService.mutate(this.requireUserId(), projectId, taskId, { action: 'time', payload: { duration, description } });
  }

  public async inviteMember(projectId: string, emailOrUserId: string, role: ProjectRole): Promise<void> {
    await this.membershipMutation({ action: 'invite', projectId, recipient: emailOrUserId.trim(), role });
  }

  public async cancelInvite(projectId: string, targetUserId: string): Promise<void> {
    await this.membershipMutation({ action: 'cancel', projectId, targetId: targetUserId });
  }

  public async resendInvite(projectId: string, targetUserId: string): Promise<void> {
    await this.membershipMutation({ action: 'resend', projectId, targetId: targetUserId });
  }

  public async changeMemberRole(projectId: string, targetUserId: string, role: ProjectRole): Promise<void> {
    await this.membershipMutation({ action: 'role', projectId, targetId: targetUserId, role });
  }

  public async removeMember(projectId: string, targetUserId: string): Promise<void> {
    await this.membershipMutation({ action: 'remove', projectId, targetId: targetUserId });
  }

  public async transferOwnership(projectId: string, newOwnerId: string): Promise<void> {
    await this.membershipMutation({ action: 'transfer', projectId, targetId: newOwnerId });
  }
  private async membershipMutation(input: { action: 'claim' | 'accept' | 'decline' | 'invite' | 'cancel' | 'resend' | 'role' | 'remove' | 'leave' | 'transfer' | 'create' | 'delete_project'; fields?: { name: string; description: string }; projectId?: string; targetId?: string; recipient?: string; role?: ProjectRole }): Promise<{ claimed?: unknown }> {
    pageAccessService.assertMutation('/projectManagement');
    const ownerId = this.requireUserId();
    await nativeSessionService.ensure(ownerId);
    const { getFunctions, httpsCallable } = await import('@react-native-firebase/functions');
    const result = await httpsCallable(getFunctions(), 'mutateProjectMembership')(input);
    nativeSessionService.assertOwner(ownerId);
    return reliabilityDecoder.object(result.data);
  }

  private mapTask(snapshot: QueryDocumentSnapshot | DocumentData): Task {
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
      createdAt: this.readString(data.createdAt),
      updatedAt: this.readString(data.updatedAt),
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

  private mapProject(snapshot: QueryDocumentSnapshot, userId: string): ProjectRecord {
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
      const userDocument = await getDoc(doc(this.database, 'users', userId));
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
      const userDocument = await getDoc(doc(this.database, 'users', userId));
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

  private isProjectHidden(value: unknown): boolean {
    if (accountLifecycleVisibilityService.isHidden(value)) return true;
    const project = reliabilityDecoder.object(value);
    return project.isDeleted === true || project.status === 'deleted';
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
