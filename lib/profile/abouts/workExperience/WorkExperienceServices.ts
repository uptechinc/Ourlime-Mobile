import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';

export class WorkExperienceServices {
    private static instance: WorkExperienceServices;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): WorkExperienceServices {
        if (!WorkExperienceServices.instance) {
            WorkExperienceServices.instance = new WorkExperienceServices();
        }
        return WorkExperienceServices.instance;
    }

    public async fetchWorkExperience(userId: string) {
        try {
            const workExperienceRef = collection(this.db, 'users', userId, 'workExperience');
            const workExperienceQuery = query(workExperienceRef, orderBy('startDate', 'desc'));
            const snapshot = await getDocs(workExperienceQuery);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            throw new Error('Failed to fetch work experience');
        }
    }

    public async addWorkExperience(userId: string, workData: {
        role: string;
        company: string;
        startDate: Date;
        endDate?: Date;
        current: boolean;
        description: string;
    }) {
        try {
            const docRef = await addDoc(
                collection(this.db, 'users', userId, 'workExperience'),
                {
                    ...workData,
                    createdAt: new Date()
                }
            );

            return {
                id: docRef.id,
                ...workData
            };
        } catch (error) {
            throw new Error('Failed to add work experience');
        }
    }

    public async updateWorkExperience(userId: string, id: string, workData: {
        role?: string;
        company?: string;
        startDate?: Date;
        endDate?: Date;
        current?: boolean;
        description?: string;
    }) {
        try {
            const docRef = doc(this.db, 'users', userId, 'workExperience', id);
            await updateDoc(docRef, {
                ...workData,
                updatedAt: new Date()
            });

            return {
                id,
                ...workData
            };
        } catch (error) {
            throw new Error('Failed to update work experience');
        }
    }

    public async deleteWorkExperience(userId: string, id: string) {
        try {
            const docRef = doc(this.db, 'users', userId, 'workExperience', id);
            await deleteDoc(docRef);
            return true;
        } catch (error) {
            throw new Error('Failed to delete work experience');
        }
    }
}
