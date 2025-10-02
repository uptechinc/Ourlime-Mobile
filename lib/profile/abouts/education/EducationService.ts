import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';

export class EducationService {
    private static instance: EducationService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): EducationService {
        if (!EducationService.instance) {
            EducationService.instance = new EducationService();
        }
        return EducationService.instance;
    }

    public async fetchEducation(userId: string) {
        try {
            const educationRef = collection(this.db, 'users', userId, 'education');
            const educationQuery = query(educationRef, orderBy('startDate', 'desc'));
            const snapshot = await getDocs(educationQuery);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            throw new Error('Failed to fetch education');
        }
    }

    public async addEducation(userId: string, educationData: {
        degree: string;
        school: string;
        startDate: Date;
        endDate?: Date;
        current: boolean;
        description: string;
    }) {
        try {
            const docRef = await addDoc(
                collection(this.db, 'users', userId, 'education'),
                {
                    ...educationData,
                    createdAt: new Date()
                }
            );

            return {
                id: docRef.id,
                ...educationData
            };
        } catch (error) {
            throw new Error('Failed to add education');
        }
    }

    public async updateEducation(userId: string, id: string, educationData: {
        degree?: string;
        school?: string;
        startDate?: Date;
        endDate?: Date;
        current?: boolean;
        description?: string;
    }) {
        try {
            const docRef = doc(this.db, 'users', userId, 'education', id);
            await updateDoc(docRef, {
                ...educationData,
                updatedAt: new Date()
            });

            return {
                id,
                ...educationData
            };
        } catch (error) {
            throw new Error('Failed to update education');
        }
    }

    public async deleteEducation(userId: string, id: string) {
        try {
            const docRef = doc(this.db, 'users', userId, 'education', id);
            await deleteDoc(docRef);
            return true;
        } catch (error) {
            throw new Error('Failed to delete education');
        }
    }
}
