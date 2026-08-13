import { collection, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebaseConfig';
import { getDefaultMobilePageSettings } from '@/lib/pageAccess/PageRegistry';
import { authorizationService, type AuthorizationState } from './AuthorizationService';
import type { PageAccessSetting, PageAccessStatus } from '@/lib/types/pageAccess';

const PUBLIC_ROUTES = new Set([
  '/(auth)/login',
  '/(auth)/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/terms-and-conditions',
  '/privacy-policy',
]);

const EXPO_ROUTE_ALIASES: Readonly<Record<string, string>> = {
  '/': '/',
  '/(tabs)': '/',
  '/(tabs)/index': '/',
  '/(tabs)/Discover': '/discover',
  '/(tabs)/Chat': '/chat',
  '/(tabs)/Limes': '/limes',
  '/(tabs)/Profile': '/profile',
  '/(tabs)/Search': '/discover',
};

export type PageAccessDecision = {
  setting: PageAccessSetting | null;
  status: PageAccessStatus;
  canAccess: boolean;
  isVisibleInNavigation: boolean;
  isDeveloperPreview: boolean;
};

export class PageAccessService {
  private static instance: PageAccessService;

  private constructor() {}

  public static getInstance(): PageAccessService {
    if (!PageAccessService.instance) PageAccessService.instance = new PageAccessService();
    return PageAccessService.instance;
  }

  public normalizeRoute(route: string): string {
    const rawPath = route.split(/[?#]/, 1)[0] || '/';
    const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const normalized = withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash;
    const aliased = EXPO_ROUTE_ALIASES[normalized] ?? normalized;
    return aliased === '/profile/admin' || aliased.startsWith('/profile/admin/')
      ? aliased.replace('/profile/admin', '/admin')
      : aliased;
  }

  public isPublicRoute(route: string): boolean {
    const normalized = this.normalizeRoute(route);
    return PUBLIC_ROUTES.has(normalized) || normalized.startsWith('/(auth)/');
  }

  public getTargetRedirect(user: User | null, currentRoute: string): string | null {
    const normalized = this.normalizeRoute(currentRoute);
    const isPublic = this.isPublicRoute(normalized);
    const isAuthenticatedAndVerified = Boolean(user && user.emailVerified);
    if (!isAuthenticatedAndVerified && !isPublic) return '/(auth)/login';
    if (isAuthenticatedAndVerified && (normalized === '/(auth)/login' || normalized === '/(auth)/register')) return '/(tabs)';
    return null;
  }

  public subscribeToSettings(
    onChange: (settings: PageAccessSetting[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    const settingsQuery = query(collection(db, 'pageAccessSettings'), orderBy('order', 'asc'));
    return onSnapshot(settingsQuery, (snapshot) => {
      const storedSettings = snapshot.docs.map((document, index) => this.normalizeSetting(document.id, document.data(), index));
      onChange(this.mergeWithDefaults(storedSettings));
    }, (error) => onError(error));
  }

  public getDefaultSettings(): PageAccessSetting[] {
    return getDefaultMobilePageSettings();
  }

  public resolveSetting(settings: readonly PageAccessSetting[], route: string): PageAccessSetting | null {
    const normalizedRoute = this.normalizeRoute(route);
    const systemSetting = settings.find((setting) => setting.route === '*');
    if (systemSetting && systemSetting.status !== 'enabled') return systemSetting;

    const matching = settings
      .filter((setting) => {
        if (setting.route === '*') return false;
        const settingRoute = this.normalizeRoute(setting.route);
        return settingRoute === normalizedRoute || (settingRoute !== '/' && normalizedRoute.startsWith(`${settingRoute}/`));
      })
      .sort((first, second) => this.normalizeRoute(second.route).length - this.normalizeRoute(first.route).length);
    return matching.find((setting) => setting.status === 'coming_soon') ?? matching[0] ?? null;
  }

  public getDecision(
    settings: readonly PageAccessSetting[],
    route: string,
    authorization: AuthorizationState,
  ): PageAccessDecision {
    const configuredSetting = this.resolveSetting(settings, route);
    const protectedFutureSetting = this.resolveSetting(
      this.getDefaultSettings().filter((defaultSetting) => defaultSetting.status === 'coming_soon'),
      route,
    );
    const setting = protectedFutureSetting
      ? {
          ...(configuredSetting ?? protectedFutureSetting),
          status: 'coming_soon' as const,
          badgeText: protectedFutureSetting.badgeText || 'Coming Soon',
        }
      : configuredSetting;
    const status = setting?.status ?? 'enabled';
    const canAccess = authorizationService.canAccessStatus(status, authorization);
    return {
      setting,
      status,
      canAccess,
      isVisibleInNavigation: setting
        ? setting.showInNavigation && setting.status !== 'disabled' && (setting.status !== 'developer_only' || authorization.isDeveloper)
        : true,
      isDeveloperPreview: authorization.isDeveloper && status !== 'enabled' && status !== 'disabled',
    };
  }

  private mergeWithDefaults(stored: PageAccessSetting[]): PageAccessSetting[] {
    const storedById = new Map(stored.map((setting) => [setting.id, setting]));
    const defaults = this.getDefaultSettings();
    const mergedDefaults = defaults.map((setting) => storedById.get(setting.id) ?? setting);
    const custom = stored.filter((setting) => !defaults.some((defaultSetting) => defaultSetting.id === setting.id));
    return [...mergedDefaults, ...custom].sort((first, second) => first.order - second.order);
  }

  private normalizeSetting(id: string, value: Record<string, unknown>, fallbackOrder: number): PageAccessSetting {
    const statuses: PageAccessStatus[] = ['enabled', 'coming_soon', 'maintenance', 'beta_only', 'developer_only', 'admin_only', 'disabled'];
    const statusValue = typeof value.status === 'string' && statuses.includes(value.status as PageAccessStatus)
      ? value.status as PageAccessStatus
      : 'enabled';
    return {
      id,
      pageName: typeof value.pageName === 'string' ? value.pageName : id,
      route: typeof value.route === 'string' ? value.route : '/',
      description: typeof value.description === 'string' ? value.description : undefined,
      status: statusValue,
      showInNavigation: value.showInNavigation !== false,
      showPagePreview: value.showPagePreview !== false,
      overlayTitle: typeof value.overlayTitle === 'string' ? value.overlayTitle : undefined,
      overlayDescription: typeof value.overlayDescription === 'string' ? value.overlayDescription : undefined,
      badgeText: typeof value.badgeText === 'string' ? value.badgeText : undefined,
      primaryButtonLabel: typeof value.primaryButtonLabel === 'string' ? value.primaryButtonLabel : undefined,
      primaryButtonRoute: typeof value.primaryButtonRoute === 'string' ? value.primaryButtonRoute : undefined,
      secondaryButtonLabel: typeof value.secondaryButtonLabel === 'string' ? value.secondaryButtonLabel : undefined,
      secondaryButtonRoute: typeof value.secondaryButtonRoute === 'string' ? value.secondaryButtonRoute : undefined,
      scheduledReleaseAt: value.scheduledReleaseAt && typeof value.scheduledReleaseAt === 'object'
        ? value.scheduledReleaseAt as PageAccessSetting['scheduledReleaseAt']
        : null,
      updatedAt: value.updatedAt && typeof value.updatedAt === 'object'
        ? value.updatedAt as PageAccessSetting['updatedAt']
        : null,
      updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : undefined,
      order: typeof value.order === 'number' ? value.order : fallbackOrder,
    };
  }
}

export const pageAccessService = PageAccessService.getInstance();
