import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { DiagnosticLogService } from './DiagnosticLogService';
import { RequestTimeoutService } from './RequestTimeoutService';

type CacheRow = {
  payload: string;
  updated_at: number;
  expires_at: number;
  schema_version: number;
};

export type CachedRecord<TData> = {
  data: TData;
  updatedAt: number;
  expiresAt: number;
  isExpired: boolean;
};

export type CacheWriteOptions = {
  expiresAt: number;
  schemaVersion?: number;
};

const DATABASE_NAME = 'ourlime-cache.db';
const CURRENT_DATABASE_VERSION = 1;

export class LocalCacheService {
  private static instance: LocalCacheService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly timeoutService = RequestTimeoutService.getInstance();
  private databasePromise: Promise<SQLiteDatabase> | null = null;
  private queue = Promise.resolve();

  private constructor() {}

  public static getInstance(): LocalCacheService {
    if (!LocalCacheService.instance) LocalCacheService.instance = new LocalCacheService();
    return LocalCacheService.instance;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(() => {}, () => {});
    return result;
  }

  public async initialize(): Promise<void> {
    try {
      await this.getDatabase();
    } catch {
      // Non-fatal
    }
  }

  public async read<TData>(userId: string, namespace: string, cacheKey: string, schemaVersion = 1): Promise<CachedRecord<TData> | null> {
    return this.enqueue(async () => {
      const startedAt = Date.now();
      try {
        const database = await this.getDatabase();
        const row = await database.getFirstAsync<CacheRow>(
          'SELECT payload, updated_at, expires_at, schema_version FROM resource_cache WHERE user_id = ? AND namespace = ? AND cache_key = ?',
          userId,
          namespace,
          cacheKey,
        );
        if (!row) {
          this.logger.info('LocalCacheService', 'read:miss', { namespace, cacheKey, elapsedMs: Date.now() - startedAt });
          return null;
        }
        if (row.schema_version !== schemaVersion) {
          await this.removeInternal(database, userId, namespace, cacheKey);
          this.logger.warn('LocalCacheService', 'read:schema-mismatch', { namespace, cacheKey, storedVersion: row.schema_version, schemaVersion });
          return null;
        }
        const data = JSON.parse(row.payload) as TData;
        this.logger.info('LocalCacheService', 'read:hit', { namespace, cacheKey, elapsedMs: Date.now() - startedAt, expired: row.expires_at <= Date.now() });
        return { data, updatedAt: row.updated_at, expiresAt: row.expires_at, isExpired: row.expires_at <= Date.now() };
      } catch (error: unknown) {
        this.logger.warn('LocalCacheService', 'read:error', { namespace, cacheKey, error: error instanceof Error ? error.message : String(error) });
        return null;
      }
    });
  }

  public async write<TData>(userId: string, namespace: string, cacheKey: string, data: TData, options: CacheWriteOptions): Promise<void> {
    return this.enqueue(async () => {
      const startedAt = Date.now();
      try {
        const database = await this.getDatabase();
        const updatedAt = Date.now();
        await database.runAsync(
          `INSERT INTO resource_cache (user_id, namespace, cache_key, payload, updated_at, expires_at, last_accessed_at, schema_version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, namespace, cache_key) DO UPDATE SET
             payload = excluded.payload,
             updated_at = excluded.updated_at,
             expires_at = excluded.expires_at,
             last_accessed_at = excluded.last_accessed_at,
             schema_version = excluded.schema_version`,
          userId,
          namespace,
          cacheKey,
          JSON.stringify(data),
          updatedAt,
          options.expiresAt,
          updatedAt,
          options.schemaVersion ?? 1,
        );
        this.logger.info('LocalCacheService', 'write', { namespace, cacheKey, recordCount: this.getRecordCount(data), elapsedMs: Date.now() - startedAt });
      } catch (error: unknown) {
        this.logger.warn('LocalCacheService', 'write:error', { namespace, cacheKey, error: error instanceof Error ? error.message : String(error) });
      }
    });
  }

  public async touch(userId: string, namespace: string, cacheKey: string): Promise<void> {
    return this.enqueue(async () => {
      try {
        const database = await this.getDatabase();
        await database.runAsync('UPDATE resource_cache SET last_accessed_at = ? WHERE user_id = ? AND namespace = ? AND cache_key = ?', Date.now(), userId, namespace, cacheKey);
      } catch {
        // Safe fallback
      }
    });
  }

  public async remove(userId: string, namespace: string, cacheKey: string): Promise<void> {
    return this.enqueue(async () => {
      try {
        const database = await this.getDatabase();
        await this.removeInternal(database, userId, namespace, cacheKey);
      } catch {
        // Safe fallback
      }
    });
  }

  public async clearUser(userId: string): Promise<void> {
    return this.enqueue(async () => {
      try {
        const database = await this.getDatabase();
        await database.runAsync('DELETE FROM resource_cache WHERE user_id = ?', userId);
        this.logger.info('LocalCacheService', 'clear-user', { userId });
      } catch {
        // Safe fallback
      }
    });
  }

  public async prune(options: { namespace: string; userId: string; maximumRecords: number; maximumExpiredAgeMs?: number }): Promise<void> {
    return this.enqueue(async () => {
      try {
        const database = await this.getDatabase();
        const expiredBefore = Date.now() - (options.maximumExpiredAgeMs ?? 0);
        await database.runAsync('DELETE FROM resource_cache WHERE user_id = ? AND namespace = ? AND expires_at < ?', options.userId, options.namespace, expiredBefore);
        await database.runAsync(
          `DELETE FROM resource_cache WHERE id IN (
            SELECT id FROM resource_cache WHERE user_id = ? AND namespace = ?
            ORDER BY last_accessed_at DESC LIMIT -1 OFFSET ?
          )`,
          options.userId,
          options.namespace,
          options.maximumRecords,
        );
      } catch {
        // Safe fallback
      }
    });
  }

  private async removeInternal(database: SQLiteDatabase, userId: string, namespace: string, cacheKey: string): Promise<void> {
    await database.runAsync('DELETE FROM resource_cache WHERE user_id = ? AND namespace = ? AND cache_key = ?', userId, namespace, cacheKey);
  }

  private async getDatabase(): Promise<SQLiteDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = this.timeoutService
        .run(this.openAndMigrate(), 'Local cache initialization', 8_000)
        .catch((error: unknown) => {
          this.databasePromise = null;
          throw error;
        });
    }
    return this.databasePromise;
  }

  private getRecordCount(value: unknown): number {
    if (Array.isArray(value)) return value.length;
    if (!value || typeof value !== 'object') return 1;
    const record = value as Record<string, unknown>;
    for (const key of ['posts', 'messages', 'items', 'pendingPosts']) {
      if (Array.isArray(record[key])) return record[key].length;
    }
    return 1;
  }

  private async openAndMigrate(): Promise<SQLiteDatabase> {
    const database = await openDatabaseAsync(DATABASE_NAME);
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS resource_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        namespace TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        schema_version INTEGER NOT NULL DEFAULT 1,
        UNIQUE(user_id, namespace, cache_key)
      );
      CREATE INDEX IF NOT EXISTS resource_cache_lookup ON resource_cache(user_id, namespace, cache_key);
      CREATE INDEX IF NOT EXISTS resource_cache_lru ON resource_cache(user_id, namespace, last_accessed_at DESC);
      PRAGMA user_version = ${CURRENT_DATABASE_VERSION};
    `);
    this.logger.success('LocalCacheService', 'initialize', { databaseVersion: CURRENT_DATABASE_VERSION });
    return database;
  }
}

export const localCacheService = LocalCacheService.getInstance();
