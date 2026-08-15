import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { deepLinkService } from '@/lib/services/DeepLinkService';

type DeepLinkNavigation = {
  openLink: (url: string) => Promise<void>;
};

export function useDeepLinkNavigation(): DeepLinkNavigation {
  const router = useRouter();

  const openLink = useCallback(async (url: string): Promise<void> => {
    const resolution = deepLinkService.resolve(url);
    if (resolution.kind === 'internal') {
      router.push(resolution.route as Href);
      return;
    }
    if (resolution.kind === 'external') await Linking.openURL(resolution.url);
  }, [router]);

  return { openLink };
}
