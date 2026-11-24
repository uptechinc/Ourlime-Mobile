import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { contentDraftService } from './ContentDraftService';
import { nativeSessionService } from './NativeSessionService';
import { pageAccessService } from './PageAccessService';
import { projectService } from './ProjectService';
import { reliabilityDecoder } from './ReliabilityDecoderService';
import type {
  DeliverableEvidence, DeliverableFieldsInput, DeliverableStatus, IssueSeverity, PickedTaskFile, PortalDeliverable, PortalQuestion, ProjectDeliverable,
  ProjectModuleFlags, ProjectOutcome, ProjectRegisterKind, ProjectRegisterRecord, ProjectReport, ProjectStakeholder, ProjectTimeEntry, ProjectTimeSummary,
  RecordHistoryEntry, RegisterFieldsInput, RegisterLevel, StakeholderPortal, StakeholderRole,
} from '@/lib/types/project';

/** Same limits the server enforces (website functions/src/Project*Service.ts). */
export const DELIVERABLE_TITLE_LIMIT = 160;
export const DELIVERABLE_DESCRIPTION_LIMIT = 2000;
export const DELIVERABLE_CRITERIA_LIMIT = 20;
export const DELIVERABLE_CRITERION_LENGTH = 300;
export const DELIVERABLE_NOTE_LIMIT = 1000;
export const REGISTER_TITLE_LIMIT = 160;
export const REGISTER_TEXT_LIMIT = 4000;
export const TIME_NOTE_LIMIT = 500;
export const TIME_REASON_LIMIT = 300;
export const QUESTION_TEXT_LIMIT = 2000;
export const OUTCOME_SUMMARY_LIMIT = 2000;
export const REGISTER_PAGE_SIZE = 50;
const DELIVERABLE_READ_LIMIT = 200;
const OWN_TIME_READ_LIMIT = 200;
const STAKEHOLDER_READ_LIMIT = 50;
const REGISTER_COLLECTIONS: { [kind in ProjectRegisterKind]: string } = { risk: 'risks', issue: 'issues', decision: 'decisions', change_request: 'changeRequests' };
/** Same file types the Storage rules accept for project files. */
const PROJECT_FILE_TYPE = /^(?:image\/(?:jpeg|jpg|png|webp|heic|heif|gif)|video\/.+|audio\/.+|text\/(?:plain|csv)|application\/(?:pdf|zip|msword|vnd\.openxmlformats-officedocument\..+))$/;

export type RegisterCursor = QueryDocumentSnapshot<DocumentData>;
export type RegisterPage = { records: ProjectRegisterRecord[]; cursor: RegisterCursor | null };
type OperationRequest = { action: string; projectId: string; [key: string]: unknown };
type Source = { [key: string]: unknown };

/**
 * eProjects Phase 3 for the app: optional modules, deliverables and sign-off, risks/issues/decisions/change requests,
 * the private time log, clients and reviewers, the outcome report and the server report. Every change goes through the
 * mutateProjectMembership callable (the website's POST /api/projects/operations runs the same server code), which
 * checks who may do each action. Each intended change keeps one operation ID until the server answers definitely, so a
 * retry after a lost response is applied once. Reads are bounded one-off reads, never listeners.
 */
export class ProjectOperationsService {
  private static instance: ProjectOperationsService;
  private readonly operations = new Map<string, string>();
  private constructor() {}
  public static getInstance(): ProjectOperationsService { return this.instance ??= new ProjectOperationsService(); }

  // ── Modules and report ──
  public async updateModules(projectId: string, modules: Partial<ProjectModuleFlags>): Promise<void> {
    await this.send(['modules_update', projectId, modules], { action: 'modules_update', projectId, modules });
  }

  public async report(projectId: string): Promise<ProjectReport> {
    const result = await this.read({ action: 'project_report', projectId });
    const report = result.report;
    if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('The report could not be read. Try again.');
    return report as ProjectReport;
  }

  // ── Deliverables ──
  public async createDeliverable(projectId: string, fields: DeliverableFieldsInput): Promise<string> {
    const deliverableId = await contentDraftService.newId();
    await this.send(['deliverable_create', projectId, deliverableId], { action: 'deliverable_create', projectId, deliverableId, fields: this.cleanDeliverable(fields) });
    return deliverableId;
  }
  public async updateDeliverable(projectId: string, deliverableId: string, fields: Partial<DeliverableFieldsInput>): Promise<void> {
    await this.send(['deliverable_update', projectId, deliverableId, fields], { action: 'deliverable_update', projectId, deliverableId, fields: this.cleanDeliverable(fields) });
  }
  public async addEvidenceLink(projectId: string, deliverableId: string, url: string, name: string): Promise<void> {
    const trimmed = url.trim();
    if (!/^https:\/\/\S+$/i.test(trimmed)) throw new Error('Evidence links must start with https://.');
    const evidenceId = await contentDraftService.newId();
    await this.send(['evidence_link', projectId, deliverableId, trimmed], { action: 'deliverable_evidence_add', projectId, deliverableId, evidence: { id: evidenceId, kind: 'link', url: trimmed, name: (name.trim() || trimmed).slice(0, 200) } });
  }
  /** Uploads to projects/{p}/deliverables/{d}/ (same 10 MB limit and file types as task attachments), then records it. */
  public async addEvidenceFile(projectId: string, deliverableId: string, file: PickedTaskFile): Promise<void> {
    if (!PROJECT_FILE_TYPE.test(file.mimeType)) throw new Error('This file type cannot be attached. Use an image, video, audio, PDF, text, ZIP or Office file.');
    const uploaded = await projectService.uploadProjectFile(`projects/${projectId}/deliverables/${deliverableId}`, file);
    await this.send(['evidence_file', projectId, deliverableId, uploaded.id], { action: 'deliverable_evidence_add', projectId, deliverableId, evidence: { id: uploaded.id, kind: 'file', url: uploaded.url, name: file.name.slice(0, 200) } });
  }
  public async removeEvidence(projectId: string, deliverableId: string, evidenceId: string): Promise<void> {
    await this.send(['evidence_remove', projectId, deliverableId, evidenceId], { action: 'deliverable_evidence_remove', projectId, deliverableId, evidenceId });
  }
  public async submitDeliverable(projectId: string, deliverableId: string, revision: number, note = ''): Promise<void> {
    await this.send(['deliverable_submit', projectId, deliverableId, revision], { action: 'deliverable_submit', projectId, deliverableId, note: note.trim().slice(0, DELIVERABLE_NOTE_LIMIT) });
  }
  /** Accept or request changes; `revision` is the version the reviewer looked at (the server refuses a stale one). */
  public async reviewDeliverable(projectId: string, deliverableId: string, decision: Exclude<DeliverableStatus, 'draft' | 'submitted'>, note: string, revision: number): Promise<void> {
    await this.send(['deliverable_review', projectId, deliverableId, decision, revision], { action: 'deliverable_review', projectId, deliverableId, decision, note: note.trim().slice(0, DELIVERABLE_NOTE_LIMIT), revision });
  }
  public async reopenDeliverable(projectId: string, deliverableId: string, reason: string): Promise<void> {
    await this.send(['deliverable_reopen', projectId, deliverableId, reason.trim()], { action: 'deliverable_reopen', projectId, deliverableId, reason: reason.trim().slice(0, DELIVERABLE_NOTE_LIMIT) });
  }
  public async shareDeliverable(projectId: string, deliverableId: string, shared: boolean, reviewerIds: string[]): Promise<void> {
    await this.send(['deliverable_share', projectId, deliverableId, shared, reviewerIds], { action: 'deliverable_share', projectId, deliverableId, shared, reviewerIds: shared ? reviewerIds.slice(0, 10) : [] });
  }
  public async deleteDeliverable(projectId: string, deliverableId: string): Promise<void> {
    await this.send(['deliverable_delete', projectId, deliverableId], { action: 'deliverable_delete', projectId, deliverableId });
  }
  public async listDeliverables(projectId: string): Promise<ProjectDeliverable[]> {
    this.requireUserId();
    const snapshot = await getDocs(query(collection(db, 'projects', projectId, 'deliverables'), limit(DELIVERABLE_READ_LIMIT)));
    return snapshot.docs.map((document) => this.deliverable(document.id, document.data()));
  }

  // ── Registers (risks, issues, decisions, change requests) ──
  public async createRecord(projectId: string, kind: ProjectRegisterKind, fields: RegisterFieldsInput): Promise<string> {
    const recordId = await contentDraftService.newId();
    await this.send(['register_create', projectId, kind, recordId], { action: 'register_create', projectId, kind, recordId, fields });
    return recordId;
  }
  public async updateRecord(projectId: string, kind: ProjectRegisterKind, recordId: string, fields: RegisterFieldsInput): Promise<void> {
    await this.send(['register_update', projectId, kind, recordId, fields], { action: 'register_update', projectId, kind, recordId, fields });
  }
  public async setRecordStatus(projectId: string, kind: ProjectRegisterKind, recordId: string, status: string, note = ''): Promise<void> {
    await this.send(['register_status', projectId, kind, recordId, status, note.trim()], { action: 'register_status', projectId, kind, recordId, status, note: note.trim().slice(0, 1000) });
  }
  public async deleteRecord(projectId: string, kind: ProjectRegisterKind, recordId: string): Promise<void> {
    await this.send(['register_delete', projectId, kind, recordId], { action: 'register_delete', projectId, kind, recordId });
  }
  /** Newest changes first, 50 at a time. */
  public async listRecords(projectId: string, kind: ProjectRegisterKind, after: RegisterCursor | null = null): Promise<RegisterPage> {
    this.requireUserId();
    const records = collection(db, 'projects', projectId, REGISTER_COLLECTIONS[kind]);
    const page = after
      ? query(records, orderBy('updatedAt', 'desc'), startAfter(after), limit(REGISTER_PAGE_SIZE))
      : query(records, orderBy('updatedAt', 'desc'), limit(REGISTER_PAGE_SIZE));
    const snapshot = await getDocs(page);
    const documents = snapshot.docs as QueryDocumentSnapshot<DocumentData>[];
    return {
      records: documents.map((document) => this.register(kind, document.id, document.data())),
      cursor: documents.length === REGISTER_PAGE_SIZE ? documents[documents.length - 1] : null,
    };
  }
  /** Decisions whose search words include `word` (one word, 3+ letters; the server stores lower-case words). */
  public async searchDecisions(projectId: string, word: string): Promise<ProjectRegisterRecord[]> {
    this.requireUserId();
    const term = word.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    if (term.length < 3) return [];
    const snapshot = await getDocs(query(collection(db, 'projects', projectId, 'decisions'), where('keywords', 'array-contains', term), limit(REGISTER_PAGE_SIZE)));
    return snapshot.docs
      .map((document) => this.register('decision', document.id, document.data()))
      .sort((first, second) => (second.updatedAt?.getTime() ?? 0) - (first.updatedAt?.getTime() ?? 0));
  }

  // ── Time log (private: each person reads only their own entries) ──
  /** Logs minutes on a task for a day ('' = today). The entry ID is the retry key. */
  public async logTime(projectId: string, taskId: string, minutes: number, date: string, note: string): Promise<void> {
    const request = { projectId, taskId, minutes, date, note: note.trim().slice(0, TIME_NOTE_LIMIT), source: 'manual' };
    const identity = JSON.stringify([this.requireUserId(), 'time_log', request]);
    const entryId = this.operations.get(identity) ?? await contentDraftService.newId();
    this.operations.set(identity, entryId);
    try {
      await this.call({ action: 'time_log', entryId, ...request });
      this.operations.delete(identity);
    } catch (error: unknown) {
      if (this.isDefiniteRefusal(error)) this.operations.delete(identity);
      throw error;
    }
  }
  public async correctTime(projectId: string, entryId: string, changes: { minutes?: number; date?: string; note?: string }, reason: string): Promise<void> {
    await this.send(['time_correct', projectId, entryId, changes, reason.trim()], { action: 'time_correct', projectId, entryId, ...changes, reason: reason.trim().slice(0, TIME_REASON_LIMIT) });
  }
  public async voidTime(projectId: string, entryId: string, reason: string): Promise<void> {
    await this.send(['time_void', projectId, entryId, reason.trim()], { action: 'time_void', projectId, entryId, reason: reason.trim().slice(0, TIME_REASON_LIMIT) });
  }
  /** The signed-in member's own entries (the rules refuse anyone else's), newest day first. */
  public async listOwnTime(projectId: string): Promise<ProjectTimeEntry[]> {
    const uid = this.requireUserId();
    const snapshot = await getDocs(query(collection(db, 'projects', projectId, 'timeEntries'), where('userId', '==', uid), limit(OWN_TIME_READ_LIMIT)));
    return snapshot.docs.map((document) => this.timeEntry(document.id, document.data())).sort((first, second) => second.date.localeCompare(first.date));
  }
  /** Team totals for owners and admins; null when nothing has been logged in the time log yet. */
  public async timeSummary(projectId: string): Promise<ProjectTimeSummary | null> {
    this.requireUserId();
    const snapshot = await getDoc(doc(db, 'projects', projectId, 'timeTotals', 'summary'));
    if (!snapshot.exists()) return null;
    const source = this.object(snapshot.data());
    const numbers = (entry: unknown): { [key: string]: number } => Object.fromEntries(Object.entries(this.object(entry)).filter((pair): pair is [string, number] => typeof pair[1] === 'number' && pair[1] > 0));
    return { totalMinutes: this.count(source.totalMinutes), entryCount: this.count(source.entryCount), byMember: numbers(source.byMember), byTask: numbers(source.byTask) };
  }

  // ── Outcome ──
  public async outcome(projectId: string, outcomeId: string): Promise<ProjectOutcome | null> {
    if (!outcomeId) return null;
    this.requireUserId();
    const snapshot = await getDoc(doc(db, 'projects', projectId, 'outcomes', outcomeId));
    if (!snapshot.exists()) return null;
    const source = this.object(snapshot.data());
    const acceptedDeliverables = this.list(source.acceptedDeliverables).map((item) => ({ id: this.text(item.id), title: this.text(item.title), milestoneId: this.text(item.milestoneId), revision: this.count(item.revision) }));
    return {
      id: snapshot.id, summary: this.text(source.summary), beneficiaries: this.text(source.beneficiaries), results: this.text(source.results), lessons: this.text(source.lessons),
      acceptedDeliverables, acceptedCount: this.count(source.acceptedCount), recordedBy: this.text(source.recordedBy), recordedAt: this.date(source.recordedAt),
    };
  }

  // ── Clients and reviewers ──
  public async inviteStakeholder(projectId: string, recipient: string, role: StakeholderRole): Promise<void> {
    await this.send(['stakeholder_invite', projectId, recipient.trim(), role], { action: 'stakeholder_invite', projectId, recipient: recipient.trim(), role });
  }
  public async respondToReview(projectId: string, decision: 'accept' | 'decline'): Promise<void> {
    await this.call({ action: 'stakeholder_respond', projectId, decision });
  }
  /** A manager removes someone, or a client or reviewer leaves (targetId = their own ID). */
  public async removeStakeholder(projectId: string, targetId: string): Promise<void> {
    await this.send(['stakeholder_remove', projectId, targetId], { action: 'stakeholder_remove', projectId, targetId });
  }
  public async setStakeholderRole(projectId: string, targetId: string, role: StakeholderRole): Promise<void> {
    await this.send(['stakeholder_role', projectId, targetId, role], { action: 'stakeholder_role', projectId, targetId, role });
  }
  public async shareMilestone(projectId: string, milestoneId: string, shared: boolean): Promise<void> {
    await this.send(['milestone_share', projectId, milestoneId, shared], { action: 'milestone_share', projectId, milestoneId, shared });
  }
  /** Asks the other side a question; the question ID is chosen once per question, so a retry is applied once. */
  public async askQuestion(projectId: string, body: string, deliverableId = ''): Promise<void> {
    const text = body.trim().slice(0, QUESTION_TEXT_LIMIT);
    const questionKey = JSON.stringify([this.requireUserId(), 'question_id', projectId, text, deliverableId]);
    const questionId = this.operations.get(questionKey) ?? await contentDraftService.newId();
    this.operations.set(questionKey, questionId);
    await this.send(['question_ask', projectId, questionId], { action: 'question_ask', projectId, questionId, body: text, ...(deliverableId ? { deliverableId } : {}) });
    this.operations.delete(questionKey);
  }
  public async answerQuestion(projectId: string, questionId: string, answer: string): Promise<void> {
    await this.send(['question_answer', projectId, questionId, answer.trim()], { action: 'question_answer', projectId, questionId, answer: answer.trim().slice(0, QUESTION_TEXT_LIMIT) });
  }
  /** What clients and reviewers see (managers and members can open it too, to check what is shared). */
  public async portal(projectId: string): Promise<StakeholderPortal> {
    const result = await this.read({ action: 'stakeholder_portal', projectId });
    const portal = this.decodePortal(result.portal);
    if (!portal) throw new Error('This review page could not be read. Try again.');
    return portal;
  }
  public async listStakeholders(projectId: string): Promise<ProjectStakeholder[]> {
    this.requireUserId();
    const snapshot = await getDocs(query(collection(db, 'projectStakeholders'), where('projectId', '==', projectId), limit(STAKEHOLDER_READ_LIMIT)));
    return snapshot.docs.flatMap((document) => { const record = this.stakeholder(document.id, document.data()); return record ? [record] : []; });
  }
  /** The signed-in person's review invitations and access, across projects. */
  public async myReviewAccess(): Promise<ProjectStakeholder[]> {
    const uid = this.requireUserId();
    const snapshot = await getDocs(query(collection(db, 'projectStakeholders'), where('uid', '==', uid), limit(STAKEHOLDER_READ_LIMIT)));
    return snapshot.docs.flatMap((document) => { const record = this.stakeholder(document.id, document.data()); return record ? [record] : []; });
  }
  /** The signed-in person's client/reviewer record on one project, or null (also null when it cannot be read). */
  public async reviewAccess(projectId: string): Promise<ProjectStakeholder | null> {
    try {
      const uid = this.requireUserId();
      const snapshot = await getDoc(doc(db, 'projectStakeholders', `${projectId}_${uid}`));
      return snapshot.exists() ? this.stakeholder(snapshot.id, snapshot.data()) : null;
    } catch (error: unknown) {
      console.error('[ProjectOperationsService.reviewAccess] Error:', error);
      return null;
    }
  }
  /** A display name for someone outside the team (public profile fields only; never an email). */
  public async displayName(uid: string): Promise<string> {
    try {
      const snapshot = await getDoc(doc(db, 'users', uid));
      const data = this.object(snapshot.data());
      return this.text(data.displayName) || [this.text(data.firstName), this.text(data.lastName)].filter(Boolean).join(' ') || this.text(data.userName) || 'Ourlime member';
    } catch (error: unknown) {
      console.error('[ProjectOperationsService.displayName] Error:', error);
      return 'Ourlime member';
    }
  }

  /** True when the server refused for a reason a retry will not change. */
  public isDefiniteRefusal(error: unknown): boolean {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code).replace(/^functions\//, '') : '';
    return ['aborted', 'invalid-argument', 'failed-precondition', 'permission-denied', 'not-found', 'unauthenticated', 'already-exists', 'resource-exhausted'].includes(code);
  }

  // ── Decoders (tolerant: anything missing or malformed reads as empty) ──
  public deliverable(id: string, value: unknown): ProjectDeliverable {
    const source = this.object(value); const review = this.object(source.review);
    const status: DeliverableStatus = source.status === 'submitted' || source.status === 'accepted' || source.status === 'changes_requested' ? source.status : 'draft';
    const evidence = this.list(source.evidence).flatMap((item): DeliverableEvidence[] => {
      const evidenceId = this.text(item.id); const url = this.text(item.url);
      if (!evidenceId || !url) return [];
      return [{ id: evidenceId, kind: item.kind === 'file' ? 'file' : 'link', url, name: this.text(item.name) || url, ...(typeof item.size === 'number' ? { size: item.size } : {}), ...(typeof item.type === 'string' ? { type: item.type } : {}), addedBy: this.text(item.addedBy), addedAt: this.text(item.addedAt) }];
    });
    return {
      id, title: this.text(source.title) || 'Untitled deliverable', description: this.text(source.description), milestoneId: this.text(source.milestoneId), ownerId: this.text(source.ownerId),
      dueDate: this.text(source.dueDate), acceptanceCriteria: this.strings(source.acceptanceCriteria), evidence, status, reviewerIds: this.strings(source.reviewerIds),
      sharedWithStakeholders: source.sharedWithStakeholders === true, revision: this.count(source.revision),
      review: review.decision === 'accepted' || review.decision === 'changes_requested' ? {
        decision: review.decision, note: this.text(review.note), decidedBy: this.text(review.decidedBy), decidedRole: review.decidedRole === 'stakeholder' ? 'stakeholder' : 'manager',
        decidedAt: this.text(review.decidedAt), revision: this.count(review.revision), selfApproved: review.selfApproved === true,
      } : null,
      history: this.history(source.history), createdBy: this.text(source.createdBy),
    };
  }

  public register(kind: ProjectRegisterKind, id: string, value: unknown): ProjectRegisterRecord {
    const source = this.object(value); const verdict = this.object(kind === 'change_request' ? source.decision : null);
    const level = (entry: unknown): RegisterLevel | '' => (entry === 'low' || entry === 'medium' || entry === 'high' ? entry : '');
    const severity: IssueSeverity | '' = source.severity === 'low' || source.severity === 'medium' || source.severity === 'high' || source.severity === 'critical' ? source.severity : '';
    return {
      id, kind, title: this.text(source.title) || 'Untitled', description: this.text(source.description), ownerId: this.text(source.ownerId), dueDate: this.text(source.dueDate),
      status: this.text(source.status), likelihood: level(source.likelihood), impact: level(source.impact), score: this.count(source.score), mitigation: this.text(source.mitigation),
      severity, resolution: this.text(source.resolution), decision: kind === 'decision' ? this.text(source.decision) : '', rationale: this.text(source.rationale), decidedOn: this.text(source.decidedOn),
      reason: this.text(source.reason), impactSummary: this.text(source.impactSummary), requestedBy: this.text(source.requestedBy) || this.text(source.createdBy),
      verdict: verdict.status ? { status: this.text(verdict.status), by: this.text(verdict.by), at: this.text(verdict.at), note: this.text(verdict.note), selfApproved: verdict.selfApproved === true } : null,
      history: this.history(source.history), createdBy: this.text(source.createdBy), updatedAt: this.date(source.updatedAt),
    };
  }

  public timeEntry(id: string, value: unknown): ProjectTimeEntry {
    const source = this.object(value);
    return {
      id, userId: this.text(source.userId), taskId: this.text(source.taskId), minutes: this.count(source.minutes), date: this.text(source.date), note: this.text(source.note),
      source: source.source === 'timer' || source.source === 'legacy' ? source.source : 'manual', status: source.status === 'void' ? 'void' : 'active', voidReason: this.text(source.voidReason),
      corrections: this.list(source.corrections).map((item) => ({ at: this.text(item.at), minutes: this.count(item.minutes), date: this.text(item.date), note: this.text(item.note), reason: this.text(item.reason) })),
    };
  }

  public stakeholder(id: string, value: unknown): ProjectStakeholder | null {
    const source = this.object(value);
    const role = source.role === 'client' || source.role === 'reviewer' ? source.role : null;
    const status = source.status === 'pending' || source.status === 'accepted' ? source.status : null;
    const uid = this.text(source.uid); const projectId = this.text(source.projectId);
    if (!role || !status || !uid || !projectId) return null;
    return { id, projectId, uid, role, status, invitedBy: this.text(source.invitedBy), projectName: this.text(source.projectName) || 'A project', expiresAt: this.date(source.expiresAt) };
  }

  public decodePortal(value: unknown): StakeholderPortal | null {
    const source = this.object(value); const project = this.object(source.project); const viewer = this.object(source.viewer);
    const projectId = this.text(project.id);
    if (!projectId) return null;
    const role = viewer.role === 'client' || viewer.role === 'reviewer' || viewer.role === 'manager' || viewer.role === 'member' ? viewer.role : 'reviewer';
    return {
      project: { id: projectId, name: this.text(project.name) || 'Project', status: this.text(project.status) },
      viewer: { role, status: viewer.status === 'accepted' ? 'accepted' : 'pending', expiresAt: this.text(viewer.expiresAt) },
      milestones: this.list(source.milestones).map((item) => ({ id: this.text(item.id), name: this.text(item.name), description: this.text(item.description), dueDate: this.text(item.dueDate), completed: item.completed === true })),
      deliverables: this.list(source.deliverables).map((item): PortalDeliverable => {
        const review = this.object(item.review);
        return {
          id: this.text(item.id), title: this.text(item.title), description: this.text(item.description), milestoneId: this.text(item.milestoneId), dueDate: this.text(item.dueDate),
          status: this.text(item.status), revision: this.count(item.revision), acceptanceCriteria: this.strings(item.acceptanceCriteria),
          evidence: this.list(item.evidence).map((evidence) => ({ id: this.text(evidence.id), kind: this.text(evidence.kind), url: this.text(evidence.url), name: this.text(evidence.name) })),
          canReview: item.canReview === true,
          review: review.decision ? { decision: this.text(review.decision), note: this.text(review.note), decidedRole: this.text(review.decidedRole), decidedAt: this.text(review.decidedAt), revision: this.count(review.revision) } : null,
        };
      }),
      questions: this.list(source.questions).map((item): PortalQuestion => ({
        id: this.text(item.id), body: this.text(item.body), askedByRole: this.text(item.askedByRole), mine: item.mine === true, status: this.text(item.status), answer: this.text(item.answer),
        answeredByRole: this.text(item.answeredByRole), createdAt: this.text(item.createdAt), answeredAt: this.text(item.answeredAt), deliverableId: this.text(item.deliverableId),
      })),
    };
  }

  // ── Internals ──
  private cleanDeliverable<T extends Partial<DeliverableFieldsInput>>(fields: T): T {
    const result: Partial<DeliverableFieldsInput> = {};
    if (fields.title !== undefined) result.title = fields.title.trim().slice(0, DELIVERABLE_TITLE_LIMIT);
    if (fields.description !== undefined) result.description = fields.description.trim().slice(0, DELIVERABLE_DESCRIPTION_LIMIT);
    if (fields.milestoneId !== undefined) result.milestoneId = fields.milestoneId;
    if (fields.ownerId !== undefined) result.ownerId = fields.ownerId;
    if (fields.dueDate !== undefined) result.dueDate = fields.dueDate.slice(0, 10);
    if (fields.acceptanceCriteria !== undefined) result.acceptanceCriteria = fields.acceptanceCriteria.map((line) => line.trim().slice(0, DELIVERABLE_CRITERION_LENGTH)).filter(Boolean).slice(0, DELIVERABLE_CRITERIA_LIMIT);
    return result as T;
  }

  private async read(request: OperationRequest): Promise<Source> {
    return await this.call(request);
  }

  private async send(identityParts: unknown[], request: OperationRequest): Promise<Source> {
    const identity = JSON.stringify([this.requireUserId(), ...identityParts]);
    const operationId = this.operations.get(identity) ?? await contentDraftService.newId();
    this.operations.set(identity, operationId);
    try {
      const result = await this.call({ ...request, operationId });
      this.operations.delete(identity);
      return result;
    } catch (error: unknown) {
      if (this.isDefiniteRefusal(error)) this.operations.delete(identity);
      throw error;
    }
  }

  private async call(request: OperationRequest): Promise<Source> {
    const userId = this.requireUserId();
    pageAccessService.assertMutation('/projectManagement');
    await nativeSessionService.ensure(userId);
    const { getFunctions, httpsCallable } = await import('@react-native-firebase/functions');
    const result = await httpsCallable(getFunctions(), 'mutateProjectMembership')(request);
    nativeSessionService.assertOwner(userId);
    return reliabilityDecoder.object(result.data) as Source;
  }

  private history(value: unknown): RecordHistoryEntry[] {
    return this.list(value).map((item) => ({
      at: this.text(item.at), actorId: this.text(item.actorId), action: this.text(item.action), changed: this.strings(item.changed),
      from: this.text(item.from), to: this.text(item.to), note: this.text(item.note), revision: typeof item.revision === 'number' ? item.revision : null,
    }));
  }

  private requireUserId(): string {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('You must be signed in to use projects.');
    return userId;
  }
  private object(value: unknown): Source { return value && typeof value === 'object' && !Array.isArray(value) ? value as Source : {}; }
  private list(value: unknown): Source[] { return Array.isArray(value) ? value.map((item) => this.object(item)) : []; }
  private text(value: unknown): string { return typeof value === 'string' ? value : ''; }
  private strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []; }
  private count(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0; }
  private date(value: unknown): Date | null {
    let date: Date | null = null;
    if (value instanceof Date) date = value;
    else if (typeof value === 'string' && value) date = new Date(value);
    else if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      const result: unknown = (value as { toDate: () => unknown }).toDate();
      if (result instanceof Date) date = result;
    }
    return date && Number.isFinite(date.getTime()) ? date : null;
  }
}

export const projectOperationsService = ProjectOperationsService.getInstance();
