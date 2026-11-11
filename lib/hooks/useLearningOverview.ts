import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService, type LearningOverview } from '@/lib/services/CourseService';
import { instructorService, type InstructorStatus } from '@/lib/services/InstructorService';

type LearningOverviewState = { data: LearningOverview | null; instructorStatus: InstructorStatus; loading: boolean; refreshing: boolean; error: string | null };

export function useLearningOverview() {
  const { activeUserId } = useAppData();
  const generationRef = useRef(0);
  const [state, setState] = useState<LearningOverviewState>({ data: null, instructorStatus: 'none', loading: true, refreshing: false, error: null });
  const ready = Boolean(activeUserId);

  const refresh = useCallback(async (manual = false) => {
    if (!activeUserId) return;
    const requestGeneration = ++generationRef.current;
    setState((current) => ({ ...current, loading: !current.data, refreshing: manual && Boolean(current.data), error: null }));
    try {
      // The instructor check only decides which hub links show (like the website), so a refusal means "not an instructor".
      const [data, instructorStatus] = await Promise.all([
        courseService.getOverview(activeUserId),
        instructorService.getStatus(activeUserId).catch((statusError: unknown): InstructorStatus => {
          console.warn('[useLearningOverview.refresh] Instructor status unavailable:', statusError instanceof Error ? statusError.message : 'Unknown error');
          return 'none';
        }),
      ]);
      if (requestGeneration === generationRef.current) setState({ data, instructorStatus, loading: false, refreshing: false, error: null });
    } catch (error: unknown) {
      if (requestGeneration !== generationRef.current) return;
      const message = error instanceof Error && error.message.includes('permission')
        ? 'E-Learning access is unavailable for this account.'
        : 'E-Learning could not connect. Check your connection and retry.';
      setState((current) => ({ ...current, loading: false, refreshing: false, error: message }));
    }
  }, [activeUserId]);

  useEffect(() => {
    generationRef.current += 1;
    if (!activeUserId) { setState({ data: null, instructorStatus: 'none', loading: false, refreshing: false, error: null }); return; }
    void refresh();
    return () => { generationRef.current += 1; };
  }, [activeUserId, refresh]);

  return { ...state, ready, refresh };
}
