import { Timestamp, collection, doc, getDoc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { adminAccessService } from './AdminAccessService';

export type AdminJobStatus = 'pending_review' | 'published' | 'draft' | 'paused' | 'closed' | 'rejected' | 'archived';

export type AdminJob = {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  status: string;
  createdAtSeconds: number;
  userId: string;
  priceRange: { from: number; to: number } | null;
  currency: string;
  location: string;
  skills: string[];
  employmentType: string;
  experienceLevel: string;
  posterName: string;
  posterUsername: string;
};

export type AdminJobStats = { total: number; pending: number; published: number; rejected: number };

/** Suspension lengths offered by the website's "Suspend User from Jobs" dialog, in days. */
export const JOB_SUSPENSION_DAYS = [1, 3, 7, 14, 30, 90] as const;
export type JobSuspensionDays = (typeof JOB_SUSPENSION_DAYS)[number];

const DEFAULT_REJECTION_REASON = 'Does not comply with platform guidelines.';

type JobLocationValue = string | { type?: unknown; address?: unknown; city?: unknown; country?: unknown } | undefined;

const readString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const readLocation = (value: JobLocationValue): string => {
  if (!value) return 'N/A';
  if (typeof value === 'string') return value;
  return readString(value.type, 'N/A') || 'N/A';
};

const readPriceRange = (value: unknown): AdminJob['priceRange'] => {
  if (!value || typeof value !== 'object') return null;
  const range = value as { from?: unknown; to?: unknown };
  const from = Number(range.from);
  const to = Number(range.to);
  return Number.isFinite(from) && Number.isFinite(to) ? { from, to } : null;
};

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

  public async fetchJobs(): Promise<AdminJob[]> {
    await adminAccessService.requireAdmin();
    const snapshot = await getDocs(collection(db, 'jobs'));
    const jobs: AdminJob[] = [];
    snapshot.docs.forEach((jobDocument) => {
      const data = jobDocument.data();
      const basic = data.basic_info as { [field: string]: unknown } | undefined;
      if (!basic) return;
      const details = data.details as { skills?: unknown } | undefined;
      const createdAt = basic.createdAt as { seconds?: unknown } | undefined;
      jobs.push({
        id: jobDocument.id,
        title: readString(basic.title) || 'Untitled',
        description: readString(basic.description),
        type: readString(basic.type) || 'professional',
        category: readString(basic.category),
        status: readString(basic.status) || 'draft',
        createdAtSeconds: typeof createdAt?.seconds === 'number' ? createdAt.seconds : 0,
        userId: readString(basic.userId),
        priceRange: readPriceRange(basic.priceRange),
        currency: readString(basic.currency) || 'USD',
        location: readLocation(basic.location as JobLocationValue),
        skills: Array.isArray(details?.skills) ? details.skills.filter((skill): skill is string => typeof skill === 'string') : [],
        employmentType: readString(basic.employmentType),
        experienceLevel: readString(basic.experienceLevel),
        posterName: 'Unknown',
        posterUsername: '',
      });
    });

    const posterIds = [...new Set(jobs.map((job) => job.userId).filter(Boolean))];
    const posters = new Map<string, { name: string; username: string }>();
    await Promise.all(posterIds.map(async (posterId) => {
      try {
        const posterSnapshot = await getDoc(doc(db, 'users', posterId));
        if (!posterSnapshot.exists()) return;
        const poster = posterSnapshot.data();
        const username = readString(poster.userName);
        posters.set(posterId, { name: username || readString(poster.firstName) || 'Unknown', username });
      } catch (error: unknown) {
        console.error('[AdminJobsService.fetchJobs] Error:', error instanceof Error ? error.message : 'Poster lookup failed');
      }
    }));
    return jobs
      .map((job) => {
        const poster = posters.get(job.userId);
        return poster ? { ...job, posterName: poster.name, posterUsername: poster.username } : job;
      })
      .sort((first, second) => second.createdAtSeconds - first.createdAtSeconds);
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

  public async approveJob(jobId: string): Promise<void> {
    await adminAccessService.requireAdmin();
    await updateDoc(doc(db, 'jobs', jobId), {
      'basic_info.status': 'published',
      'basic_info.updatedAt': Timestamp.now(),
    });
  }

  public async rejectJob(jobId: string, reason: string): Promise<void> {
    await adminAccessService.requireAdmin();
    await updateDoc(doc(db, 'jobs', jobId), {
      'basic_info.status': 'rejected',
      'basic_info.updatedAt': Timestamp.now(),
      rejectionReason: reason.trim() || DEFAULT_REJECTION_REASON,
    });
  }

  /** "Remove Listing": rejects and hides the job with the reason on basic_info, like the website. */
  public async removeListing(jobId: string, reason: string): Promise<void> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error('Enter a reason for removing this listing.');
    await adminAccessService.requireAdmin();
    await updateDoc(doc(db, 'jobs', jobId), {
      'basic_info.status': 'rejected',
      'basic_info.rejectionReason': trimmedReason,
      'basic_info.rejectedAt': Timestamp.now(),
    });
  }

  /** Blocks the poster from posting and applying for jobs; flags on users/{uid}, the reason in users/{uid}/private/profile. */
  public async suspendPoster(userId: string, reason: string, days: JobSuspensionDays): Promise<void> {
    const trimmedReason = reason.trim();
    if (!userId) throw new Error('This job has no poster to suspend.');
    if (!trimmedReason) throw new Error('Enter a reason for the suspension.');
    await adminAccessService.requireAdmin();
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
  }
}

export const adminJobsService = AdminJobsService.getInstance();
