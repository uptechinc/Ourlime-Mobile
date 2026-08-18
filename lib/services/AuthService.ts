import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  sendEmailVerification,
  User as FirebaseUser,
  Unsubscribe,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  FieldValue,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { pushNotificationService } from './PushNotificationService';
import { localCacheService } from './LocalCacheService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { PostMediaService } from './PostMediaService';
import { AuthServiceError } from '@/lib/auth/AuthErrors';
import { presenceService } from './PresenceService';
import { nativeCallService } from './NativeCallService';
export { AuthServiceError, getAuthErrorCode } from '@/lib/auth/AuthErrors';
export type { AuthServiceErrorCode } from '@/lib/auth/AuthErrors';

export type UserProfile = {
  uid: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  accountType: string;
  role?: string;
  isAdmin?: boolean;
  isDeveloper?: boolean;
  bio?: string;
  location?: string;
  coverPhoto?: string;
  coverImage?: string;
  coverPicture?: string;
  emailVerified?: boolean;
  verificationStatus?: string;
  visibility?: 'public' | 'friends' | 'private';
  followersCount?: number;
  friendsCount?: number;
  postsCount?: number;
  gender?: string;
  dateOfBirth?: string;
  country?: string;
  city?: string;
  phone?: string;
  profilePicture?: string | null;
  selectedInterests?: string[];
  createdAt?: FieldValue | Timestamp;
};

export class AuthService {
  private static instance: AuthService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly mediaService = PostMediaService.getInstance();
  private readonly profilePromises = new Map<string, Promise<UserProfile | null>>();
  private readonly profileMemoryCache = new Map<string, { profile: UserProfile; timestamp: number }>();

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public invalidateUserProfile(uid: string): void {
    this.profileMemoryCache.delete(uid);
    this.profilePromises.delete(uid);
  }

  /**
   * Log in user with email and password
   */
  public async login(email: string, password: string): Promise<FirebaseUser> {
    const normalizedEmail = email.trim();
    this.logger.info('AuthService', 'login:start', { emailDomain: normalizedEmail.split('@')[1] ?? 'unknown' });
    try {
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const accountDocument = await getDoc(doc(db, 'users', credential.user.uid));
      const account = accountDocument.data();
      if (account?.deletedAt || account?.status === 'deleted') {
        await signOut(auth);
        throw new AuthServiceError('ACCOUNT_DELETED', 'This account has been deleted.');
      }
      if (account?.disabled === true || account?.status === 'disabled' || account?.status === 'suspended') {
        await signOut(auth);
        throw new AuthServiceError('ACCOUNT_DISABLED', 'This account is currently disabled.');
      }
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user).catch(() => undefined);
        await signOut(auth);
        throw new AuthServiceError('EMAIL_NOT_VERIFIED', 'Verify your email before signing in. A new verification email was sent.');
      }
      this.logger.success('AuthService', 'login', {
        uid: credential.user.uid,
        emailVerified: credential.user.emailVerified,
      });
      return credential.user;
    } catch (error: unknown) {
      this.logger.error('AuthService', 'login', error, { emailDomain: normalizedEmail.split('@')[1] ?? 'unknown' });
      throw error;
    }
  }

  public async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new AuthServiceError('UNKNOWN', 'Email is required.');
    await sendPasswordResetEmail(auth, normalizedEmail, { url: 'https://ourlime.com/reset-password' });
  }

  public async validatePasswordResetCode(code: string): Promise<string> {
    if (!code) throw new AuthServiceError('UNKNOWN', 'Password reset code is missing.');
    return verifyPasswordResetCode(auth, code);
  }

  public async resetPassword(code: string, password: string): Promise<void> {
    if (password.length < 8) throw new AuthServiceError('UNKNOWN', 'Password must contain at least 8 characters.');
    await confirmPasswordReset(auth, code, password);
  }

  public async resendEmailVerification(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    try {
      if (!credential.user.emailVerified) await sendEmailVerification(credential.user);
    } finally {
      await signOut(auth);
    }
  }

  /**
   * Register a new user and save profile to Firestore
   */
  public async register(formData: {
    firstName: string;
    lastName: string;
    userName: string;
    email: string;
    password: string;
    accountType: string;
    gender?: string;
    dateOfBirth?: string;
    country?: string;
    city?: string;
    phone?: string;
    profilePicture?: string | null;
    selectedInterests?: string[];
  }): Promise<FirebaseUser> {
    const credential = await createUserWithEmailAndPassword(
      auth,
      formData.email.trim(),
      formData.password
    );

    const user = credential.user;

    // Create user profile in Firestore
    const profilePicture = formData.profilePicture && /^(file:|content:)/i.test(formData.profilePicture)
      ? await this.mediaService.uploadProfileImage({ userId: user.uid, uri: formData.profilePicture })
      : formData.profilePicture || null;
    const userProfile: UserProfile = {
      uid: user.uid,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      userName: formData.userName.trim(),
      email: formData.email.trim(),
      accountType: formData.accountType,
      gender: formData.gender || '',
      dateOfBirth: formData.dateOfBirth || '',
      country: formData.country || '',
      city: formData.city || '',
      phone: formData.phone || '',
      profilePicture,
      selectedInterests: formData.selectedInterests || [],
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
    await sendEmailVerification(user).catch(() => undefined);

    return user;
  }

  /**
   * Fetch user profile from Firestore with in-flight deduplication and memory caching
   */
  public async getUserProfile(uid: string, force = false): Promise<UserProfile | null> {
    if (!uid) return null;
    if (!force) {
      const cached = this.profileMemoryCache.get(uid);
      if (cached && Date.now() - cached.timestamp < 120_000) {
        return cached.profile;
      }
      const inFlight = this.profilePromises.get(uid);
      if (inFlight) {
        return inFlight;
      }
    }

    const promise = this.fetchUserProfileInternal(uid).finally(() => {
      this.profilePromises.delete(uid);
    });
    this.profilePromises.set(uid, promise);
    return promise;
  }

  private async fetchUserProfileInternal(uid: string): Promise<UserProfile | null> {
    this.logger.info('AuthService', 'profile:user-document:start', { uid, collection: 'users' });
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      this.logger.success('AuthService', 'profile:user-document', { uid, exists: snap.exists() });
      if (!snap.exists()) {
        this.logger.warn('AuthService', 'profile:not-found', { uid, path: `users/${uid}` });
        return null;
      }

      const rawProfile: unknown = snap.data();
      const profileRecord = this.toRecord(rawProfile);
      const profileSelectionsQuery = query(
        collection(db, 'profileImageSetAs'),
        where('userId', '==', uid)
      );
      this.logger.info('AuthService', 'profile:image-selection:start', {
        uid,
        collection: 'profileImageSetAs',
      });
      const selectionsSnapshot = await getDocs(profileSelectionsQuery);
      const selection = selectionsSnapshot.docs.find((selectionDocument) => selectionDocument.data().setAs === 'postProfile')
        ?? selectionsSnapshot.docs.find((selectionDocument) => selectionDocument.data().setAs === 'profile');
      const profileImageId = selection && typeof selection.data().profileImageId === 'string'
        ? selection.data().profileImageId
        : null;
      this.logger.success('AuthService', 'profile:image-selection', {
        uid,
        selectionCount: selectionsSnapshot.size,
        selectedProfileImageId: profileImageId,
        selectedAs: selection?.data().setAs ?? null,
      });

      let resolvedProfilePicture = this.readString(profileRecord.profilePicture)
        || this.readProfileImage(profileRecord.profileImage)
        || this.readString(profileRecord.avatar)
        || this.readString(profileRecord.photoURL)
        || null;
      if (profileImageId) {
        this.logger.info('AuthService', 'profile:image-document:start', {
          uid,
          path: `profileImages/${profileImageId}`,
        });
        const imageSnapshot = await getDoc(doc(db, 'profileImages', profileImageId));
        const imageData: unknown = imageSnapshot.data();
        const imageRecord = this.toRecord(imageData);
        resolvedProfilePicture = this.readString(imageRecord.imageURL)
          || this.readString(imageRecord.imageUrl)
          || this.readString(imageRecord.downloadURL)
          || this.readString(imageRecord.url)
          || resolvedProfilePicture;
        this.logger.success('AuthService', 'profile:image-document', {
          uid,
          exists: imageSnapshot.exists(),
          hasImageUrl: Boolean(resolvedProfilePicture),
        });
      }

      const profile: UserProfile = {
        uid,
        firstName: this.readString(profileRecord.firstName),
        lastName: this.readString(profileRecord.lastName),
        userName: this.readString(profileRecord.userName),
        email: this.readString(profileRecord.email, auth.currentUser?.email ?? ''),
        accountType: this.readString(profileRecord.accountType, 'regular'),
        role: this.readString(profileRecord.role) || undefined,
        isAdmin: profileRecord.isAdmin === true,
        isDeveloper: profileRecord.isDeveloper === true,
        bio: this.readString(profileRecord.bio) || undefined,
        location: this.readString(profileRecord.location) || undefined,
        coverPhoto: this.readString(profileRecord.coverPhoto) || undefined,
        coverImage: this.readString(profileRecord.coverImage) || undefined,
        coverPicture: this.readString(profileRecord.coverPicture) || undefined,
        emailVerified: profileRecord.emailVerified === true || auth.currentUser?.emailVerified === true,
        verificationStatus: this.readString(profileRecord.verificationStatus) || undefined,
        visibility: profileRecord.visibility === 'private' || profileRecord.visibility === 'friends' ? profileRecord.visibility : 'public',
        followersCount: this.readNumber(profileRecord.followersCount),
        friendsCount: this.readNumber(profileRecord.friendsCount),
        postsCount: this.readNumber(profileRecord.postsCount),
        gender: this.readString(profileRecord.gender) || undefined,
        dateOfBirth: this.readString(profileRecord.dateOfBirth) || undefined,
        country: this.readString(profileRecord.country) || undefined,
        city: this.readString(profileRecord.city) || undefined,
        phone: this.readString(profileRecord.phone) || undefined,
        profilePicture: resolvedProfilePicture,
        selectedInterests: Array.isArray(profileRecord.selectedInterests)
          ? profileRecord.selectedInterests.filter((interest): interest is string => typeof interest === 'string')
          : [],
        createdAt: profileRecord.createdAt instanceof Timestamp ? profileRecord.createdAt : undefined,
      };
      this.profileMemoryCache.set(uid, { profile, timestamp: Date.now() });
      this.logger.success('AuthService', 'profile:complete', {
        uid,
        firstName: profile.firstName,
        userName: profile.userName,
        hasProfilePicture: Boolean(profile.profilePicture),
      });
      return profile;
    } catch (error: unknown) {
      this.logger.error('AuthService', 'profile', error, { uid });
      throw error;
    }
  }

  /**
   * Fetch user profile by username
   */
  public async getUserProfileByUsername(userName: string): Promise<UserProfile | null> {
    try {
      const q = query(collection(db, 'users'), where('userName', '==', userName.trim()), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const userDoc = snap.docs[0];
      return this.getUserProfile(userDoc.id);
    } catch (error: unknown) {
      this.logger.error('AuthService', 'getUserProfileByUsername', error, { userName });
      return null;
    }
  }

  /**
   * Log out current user
   */
  public async logout(): Promise<void> {
    const userId = auth.currentUser?.uid;
    await presenceService.heartbeat('offline').catch(() => undefined);
    await pushNotificationService.unregisterCurrentDevice().catch((error: unknown) => {
      this.logger.warn('AuthService', 'logout:push-unregister', { error: error instanceof Error ? error.message : String(error) });
    });
    await nativeCallService.unregisterTokens().catch((error: unknown) => {
      this.logger.warn('AuthService', 'logout:call-token-unregister', { error: error instanceof Error ? error.message : String(error) });
    });
    if (userId) {
      this.invalidateUserProfile(userId);
      await localCacheService.clearUser(userId).catch(() => undefined);
    }
    this.profileMemoryCache.clear();
    this.profilePromises.clear();
    useResourceStore.getState().clearUserResources();
    await signOut(auth);
  }

  /**
   * Get current authenticated user
   */
  public getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  public getVerifiedCurrentUser(): FirebaseUser | null {
    const currentUser = auth.currentUser;
    return currentUser?.emailVerified === true ? currentUser : null;
  }

  public isVerifiedUser(user: FirebaseUser | null | undefined): user is FirebaseUser {
    return user?.emailVerified === true;
  }

  public async updateUserProfile(userId: string, updates: Pick<UserProfile, 'firstName' | 'lastName' | 'userName' | 'bio' | 'location' | 'profilePicture' | 'coverPhoto'>): Promise<void> {
    await updateDoc(doc(db, 'users', userId), {
      ...updates,
      coverImage: updates.coverPhoto ?? null,
      coverPicture: updates.coverPhoto ?? null,
      updatedAt: serverTimestamp(),
    });
  }

  public subscribeToAuthState(onChange: (user: FirebaseUser | null) => void): Unsubscribe {
    this.logger.info('AuthService', 'auth-state:subscribe', { hasCurrentUser: Boolean(auth.currentUser) });
    return onAuthStateChanged(auth, (user) => {
      this.logger.info('AuthService', 'auth-state:changed', {
        authenticated: Boolean(user),
        uid: user?.uid ?? null,
        emailVerified: user?.emailVerified ?? null,
      });
      onChange(user);
    });
  }

  public subscribeToVerifiedAuthState(onChange: (user: FirebaseUser | null) => void): Unsubscribe {
    return this.subscribeToAuthState((user) => {
      onChange(this.isVerifiedUser(user) ? user : null);
    });
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private readString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }

  private readProfileImage(value: unknown): string {
    if (typeof value === 'string') return value;
    const record = this.toRecord(value);
    return this.readString(record.imageURL)
      || this.readString(record.imageUrl)
      || this.readString(record.downloadURL)
      || this.readString(record.url);
  }

  private readNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
}

export const authService = AuthService.getInstance();
