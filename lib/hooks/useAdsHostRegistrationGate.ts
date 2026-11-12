import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { toast } from 'sonner-native';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';

type AdsHostRegistrationGate = { isChecking: boolean; error: string | null; retry: () => void };

/**
 * Host registration pages open only for a signed-in user without a host account: signed-out users go to login and
 * existing hosts to their dashboard, as on the website.
 */
export function useAdsHostRegistrationGate(loginRoute: Href, dashboardRoute: Href): AdsHostRegistrationGate {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!adsMarketplaceService.currentUserId()) {
      toast.error('Please log in to become a host');
      router.replace(loginRoute);
      return;
    }
    let isActive = true;
    setIsChecking(true);
    setError(null);
    adsMarketplaceService.getMyHost()
      .then((host) => {
        if (!isActive) return;
        if (host) router.replace(dashboardRoute);
        else setIsChecking(false);
      })
      .catch((checkError: unknown) => {
        if (!isActive) return;
        setError(AdsMarketplaceService.errorMessage(checkError, 'Could not check your host account.'));
        setIsChecking(false);
      });
    return () => {
      isActive = false;
    };
  }, [router, loginRoute, dashboardRoute, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { isChecking, error, retry };
}
