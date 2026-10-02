import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalFormDraftKind = 'event' | 'job' | 'jobApplication';

export type LocalFormDraft<T> = { data: T; savedAt: string };

/**
 * On-device drafts for long forms (events, job listings, job applications), like the website keeps them in the
 * browser. One draft per user and form (applications: one per job).
 */
export class LocalFormDraftService {
  private static instance: LocalFormDraftService;

  private constructor() {}

  public static getInstance(): LocalFormDraftService {
    if (!LocalFormDraftService.instance) LocalFormDraftService.instance = new LocalFormDraftService();
    return LocalFormDraftService.instance;
  }

  public async load<T>(ownerId: string, kind: LocalFormDraftKind, scopeId?: string): Promise<LocalFormDraft<T> | null> {
    try {
      const raw = await AsyncStorage.getItem(this.key(ownerId, kind, scopeId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<LocalFormDraft<T>>;
      return parsed && parsed.data !== undefined && typeof parsed.savedAt === 'string' ? { data: parsed.data, savedAt: parsed.savedAt } : null;
    } catch (error: unknown) {
      console.warn('[LocalFormDraftService.load] Error:', error instanceof Error ? error.message : 'Could not read draft');
      return null;
    }
  }

  public async save<T>(ownerId: string, kind: LocalFormDraftKind, data: T, scopeId?: string): Promise<LocalFormDraft<T>> {
    const draft: LocalFormDraft<T> = { data, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(this.key(ownerId, kind, scopeId), JSON.stringify(draft));
    return draft;
  }

  public async clear(ownerId: string, kind: LocalFormDraftKind, scopeId?: string): Promise<void> {
    await AsyncStorage.removeItem(this.key(ownerId, kind, scopeId));
  }

  private key(ownerId: string, kind: LocalFormDraftKind, scopeId?: string): string {
    return `ourlime:draft:${ownerId}:${kind}${scopeId ? `:${scopeId}` : ''}`;
  }
}

export const localFormDraftService = LocalFormDraftService.getInstance();
