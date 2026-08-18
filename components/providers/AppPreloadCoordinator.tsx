import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { AppPreloadService } from '@/lib/services/AppPreloadService';

const appPreloadService = AppPreloadService.getInstance();

export default function AppPreloadCoordinator() {
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
  }, [activeUserId, cacheReady, canPreload, pageAccessLoading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      startPreload();
    }, 2000);
    return () => {
      clearTimeout(timer);
      appPreloadService.cancel();
    };
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
