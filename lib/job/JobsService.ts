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

    public async createJob(jobData: any) {
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
    
            if (jobData.questions?.length > 0) {
                const questionsCollection = collection(jobRef, 'questions');
                await Promise.all(
                    jobData.questions.map((question: any) => 
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
        } catch (error) {
            console.error('Detailed error in createJob:', error);
            throw new Error(`Failed to create job: ${error.message}`);
        }
    }
    

    public async fetchJobs() {
        try {
            const jobsQuery = query(
                collection(this.db, 'jobs'),
                orderBy('basic_info.createdAt', 'desc')
            );
    
            const jobsSnapshot = await getDocs(jobsQuery);
            const jobs = await Promise.all(jobsSnapshot.docs.map(async (docSnapshot) => {
                const data = docSnapshot.data();
                const userRef = doc(this.db, 'users', data.basic_info.userId);
                const userDoc = await getDoc(userRef);
                const userData = userDoc.data();
    
                // Fetch questions from subcollection
                const questionsSnapshot = await getDocs(collection(docSnapshot.ref, 'questions'));
                const questions = questionsSnapshot.docs.map(qDoc => ({
                    id: qDoc.id,
                    ...qDoc.data()
                }));
    
                // Fetch profile images
                const profileImagesQuery = query(
                    collection(this.db, 'profileImages'),
                    where('userId', '==', data.basic_info.userId)
                );
                const profileSetAsQuery = query(
                    collection(this.db, 'profileImageSetAs'),
                    where('userId', '==', data.basic_info.userId)
                );
    
                const [profileImagesSnapshot, setAsSnapshot] = await Promise.all([
                    getDocs(profileImagesQuery),
                    getDocs(profileSetAsQuery)
                ]);
    
                // Get profile image URL with priority
                let profileImageUrl = '/default-avatar.png';
                const jobProfileSetAs = setAsSnapshot.docs.find(doc => doc.data().setAs === 'jobProfile');
                const regularProfileSetAs = setAsSnapshot.docs.find(doc => doc.data().setAs === 'profile');
    
                if (jobProfileSetAs) {
                    const matchingImage = profileImagesSnapshot.docs.find(img => img.id === jobProfileSetAs.data().profileImageId);
                    profileImageUrl = matchingImage?.data()?.imageURL || profileImageUrl;
                } else if (regularProfileSetAs) {
                    const matchingImage = profileImagesSnapshot.docs.find(img => img.id === regularProfileSetAs.data().profileImageId);
                    profileImageUrl = matchingImage?.data()?.imageURL || profileImageUrl;
                }
    
                return {
                    id: docSnapshot.id,
                    basic_info: data.basic_info,
                    details: data.details,
                    category_specific: data.category_specific,
                    questions,
                    creator: {
                        name: userData ? `${userData.firstName} ${userData.lastName}` : 'Anonymous',
                        username: userData?.userName || 'anonymous',
                        profileImage: profileImageUrl,
                        email: userData?.email
                    }
                };
            }));
    
            return jobs;
        } catch (error) {
            console.error('Error in fetchJobs:', error);
            throw new Error('Failed to fetch jobs');
        }
    }
    
    public async updateJob(jobId: string, jobData: any) {
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
            await Promise.all(jobData.questions.map(async (question: any) => {
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
