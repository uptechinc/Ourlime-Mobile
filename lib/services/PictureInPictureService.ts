import { NativeEventEmitter, NativeModules, Platform, type EmitterSubscription } from 'react-native';
import { DiagnosticLogService } from './DiagnosticLogService';

type PictureInPictureModule = {
  setPictureInPictureEnabled?: (enabled: boolean) => Promise<boolean>;
  enterPictureInPicture?: () => Promise<boolean>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

type PictureInPictureChangeEvent = { isInPictureInPicture?: boolean };

type PictureInPictureListener = (isInPictureInPicture: boolean) => void;

const PICTURE_IN_PICTURE_EVENT = 'OurlimePictureInPictureChanged';

function getPictureInPictureModule(): PictureInPictureModule | null {
  if (Platform.OS !== 'android') return null;
  const modules = NativeModules as { OurlimeIncomingCall?: PictureInPictureModule };
  return modules.OurlimeIncomingCall ?? null;
}

/**
 * Call picture-in-picture (Android): while a video call is live, pressing Home shrinks Ourlime into a floating
 * window showing both people. Native side: plugins/native-call/OurlimePictureInPicture.kt.
 */
export class PictureInPictureService {
  private static instance: PictureInPictureService;
  private readonly logger = DiagnosticLogService.getInstance();
  private isEnabled = false;

  private constructor() {}

  public static getInstance(): PictureInPictureService {
    if (!PictureInPictureService.instance) PictureInPictureService.instance = new PictureInPictureService();
    return PictureInPictureService.instance;
  }

  /** Turn on while a video call is live, off when it ends. Safe to call repeatedly. */
  public async setEnabled(enabled: boolean): Promise<void> {
    const nativeModule = getPictureInPictureModule();
    if (!nativeModule?.setPictureInPictureEnabled || this.isEnabled === enabled) return;
    this.isEnabled = enabled;
    try {
      const isSupported = await nativeModule.setPictureInPictureEnabled(enabled);
      this.logger.info('PictureInPictureService', 'setEnabled', { enabled, isSupported });
    } catch (error: unknown) {
      this.isEnabled = !enabled;
      this.logger.warn('PictureInPictureService', 'setEnabled:failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Shrink into picture-in-picture right now (e.g. from the minimize button). Returns false if unavailable. */
  public async enter(): Promise<boolean> {
    const nativeModule = getPictureInPictureModule();
    if (!nativeModule?.enterPictureInPicture) return false;
    try {
      return await nativeModule.enterPictureInPicture();
    } catch (error: unknown) {
      this.logger.warn('PictureInPictureService', 'enter:failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public subscribe(listener: PictureInPictureListener): () => void {
    const nativeModule = getPictureInPictureModule();
    if (!nativeModule) return () => undefined;
    const emitter = new NativeEventEmitter(nativeModule);
    const subscription: EmitterSubscription = emitter.addListener(PICTURE_IN_PICTURE_EVENT, (event: PictureInPictureChangeEvent) => {
      listener(event.isInPictureInPicture === true);
    });
    return () => subscription.remove();
  }
}

export const pictureInPictureService = PictureInPictureService.getInstance();
