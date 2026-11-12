import { durableWorkService } from './DurableWorkService';
import { nativeSessionService } from './NativeSessionService';
import { nativeTaskService } from './NativeTaskService';
import { contentDraftService } from './ContentDraftService';
import { pageAccessService } from './PageAccessService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
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
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebaseConfig';
import { reliabilityDecoder } from './ReliabilityDecoderService';
import { accountLifecycleVisibilityService } from '@/lib/services/AccountLifecycleVisibilityService';
import type {
  ActiveTaskTimer,
  Comment,
  CreateProjectInput,
  CreateTaskInput,
  FileAttachment,
  FullTaskInput,
  Milestone,
  PickedTaskFile,
  ProjectLoadError,
  ProjectPlanTier,
  RecurrenceRule,
  TaskFieldUpdate,
  TaskTemplate,
  TaskTemplateInput,
  ProjectMembershipStatus,
  ProjectMutationAction,
  ProjectMutationCapability,
  ProjectRecord,
  ProjectRole,
  ProjectSettingsUpdate,
  ProjectStatus,
  Status,
  SubTask,
  Task,
  TaskAuditLogEntry,
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
  createdAt?: unknown;
  dueDate?: unknown;
  endDate?: unknown;
  planTier?: unknown;
  automationRules?: unknown;
  visibility?: unknown;
  tags?: unknown;
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
      let pendingProjectId: string | null = null;
      try {
        return await this.createProjectPending(ownerId, input, identity, (projectId) => { pendingProjectId = projectId; });
      } catch (mutationError: unknown) {
        if (pendingProjectId) {
          const alreadyCreated = await getDoc(doc(this.database, 'projects', pendingProjectId)).catch(() => null);
          if (alreadyCreated?.exists()) return pendingProjectId;
        }
        // Projects are created only by the mutateProjectMembership callable (the rules deny direct creates).
        throw mutationError;
      } finally {
        this.projectCreations.delete(identity);
      }
    })();

    this.projectCreations.set(identity, operation);
    const projectId = await operation;
    const extras: ProjectSettingsUpdate = {
      ...(input.color ? { color: input.color } : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      ...(input.status && input.status !== 'active' ? { status: input.status } : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
    };
    if (Object.keys(extras).length > 0) {
      // Best effort: the project exists either way; these are the extra fields the website's form also sets.
      await this.updateProjectSettings(projectId, extras).catch((error: unknown) => {
        console.warn('[ProjectService.createProject] Error:', error instanceof Error ? error.message : 'extra fields not saved');
      });
    }
    return projectId;
  }

  private async createProjectPending(ownerId: string, input: CreateProjectInput, identity: string, onProjectId: (projectId: string) => void): Promise<string> {
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
    onProjectId(projectId);
    const revision = previous?.revision ?? await durableWorkService.write(ownerId, 'mutation', key, { projectId }, 0);
    nativeSessionService.assertOwner(ownerId);
    await this.membershipMutation({ action: 'create', projectId, fields });
    await durableWorkService.remove(ownerId, 'mutation', key, revision);
    return projectId;
  }

  public async updateProjectSettings(projectId: string, updates: ProjectSettingsUpdate): Promise<void> {
    await nativeSessionService.ensure(this.requireUserId());
    pageAccessService.assertMutation('/projectManagement');
    const projectReference = doc(this.database, 'projects', projectId);
    const { dueDate, ...rest } = updates;
    // The website stores a project's due date as endDate (a timestamp); keep the same field.
    const dueDateFields = dueDate === undefined ? {} : { endDate: this.parseCalendarDate(dueDate) };
    await updateDoc(projectReference, {
      ...rest,
      ...dueDateFields,
      updatedAt: serverTimestamp(),
    });
  }

  /** Plan tier and automation rules are server-managed (website: mutateProjectMembership "settings"). */
  public async updateProjectPlan(projectId: string, updates: { planTier?: ProjectPlanTier; automationRules?: { [ruleId: string]: boolean } }): Promise<void> {
    await this.membershipMutation({ action: 'settings', projectId, ...updates });
  }

  /** Same classification as the website's useProjectDetails (not-found / permission-denied / network-error). */
  public classifyLoadError(error: unknown): ProjectLoadError {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
    const message = error instanceof Error ? error.message : '';
    if (code === 'not-found' || /not found|no longer available/i.test(message)) return 'not-found';
    if (code === 'permission-denied' || message.includes('permission-denied')) return 'permission-denied';
    if (['unavailable', 'network-error', 'deadline-exceeded', 'reset'].includes(code) || /network|unavailable/i.test(message)) return 'network-error';
    return 'unknown';
  }

  private parseCalendarDate(value: string | null): Date | null {
    const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
  }

  private toCalendarDate(value: unknown): string {
    if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value;
    const date = this.readDate(value);
    if (date.getTime() === 0) return '';
    const pad = (part: number): string => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
    await this.taskMutation(projectId, taskId, { action: 'update', payload: { status } });
  }
  public async updateTask(projectId: string, taskId: string, updates: TaskFieldUpdate): Promise<void> {
    await this.taskMutation(projectId, taskId, { action: 'update', payload: updates });
  }
  public async deleteTask(projectId: string, taskId: string): Promise<void> {
    await this.taskMutation(projectId, taskId, { action: 'delete', payload: {} });
    await this.clearTimerFor(projectId, taskId);
  }
  public async archiveTask(projectId: string, taskId: string): Promise<void> {
    await this.taskMutation(projectId, taskId, { action: 'archive', payload: {} });
    await this.clearTimerFor(projectId, taskId);
  }
  public async addSubTask(projectId: string, taskId: string, title: string): Promise<void> {
    await this.taskMutation(projectId, taskId, { action: 'add_subtask', payload: { title } });
  }
  public async toggleSubTask(projectId: string, taskId: string, subtaskId: string, completed?: boolean): Promise<void> {
    await this.taskMutation(projectId, taskId, { action: 'toggle_subtask', payload: completed === undefined ? { subtaskId } : { subtaskId, completed } });
  }
  public async addComment(projectId: string, taskId: string, content: string, mentions: string[] = []): Promise<void> {
    await this.taskMutation(projectId, taskId, { action: 'comment', payload: mentions.length ? { content, mentions } : { content } });
  }
  public async editComment(projectId: string, taskId: string, commentId: string, content: string): Promise<void> {
    await this.taskMutation(projectId, taskId, { action: 'edit_comment', payload: { commentId, content } });
  }
  public async deleteComment(projectId: string, taskId: string, commentId: string): Promise<void> {
    await this.taskMutation(projectId, taskId, { action: 'delete_comment', payload: { commentId } });
  }
  public async addTimeEntry(projectId: string, taskId: string, duration: number, description = ''): Promise<void> {
    await this.taskMutation(projectId, taskId, { action: 'time', payload: { duration, description } });
  }

  /** Website ProjectTaskClientService.attach: upload to projects/{p}/tasks/{t}/, then add_attachment. */
  public async addAttachment(projectId: string, taskId: string, file: PickedTaskFile): Promise<void> {
    const attachment = await this.uploadAttachment(projectId, taskId, file);
    await this.taskMutation(projectId, taskId, { action: 'add_attachment', payload: attachment });
  }
  public async deleteAttachment(projectId: string, taskId: string, attachmentId: string): Promise<void> {
    await this.taskMutation(projectId, taskId, { action: 'delete_attachment', payload: { attachmentId } });
  }

  /** A new task id, generated once per form so a retried create is the same operation. */
  public async newTaskId(): Promise<string> {
    return contentDraftService.newId();
  }

  /**
   * Website useProjectDetails.createTask: every TaskCreationModal field, uploaded attachments and subtasks in one
   * mutateProjectTask "create". Applies the "Auto-assign to team lead" automation (rule 1) like the website.
   */
  public async createFullTask(project: ProjectRecord, teamMembers: TeamMember[], taskId: string, fields: FullTaskInput, files: PickedTaskFile[] = [], subTasks: { title: string }[] = [], onUploaded?: (fileName: string) => void): Promise<void> {
    if (project.role === 'viewer') throw new Error('Viewers cannot create tasks.');
    const autoAssign = project.automationRules['1'] !== false;
    const hasAssignee = Boolean(fields.assignee) || fields.assignees.length > 0 || fields.assignedToAll;
    let effective = fields;
    if (autoAssign && !hasAssignee) {
      const leadId = project.ownerId || teamMembers.find((member) => member.isOwner || member.role === 'admin' || member.role === 'owner')?.id || '';
      if (leadId) effective = { ...fields, assignee: leadId, assignees: [leadId] };
    }
    const attachments: FileAttachment[] = [];
    for (const file of files) {
      attachments.push(await this.uploadAttachment(project.id, taskId, file));
      onUploaded?.(file.name);
    }
    const payload: FullTaskInput = { ...effective };
    if (!payload.recurrence) delete payload.recurrence;
    await this.taskMutation(project.id, taskId, { action: 'create', payload: { fields: payload, subTasks, attachments } });
  }

  /** Website duplicateTask: same fields, "(copy)" title, back to To Do. */
  public async duplicateTask(project: ProjectRecord, teamMembers: TeamMember[], task: Task): Promise<void> {
    const taskId = await this.newTaskId();
    await this.createFullTask(project, teamMembers, taskId, {
      title: `${task.title} (copy)`.slice(0, 200), description: task.description, status: 'todo', priority: task.priority,
      assignee: task.assignee, assignees: task.assignees ?? (task.assignee ? [task.assignee] : []), assignedToAll: task.assignedToAll === true,
      startDate: task.startDate ?? '', dueDate: task.dueDate, estimatedTime: task.estimatedTime, tags: task.tags,
      dependencies: task.dependencies ?? [], milestoneId: task.milestoneId ?? '', ...(task.recurrence ? { recurrence: task.recurrence } : {}),
    });
  }

  private async uploadAttachment(projectId: string, taskId: string, file: PickedTaskFile): Promise<FileAttachment> {
    const ownerId = this.requireUserId();
    await nativeSessionService.ensure(ownerId);
    pageAccessService.assertMutation('/projectManagement');
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose a nonempty attachment up to 10 MB.');
    const id = await contentDraftService.newId();
    const path = `projects/${projectId}/tasks/${taskId}/${id}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const blob = await (await fetch(file.uri)).blob();
    const reference = ref(storage, path);
    await uploadBytes(reference, blob, { contentType: file.mimeType || blob.type || 'application/octet-stream' });
    const url = await getDownloadURL(reference);
    nativeSessionService.assertOwner(ownerId);
    return { id, name: file.name, size: file.size, type: file.mimeType || 'application/octet-stream', url, uploadedBy: ownerId, uploadedAt: new Date().toISOString() };
  }

  private async taskMutation(projectId: string, taskId: string, operation: Parameters<typeof nativeTaskService.mutate>[3]): Promise<void> {
    const ownerId = this.requireUserId();
    await nativeSessionService.ensure(ownerId);
    await nativeTaskService.mutate(ownerId, projectId, taskId, operation);
  }

  // ── Milestones & task templates (direct Firestore writes, same as the website) ──

  public subscribeToMilestones(projectId: string, onUpdate: (milestones: Milestone[]) => void, onError?: (error: Error) => void): () => void {
    this.requireUserId();
    return onSnapshot(collection(this.database, 'projects', projectId, 'milestones'), (snapshot) => {
      onUpdate(snapshot.docs.map((document) => {
        const data = document.data();
        return {
          id: document.id,
          name: this.readString(data.name),
          description: this.readString(data.description) || undefined,
          dueDate: this.toCalendarDate(data.dueDate),
          color: this.readString(data.color) || 'bg-blue-500',
          completed: data.completed === true,
          createdBy: this.readString(data.createdBy),
        };
      }));
    }, (error) => onError?.(error));
  }

  public async createMilestone(projectId: string, input: { name: string; dueDate?: string; color?: string }): Promise<void> {
    const ownerId = this.requireUserId();
    pageAccessService.assertMutation('/projectManagement');
    const name = input.name.trim();
    if (!name) throw new Error('Milestone title is required');
    await addDoc(collection(this.database, 'projects', projectId, 'milestones'), {
      name, description: '', dueDate: input.dueDate || '', color: input.color || 'bg-blue-500', completed: false,
      createdAt: serverTimestamp(), createdBy: ownerId,
    });
  }

  public async setMilestoneCompleted(projectId: string, milestoneId: string, completed: boolean): Promise<void> {
    pageAccessService.assertMutation('/projectManagement');
    await updateDoc(doc(this.database, 'projects', projectId, 'milestones', milestoneId), { completed, updatedAt: serverTimestamp() });
  }

  public async deleteMilestone(projectId: string, milestoneId: string): Promise<void> {
    pageAccessService.assertMutation('/projectManagement');
    await deleteDoc(doc(this.database, 'projects', projectId, 'milestones', milestoneId));
  }

  public subscribeToTaskTemplates(projectId: string, onUpdate: (templates: TaskTemplate[]) => void, onError?: (error: Error) => void): () => void {
    this.requireUserId();
    return onSnapshot(collection(this.database, 'projects', projectId, 'taskTemplates'), (snapshot) => {
      onUpdate(snapshot.docs.map((document) => {
        const data = document.data();
        const priority = data.priority === 'low' || data.priority === 'high' || data.priority === 'urgent' ? data.priority : 'medium';
        const readList = (value: unknown): string[] => (Array.isArray(value) ? value.map((entry: unknown) => this.readString(entry)).filter(Boolean) : []);
        const subTasks = Array.isArray(data.subTasks)
          ? data.subTasks.map((entry: unknown) => ({ title: this.readString(entry && typeof entry === 'object' ? (entry as { title?: unknown }).title : '') })).filter((entry: { title: string }) => entry.title)
          : [];
        return {
          id: document.id,
          name: this.readString(data.name),
          description: this.readString(data.description),
          priority,
          assignee: this.readString(data.assignee),
          assignees: readList(data.assignees),
          assignedToAll: data.assignedToAll === true,
          dueDate: this.readString(data.dueDate),
          estimatedTime: this.readNumber(data.estimatedTime),
          tags: readList(data.tags),
          subTasks,
          createdBy: this.readString(data.createdBy),
        };
      }));
    }, (error) => onError?.(error));
  }

  public async saveTaskTemplate(projectId: string, template: TaskTemplateInput): Promise<void> {
    const ownerId = this.requireUserId();
    pageAccessService.assertMutation('/projectManagement');
    await addDoc(collection(this.database, 'projects', projectId, 'taskTemplates'), { ...template, createdBy: ownerId, createdAt: serverTimestamp() });
  }

  public async deleteTaskTemplate(projectId: string, templateId: string): Promise<void> {
    pageAccessService.assertMutation('/projectManagement');
    await deleteDoc(doc(this.database, 'projects', projectId, 'taskTemplates', templateId));
  }

  // ── Task timer (users/{uid}.activeTimer, shared with the website) ──

  public subscribeToActiveTimer(onUpdate: (timer: ActiveTaskTimer | null) => void): () => void {
    const userId = this.requireUserId();
    return onSnapshot(doc(this.database, 'users', userId), (snapshot) => {
      const timer = snapshot.data()?.activeTimer as { taskId?: unknown; projectId?: unknown; startedAt?: unknown } | undefined;
      const startedAt = timer ? this.readDate(timer.startedAt) : null;
      if (!timer || typeof timer.taskId !== 'string' || typeof timer.projectId !== 'string' || !startedAt || startedAt.getTime() === 0) { onUpdate(null); return; }
      onUpdate({ taskId: timer.taskId, projectId: timer.projectId, startedAt });
    }, () => onUpdate(null));
  }

  /** Website startTimer: persist the timer and move a To Do task to In Progress. */
  public async startTimer(projectId: string, task: Task): Promise<void> {
    const userId = this.requireUserId();
    pageAccessService.assertMutation('/projectManagement');
    await setDoc(doc(this.database, 'users', userId), { activeTimer: { taskId: task.id, projectId, startedAt: serverTimestamp() } }, { merge: true });
    if (task.status === 'todo') await this.updateTaskStatus(projectId, task.id, 'in-progress');
  }

  /** Website stopTimer: log the elapsed whole minutes as "Timer session" and clear the timer. */
  public async stopTimer(projectId: string, taskId: string, startedAt: Date | null): Promise<number> {
    const userId = this.requireUserId();
    const minutes = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60000)) : 0;
    if (minutes > 0) await this.addTimeEntry(projectId, taskId, Math.min(minutes, 1440), 'Timer session');
    await setDoc(doc(this.database, 'users', userId), { activeTimer: deleteField() }, { merge: true });
    return minutes;
  }

  private async clearTimerFor(projectId: string, taskId: string): Promise<void> {
    const userId = this.requireUserId();
    const snapshot = await getDoc(doc(this.database, 'users', userId)).catch(() => null);
    const timer = snapshot?.data()?.activeTimer as { taskId?: unknown; projectId?: unknown } | undefined;
    if (timer?.taskId === taskId && timer.projectId === projectId) {
      await setDoc(doc(this.database, 'users', userId), { activeTimer: deleteField() }, { merge: true }).catch(() => undefined);
    }
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
  private async membershipMutation(input: { action: 'claim' | 'accept' | 'decline' | 'invite' | 'cancel' | 'resend' | 'role' | 'remove' | 'leave' | 'transfer' | 'create' | 'delete_project' | 'settings'; fields?: { name: string; description: string }; projectId?: string; targetId?: string; recipient?: string; role?: ProjectRole; planTier?: ProjectPlanTier; automationRules?: { [ruleId: string]: boolean } }): Promise<{ claimed?: unknown }> {
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
      startDate: this.toCalendarDate(data.startDate),
      dueDate: this.toCalendarDate(data.dueDate),
      milestoneId: this.readString(data.milestoneId),
      dependencies: Array.isArray(data.dependencies) ? data.dependencies.map((id) => this.readString(id)).filter(Boolean) : [],
      recurrence: this.readRecurrence(data.recurrence),
      version: this.readNumber(data.version),
      createdAt: this.readString(data.createdAt),
      updatedAt: this.readString(data.updatedAt),
      subTasks: Array.isArray(data.subTasks) ? (data.subTasks as SubTask[]) : [],
      comments: Array.isArray(data.comments) ? (data.comments as Comment[]).map((comment) => ({ ...comment, author: comment.userId || comment.author })) : [],
      attachments: Array.isArray(data.attachments) ? (data.attachments as FileAttachment[]) : [],
      timeEntries: Array.isArray(data.timeEntries) ? (data.timeEntries as TimeEntry[]) : [],
      estimatedTime: this.readNumber(data.estimatedTime, 1),
      tags: Array.isArray(data.tags) ? data.tags.map((tag) => this.readString(tag)).filter(Boolean) : [],
      progress: this.readNumber(data.progress, 0),
      archived: data.archived === true,
      auditLog: Array.isArray(data.auditLog) ? data.auditLog.flatMap((entry): TaskAuditLogEntry[] => {
        if (!entry || typeof entry !== 'object') return [];
        const record = entry as Record<string, unknown>;
        const timestamp = this.readString(record.timestamp);
        if (!timestamp) return [];
        return [{ id: this.readString(record.id) || timestamp, action: this.readString(record.action), detail: this.readString(record.detail), userId: this.readString(record.userId), timestamp }];
      }) : [],
    };
  }

  private readRecurrence(value: unknown): RecurrenceRule | null {
    if (!value || typeof value !== 'object') return null;
    const rule = value as Record<string, unknown>;
    const frequency = rule.frequency === 'daily' || rule.frequency === 'weekly' || rule.frequency === 'monthly' || rule.frequency === 'yearly' ? rule.frequency : null;
    if (!frequency) return null;
    const endMode = rule.endMode === 'date' || rule.endMode === 'count' ? rule.endMode : 'never';
    return {
      frequency,
      interval: Math.max(1, this.readNumber(rule.interval, 1)),
      endMode,
      ...(typeof rule.endDate === 'string' ? { endDate: rule.endDate } : {}),
      ...(typeof rule.endCount === 'number' ? { endCount: rule.endCount } : {}),
    };
  }

  private readAutomationRules(value: unknown): { [ruleId: string]: boolean } {
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
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
      createdAt: this.readDate(data.createdAt ?? data.updatedAt),
      dueDate: this.toCalendarDate(data.endDate) || this.toCalendarDate(data.dueDate) || null,
      planTier: data.planTier === 'premium' ? 'premium' : 'free',
      automationRules: this.readAutomationRules(data.automationRules),
      visibility: data.visibility === 'public' ? 'public' : 'private',
      tags: Array.isArray(data.tags) ? data.tags.map((tag) => this.readString(tag)).filter(Boolean) : [],
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
        // Other members' emails are private (users/{uid}/private/profile).
        email: '',
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
