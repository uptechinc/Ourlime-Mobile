export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;
export type PlaybackStatus = 'idle' | 'dragging' | 'settling';
export type PlaybackSnapshot = {
  time: number; duration: number; status: PlaybackStatus; speed: PlaybackSpeed;
  holding: boolean; error: string | null;
};
export type PlaybackAdapter = {
  time: () => number; duration: () => number; playing: () => boolean;
  seek: (seconds: number) => void; play: () => void; pause: () => void;
  rate: (speed: PlaybackSpeed) => void;
  isSeeking?: () => boolean;
};
export class PlaybackSession {
  private state: PlaybackSnapshot = { time: 0, duration: 0, status: 'idle', speed: 1, holding: false, error: null };
  private active = false;
  private resume = false;
  private seekStarted = 0;
  private originalTime = 0;
  private acknowledgedSamples = 0;
  private constructor(private readonly adapter: PlaybackAdapter, private readonly now: () => number) {}
  public static create(adapter: PlaybackAdapter, now: () => number = Date.now): PlaybackSession {
    return new PlaybackSession(adapter, now);
  }
  public snapshot(): PlaybackSnapshot { return { ...this.state }; }
  public setActive(active: boolean): void {
    if (!active) { this.cancel(false); this.endHold(); }
    this.active = active;
  }
  public tick(): PlaybackSnapshot {
    try {
      const duration = this.adapter.duration();
      this.state.duration = Number.isFinite(duration) && duration > 0 ? duration : 0;
      const time = this.adapter.time();
      if (this.state.status === 'dragging') return this.snapshot();
      if (this.state.status === 'settling') {
        const acknowledged = Number.isFinite(time) && Math.abs(time - this.state.time) <= 0.35 && !this.adapter.isSeeking?.();
        this.acknowledgedSamples = acknowledged ? this.acknowledgedSamples + 1 : 0;
        if (this.acknowledgedSamples >= 2) {
          this.finish();
        } else if (this.now() - this.seekStarted >= 2500) {
          this.state.error = 'Unable to seek. Try again.';
          this.finish();
        } else return this.snapshot();
      }
      if (Number.isFinite(time)) this.state.time = this.clamp(time);
    } catch { this.state.error = 'Video is not ready'; this.state.status = 'idle'; }
    return this.snapshot();
  }
  public begin(): boolean {
    this.tick();
    if (!this.active || !this.state.duration || this.state.status !== 'idle') return false;
    try {
      this.endHold();
      this.resume = this.adapter.playing();
      this.originalTime = this.state.time;
      this.adapter.pause();
      this.state.status = 'dragging';
      this.state.error = null;
      return true;
    } catch { return false; }
  }
  public preview(position: number, width: number): void {
    if (this.state.status !== 'dragging' || !Number.isFinite(width) || width <= 0) return;
    this.state.time = this.clamp(position / width * this.state.duration);
  }
  public commit(): void {
    if (this.state.status !== 'dragging') return;
    try {
      this.state.status = 'settling';
      this.acknowledgedSamples = 0;
      this.seekStarted = this.now();
      this.adapter.seek(this.state.time);
    } catch { this.state.error = 'Unable to seek. Try again.'; this.finish(); }
  }
  public cancel(restorePlayback = true): void {
    if (this.state.status === 'idle') return;
    this.state.time = this.originalTime;
    this.state.status = 'idle';
    if (restorePlayback && this.resume && this.active) {
      try { this.adapter.play(); } catch { /* Player may have been released. */ }
    }
    this.resume = false;
  }
  public setSpeed(speed: PlaybackSpeed): void {
    this.state.speed = speed;
    try { this.adapter.rate(this.state.holding ? 2 : speed); } catch { /* Not ready. */ }
  }
  public beginHold(): void {
    if (!this.active || this.state.status !== 'idle') return;
    try {
      if (!this.adapter.playing()) return;
      this.adapter.rate(2);
      this.state.holding = true;
    } catch { /* Not ready. */ }
  }
  public endHold(): void {
    if (!this.state.holding) return;
    this.state.holding = false;
    try { this.adapter.rate(this.state.speed); } catch { /* Released. */ }
  }
  private finish(): void {
    this.state.status = 'idle';
    const resume = this.resume && this.active;
    this.resume = false;
    if (resume) { try { this.adapter.play(); } catch { /* Released. */ } }
  }
  private clamp(time: number): number {
    return Number.isFinite(time) ? Math.max(0, Math.min(this.state.duration, time)) : 0;
  }
}
export class PlaybackInteractionService {
  private static readonly instance = new PlaybackInteractionService();
  private constructor() {}
  public static getInstance(): PlaybackInteractionService { return this.instance; }
  public createSession(adapter: PlaybackAdapter, now?: () => number): PlaybackSession {
    return PlaybackSession.create(adapter, now);
  }
  public formatTime(seconds: number): string {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }
}
export const playbackInteractionService = PlaybackInteractionService.getInstance();
