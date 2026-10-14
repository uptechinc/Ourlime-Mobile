import { collection, documentId, getDocs, limit, query, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

/** Firestore accepts at most 30 values in one `in` filter. */
const FIRESTORE_IN_LIMIT = 30;

/**
 * Replaces one-read-per-item loops with `in` queries of 30 values each, all sent at once.
 * Every read in the app shares one long-polling connection, so fewer requests also means less waiting for other screens.
 */
export class FirestoreBatchReadService {
  private static instance: FirestoreBatchReadService;
  public static getInstance(): FirestoreBatchReadService { return this.instance ??= new FirestoreBatchReadService(); }

  /** Documents of `collectionName` whose ids are in `ids`; ids with no document are simply absent from the result. */
  public async getDocumentsByIds(collectionName: string, ids: string[]): Promise<Map<string, DocumentData>> {
    const snapshots = await Promise.all(this.chunk(ids).map((idChunk) =>
      getDocs(query(collection(db, collectionName), where(documentId(), 'in', idChunk), limit(idChunk.length)))));
    return new Map(snapshots.flatMap((snapshot) => snapshot.docs.map((document) => [document.id, document.data()] as [string, DocumentData])));
  }

  /**
   * Documents of `collectionName` whose `field` is one of `values`, in document-id order like an unordered `==` query.
   * `perValueLimit` bounds each chunk's query to the same number of documents per value the single-value query allowed.
   */
  public async getDocumentsByField(collectionName: string, field: string, values: string[], perValueLimit?: number): Promise<QueryDocumentSnapshot<DocumentData>[]> {
    const snapshots = await Promise.all(this.chunk(values).map((valueChunk) => getDocs(query(
      collection(db, collectionName),
      where(field, 'in', valueChunk),
      ...(perValueLimit ? [limit(perValueLimit * valueChunk.length)] : []),
    ))));
    return snapshots.flatMap((snapshot) => snapshot.docs);
  }

  private chunk(values: string[]): string[][] {
    const uniqueValues = [...new Set(values.filter(Boolean))];
    return Array.from({ length: Math.ceil(uniqueValues.length / FIRESTORE_IN_LIMIT) }, (_, index) =>
      uniqueValues.slice(index * FIRESTORE_IN_LIMIT, index * FIRESTORE_IN_LIMIT + FIRESTORE_IN_LIMIT));
  }
}

export const firestoreBatchReadService = FirestoreBatchReadService.getInstance();
