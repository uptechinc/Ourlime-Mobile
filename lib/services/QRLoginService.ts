import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { appServerService } from '@/lib/services/AppServerService';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import type {
  QRLoginSession,
  ActiveDeviceSession,
  DeviceInfo,
} from '@/lib/types/qrLogin';

type QRScanIdentifier = {
  sessionId?: string;
  shortCode?: string;
};

type QRCodePayload = QRScanIdentifier & {
  app?: string;
  action?: string;
};

type QrInitResult = { sessionId: string; shortCode: string; token: string; expiresAt: string; qrDataUrl: string };
type QrStatusResult = { status: QRLoginSession['status']; customToken?: string; rejectionReason?: string; isExpired: boolean };

/** QR sign-in and the signed-in devices list, through the app's own server functions. */
export class QRLoginService {
  private static instance: QRLoginService;

  public static readonly NATIVE_SESSION_KEY = '@ourlime_native_session_id';

  private constructor() {}

  public static getInstance(): QRLoginService {
    if (!QRLoginService.instance) {
      QRLoginService.instance = new QRLoginService();
    }
    return QRLoginService.instance;
  }

  public async initSession(): Promise<QrInitResult> {
    return appServerService.call<QrInitResult>('initQrLogin', this.getDeviceInfo());
  }

  public async getSessionStatus(sessionId: string, token?: string): Promise<QrStatusResult> {
    try {
      return await appServerService.call<QrStatusResult>('getQrLoginStatus', { sessionId, ...(token ? { token } : {}) });
    } catch {
      return { status: 'expired', isExpired: true };
    }
  }

  public async scanPayload(payload: string): Promise<{ success: boolean; session?: QRLoginSession; error?: string }> {
    try {
      return await this.scanQR(this.parsePayload(payload));
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Could not scan QR code.' };
    }
  }

  public async scanShortCode(shortCode: string): Promise<{ success: boolean; session?: QRLoginSession; error?: string }> {
    return this.scanQR({ shortCode: shortCode.trim().toUpperCase() });
  }

  public async scanQR(identifier: QRScanIdentifier): Promise<{ success: boolean; session?: QRLoginSession; error?: string }> {
    try {
      void interactionFeedbackService.play('post');
      const result = await appServerService.call<{ session: QRLoginSession }>('scanQrLogin', {
        sessionId: identifier.sessionId,
        shortCode: identifier.shortCode,
        ...this.getDeviceInfo(),
      });
      return { success: true, session: result.session };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Could not scan QR code.' };
    }
  }

  public async confirmLogin(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      void interactionFeedbackService.play('post');
      await appServerService.call('confirmQrLogin', { sessionId, ...this.getDeviceInfo() });
      void interactionFeedbackService.play('success');
      return { success: true };
    } catch (error: unknown) {
      void interactionFeedbackService.play('warning');
      return { success: false, error: error instanceof Error ? error.message : 'Could not confirm login.' };
    }
  }

  public async rejectLogin(sessionId: string, reason = 'User declined'): Promise<void> {
    try {
      await appServerService.call('rejectQrLogin', { sessionId, reason });
      void interactionFeedbackService.play('warning');
    } catch {
      // The code simply expires if the rejection cannot be saved.
    }
  }

  public async getActiveSessions(): Promise<ActiveDeviceSession[]> {
    try {
      const currentSessionId = await AsyncStorage.getItem(QRLoginService.NATIVE_SESSION_KEY);
      const result = await appServerService.call<{ sessions: ActiveDeviceSession[] }>('listDeviceSessions', currentSessionId ? { currentSessionId } : {});
      return result.sessions;
    } catch {
      return [];
    }
  }

  public async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const result = await appServerService.call<{ success: boolean }>('revokeDeviceSessions', { sessionId });
      if (result.success) void interactionFeedbackService.play('success');
      return result.success;
    } catch {
      return false;
    }
  }

  /** Signs every other device out; this device signs back in with the fresh token the server returns. */
  public async revokeAllOtherSessions(): Promise<{ success: boolean; revokedCount?: number }> {
    try {
      const currentSessionId = await AsyncStorage.getItem(QRLoginService.NATIVE_SESSION_KEY);
      const result = await appServerService.call<{ success: boolean; revokedCount: number; customToken?: string }>('revokeDeviceSessions', {
        allOther: true,
        ...(currentSessionId ? { currentSessionId } : {}),
      });
      if (result.customToken) await signInWithCustomToken(auth, result.customToken);
      void interactionFeedbackService.play('success');
      return { success: true, revokedCount: result.revokedCount };
    } catch {
      return { success: false };
    }
  }

  public async registerCurrentNativeSession(loginMethod: 'password' | 'qr_code' = 'password'): Promise<void> {
    try {
      const result = await appServerService.call<{ session: { id: string } }>('registerDeviceSession', { ...this.getDeviceInfo(), loginMethod });
      await AsyncStorage.setItem(QRLoginService.NATIVE_SESSION_KEY, result.session.id);
    } catch {
      // Non-blocking: the device list simply won't show this phone.
    }
  }

  public subscribeToCurrentSession(userId: string, onRevoked: () => void): () => void {
    let active = true;
    let unsubSnapshot: (() => void) | null = null;

    void AsyncStorage.getItem(QRLoginService.NATIVE_SESSION_KEY).then((sessionId) => {
      if (!active || !sessionId) return;
      unsubSnapshot = onSnapshot(
        doc(db, 'userSessions', userId, 'activeSessions', sessionId),
        (snap) => {
          if (!snap.exists() || snap.data()?.isActive === false) {
            onRevoked();
          }
        },
        () => {}
      );
    });

    return () => {
      active = false;
      if (unsubSnapshot) {
        unsubSnapshot();
      }
    };
  }

  private getDeviceInfo(): DeviceInfo {
    return {
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceType: 'mobile',
      deviceName: Platform.OS === 'ios' ? 'Ourlime App on iOS' : 'Ourlime App on Android',
      browser: 'Ourlime Mobile App',
      os: Platform.OS === 'ios' ? 'iOS' : 'Android',
    };
  }

  private parsePayload(payload: string): QRScanIdentifier {
    const normalizedPayload = payload.trim();
    try {
      const parsed = JSON.parse(normalizedPayload) as QRCodePayload;
      if (parsed.app && parsed.app !== 'ourlime') throw new Error('This QR code is not from Ourlime.');
      if (parsed.action && parsed.action !== 'qr_login') throw new Error('This QR code cannot be used to log in.');
      if (!parsed.sessionId && !parsed.shortCode) throw new Error('This QR code is missing its session.');
      return { sessionId: parsed.sessionId, shortCode: parsed.shortCode };
    } catch (error: unknown) {
      if (!(error instanceof SyntaxError)) throw error;
      return normalizedPayload.toUpperCase().startsWith('OL-')
        ? { shortCode: normalizedPayload.toUpperCase() }
        : { sessionId: normalizedPayload };
    }
  }
}

export const qrLoginService = QRLoginService.getInstance();
