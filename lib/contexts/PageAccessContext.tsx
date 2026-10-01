import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { authorizationService, type AuthorizationState } from '@/lib/services/AuthorizationService';
import { pageAccessService, type PageAccessDecision } from '@/lib/services/PageAccessService';
import type { PageAccessSetting } from '@/lib/types/pageAccess';
import { nativeSessionService } from '@/lib/services/NativeSessionService';

type PageAccessContextValue = {
  settings: PageAccessSetting[];
  loading: boolean;
  error: string | null;
  profile: UserProfile | null;
  authorization: AuthorizationState;
  getDecision: (route: string) => PageAccessDecision;
  activeOverlayRoute: string | null;
  triggerOverlay: (route: string) => void;
  clearOverlay: () => void;
  enterPreview: (route: string) => void;
  exitPreview: () => void;
  retry: () => void;
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
  const [activeOverlayRoute, setActiveOverlayRoute] = useState<string | null>(null);
  const [previewRoute, setPreviewRoute] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [profileError, setProfileError] = useState<string | null>(null);
  const exitPreview = useCallback(() => setPreviewRoute(null), []);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  const triggerOverlay = useCallback((route: string) => setActiveOverlayRoute(route), []);
  const clearOverlay = useCallback(() => setActiveOverlayRoute(null), []);

  useEffect(() => {
    nativeSessionService.start();
    let generation = 0;
    setSettingsLoading(true);
    setProfileLoading(true);
    setError(null);
    setProfileError(null);
    let unsubscribeAccessProfile: (() => void) | undefined;
    const unsubscribeAuth = authService.subscribeToVerifiedAuthState((user) => {
      const requestGeneration = ++generation;
      setPreviewRoute(null);
      setProfile(null);
      setProfileError(null);
      unsubscribeAccessProfile?.();
      unsubscribeAccessProfile = undefined;
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      void (async () => {
        try {
          const nextProfile = await authService.getUserProfile(user.uid);
          if (requestGeneration !== generation) return;
          if (!nextProfile) throw new Error('Access profile unavailable.');
          setProfile(nextProfile);
          unsubscribeAccessProfile = authService.subscribeToUserAccessProfile(
            user.uid,
            (accessProfile) => {
              if (requestGeneration !== generation) return;
              setPreviewRoute(null);
              setProfile((currentProfile) => currentProfile
                ? { ...currentProfile, ...accessProfile }
                : currentProfile);
            },
            () => { if (requestGeneration === generation) { setProfileError('Your access could not be verified.'); setPreviewRoute(null); } },
          );
        } catch {
          if (requestGeneration !== generation) return;
          setProfile(null);
          setProfileError('Your access could not be verified.');
        } finally {
          if (requestGeneration === generation) setProfileLoading(false);
        }
      })();
    });
    const unsubscribeSettings = pageAccessService.subscribeToSettings((nextSettings) => {
      setSettings(nextSettings);
      setPreviewRoute(null);
      setError(null);
      setSettingsLoading(false);
    }, (subscriptionError) => {
      setError(subscriptionError.message);
      setSettingsLoading(false);
    });
    return () => {
      ++generation;
      unsubscribeAuth();
      unsubscribeAccessProfile?.();
      unsubscribeSettings();
    };
  }, [attempt]);

  useEffect(() => { nativeSessionService.setPreview(previewRoute); }, [previewRoute]);

  const authorization = useMemo(
    () => profile ? authorizationService.resolve(profile) : EMPTY_AUTHORIZATION,
    [profile],
  );

  const getDecision = useCallback(
    (route: string) => pageAccessService.getDecision(settings, route, authorization, previewRoute, !settingsLoading && !profileLoading && !error && !profileError),
    [authorization, settings, previewRoute, settingsLoading, profileLoading, error, profileError],
  );
  const enterPreview = useCallback((route: string) => {
    if (!getDecision(route).canEnterPreview) return;
    nativeSessionService.setPreview(pageAccessService.normalizeRoute(route));
    setPreviewRoute(pageAccessService.normalizeRoute(route));
    setActiveOverlayRoute(null);
  }, [getDecision]);
  useEffect(() => {
    pageAccessService.bindDecision(getDecision);
    return () => pageAccessService.bindDecision(null);
  }, [getDecision]);

  const value = useMemo<PageAccessContextValue>(() => ({
    settings,
    loading: settingsLoading || profileLoading,
    error: error ?? profileError,
    profile,
    authorization,
    getDecision,
    activeOverlayRoute,
    triggerOverlay,
    clearOverlay,
    enterPreview, exitPreview, retry,
  }), [activeOverlayRoute, authorization, clearOverlay, enterPreview, error, exitPreview, getDecision, profile, profileError, profileLoading, retry, settings, settingsLoading, triggerOverlay]);

  return <PageAccessContext.Provider value={value}>{children}</PageAccessContext.Provider>;
}

export function usePageAccess(): PageAccessContextValue {
  const context = useContext(PageAccessContext);
  if (!context) throw new Error('PageAccessProvider is required');
  return context;
}
