import releaseHistoryFile from '@/lib/releaseHistory.json';
import type { AppRelease, ReleaseHistoryFile, ReleaseKind } from '@/lib/types/releaseHistory';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Every published app release and OTA, newest first, from lib/releaseHistory.json. The file ships inside the bundle,
 * so the newest entry always describes what is running ("What's new"), and the Release notes screen lists them all.
 * Releases add an entry at the top; past entries are never edited (see the app-release skill).
 */
export class ReleaseHistoryService {
  private static instance: ReleaseHistoryService;
  private readonly releases: AppRelease[];

  private constructor() {
    const file = releaseHistoryFile as ReleaseHistoryFile;
    this.releases = (Array.isArray(file.releases) ? file.releases : [])
      .map((release) => ({ ...release, notes: release.notes.map((note) => note.trim()).filter((note) => note.length > 0) }))
      .filter((release) => release.notes.length > 0);
  }

  public static getInstance(): ReleaseHistoryService {
    if (!ReleaseHistoryService.instance) ReleaseHistoryService.instance = new ReleaseHistoryService();
    return ReleaseHistoryService.instance;
  }

  public getAll(): AppRelease[] {
    return this.releases;
  }

  /** The newest release for this version: what "What's new" shows after an update (an OTA's notes when one ran). */
  public getLatestFor(version: string): AppRelease | null {
    return this.releases.find((release) => release.version === version) ?? null;
  }

  public formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) return date;
    return `${MONTHS[month - 1] ?? ''} ${day}, ${year}`;
  }

  public kindLabel(kind: ReleaseKind): string {
    return kind === 'ota' ? 'Quick update' : 'App update';
  }
}

export const releaseHistoryService = ReleaseHistoryService.getInstance();
