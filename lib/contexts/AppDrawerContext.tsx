import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import SlideOutMenu from '@/components/ui/SlideOutMenu';
import { AuthService } from '@/lib/services/AuthService';
import { getAppNavigationItems } from '@/lib/navigation/AppNavigation';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useProfileResource } from '@/lib/hooks/useProfileResource';
import type { AppDrawerState, MenuItem } from '@/lib/types/componentProps';

export type { AppDrawerState } from '@/lib/types/componentProps';
type AppDrawerContextValue = { state: AppDrawerState; open: () => void; close: () => void };
type AppDrawerProviderProps = { children: ReactNode };

const AppDrawerContext = createContext<AppDrawerContextValue | null>(null);
const authService = AuthService.getInstance();

export function AppDrawerProvider({ children }: AppDrawerProviderProps) {
  const { authorization, getDecision } = usePageAccess();
  const user = authService.getCurrentUser();
  const { resource } = useProfileResource({ kind: 'own', userId: user?.uid ?? '' });
  const [state, setState] = useState<AppDrawerState>('closed');
  const pendingRoute = useRef<MenuItem['route'] | null>(null);

  const open = useCallback(() => {
    pendingRoute.current = null;
    setState((current) => {
      if (current === 'open' || current === 'opening') return current;
      return 'opening';
    });
  }, []);

  const close = useCallback(() => {
    setState((current) => {
      if (current === 'closed' || current === 'closing') return current;
      return 'closing';
    });
  }, []);

  const handleOpened = useCallback(() => {
    setState((current) => current === 'opening' ? 'open' : current);
  }, []);

  const handleClosed = useCallback(() => {
    const route = pendingRoute.current;
    pendingRoute.current = null;
    setState('closed');
    if (route) router.push(route);
  }, []);

  const navigateAfterClose = useCallback((item: MenuItem) => {
    if (!item.route) return;
    pendingRoute.current = item.route;
    setState((current) => current === 'closed' ? current : 'closing');
  }, []);

  const menuItems = useMemo<MenuItem[]>(() => [
    ...getAppNavigationItems({
      includeHome: false,
      isAdmin: authorization.isAdmin,
      resolveStatus: (route) => {
        const decision = getDecision(route);
        return { visible: decision.isVisibleInNavigation, status: decision.status, badge: decision.setting?.badgeText };
      },
    }).map((item): MenuItem => {
      const menuItem: MenuItem = { id: item.id, title: item.label, icon: item.ionicon, route: item.route, badge: item.badge, section: item.section };
      return { ...menuItem, onPress: () => navigateAfterClose(menuItem) };
    }),
    {
      id: 'logout', title: 'Log Out', icon: 'log-out', onPress: () => {
        close();
        void authService.logout().then(() => router.replace('/(auth)/login'));
      },
    },
  ], [authorization.isAdmin, close, getDecision, navigateAfterClose]);

  const profile = resource.data?.profile;
  return (
    <AppDrawerContext.Provider value={{ state, open, close }}>
      <View style={{ flex: 1 }}>
        {children}
        <SlideOutMenu
          state={state}
          onClose={close}
          onOpened={handleOpened}
          onClosed={handleClosed}
          menuItems={menuItems}
          userProfile={profile ? {
            name: `${profile.firstName} ${profile.lastName}`.trim(),
            email: profile.email,
            avatar: profile.profilePicture ?? undefined,
            firstName: profile.firstName,
            lastName: profile.lastName,
            userName: profile.userName,
            profilePicture: profile.profilePicture,
          } : undefined}
        />
      </View>
    </AppDrawerContext.Provider>
  );
}

export function useAppDrawer(): AppDrawerContextValue {
  const context = useContext(AppDrawerContext);
  if (!context) throw new Error('useAppDrawer must be used inside AppDrawerProvider');
  return context;
}
