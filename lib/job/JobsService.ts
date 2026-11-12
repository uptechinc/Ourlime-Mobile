import { db } from '@/lib/firebaseConfig';
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    Firestore,
    limit,
    Timestamp,
    type DocumentData
} from 'firebase/firestore';
import { firestoreBatchReadService } from '@/lib/services/FirestoreBatchReadService';
import { accountLifecycleVisibilityService } from '@/lib/services/AccountLifecycleVisibilityService';

const MAX_PUBLISHED_JOB_SCAN = 500;
const MAX_OPEN_JOBS_RETURNED = 200;
export const JOB_POSTER_DISCLAIMER_VERSION = '1.0';
export const JOBS_POLICY_VERSION = '1.0';

export type JobListingType = 'professional' | 'quickTask';
export type JobPublicationStatus = 'draft' | 'pending_review' | 'published' | 'paused' | 'closed' | 'archived' | 'active' | 'rejected' | 'expired' | 'deleted';

export type JobDeliverable = { description: string; quantity: string | number; unit: string };
export type JobCancellationTerm = { trigger: string; refundPercentage: number; description: string };
export type JobCompanyDetails = {
    name: string;
    size: string;
    industry: string;
    website: string;
    logo: string;
    description: string;
    benefits: string[];
    isAuthorizedRepresentative: boolean;
};

export type JobRecord = {
    id: string;
    basic_info: {
        type: JobListingType;
        title: string;
        description: string;
        userId: string;
        location: { type?: string; city?: string; country?: string; address?: string; notes?: string };
        priceRange: { from: number; to: number };
        createdAt?: { seconds: number };
        closingDate?: { seconds: number };
        category?: string;
        jobType?: string;
        status?: JobPublicationStatus;
        currency?: string;
        paymentPeriod?: string;
        contactPreference?: string;
        employmentType?: string;
        experienceLevel?: string;
        educationRequirement?: string;
    };
    category?: string;
    details: { skills: string[]; requirements?: string[]; qualifications?: string[]; deliverables?: string[] };
    category_specific: {
        name?: string;
        type?: string;
        industry?: string;
        size?: string | number;
        website?: string;
        logo?: string;
        companyDescription?: string;
        benefits?: string[];
        urgency?: 'low' | 'medium' | 'high' | 'critical';
        duration?: string;
        complexity?: string;
        timeline?: string;
        employmentType?: string;
        currency?: string;
        paymentPeriod?: string;
        paymentType?: string;
        paymentTiming?: string;
        contactPreference?: string;
        applicationDeadline?: string;
        deliverables?: JobDeliverable[];
        acceptanceCriteria?: string[];
        cancellationTerms?: JobCancellationTerm[];
        safetyRequirements?: string[];
    };
    questions?: { id: string; question?: string; type?: string; options?: string[] }[];
    creator?: { name: string; username: string; profileImage: string; email?: string; verificationStatus?: string };
};

export type JobQuestionInput = {
    question: string;
    answerType: 'input' | 'single' | 'multiple' | 'checkbox' | 'dropdown';
    options: string[];
};

export type CreateJobInput = {
    jobTitle: string;
    jobDescription: string;
    jobCategory: JobListingType;
    category: string;
    userId: string;
    priceRange: { from: number | string; to: number | string };
    location: JobRecord['basic_info']['location'];
    skills?: string[];
    requirements?: string[];
    deliverables?: string[];
    currency?: string;
    paymentPeriod?: string;
    contactPreference?: string;
    employmentType?: string;
    experienceLevel?: string;
    educationRequirement?: string;
    /** ISO date string; stored as a Timestamp. */
    closingDate?: string;
    category_specific?: DocumentData;
    questions?: JobQuestionInput[];
    /** Professional jobs are submitted as 'pending_review' (website jobCreationModal); quick tasks publish directly. */
    publicationStatus: 'published' | 'pending_review' | 'draft';
    disclaimerAccepted: boolean;
};

export type UpdateJobInput = {
    title: string;
    description: string;
    type: string;
    priceRange: JobRecord['basic_info']['priceRange'];
    location: JobRecord['basic_info']['location'];
    skills: string[];
    requirements: string[];
    qualifications: string[];
    category_specific: JobRecord['category_specific'];
    questions: JobQuestionInput[];
};

type CreatorLookup = { users: Map<string, DocumentData>; profileImages: Map<string, string> };

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
const readStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []);
const readObject = (value: unknown): DocumentData => (value && typeof value === 'object' && !Array.isArray(value) ? value as DocumentData : {});

export class JobsService {
    private static instance: JobsService;
    private readonly db: Firestore;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): JobsService {
        if (!JobsService.instance) {
            JobsService.instance = new JobsService();
        }
        return JobsService.instance;
    }

    /**
     * Creates a Professional Job or Quick Task the way the website's POST /api/jobs does. The client rules only
     * accept the listing's core basic_info keys and the 'published' / 'draft' statuses, so the extra listing
     * details (currency, pay period, employment type, closing date, ...) and the poster's disclaimer acceptance are
     * kept in category_specific, where the app and the website's detail views read them.
     */
    public async createJob(jobData: CreateJobInput): Promise<string> {
        try {
            if (jobData.publicationStatus !== 'draft' && !jobData.disclaimerAccepted) {
                throw new Error('You must acknowledge the current job poster disclaimer.');
            }
            const listingDetails: DocumentData = {
                currency: jobData.currency || 'USD',
                paymentPeriod: jobData.paymentPeriod || 'fixed',
                contactPreference: jobData.contactPreference || 'in_app',
                ...(jobData.employmentType ? { employmentType: jobData.employmentType } : {}),
                ...(jobData.experienceLevel ? { experienceLevel: jobData.experienceLevel } : {}),
                ...(jobData.educationRequirement ? { educationRequirement: jobData.educationRequirement } : {}),
                ...(jobData.closingDate ? { closingDate: Timestamp.fromDate(new Date(jobData.closingDate)) } : {}),
                ...(jobData.publicationStatus !== 'draft' ? {
                    disclaimerAcknowledgment: {
                        userId: jobData.userId,
                        disclaimerVersion: JOB_POSTER_DISCLAIMER_VERSION,
                        policyVersion: JOBS_POLICY_VERSION,
                        acceptedAt: Timestamp.now(),
                    },
                } : {}),
            };

            const jobRef = await addDoc(collection(this.db, 'jobs'), {
                basic_info: {
                    title: jobData.jobTitle,
                    description: jobData.jobDescription,
                    type: jobData.jobCategory,
                    category: jobData.category,
                    status: jobData.publicationStatus,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    userId: jobData.userId,
                    priceRange: {
                        from: Number(jobData.priceRange.from) || 0,
                        to: Number(jobData.priceRange.to) || 0,
                    },
                    location: jobData.location,
                },
                details: {
                    skills: jobData.skills ?? [],
                    requirements: jobData.requirements ?? [],
                    deliverables: jobData.deliverables ?? [],
                    qualifications: [],
                },
                category_specific: { ...(jobData.category_specific ?? {}), ...listingDetails },
            });

            const questions = (jobData.questions ?? []).filter((question) => question.question.trim());
            if (questions.length > 0) {
                const questionsCollection = collection(jobRef, 'questions');
                await Promise.all(
                    questions.map((question) =>
                        addDoc(questionsCollection, {
                            question: question.question.trim(),
                            type: question.answerType,
                            options: question.answerType !== 'input' ? question.options.map((option) => option.trim()).filter(Boolean) : [],
                        })
                    )
                );
            }

            if (jobData.category && jobData.publicationStatus !== 'draft') {
                await this.updateCategoryCount(jobData.category, true);
            }

            return jobRef.id;
        } catch (error: unknown) {
            console.error('[JobsService.createJob] Error:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to create job');
        }
    }

    private toMillis(value: unknown): number | null {
        if (value instanceof Timestamp) return value.toMillis();
        if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
        if (typeof value === 'string' || typeof value === 'number') {
            const parsed = new Date(value).getTime();
            return Number.isNaN(parsed) ? null : parsed;
        }
        return null;
    }

    private toSeconds(value: unknown): { seconds: number } | undefined {
        const millis = this.toMillis(value);
        return millis === null ? undefined : { seconds: Math.floor(millis / 1000) };
    }

    /**
     * Open jobs, newest first: published, not past their closing date, owner account not hidden (the same set the
     * website's /api/jobs lists). Sorting and the closing-date check happen here so the query needs no composite
     * index; at most MAX_PUBLISHED_JOB_SCAN published jobs are read.
     */
    public async fetchJobs(maxResults = 20): Promise<JobRecord[]> {
        try {
            const now = Date.now();
            const publishedSnapshot = await getDocs(query(
                collection(this.db, 'jobs'),
                where('basic_info.status', '==', 'published'),
                limit(MAX_PUBLISHED_JOB_SCAN),
            ));
            const jobDocs = publishedSnapshot.docs
                .filter((docSnapshot) => {
                    const data = docSnapshot.data();
                    if (accountLifecycleVisibilityService.isHidden(data)) return false;
                    const closesAt = this.readClosingMillis(data);
                    return closesAt === null || closesAt >= now;
                })
                .sort((left, right) => (this.toMillis(right.data().basic_info?.createdAt) ?? 0) - (this.toMillis(left.data().basic_info?.createdAt) ?? 0))
                .slice(0, Math.min(MAX_OPEN_JOBS_RETURNED, Math.max(1, maxResults)));
            const creators = await this.fetchCreators(jobDocs.map((docSnapshot) => readString(readObject(docSnapshot.data().basic_info).userId)));
            return jobDocs.map((docSnapshot) => this.toJobRecord(docSnapshot.id, docSnapshot.data(), creators));
        } catch (error) {
            console.error('[JobsService.fetchJobs] Error:', error);
            throw new Error('Failed to fetch jobs');
        }
    }

    /** One job by id in any status (the detail screen decides whether it still accepts applications). */
    public async getJobById(jobId: string): Promise<JobRecord | null> {
        const snapshot = await getDoc(doc(this.db, 'jobs', jobId));
        if (!snapshot.exists()) return null;
        const data = snapshot.data();
        if (accountLifecycleVisibilityService.isHidden(data)) return null;
        const creators = await this.fetchCreators([readString(readObject(data.basic_info).userId)]);
        return this.toJobRecord(snapshot.id, data, creators);
    }

    /** Whether a job is open to applicants: published and not past its closing date. */
    public isAcceptingApplications(job: JobRecord): boolean {
        if (job.basic_info.status !== 'published') return false;
        const closesAt = job.basic_info.closingDate ? job.basic_info.closingDate.seconds * 1000 : null;
        return closesAt === null || closesAt >= Date.now();
    }

    private readClosingMillis(data: DocumentData): number | null {
        const basicInfo = readObject(data.basic_info);
        const categorySpecific = readObject(data.category_specific);
        return this.toMillis(basicInfo.closingDate ?? categorySpecific.closingDate);
    }

    /** Normalizes the several shapes the website has stored listings in (company / companyDetails / name). */
    private toJobRecord(id: string, data: DocumentData, creators: CreatorLookup): JobRecord {
        const basicInfo = readObject(data.basic_info);
        const details = readObject(data.details);
        const categorySpecific = readObject(data.category_specific);
        const company = { ...readObject(categorySpecific.company), ...readObject(categorySpecific.companyDetails) };
        const userId = readString(basicInfo.userId);
        const userData = creators.users.get(userId);
        const priceRange = readObject(basicInfo.priceRange);
        const pick = (key: string): string | undefined => readString(basicInfo[key]) || readString(categorySpecific[key]) || undefined;
        const status = readString(basicInfo.status) as JobPublicationStatus;
        const deliverables = Array.isArray(categorySpecific.deliverables)
            ? (categorySpecific.deliverables as unknown[])
                .map((entry): JobDeliverable | null => {
                    if (typeof entry === 'string') return entry.trim() ? { description: entry, quantity: '', unit: '' } : null;
                    const deliverable = readObject(entry);
                    const description = readString(deliverable.description);
                    return description ? { description, quantity: typeof deliverable.quantity === 'number' || typeof deliverable.quantity === 'string' ? deliverable.quantity : '', unit: readString(deliverable.unit) } : null;
                })
                .filter((entry): entry is JobDeliverable => entry !== null)
            : undefined;
        const cancellationTerms = Array.isArray(categorySpecific.cancellationTerms)
            ? (categorySpecific.cancellationTerms as unknown[]).map((entry) => {
                const term = readObject(entry);
                return { trigger: readString(term.trigger), refundPercentage: Number(term.refundPercentage) || 0, description: readString(term.description) };
            }).filter((term) => term.trigger)
            : undefined;
        const urgency = readString(categorySpecific.urgency);
        const verificationStatus = userData ? readString(userData.identityVerificationStatus) || readString(userData.verificationStatus) : '';

        return {
            id,
            basic_info: {
                type: basicInfo.type === 'quickTask' ? 'quickTask' : 'professional',
                title: readString(basicInfo.title) || 'Untitled opportunity',
                description: readString(basicInfo.description),
                userId,
                location: readObject(basicInfo.location),
                priceRange: {
                    from: typeof priceRange.from === 'number' ? priceRange.from : Number(priceRange.from) || 0,
                    to: typeof priceRange.to === 'number' ? priceRange.to : Number(priceRange.to) || 0,
                },
                createdAt: this.toSeconds(basicInfo.createdAt),
                closingDate: this.toSeconds(basicInfo.closingDate ?? categorySpecific.closingDate),
                category: readString(basicInfo.category) || undefined,
                jobType: readString(basicInfo.jobType) || undefined,
                status: status || 'published',
                currency: pick('currency'),
                paymentPeriod: pick('paymentPeriod'),
                contactPreference: pick('contactPreference'),
                employmentType: pick('employmentType'),
                experienceLevel: pick('experienceLevel'),
                educationRequirement: pick('educationRequirement'),
            },
            details: {
                skills: readStringArray(details.skills),
                requirements: readStringArray(details.requirements),
                qualifications: readStringArray(details.qualifications),
                deliverables: readStringArray(details.deliverables),
            },
            category_specific: {
                ...categorySpecific,
                name: readString(categorySpecific.name) || readString(company.name) || readString(categorySpecific.companyName) || undefined,
                industry: readString(categorySpecific.industry) || readString(company.industry) || undefined,
                size: readString(categorySpecific.size) || readString(company.size) || undefined,
                website: readString(company.website) || undefined,
                logo: readString(company.logo) || undefined,
                companyDescription: readString(company.description) || undefined,
                benefits: readStringArray(categorySpecific.benefits).length ? readStringArray(categorySpecific.benefits) : readStringArray(company.benefits),
                urgency: urgency === 'low' || urgency === 'medium' || urgency === 'high' || urgency === 'critical' ? urgency : undefined,
                duration: readString(categorySpecific.duration) || readString(categorySpecific.expectedDuration) || readString(categorySpecific.timeline) || undefined,
                complexity: readString(categorySpecific.complexity) || undefined,
                deliverables,
                acceptanceCriteria: readStringArray(categorySpecific.acceptanceCriteria),
                cancellationTerms,
                safetyRequirements: readStringArray(categorySpecific.safetyRequirements),
            },
            // Screening questions are only needed by the application form, which loads them with fetchQuestions.
            creator: {
                name: userData ? `${readString(userData.firstName)} ${readString(userData.lastName)}`.trim() || 'Anonymous' : 'Anonymous',
                username: readString(userData?.userName) || 'anonymous',
                profileImage: creators.profileImages.get(userId) ?? '',
                verificationStatus,
            },
        };
    }

    /** A job's screening questions, read when the application form opens rather than for every job in a list. */
    public async fetchQuestions(jobId: string): Promise<NonNullable<JobRecord['questions']>> {
        const questionsSnapshot = await getDocs(collection(this.db, 'jobs', jobId, 'questions'));
        return questionsSnapshot.docs.map((questionDocument) => ({ id: questionDocument.id, ...questionDocument.data() }));
    }

    /**
     * Creator user docs and job profile pictures for every job in one set of batched reads.
     * The picture is the creator's 'jobProfile' selection, else their 'profile' selection, as the web jobs list picks it.
     */
    private async fetchCreators(creatorIds: string[]): Promise<CreatorLookup> {
        const [users, selections] = await Promise.all([
            firestoreBatchReadService.getDocumentsByIds('users', creatorIds).catch((error: unknown) => {
                console.error('[JobsService.fetchCreators] Error: users', error);
                return new Map<string, DocumentData>();
            }),
            firestoreBatchReadService.getDocumentsByField('profileImageSetAs', 'userId', creatorIds).catch((error: unknown) => {
                console.error('[JobsService.fetchCreators] Error: profile image selections', error);
                return [];
            }),
        ]);
        const imageIdByCreator = new Map<string, string>();
        new Set(creatorIds.filter(Boolean)).forEach((creatorId) => {
            const creatorSelections = selections.filter((selection) => selection.data().userId === creatorId);
            const selection = creatorSelections.find((entry) => entry.data().setAs === 'jobProfile')
                ?? creatorSelections.find((entry) => entry.data().setAs === 'profile');
            const imageId = selection?.data().profileImageId;
            if (typeof imageId === 'string' && imageId) imageIdByCreator.set(creatorId, imageId);
        });
        const images = await firestoreBatchReadService.getDocumentsByIds('profileImages', [...imageIdByCreator.values()]).catch((error: unknown) => {
            console.error('[JobsService.fetchCreators] Error: profile images', error);
            return new Map<string, DocumentData>();
        });
        const profileImages = new Map<string, string>();
        imageIdByCreator.forEach((imageId, creatorId) => {
            const image = images.get(imageId);
            // Only the creator's own image counts, as when images were queried by the creator's userId.
            if (image?.userId === creatorId && typeof image.imageURL === 'string' && image.imageURL) profileImages.set(creatorId, image.imageURL);
        });
        return { users, profileImages };
    }

    /**
     * A company logo as a small inline image, the way the website stores it in companyDetails.logo (there is no
     * Storage folder for job logos). Kept to 256px so the listing stays far below Firestore's document size limit.
     */
    public async prepareCompanyLogo(localUri: string): Promise<string> {
        const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
        const image = await manipulateAsync(localUri, [{ resize: { width: 256 } }], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
        if (!image.base64) throw new Error('The logo could not be read.');
        return `data:image/jpeg;base64,${image.base64}`;
    }

    /** The signed-in user's identity verification status (web useProfileStore.verificationStatus). */
    public async getVerificationStatus(userId: string): Promise<string> {
        if (!userId) return 'not_started';
        try {
            const user = (await getDoc(doc(this.db, 'users', userId))).data() ?? {};
            return readString(user.identityVerificationStatus) || readString(user.verificationStatus) || 'not_started';
        } catch (error: unknown) {
            console.error('[JobsService.getVerificationStatus] Error:', error);
            return 'not_started';
        }
    }

    /** Web JobsService.toggleSaveJob: users/{uid}/savedJobs/{jobId}. */
    public async toggleSaveJob(userId: string, jobId: string, isSaving: boolean): Promise<void> {
        const saveRef = doc(this.db, 'users', userId, 'savedJobs', jobId);
        if (isSaving) await setDoc(saveRef, { jobId, savedAt: Timestamp.now() });
        else await deleteDoc(saveRef);
    }

    public async getSavedJobIds(userId: string): Promise<Set<string>> {
        if (!userId) return new Set<string>();
        try {
            const snapshot = await getDocs(collection(this.db, 'users', userId, 'savedJobs'));
            return new Set(snapshot.docs.map((savedDoc) => savedDoc.id));
        } catch (error: unknown) {
            console.error('[JobsService.getSavedJobIds] Error:', error);
            return new Set<string>();
        }
    }

    public async updateJob(jobId: string, jobData: UpdateJobInput): Promise<boolean> {
        try {
            const jobRef = doc(this.db, 'jobs', jobId);

            await updateDoc(jobRef, {
                'basic_info.title': jobData.title,
                'basic_info.description': jobData.description,
                'basic_info.type': jobData.type,
                'basic_info.updatedAt': Timestamp.now(),
                'basic_info.priceRange': jobData.priceRange,
                'basic_info.location': jobData.location,
                'details.skills': jobData.skills,
                'details.requirements': jobData.requirements,
                'details.qualifications': jobData.qualifications,
                'category_specific': jobData.category_specific
            });

            const questionsCollection = collection(jobRef, 'questions');
            const existingQuestions = await getDocs(questionsCollection);
            await Promise.all(existingQuestions.docs.map((questionDoc) => deleteDoc(questionDoc.ref)));
            await Promise.all(jobData.questions.map(async (question) => {
                await addDoc(questionsCollection, {
                    question: question.question,
                    type: question.answerType,
                    options: question.answerType !== 'input' ? question.options : []
                });
            }));

            return true;
        } catch (error) {
            console.error('[JobsService.updateJob] Error:', error);
            throw new Error('Failed to update job');
        }
    }

    public async deleteJob(jobId: string) {
        try {
            const jobRef = doc(this.db, 'jobs', jobId);
            const jobDoc = await getDoc(jobRef);
            if (!jobDoc.exists()) return false;
            const categoryName = jobDoc.data()?.basic_info?.category;
            const questionsSnapshot = await getDocs(collection(jobRef, 'questions'));
            await Promise.all(questionsSnapshot.docs.map((questionDoc) => deleteDoc(questionDoc.ref)));
            await deleteDoc(jobRef);
            if (categoryName) await this.updateCategoryCount(categoryName, false);
            return true;
        } catch (error) {
            console.error('[JobsService.deleteJob] Error:', error);
            throw new Error('Failed to delete job');
        }
    }

    public async updateCategoryCount(categoryName: string, increment: boolean) {
        try {
            const categoriesRef = collection(this.db, 'jobCategories');
            const categorySnapshot = await getDocs(query(categoriesRef, where('name', '==', categoryName)));

            if (categorySnapshot.empty) {
                if (!increment) return;
                await addDoc(categoriesRef, {
                    name: categoryName,
                    count: 1,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
            } else {
                const categoryDoc = categorySnapshot.docs[0];
                const currentCount = categoryDoc.data().count || 0;
                if (!increment && currentCount <= 0) return;
                await updateDoc(categoryDoc.ref, {
                    count: increment ? currentCount + 1 : currentCount - 1,
                    updatedAt: Timestamp.now()
                });
            }
        } catch (error) {
            console.error('[JobsService.updateCategoryCount] Error:', error);
        }
    }
}
