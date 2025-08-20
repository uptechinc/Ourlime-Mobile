import { collection, getDocs, getDoc, doc, updateDoc, where, query, limit, orderBy, Timestamp, addDoc, increment, setDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db, auth, storage } from './firebaseConfig';
import { Reel, Post, Comment } from '@/types/userTypes';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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