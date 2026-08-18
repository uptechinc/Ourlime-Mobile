import { pageAccessService } from '@/lib/services/PageAccessService';
import { authorizationService, type AuthorizationState } from '@/lib/services/AuthorizationService';
import { mockPageAccessSettings } from '../mocks/mockPageAccess';
import { mockUsers } from '../mocks/mockUsers';

export class AdminScreenObject {
  private settings = [...mockPageAccessSettings];
  private authState: AuthorizationState = authorizationService.resolve(mockUsers.admin);

  public setAdminRole(role: keyof typeof mockUsers) {
    this.authState = authorizationService.resolve(mockUsers[role]);
  }

  public getSettings() {
    return this.settings;
  }

  public updatePageStatus(id: string, status: typeof mockPageAccessSettings[0]['status']) {
    this.settings = this.settings.map((s) => (s.id === id ? { ...s, status } : s));
  }

  public getPageDecision(route: string) {
    return pageAccessService.getDecision(this.settings, route, this.authState);
  }

  public expectPageBlocked(route: string): boolean {
    const decision = this.getPageDecision(route);
    return !decision.canAccess;
  }

  public expectPageAllowed(route: string): boolean {
    const decision = this.getPageDecision(route);
    return decision.canAccess;
  }

  public expectNavigationVisible(route: string): boolean {
    const decision = this.getPageDecision(route);
    return decision.isVisibleInNavigation;
  }
}
