import { auth } from '@/lib/firebaseConfig';
import { adminSecurityService } from './AdminSecurityService';
import { adminAccessService } from './AdminAccessService';
import { DiagnosticLogService } from './DiagnosticLogService';
import {
  evaluateSecurityAccess,
  matchesIpRule,
  type SecurityEvaluationResult,
} from '@/lib/security/securityAccessEvaluator';

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
    auth.onAuthStateChanged(() => {
      // Re-evaluate security access when auth state transitions
      void this.checkAccess(true);
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
    // Cache positive checks for 3 minutes unless forced
    if (
      !force &&
      !this.state.isRestricted &&
      this.state.lastCheckedAt &&
      now - this.state.lastCheckedAt < 180_000
    ) {
      return this.getState();
    }

    this.updateState({ checking: true });

    try {
      // 1. Fetch siteConfig/securityAccessControls directly from Cloud Firestore (Zero Next.js dependency)
      const settings = await adminSecurityService.getSettings(false);

      // 2. Resolve public IP and Country using direct client HTTPS GeoIP
      let ip = '127.0.0.1';
      let countryCode: string | undefined;

      // Try ipwho.is primary
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const geoResponse = await fetch('https://ipwho.is/', {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);

        if (geoResponse.ok) {
          const geoData = (await geoResponse.json()) as { ip?: string; country_code?: string; success?: boolean };
          if (geoData.ip) ip = geoData.ip.trim();
          if (geoData.success && geoData.country_code && /^[A-Za-z]{2}$/.test(geoData.country_code.trim())) {
            countryCode = geoData.country_code.trim().toUpperCase();
          }
        }
      } catch {
        // Fallback to api.country.is
        try {
          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), 2500);
          const fbResponse = await fetch('https://api.country.is/', {
            signal: controller2.signal,
            headers: { Accept: 'application/json' },
          });
          clearTimeout(timeoutId2);
          if (fbResponse.ok) {
            const fbData = (await fbResponse.json()) as { ip?: string; country?: string };
            if (fbData.ip) ip = fbData.ip.trim();
            if (fbData.country && /^[A-Za-z]{2}$/.test(fbData.country.trim())) {
              countryCode = fbData.country.trim().toUpperCase();
            }
          }
        } catch {
          // Fail-open for offline resilience
        }
      }

      // Check known Trinidad & Caribbean subnets to correct any third-party database misattribution
      const CARIBBEAN_SUBNETS: Array<{ subnet: string; code: string }> = [
        { subnet: '190.58.0.0/15', code: 'TT' },
        { subnet: '190.213.0.0/16', code: 'TT' },
        { subnet: '200.108.0.0/16', code: 'TT' },
        { subnet: '186.230.0.0/16', code: 'TT' },
        { subnet: '186.177.0.0/16', code: 'TT' },
        { subnet: '190.10.0.0/16', code: 'TT' },
        { subnet: '200.12.80.0/20', code: 'TT' },
        { subnet: '181.189.0.0/16', code: 'TT' },
        { subnet: '190.83.0.0/16', code: 'JM' },
        { subnet: '200.56.0.0/16', code: 'JM' },
        { subnet: '190.107.0.0/16', code: 'BB' },
        { subnet: '200.7.0.0/16', code: 'BB' },
        { subnet: '186.179.0.0/16', code: 'GY' },
      ];
      const match = CARIBBEAN_SUBNETS.find((entry) => matchesIpRule(ip, entry.subnet));
      if (match) {
        countryCode = match.code;
      }

      // 3. Check admin status without automatic unconditional bypass for general routes
      const isAdmin = auth.currentUser ? await adminAccessService.checkAdmin() : false;

      // 4. Pure evaluation against Firestore rules
      const result: SecurityEvaluationResult = evaluateSecurityAccess(settings, {
        ip,
        countryCode,
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email || undefined,
        isAdmin,
        isAccessingAdminPortal: false,
      });

      if (!result.allowed) {
        this.updateState({
          isRestricted: true,
          reason: result.reason || 'Access is currently restricted in your geographic region.',
          detectedIp: ip,
          detectedCountry: countryCode || null,
          checking: false,
          lastCheckedAt: now,
        });
      } else {
        this.updateState({
          isRestricted: false,
          reason: null,
          detectedIp: ip,
          detectedCountry: countryCode || null,
          checking: false,
          lastCheckedAt: now,
        });
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
