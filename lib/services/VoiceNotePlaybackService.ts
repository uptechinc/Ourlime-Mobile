import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { ensureMediaUrl } from '@/lib/helpers/mediaUrl';

export type VoiceNotePlaybackState = {
  /** The voice note / audio file this state belongs to (null when nothing is loaded). */
  activeId: string | null;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  error: string | null;
};

type Listener = (state: VoiceNotePlaybackState) => void;

const LOAD_TIMEOUT_MS = 15_000;
export const VOICE_NOTE_RATES = [1, 1.5, 2] as const;

const IDLE_STATE: VoiceNotePlaybackState = { activeId: null, playing: false, loading: false, currentTime: 0, duration: 0, rate: 1, error: null };

/**
 * Plays chat voice notes and audio files inside the app. One shared player, so only one clip plays at a time and a
 * long chat doesn't create a native player per bubble.
 */
export class VoiceNotePlaybackService {
  private static instance: VoiceNotePlaybackService;
  private player: AudioPlayer | null = null;
  private statusSubscription: { remove: () => void } | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private state: VoiceNotePlaybackState = IDLE_STATE;
  private readonly listeners = new Set<Listener>();

  private constructor() {}

  public static getInstance(): VoiceNotePlaybackService {
    if (!VoiceNotePlaybackService.instance) VoiceNotePlaybackService.instance = new VoiceNotePlaybackService();
    return VoiceNotePlaybackService.instance;
  }

  public getState(): VoiceNotePlaybackState {
    return this.state;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Plays/pauses this clip; starting a different clip stops the current one. */
  public async toggle(id: string, url: string): Promise<void> {
    if (this.state.activeId === id && this.player && !this.state.error) {
      if (this.state.playing) this.player.pause();
      else {
        if (this.state.duration > 0 && this.state.currentTime >= this.state.duration - 0.25) await this.player.seekTo(0);
        this.player.play();
      }
      return;
    }
    await this.load(id, url);
  }

  public async seek(id: string, fraction: number): Promise<void> {
    if (this.state.activeId !== id || !this.player || this.state.duration <= 0) return;
    const seconds = Math.max(0, Math.min(1, fraction)) * this.state.duration;
    await this.player.seekTo(seconds);
    this.publish({ currentTime: seconds });
  }

  public cycleRate(id: string): void {
    if (this.state.activeId !== id || !this.player) return;
    const index = VOICE_NOTE_RATES.indexOf(this.state.rate as (typeof VOICE_NOTE_RATES)[number]);
    const rate = VOICE_NOTE_RATES[(index + 1) % VOICE_NOTE_RATES.length];
    this.player.setPlaybackRate(rate);
    this.publish({ rate });
  }

  /** Stops playback (e.g. when leaving the chat). */
  public stop(): void {
    this.release();
    this.state = IDLE_STATE;
    this.emit();
  }

  private async load(id: string, url: string): Promise<void> {
    this.release();
    this.state = { ...IDLE_STATE, activeId: id, loading: true };
    this.emit();
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', allowsRecording: false, shouldPlayInBackground: false, shouldRouteThroughEarpiece: false });
      const player = createAudioPlayer({ uri: ensureMediaUrl(url) || url }, { updateInterval: 200 });
      this.player = player;
      this.statusSubscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => this.handleStatus(id, status));
      player.play();
      this.loadTimer = setTimeout(() => {
        if (this.state.activeId === id && this.state.loading) this.fail(id, 'This audio could not be loaded. Check your connection and try again.');
      }, LOAD_TIMEOUT_MS);
    } catch (error: unknown) {
      console.error('[VoiceNotePlaybackService.load] Error:', error instanceof Error ? error.message : String(error));
      this.fail(id, 'This audio could not be played on this device.');
    }
  }

  private handleStatus(id: string, status: AudioStatus): void {
    if (this.state.activeId !== id) return;
    const loaded = status.isLoaded;
    if (loaded && this.loadTimer) { clearTimeout(this.loadTimer); this.loadTimer = null; }
    if (status.playbackState === 'failed' || status.playbackState === 'error') {
      this.fail(id, 'This audio format can\'t be played on this device.');
      return;
    }
    const finished = status.didJustFinish;
    this.publish({
      playing: finished ? false : status.playing,
      loading: !loaded || (status.isBuffering && !status.playing),
      currentTime: finished ? status.duration || this.state.currentTime : status.currentTime,
      duration: status.duration > 0 && Number.isFinite(status.duration) ? status.duration : this.state.duration,
    });
  }

  private fail(id: string, message: string): void {
    if (this.state.activeId !== id) return;
    this.release();
    this.state = { ...IDLE_STATE, activeId: id, error: message };
    this.emit();
  }

  private release(): void {
    if (this.loadTimer) { clearTimeout(this.loadTimer); this.loadTimer = null; }
    this.statusSubscription?.remove();
    this.statusSubscription = null;
    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch (error: unknown) {
        console.warn('[VoiceNotePlaybackService.release] Error:', error instanceof Error ? error.message : String(error));
      }
    }
    this.player = null;
  }

  private publish(update: Partial<VoiceNotePlaybackState>): void {
    this.state = { ...this.state, ...update };
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export const voiceNotePlaybackService = VoiceNotePlaybackService.getInstance();
