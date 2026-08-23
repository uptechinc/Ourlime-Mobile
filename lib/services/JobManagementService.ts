import { auth } from '@/lib/firebaseConfig';
import { apiService } from '@/lib/services/ApiService';
import { localCacheService } from '@/lib/services/LocalCacheService';

export type ManagedJobStatus = 'draft' | 'published' | 'active' | 'closed' | 'archived';
export type ApplicationStatus = 'pending' | 'reviewing' | 'interviewing' | 'offer' | 'accepted' | 'rejected' | 'withdrawn' | 'job_withdrawn';
export type InterviewType = 'video' | 'phone' | 'in-person';
export type JobApplicationAnswer = string | string[];
export type JobApplicationAnswers = { [questionId: string]: JobApplicationAnswer };

export type ApplicantEducation = {
  id: string;
  degree: string;
  school: string;
  description: string;
  startDate: string;
  endDate: string;
  current: boolean;
};

export type ApplicantWorkExperience = {
  id: string;
  role: string;
  company: string;
  description: string;
  startDate: string;
  endDate: string;
  current: boolean;
};

export type ManagedJobApplication = {
  id: string;
  status: ApplicationStatus;
  userId: string;
  createdAtMs: number;
  coverLetter: string;
  resumeUrl: string;
  portfolioLink: string;
  answers: JobApplicationAnswers;
  applicant: {
    name: string;
    email: string;
    imageUrl: string;
    verificationStatus: string;
    education: ApplicantEducation[];
    workExperience: ApplicantWorkExperience[];
  };
};

export type ManagedJobQuestion = {
  id: string;
  question: string;
  answerType: 'input' | 'single' | 'multiple' | 'checkbox' | 'dropdown';
  options: string[];
};

export type ManagedJobLocation = { type: string; address: string; city: string; country: string };
export type ManagedJobCategoryDetails = {
  name: string;
  industry: string;
  size: string;
  urgency: string;
  duration: string;
  complexity: string;
};

export type ManagedJob = {
  id: string;
  title: string;
  type: 'professional' | 'quickTask';
  status: ManagedJobStatus;
  createdAtMs: number;
  description: string;
  category: string;
  location: string;
  locationDetails: ManagedJobLocation;
  priceRange: { from: number; to: number };
  skills: string[];
  requirements: string[];
  qualifications: string[];
  categoryDetails: ManagedJobCategoryDetails;
  questions: ManagedJobQuestion[];
  applications: ManagedJobApplication[];
};

export type UpdateManagedJobInput = {
  title: string;
  description: string;
  category: string;
  priceRange: { from: number; to: number };
  location: ManagedJobLocation;
  skills: string[];
  requirements: string[];
  qualifications: string[];
  categoryDetails: ManagedJobCategoryDetails;
  questions: ManagedJobQuestion[];
};

export type EmployerNote = {
  id: string;
  jobId: string;
  applicationId: string;
  employerId: string;
  content: string;
  createdAtMs: number;
};

export type JobAuditEntry = {
  id: string;
  jobId: string;
  applicationId: string;
  action: string;
  details: string;
  previousValue: string;
  newValue: string;
  createdAtMs: number;
};

export type ScheduleInterviewInput = {
  applicationId: string;
  jobId: string;
  applicantId: string;
  applicantName: string;
  jobTitle: string;
  scheduledAt: string;
  duration: number;
  type: InterviewType;
  location?: string;
  notes?: string;
};

type ApiTimestamp = { seconds?: number; _seconds?: number };
type ApiApplicantEducation = Partial<Omit<ApplicantEducation, 'id' | 'current'>> & { id?: string; current?: boolean };
type ApiApplicantWorkExperience = Partial<Omit<ApplicantWorkExperience, 'id' | 'current'>> & { id?: string; current?: boolean; endDate?: string | null };
type ApiManagedApplication = {
  id?: string;
  status?: string;
  basic_info?: { status?: string; userId?: string; createdAt?: ApiTimestamp };
  details?: { coverLetter?: string; resumeUrl?: string; portfolioLink?: string };
  answers?: JobApplicationAnswers;
  applicant?: {
    name?: string;
    email?: string;
    imageUrl?: string;
    verificationStatus?: string;
    education?: ApiApplicantEducation[];
    workExperience?: ApiApplicantWorkExperience[];
  };
};
type ApiManagedJob = {
  id?: string;
  basic_info?: {
    title?: string;
    type?: string;
    status?: string;
    createdAt?: ApiTimestamp;
    description?: string;
    location?: string | { type?: string; name?: string; address?: string; city?: string; country?: string };
    category?: string;
    priceRange?: { from?: number; to?: number };
  };
  details?: { skills?: string[]; requirements?: string[]; qualifications?: string[] };
  category_specific?: { name?: string; industry?: string; size?: string | number; urgency?: string; duration?: string; complexity?: string };
  questions?: { id?: string; question?: string; type?: string; answerType?: string; options?: string[] }[];
  applications?: ApiManagedApplication[];
};
type ManagedJobsResponse = { status: 'success' | 'error'; jobs?: ApiManagedJob[]; message?: string };
type ApiEmployerNote = { id?: string; jobId?: string; applicationId?: string; employerId?: string; content?: string; createdAt?: ApiTimestamp };
type NotesResponse = { status: 'success' | 'error'; notes?: ApiEmployerNote[]; noteId?: string; message?: string };
type ApiAuditEntry = { id?: string; jobId?: string; applicationId?: string; action?: string; details?: string; previousValue?: string; newValue?: string; createdAt?: ApiTimestamp };
type AuditResponse = { status: 'success' | 'error'; entries?: ApiAuditEntry[]; message?: string };
type MutationResponse = { status: 'success' | 'error'; message?: string; succeeded?: number; failed?: number; interviewId?: string };
type ApplicationMutationContext = { jobId: string; previousStatus?: ApplicationStatus };

const CACHE_NAMESPACE = 'jobs-management';
const CACHE_KEY = 'current-user-jobs';
const CACHE_SCHEMA_VERSION = 2;
const CACHE_TTL_MS = 2 * 60 * 1000;

export class JobManagementService {
  private static instance: JobManagementService;

  private constructor() {}

  public static getInstance(): JobManagementService {
    if (!JobManagementService.instance) JobManagementService.instance = new JobManagementService();
    return JobManagementService.instance;
  }

  public async getCachedCurrentUserJobs(): Promise<ManagedJob[] | null> {
    const cachedRecord = await localCacheService.read<ManagedJob[]>(
      this.requireUserId(),
      CACHE_NAMESPACE,
      CACHE_KEY,
      CACHE_SCHEMA_VERSION,
    );
    return cachedRecord?.data ?? null;
  }

  public async listCurrentUserJobs(): Promise<ManagedJob[]> {
    const userId = this.requireUserId();
    const response = await apiService.request<ManagedJobsResponse>(
      `/api/jobs/myJobs/applications?userId=${encodeURIComponent(userId)}`,
      { authenticated: true },
    );
    if (response.status !== 'success') throw new Error(response.message || 'Your jobs could not be loaded.');
    const jobs = (response.jobs ?? []).map((job) => this.normalizeJob(job));
    await localCacheService.write(userId, CACHE_NAMESPACE, CACHE_KEY, jobs, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      schemaVersion: CACHE_SCHEMA_VERSION,
    });
    await localCacheService.prune({ namespace: CACHE_NAMESPACE, userId, maximumRecords: 2 });
    return jobs;
  }

  public async changeJobState(jobId: string, action: 'close' | 'archive' | 'reopen'): Promise<void> {
    await apiService.request<MutationResponse>('/api/jobs/myJobs/close', {
      method: 'POST', authenticated: true, body: { jobId, action },
    });
    await this.logAudit({
      jobId,
      action: `job_${action}`,
      details: `Job ${action === 'reopen' ? 'reopened' : `${action}d`}`,
    });
    await this.invalidateCache();
  }

  public async updateApplication(applicationId: string, status: ApplicationStatus, context?: ApplicationMutationContext): Promise<void> {
    await apiService.request<MutationResponse>('/api/jobs/myJobs/applications', {
      method: 'PATCH', authenticated: true, body: { applicationId, status, employerId: this.requireUserId() },
    });
    if (context) {
      await this.logAudit({
        jobId: context.jobId,
        applicationId,
        action: `status_${status}`,
        details: `Application status changed to ${status}`,
        previousValue: context.previousStatus,
        newValue: status,
      });
    }
    await this.invalidateCache();
  }

  public async bulkUpdateApplications(jobId: string, applicationIds: string[], status: ApplicationStatus): Promise<MutationResponse> {
    if (applicationIds.length === 0) throw new Error('Select at least one application.');
    const response = await apiService.request<MutationResponse>('/api/jobs/myJobs/bulk', {
      method: 'POST', authenticated: true, body: { applicationIds, status },
    });
    await this.logAudit({
      jobId,
      action: `bulk_${status}`,
      details: `Bulk updated ${applicationIds.length} application(s) to ${status}`,
    });
    await this.invalidateCache();
    return response;
  }

  public async updateJob(jobId: string, input: UpdateManagedJobInput): Promise<void> {
    if (!input.title.trim() || !input.description.trim() || !input.category.trim()) {
      throw new Error('Title, description, and category are required.');
    }
    if (input.priceRange.from < 0 || input.priceRange.to < input.priceRange.from) {
      throw new Error('Enter a valid compensation range.');
    }
    await apiService.request<MutationResponse>(`/api/jobs?jobId=${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      authenticated: true,
      body: {
        userId: this.requireUserId(),
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category.trim(),
        priceRange: input.priceRange,
        location: input.location,
        skills: input.skills,
        requirements: input.requirements,
        qualifications: input.qualifications,
        category_specific: input.categoryDetails,
      },
    });
    await this.logAudit({ jobId, action: 'job_updated', details: 'Job listing details updated' });
    await this.invalidateCache();
  }

  public async scheduleInterview(input: ScheduleInterviewInput): Promise<void> {
    await apiService.request<MutationResponse>('/api/jobs/myJobs/interviews', {
      method: 'POST', authenticated: true, body: { ...input, employerId: this.requireUserId() },
    });
    await this.updateApplication(input.applicationId, 'interviewing', { jobId: input.jobId });
    await this.logAudit({
      jobId: input.jobId,
      applicationId: input.applicationId,
      action: 'interview_scheduled',
      details: `Interview scheduled for ${new Date(input.scheduledAt).toLocaleString()}`,
    });
  }

  public async listNotes(applicationId: string): Promise<EmployerNote[]> {
    const response = await apiService.request<NotesResponse>(
      `/api/jobs/myJobs/notes?applicationId=${encodeURIComponent(applicationId)}`,
      { authenticated: true },
    );
    if (response.status !== 'success') throw new Error(response.message || 'Notes could not be loaded.');
    return (response.notes ?? []).map((note) => ({
      id: note.id ?? '', jobId: note.jobId ?? '', applicationId: note.applicationId ?? applicationId,
      employerId: note.employerId ?? '', content: note.content ?? '', createdAtMs: this.readTimestampMs(note.createdAt),
    }));
  }

  public async addNote(jobId: string, applicationId: string, content: string): Promise<void> {
    const trimmedContent = content.trim();
    if (!trimmedContent) throw new Error('Write a note before saving.');
    await apiService.request<NotesResponse>('/api/jobs/myJobs/notes', {
      method: 'POST', authenticated: true,
      body: { jobId, applicationId, employerId: this.requireUserId(), content: trimmedContent },
    });
    await this.logAudit({ jobId, applicationId, action: 'note_added', details: 'Private employer note added' });
  }

  public async deleteNote(jobId: string, applicationId: string, noteId: string): Promise<void> {
    await apiService.request<MutationResponse>(`/api/jobs/myJobs/notes?noteId=${encodeURIComponent(noteId)}`, {
      method: 'DELETE', authenticated: true,
    });
    await this.logAudit({ jobId, applicationId, action: 'note_deleted', details: 'Private employer note deleted' });
  }

  public async listAuditHistory(jobId: string, maximumEntries = 50): Promise<JobAuditEntry[]> {
    const boundedMaximum = Math.min(Math.max(maximumEntries, 1), 50);
    const response = await apiService.request<AuditResponse>(
      `/api/jobs/myJobs/audit?jobId=${encodeURIComponent(jobId)}&limit=${boundedMaximum}`,
      { authenticated: true },
    );
    if (response.status !== 'success') throw new Error(response.message || 'Activity history could not be loaded.');
    return (response.entries ?? []).map((entry) => ({
      id: entry.id ?? '', jobId: entry.jobId ?? jobId, applicationId: entry.applicationId ?? '',
      action: entry.action ?? 'activity', details: entry.details ?? '', previousValue: entry.previousValue ?? '',
      newValue: entry.newValue ?? '', createdAtMs: this.readTimestampMs(entry.createdAt),
    }));
  }

  public async deleteJob(jobId: string): Promise<void> {
    await apiService.request('/api/jobs/delete', {
      method: 'DELETE', authenticated: true, body: { jobId, userId: this.requireUserId() },
    });
    await this.invalidateCache();
  }

  private async logAudit(entry: {
    jobId: string;
    applicationId?: string;
    action: string;
    details: string;
    previousValue?: string;
    newValue?: string;
  }): Promise<void> {
    await apiService.request<MutationResponse>('/api/jobs/myJobs/audit', {
      method: 'POST', authenticated: true, body: { ...entry, employerId: this.requireUserId() },
    }).catch(() => undefined);
  }

  private async invalidateCache(): Promise<void> {
    await localCacheService.remove(this.requireUserId(), CACHE_NAMESPACE, CACHE_KEY);
  }

  private normalizeJob(job: ApiManagedJob): ManagedJob {
    const basicInfo = job.basic_info;
    const locationValue = basicInfo?.location;
    const location = typeof locationValue === 'string' ? locationValue : locationValue?.name || locationValue?.type || 'Remote';
    const normalizedLocation: ManagedJobLocation = typeof locationValue === 'object' && locationValue
      ? { type: locationValue.type ?? 'remote', address: locationValue.address ?? '', city: locationValue.city ?? '', country: locationValue.country ?? '' }
      : { type: typeof locationValue === 'string' ? locationValue : 'remote', address: '', city: '', country: '' };
    const categoryDetails = job.category_specific;
    const applications = (job.applications ?? []).map((application) => this.normalizeApplication(application));
    return {
      id: job.id ?? '', title: basicInfo?.title?.trim() || 'Untitled opportunity',
      type: basicInfo?.type === 'quickTask' ? 'quickTask' : 'professional', status: this.readJobStatus(basicInfo?.status),
      createdAtMs: this.readTimestampMs(basicInfo?.createdAt), description: basicInfo?.description ?? '', category: basicInfo?.category ?? '', location,
      locationDetails: normalizedLocation,
      priceRange: { from: basicInfo?.priceRange?.from ?? 0, to: basicInfo?.priceRange?.to ?? 0 },
      skills: job.details?.skills ?? [], requirements: job.details?.requirements ?? [], qualifications: job.details?.qualifications ?? [],
      categoryDetails: {
        name: categoryDetails?.name ?? '', industry: categoryDetails?.industry ?? '', size: String(categoryDetails?.size ?? ''),
        urgency: categoryDetails?.urgency ?? '', duration: categoryDetails?.duration ?? '', complexity: categoryDetails?.complexity ?? '',
      },
      questions: (job.questions ?? []).map((question) => ({
        id: question.id ?? '', question: question.question ?? '', answerType: this.readQuestionType(question.answerType ?? question.type), options: question.options ?? [],
      })),
      applications: applications.sort((leftApplication, rightApplication) => rightApplication.createdAtMs - leftApplication.createdAtMs),
    };
  }

  private normalizeApplication(application: ApiManagedApplication): ManagedJobApplication {
    const applicant = application.applicant;
    return {
      id: application.id ?? '', status: this.readApplicationStatus(application.basic_info?.status ?? application.status),
      userId: application.basic_info?.userId ?? '', createdAtMs: this.readTimestampMs(application.basic_info?.createdAt),
      coverLetter: application.details?.coverLetter ?? '', resumeUrl: application.details?.resumeUrl ?? '',
      portfolioLink: application.details?.portfolioLink ?? '', answers: application.answers ?? {},
      applicant: {
        name: applicant?.name?.trim() || 'Anonymous applicant', email: applicant?.email ?? '', imageUrl: applicant?.imageUrl ?? '',
        verificationStatus: applicant?.verificationStatus ?? '',
        education: (applicant?.education ?? []).map((education) => ({
          id: education.id ?? '', degree: education.degree ?? '', school: education.school ?? '', description: education.description ?? '',
          startDate: education.startDate ?? '', endDate: education.endDate ?? '', current: education.current ?? false,
        })),
        workExperience: (applicant?.workExperience ?? []).map((experience) => ({
          id: experience.id ?? '', role: experience.role ?? '', company: experience.company ?? '', description: experience.description ?? '',
          startDate: experience.startDate ?? '', endDate: experience.endDate ?? '', current: experience.current ?? false,
        })),
      },
    };
  }

  private requireUserId(): string {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('You must be signed in to manage jobs.');
    return userId;
  }

  private readTimestampMs(value?: ApiTimestamp): number {
    const seconds = value?.seconds ?? value?._seconds;
    return typeof seconds === 'number' ? seconds * 1000 : 0;
  }

  private readJobStatus(value: unknown): ManagedJobStatus {
    if (value === 'draft' || value === 'closed' || value === 'archived' || value === 'active') return value;
    return 'published';
  }

  private readApplicationStatus(value: unknown): ApplicationStatus {
    if (value === 'reviewing' || value === 'interviewing' || value === 'offer' || value === 'accepted' || value === 'rejected' || value === 'withdrawn' || value === 'job_withdrawn') return value;
    return 'pending';
  }

  private readQuestionType(value: unknown): ManagedJobQuestion['answerType'] {
    if (value === 'single' || value === 'multiple' || value === 'checkbox' || value === 'dropdown') return value;
    return 'input';
  }
}

export const jobManagementService = JobManagementService.getInstance();
