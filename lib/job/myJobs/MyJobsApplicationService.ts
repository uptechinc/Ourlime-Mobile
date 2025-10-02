import { db } from '@/lib/firebaseConfig';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    getDoc, 
    doc,
    orderBy,
    updateDoc,
    Firestore,
    Timestamp, 
    deleteDoc
} from 'firebase/firestore';


export class MyJobsApplicationService {
    private static instance: MyJobsApplicationService;
    private readonly db: Firestore;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): MyJobsApplicationService {
        if (!MyJobsApplicationService.instance) {
            MyJobsApplicationService.instance = new MyJobsApplicationService();
        }
        return MyJobsApplicationService.instance;
    }

    public async fetchApplicationsForJob(jobId: string) {
        try {
            const applicationsQuery = query(
                collection(this.db, 'jobApplications'),
                where('basic_info.jobId', '==', jobId)
            );
    
            const snapshot = await getDocs(applicationsQuery);
            console.log("Applications found:", snapshot.docs.length);
            
            const applications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
    
            return applications;
        } catch (error) {
            console.error('Error details:', error);
            throw new Error('Failed to fetch applications');
        }
    }
    
    public async updateApplicationStatus(applicationId: string, status: string) {
        try {
            const applicationRef = doc(this.db, 'jobApplications', applicationId);
            await updateDoc(applicationRef, {
                'basic_info.status': status,
                'basic_info.updatedAt': Timestamp.now()
            });
            return true;
        } catch (error) {
            console.error('Error updating application status:', error);
            throw new Error('Failed to update application status');
        }
    }
    
    
    public async deleteApplicationsForJob(applicationId: string) {
        try {
            const applicationRef = doc(this.db, 'jobApplications', applicationId);
            await deleteDoc(applicationRef);
            return true;
        } catch (error) {
            console.error('Error deleting application:', error);
            throw new Error('Failed to delete application');
        }
    }
    
    public async getApplicationById(applicationId: string) {
        try {
            const applicationRef = doc(this.db, 'jobApplications', applicationId);
            const applicationDoc = await getDoc(applicationRef);
            
            if (!applicationDoc.exists()) {
                throw new Error('Application not found');
            }
    
            return {
                id: applicationDoc.id,
                ...applicationDoc.data()
            };
        } catch (error) {
            console.error('Error fetching application:', error);
            throw new Error('Failed to fetch application');
        }
    }
    
}
