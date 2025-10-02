import { collection, query, orderBy, where, getDocs, addDoc, doc, getDoc, deleteDoc, Timestamp, DocumentData } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebaseConfig';
import { Moment } from '@/types/momentTypes';

export class MomentsService {
    private static instance: MomentsService;
    private readonly EXPIRATION_HOURS = 24;
    private readonly db;
    private readonly storage;

    private constructor() {
        this.db = db;
        this.storage = storage;
    }

    public static getInstance(): MomentsService {
        if (!MomentsService.instance) {
            MomentsService.instance = new MomentsService();
        }
        return MomentsService.instance;
    }

    public async uploadMoment(file: File, userId: string) {
        const timestamp = Date.now();
        const filename = `${timestamp}_${file.name}`;
        const storageRef = ref(storage, `moments/${userId}/${filename}`);
        
        const uploadResult = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(uploadResult.ref);
        
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + this.EXPIRATION_HOURS);
        
        return addDoc(collection(db, 'moments'), {
            videoUrl: downloadURL,
            userId,
            createdAt: Timestamp.now(),
            expiresAt: Timestamp.fromDate(expirationDate),
            storageRef: storageRef.fullPath,
            views: 0,
            likes: 0
        });
    }

    public async fetchMoments(): Promise<Moment[]> {
        await this.cleanExpiredMoments();
        
        const momentsRef = collection(this.db, 'moments');
        // Simplified query that works with standard indexes
        const q = query(
            momentsRef,
            where('expiresAt', '>', Timestamp.now()),
            orderBy('expiresAt')
        );
    
        const snapshot = await getDocs(q);
        const moments = await Promise.all(
            snapshot.docs.map(async (doc) => {
                const momentData = doc.data();
                const userData = await this.fetchUserData(momentData.userId);
                
                return {
                    id: doc.id,
                    ...momentData,
                    timeRemaining: this.calculateTimeRemaining(momentData.expiresAt.toDate()),
                    user: userData
                } as Moment;
            })
        );
    
        // Sort the results in memory
        return moments.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    }
    
    private async cleanExpiredMoments() {
        const momentsRef = collection(db, 'moments');
        const expiredQuery = query(
            momentsRef,
            where('expiresAt', '<=', Timestamp.now())
        );

        const expiredMoments = await getDocs(expiredQuery);

        for (const doc of expiredMoments.docs) {
            const momentData = doc.data();
            try {
                const storageRef = ref(storage, momentData.storageRef);
                await deleteObject(storageRef);
                await deleteDoc(doc.ref);
            } catch (error) {
                console.error(`Failed to clean up moment ${doc.id}:`, error);
            }
        }
    }

    private async fetchUserData(userId: string) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return null;

        const userData = userDoc.data();
        const profileImage = await this.fetchUserProfileImage(userId);

        return {
            id: userId,
            userName: userData.userName,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImage
        };
    }

    private async fetchUserProfileImage(userId: string): Promise<string | null> {
        try {
            const [profileImagesSnapshot, setAsSnapshot] = await Promise.all([
                getDocs(query(
                    collection(db, 'profileImages'),
                    where('userId', '==', userId)
                )),
                getDocs(query(
                    collection(db, 'profileImageSetAs'),
                    where('userId', '==', userId),
                    where('setAs', '==', 'profile')
                ))
            ]);

            if (!setAsSnapshot.empty) {
                const setAsDoc = setAsSnapshot.docs[0].data();
                const matchingImage = profileImagesSnapshot.docs.find(
                    img => img.id === setAsDoc.profileImageId
                );
                return matchingImage?.data()?.imageURL || null;
            }
            return null;
        } catch (error) {
            console.error('Error fetching profile image:', error);
            return null;
        }
    }

    private calculateTimeRemaining(expirationDate: Date): string {
        const now = new Date();
        const timeRemaining = expirationDate.getTime() - now.getTime();
        
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}h ${minutes}m`;
    }

    public async deleteMoment(momentId: string, userId: string) {
        try {
            const momentDoc = await getDoc(doc(this.db, 'moments', momentId));
            if (!momentDoc.exists()) {
                throw new Error('Moment not found');
            }
    
            const momentData = momentDoc.data();
            if (momentData.userId !== userId) {
                throw new Error('Unauthorized to delete this moment');
            }
    
            // Delete from storage
            const storageRef = ref(this.storage, momentData.storageRef);
            await deleteObject(storageRef);
    
            // Delete from firestore
            await deleteDoc(doc(this.db, 'moments', momentId));
    
            return true;
        } catch (error) {
            console.error('Error in deleteMoment:', error);
            throw error;
        }
    }
    
}
