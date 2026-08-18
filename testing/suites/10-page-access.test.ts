import { describe, expect, it } from 'bun:test';
import { AdminScreenObject } from '../screens/AdminScreenObject';

describe('Suite 10: Dynamic Real-Time Page Access Controls', () => {
  it('should allow regular users to access enabled pages', () => {
    const adminScreen = new AdminScreenObject();
    adminScreen.setAdminRole('regular');

    expect(adminScreen.expectPageAllowed('/')).toBe(true);
    expect(adminScreen.expectPageAllowed('/communities')).toBe(true);
    expect(adminScreen.expectPageAllowed('/events')).toBe(true);
  });

  it('should block regular users from coming_soon pages and show overlay', () => {
    const adminScreen = new AdminScreenObject();
    adminScreen.setAdminRole('regular');

    expect(adminScreen.expectPageBlocked('/eLearning')).toBe(true);
    const decision = adminScreen.getPageDecision('/eLearning');
    expect(decision.status).toBe('coming_soon');
    expect(decision.setting?.badgeText).toBe('Coming Soon');
  });

  it('should block regular users from admin_only pages', () => {
    const adminScreen = new AdminScreenObject();
    adminScreen.setAdminRole('regular');

    expect(adminScreen.expectPageBlocked('/admin')).toBe(true);
  });

  it('should allow admin users to bypass coming_soon and admin_only restrictions', () => {
    const adminScreen = new AdminScreenObject();
    adminScreen.setAdminRole('admin');

    expect(adminScreen.expectPageAllowed('/admin')).toBe(true);
    expect(adminScreen.expectPageAllowed('/eLearning')).toBe(true);
  });

  it('should allow developer users to access preview pages', () => {
    const adminScreen = new AdminScreenObject();
    adminScreen.setAdminRole('developer');

    const decision = adminScreen.getPageDecision('/eLearning');
    expect(decision.isDeveloperPreview).toBe(true);
    expect(decision.canAccess).toBe(true);
  });

  it('should hide disabled pages from navigation menu', () => {
    const adminScreen = new AdminScreenObject();
    adminScreen.setAdminRole('regular');

    expect(adminScreen.expectNavigationVisible('/legacy')).toBe(false);
    expect(adminScreen.expectNavigationVisible('/communities')).toBe(true);
  });

  it('should dynamically reflect real-time status updates', () => {
    const adminScreen = new AdminScreenObject();
    adminScreen.setAdminRole('regular');

    // Initially coming_soon
    expect(adminScreen.expectPageBlocked('/eLearning')).toBe(true);

    // Admin updates status to 'enabled'
    adminScreen.updatePageStatus('eLearning', 'enabled');
    expect(adminScreen.expectPageAllowed('/eLearning')).toBe(true);

    // Admin updates status to 'disabled'
    adminScreen.updatePageStatus('eLearning', 'disabled');
    expect(adminScreen.expectPageBlocked('/eLearning')).toBe(true);
    expect(adminScreen.expectNavigationVisible('/eLearning')).toBe(false);
  });
});
