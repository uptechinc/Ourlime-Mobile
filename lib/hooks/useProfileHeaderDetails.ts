import { useEffect, useState } from 'react';
import { profileAboutService, type SocialLinks } from '@/lib/services/ProfileAboutService';

export type ProfileHeaderDetails = { socialLinks: SocialLinks; country: string; joinedAtMs: number | null };

const EMPTY_DETAILS: ProfileHeaderDetails = { socialLinks: {}, country: '', joinedAtMs: null };

/** Social links, country and join date for a profile header (website ProfileHeader / ViewOtherProfileHeader). */
export function useProfileHeaderDetails(userId: string | undefined, refreshKey = 0): ProfileHeaderDetails {
  const [details, setDetails] = useState<ProfileHeaderDetails>(EMPTY_DETAILS);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    profileAboutService.loadHeaderDetails(userId)
      .then((loaded) => { if (!cancelled) setDetails(loaded); })
      .catch((error: unknown) => console.error('[useProfileHeaderDetails] Error:', error));
    return () => { cancelled = true; };
  }, [refreshKey, userId]);

  return details;
}
