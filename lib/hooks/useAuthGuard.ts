import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useLocalSearchParams, useRouter, useSegments, type Href } from 'expo-router';
import { auth } from '../firebaseConfig';
import { pageAccessService } from '../services/PageAccessService';
import { deepLinkService } from '../services/DeepLinkService';

import { pushNotificationService } from '../services/PushNotificationService';
import { notificationNavigationService } from '../services/NotificationNavigationService';
import { authService } from '../services/AuthService';
import { qrLoginService } from '../services/QRLoginService';

export function useAuthGuard() {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const segments = useSegments();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const router = useRouter();
  const isResolvingPendingDestinationRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const verifiedUser = currentUser?.emailVerified === true ? currentUser : null;
      if (!verifiedUser) isResolvingPendingDestinationRef.current = false;
      setUser(verifiedUser);
      setIsInitializing(false);
      if (currentUser?.uid) {
        void pushNotificationService.registerForPushNotifications(currentUser.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for remote active session revocation
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = qrLoginService.subscribeToCurrentSession(user.uid, () => {
      void authService.logout();
      router.replace('/(auth)/login' as Href);
    });

    return () => unsubscribe();
  }, [user?.uid, router]);

  useEffect(() => {
    if (isInitializing) return;

    const currentSegment = segments.join('/') || '/';
    const targetRedirect = pageAccessService.getTargetRedirect(user, currentSegment);

    if (targetRedirect) {
      if (user?.emailVerified === true && targetRedirect === '/(tabs)') {
        const postAuthenticationRedirect = pageAccessService.getPostAuthenticationRedirect(next);
        if (postAuthenticationRedirect !== '/(tabs)') {
          router.replace(postAuthenticationRedirect as Href);
          return;
        }
        if (isResolvingPendingDestinationRef.current) return;
        isResolvingPendingDestinationRef.current = true;
        void (async () => {
          try {
            const hasPendingNotification = await notificationNavigationService.hasPending();
            if (hasPendingNotification) return;
            const pendingDestination = await deepLinkService.consumePendingDestination();
            router.replace((pendingDestination?.route ?? targetRedirect) as Href);
          } finally {
            isResolvingPendingDestinationRef.current = false;
          }
        })();
        return;
      }

      if (!user && targetRedirect === '/(auth)/login') {
        const normalizedCurrent = pageAccessService.normalizeRoute(currentSegment);
        if (
          normalizedCurrent !== '/' &&
          normalizedCurrent !== '/index' &&
          normalizedCurrent !== '/(tabs)' &&
          normalizedCurrent !== '/(tabs)/index' &&
          !pageAccessService.isPublicRoute(normalizedCurrent)
        ) {
          const destinationWithNext = `/(auth)/login?next=${encodeURIComponent(normalizedCurrent)}`;
          router.replace(destinationWithNext as Href);
          return;
        }
      }

      router.replace(targetRedirect as Href);
    }
  }, [user, isInitializing, next, segments, router]);

  return { user, isInitializing };
}
