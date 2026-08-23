import { useEffect, useState } from 'react';
import { countdownTickerService } from '@/lib/services/CountdownTickerService';

export function useCountdownTicker(enabled: boolean): number {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!enabled) return;
    return countdownTickerService.subscribe(setNowMs);
  }, [enabled]);

  return nowMs;
}
