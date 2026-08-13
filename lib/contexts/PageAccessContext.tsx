import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { authorizationService, type AuthorizationState } from '@/lib/services/AuthorizationService';
import { pageAccessService, type PageAccessDecision } from '@/lib/services/PageAccessService';
import type { PageAccessSetting } from '@/lib/types/pageAccess';

type PageAccessContextValue = {
  settings: PageAccessSetting[];
  loading: boolean;
  error: string | null;
  profile: UserProfile | null;
  authorization: AuthorizationState;
  getDecision: (route: string) => PageAccessDecision;
};

type PageAccessProviderProps = {
  children: ReactNode;
};

const authService = AuthService.getInstance();
const EMPTY_AUTHORIZATION = authorizationService.resolve(null);
const PageAccessContext = createContext<PageAccessContextValue | null>(null);

export function PageAccessProvider({ children }: PageAccessProviderProps) {
  const [settings, setSettings] = useState<PageAccessSetting[]>(pageAccessService.getDefaultSettings());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = authService.subscribeToVerifiedAuthState((user) => {
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      void authService.getUserProfile(user.uid)
        .then((nextProfile) => setProfile(nextProfile))
        .catch(() => setProfile(null))
        .finally(() => setProfileLoading(false));
    });
    const unsubscribeSettings = pageAccessService.subscribeToSettings((nextSettings) => {
      setSettings(nextSettings);
      setError(null);
      setSettingsLoading(false);
    }, (subscriptionError) => {
      setError(subscriptionError.message);
      setSettingsLoading(false);
    });
    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
    };
  }, []);

  const authorization = useMemo(
    () => profile ? authorizationService.resolve(profile) : EMPTY_AUTHORIZATION,
    [profile],
  );

  const getDecision = useCallback(
    (route: string) => pageAccessService.getDecision(settings, route, authorization),
    [authorization, settings],
  );

  const value = useMemo<PageAccessContextValue>(() => ({
    settings,
    loading: settingsLoading || profileLoading,
    error,
    profile,
    authorization,
    getDecision,
  }), [authorization, error, getDecision, profile, profileLoading, settings, settingsLoading]);

  return <PageAccessContext.Provider value={value}>{children}</PageAccessContext.Provider>;
}

export function usePageAccess(): PageAccessContextValue {
  const context = useContext(PageAccessContext);
  if (!context) throw new Error('PageAccessProvider is required');
  return context;
}
