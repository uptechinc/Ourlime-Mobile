import { db } from '@/lib/firebaseConfig';
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    serverTimestamp, 
    onSnapshot,
    where,
    limit,
    DocumentData,
    QuerySnapshot,
    updateDoc
} from 'firebase/firestore';
import type { Comment, NewComment } from '@/lib/types/comment';

/**
 * Adds a new comment to a reel
 * @param reelId - The ID of the reel
 * @param comment - The comment data
 * @returns The new comment ID
 */
export const addComment = async (reelId: string, comment: NewComment): Promise<string> => {
    try {
        const commentsRef = collection(db, 'comments', reelId, 'comments');
        const docRef = await addDoc(commentsRef, {
            ...comment,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Also update the comment count on the reel document
        // This would be better in a Cloud Function to ensure atomicity
        const reelRef = collection(db, 'reels');
        const reelQuery = query(reelRef, where('id', '==', reelId));
        const reelSnapshot = await getDocs(reelQuery);
        
        if (!reelSnapshot.empty) {
            const reelDoc = reelSnapshot.docs[0];
            const commentCount = (reelDoc.data().commentCount || 0) + 1;
            await updateDoc(reelDoc.ref, { commentCount });
        }
        
        return docRef.id;
    } catch (error) {
        console.error('Error adding comment:', error);
        throw error;
    }
};

/**
 * Gets all comments for a reel
 * @param reelId - The ID of the reel
 * @returns Array of comments
 */
export const getComments = async (reelId: string): Promise<Comment[]> => {
    try {
        const commentsRef = collection(db, 'comments', reelId, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        } as Comment));
    } catch (error) {
        console.error('Error getting comments:', error);
        throw error;
    }
};

/**
 * Subscribe to comments for a reel with real-time updates
 * @param reelId - The ID of the reel
 * @param callback - Function to call when comments change
 * @returns Unsubscribe function
 */
export const subscribeToComments = (
    reelId: string, 
    callback: (comments: Comment[]) => void
): (() => void) => {
    const commentsRef = collection(db, 'comments', reelId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        const comments = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        } as Comment));
        callback(comments);
    }, (error) => {
        console.error('Error subscribing to comments:', error);
    });
    
    return unsubscribe;
}; 