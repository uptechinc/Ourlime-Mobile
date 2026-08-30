import { Platform } from 'react-native';
import { ApiService } from '@/lib/services/ApiService';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import type {
  QRLoginSession,
  ActiveDeviceSession,
  DeviceInfo,
} from '@/lib/types/qrLogin';

export class QRLoginService {
  private static instance: QRLoginService;
  private readonly apiService = ApiService.getInstance();

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
      browser: 'Ourlime Mobile App',
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

  public async scanQR(identifier: { sessionId?: string; shortCode?: string }): Promise<{
    success: boolean;
    session?: QRLoginSession;
    error?: string;
  }> {
    try {
      void interactionFeedbackService.play('post');
      const response = await this.apiService.request<{
        success: boolean;
        session?: QRLoginSession;
        error?: string;
      }>('/api/auth/qr/scan', {
        method: 'POST',
        authenticated: true,
        body: {
          ...identifier,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        },
      });

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
        },
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
}

export const qrLoginService = QRLoginService.getInstance();