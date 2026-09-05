import type { UserAccessProfile } from './AuthService';
import type { PageAccessStatus } from '@/lib/types/pageAccess';

export type AppRole = 'user' | 'premium' | 'moderator' | 'tester' | 'admin' | 'developer';

export type AuthorizationState = {
  role: AppRole;
  isAdmin: boolean;
  isTester: boolean;
  isDeveloper: boolean;
  isModerator: boolean;
  isPremium: boolean;
};

export class AuthorizationService {
  private static instance: AuthorizationService;

  private constructor() {}

  public static getInstance(): AuthorizationService {
    if (!AuthorizationService.instance) AuthorizationService.instance = new AuthorizationService();
    return AuthorizationService.instance;
  }

  public resolve(profile: UserAccessProfile | null | undefined): AuthorizationState {
    const roleValue = (profile?.role || profile?.accountType || 'user').trim().toLowerCase();
    const isAdmin = profile?.isAdmin === true || roleValue === 'admin';
    const isTester = roleValue === 'tester';
    const isDeveloper = profile?.isDeveloper === true || roleValue === 'developer' || roleValue === 'dev';
    const isModerator = roleValue === 'moderator';
    const isPremium = roleValue === 'premium';
    const role: AppRole = isAdmin
      ? 'admin'
      : isTester
        ? 'tester'
        : isDeveloper
          ? 'developer'
          : isModerator
            ? 'moderator'
            : isPremium
              ? 'premium'
              : 'user';
    return { role, isAdmin, isTester, isDeveloper, isModerator, isPremium };
  }

  public canAccessStatus(status: PageAccessStatus, state: AuthorizationState): boolean {
    if (status === 'enabled') return true;
    if (status === 'admin_only') return state.isAdmin;
    if (state.isTester || state.isDeveloper || state.isAdmin) return true;
    if (status === 'developer_only') return false;
    if (status === 'beta_only') return state.isPremium;
    return false;
  }
}

export const authorizationService = AuthorizationService.getInstance();
