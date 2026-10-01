export class ContentDateService {
  private static instance: ContentDateService;
  private constructor() {}
  public static getInstance(): ContentDateService {
    if (!this.instance) this.instance = new ContentDateService();
    return this.instance;
  }

  public toMilliseconds(value: unknown): number | null {
    let milliseconds: number;
    if (value instanceof Date) milliseconds = value.getTime();
    else if (typeof value === 'number') milliseconds = Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
    else if (typeof value === 'string' && value.trim()) milliseconds = Date.parse(value);
    else if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      try { const date: unknown = value.toDate(); return date instanceof Date ? this.toMilliseconds(date) : null; } catch { return null; }
    } else if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') milliseconds = value.seconds * 1000;
    else if (value && typeof value === 'object' && '_seconds' in value && typeof value._seconds === 'number') milliseconds = value._seconds * 1000;
    else return null;
    return Number.isFinite(milliseconds) && Math.abs(milliseconds) <= 8640000000000000 ? milliseconds : null;
  }

  public formatCommentDate(value: unknown, pending = false): string {
    if (pending) return 'Sending';
    const milliseconds = this.toMilliseconds(value);
    return milliseconds === null ? 'Date unavailable' : new Date(milliseconds).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }
}

export const contentDateService = ContentDateService.getInstance();
