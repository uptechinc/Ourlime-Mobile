import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebaseConfig';
import { appServerService } from './AppServerService';

export type JobAnswerValue = string | string[];
export type JobApplicationSubmission = {
  jobId: string;
  jobType: 'professional' | 'quickTask';
  coverLetter?: string;
  resumeUrl?: string;
  portfolioLink?: string;
  answers?: { [questionId: string]: JobAnswerValue };
};
export type JobAuditInput = { jobId: string; applicationId?: string; action: string; details: string; previousValue?: string; newValue?: string };
export type JobInterviewInput = {
  applicationId: string;
  jobId: string;
  applicantId: string;
  applicantName: string;
  jobTitle: string;
  scheduledAt: string;
  duration: number;
  type: 'video' | 'phone' | 'in-person';
  location?: string;
  notes?: string;
};
export type JobUpdateInput = {
  title: string;
  description: string;
  category: string;
  priceRange: { from: number; to: number };
  location: { type: string; address: string; city: string; country: string };
  skills: string[];
  requirements: string[];
  qualifications: string[];
  category_specific: DocumentData;
};
export type JobState = 'close' | 'archive' | 'reopen';
export type EmployerApplicationStatus = 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'withdrawn' | 'interviewing' | 'offer';

const APPLICANT_DISCLAIMER_VERSION = '1.0';
const JOBS_POLICY_VERSION = '1.0';
const SUPPORTED_JOB_TYPES = new Set(['professional', 'quickTask']);
const EMPLOYER_STATUSES = new Set<string>(['pending', 'reviewing', 'accepted', 'rejected', 'withdrawn', 'interviewing', 'offer']);
const EMPLOYER_TRANSITIONS: { [status: string]: string[] } = {
  pending: ['reviewing', 'rejected', 'withdrawn'],
  reviewing: ['interviewing', 'accepted', 'rejected', 'withdrawn'],
  interviewing: ['accepted', 'rejected'],
  offer: ['accepted', 'rejected'],
};
const APPLICANT_WITHDRAWAL_STATUSES = new Set(['pending', 'reviewing']);

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
const deadlineMillis = (value: unknown): number | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
  return null;
};

/**
 * Jobs for the app, reading and writing Firestore directly with the same logic as the website's /api/jobs/* routes.
 * Emails go through the app's own functions (sendJobStatusEmail, sendJobWithdrawnEmail).
 */
export class JobDataService {
  private static instance: JobDataService;

  private constructor() {}

  public static getInstance(): JobDataService {
    if (!JobDataService.instance) JobDataService.instance = new JobDataService();
    return JobDataService.instance;
  }

  private requireUserId(): string {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('You must be signed in to use Jobs.');
    return userId;
  }

  /** Web JobsAuthorizationService.requireVerifiedUser. */
  private async requireVerifiedUser(action: 'applying for jobs' | 'posting a job'): Promise<{ userId: string; identityVerificationStatus: string }> {
    const userId = this.requireUserId();
    const user = (await getDoc(doc(db, 'users', userId))).data() ?? {};
    const status = readString(user.identityVerificationStatus) || readString(user.verificationStatus);
    const identityVerificationStatus = ['pending', 'verified', 'rejected', 'expired'].includes(status) ? status : 'not_started';
    if (identityVerificationStatus !== 'verified') throw new Error(`Identity verification is required before ${action}.`);
    if (user.jobsSuspended === true || user.isJobsSuspended === true) throw new Error('Your access to Jobs is currently suspended.');
    return { userId, identityVerificationStatus };
  }

  private async requireOwnedJob(jobId: string, userId: string): Promise<DocumentData> {
    const job = await getDoc(doc(db, 'jobs', jobId));
    if (!job.exists()) throw new Error('Job not found');
    if (job.data().basic_info?.userId !== userId) throw new Error('You do not have permission to manage this job');
    return job.data();
  }

  // ── Applicant side (web /api/jobs/applications, /applications/my-applications) ──

  public async submitApplication(input: JobApplicationSubmission): Promise<string> {
    const user = await this.requireVerifiedUser('applying for jobs');
    if (!input.jobId || !SUPPORTED_JOB_TYPES.has(input.jobType)) throw new Error('A valid Professional Job or Quick Task is required.');
    const jobRef = doc(db, 'jobs', input.jobId);
    const applicationRef = doc(db, 'jobApplications', `${input.jobId}_${user.userId}`);
    await runTransaction(db, async (transaction) => {
      const [job, existing] = await Promise.all([transaction.get(jobRef), transaction.get(applicationRef)]);
      if (!job.exists()) throw new Error('This job listing no longer exists.');
      const basicInfo = job.data().basic_info ?? {};
      if (basicInfo.status !== 'published') throw new Error('This job is not accepting applications.');
      if (!SUPPORTED_JOB_TYPES.has(readString(basicInfo.type))) throw new Error('This job type is not supported.');
      if (basicInfo.userId === user.userId) throw new Error('You cannot apply to your own job listing.');
      const deadline = deadlineMillis(basicInfo.deadline ?? basicInfo.closingDate);
      if (deadline !== null && deadline < Date.now()) throw new Error('This job listing has expired.');
      if (existing.exists()) throw new Error('You have already applied for this job.');
      transaction.set(applicationRef, {
        basic_info: { userId: user.userId, jobId: input.jobId, jobType: input.jobType, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        details: { coverLetter: input.coverLetter?.trim() || null, resumeUrl: input.resumeUrl || null, ...(input.portfolioLink ? { portfolioLink: input.portfolioLink } : {}) },
        answers: input.answers ?? {},
        category_specific: {},
        disclaimerAcknowledgment: {
          userId: user.userId,
          jobId: input.jobId,
          disclaimerVersion: APPLICANT_DISCLAIMER_VERSION,
          policyVersion: JOBS_POLICY_VERSION,
          acceptedAt: serverTimestamp(),
          identityVerificationStatus: user.identityVerificationStatus,
        },
      });
    });
    return applicationRef.id;
  }

  public async fetchMyApplications(): Promise<DocumentData[]> {
    const userId = this.requireUserId();
    const snapshot = await getDocs(query(collection(db, 'jobApplications'), where('basic_info.userId', '==', userId)));
    return Promise.all(snapshot.docs.map(async (application) => {
      const data = application.data();
      const jobId = readString(data.basic_info?.jobId);
      const job = jobId ? (await getDoc(doc(db, 'jobs', jobId)).catch(() => null))?.data() : undefined;
      return {
        id: application.id,
        jobId,
        jobTitle: readString(job?.basic_info?.title),
        jobCategory: readString(job?.category_specific?.name),
        employerName: readString(job?.creator?.name),
        status: readString(data.basic_info?.status) || 'pending',
        jobType: readString(data.basic_info?.jobType),
        createdAt: data.basic_info?.createdAt,
        updatedAt: data.basic_info?.updatedAt,
        coverLetter: readString(data.details?.coverLetter),
        resumeUrl: readString(data.details?.resumeUrl),
      };
    }));
  }

  public async withdrawApplication(applicationId: string): Promise<void> {
    const userId = this.requireUserId();
    const applicationRef = doc(db, 'jobApplications', applicationId);
    const application = await getDoc(applicationRef);
    if (!application.exists()) throw new Error('Application not found.');
    const currentStatus = readString(application.data().basic_info?.status);
    if (application.data().basic_info?.userId !== userId) throw new Error('You are not authorized to withdraw this application.');
    if (!APPLICANT_WITHDRAWAL_STATUSES.has(currentStatus)) {
      throw new Error(`This application cannot be withdrawn because its current status is "${currentStatus}". Only pending or reviewing applications can be withdrawn.`);
    }
    await updateDoc(applicationRef, { 'basic_info.status': 'withdrawn', 'basic_info.updatedAt': Timestamp.now() });
    await this.logAudit({ jobId: readString(application.data().basic_info?.jobId), applicationId, action: 'application_withdrawn', details: 'Applicant withdrew their application', previousValue: currentStatus, newValue: 'withdrawn' }, userId).catch(() => undefined);
    void appServerService.call('sendJobWithdrawnEmail', { applicationId }).catch(() => undefined);
  }

  // ── Employer side (web /api/jobs, /jobs/delete, /jobs/myJobs/*) ──

  /** Web MyJobsManageJobsService.fetchUserJobsWithQuestions. */
  public async fetchMyJobs(): Promise<DocumentData[]> {
    const userId = this.requireUserId();
    const jobs = await getDocs(query(collection(db, 'jobs'), where('basic_info.userId', '==', userId), orderBy('basic_info.createdAt', 'desc')))
      .catch(() => getDocs(query(collection(db, 'jobs'), where('basic_info.userId', '==', userId))));
    return Promise.all(jobs.docs.map(async (job) => {
      const [questions, applications] = await Promise.all([
        getDocs(collection(db, 'jobs', job.id, 'questions')).then((snapshot) => snapshot.docs.map((question) => ({ id: question.id, ...question.data() }))).catch(() => []),
        getDocs(query(collection(db, 'jobApplications'), where('basic_info.jobId', '==', job.id)))
          .then((snapshot) => Promise.all(snapshot.docs.map((application) => this.withApplicant(application.id, application.data()))))
          .catch(() => []),
      ]);
      return { id: job.id, ...job.data(), questions, applications };
    }));
  }

  private async withApplicant(applicationId: string, application: DocumentData): Promise<DocumentData> {
    const applicantId = readString(application.basic_info?.userId);
    if (!applicantId) return { id: applicationId, ...application, applicant: { userId: 'unknown', name: 'Anonymous', email: '', imageUrl: '', education: [], workExperience: [] } };
    const [user, selections, education, workExperience] = await Promise.all([
      getDoc(doc(db, 'users', applicantId)).catch(() => null),
      getDocs(query(collection(db, 'profileImageSetAs'), where('userId', '==', applicantId))).catch(() => null),
      getDocs(collection(db, 'users', applicantId, 'education')).then((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))).catch(() => []),
      getDocs(collection(db, 'users', applicantId, 'workExperience')).then((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))).catch(() => []),
    ]);
    const userData = user?.data() ?? {};
    // Preferred image: jobApplyProfile, then jobProfile, then profile.
    let imageId = '';
    for (const selection of selections?.docs ?? []) {
      const data = selection.data();
      if (data.setAs === 'jobApplyProfile') { imageId = readString(data.profileImageId); break; }
      if (data.setAs === 'jobProfile') imageId = readString(data.profileImageId);
      else if (data.setAs === 'profile' && !imageId) imageId = readString(data.profileImageId);
    }
    const image = imageId ? await getDoc(doc(db, 'profileImages', imageId)).catch(() => null) : null;
    return {
      id: applicationId,
      ...application,
      applicant: {
        userId: applicantId,
        name: `${readString(userData.firstName)} ${readString(userData.lastName)}`.trim() || readString(userData.userName) || 'Anonymous',
        email: readString(userData.email),
        imageUrl: readString(image?.data()?.imageURL),
        verificationStatus: readString(userData.identityVerificationStatus) || readString(userData.verificationStatus),
        education,
        workExperience,
      },
    };
  }

  public async setJobState(jobId: string, action: JobState): Promise<void> {
    const userId = this.requireUserId();
    await this.requireOwnedJob(jobId, userId);
    const status = action === 'close' ? 'closed' : action === 'archive' ? 'archived' : 'active';
    await updateDoc(doc(db, 'jobs', jobId), { 'basic_info.status': status, 'basic_info.updatedAt': Timestamp.now() });
  }

  public async updateJob(jobId: string, input: JobUpdateInput): Promise<void> {
    const { userId } = await this.requireVerifiedUser('posting a job');
    const job = await this.requireOwnedJob(jobId, userId);
    const previousCategory = readString(job.basic_info?.category);
    await updateDoc(doc(db, 'jobs', jobId), {
      'basic_info.title': input.title,
      'basic_info.description': input.description,
      'basic_info.category': input.category,
      'basic_info.updatedAt': Timestamp.now(),
      'basic_info.priceRange': input.priceRange,
      'basic_info.location': input.location,
      'details.skills': input.skills,
      'details.requirements': input.requirements,
      'details.qualifications': input.qualifications,
      category_specific: input.category_specific,
    });
    if (previousCategory !== input.category) {
      if (previousCategory) await this.updateCategoryCount(previousCategory, false).catch(() => undefined);
      if (input.category) await this.updateCategoryCount(input.category, true).catch(() => undefined);
    }
  }

  /** Web JobsService.deleteJobWithCleanup: applications become job_withdrawn and lose their resume files. */
  public async deleteJob(jobId: string): Promise<void> {
    const userId = this.requireUserId();
    const job = await this.requireOwnedJob(jobId, userId);
    const applications = await getDocs(query(collection(db, 'jobApplications'), where('basic_info.jobId', '==', jobId)));
    await Promise.all(applications.docs.map(async (application) => {
      await updateDoc(application.ref, { 'basic_info.status': 'job_withdrawn', 'basic_info.updatedAt': Timestamp.now() }).catch(() => undefined);
      const resumeUrl = readString(application.data().details?.resumeUrl);
      if (resumeUrl) await deleteObject(ref(storage, resumeUrl)).catch(() => undefined);
    }));
    const questions = await getDocs(collection(db, 'jobs', jobId, 'questions'));
    await Promise.all(questions.docs.map((question) => deleteDoc(question.ref)));
    await deleteDoc(doc(db, 'jobs', jobId));
    const category = readString(job.basic_info?.category);
    if (category) await this.updateCategoryCount(category, false).catch(() => undefined);
  }

  private async updateCategoryCount(categoryName: string, increment: boolean): Promise<void> {
    const categories = await getDocs(query(collection(db, 'jobCategories'), where('name', '==', categoryName)));
    if (categories.empty) {
      if (increment) await addDoc(collection(db, 'jobCategories'), { name: categoryName, count: 1, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      return;
    }
    const category = categories.docs[0];
    const count = typeof category.data().count === 'number' ? category.data().count : 0;
    await updateDoc(category.ref, { count: increment ? count + 1 : Math.max(count - 1, 0), updatedAt: Timestamp.now() });
  }

  /** Employer status change with the website's transition rules and audit entry. */
  public async updateApplicationStatus(applicationId: string, status: EmployerApplicationStatus): Promise<void> {
    const userId = this.requireUserId();
    if (!EMPLOYER_STATUSES.has(status)) throw new Error('Invalid application status.');
    const applicationRef = doc(db, 'jobApplications', applicationId);
    const application = await getDoc(applicationRef);
    if (!application.exists()) throw new Error('Application not found');
    const jobId = readString(application.data().basic_info?.jobId);
    if (!jobId) throw new Error('Application has no associated job');
    await this.requireOwnedJob(jobId, userId).catch(() => { throw new Error('You are not authorized to change this application status'); });
    const previousStatus = readString(application.data().basic_info?.status);
    if (!(EMPLOYER_TRANSITIONS[previousStatus] ?? []).includes(status)) throw new Error(`Cannot transition from "${previousStatus}" to "${status}"`);
    await updateDoc(applicationRef, { 'basic_info.status': status, 'basic_info.updatedAt': Timestamp.now() });
    await this.logAudit({ jobId, applicationId, action: `application_${status}`, details: `Application status changed from ${previousStatus} to ${status} by employer`, previousValue: previousStatus, newValue: status }, userId).catch(() => undefined);
    void appServerService.call('sendJobStatusEmail', { applicationId }).catch(() => undefined);
  }

  public async bulkUpdateApplications(jobId: string, applicationIds: string[], status: EmployerApplicationStatus): Promise<{ succeeded: number; failed: number }> {
    const userId = this.requireUserId();
    if (applicationIds.length === 0) throw new Error('Application IDs array is required');
    if (!EMPLOYER_STATUSES.has(status)) throw new Error('Invalid application status.');
    await this.requireOwnedJob(jobId, userId);
    const results = await Promise.allSettled(applicationIds.map(async (applicationId) => {
      const applicationRef = doc(db, 'jobApplications', applicationId);
      const application = await getDoc(applicationRef);
      if (application.data()?.basic_info?.jobId !== jobId) throw new Error('Application does not belong to this job');
      await updateDoc(applicationRef, { 'basic_info.status': status, 'basic_info.updatedAt': Timestamp.now() });
    }));
    return { succeeded: results.filter((result) => result.status === 'fulfilled').length, failed: results.filter((result) => result.status === 'rejected').length };
  }

  public async scheduleInterview(input: JobInterviewInput): Promise<string> {
    const employerId = this.requireUserId();
    if (!input.applicationId || !input.jobId || !input.applicantId || !input.scheduledAt) throw new Error('Missing required fields');
    await this.requireOwnedJob(input.jobId, employerId);
    const interview = await addDoc(collection(db, 'jobInterviews'), {
      applicationId: input.applicationId,
      jobId: input.jobId,
      employerId,
      applicantId: input.applicantId,
      applicantName: input.applicantName || '',
      jobTitle: input.jobTitle || '',
      scheduledAt: Timestamp.fromDate(new Date(input.scheduledAt)),
      duration: input.duration || 30,
      type: input.type || 'video',
      ...(input.location ? { location: input.location } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      status: 'scheduled',
      createdAt: Timestamp.now(),
    });
    return interview.id;
  }

  public async listNotes(applicationId: string): Promise<DocumentData[]> {
    const snapshot = await getDocs(query(collection(db, 'jobEmployerNotes'), where('applicationId', '==', applicationId), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((note) => ({ id: note.id, ...note.data() }));
  }

  public async addNote(jobId: string, applicationId: string, content: string): Promise<string> {
    const employerId = this.requireUserId();
    if (!jobId || !applicationId || !content) throw new Error('Missing required fields');
    const note = await addDoc(collection(db, 'jobEmployerNotes'), { jobId, applicationId, employerId, content, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    return note.id;
  }

  public async deleteNote(noteId: string): Promise<void> {
    await deleteDoc(doc(db, 'jobEmployerNotes', noteId));
  }

  public async logAudit(entry: JobAuditInput, employerId = this.requireUserId()): Promise<void> {
    if (!entry.jobId || !entry.action || !entry.details) throw new Error('Missing required fields');
    await addDoc(collection(db, 'jobAuditLog'), {
      jobId: entry.jobId,
      ...(entry.applicationId ? { applicationId: entry.applicationId } : {}),
      employerId,
      action: entry.action,
      details: entry.details,
      ...(entry.previousValue !== undefined ? { previousValue: entry.previousValue } : {}),
      ...(entry.newValue !== undefined ? { newValue: entry.newValue } : {}),
      createdAt: Timestamp.now(),
    });
  }

  public async listAuditHistory(jobId: string, maximumEntries: number): Promise<DocumentData[]> {
    const snapshot = await getDocs(query(collection(db, 'jobAuditLog'), where('jobId', '==', jobId), orderBy('createdAt', 'desc'), limit(maximumEntries)));
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  }
}

export const jobDataService = JobDataService.getInstance();
