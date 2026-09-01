import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { ApiService } from '@/lib/services/ApiService';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import { platformEnvironmentService } from '@/lib/services/PlatformEnvironmentService';
import type {
  QRLoginSession,
  ActiveDeviceSession,
  DeviceInfo,
} from '@/lib/types/qrLogin';

type QRScanIdentifier = {
  sessionId?: string;
  shortCode?: string;
  apiOrigin?: string;
};

type QRCodePayload = QRScanIdentifier & {
  app?: string;
  action?: string;
};

export class QRLoginService {
  private static instance: QRLoginService;
  private readonly apiService = ApiService.getInstance();
  private readonly sessionApiOrigins = new Map<string, string>();

  private constructor() {}

  public static getInstance(): QRLoginService {
    if (!QRLoginService.instance) {
      QRLoginService.instance = new QRLoginService();
    }
    return QRLoginService.instance;
  }

  public async initSession(): Promise<{
    sessionId: string;
    shortCode: string;
    token: string;
    expiresAt: string;
    qrDataUrl: string;
  }> {
    const deviceInfo: DeviceInfo = {
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceType: 'mobile',
      deviceName: Platform.OS === 'ios' ? 'Ourlime App on iOS' : 'Ourlime App on Android',
      browser: 'Ourlime Mobile App',
      os: Platform.OS === 'ios' ? 'iOS' : 'Android',
    };

    const response = await this.apiService.request<{
      success: boolean;
      sessionId: string;
      shortCode: string;
      token: string;
      expiresAt: string;
      qrDataUrl: string;
    }>('/api/auth/qr/init', {
      method: 'POST',
      body: deviceInfo,
    });

    if (!response?.success) {
      throw new Error('Failed to initialize QR session.');
    }

    return response;
  }

  public async getSessionStatus(
    sessionId: string,
    token?: string
  ): Promise<{
    status: QRLoginSession['status'];
    customToken?: string;
    rejectionReason?: string;
    isExpired: boolean;
  }> {
    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
    const response = await this.apiService.request<{
      success: boolean;
      status: QRLoginSession['status'];
      customToken?: string;
      rejectionReason?: string;
      isExpired: boolean;
    }>(`/api/auth/qr/status?sessionId=${sessionId}${tokenQuery}`, {
      method: 'GET',
    });

    if (!response?.success) {
      return { status: 'expired', isExpired: true };
    }

    return response;
  }

  public async scanPayload(payload: string): Promise<{
    success: boolean;
    session?: QRLoginSession;
    error?: string;
  }> {
    const identifier = this.parsePayload(payload);
    return this.scanQR(identifier);
  }

  public async scanShortCode(shortCode: string): Promise<{
    success: boolean;
    session?: QRLoginSession;
    error?: string;
  }> {
    return this.scanQR({
      shortCode: shortCode.trim().toUpperCase(),
      apiOrigin: this.getDevelopmentApiOrigin(),
    });
  }

  public async scanQR(identifier: QRScanIdentifier): Promise<{
    success: boolean;
    session?: QRLoginSession;
    error?: string;
  }> {
    try {
      void interactionFeedbackService.play('post');
      const apiOrigin = this.resolveApiOrigin(identifier.apiOrigin);
      const response = await this.apiService.request<{
        success: boolean;
        session?: QRLoginSession;
        error?: string;
      }>('/api/auth/qr/scan', {
        method: 'POST',
        authenticated: true,
        body: {
          sessionId: identifier.sessionId,
          shortCode: identifier.shortCode,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceType: 'mobile',
          deviceName: Platform.OS === 'ios' ? 'Ourlime App on iOS' : 'Ourlime App on Android',
          browser: 'Ourlime Mobile App',
          os: Platform.OS === 'ios' ? 'iOS' : 'Android',
        },
        baseUrlOverride: apiOrigin,
        availabilityImpact: 'request-only',
      });

      if (response.success && response.session?.sessionId && apiOrigin) {
        this.sessionApiOrigins.set(response.session.sessionId, apiOrigin);
      }

      return response;
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Could not scan QR code.',
      };
    }
  }

  public async confirmLogin(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      void interactionFeedbackService.play('post');
      const response = await this.apiService.request<{
        success: boolean;
        error?: string;
      }>('/api/auth/qr/confirm', {
        method: 'POST',
        authenticated: true,
        body: {
          sessionId,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceType: 'mobile',
          deviceName: Platform.OS === 'ios' ? 'Ourlime App on iOS' : 'Ourlime App on Android',
          browser: 'Ourlime Mobile App',
          os: Platform.OS === 'ios' ? 'iOS' : 'Android',
        },
        baseUrlOverride: this.sessionApiOrigins.get(sessionId),
        availabilityImpact: 'request-only',
      });

      if (response?.success) {
        void interactionFeedbackService.play('success');
      }
      return response;
    } catch (err: unknown) {
      void interactionFeedbackService.play('warning');
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Could not confirm login.',
      };
    }
  }

  public async rejectLogin(sessionId: string, reason = 'User declined'): Promise<void> {
    try {
      await this.apiService.request('/api/auth/qr/reject', {
        method: 'POST',
        authenticated: true,
        body: { sessionId, reason },
        baseUrlOverride: this.sessionApiOrigins.get(sessionId),
        availabilityImpact: 'request-only',
      });
      void interactionFeedbackService.play('warning');
    } catch {
      // Ignore
    }
  }

  public async getActiveSessions(): Promise<ActiveDeviceSession[]> {
    try {
      const response = await this.apiService.request<{
        success: boolean;
        sessions: ActiveDeviceSession[];
      }>('/api/auth/sessions', {
        method: 'GET',
        authenticated: true,
      });

      return response?.sessions || [];
    } catch {
      return [];
    }
  }

  public async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const response = await this.apiService.request<{ success: boolean }>('/api/auth/sessions', {
        method: 'DELETE',
        authenticated: true,
        body: { sessionId },
      });

      if (response?.success) {
        void interactionFeedbackService.play('success');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async revokeAllOtherSessions(): Promise<{ success: boolean; revokedCount?: number }> {
    try {
      const response = await this.apiService.request<{ success: boolean; revokedCount?: number }>('/api/auth/sessions', {
        method: 'DELETE',
        authenticated: true,
        body: { allOther: true },
      });

      if (response?.success) {
        void interactionFeedbackService.play('success');
        return { success: true, revokedCount: response.revokedCount };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  }

  public static readonly NATIVE_SESSION_KEY = '@ourlime_native_session_id';

  public async registerCurrentNativeSession(loginMethod: 'password' | 'qr_code' = 'password'): Promise<void> {
    try {
      const deviceInfo: DeviceInfo & { loginMethod: string } = {
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceType: 'mobile',
        deviceName: Platform.OS === 'ios' ? 'Ourlime App on iOS' : 'Ourlime App on Android',
        browser: 'Ourlime Mobile App',
        os: Platform.OS === 'ios' ? 'iOS' : 'Android',
        loginMethod,
      };

      const response = await this.apiService.request<{ success: boolean; session?: { id: string } }>('/api/auth/sessions/register', {
        method: 'POST',
        authenticated: true,
        body: deviceInfo,
      });

      if (response?.session?.id) {
        await AsyncStorage.setItem(QRLoginService.NATIVE_SESSION_KEY, response.session.id);
      }
    } catch {
      // Non-blocking
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

  private parsePayload(payload: string): QRScanIdentifier {
    const normalizedPayload = payload.trim();
    try {
      const parsed = JSON.parse(normalizedPayload) as QRCodePayload;
      if (parsed.app && parsed.app !== 'ourlime') throw new Error('This QR code is not from Ourlime.');
      if (parsed.action && parsed.action !== 'qr_login') throw new Error('This QR code cannot be used to log in.');
      if (!parsed.sessionId && !parsed.shortCode) throw new Error('This QR code is missing its session.');
      return {
        sessionId: parsed.sessionId,
        shortCode: parsed.shortCode,
        apiOrigin: parsed.apiOrigin ?? this.getDevelopmentApiOrigin(),
      };
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        if (normalizedPayload.toUpperCase().startsWith('OL-')) {
          return {
            shortCode: normalizedPayload.toUpperCase(),
            apiOrigin: this.getDevelopmentApiOrigin(),
          };
        }
        return {
          sessionId: normalizedPayload,
          apiOrigin: this.getDevelopmentApiOrigin(),
        };
      }
      throw error;
    }
  }

  private resolveApiOrigin(apiOrigin?: string): string | undefined {
    if (!apiOrigin) return undefined;
    const parsedOrigin = new URL(apiOrigin);
    const hostName = parsedOrigin.hostname.toLowerCase();
    const isLocalHost = hostName === 'localhost' || hostName === '127.0.0.1';
    if (isLocalHost) {
      const developmentHost = platformEnvironmentService.getDevelopmentHostName();
      if (!developmentHost) {
        throw new Error('The local Ourlime server address could not be resolved from this device.');
      }
      return `${parsedOrigin.protocol}//${developmentHost}${parsedOrigin.port ? `:${parsedOrigin.port}` : ''}`;
    }

    const isOurlimeHost = hostName === 'ourlime.com' || hostName === 'www.ourlime.com';
    const developmentHost = platformEnvironmentService.getDevelopmentHostName()?.toLowerCase();
    const isDevelopmentHost = __DEV__
      && parsedOrigin.protocol === 'http:'
      && Boolean(developmentHost)
      && hostName === developmentHost;
    if (!isOurlimeHost && !isDevelopmentHost) {
      throw new Error('This QR code points to an untrusted server.');
    }
    if (parsedOrigin.protocol !== 'https:' && !isDevelopmentHost) {
      throw new Error('This QR code does not use a secure server connection.');
    }
    return parsedOrigin.origin;
  }

  private getDevelopmentApiOrigin(): string | undefined {
    return platformEnvironmentService.getDevelopmentApiBaseUrl() ?? undefined;
  }
}

export const qrLoginService = QRLoginService.getInstance();
