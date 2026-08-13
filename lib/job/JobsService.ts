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
    orderBy,
    Firestore,
    limit,
    Timestamp
} from 'firebase/firestore';

export type JobRecord = {
    id: string;
    basic_info: {
        type: string;
        title: string;
        description: string;
        userId: string;
        location: { type?: string; city?: string; country?: string; address?: string };
        priceRange: { from: number; to: number };
        createdAt?: { seconds: number };
        category?: string;
    };
    category?: string;
    details: { skills: string[]; requirements?: string[]; qualifications?: string[] };
    category_specific: Record<string, unknown> & {
        name?: string;
        type?: string;
        industry?: string;
        size?: string | number;
        benefits?: string[];
        urgency?: 'low' | 'medium' | 'high';
        duration?: string;
        complexity?: string;
        timeline?: string;
    };
    questions?: { id: string; question?: string; type?: string; options?: string[] }[];
    creator?: { name: string; username: string; profileImage: string; email?: string };
};

export type JobQuestionInput = {
    question: string;
    answerType: 'input' | 'single' | 'multiple' | 'checkbox' | 'dropdown';
    options: string[];
};

export type CreateJobInput = {
    jobTitle: string;
    jobDescription: string;
    jobCategory: string;
    category?: string;
    userId: string;
    priceRange: { from: number | string; to: number | string };
    location: JobRecord['basic_info']['location'];
    skills?: string[];
    requirements?: string[];
    qualifications?: string[];
    category_specific?: JobRecord['category_specific'];
    questions?: JobQuestionInput[];
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

    public async createJob(jobData: CreateJobInput): Promise<string> {
        try {
            console.log('Creating job with data:', jobData);
            console.log('Job category being saved:', jobData.jobCategory);
            console.log('Selected topic/category being saved:', jobData.category);
            
            const jobRef = await addDoc(collection(this.db, 'jobs'), {
                basic_info: {
                    title: jobData.jobTitle,
                    description: jobData.jobDescription,
                    type: jobData.jobCategory,
                    category: jobData.category,
                    status: 'active',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    userId: jobData.userId,
                    priceRange: {
                        from: Number(jobData.priceRange.from),
                        to: Number(jobData.priceRange.to)
                    },
                    location: jobData.location
                },
                details: {
                    skills: jobData.skills || [],
                    requirements: jobData.requirements || [],
                    qualifications: jobData.qualifications || []
                },
                category_specific: jobData.category_specific || {}
            });
    
            const questions = jobData.questions ?? [];
            if (questions.length > 0) {
                const questionsCollection = collection(jobRef, 'questions');
                await Promise.all(
                    questions.map((question) =>
                        addDoc(questionsCollection, {
                            question: question.question,
                            type: question.answerType,
                            options: question.answerType !== 'input' ? question.options : []
                        })
                    )
                );
            }
    
            console.log('Job created successfully with ID:', jobRef.id);
            
            // Update the category count using the user-selected category
            if (jobData.category) {
                console.log('Updating category count for selected category:', jobData.category);
                await this.updateCategoryCount(jobData.category, true);
            } else {
                console.warn('No category provided for category count update');
            }
            
            return jobRef.id;
        } catch (error: unknown) {
            console.error('Detailed error in createJob:', error);
            throw new Error(`Failed to create job: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    

    public async fetchJobs(maxResults = 20): Promise<JobRecord[]> {
        try {
            const jobsCollection = collection(this.db, 'jobs');
            const resultLimit = limit(Math.min(40, Math.max(1, maxResults)));
            const orderedJobsSnapshot = await getDocs(query(
                jobsCollection,
                orderBy('basic_info.createdAt', 'desc'),
                resultLimit,
            )).catch((orderedQueryError: unknown) => {
                console.warn('[JobsService.fetchJobs] Ordered query failed; using unordered compatibility query.', orderedQueryError);
                return null;
            });
            const jobsSnapshot = orderedJobsSnapshot && !orderedJobsSnapshot.empty
                ? orderedJobsSnapshot
                : await getDocs(query(jobsCollection, resultLimit));
            const jobs = await Promise.all(jobsSnapshot.docs.map(async (docSnapshot) => {
                const data = docSnapshot.data();
                const basicInfo = data.basic_info && typeof data.basic_info === 'object' ? data.basic_info : {};
                const userId = typeof basicInfo.userId === 'string' ? basicInfo.userId : '';
                const userDoc = userId ? await getDoc(doc(this.db, 'users', userId)).catch(() => null) : null;
                const userData = userDoc?.data();
    
                // Fetch questions from subcollection
                const questionsSnapshot = await getDocs(collection(docSnapshot.ref, 'questions')).catch(() => null);
                const questions = (questionsSnapshot?.docs ?? []).map(qDoc => ({
                    id: qDoc.id,
                    ...qDoc.data()
                }));
    
                // Fetch profile images
                const profileImagesQuery = query(
                    collection(this.db, 'profileImages'),
                    where('userId', '==', userId)
                );
                const profileSetAsQuery = query(
                    collection(this.db, 'profileImageSetAs'),
                    where('userId', '==', userId)
                );
    
                const [profileImagesSnapshot, setAsSnapshot] = await Promise.all([
                    getDocs(profileImagesQuery),
                    getDocs(profileSetAsQuery)
                ]).catch(() => [null, null] as const);
    
                // Get profile image URL with priority
                let profileImageUrl = '';
                const jobProfileSetAs = setAsSnapshot?.docs.find(doc => doc.data().setAs === 'jobProfile');
                const regularProfileSetAs = setAsSnapshot?.docs.find(doc => doc.data().setAs === 'profile');
    
                if (jobProfileSetAs) {
                    const matchingImage = profileImagesSnapshot?.docs.find(img => img.id === jobProfileSetAs.data().profileImageId);
                    profileImageUrl = matchingImage?.data()?.imageURL || profileImageUrl;
                } else if (regularProfileSetAs) {
                    const matchingImage = profileImagesSnapshot?.docs.find(img => img.id === regularProfileSetAs.data().profileImageId);
                    profileImageUrl = matchingImage?.data()?.imageURL || profileImageUrl;
                }
    
                return {
                    id: docSnapshot.id,
                    basic_info: {
                        type: typeof basicInfo.type === 'string' ? basicInfo.type : 'Job',
                        title: typeof basicInfo.title === 'string' ? basicInfo.title : 'Untitled opportunity',
                        description: typeof basicInfo.description === 'string' ? basicInfo.description : '',
                        userId,
                        location: basicInfo.location && typeof basicInfo.location === 'object' ? basicInfo.location : {},
                        priceRange: basicInfo.priceRange && typeof basicInfo.priceRange === 'object'
                            ? {
                                from: typeof basicInfo.priceRange.from === 'number' ? basicInfo.priceRange.from : 0,
                                to: typeof basicInfo.priceRange.to === 'number' ? basicInfo.priceRange.to : 0,
                            }
                            : { from: 0, to: 0 },
                        createdAt: basicInfo.createdAt,
                        category: typeof basicInfo.category === 'string' ? basicInfo.category : undefined,
                    },
                    details: data.details && typeof data.details === 'object'
                        ? { ...data.details, skills: Array.isArray(data.details.skills) ? data.details.skills : [] }
                        : { skills: [] },
                    category_specific: data.category_specific && typeof data.category_specific === 'object' ? data.category_specific : {},
                    questions,
                    creator: {
                        name: userData ? `${userData.firstName} ${userData.lastName}` : 'Anonymous',
                        username: userData?.userName || 'anonymous',
                        profileImage: profileImageUrl,
                        email: userData?.email
                    }
                } as JobRecord;
            }));
    
            return jobs;
        } catch (error) {
            console.error('Error in fetchJobs:', error);
            throw new Error('Failed to fetch jobs');
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

            // Update questions
            const questionsCollection = collection(jobRef, 'questions');
            const existingQuestions = await getDocs(questionsCollection);
            
            // Delete existing questions
            await Promise.all(existingQuestions.docs.map(doc => deleteDoc(doc.ref)));
            
            // Add updated questions
            await Promise.all(jobData.questions.map(async (question) => {
                await addDoc(questionsCollection, {
                    question: question.question,
                    type: question.answerType,
                    options: question.answerType !== 'input' ? question.options : []
                });
            }));

            return true;
        } catch (error) {
            console.error('Error in updateJob:', error);
            throw new Error('Failed to update job');
        }
    }

    public async deleteJob(jobId: string) {
        try {
            const jobRef = doc(this.db, 'jobs', jobId);
            
            // Get the job document to retrieve its category before deletion
            const jobDoc = await getDoc(jobRef);
            let categoryName = null;
            
            if (jobDoc.exists()) {
                // Get the job's category (the user-selected one, not the job type)
                categoryName = jobDoc.data()?.basic_info?.category;
                console.log('Found job category for deletion:', categoryName);
                
                // Delete questions subcollection
                const questionsCollection = collection(jobRef, 'questions');
                const questionsSnapshot = await getDocs(questionsCollection);
                await Promise.all(questionsSnapshot.docs.map(doc => deleteDoc(doc.ref)));
                
                // Delete main job document
                await deleteDoc(jobRef);
                console.log('Job document deleted successfully');
                
                // Decrement the category count if a category was found
                if (categoryName) {
                    console.log('Decrementing count for category:', categoryName);
                    await this.updateCategoryCount(categoryName, false);
                }
                
                return true;
            } else {
                console.warn('Job not found for deletion:', jobId);
                return false;
            }
        } catch (error) {
            console.error('Error in deleteJob:', error);
            throw new Error('Failed to delete job');
        }
    }

    public async updateCategoryCount(categoryName: string, increment: boolean) {
        try {
            console.log(`${increment ? 'Incrementing' : 'Decrementing'} count for category:`, categoryName);
            
            const categoriesRef = collection(this.db, 'jobCategories');
            const categoryQuery = query(categoriesRef, where('name', '==', categoryName));
            const categorySnapshot = await getDocs(categoryQuery);
            
            if (categorySnapshot.empty) {
                // Create new category if it doesn't exist
                console.log('Category does not exist, creating new:', categoryName);
                await addDoc(categoriesRef, {
                    name: categoryName,
                    count: 1,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
                console.log('New category created:', categoryName);
            } else {
                // Update existing category count
                const categoryDoc = categorySnapshot.docs[0];
                const currentCount = categoryDoc.data().count || 0;
                const newCount = increment 
                    ? currentCount + 1 
                    : Math.max(currentCount - 1, 0);
                
                console.log(`Updating category ${categoryName} count: ${currentCount} → ${newCount}`);
                
                await updateDoc(categoryDoc.ref, {
                    count: newCount,
                    updatedAt: Timestamp.now()
                });
                console.log('Category count updated successfully');
            }
        } catch (error) {
            console.error('Error updating category count:', error);
        }
    }
}
