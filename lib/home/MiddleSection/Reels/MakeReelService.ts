import { db } from '@/lib/firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface ReelResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export class MakeReelService {
    private static instance: MakeReelService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): MakeReelService {
        if (!MakeReelService.instance) {
            MakeReelService.instance = new MakeReelService();
        }
        return MakeReelService.instance;
    }

    async createReel(reelData: any): Promise<ReelResponse> {
        try {
            const reelRef = await addDoc(collection(this.db, 'reels'), {
                ...reelData,
                createdAt: serverTimestamp(),
                likes: 0,
                shares: 0,
                views: 0
            });

            return {
                success: true,
                data: { reelId: reelRef.id }
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to create reel'
            };
        }
    }
}

export const makeReelService = MakeReelService.getInstance();
