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
} from 'firebase/firestore';

export class MyJobsManageJobsService {
	private static instance: MyJobsManageJobsService;
	private readonly db: Firestore;

	private constructor() {
		this.db = db;
	}

	public static getInstance(): MyJobsManageJobsService {
		if (!MyJobsManageJobsService.instance) {
			MyJobsManageJobsService.instance = new MyJobsManageJobsService();
		}
		return MyJobsManageJobsService.instance;
	}

    public async fetchUserJobsWithQuestions(userId: string) {
        try {
            const jobsQuery = query(
                collection(this.db, 'jobs'),
                where('basic_info.userId', '==', userId),
                orderBy('basic_info.createdAt', 'desc')
            );
    
            const jobsSnapshot = await getDocs(jobsQuery);
            
            const jobsWithQuestionsPromises = jobsSnapshot.docs.map(async (jobDoc) => {
                // Get questions
                const questionsSnapshot = await getDocs(
                    collection(this.db, 'jobs', jobDoc.id, 'questions')
                );
    
                const questions = questionsSnapshot.docs.map(qDoc => ({
                    id: qDoc.id,
                    ...qDoc.data()
                }));
    
                // Get applications
                const applicationsQuery = query(
                    collection(this.db, 'jobApplications'),
                    where('basic_info.jobId', '==', jobDoc.id)
                );
    
                const applicationsSnapshot = await getDocs(applicationsQuery);
                console.log(`Found ${applicationsSnapshot.docs.length} applications for job ${jobDoc.id}`);
    
                const applicationsPromises = applicationsSnapshot.docs.map(async (appDoc) => {
                    const applicationData = appDoc.data();
                    const applicantId = applicationData.basic_info.userId;
    
                    // Get user data
                    const userDocRef = doc(this.db, 'users', applicantId);
                    const userDoc = await getDoc(userDocRef);
                    const userData = userDoc.data();
                    const userName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || userData?.userName || 'Anonymous';
    
                    // Get profile image
                    const profileSetAsRef = collection(this.db, 'profileImageSetAs');
                    const profileSetAsQuery = query(profileSetAsRef, where('userId', '==', applicantId));
                    const profileSetAsSnapshot = await getDocs(profileSetAsQuery);
    
                    let profileImageId = '';
                    let profileImage = '';
    
                    // Find the appropriate profile image
                    for (const doc of profileSetAsSnapshot.docs) {
                        const data = doc.data();
                        if (data.setAs === 'jobApplyProfile') {
                            profileImageId = data.profileImageId;
                            break;
                        } else if (data.setAs === 'jobProfile') {
                            profileImageId = data.profileImageId;
                        } else if (data.setAs === 'profile' && !profileImageId) {
                            profileImageId = data.profileImageId;
                        }
                    }
    
                    if (profileImageId) {
                        const imageRef = doc(this.db, 'profileImages', profileImageId);
                        const imageDoc = await getDoc(imageRef);
                        if (imageDoc.exists()) {
                            profileImage = imageDoc.data().imageURL;
                            console.log('Profile image URL found:', profileImage);
                        }
                    }
    
                    // Get education and work experience
                    const [educationSnapshot, workExperienceSnapshot] = await Promise.all([
                        getDocs(collection(this.db, 'users', applicantId, 'education')),
                        getDocs(collection(this.db, 'users', applicantId, 'workExperience'))
                    ]);
    
                    const education = educationSnapshot.docs.map(edu => ({
                        id: edu.id,
                        ...edu.data()
                    }));
    
                    const workExperience = workExperienceSnapshot.docs.map(work => ({
                        id: work.id,
                        ...work.data()
                    }));
    
                    return {
                        id: appDoc.id,
                        ...applicationData,
                        applicant: {
                            userId: applicantId,
                            name: userName,
                            email: userData?.email,
                            imageUrl: profileImage,
                            education,
                            workExperience
                        }
                    };
                });
    
                const applications = await Promise.all(applicationsPromises);
    
                return {
                    id: jobDoc.id,
                    ...jobDoc.data(),
                    questions,
                    applications
                };
            });
    
            const jobsWithQuestions = await Promise.all(jobsWithQuestionsPromises);
            console.log("Total jobs fetched:", jobsWithQuestions.length);
            
            return jobsWithQuestions;
        } catch (error) {
            console.error('Error in fetchUserJobsWithQuestions:', error);
            throw new Error('Failed to fetch user jobs with questions');
        }
    }
    
	public async updateJobStatus(jobId: string, status: string) {
		try {
			const jobRef = doc(this.db, 'jobs', jobId);
			await updateDoc(jobRef, {
				'basic_info.status': status,
				'basic_info.updatedAt': Timestamp.now(),
			});
			return true;
		} catch (error) {
			console.error('Error updating job status:', error);
			throw new Error('Failed to update job status');
		}
	}

    public async getJobById(jobId: string) {
        try {
            const jobRef = doc(this.db, 'jobs', jobId);
            const jobDoc = await getDoc(jobRef);
            
            if (!jobDoc.exists()) {
                throw new Error('Job not found');
            }
    
            return {
                id: jobDoc.id,
                ...jobDoc.data()
            };
        } catch (error) {
            console.error('Error fetching job:', error);
            throw new Error('Failed to fetch job');
        }
    }
    
}
