import { collection, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, where, type DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

const RESERVATIONS = 'usernames';

/**
 * Usernames are matched without case ("Ron" = "ron"). Each name is reserved at usernames/{lowercase} in a
 * transaction, so two people can't take it at once. A reservation keeps pointing at its owner after they rename,
 * so old profile links and @mentions still find them.
 */
export class UsernameService {
  private static instance: UsernameService;

  private constructor() {}

  public static getInstance(): UsernameService {
    if (!UsernameService.instance) UsernameService.instance = new UsernameService();
    return UsernameService.instance;
  }

  public normalize(userName: string): string {
    return userName.replace(/^@/, '').trim().toLowerCase();
  }

  /** The user's doc for a username (exact match, then any case, then a former name). */
  public async findUserDocument(userName: string): Promise<DocumentSnapshot | null> {
    const trimmed = userName.replace(/^@/, '').trim();
    const lower = this.normalize(trimmed);
    if (!lower) return null;
    const exact = await getDocs(query(collection(db, 'users'), where('userName', '==', trimmed), limit(1)));
    if (!exact.empty) return exact.docs[0];
    const reservation = await getDoc(doc(db, RESERVATIONS, lower)).catch(() => null);
    const reservedUid = reservation?.exists() ? reservation.data().uid : null;
    if (typeof reservedUid === 'string' && reservedUid) {
      const user = await getDoc(doc(db, 'users', reservedUid));
      if (user.exists()) return user;
    }
    const byLower = await getDocs(query(collection(db, 'users'), where('userNameLower', '==', lower), limit(1)));
    return byLower.docs[0] ?? null;
  }

  public async findUserId(userName: string): Promise<string | null> {
    return (await this.findUserDocument(userName))?.id ?? null;
  }

  /** True when nobody else uses or has reserved this name (any case). */
  public async isAvailable(userName: string, currentUserId?: string): Promise<boolean> {
    const owner = await this.findUserId(userName);
    return !owner || owner === currentUserId;
  }

  /**
   * Reserves the name for this user and saves it on their profile in one transaction.
   * Throws when someone else already holds it.
   */
  public async claim(userId: string, userName: string, extraProfileFields: Record<string, string> = {}): Promise<void> {
    const trimmed = userName.replace(/^@/, '').trim();
    const lower = this.normalize(trimmed);
    if (!lower) throw new Error('Username is required.');
    const exact = await getDocs(query(collection(db, 'users'), where('userName', '==', trimmed), limit(2)));
    if (exact.docs.some((user) => user.id !== userId)) throw new Error('Username is already taken.');
    const byLower = await getDocs(query(collection(db, 'users'), where('userNameLower', '==', lower), limit(2)));
    if (byLower.docs.some((user) => user.id !== userId)) throw new Error('Username is already taken.');
    await runTransaction(db, async (transaction) => {
      const reservationRef = doc(db, RESERVATIONS, lower);
      const reservation = await transaction.get(reservationRef);
      const holder = reservation.exists() ? reservation.data().uid : null;
      if (holder && holder !== userId) throw new Error('Username is already taken.');
      if (!reservation.exists()) transaction.set(reservationRef, { uid: userId, userName: trimmed, createdAt: serverTimestamp() });
      transaction.update(doc(db, 'users', userId), { ...extraProfileFields, userName: trimmed, userNameLower: lower, updatedAt: serverTimestamp() });
    });
  }
}

export const usernameService = UsernameService.getInstance();
