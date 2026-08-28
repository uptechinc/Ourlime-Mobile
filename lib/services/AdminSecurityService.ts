import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';
import { ApiService } from '@/lib/services/ApiService';
import { adminAccessService } from '@/lib/services/AdminAccessService';
import type {
  SecurityAccessSettings,
  RegionPolicyMode,
  IpRule,
  UserWhitelistEntry,
  RateLimitConfig,
} from '@/lib/types/adminSecurity';

const DEFAULT_SETTINGS: SecurityAccessSettings = {
  regionPolicy: {
    mode: 'allow_all',
    countries: ['TT'],
    blockedMessage: 'Access is restricted in your region.',
  },
  ipRules: [],
  userWhitelist: [],
  rateLimits: {
    authPerMinute: 15,
    postsPerMinute: 30,
    commentsPerMinute: 45,
    generalPerMinute: 120,
    enabled: true,
  },
};

export class AdminSecurityService {
  private static instance: AdminSecurityService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): AdminSecurityService {
    if (!AdminSecurityService.instance) {
      AdminSecurityService.instance = new AdminSecurityService();
    }
    return AdminSecurityService.instance;
  }

  public async getSettings(): Promise<SecurityAccessSettings> {
    await adminAccessService.requireAdmin();

    try {
      const response = await this.apiService.request<{ success: boolean; settings: SecurityAccessSettings }>(
        '/api/admin/security/access-controls',
        {
          method: 'GET',
          authenticated: true,
        }
      );
      if (response?.success && response.settings) return response.settings;
    } catch {
      // Fallback to Firestore
    }

    try {
      const docRef = doc(db, 'siteConfig', 'securityAccessControls');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { ...DEFAULT_SETTINGS, ...snap.data() } as SecurityAccessSettings;
      }
    } catch {
      // Fallback
    }

    return DEFAULT_SETTINGS;
  }

  public async updateSettings(updates: Partial<SecurityAccessSettings>): Promise<SecurityAccessSettings> {
    const identity = await adminAccessService.requireAdmin();

    try {
      const response = await this.apiService.request<{ success: boolean; settings: SecurityAccessSettings }>(
        '/api/admin/security/access-controls',
        {
          method: 'POST',
          authenticated: true,
          body: updates,
        }
      );
      if (response?.success && response.settings) return response.settings;
    } catch {
      // Fallback to Firestore
    }

    const docRef = doc(db, 'siteConfig', 'securityAccessControls');
    const payload = {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: identity.userId,
    };
    await setDoc(docRef, payload, { merge: true });

    return { ...DEFAULT_SETTINGS, ...updates } as SecurityAccessSettings;
  }

  public async updateRegionPolicy(mode: RegionPolicyMode, countries: string[]): Promise<SecurityAccessSettings> {
    const current = await this.getSettings();
    return this.updateSettings({
      ...current,
      regionPolicy: {
        ...current.regionPolicy,
        mode,
        countries,
      },
    });
  }

  public async addIpRule(rule: Omit<IpRule, 'id' | 'createdAt' | 'createdBy'>): Promise<SecurityAccessSettings> {
    const current = await this.getSettings();
    const newRule: IpRule = {
      id: Date.now().toString(),
      ip: rule.ip.trim(),
      type: rule.type,
      label: rule.label?.trim() || undefined,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.uid || 'admin',
    };
    return this.updateSettings({
      ...current,
      ipRules: [...current.ipRules, newRule],
    });
  }

  public async removeIpRule(id: string): Promise<SecurityAccessSettings> {
    const current = await this.getSettings();
    return this.updateSettings({
      ...current,
      ipRules: current.ipRules.filter((r) => r.id !== id),
    });
  }

  public async addUserWhitelist(entry: Omit<UserWhitelistEntry, 'addedAt' | 'addedBy'>): Promise<SecurityAccessSettings> {
    const current = await this.getSettings();
    const newEntry: UserWhitelistEntry = {
      userId: entry.userId.trim(),
      email: entry.email?.trim() || undefined,
      userName: entry.userName?.trim() || undefined,
      reason: entry.reason?.trim() || 'Admin whitelist exception',
      addedAt: new Date().toISOString(),
      addedBy: auth.currentUser?.uid || 'admin',
    };
    return this.updateSettings({
      ...current,
      userWhitelist: [...current.userWhitelist, newEntry],
    });
  }

  public async removeUserWhitelist(userId: string): Promise<SecurityAccessSettings> {
    const current = await this.getSettings();
    return this.updateSettings({
      ...current,
      userWhitelist: current.userWhitelist.filter((u) => u.userId !== userId),
    });
  }

  public async updateRateLimits(config: RateLimitConfig): Promise<SecurityAccessSettings> {
    const current = await this.getSettings();
    return this.updateSettings({
      ...current,
      rateLimits: config,
    });
  }

  public async checkClientAccess(): Promise<{ allowed: boolean; reason?: string; countryCode?: string }> {
    try {
      const response = await this.apiService.request<{
        success: boolean;
        allowed: boolean;
        reason?: string;
        countryCode?: string;
      }>('/api/security/check-access', {
        method: 'GET',
      });
      if (response?.success) {
        return {
          allowed: response.allowed,
          reason: response.reason,
          countryCode: response.countryCode,
        };
      }
    } catch {
      // Default to allowed in offline or error scenario
    }
    return { allowed: true };
  }
}

export const adminSecurityService = AdminSecurityService.getInstance();