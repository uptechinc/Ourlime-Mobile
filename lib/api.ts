import { collection, getDocs, where, query, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Reel } from '@/types/userTypes';

// Fetch all limes/reels
export async function getLimes(): Promise<Reel[]> {
  try {
    const reelsQuery = query(
      collection(db, 'reels'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(reelsQuery);
    const reels = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Reel));
    
    return reels;
  } catch (error) {
    console.error('Error fetching limes:', error);
    throw new Error('Failed to fetch limes');
  }
}

// Fetch limes/reels by category
export async function getLimesByCategory(category: string): Promise<Reel[]> {
  try {
    const reelsQuery = query(
      collection(db, 'reels'),
      where('category', '==', category),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(reelsQuery);
    const reels = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Reel));
    
    return reels;
  } catch (error) {
    console.error('Error fetching limes by category:', error);
    throw new Error('Failed to fetch limes by category');
  }
}

// ... existing code ... 