import { Timestamp, addDoc, collection, deleteField, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { adminAccessService } from './AdminAccessService';
import { ADMIN_JOBS_FETCH_LIMIT, mapAdminJobDocument, resolveRejectionReason, type AdminJobRecord } from './AdminJobsRules';

export type AdminJobStatus = 'pending_review' | 'published' | 'draft' | 'paused' | 'closed' | 'rejected' | 'archived';

export type AdminJob = AdminJobRecord;

export type AdminJobStats = { total: number; pending: number; published: number; rejected: number };

/** The newest jobs, and whether older ones exist beyond the fetch limit. */
export type AdminJobList = { jobs: AdminJob[]; isTruncated: boolean };

/** The moderation write succeeded; `auditLogged` is false when only the adminLogs entry failed. */
export type AdminJobActionResult = { auditLogged: boolean };

/** Suspension lengths offered by the website's "Suspend User from Jobs" dialog, in days. */
export const JOB_SUSPENSION_DAYS = [1, 3, 7, 14, 30, 90] as const;
export type JobSuspensionDays = (typeof JOB_SUSPENSION_DAYS)[number];

type JobAuditAction = 'approve_job' | 'reject_job' | 'remove_job_listing' | 'suspend_job_poster';

/**
 * Job moderation for administrators, matching the website's /profile/admin/jobs page: every `jobs` document,
 * approve, reject (with a reason), remove a listing, and suspend a poster from posting and applying.
 * Firestore rules let administrators update any job and any user's moderation fields.
 */
export class AdminJobsService {
  private static instance: AdminJobsService;

  private constructor() {}

  public static getInstance(): AdminJobsService {
    if (!AdminJobsService.instance) AdminJobsService.instance = new AdminJobsService();
    return AdminJobsService.instance;
  }

  /** The newest jobs by creation date (bounded), with removed and deleted listings left out. */
  public async fetchJobs(): Promise<AdminJobList> {
    await adminAccessService.requireAdmin();
    const snapshot = await getDocs(query(collection(db, 'jobs'), orderBy('basic_info.createdAt', 'desc'), limit(ADMIN_JOBS_FETCH_LIMIT)));
    const jobs: AdminJob[] = [];
    snapshot.docs.forEach((jobDocument) => {
      const job = mapAdminJobDocument(jobDocument.id, jobDocument.data());
      if (job) jobs.push(job);
    });

    const posterIds = [...new Set(jobs.map((job) => job.userId).filter(Boolean))];
    const posters = new Map<string, { name: string; username: string }>();
    await Promise.all(posterIds.map(async (posterId) => {
      try {
        const posterSnapshot = await getDoc(doc(db, 'users', posterId));
        if (!posterSnapshot.exists()) return;
        const poster = posterSnapshot.data();
        const username = typeof poster.userName === 'string' ? poster.userName : '';
        const firstName = typeof poster.firstName === 'string' ? poster.firstName : '';
        posters.set(posterId, { name: username || firstName || 'Unknown', username });
      } catch (error: unknown) {
        console.error('[AdminJobsService.fetchJobs] Error:', error instanceof Error ? error.message : 'Poster lookup failed');
      }
    }));
    return {
      jobs: jobs
        .map((job) => {
          const poster = posters.get(job.userId);
          return poster ? { ...job, posterName: poster.name, posterUsername: poster.username } : job;
        })
        .sort((first, second) => second.createdAtSeconds - first.createdAtSeconds),
      isTruncated: snapshot.size >= ADMIN_JOBS_FETCH_LIMIT,
    };
  }

  public computeStats(jobs: AdminJob[]): AdminJobStats {
    return {
      total: jobs.length,
      pending: jobs.filter((job) => job.status === 'pending_review').length,
      published: jobs.filter((job) => job.status === 'published').length,
      rejected: jobs.filter((job) => job.status === 'rejected').length,
    };
  }

  public formatPrice(job: AdminJob): string {
    if (!job.priceRange) return 'N/A';
    const currency = job.currency || '$';
    return `${currency}${job.priceRange.from} - ${currency}${job.priceRange.to}`;
  }

  /** Publishes the job and clears any earlier rejection reason so the poster isn't shown stale feedback. */
  public async approveJob(jobId: string): Promise<AdminJobActionResult> {
    const administrator = await adminAccessService.requireAdmin();
    await updateDoc(doc(db, 'jobs', jobId), {
      'basic_info.status': 'published',
      'basic_info.updatedAt': Timestamp.now(),
      'basic_info.rejectionReason': deleteField(),
      'basic_info.rejectedAt': deleteField(),
    });
    return { auditLogged: await this.writeAudit(administrator.userId, 'approve_job', jobId, '') };
  }

  /** Rejects the job. The reason goes on basic_info (the only place the jobs rules allow it), like "Remove Listing". */
  public async rejectJob(jobId: string, reason: string): Promise<AdminJobActionResult> {
    const rejectionReason = resolveRejectionReason(reason);
    if (!rejectionReason) throw new Error('Enter a reason for rejecting this job.');
    const administrator = await adminAccessService.requireAdmin();
    await updateDoc(doc(db, 'jobs', jobId), {
      'basic_info.status': 'rejected',
      'basic_info.updatedAt': Timestamp.now(),
      'basic_info.rejectionReason': rejectionReason,
      'basic_info.rejectedAt': Timestamp.now(),
    });
    return { auditLogged: await this.writeAudit(administrator.userId, 'reject_job', jobId, rejectionReason) };
  }

  /** "Remove Listing": takes the job down for good (status "removed", which its poster cannot undo) with the reason on basic_info. */
  public async removeListing(jobId: string, reason: string): Promise<AdminJobActionResult> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error('Enter a reason for removing this listing.');
    const administrator = await adminAccessService.requireAdmin();
    await updateDoc(doc(db, 'jobs', jobId), {
      'basic_info.status': 'removed',
      'basic_info.updatedAt': Timestamp.now(),
      'basic_info.rejectionReason': trimmedReason,
      'basic_info.rejectedAt': Timestamp.now(),
    });
    return { auditLogged: await this.writeAudit(administrator.userId, 'remove_job_listing', jobId, trimmedReason) };
  }

  /** Blocks the poster from posting and applying for jobs; flags on users/{uid}, the reason in users/{uid}/private/profile. */
  public async suspendPoster(userId: string, reason: string, days: JobSuspensionDays): Promise<AdminJobActionResult> {
    const trimmedReason = reason.trim();
    if (!userId) throw new Error('This job has no poster to suspend.');
    if (!trimmedReason) throw new Error('Enter a reason for the suspension.');
    const administrator = await adminAccessService.requireAdmin();
    const until = Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', userId), {
      isJobPostingDisabled: true,
      jobPostingDisabledUntil: until,
      isJobApplyingDisabled: true,
      jobApplyingDisabledUntil: until,
      moderationUpdatedAt: Timestamp.now(),
    });
    batch.set(doc(db, 'users', userId, 'private', 'profile'), {
      jobPostingDisabledReason: trimmedReason,
      jobApplyingDisabledReason: trimmedReason,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    await batch.commit();
    return { auditLogged: await this.writeAudit(administrator.userId, 'suspend_job_poster', userId, `${days} days: ${trimmedReason}`) };
  }

  /**
   * Best-effort adminLogs entry, written after the moderation change has been saved. A failure here is
   * logged and reported back as `false`; it never turns a saved change into an error.
   */
  private async writeAudit(adminId: string, action: JobAuditAction, targetId: string, details: string): Promise<boolean> {
    try {
      await addDoc(collection(db, 'adminLogs'), {
        adminId,
        action,
        targetId,
        targetType: action === 'suspend_job_poster' ? 'user' : 'job',
        details,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      return true;
    } catch (error: unknown) {
      console.error('[AdminJobsService.writeAudit] Error:', error instanceof Error ? error.message : error);
      return false;
    }
  }
}

export const adminJobsService = AdminJobsService.getInstance();
