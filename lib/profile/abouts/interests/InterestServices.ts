import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';

export class InterestServices {
    private static instance: InterestServices;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): InterestServices {
        if (!InterestServices.instance) {
            InterestServices.instance = new InterestServices();
        }
        return InterestServices.instance;
    }

    public async fetchInterestsAndSkills(userId: string) {
        try {
            const aboutRef = collection(this.db, 'users', userId, 'about');
            
            const interestsQuery = query(aboutRef, where('type', '==', 'interests'));
            const skillsQuery = query(aboutRef, where('type', '==', 'skills'));

            const [interestsSnapshot, skillsSnapshot] = await Promise.all([
                getDocs(interestsQuery),
                getDocs(skillsQuery)
            ]);

            const interests = interestsSnapshot.docs.map(doc => ({
                id: doc.id,
                value: doc.data().value
            }));

            const skills = skillsSnapshot.docs.map(doc => ({
                id: doc.id,
                value: doc.data().value
            }));

            return { interests, skills };
        } catch (error) {
            throw new Error('Failed to fetch interests and skills');
        }
    }

    public async addInterestOrSkill(userId: string, type: 'interests' | 'skills', value: string) {
        try {
            const docRef = await addDoc(collection(this.db, 'users', userId, 'about'), {
                type,
                value,
                createdAt: new Date()
            });

            return {
                id: docRef.id,
                value
            };
        } catch (error) {
            throw new Error(`Failed to add ${type}`);
        }
    }

    public async updateInterestOrSkill(userId: string, id: string, value: string) {
        try {
            const docRef = doc(this.db, 'users', userId, 'about', id);
            await updateDoc(docRef, {
                value,
                updatedAt: new Date()
            });

            return {
                id,
                value
            };
        } catch (error) {
            throw new Error('Failed to update item');
        }
    }

    public async deleteInterestOrSkill(userId: string, id: string) {
        try {
            const docRef = doc(this.db, 'users', userId, 'about', id);
            await deleteDoc(docRef);
            return true;
        } catch (error) {
            throw new Error('Failed to delete item');
        }
    }
}
