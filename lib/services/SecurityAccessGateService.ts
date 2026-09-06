import { auth } from '@/lib/firebaseConfig';
import { ApiService } from './ApiService';
import { adminAccessService } from './AdminAccessService';
import { DiagnosticLogService } from './DiagnosticLogService';

export type SecurityGateState = {
  isRestricted: boolean;
  reason: string | null;
  detectedIp: string | null;
  detectedCountry: string | null;
  checking: boolean;
  lastCheckedAt: number | null;
};

type SecurityGateListener = (state: SecurityGateState) => void;

export class SecurityAccessGateService {
  private static instance: SecurityAccessGateService;
  private readonly apiService = ApiService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();

  private state: SecurityGateState = {
    isRestricted: false,
    reason: null,
    detectedIp: null,
    detectedCountry: null,
    checking: false,
    lastCheckedAt: null,
  };

  private listeners = new Set<SecurityGateListener>();

  private constructor() {
    this.setupAuthListener();
  }

  public static getInstance(): SecurityAccessGateService {
    if (!SecurityAccessGateService.instance) {
      SecurityAccessGateService.instance = new SecurityAccessGateService();
    }
    return SecurityAccessGateService.instance;
  }

  private setupAuthListener(): void {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const isAdmin = await adminAccessService.checkAdmin();
          if (isAdmin) {
            this.updateState({
              isRestricted: false,
              reason: null,
            });
          }
        } catch {
          // Ignore auth check error
        }
      }
    });
  }

  public getState(): SecurityGateState {
    return { ...this.state };
  }

  public subscribe(listener: SecurityGateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(partial: Partial<SecurityGateState>): void {
    this.state = {
      ...this.state,
      ...partial,
    };
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        this.logger.error('SecurityAccessGateService', 'listener_error', {
          error: err instanceof Error ? err.message : 'Unknown listener error',
        });
      }
    });
  }

  public async checkAccess(force = false): Promise<SecurityGateState> {
    const now = Date.now();
    // Cache positive checks for 5 minutes unless forced
    if (
      !force &&
      !this.state.isRestricted &&
      this.state.lastCheckedAt &&
      now - this.state.lastCheckedAt < 300_000
    ) {
      return this.getState();
    }

    this.updateState({ checking: true });

    try {
      // Check if signed-in user is an administrator first (instant bypass)
      if (auth.currentUser) {
        const isAdmin = await adminAccessService.checkAdmin();
        if (isAdmin) {
          this.updateState({
            isRestricted: false,
            checking: false,
            lastCheckedAt: now,
          });
          return this.getState();
        }
      }

      const response = await this.apiService.request<{
        success: boolean;
        allowed: boolean;
        reason?: string;
        ip?: string;
        countryCode?: string;
        bypass?: boolean;
      }>('/api/security/check-access', {
        method: 'GET',
        timeoutMs: 6000,
        authenticated: Boolean(auth.currentUser),
      });

      if (response && response.success) {
        if (response.allowed === false) {
          this.updateState({
            isRestricted: true,
            reason: response.reason || 'Access is currently restricted in your geographic region.',
            detectedIp: response.ip || null,
            detectedCountry: response.countryCode || null,
            checking: false,
            lastCheckedAt: now,
          });
        } else {
          this.updateState({
            isRestricted: false,
            reason: null,
            detectedIp: response.ip || null,
            detectedCountry: response.countryCode || null,
            checking: false,
            lastCheckedAt: now,
          });
        }
      } else {
        // Fallback: don't block if response payload is malformed
        this.updateState({ checking: false, lastCheckedAt: now });
      }
    } catch (err) {
      this.logger.warn('SecurityAccessGateService', 'check_access_failed', {
        error: err instanceof Error ? err.message : 'Unknown check error',
      });
      // Fail-open for offline resilience
      this.updateState({ checking: false });
    }

    return this.getState();
  }

  public dismissRestrictionTemporarily(): void {
    // Allows admin or testing bypass
    this.updateState({ isRestricted: false });
  }
}

export const securityAccessGateService = SecurityAccessGateService.getInstance();
