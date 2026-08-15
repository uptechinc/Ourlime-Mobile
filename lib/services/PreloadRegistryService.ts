import type { PagePreloadRegistration } from '@/lib/types/preload';
import { MOBILE_PAGE_REGISTRY } from '@/lib/pageAccess/PageRegistry';

const REGISTRATIONS: readonly PagePreloadRegistration[] = [
  { route: '/', policy: 'startup', resource: 'feed' },
  { route: '/discover', policy: 'startup', resource: 'discover' },
  { route: '/communities', policy: 'startup', resource: 'communities' },
  { route: '/chat', policy: 'startup', resource: 'conversations' },
  { route: '/profile', policy: 'startup', resource: 'profile' },
  { route: '/settings', policy: 'startup', resource: 'profile' },
  { route: '/notifications', policy: 'startup', resource: 'profile' },
  { route: '/admin', policy: 'startup', resource: 'admin' },
  { route: '/post', policy: 'parent-driven', resource: 'dynamic' },
  { route: '/communities/[id]', policy: 'parent-driven', resource: 'dynamic' },
  { route: '/profile/[username]', policy: 'parent-driven', resource: 'dynamic' },
  { route: '/chat/[id]', policy: 'parent-driven', resource: 'dynamic' },
  { route: '/search', policy: 'interaction-only', resource: 'dynamic' },
  { route: '/events', policy: 'none', resource: 'static' },
  { route: '/jobs', policy: 'none', resource: 'static' },
  { route: '/market', policy: 'none', resource: 'static' },
  { route: '/blogs', policy: 'none', resource: 'static' },
  { route: '/eLearning', policy: 'none', resource: 'static' },
  { route: '/projectManagement', policy: 'none', resource: 'static' },
  { route: '/ads', policy: 'none', resource: 'static' },
  { route: '/saved', policy: 'none', resource: 'static' },
  { route: '/eWallet', policy: 'none', resource: 'static' },
  { route: '/games', policy: 'none', resource: 'static' },
  { route: '/help', policy: 'none', resource: 'static' },
];

export class PreloadRegistryService {
  private static instance: PreloadRegistryService;

  private constructor() {}

  public static getInstance(): PreloadRegistryService {
    if (!PreloadRegistryService.instance) PreloadRegistryService.instance = new PreloadRegistryService();
    return PreloadRegistryService.instance;
  }

  public getRegistrations(): readonly PagePreloadRegistration[] {
    return MOBILE_PAGE_REGISTRY.filter((entry) => entry.route !== '*').map((entry): PagePreloadRegistration => {
      const explicit = REGISTRATIONS.find((registration) => registration.route === entry.route);
      if (explicit) return explicit;
      if (entry.defaultStatus === 'coming_soon' || entry.defaultStatus === 'disabled') {
        return { route: entry.route, policy: 'none', resource: 'static' };
      }
      if (entry.route.startsWith('/admin')) {
        return { route: entry.route, policy: entry.route === '/admin' ? 'startup' : 'parent-driven', resource: 'admin' };
      }
      return { route: entry.route, policy: 'interaction-only', resource: 'dynamic' };
    });
  }
}

export const preloadRegistryService = PreloadRegistryService.getInstance();
