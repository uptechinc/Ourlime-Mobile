export type AccountLifecycleVisibilitySource = {
  accountLifecycleHiddenAt?: unknown;
  accountLifecycleStatus?: unknown;
  accountStatus?: unknown;
};

const HIDDEN_ACCOUNT_STATUSES = new Set(['archived', 'pending', 'suspended', 'banned', 'deleted']);

export class AccountLifecycleVisibilityService {
  private static instance: AccountLifecycleVisibilityService;

  private constructor() {}

  public static getInstance(): AccountLifecycleVisibilityService {
    if (!AccountLifecycleVisibilityService.instance) {
      AccountLifecycleVisibilityService.instance = new AccountLifecycleVisibilityService();
    }
    return AccountLifecycleVisibilityService.instance;
  }

  public isHidden(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const source = value as AccountLifecycleVisibilitySource;
    if (source.accountLifecycleHiddenAt !== null && source.accountLifecycleHiddenAt !== undefined) return true;
    const lifecycleStatus = typeof source.accountLifecycleStatus === 'string' ? source.accountLifecycleStatus.trim().toLowerCase() : '';
    const accountStatus = typeof source.accountStatus === 'string' ? source.accountStatus.trim().toLowerCase() : '';
    return HIDDEN_ACCOUNT_STATUSES.has(lifecycleStatus) || HIDDEN_ACCOUNT_STATUSES.has(accountStatus);
  }
}

export const accountLifecycleVisibilityService = AccountLifecycleVisibilityService.getInstance();
