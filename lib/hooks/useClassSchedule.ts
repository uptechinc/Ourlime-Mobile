import { useCallback, useEffect, useRef, useState } from 'react';
import { scheduleService } from '@/lib/services/ScheduleService';
import type { ClassSchedule, ClassScheduleForm, ScheduleTemplate } from '@/lib/types/schedule';

type ClassScheduleState = {
  schedules: ClassSchedule[];
  templates: ScheduleTemplate[];
  loading: boolean;
  error: string | null;
};

/** Loads the learner's class timetable and saved templates, and runs the add / edit / delete / template actions. */
export function useClassSchedule(userId: string | null) {
  const generationRef = useRef(0);
  const [state, setState] = useState<ClassScheduleState>({ schedules: [], templates: [], loading: true, error: null });

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({ schedules: [], templates: [], loading: false, error: null });
      return;
    }
    const generation = ++generationRef.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [schedules, templates] = await Promise.all([
        scheduleService.getSchedules(userId),
        scheduleService.getTemplates(userId).catch((templateError: unknown) => {
          console.error('[useClassSchedule.refresh] Templates error:', templateError instanceof Error ? templateError.message : 'Unknown error');
          return [] as ScheduleTemplate[];
        }),
      ]);
      if (generation === generationRef.current) setState({ schedules, templates, loading: false, error: null });
    } catch (error: unknown) {
      console.error('[useClassSchedule.refresh] Error:', error instanceof Error ? error.message : 'Unknown error');
      if (generation === generationRef.current) setState((current) => ({ ...current, loading: false, error: 'Your schedule could not be loaded. Check your connection and try again.' }));
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    return () => { generationRef.current += 1; };
  }, [refresh]);

  const addClass = useCallback(async (form: ClassScheduleForm) => {
    await scheduleService.addSchedules(scheduleService.buildSchedules(form));
    await refresh();
  }, [refresh]);

  const updateClass = useCallback(async (scheduleId: string, form: ClassScheduleForm) => {
    await scheduleService.updateSchedule(scheduleId, form);
    await refresh();
  }, [refresh]);

  const deleteClass = useCallback(async (scheduleId: string) => {
    await scheduleService.deleteSchedule(scheduleId);
    await refresh();
  }, [refresh]);

  const saveTemplate = useCallback(async (template: ScheduleTemplate) => {
    await scheduleService.saveTemplate(template);
    setState((current) => ({ ...current, templates: [...current.templates, template] }));
  }, []);

  return { ...state, refresh, addClass, updateClass, deleteClass, saveTemplate };
}
