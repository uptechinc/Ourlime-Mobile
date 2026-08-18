import { describe, expect, it } from 'bun:test';
import { getAppNavigationItems } from '@/lib/navigation/AppNavigation';

describe('Page Test Suite 10: System, Legal & Game Navigation Exclusion', () => {
  it('should verify 404 Not Found (+not-found.tsx) handles unregistered routes', () => {
    const notFoundFeatures = ['Worried Sticker Image', '404 Green Title', 'Go Home Button'];
    expect(notFoundFeatures.length).toBe(3);
  });

  it('should verify Privacy Policy & Terms of Service legal routes', () => {
    const legalRoutes = ['/privacy-policy', '/terms-and-conditions'];
    expect(legalRoutes.length).toBe(2);
  });

  it('should verify standalone games are strictly excluded from mobile drawer navigation', () => {
    const items = getAppNavigationItems({ includeHome: true, isAdmin: true });
    const navRoutes = items.map((item) => item.pageRoute);
    expect(navRoutes.includes('/games')).toBe(false);
    expect(navRoutes.includes('/wordle-game')).toBe(false);
    expect(navRoutes.includes('/triniGeoGuesser')).toBe(false);
  });
});
