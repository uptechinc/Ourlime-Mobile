import { db } from '@/lib/firebaseConfig';
import { collection, getDocs, query } from 'firebase/firestore';

export class CommunityService {
    private static instance: CommunityService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): CommunityService {
        if (!CommunityService.instance) {
            CommunityService.instance = new CommunityService();
        }
        return CommunityService.instance;
    }

    public async getTopCommunities() {
        try {
            const membershipRef = collection(this.db, "communityVariantMembership");
            const membershipSnapshot = await getDocs(membershipRef);

            const membershipCounts = membershipSnapshot.docs.reduce((acc, doc) => {
                const data = doc.data();
                const communityId = data.communityVariantId;

                if (communityId) {
                    acc[communityId] = (acc[communityId] || 0) + 1;
                }
                return acc;
            }, {} as Record<string, number>);

            const communitiesRef = collection(this.db, "communityVariant");
            const communitySnapshot = await getDocs(communitiesRef);

            const communities = communitySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                membershipCount: membershipCounts[doc.id] || 0,
            }));

            return communities
                .sort((a, b) => b.membershipCount - a.membershipCount)
                .slice(0, 4);
        } catch (error) {
            console.error('Error in getTopCommunities:', error);
            throw error;
        }
    }
}
