// lib/profile/abouts/basicInformation/BasicInformationService.ts

import { db } from '@/lib/firebaseConfig';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { usernameService } from '@/lib/services/UsernameService';

type UpdateBasicInfoData = {
    firstName: string;
    lastName: string;
    userName: string;
    country: string;
};

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
        // Any case counts as taken ("Ron" = "ron"), and reserved former names stay with their owner.
        return usernameService.isAvailable(userName, currentUserId);
    }

    async updateBasicInfo(userId: string, data: UpdateBasicInfoData) {
        // Reserves the username in a transaction, so two people can't take the same name at once.
        await usernameService.claim(userId, data.userName);

        const userRef = doc(this.db, 'users', userId);
        await updateDoc(userRef, {
            ...data,
            updatedAt: Timestamp.now()
        });

        return { success: true };
    }
}

export const basicInformationService = BasicInformationService.getInstance();
