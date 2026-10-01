import { db } from '@/lib/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { nativeSessionService } from './NativeSessionService';
import { pageAccessService } from './PageAccessService';
import { durableWorkService } from './DurableWorkService';
import { contentDraftService } from './ContentDraftService';
import { reliabilityDecoder as decode } from './ReliabilityDecoderService';
import type { Task } from '@/lib/types/project';
type TaskOperation = { action: 'update'; payload: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'assignees' | 'dueDate' | 'estimatedTime' | 'tags'>> }
  | { action: 'delete'; payload: { reason?: never } } | { action: 'add_subtask'; payload: { title: string } } | { action: 'toggle_subtask'; payload: { subtaskId: string } }
  | { action: 'comment'; payload: { content: string } } | { action: 'time'; payload: { duration: number; description: string } };
export class NativeTaskService {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly inFlight = new Map<string, Promise<void>>();
  public async mutate(ownerId: string, projectId: string, taskId: string, operation: TaskOperation): Promise<void> {
    const scope = JSON.stringify([ownerId, projectId, taskId]);
    const identity = JSON.stringify([scope, operation]);
    const existing = this.inFlight.get(identity);
    if (existing) return existing;
    const previous = this.queues.get(scope) ?? Promise.resolve();
    const pending = previous.catch(() => {}).then(() => this.execute(ownerId, projectId, taskId, operation));
    this.queues.set(scope, pending);
    this.inFlight.set(identity, pending);
    try { await pending; } finally {
      if (this.queues.get(scope) === pending) this.queues.delete(scope);
      if (this.inFlight.get(identity) === pending) this.inFlight.delete(identity);
    }
  }
  private async execute(ownerId: string, projectId: string, taskId: string, operation: TaskOperation): Promise<void> {
    pageAccessService.assertMutation('/projectManagement');
    await nativeSessionService.ensure(ownerId);
    const key = JSON.stringify(['task', projectId, taskId, operation]);
    const stored = await durableWorkService.read(ownerId, 'mutation', key, (value) => { const record = decode.object(value); return { id: decode.string(record.id), version: decode.integer(record.version) }; });
    const task = stored ? null : await getDoc(doc(db, 'projects', projectId, 'tasks', taskId));
    const mutation = stored?.value ?? { id: await contentDraftService.newId(), version: decode.integer(task?.data()?.version ?? 0) };
    const revision = stored?.revision ?? await durableWorkService.write(ownerId, 'mutation', key, mutation, 0);
    const { getFunctions, httpsCallable } = await import('@react-native-firebase/functions');
    try {
      nativeSessionService.assertOwner(ownerId);
      pageAccessService.assertMutation('/projectManagement');
      await httpsCallable(getFunctions(), 'mutateProjectTask')({ ...operation, projectId, taskId, operationId: mutation.id, version: mutation.version });
    } catch (error: unknown) {
      // An explicit transaction conflict confirms nothing was committed. A timeout does not.
      if (error && typeof error === 'object' && 'code' in error && (error.code === 'functions/aborted' || error.code === 'aborted')) {
        await durableWorkService.remove(ownerId, 'mutation', key, revision);
      }
      throw error;
    }
    await durableWorkService.remove(ownerId, 'mutation', key, revision);
    nativeSessionService.assertOwner(ownerId);
  }
}
export const nativeTaskService = new NativeTaskService();
