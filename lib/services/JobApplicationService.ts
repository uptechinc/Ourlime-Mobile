import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db, storage } from '@/lib/firebaseConfig';
import { jobDataService } from '@/lib/services/JobDataService';

export type JobApplicationAnswer = string | string[];
export type JobApplicationAnswers = { [questionId: string]: JobApplicationAnswer };
export type JobApplicationStatus = 'pending' | 'reviewing' | 'interviewing' | 'offer' | 'accepted' | 'rejected' | 'withdrawn' | 'job_withdrawn';
export type ResumeAsset = { uri: string; name: string; mimeType?: string | null };
export type CreateJobApplicationInput = {
  jobId: string;
  jobType: 'professional' | 'quickTask';
  coverLetter?: string;
  resume?: ResumeAsset;
  portfolioLink?: string;
  answers?: JobApplicationAnswers;
};
export type MyJobApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  jobCategory: string;
  employerName: string;
  status: JobApplicationStatus;
  jobType: 'professional' | 'quickTask';
  createdAtMs: number;
  updatedAtMs: number;
  coverLetter: string;
  resumeUrl: string;
};

type ApiTimestamp = { seconds?: number; _seconds?: number };
type ApiMyJobApplication = {
  id?: string;
  jobId?: string;
  jobTitle?: string;
  jobCategory?: string;
  employerName?: string;
  status?: string;
  jobType?: string;
  createdAt?: ApiTimestamp;
  updatedAt?: ApiTimestamp;
  coverLetter?: string;
  resumeUrl?: string;
};
type JobApplicationDocument = {
  basic_info?: {
    userId?: unknown;
    jobId?: unknown;
    };
};

export class JobApplicationService {
  private static instance: JobApplicationService;
  private constructor() {}

  public static getInstance(): JobApplicationService {
    if (!JobApplicationService.instance) JobApplicationService.instance = new JobApplicationService();
    return JobApplicationService.instance;
  }

  public async createApplication(input: CreateJobApplicationInput): Promise<string> {
    const userId = this.requireUserId();
    const resumeUrl = input.resume ? await this.uploadResume(userId, input.jobId, input.resume) : '';
    return jobDataService.submitApplication({
      jobId: input.jobId,
      jobType: input.jobType,
      ...(input.coverLetter?.trim() ? { coverLetter: input.coverLetter.trim() } : {}),
      ...(resumeUrl ? { resumeUrl } : {}),
      ...(input.portfolioLink?.trim() ? { portfolioLink: input.portfolioLink.trim() } : {}),
      ...(input.answers && Object.keys(input.answers).length > 0 ? { answers: input.answers } : {}),
    });
  }

  public async fetchMyApplications(): Promise<MyJobApplication[]> {
    const applications = (await jobDataService.fetchMyApplications()) as ApiMyJobApplication[];
    return applications
      .map((application) => this.normalizeApplication(application))
      .sort((leftApplication, rightApplication) => rightApplication.createdAtMs - leftApplication.createdAtMs);
  }

  public async withdrawApplication(applicationId: string): Promise<void> {
    await jobDataService.withdrawApplication(applicationId);
  }

  public async getAppliedJobIds(userId: string): Promise<Set<string>> {
    if (!userId) return new Set<string>();
    try {
      const snapshot = await getDocs(query(
        collection(db, 'jobApplications'),
        where('basic_info.userId', '==', userId),
      ));
      const ids = new Set<string>();
      snapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data() as JobApplicationDocument;
        const jobId = this.readString(data.basic_info?.jobId);
        if (jobId) ids.add(jobId);
      });
      return ids;
    } catch (error: unknown) {
      console.warn('[JobApplicationService.getAppliedJobIds] Failed to query applied jobs:', error);
      return new Set<string>();
    }
  }

  private normalizeApplication(application: ApiMyJobApplication): MyJobApplication {
    return {
      id: application.id ?? '',
      jobId: application.jobId ?? '',
      jobTitle: application.jobTitle?.trim() || 'Unavailable opportunity',
      jobCategory: application.jobCategory?.trim() || 'Uncategorized',
      employerName: application.employerName?.trim() || 'Employer',
      status: this.readStatus(application.status),
      jobType: application.jobType === 'quickTask' ? 'quickTask' : 'professional',
      createdAtMs: this.readTimestampMs(application.createdAt),
      updatedAtMs: this.readTimestampMs(application.updatedAt),
      coverLetter: application.coverLetter ?? '',
      resumeUrl: application.resumeUrl ?? '',
    };
  }

  private requireUserId(): string {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('You must be signed in to use job applications.');
    return userId;
  }

  private readTimestampMs(value?: ApiTimestamp): number {
    const seconds = value?.seconds ?? value?._seconds;
    return typeof seconds === 'number' ? seconds * 1000 : 0;
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private readStatus(value: unknown): JobApplicationStatus {
    if (
      value === 'reviewing'
      || value === 'interviewing'
      || value === 'offer'
      || value === 'accepted'
      || value === 'rejected'
      || value === 'withdrawn'
      || value === 'job_withdrawn'
    ) return value;
    return 'pending';
  }

  private async uploadResume(userId: string, jobId: string, resume: ResumeAsset): Promise<string> {
    const safeName = resume.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const response = await fetch(resume.uri);
    if (!response.ok) throw new Error('The selected resume could not be read.');
    const resumeReference = ref(storage, `applications/${userId}/${jobId}/${Date.now()}-${safeName}`);
    await uploadBytes(resumeReference, await response.blob(), resume.mimeType ? { contentType: resume.mimeType } : undefined);
    return getDownloadURL(resumeReference);
  }
}

export const jobApplicationService = JobApplicationService.getInstance();
