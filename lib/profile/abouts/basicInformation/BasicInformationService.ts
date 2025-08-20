// lib/profile/abouts/basicInformation/BasicInformationService.ts

import { db } from '@/lib/firebaseConfig';
import { doc, updateDoc, query, collection, where, getDocs, Timestamp } from 'firebase/firestore';

interface UpdateBasicInfoData {
    firstName: string;
    lastName: string;
    userName: string;
    country: string;
}

export class BasicInformationService {
    private static instance: BasicInformationService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): BasicInformationService {
        if (!BasicInformationService.instance) {
            BasicInformationService.instance = new BasicInformationService();
        }
        return BasicInformationService.instance;
    }

    async checkUsernameAvailability(userName: string, currentUserId: string): Promise<boolean> {
        const usersRef = collection(this.db, 'users');
        const q = query(usersRef, where('userName', '==', userName));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.empty || querySnapshot.docs[0].id === currentUserId;
    }

    async updateBasicInfo(userId: string, data: UpdateBasicInfoData) {
        const userRef = doc(this.db, 'users', userId);
        
        await updateDoc(userRef, {
            ...data,
            updatedAt: Timestamp.now()
        });

        return { success: true };
    }
}

export const basicInformationService = BasicInformationService.getInstance();
