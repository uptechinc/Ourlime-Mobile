import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

type WorkRow = { payload: string; schema_version: number; revision: number };
export type WorkNamespace = 'draft' | 'cart' | 'seller' | 'mutation' | 'checkout';
export type DurableRecord<TValue> = { value: TValue; revision: number };

/** User-authored work has its own database, with no TTL or cache-eviction path. */
export class DurableWorkService {
  private static instance: DurableWorkService;
  private database: Promise<SQLiteDatabase> | null = null;
  private queue: Promise<void> = Promise.resolve();

  public static getInstance(): DurableWorkService {
    return this.instance ??= new DurableWorkService();
  }

  private enqueue<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    const result = this.queue.then(operation);
    this.queue = result.then(() => {}, () => {});
    return result;
  }

  private async open(): Promise<SQLiteDatabase> {
    if (!this.database) {
      this.database = (async () => {
        const database = await openDatabaseAsync('ourlime-user-work.db');
        await database.execAsync(`PRAGMA journal_mode = WAL;
          PRAGMA synchronous = FULL;
          CREATE TABLE IF NOT EXISTS durable_work (
            owner_id TEXT NOT NULL, namespace TEXT NOT NULL, work_id TEXT NOT NULL,
            payload TEXT NOT NULL, schema_version INTEGER NOT NULL, revision INTEGER NOT NULL,
            PRIMARY KEY (owner_id, namespace, work_id)
          );`);
        return database;
      })().catch((error: unknown) => { this.database = null; throw error; });
    }
    return this.database;
  }

  public async read<TValue>(ownerId: string, namespace: WorkNamespace, id: string, decode: (value: unknown) => TValue): Promise<DurableRecord<TValue> | null> {
    return this.enqueue(async () => {
      const database = await this.open();
      const row = await database.getFirstAsync<WorkRow>('SELECT payload, schema_version, revision FROM durable_work WHERE owner_id = ? AND namespace = ? AND work_id = ?', ownerId, namespace, id);
      if (!row) return null;
      if (row.schema_version !== 1) throw new Error('This saved work requires a newer app. It has been preserved.');
      const parsed: unknown = JSON.parse(row.payload);
      return { value: decode(parsed), revision: row.revision };
    });
  }

  public async list<TValue>(ownerId: string, namespace: WorkNamespace, decode: (value: unknown) => TValue): Promise<TValue[]> {
    return this.enqueue(async () => {
      const database = await this.open();
      const rows = await database.getAllAsync<WorkRow>('SELECT payload, schema_version, revision FROM durable_work WHERE owner_id = ? AND namespace = ? ORDER BY work_id', ownerId, namespace);
      return rows.map((row) => {
        if (row.schema_version !== 1) throw new Error('Saved work requires migration. No records were removed.');
        const parsed: unknown = JSON.parse(row.payload);
        return decode(parsed);
      });
    });
  }

  /** Compare-and-swap prevents late hydration or acknowledgement from replacing newer typing. */
  public async write<TValue>(ownerId: string, namespace: WorkNamespace, id: string, value: TValue, expectedRevision: number): Promise<number> {
    if (!ownerId || !id) throw new Error('Saved work requires an owner and ID.');
    const payload = JSON.stringify(value);
    return this.enqueue(async () => {
      const database = await this.open();
      const revision = expectedRevision + 1;
      const result = expectedRevision === 0
        ? await database.runAsync('INSERT OR IGNORE INTO durable_work (owner_id, namespace, work_id, payload, schema_version, revision) VALUES (?, ?, ?, ?, 1, ?)', ownerId, namespace, id, payload, revision)
        : await database.runAsync('UPDATE durable_work SET payload = ?, revision = ? WHERE owner_id = ? AND namespace = ? AND work_id = ? AND revision = ?', payload, revision, ownerId, namespace, id, expectedRevision);
      if (result.changes !== 1) throw new Error('Saved work changed while saving. Reload before replacing it.');
      return revision;
    });
  }

  public async remove(ownerId: string, namespace: WorkNamespace, id: string, expectedRevision: number): Promise<void> {
    return this.enqueue(async () => {
      const database = await this.open();
      const result = await database.runAsync('DELETE FROM durable_work WHERE owner_id = ? AND namespace = ? AND work_id = ? AND revision = ?', ownerId, namespace, id, expectedRevision);
      if (result.changes !== 1) throw new Error('Saved work changed before deletion. It was preserved.');
    });
  }
}

export const durableWorkService = DurableWorkService.getInstance();
