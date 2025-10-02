import { db } from '@/lib/firebaseConfig';
import { 
    collection, 
    addDoc, 
    Timestamp,
    query,
    where,
    getDocs,
    Firestore,
    DocumentData,
    QuerySnapshot
} from 'firebase/firestore';

export class JobApplicationService {
    private static instance: JobApplicationService;
    private readonly db: Firestore;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): JobApplicationService {
        if (!JobApplicationService.instance) {
            JobApplicationService.instance = new JobApplicationService();
        }
        return JobApplicationService.instance;
    }

    public async createApplication(applicationData: any) {
        try {
            // Build details object without undefined fields
            const details: Record<string, any> = {};
            if (applicationData.coverLetter) details.coverLetter = applicationData.coverLetter;
            if (applicationData.resumeUrl) details.resumeUrl = applicationData.resumeUrl;
            if (applicationData.portfolioLink !== undefined) details.portfolioLink = applicationData.portfolioLink || null;

            const applicationRef = await addDoc(collection(this.db, 'jobApplications'), {
                basic_info: {
                    userId: applicationData.userId,
                    jobId: applicationData.jobId,
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    jobType: applicationData.jobType
                },
                details,
                answers: applicationData.answers || [],
                category_specific: applicationData.category_specific || {}
            });

            return applicationRef.id;
        } catch (error) {
            console.error('Error in createApplication:', error);
            throw new Error('Failed to create application');
        }
    }

    public async fetchApplications(jobId?: string | null, userId?: string | null) {
        try {
            let applicationsQuery = query(collection(this.db, 'jobApplications'));

            if (jobId) {
                applicationsQuery = query(
                    applicationsQuery,
                    where('basic_info.jobId', '==', jobId)
                );
            }

            if (userId) {
                applicationsQuery = query(
                    applicationsQuery,
                    where('basic_info.userId', '==', userId)
                );
            }

            const applicationsSnapshot = await getDocs(applicationsQuery);
            
            return applicationsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error in fetchApplications:', error);
            throw new Error('Failed to fetch applications');
        }
    }
}
