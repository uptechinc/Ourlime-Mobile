import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, serverTimestamp, where, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';
import { isValidIpRuleValue } from '@/lib/security/securityAccessEvaluator';
import { adminAccessService } from '@/lib/services/AdminAccessService';
import type {
  SecurityAccessSettings,
  RegionPolicyMode,
  IpRule,
  UserWhitelistEntry,
  RateLimitConfig,
  SecurityMonitoring,
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

  private constructor() {}

  public static getInstance(): AdminSecurityService {
    if (!AdminSecurityService.instance) {
      AdminSecurityService.instance = new AdminSecurityService();
    }
    return AdminSecurityService.instance;
  }

  public async getSettings(requireAdminAuth = true): Promise<SecurityAccessSettings> {
    if (requireAdminAuth) {
      await adminAccessService.requireAdmin();
    }

    const snapshot = await getDoc(doc(db, 'siteConfig', 'securityAccessControls'));
    return snapshot.exists() ? ({ ...DEFAULT_SETTINGS, ...snapshot.data() } as SecurityAccessSettings) : DEFAULT_SETTINGS;
  }

  public async updateSettings(updates: Partial<SecurityAccessSettings>): Promise<SecurityAccessSettings> {
    const identity = await adminAccessService.requireAdmin();
    const current = await this.getSettings(false);
    // Same validation and clamping as the website's admin security service.
    const regionPolicy = updates.regionPolicy
      ? {
          mode: (updates.regionPolicy.mode === 'allow_selected_only' || updates.regionPolicy.mode === 'block_selected' ? updates.regionPolicy.mode : 'allow_all') as RegionPolicyMode,
          countries: [...new Set((updates.regionPolicy.countries || []).filter((country) => /^[A-Za-z]{2}$/.test(country)).map((country) => country.toUpperCase()))],
          blockedMessage: updates.regionPolicy.blockedMessage?.slice(0, 500) || current.regionPolicy.blockedMessage,
        }
      : current.regionPolicy;
    const ipRules = updates.ipRules
      ? updates.ipRules.filter((rule) => rule && isValidIpRuleValue(rule.ip) && (rule.type === 'whitelist' || rule.type === 'blocklist')).slice(0, 500)
      : current.ipRules;
    const userWhitelist = updates.userWhitelist
      ? updates.userWhitelist.filter((entry) => entry && (entry.userId?.trim() || entry.email?.trim())).slice(0, 500)
      : current.userWhitelist;
    const requestedRateLimits = updates.rateLimits || current.rateLimits;
    const clampLimit = (value: number): number => Math.min(Math.max(Math.trunc(Number(value) || 1), 1), 100_000);
    const rateLimits: RateLimitConfig = {
      enabled: requestedRateLimits.enabled === true,
      authPerMinute: clampLimit(requestedRateLimits.authPerMinute),
      postsPerMinute: clampLimit(requestedRateLimits.postsPerMinute),
      commentsPerMinute: clampLimit(requestedRateLimits.commentsPerMinute),
      generalPerMinute: clampLimit(requestedRateLimits.generalPerMinute),
    };
    const updated: SecurityAccessSettings = { ...current, regionPolicy, ipRules, userWhitelist, rateLimits };
    await setDoc(doc(db, 'siteConfig', 'securityAccessControls'), { ...updated, updatedAt: serverTimestamp(), updatedBy: identity.userId }, { merge: true });
    await addDoc(collection(db, 'securityAuditLog'), {
      action: 'update_security_settings',
      adminId: identity.userId,
      changes: { regionPolicy, ipRules, userWhitelist, rateLimits },
      timestamp: serverTimestamp(),
    }).catch((error: unknown) => console.error('[AdminSecurityService.updateSettings] Error:', error instanceof Error ? error.message : 'Audit entry failed'));
    return updated;
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

  /**
   * The website's "Security Monitoring & Audit Log": the 20 newest securityAuditLog entries and the number of live
   * securityRateLimitBuckets. The buckets collection is server-only, so its count is null when the rules deny the read.
   */
  public async getMonitoring(): Promise<SecurityMonitoring> {
    await adminAccessService.requireAdmin();
    const [auditSnapshot, bucketSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'securityAuditLog'), orderBy('timestamp', 'desc'), limit(20))).catch((error: unknown) => {
        console.error('[AdminSecurityService.getMonitoring] Error:', error instanceof Error ? error.message : 'Audit log read failed');
        return null;
      }),
      getDocs(query(collection(db, 'securityRateLimitBuckets'), where('expiresAt', '>', Timestamp.now()), limit(100))).catch(() => null),
    ]);
    const recentAudit = auditSnapshot?.docs.map((entry) => {
      const data = entry.data();
      const timestamp = data.timestamp as { toDate?: () => Date } | undefined;
      return {
        id: entry.id,
        action: typeof data.action === 'string' && data.action ? data.action : 'security_event',
        adminId: typeof data.adminId === 'string' ? data.adminId : '',
        targetUserId: typeof data.targetUserId === 'string' ? data.targetUserId : '',
        timestamp: typeof timestamp?.toDate === 'function' ? timestamp.toDate().toISOString() : null,
      };
    }) ?? [];
    return { activeRateBuckets: bucketSnapshot ? bucketSnapshot.size : null, recentAudit };
  }

  public async updateRateLimits(config: RateLimitConfig): Promise<SecurityAccessSettings> {
    const current = await this.getSettings();
    return this.updateSettings({
      ...current,
      rateLimits: config,
    });
  }
}

export const adminSecurityService = AdminSecurityService.getInstance();