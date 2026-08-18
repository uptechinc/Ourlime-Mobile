import type { UserProfile } from '@/lib/services/AuthService';
import { authorizationService, type AuthorizationState } from '@/lib/services/AuthorizationService';
import { mockUsers } from '../mocks/mockUsers';

export class AuthTestHarness {
  private static instance: AuthTestHarness;
  private currentProfile: UserProfile | null = mockUsers.regular;

  private constructor() {}

  public static getInstance(): AuthTestHarness {
    if (!AuthTestHarness.instance) {
      AuthTestHarness.instance = new AuthTestHarness();
    }
    return AuthTestHarness.instance;
  }

  public signInAs(role: keyof typeof mockUsers): UserProfile {
    this.currentProfile = mockUsers[role];
    return this.currentProfile;
  }

  public signOut(): void {
    this.currentProfile = null;
  }

  public getCurrentProfile(): UserProfile | null {
    return this.currentProfile;
  }

  public getAuthorizationState(): AuthorizationState {
    return authorizationService.resolve(this.currentProfile);
  }
}

export const authTestHarness = AuthTestHarness.getInstance();
