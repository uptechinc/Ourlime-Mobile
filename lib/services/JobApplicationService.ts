import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db, storage } from '@/lib/firebaseConfig';
import { ApiServiceError, apiService } from '@/lib/services/ApiService';

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

type ApplicationMutationResponse = {
  status: 'success' | 'error';
  applicationId?: string;
  message?: string;
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
type MyApplicationsResponse = {
  status: 'success' | 'error';
  applications?: ApiMyJobApplication[];
  message?: string;
};
type FirestoreTimestamp = {
  seconds?: number;
  _seconds?: number;
  toMillis?: () => number;
  toDate?: () => Date;
};
type JobApplicationDocument = {
  basic_info?: {
    userId?: unknown;
    jobId?: unknown;
    status?: unknown;
    jobType?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };
  details?: {
    coverLetter?: unknown;
    resumeUrl?: unknown;
  };
};
type JobDocument = {
  basic_info?: { title?: unknown };
  category_specific?: { name?: unknown };
  creator?: { name?: unknown };
};

export class JobApplicationService {
  private static instance: JobApplicationService;
  private isMyApplicationsApiAvailable: boolean | null = null;

  private constructor() {}

  public static getInstance(): JobApplicationService {
    if (!JobApplicationService.instance) JobApplicationService.instance = new JobApplicationService();
    return JobApplicationService.instance;
  }

  public async createApplication(input: CreateJobApplicationInput): Promise<string> {
    const userId = this.requireUserId();
    const resumeUrl = input.resume ? await this.uploadResume(userId, input.jobId, input.resume) : '';
    const response = await apiService.request<ApplicationMutationResponse>('/api/jobs/applications', {
      method: 'POST',
      authenticated: true,
      body: {
        userId,
        jobId: input.jobId,
        jobType: input.jobType,
        ...(input.coverLetter?.trim() ? { coverLetter: input.coverLetter.trim() } : {}),
        ...(resumeUrl ? { resumeUrl } : {}),
        ...(input.portfolioLink?.trim() ? { portfolioLink: input.portfolioLink.trim() } : {}),
        ...(input.answers && Object.keys(input.answers).length > 0 ? { answers: input.answers } : {}),
      },
    });
    if (response.status !== 'success' || !response.applicationId) {
      throw new Error(response.message || 'The application could not be submitted.');
    }
    return response.applicationId;
  }

  public async fetchMyApplications(): Promise<MyJobApplication[]> {
    const userId = this.requireUserId();
    if (this.isMyApplicationsApiAvailable === false) {
      return this.fetchMyApplicationsFromFirestore(userId);
    }
    try {
      const response = await apiService.request<MyApplicationsResponse>(
        `/api/jobs/applications/my-applications?userId=${encodeURIComponent(userId)}`,
        { authenticated: true },
      );
      if (response.status !== 'success') throw new Error(response.message || 'Your applications could not be loaded.');
      this.isMyApplicationsApiAvailable = true;
      return (response.applications ?? [])
        .map((application) => this.normalizeApplication(application))
        .sort((leftApplication, rightApplication) => rightApplication.createdAtMs - leftApplication.createdAtMs);
    } catch (error: unknown) {
      if (!(error instanceof ApiServiceError) || error.status !== 404) throw error;
      this.isMyApplicationsApiAvailable = false;
      return this.fetchMyApplicationsFromFirestore(userId);
    }
  }

  public async withdrawApplication(applicationId: string): Promise<void> {
    const userId = this.requireUserId();
    if (this.isMyApplicationsApiAvailable === false) {
      await this.withdrawApplicationFromFirestore(applicationId, userId);
      return;
    }
    try {
      const response = await apiService.request<ApplicationMutationResponse>('/api/jobs/applications/my-applications', {
        method: 'PATCH',
        authenticated: true,
        body: { applicationId, action: 'withdraw', userId },
      });
      if (response.status !== 'success') throw new Error(response.message || 'The application could not be withdrawn.');
      this.isMyApplicationsApiAvailable = true;
    } catch (error: unknown) {
      if (!(error instanceof ApiServiceError) || error.status !== 404) throw error;
      this.isMyApplicationsApiAvailable = false;
      await this.withdrawApplicationFromFirestore(applicationId, userId);
    }
  }

  private async fetchMyApplicationsFromFirestore(userId: string): Promise<MyJobApplication[]> {
    const applicationsSnapshot = await getDocs(query(
      collection(db, 'jobApplications'),
      where('basic_info.userId', '==', userId),
    ));
    const applications = await Promise.all(applicationsSnapshot.docs.map(async (applicationDocument) => {
      const application = applicationDocument.data() as JobApplicationDocument;
      const jobId = this.readString(application.basic_info?.jobId);
      let job: JobDocument = {};
      if (jobId) {
        const jobDocument = await getDoc(doc(db, 'jobs', jobId));
        if (jobDocument.exists()) job = jobDocument.data() as JobDocument;
      }
      return {
        id: applicationDocument.id,
        jobId,
        jobTitle: this.readString(job.basic_info?.title) || 'Unavailable opportunity',
        jobCategory: this.readString(job.category_specific?.name) || 'Uncategorized',
        employerName: this.readString(job.creator?.name) || 'Employer',
        status: this.readStatus(application.basic_info?.status),
        jobType: application.basic_info?.jobType === 'quickTask' ? 'quickTask' as const : 'professional' as const,
        createdAtMs: this.readFirestoreTimestampMs(application.basic_info?.createdAt),
        updatedAtMs: this.readFirestoreTimestampMs(application.basic_info?.updatedAt),
        coverLetter: this.readString(application.details?.coverLetter),
        resumeUrl: this.readString(application.details?.resumeUrl),
      };
    }));
    return applications.sort((leftApplication, rightApplication) => rightApplication.createdAtMs - leftApplication.createdAtMs);
  }

  private async withdrawApplicationFromFirestore(applicationId: string, userId: string): Promise<void> {
    const applicationReference = doc(db, 'jobApplications', applicationId);
    const applicationDocument = await getDoc(applicationReference);
    if (!applicationDocument.exists()) throw new Error('Application not found.');
    const application = applicationDocument.data() as JobApplicationDocument;
    if (this.readString(application.basic_info?.userId) !== userId) {
      throw new Error('You are not authorized to withdraw this application.');
    }
    const status = this.readStatus(application.basic_info?.status);
    if (status !== 'pending' && status !== 'reviewing') {
      throw new Error('Only pending or reviewing applications can be withdrawn.');
    }
    await updateDoc(applicationReference, {
      'basic_info.status': 'withdrawn',
      'basic_info.updatedAt': serverTimestamp(),
    });
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

  private readFirestoreTimestampMs(value: unknown): number {
    if (!value || typeof value !== 'object') return 0;
    const timestamp = value as FirestoreTimestamp;
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    const seconds = timestamp.seconds ?? timestamp._seconds;
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
