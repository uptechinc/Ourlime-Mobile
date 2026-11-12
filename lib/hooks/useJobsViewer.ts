import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner-native';
import { auth } from '@/lib/firebaseConfig';
import { JobsService } from '@/lib/job/JobsService';
import { jobApplicationService } from '@/lib/services/JobApplicationService';

const jobsService = JobsService.getInstance();

export type JobsViewer = {
  userId: string;
  verificationStatus: string;
  isVerified: boolean;
  savedJobIds: Set<string>;
  appliedJobIds: Set<string>;
  isViewerLoaded: boolean;
  toggleSave: (jobId: string) => Promise<void>;
  markApplied: (jobId: string) => void;
  refreshViewer: () => Promise<void>;
};

/**
 * What the Jobs screens need to know about the signed-in user: identity verification (posting and applying are
 * gated on it, like the website), saved jobs (users/{uid}/savedJobs) and the jobs already applied to.
 */
export function useJobsViewer(): JobsViewer {
  const userId = auth.currentUser?.uid ?? '';
  const [verificationStatus, setVerificationStatus] = useState('not_started');
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [isViewerLoaded, setIsViewerLoaded] = useState(false);

  const refreshViewer = useCallback(async () => {
    if (!userId) { setIsViewerLoaded(true); return; }
    const [status, saved, applied] = await Promise.all([
      jobsService.getVerificationStatus(userId),
      jobsService.getSavedJobIds(userId),
      jobApplicationService.getAppliedJobIds(userId),
    ]);
    setVerificationStatus(status);
    setSavedJobIds(saved);
    setAppliedJobIds(applied);
    setIsViewerLoaded(true);
  }, [userId]);

  useEffect(() => { void refreshViewer(); }, [refreshViewer]);

  const toggleSave = useCallback(async (jobId: string) => {
    if (!userId) { toast.error('Please sign in to save jobs'); return; }
    const isSaving = !savedJobIds.has(jobId);
    const apply = (saved: boolean) => setSavedJobIds((current) => {
      const next = new Set(current);
      if (saved) next.add(jobId); else next.delete(jobId);
      return next;
    });
    apply(isSaving);
    try {
      await jobsService.toggleSaveJob(userId, jobId, isSaving);
      toast.success(isSaving ? 'Job saved successfully' : 'Job removed from saved');
    } catch (error: unknown) {
      console.error('[useJobsViewer.toggleSave] Error:', error);
      apply(!isSaving);
      toast.error('Failed to update saved status');
    }
  }, [savedJobIds, userId]);

  const markApplied = useCallback((jobId: string) => {
    setAppliedJobIds((current) => new Set(current).add(jobId));
  }, []);

  return { userId, verificationStatus, isVerified: verificationStatus === 'verified', savedJobIds, appliedJobIds, isViewerLoaded, toggleSave, markApplied, refreshViewer };
}
