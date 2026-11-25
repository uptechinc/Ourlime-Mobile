import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebaseConfig';
import { JobsService } from '@/lib/job/JobsService';
import { jobApplicationService } from '@/lib/services/JobApplicationService';

const jobsService = JobsService.getInstance();

export type JobsViewer = {
  userId: string;
  verificationStatus: string;
  isVerified: boolean;
  appliedJobIds: Set<string>;
  isViewerLoaded: boolean;
  markApplied: (jobId: string) => void;
  refreshViewer: () => Promise<void>;
};

/**
 * What the Jobs screens need to know about the signed-in user: identity verification (posting and applying are
 * gated on it, like the website) and the jobs already applied to. Saved jobs live in the saved store (SaveButton).
 */
export function useJobsViewer(): JobsViewer {
  const userId = auth.currentUser?.uid ?? '';
  const [verificationStatus, setVerificationStatus] = useState('not_started');
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [isViewerLoaded, setIsViewerLoaded] = useState(false);

  const refreshViewer = useCallback(async () => {
    if (!userId) { setIsViewerLoaded(true); return; }
    const [status, applied] = await Promise.all([
      jobsService.getVerificationStatus(userId),
      jobApplicationService.getAppliedJobIds(userId),
    ]);
    setVerificationStatus(status);
    setAppliedJobIds(applied);
    setIsViewerLoaded(true);
  }, [userId]);

  useEffect(() => { void refreshViewer(); }, [refreshViewer]);

  const markApplied = useCallback((jobId: string) => {
    setAppliedJobIds((current) => new Set(current).add(jobId));
  }, []);

  return { userId, verificationStatus, isVerified: verificationStatus === 'verified', appliedJobIds, isViewerLoaded, markApplied, refreshViewer };
}
