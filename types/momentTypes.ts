import { Timestamp } from 'firebase/firestore';

export type Moment = {
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
};

export type MomentUploadResponse = {
    success: boolean;
    momentId: string;
};

export type MomentsFetchResponse = {
    moments: Moment[];
};
