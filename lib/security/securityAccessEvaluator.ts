import type {
  SecurityAccessSettings,
  RegionPolicyMode,
  IpRule,
  UserWhitelistEntry,
} from '@/lib/types/adminSecurity';

export type { RegionPolicyMode, IpRule, UserWhitelistEntry, SecurityAccessSettings };

export type SecurityEvaluationContext = {
  ip: string;
  countryCode?: string;
  userId?: string;
  userEmail?: string;
  isAdmin?: boolean;
  isAccessingAdminPortal?: boolean;
};

export type SecurityMatchReason =
  | 'admin_portal_access'
  | 'user_whitelist'
  | 'ip_blocklist'
  | 'ip_whitelist'
  | 'country_block'
  | 'country_not_allowed'
  | 'default_allow';

export type SecurityEvaluationResult = {
  allowed: boolean;
  reason?: string;
  bypass?: boolean;
  ruleMatched: SecurityMatchReason;
  matchedRuleDetail?: string;
};

export function normalizeIpAddress(value: string): string {
  let normalized = (value || '').trim();
  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.slice(7);
  }
  if (normalized === '::1') {
    normalized = '127.0.0.1';
  }
  return normalized;
}

function parseIpv4Address(value: string): number | null {
  const parts = value.trim().split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  return octets.reduce((address, octet) => ((address << 8) | octet) >>> 0, 0);
}

export function matchesIpRule(ipAddress: string, ruleValue: string): boolean {
  const normalizedClientIp = normalizeIpAddress(ipAddress);
  const rawRule = ruleValue.trim();

  if (!rawRule.includes('/')) {
    const normalizedRuleIp = normalizeIpAddress(rawRule);
    return normalizedClientIp.toLowerCase() === normalizedRuleIp.toLowerCase();
  }

  const [networkValue, prefixValue] = rawRule.split('/');
  const normalizedNetwork = normalizeIpAddress(networkValue);
  const address = parseIpv4Address(normalizedClientIp);
  const network = parseIpv4Address(normalizedNetwork);
  const prefix = Number(prefixValue);

  if (address === null || network === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (network & mask);
}

/**
 * Pure evaluation function for geographic access controls and IP rules.
 *
 * EVALUATION HIERARCHY:
 * 1. IP Blocklist (Explicit Deny) -> BLOCKED
 * 2. IP Whitelist (Explicit Allow / Country Override) -> ALLOWED (Bypasses Country Policy)
 * 3. User Whitelist (UID or Email) -> ALLOWED
 * 4. Admin Portal Access (Admin accessing administrative workspace) -> ALLOWED
 * 5. Region Policy ('block_selected' or 'allow_selected_only') -> BLOCKED if condition fails
 * 6. Default -> ALLOWED
 */
export function evaluateSecurityAccess(
  settings: SecurityAccessSettings,
  context: SecurityEvaluationContext
): SecurityEvaluationResult {
  const normalizedClientIp = normalizeIpAddress(context.ip);

  // 1. IP Blocklist check (Explicit block takes precedence)
  const matchingBlockRule = (settings.ipRules || []).find(
    (rule) => rule.type === 'blocklist' && matchesIpRule(normalizedClientIp, rule.ip)
  );
  if (matchingBlockRule) {
    return {
      allowed: false,
      reason: 'Your IP address has been administratively blocked.',
      ruleMatched: 'ip_blocklist',
      matchedRuleDetail: matchingBlockRule.label || `IP matched blocklist rule: ${matchingBlockRule.ip}`,
    };
  }

  // 2. IP Whitelist check (Explicit allow OVERRIDES country restriction)
  const matchingWhitelistRule = (settings.ipRules || []).find(
    (rule) => rule.type === 'whitelist' && matchesIpRule(normalizedClientIp, rule.ip)
  );
  if (matchingWhitelistRule) {
    return {
      allowed: true,
      bypass: true,
      ruleMatched: 'ip_whitelist',
      matchedRuleDetail: matchingWhitelistRule.label || `IP matched whitelist override: ${matchingWhitelistRule.ip}`,
    };
  }

  // 3. User Whitelist bypass (by UID or Email)
  if (context.userId || context.userEmail) {
    const normalizedEmail = (context.userEmail || '').trim().toLowerCase();
    const matchedUser = (settings.userWhitelist || []).find((entry) => {
      if (context.userId && entry.userId && entry.userId === context.userId) return true;
      if (normalizedEmail && entry.email && entry.email.trim().toLowerCase() === normalizedEmail) return true;
      return false;
    });

    if (matchedUser) {
      return {
        allowed: true,
        bypass: true,
        ruleMatched: 'user_whitelist',
        matchedRuleDetail: matchedUser.reason || 'User account is on the security whitelist.',
      };
    }
  }

  // 4. Admin Portal scope bypass: Allows administrators to access the admin workspace
  // to manage settings, logs, and whitelists even if connecting from an unlisted country.
  if (context.isAdmin && context.isAccessingAdminPortal) {
    return {
      allowed: true,
      bypass: true,
      ruleMatched: 'admin_portal_access',
      matchedRuleDetail: 'Administrator accessing administrative workspace.',
    };
  }

  // 5. Geographic Country Policy check
  const country = (context.countryCode || '').trim().toUpperCase();
  const regionPolicy = settings.regionPolicy || { mode: 'allow_all', countries: [] };
  const { mode, countries = [], blockedMessage } = regionPolicy;
  const normalizedCountries = countries.map((c) => c.trim().toUpperCase());

  const defaultBlockedMsg = blockedMessage || 'Access is currently restricted in your geographic region.';

  if (mode === 'block_selected') {
    if (country && normalizedCountries.includes(country)) {
      return {
        allowed: false,
        reason: defaultBlockedMsg,
        ruleMatched: 'country_block',
        matchedRuleDetail: `Country ${country} is on the blocked regions list.`,
      };
    }
  } else if (mode === 'allow_selected_only') {
    if (country) {
      if (!normalizedCountries.includes(country)) {
        return {
          allowed: false,
          reason: defaultBlockedMsg,
          ruleMatched: 'country_not_allowed',
          matchedRuleDetail: `Country ${country} is not in the allowed regions list (${normalizedCountries.join(', ')}).`,
        };
      }
    } else {
      return {
        allowed: true,
        ruleMatched: 'default_allow',
        matchedRuleDetail: 'Origin country unverified on initial check; allowed on grace.',
      };
    }
  }

  // 6. Default allow
  return {
    allowed: true,
    ruleMatched: 'default_allow',
  };
}
