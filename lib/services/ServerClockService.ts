import { DiagnosticLogService } from './DiagnosticLogService';

// Google's Firebase Storage host (already used for every media download) returns a standard HTTP Date header.
const CLOCK_SOURCE_URL = 'https://firebasestorage.googleapis.com/';
const CLOCK_TIMEOUT_MS = 4000;

/**
 * Estimates the real time, so time-based clean-up (draft expiry) doesn't trust a phone clock that is set wrong.
 * The offset is measured once per app session; when it can't be measured, the device clock is used.
 */
export class ServerClockService {
  private static instance: ServerClockService;
  private readonly logger = DiagnosticLogService.getInstance();
  private offsetMs: number | null = null;
  private pending: Promise<number> | null = null;

  private constructor() {}

  public static getInstance(): ServerClockService {
    if (!ServerClockService.instance) ServerClockService.instance = new ServerClockService();
    return ServerClockService.instance;
  }

  /** Best estimate of the current time in ms (server time when known, otherwise the device clock). */
  public async now(): Promise<number> {
    if (this.offsetMs === null) {
      this.pending ??= this.measureOffset();
      this.offsetMs = await this.pending;
    }
    return Date.now() + this.offsetMs;
  }

  /** Same estimate without waiting: uses the offset if it's known and starts measuring it otherwise. */
  public nowSync(): number {
    if (this.offsetMs === null) void this.now();
    return Date.now() + (this.offsetMs ?? 0);
  }

  private async measureOffset(): Promise<number> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLOCK_TIMEOUT_MS);
    try {
      const startedAt = Date.now();
      const response = await fetch(CLOCK_SOURCE_URL, { method: 'HEAD', signal: controller.signal });
      const header = response.headers.get('date');
      const serverMs = header ? Date.parse(header) : Number.NaN;
      if (!Number.isFinite(serverMs)) return 0;
      // Date headers have 1 s resolution; ignore differences smaller than a minute.
      const offset = serverMs - (startedAt + (Date.now() - startedAt) / 2);
      return Math.abs(offset) < 60_000 ? 0 : offset;
    } catch (error: unknown) {
      this.logger.warn('ServerClockService', 'measureOffset', { error: error instanceof Error ? error.message : String(error) });
      this.pending = null;
      return 0;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const serverClockService = ServerClockService.getInstance();
