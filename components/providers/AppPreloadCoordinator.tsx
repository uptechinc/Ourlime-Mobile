import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { AppPreloadService } from '@/lib/services/AppPreloadService';
import { PreloadRegistryService } from '@/lib/services/PreloadRegistryService';

const appPreloadService = AppPreloadService.getInstance();
const preloadRegistryService = PreloadRegistryService.getInstance();
const ROUTE_PREFETCHES: readonly { route: string; href: Href }[] = [
  { route: '/communities', href: '/communities' as Href },
  { route: '/settings', href: '/settings' as Href },
  { route: '/notifications', href: '/notifications' as Href },
  { route: '/admin', href: '/admin' as Href },
];

export default function AppPreloadCoordinator() {
  const router = useRouter();
  const { activeUserId, cacheReady } = useAppData();
  const { loading: pageAccessLoading, getDecision } = usePageAccess();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const canPreload = useCallback((route: string): boolean => {
    const decision = getDecision(route);
    return decision.canAccess && decision.status !== 'coming_soon' && decision.status !== 'maintenance' && decision.status !== 'disabled';
  }, [getDecision]);

  const startPreload = useCallback(() => {
    if (!activeUserId || !cacheReady || pageAccessLoading || appStateRef.current !== 'active') return;
    void appPreloadService.preload(activeUserId, canPreload);
    const startupRoutes = new Set(preloadRegistryService.getRegistrations().filter((registration) => registration.policy === 'startup').map((registration) => registration.route));
    ROUTE_PREFETCHES.filter((registration) => startupRoutes.has(registration.route) && canPreload(registration.route))
      .forEach((registration) => router.prefetch(registration.href));
  }, [activeUserId, cacheReady, canPreload, pageAccessLoading, router]);

  useEffect(() => {
    startPreload();
    return () => appPreloadService.cancel();
  }, [startPreload]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      appStateRef.current = status;
      if (status === 'active') startPreload();
      else appPreloadService.cancel();
    });
    return () => subscription.remove();
  }, [startPreload]);

  return null;
}
