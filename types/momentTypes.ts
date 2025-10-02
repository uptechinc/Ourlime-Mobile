import { Timestamp } from 'firebase/firestore';

export interface Moment {
    id: string;
    videoUrl: string;
    userId: string;
    createdAt: Timestamp;
    expiresAt: Timestamp;
    storageRef: string;
    views: number;
    likes: number;
    user: {
        id: string;
        userName: string;
        firstName: string;
        lastName: string;
        profileImage: string | null;
    };
    timeRemaining: string;
}

export interface MomentUploadResponse {
    success: boolean;
    momentId: string;
}

export interface MomentsFetchResponse {
    moments: Moment[];
}
