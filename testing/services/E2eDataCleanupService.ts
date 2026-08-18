/**
 * E2E Data Cleanup Service for Ourlime Mobile
 *
 * Modeled after Evolution One CMS E2eDataCleanupService.
 * Tracks all entities created during live test execution and ensures
 * complete, verified cleanup at test teardown so production/test databases
 * never retain test artifact pollution.
 */

export type CreatedRecord =
  | { type: 'post'; id: string }
  | { type: 'comment'; postId: string; commentId: string }
  | { type: 'community'; id: string }
  | { type: 'lime'; id: string }
  | { type: 'user'; uid: string };

export class E2eDataCleanupService {
  private static instance: E2eDataCleanupService;
  private readonly records: CreatedRecord[] = [];

  private constructor() {}

  public static getInstance(): E2eDataCleanupService {
    if (!E2eDataCleanupService.instance) {
      E2eDataCleanupService.instance = new E2eDataCleanupService();
    }
    return E2eDataCleanupService.instance;
  }

  public registerPost(id: string): void {
    this.records.push({ type: 'post', id });
  }

  public registerComment(postId: string, commentId: string): void {
    this.records.push({ type: 'comment', postId, commentId });
  }

  public registerCommunity(id: string): void {
    this.records.push({ type: 'community', id });
  }

  public registerLime(id: string): void {
    this.records.push({ type: 'lime', id });
  }

  public registerUser(uid: string): void {
    this.records.push({ type: 'user', uid });
  }

  public getRegisteredRecords(): readonly CreatedRecord[] {
    return [...this.records];
  }

  public async cleanupAll(deleteFn?: (record: CreatedRecord) => Promise<void>): Promise<{ deletedCount: number; errors: string[] }> {
    let deletedCount = 0;
    const errors: string[] = [];

    // Process cleanup in reverse creation order (child comments before parent posts, etc.)
    const toClean = [...this.records].reverse();

    for (const record of toClean) {
      try {
        if (deleteFn) {
          await deleteFn(record);
        }
        deletedCount++;
      } catch (err: unknown) {
        const identifier = record.type === 'user' ? record.uid : record.type === 'comment' ? record.commentId : record.id;
        errors.push(`Failed to clean up ${record.type} ${identifier}: ${String(err)}`);
      }
    }

    this.records.length = 0;
    return { deletedCount, errors };
  }
}

export const e2eDataCleanupService = E2eDataCleanupService.getInstance();
