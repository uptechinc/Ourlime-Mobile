import { AuthService } from '@/lib/services/AuthService';
import { deepLinkService } from '@/lib/services/DeepLinkService';

const authService = AuthService.getInstance();

type RedirectSystemPathOptions = {
  path: string;
  initial: boolean;
};

function isRootLaunchPath(path: string): boolean {
  const normalizedPath = path.trim();
  if (!normalizedPath || normalizedPath === '/') return true;

  try {
    const parsedUrl = new URL(normalizedPath);
    return parsedUrl.protocol === 'ourlime:'
      && !parsedUrl.hostname
      && (!parsedUrl.pathname || parsedUrl.pathname === '/');
  } catch {
    return false;
  }
}

/** Account and legal pages a signed-out person can open from a link (email verification, password reset, policies). */
const SIGNED_OUT_LINK_ROUTES = ['/verify-email', '/reset-password', '/forgot-password', '/policies', '/privacy-policy', '/terms-and-conditions', '/child-safety-standards', '/delete-account'];

function isSignedOutLinkRoute(route: string): boolean {
  const path = route.split(/[?#]/)[0];
  return SIGNED_OUT_LINK_ROUTES.some((publicRoute) => path === publicRoute || path.startsWith(`${publicRoute}/`));
}

export async function redirectSystemPath({ path }: RedirectSystemPathOptions): Promise<string> {
  if (isRootLaunchPath(path)) return '/';

  const resolution = deepLinkService.resolve(path);
  if (resolution.kind === 'invalid') return '/__not_found__';
  if (resolution.kind === 'external') return resolution.url;
  if (isSignedOutLinkRoute(resolution.route)) return resolution.route;
  if (await authService.waitForVerifiedCurrentUser()) return resolution.route;
  await deepLinkService.rememberPendingResolution(resolution);
  return '/(auth)/login';
}
