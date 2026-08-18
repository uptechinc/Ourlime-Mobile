import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useRouter, useSegments, type Href } from 'expo-router';
import { auth } from '../firebaseConfig';
import { pageAccessService } from '../services/PageAccessService';
import { deepLinkService } from '../services/DeepLinkService';

import { pushNotificationService } from '../services/PushNotificationService';

export function useAuthGuard() {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const segments = useSegments();
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

  useEffect(() => {
    if (isInitializing) return;

    const currentSegment = segments.join('/') || '/';
    const targetRedirect = pageAccessService.getTargetRedirect(user, currentSegment);

    if (targetRedirect) {
      if (user?.emailVerified === true && targetRedirect === '/(tabs)') {
        if (isResolvingPendingDestinationRef.current) return;
        isResolvingPendingDestinationRef.current = true;
        void deepLinkService.consumePendingDestination()
          .then((pendingDestination) => {
            router.replace((pendingDestination?.route ?? targetRedirect) as Href);
          })
          .finally(() => {
            isResolvingPendingDestinationRef.current = false;
          });
        return;
      }
      router.replace(targetRedirect as Href);
    }
  }, [user, isInitializing, segments, router]);

  return { user, isInitializing };
}
