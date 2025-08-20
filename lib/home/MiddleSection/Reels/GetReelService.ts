import { db } from '@/lib/firebaseConfig';
import { 
    collection, 
    query, 
    orderBy, 
    getDocs,
    getDoc,
    doc,
    where 
} from 'firebase/firestore';

export class ReelService {
    private static instance: ReelService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): ReelService {
        if (!ReelService.instance) {
            ReelService.instance = new ReelService();
        }
        return ReelService.instance;
    }

    // Method to get user details
    async getUserDetails(userId: string) {
        try {
            const userDocRef = doc(this.db, 'users', userId);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                return {
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    userName: userData.userName || '',
                    profileImage: userData.profileImage || ''
                };
            } else {
                return {
                    firstName: '',
                    lastName: '',
                    userName: 'Unknown User',
                    profileImage: ''
                };
            }
        } catch (error) {
            console.error('Error fetching user details:', error);
            return {
                firstName: '',
                lastName: '',
                userName: 'Unknown User',
                profileImage: ''
            };
        }
    }

    // Get reels by category
    async getReelsByCategory(category: string) {
        try {
            // If "For You" category or no category is specified, get all reels
            if (!category || category === 'For You') {
                return this.getReels();
            }
            
            // Create a query that filters by category
            const reelsRef = collection(this.db, 'reels');
            let q;
            
            // Apply different queries based on category
            if (category === 'Trending') {
                // For trending, we'll sort by views or likes
                q = query(reelsRef, orderBy('views', 'desc'), orderBy('createdAt', 'desc'));
            } else {
                // Filter by the specific category
                q = query(
                    reelsRef, 
                    where('category', '==', category),
                    orderBy('createdAt', 'desc')
                );
            }
            
            const snapshot = await getDocs(q);
            
            const reelsWithUserData = await Promise.all(
                snapshot.docs.map(async doc => {
                    const reelData = doc.data() as { userId: string; [key: string]: any };
                    const userDetails = await this.getUserDetails(reelData.userId);                
                    const enrichedReel = {
                        id: doc.id,
                        ...reelData,
                        user: userDetails
                    };
                    return enrichedReel;
                })
            );
            
            return reelsWithUserData;
        } catch (error) {
            console.error('Error getting reels by category:', error);
            return [];
        }
    }

    async getReels() {
        try {
            const reelsRef = collection(this.db, 'reels');
            const q = query(reelsRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
                    
            const reelsWithUserData = await Promise.all(
                snapshot.docs.map(async doc => {
                    const reelData = doc.data() as { userId: string; [key: string]: any };
                    const userDetails = await this.getUserDetails(reelData.userId);                
                    const enrichedReel = {
                        id: doc.id,
                        ...reelData,
                        user: userDetails
                    };
                    return enrichedReel;
                })
            );
            return reelsWithUserData;
        } catch (error) {
            console.error('Error getting reels:', error);
            return [];
        }
    }
}

export const reelService = ReelService.getInstance();
