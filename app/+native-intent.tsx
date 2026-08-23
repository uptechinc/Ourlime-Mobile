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

export async function redirectSystemPath({ path }: RedirectSystemPathOptions): Promise<string> {
  if (isRootLaunchPath(path)) return '/';

  const resolution = deepLinkService.resolve(path);
  if (resolution.kind === 'invalid') return '/__not_found__';
  if (resolution.kind === 'external') return resolution.url;
  if (authService.getVerifiedCurrentUser()) return resolution.route;
  await deepLinkService.rememberPendingResolution(resolution);
  return '/(auth)/login';
}
