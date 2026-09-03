import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db, auth } from './firebaseConfig';

export type MobileActivityLogOptions = {
  action: string;
  resource: string;
  resourceId: string;
  resourceName?: string;
  details: string;
  location?: string;
  geo?: {
    lat?: number;
    lng?: number;
    address?: string;
    name?: string;
  };
  previousData?: unknown;
  newData?: unknown;
  metadata?: Record<string, unknown>;
};

export async function logMobileActivity(options: MobileActivityLogOptions): Promise<string | null> {
  try {
    const currentUser = auth.currentUser;
    const userId = currentUser?.uid || 'anonymous';
    const username = currentUser?.displayName || currentUser?.email || 'Mobile User';

    const docRef = await addDoc(collection(db, 'activityLogs'), {
      timestamp: serverTimestamp(),
      userId,
      username,
      action: options.action,
      resource: options.resource,
      resourceId: options.resourceId,
      resourceName: options.resourceName || options.resource,
      details: options.details,
      location: options.location || 'Mobile Device',
      geo: options.geo || null,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      deviceType: 'mobile',
      actor: {
        id: userId,
        email: currentUser?.email || undefined,
        username,
        role: 'member',
      },
      newData: options.newData || null,
      previousData: options.previousData || null,
      metadata: options.metadata || null,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.warn(
      '[logMobileActivity] Warning: Failed to write mobile activity log:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}
