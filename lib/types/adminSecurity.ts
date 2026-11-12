export type RegionPolicyMode = 'allow_all' | 'allow_selected_only' | 'block_selected';

export type IpRule = {
  id: string;
  ip: string;
  type: 'whitelist' | 'blocklist';
  label?: string;
  createdBy: string;
  createdAt: string;
};

export type UserWhitelistEntry = {
  userId: string;
  email?: string;
  userName?: string;
  reason?: string;
  addedBy: string;
  addedAt: string;
};

export type RateLimitConfig = {
  authPerMinute: number;
  postsPerMinute: number;
  commentsPerMinute: number;
  generalPerMinute: number;
  enabled: boolean;
};

export type SecurityAccessSettings = {
  regionPolicy: {
    mode: RegionPolicyMode;
    countries: string[];
    blockedMessage?: string;
  };
  ipRules: IpRule[];
  userWhitelist: UserWhitelistEntry[];
  rateLimits: RateLimitConfig;
  updatedAt?: string;
  updatedBy?: string;
};

export type SecurityAuditEntry = {
  id: string;
  action: string;
  adminId: string;
  targetUserId: string;
  timestamp: string | null;
};

export type SecurityMonitoring = {
  /** Live distributed rate-limit buckets; null when the app cannot read them (server-only collection). */
  activeRateBuckets: number | null;
  recentAudit: SecurityAuditEntry[];
};
