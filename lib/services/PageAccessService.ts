import { User } from 'firebase/auth';

const PUBLIC_ROUTES = new Set([
  '/(auth)/login',
  '/(auth)/register',
]);

const PUBLIC_PREFIXES = [
  '/(auth)/',
];

export class PageAccessService {
  private static instance: PageAccessService;

  private constructor() {}

  public static getInstance(): PageAccessService {
    if (!PageAccessService.instance) {
      PageAccessService.instance = new PageAccessService();
    }
    return PageAccessService.instance;
  }

  /**
   * Check if a given route segment is public (doesn't require auth)
   */
  public isPublicRoute(routeSegment: string): boolean {
    if (!routeSegment || routeSegment === '/') return true;
    if (PUBLIC_ROUTES.has(routeSegment)) return true;
    return PUBLIC_PREFIXES.some((prefix) => routeSegment.startsWith(prefix));
  }

  /**
   * Determine where to redirect based on auth state and current route
   */
  public getTargetRedirect(user: User | null, currentSegment: string): string | null {
    const isPublic = this.isPublicRoute(currentSegment);

    // If user is NOT logged in and trying to access a protected route -> redirect to Login
    if (!user && !isPublic) {
      return '/(auth)/login';
    }

    // If user IS logged in and trying to access auth pages (login/register) -> redirect to Home tabs
    if (user && isPublic && (currentSegment.includes('login') || currentSegment.includes('register'))) {
      return '/(tabs)';
    }

    return null;
  }
}

export const pageAccessService = PageAccessService.getInstance();
