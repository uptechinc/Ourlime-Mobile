import { auth, db } from '@/lib/firebaseConfig';
import { collection, doc, getDocs, runTransaction, query, orderBy, documentId, startAfter, limit } from 'firebase/firestore';
import { durableWorkService } from './DurableWorkService';
import { reliabilityDecoder } from './ReliabilityDecoderService';
import { nativeSessionService } from './NativeSessionService';
import { pageAccessService } from './PageAccessService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BlogDraftPayload, ContentDraft, PublicationReceipt, TaskDraftPayload } from '@/lib/types/reliability';
import { withCleanup } from '@/lib/utils/withCleanup';

export class ContentDraftService {
  private static instance: ContentDraftService;
  private queues = new Map<string, Promise<void>>();
  private synchronizations = new Map<string, Promise<{ conflicts: number; pending: number }>>();
  public static getInstance(): ContentDraftService { return this.instance ??= new ContentDraftService(); }
  private enqueue<TValue>(ownerId: string, operation: () => Promise<TValue>): Promise<TValue> {
    const result = (this.queues.get(ownerId) ?? Promise.resolve()).then(operation);
    this.queues.set(ownerId, result.then(() => {}, () => {}));
    return result;
  }
  public async newId(): Promise<string> {
    return doc(collection(db, 'operationIds')).id;
  }
  public create(ownerId: string, kind: 'blog', payload: BlogDraftPayload): Promise<ContentDraft>;
  public create(ownerId: string, kind: 'task', payload: TaskDraftPayload, projectId: string): Promise<ContentDraft>;
  public async create(ownerId: string, kind: 'blog' | 'task', payload: BlogDraftPayload | TaskDraftPayload, projectId?: string): Promise<ContentDraft> {
    nativeSessionService.assertOwner(ownerId);
    const id = await this.newId();
    const draft = reliabilityDecoder.draft({ id, ownerId, kind, payload, projectId: kind === 'blog' ? null : projectId,
      name: payload.title || 'Untitled draft', revision: 0, localRevision: 1, syncedLocalRevision: 0, editId: await this.newId(), operationId: await this.newId(), lastSavedAt: new Date().toISOString(), deleted: false, receipt: null, conflictOf: null });
    await durableWorkService.write(ownerId, 'draft', id, draft, 0);
    return draft;
  }
  public async list(ownerId: string): Promise<ContentDraft[]> {
    nativeSessionService.assertOwner(ownerId);
    return (await durableWorkService.list(ownerId, 'draft', reliabilityDecoder.draft)).filter((draft) => !draft.deleted && !draft.receipt);
  }
  public async save(draft: ContentDraft): Promise<ContentDraft> {
    nativeSessionService.assertOwner(draft.ownerId);
    return this.saveLocal(draft);
  }
  /** An editor may finish its local disk flush after logout; this capability cannot read or sync. */
  public createLocalWriter(ownerId: string): (draft: ContentDraft) => Promise<ContentDraft> {
    nativeSessionService.assertOwner(ownerId);
    return async (draft) => {
      if (draft.ownerId !== ownerId) throw new Error('The draft belongs to another account.');
      return this.saveLocal(draft);
    };
  }
  private async saveLocal(draft: ContentDraft): Promise<ContentDraft> {
    return this.enqueue(draft.ownerId, async () => {
      const stored = await durableWorkService.read(draft.ownerId, 'draft', draft.id, reliabilityDecoder.draft);
      if (!stored || stored.value.receipt || stored.value.deleted) throw new Error('This draft was published or deleted. Create a new draft to continue.');
      // The caller must have edited the latest local version; otherwise preserve both.
      if (stored.value.editId !== draft.editId) return this.conflictCopy(draft);
      const next = { ...draft, editId: await this.newId(), revision: stored.value.revision, localRevision: draft.localRevision + 1, lastSavedAt: new Date().toISOString() };
      await durableWorkService.write(draft.ownerId, 'draft', draft.id, next, stored.revision);
      return next;
    });
  }
  private async conflictCopy(draft: ContentDraft): Promise<ContentDraft> {
    const copy = { ...draft, id: await this.newId(), editId: await this.newId(), operationId: await this.newId(), revision: 0, localRevision: 1, syncedLocalRevision: 0,
      name: `${draft.name} (recovered conflict)`, conflictOf: draft.id, receipt: null };
    await durableWorkService.write(draft.ownerId, 'draft', copy.id, copy, 0);
    return copy;
  }
  public async sync(ownerId: string): Promise<{ conflicts: number; pending: number }> {
    const existing = this.synchronizations.get(ownerId);
    if (existing) return existing;
    const synchronization = withCleanup(this.synchronize(ownerId), () => { this.synchronizations.delete(ownerId); });
    this.synchronizations.set(ownerId, synchronization);
    return synchronization;
  }
  private async synchronize(ownerId: string): Promise<{ conflicts: number; pending: number }> {
      let conflicts = 0;
      // Sync writes through the JS Firestore SDK, so the JS session is sufficient; the native bridge is only needed to publish.
      nativeSessionService.assertOwner(ownerId);
      const database = db;
      const collectionReference = collection(database, 'users', ownerId, 'contentDrafts');
      // Drafts are owner-private, not page content, and remain recoverable after page restrictions.
      const localDrafts = await durableWorkService.list(ownerId, 'draft', reliabilityDecoder.draft);
      for (const draft of localDrafts) {
        nativeSessionService.assertOwner(ownerId);
        if (draft.receipt) continue;
        const reference = doc(collectionReference, draft.id);
        const result = await runTransaction(database, async (transaction) => {
          const snapshot = await transaction.get(reference);
          const remote = snapshot.exists() ? reliabilityDecoder.draft(snapshot.data()) : null;
          if (remote?.receipt) return { kind: 'receipt' as const, remote };
          if (remote && draft.localRevision === draft.syncedLocalRevision) return { kind: 'saved' as const, remote };
          if (remote && remote.revision !== draft.revision) {
            // A lost acknowledgement can be recognized without device timestamps.
            if (remote.operationId === draft.operationId && remote.editId === draft.editId && JSON.stringify(remote.payload) === JSON.stringify(draft.payload) && remote.deleted === draft.deleted && remote.name === draft.name) return { kind: 'saved' as const, remote };
            return { kind: 'conflict' as const, remote };
          }
          const next = { ...draft, revision: (remote?.revision ?? 0) + 1, syncedLocalRevision: draft.localRevision };
          transaction.set(reference, next);
          return { kind: 'saved' as const, remote: next };
        });
        nativeSessionService.assertOwner(ownerId);
        await this.enqueue(ownerId, async () => {
          const stored = await durableWorkService.read(ownerId, 'draft', draft.id, reliabilityDecoder.draft);
          if (!stored) return;
          const changedLocally = stored.value.editId !== draft.editId;
          const remoteChanged = result.remote.editId !== draft.editId;
          if (result.kind === 'conflict' || (changedLocally && (remoteChanged || result.kind === 'receipt'))) {
            if (!stored.value.deleted) await this.conflictCopy(stored.value);
            conflicts += 1;
          }
          // A network acknowledgement only advances the base of newer local typing.
          const next = changedLocally && !remoteChanged && result.kind !== 'receipt'
            ? { ...stored.value, revision: result.remote.revision, syncedLocalRevision: draft.localRevision }
            : result.remote;
          await durableWorkService.write(ownerId, 'draft', draft.id, next, stored.revision);
        });
      }
      let cursor: string | null = null;
      do {
        const remoteDrafts: { docs: { id: string; data: () => unknown }[]; size: number } = await getDocs(query(collectionReference, orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(100)));
        nativeSessionService.assertOwner(ownerId);
        await this.enqueue(ownerId, async () => {
          for (const document of remoteDrafts.docs) {
            const remote = reliabilityDecoder.draft(document.data());
            if (remote.ownerId !== ownerId || remote.id !== document.id) throw new Error('Invalid draft ownership.');
            const local = await durableWorkService.read(ownerId, 'draft', remote.id, reliabilityDecoder.draft);
            if (!local) await durableWorkService.write(ownerId, 'draft', remote.id, remote, 0);
          }
        });
        cursor = remoteDrafts.size === 100 ? remoteDrafts.docs[99].id : null;
      } while (cursor);
      const remaining = await this.list(ownerId);
      return { conflicts, pending: remaining.filter((draft) => draft.localRevision !== draft.syncedLocalRevision).length };
  }
  public async remove(draft: ContentDraft): Promise<void> {
    const removed = await this.save({ ...draft, deleted: true });
    if (removed.id !== draft.id) throw new Error('The draft changed locally. Refresh the draft list before deleting.');
    // Tombstone is durable before synchronization. Failed network deletion is retried.
    const result = await this.sync(draft.ownerId);
    if (result.conflicts) throw new Error('A draft changed on another device. The remote version was retained; review it before deleting again.');
  }
  /** Repeatable migration. Legacy values are retained even after a verified replacement write. */
  public async migrateLegacy(ownerId: string): Promise<void> {
    nativeSessionService.assertOwner(ownerId);
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key === `blogDraft:${ownerId}` || key.startsWith(`taskDraft:${ownerId}:`));
    for (const key of keys.slice(0, 100)) {
      const projectId = key.startsWith('taskDraft:') ? key.slice(`taskDraft:${ownerId}:`.length) : null;
      const id = projectId ? `legacy_task_${projectId}` : 'legacy_blog';
      if (await durableWorkService.read(ownerId, 'draft', id, reliabilityDecoder.draft)) continue;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      const old = reliabilityDecoder.object(parsed);
      const common = { id, ownerId, name: typeof old.title === 'string' && old.title ? old.title : 'Recovered legacy draft', revision: 0, localRevision: 1, syncedLocalRevision: 0, editId: await this.newId(), operationId: await this.newId(), lastSavedAt: '', deleted: false, receipt: null, conflictOf: null };
      const draft = reliabilityDecoder.draft(projectId ? { ...common, kind: 'task', projectId, payload: { ...old, description: old.description ?? '', status: old.status ?? 'todo', priority: old.priority ?? 'medium', assignee: old.assignee ?? '', assignees: old.assignees ?? (old.assignee ? [old.assignee] : []), dueDate: old.dueDate ?? null, estimatedTime: old.estimatedTime ?? 1, tags: old.tags ?? [] } }
        : { ...common, kind: 'blog', projectId: null, payload: { ...old, readTime: old.readTime ?? 0, tags: old.tags ?? [], sources: old.sources ?? [] } });
      await durableWorkService.write(ownerId, 'draft', id, draft, 0);
      const saved = await durableWorkService.read(ownerId, 'draft', id, reliabilityDecoder.draft);
      if (!saved || JSON.stringify(saved.value.payload) !== JSON.stringify(draft.payload)) throw new Error('Legacy draft migration could not be verified. The original is retained.');
    }
  }
  /** disclaimerAccepted records the author's acceptance of the current publishing disclaimer on a blog. */
  public async publish(draft: ContentDraft, options: { disclaimerAccepted?: boolean } = {}): Promise<PublicationReceipt> {
    pageAccessService.assertMutation(draft.kind === 'blog' ? '/blogs' : '/projectManagement');
    await this.sync(draft.ownerId);
    const stored = await durableWorkService.read(draft.ownerId, 'draft', draft.id, reliabilityDecoder.draft);
    if (!stored) throw new Error('Save the draft before publishing.');
    if (stored.value.receipt) return stored.value.receipt;
    if (stored.value.localRevision !== stored.value.syncedLocalRevision) throw new Error('Recent edits are still saved only on this device. Save Draft to sync them before publishing.');
    if (JSON.stringify(stored.value.payload) !== JSON.stringify(draft.payload)) throw new Error('A draft conflict must be resolved before publishing.');
    const { getFunctions, httpsCallable } = await import('@react-native-firebase/functions');
    nativeSessionService.assertOwner(draft.ownerId);
    // The publish callable authenticates through native Firebase, so the session bridge must be ready here.
    // Tasks are created only by the callable (the rules deny direct task writes), so a failure keeps the draft.
    await nativeSessionService.ensure(draft.ownerId);
    const response = await httpsCallable(getFunctions(), 'publishContentDraft')({ draftId: draft.id, operationId: stored.value.operationId, revision: stored.value.revision, ...(options.disclaimerAccepted === true ? { disclaimerAccepted: true } : {}) });
    const receipt: PublicationReceipt | null = reliabilityDecoder.receipt(response.data);
    if (!receipt) throw new Error('Publication was not confirmed. Your draft was retained.');
    if (auth.currentUser?.uid !== draft.ownerId) return receipt;
    await this.enqueue(draft.ownerId, async () => {
      const latest = await durableWorkService.read(draft.ownerId, 'draft', draft.id, reliabilityDecoder.draft);
      if (latest) await durableWorkService.write(draft.ownerId, 'draft', draft.id, { ...latest.value, receipt }, latest.revision);
    });
    return receipt;
  }
}
export const contentDraftService = ContentDraftService.getInstance();
