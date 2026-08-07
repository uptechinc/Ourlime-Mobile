import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter, useSegments } from 'expo-router';
import { auth } from '../firebaseConfig';
import { pageAccessService } from '../services/PageAccessService';

import { pushNotificationService } from '../services/PushNotificationService';

export function useAuthGuard() {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
      if (currentUser) {
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
      router.replace(targetRedirect as any);
    }
  }, [user, isInitializing, segments, router]);

  return { user, isInitializing };
}
