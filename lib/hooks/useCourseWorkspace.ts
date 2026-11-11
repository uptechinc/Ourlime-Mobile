import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService } from '@/lib/services/CourseService';
import type { CourseWorkspace } from '@/lib/types/course';

type CourseWorkspaceState = { workspace: CourseWorkspace | null; loading: boolean; refreshing: boolean; error: string | null };

/** Loads one course's learner workspace (course, enrollment, modules with lessons/resources, submissions). */
export function useCourseWorkspace(courseId: string) {
  const { activeUserId } = useAppData();
  const generationRef = useRef(0);
  const [state, setState] = useState<CourseWorkspaceState>({ workspace: null, loading: true, refreshing: false, error: null });
  const hasFocusedRef = useRef(false);

  const refresh = useCallback(async (manual = false) => {
    if (!activeUserId || !courseId) return;
    const requestGeneration = ++generationRef.current;
    setState((current) => ({ ...current, loading: !current.workspace, refreshing: manual, error: null }));
    try {
      const workspace = await courseService.getCourseWorkspace(activeUserId, courseId);
      if (requestGeneration === generationRef.current) setState({ workspace, loading: false, refreshing: false, error: workspace ? null : 'This course is unavailable.' });
    } catch (error: unknown) {
      console.error('[useCourseWorkspace.refresh] Error:', error instanceof Error ? error.message : 'Unknown error');
      if (requestGeneration !== generationRef.current) return;
      setState((current) => ({ ...current, loading: false, refreshing: false, error: 'This course could not be loaded. Check your connection and try again.' }));
    }
  }, [activeUserId, courseId]);

  useEffect(() => {
    generationRef.current += 1;
    if (!activeUserId) { setState({ workspace: null, loading: false, refreshing: false, error: 'Sign in to open this course.' }); return; }
    void refresh();
    return () => { generationRef.current += 1; };
  }, [activeUserId, refresh]);

  // Coming back from a lesson refreshes progress quietly, so Next Up and completion are current.
  useFocusEffect(useCallback(() => {
    if (hasFocusedRef.current) void refresh();
    hasFocusedRef.current = true;
  }, [refresh]));

  return { ...state, refresh };
}
