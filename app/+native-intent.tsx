import { AuthService } from '@/lib/services/AuthService';
import { deepLinkService } from '@/lib/services/DeepLinkService';

const authService = AuthService.getInstance();

type RedirectSystemPathOptions = {
  path: string;
  initial: boolean;
};

export async function redirectSystemPath({ path }: RedirectSystemPathOptions): Promise<string> {
  const resolution = deepLinkService.resolve(path);
  if (resolution.kind === 'invalid') return '/';
  if (resolution.kind === 'external') return resolution.url;
  if (authService.getVerifiedCurrentUser()) return resolution.route;
  await deepLinkService.rememberPendingResolution(resolution);
  return '/(auth)/login';
}
