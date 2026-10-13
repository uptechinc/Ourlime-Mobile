import { getDoc, type DocumentReference, type DocumentSnapshot } from 'firebase/firestore';

type SharedRead = { promise: Promise<DocumentSnapshot>; settledAt: number | null };

/**
 * Shares reads of the same document made within a few seconds of each other.
 * At startup a dozen services ask for the viewer's profile and account settings at once;
 * on the app's single Firestore connection each duplicate read delays everything behind it.
 * Writers call `invalidate` so a saved change is never served from a shared read.
 */
export class SharedDocumentReader {
  private static instance: SharedDocumentReader;
  private static readonly REUSE_MS = 3000;
  private static readonly MAX_ENTRIES = 200;
  private readonly reads = new Map<string, SharedRead>();

  private constructor() {}

  public static getInstance(): SharedDocumentReader {
    if (!SharedDocumentReader.instance) SharedDocumentReader.instance = new SharedDocumentReader();
    return SharedDocumentReader.instance;
  }

  public read(reference: DocumentReference): Promise<DocumentSnapshot> {
    const existing = this.reads.get(reference.path);
    if (existing && (existing.settledAt === null || Date.now() - existing.settledAt < SharedDocumentReader.REUSE_MS)) {
      return existing.promise;
    }
    if (this.reads.size >= SharedDocumentReader.MAX_ENTRIES) this.pruneSettled();
    const entry: SharedRead = { promise: getDoc(reference), settledAt: null };
    this.reads.set(reference.path, entry);
    entry.promise.then(
      () => { entry.settledAt = Date.now(); },
      () => { if (this.reads.get(reference.path) === entry) this.reads.delete(reference.path); },
    );
    return entry.promise;
  }

  /** Drops the shared read for a document path (call after writing it). */
  public invalidate(path: string): void {
    this.reads.delete(path);
  }

  private pruneSettled(): void {
    const now = Date.now();
    this.reads.forEach((entry, path) => {
      if (entry.settledAt !== null && now - entry.settledAt >= SharedDocumentReader.REUSE_MS) this.reads.delete(path);
    });
  }
}

export const sharedDocumentReader = SharedDocumentReader.getInstance();
