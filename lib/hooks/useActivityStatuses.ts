import { useEffect, useMemo, useState } from 'react';
import { presenceService, type ActivityStatus, type PresenceRecord } from '@/lib/services/PresenceService';
import { serverClockService } from '@/lib/services/ServerClockService';

/** At most this many people are followed live (the visible chat list). */
const MAX_WATCHED_USERS = 60;
/** Re-check freshness this often, so someone who closed Ourlime turns offline without a new snapshot. */
const STALE_CHECK_MS = 30_000;

type PresenceRecords = Record<string, PresenceRecord>;

/** Live activity status (online / busy / away / working / offline) for these people, same as the website shows. */
export function useActivityStatuses(userIds: string[]): Record<string, ActivityStatus> {
  const idsKey = useMemo(() => [...new Set(userIds.filter(Boolean))].slice(0, MAX_WATCHED_USERS).sort().join(','), [userIds]);
  const [records, setRecords] = useState<PresenceRecords>({});
  const [nowMs, setNowMs] = useState(() => serverClockService.nowSync());

  useEffect(() => {
    if (!idsKey) {
      setRecords({});
      return;
    }
    return presenceService.subscribeToPresence(idsKey.split(','), setRecords);
  }, [idsKey]);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(serverClockService.nowSync()), STALE_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  return useMemo(() => Object.fromEntries(
    Object.entries(records).map(([userId, record]) => [userId, presenceService.resolveStatus(record, nowMs)]),
  ), [records, nowMs]);
}
