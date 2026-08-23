import { Image } from 'expo-image';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { crashReportingService } from './CrashReportingService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { openGraphService } from './OpenGraphService';

const BACKGROUND_RELEASE_DELAY_MS = 10_000;

export class MemoryPressureService {
  private static instance: MemoryPressureService;
  private readonly logger = DiagnosticLogService.getInstance();
  private installed = false;
  private appStateSubscription: NativeEventSubscription | null = null;
  private memoryWarningSubscription: NativeEventSubscription | null = null;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  public static getInstance(): MemoryPressureService {
    if (!MemoryPressureService.instance) {
      MemoryPressureService.instance = new MemoryPressureService();
    }
    return MemoryPressureService.instance;
  }

  public install(): void {
    if (this.installed) return;
    this.installed = true;
    this.appStateSubscription = AppState.addEventListener('change', (nextState) => this.handleAppState(nextState));
    this.memoryWarningSubscription = AppState.addEventListener('memoryWarning', () => {
      crashReportingService.log('memory-warning: releasing transient image and link-preview caches');
      void this.releaseTransientMemory('memory-warning');
    });
  }

  private handleAppState(nextState: AppStateStatus): void {
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
    if (nextState === 'active') return;
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null;
      void this.releaseTransientMemory('background');
    }, BACKGROUND_RELEASE_DELAY_MS);
  }

  private async releaseTransientMemory(reason: 'background' | 'memory-warning'): Promise<void> {
    openGraphService.clearMemoryCache();
    const didClearImageCache = await Image.clearMemoryCache().catch(() => false);
    this.logger.info('MemoryPressureService', 'release', { reason, didClearImageCache });
  }
}

export const memoryPressureService = MemoryPressureService.getInstance();
