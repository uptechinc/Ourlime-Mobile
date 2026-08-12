import type { UserProfile } from './AuthService';
import type { PageAccessStatus } from '@/lib/types/pageAccess';

export type AppRole = 'user' | 'premium' | 'moderator' | 'admin' | 'developer';

export type AuthorizationState = {
  role: AppRole;
  isAdmin: boolean;
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

  public resolve(profile: UserProfile | null | undefined): AuthorizationState {
    const roleValue = (profile?.role || profile?.accountType || 'user').trim().toLowerCase();
    const isAdmin = profile?.isAdmin === true || roleValue === 'admin';
    const isDeveloper = profile?.isDeveloper === true || roleValue === 'developer' || roleValue === 'dev';
    const isModerator = roleValue === 'moderator';
    const isPremium = roleValue === 'premium';
    const role: AppRole = isAdmin
      ? 'admin'
      : isDeveloper
        ? 'developer'
        : isModerator
          ? 'moderator'
          : isPremium
            ? 'premium'
            : 'user';
    return { role, isAdmin, isDeveloper, isModerator, isPremium };
  }

  public canAccessStatus(status: PageAccessStatus, state: AuthorizationState): boolean {
    if (status === 'enabled') return true;
    if (status === 'admin_only') return state.isAdmin;
    if (status === 'developer_only') return state.isDeveloper;
    if (status === 'beta_only') return state.isDeveloper || state.isAdmin || state.isPremium;
    if (state.isDeveloper && status !== 'disabled') return true;
    return false;
  }
}

export const authorizationService = AuthorizationService.getInstance();
