import { useEffect, useState } from 'react';
import { JobsService, type JobRecord } from '@/lib/job/JobsService';

type JobQuestion = NonNullable<JobRecord['questions']>[number];
type UseJobQuestionsResult = { questions: JobQuestion[]; isLoading: boolean };

const jobsService = JobsService.getInstance();

/**
 * Screening questions for the job being applied to. Job lists no longer read every job's questions,
 * so they load here when the form opens, unless the job already carries them.
 */
export function useJobQuestions(jobId: string, providedQuestions: JobQuestion[] | undefined, enabled: boolean): UseJobQuestionsResult {
  const [loaded, setLoaded] = useState<{ jobId: string; questions: JobQuestion[] } | null>(null);
  const needsLoad = enabled && !providedQuestions && loaded?.jobId !== jobId;

  useEffect(() => {
    if (!needsLoad) return;
    let isCurrent = true;
    jobsService.fetchQuestions(jobId)
      .catch((error: unknown) => {
        // Same outcome as when the list read questions and the read failed: the form shows none.
        console.error('[useJobQuestions] Error:', error);
        return [];
      })
      .then((questions) => { if (isCurrent) setLoaded({ jobId, questions }); });
    return () => { isCurrent = false; };
  }, [jobId, needsLoad]);

  if (providedQuestions) return { questions: providedQuestions, isLoading: false };
  return { questions: loaded?.jobId === jobId ? loaded.questions : [], isLoading: needsLoad };
}
