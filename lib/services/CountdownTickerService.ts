import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

type CountdownListener = (nowMs: number) => void;

export class CountdownTickerService {
  private static instance: CountdownTickerService;
  private readonly listeners = new Set<CountdownListener>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;
  private appState: AppStateStatus = AppState.currentState;

  private constructor() {}

  public static getInstance(): CountdownTickerService {
    if (!CountdownTickerService.instance) {
      CountdownTickerService.instance = new CountdownTickerService();
    }
    return CountdownTickerService.instance;
  }

  public subscribe(listener: CountdownListener): () => void {
    this.listeners.add(listener);
    listener(Date.now());
    this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  private start(): void {
    if (!this.appStateSubscription) {
      this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
        this.appState = nextState;
        if (nextState === 'active') this.startInterval();
        else this.stopInterval();
      });
    }
    if (this.appState === 'active') this.startInterval();
  }

  private startInterval(): void {
    if (this.interval || this.listeners.size === 0) return;
    this.interval = setInterval(() => {
      const nowMs = Date.now();
      this.listeners.forEach((listener) => listener(nowMs));
    }, 1_000);
  }

  private stopInterval(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  private stop(): void {
    this.stopInterval();
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }
}

export const countdownTickerService = CountdownTickerService.getInstance();
