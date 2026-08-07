import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
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
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';

export type UserProfile = {
  uid: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  accountType: string;
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

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Log in user with email and password
   */
  public async login(email: string, password: string): Promise<FirebaseUser> {
    const normalizedEmail = email.trim();
    this.logger.info('AuthService', 'login:start', { emailDomain: normalizedEmail.split('@')[1] ?? 'unknown' });
    try {
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
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
      profilePicture: formData.profilePicture || null,
      selectedInterests: formData.selectedInterests || [],
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);

    return user;
  }

  /**
   * Fetch user profile from Firestore
   */
  public async getUserProfile(uid: string): Promise<UserProfile | null> {
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
    await signOut(auth);
  }

  /**
   * Get current authenticated user
   */
  public getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
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
}

export const authService = AuthService.getInstance();
