import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { AuthService } from '@/lib/services/AuthService';
import { LocalCacheService } from '@/lib/services/LocalCacheService';
import { ConversationResourceService } from '@/lib/services/ConversationResourceService';
import { ProfileResourceService } from '@/lib/services/ProfileResourceService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { MessageResourceService } from '@/lib/services/MessageResourceService';
import { FeedResourceService } from '@/lib/services/FeedResourceService';
import { presenceService } from '@/lib/services/PresenceService';
import { platformEnvironmentService } from '@/lib/services/PlatformEnvironmentService';

type AppDataContextValue = {
  activeUserId: string | null;
  cacheReady: boolean;
};

type AppDataProviderProps = { children: ReactNode };

const AppDataContext = createContext<AppDataContextValue>({ activeUserId: null, cacheReady: false });
const authService = AuthService.getInstance();
const cacheService = LocalCacheService.getInstance();
const conversationService = ConversationResourceService.getInstance();
const profileService = ProfileResourceService.getInstance();
const messageService = MessageResourceService.getInstance();
const feedService = FeedResourceService.getInstance();

export function AppDataProvider({ children }: AppDataProviderProps) {
  const [activeUserId, setActiveUserId] = useState<string | null>(authService.getVerifiedCurrentUser()?.uid ?? null);
  const [cacheReady, setCacheReady] = useState(false);
  const activeUserIdRef = useRef<string | null>(activeUserId);

  useEffect(() => {
    void cacheService.initialize().then(() => setCacheReady(true)).catch(() => setCacheReady(false));
  }, []);

  useEffect(() => authService.subscribeToVerifiedAuthState((user) => {
    const previousUserId = activeUserIdRef.current;
    const nextUserId = user?.uid ?? null;
    if (previousUserId && previousUserId !== nextUserId) {
      conversationService.stopRealtime();
      useResourceStore.getState().clearUserResources();
      void cacheService.clearUser(previousUserId).catch(() => undefined);
    }
    setActiveUserId(nextUserId);
    activeUserIdRef.current = nextUserId;
    if (!nextUserId) return;
    void Promise.all([
      conversationService.hydrate(nextUserId),
      profileService.hydrate({ kind: 'own', userId: nextUserId }),
    ]).then(() => {
      conversationService.startRealtime(nextUserId);
      void conversationService.refresh(nextUserId);
      void profileService.refresh({ kind: 'own', userId: nextUserId });
    });
  }), []);

  useEffect(() => {
    const handleState = (status: AppStateStatus) => {
      if (!activeUserId) return;
      if (status === 'active') {
        void presenceService.heartbeat('online').catch(() => undefined);
        conversationService.startRealtime(activeUserId);
        messageService.resumeRealtime();
        void conversationService.refresh(activeUserId);
        void profileService.refresh({ kind: 'own', userId: activeUserId });
        void feedService.reconcileCachedFeeds(activeUserId);
      } else {
        void presenceService.heartbeat('offline').catch(() => undefined);
        conversationService.stopRealtime();
        messageService.pauseRealtime();
      }
    };
    const subscription = AppState.addEventListener('change', handleState);
    return () => subscription.remove();
  }, [activeUserId]);

  useEffect(() => {
    if (!activeUserId) return;
    void presenceService.heartbeat('online').catch(() => undefined);
    const heartbeat = setInterval(() => {
      if (AppState.currentState === 'active') void presenceService.heartbeat('online').catch(() => undefined);
    }, 60_000);
    return () => clearInterval(heartbeat);
  }, [activeUserId]);

  useEffect(() => {
    if (!activeUserId) return;
    if (!platformEnvironmentService.isNativePushSupported()) return;
    // expo-notifications remote push was removed from Expo Go in SDK 53.
    // Lazily load so the module never throws at import time.
    let subscription: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      subscription = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data ?? {};
        const type = typeof data.type === 'string' ? data.type : typeof data.notificationType === 'string' ? data.notificationType : '';
        if (type === 'message' || type === 'voice_call' || type === 'video_call' || type === 'friend_accepted') {
          void conversationService.refresh(activeUserId, true);
        }
        if (type.includes('post') || type === 'comment' || type === 'like') {
          void feedService.reconcileCachedFeeds(activeUserId);
        }
        if (type.includes('friend') || type.includes('follow') || type === 'profile') {
          void profileService.refresh({ kind: 'own', userId: activeUserId }, true);
        }
      });
    } catch {
      // Not supported in Expo Go — skip.
    }
    return () => subscription?.remove();
  }, [activeUserId]);

  return <AppDataContext.Provider value={{ activeUserId, cacheReady }}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  return useContext(AppDataContext);
}
