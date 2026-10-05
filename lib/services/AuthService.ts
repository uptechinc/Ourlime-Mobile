import { Platform } from 'react-native';
import {
  signInWithEmailAndPassword,
  signInWithCustomToken,
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
  addDoc,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  FieldValue,
  Timestamp,
  updateDoc,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { pushNotificationService } from './PushNotificationService';
import { localCacheService } from './LocalCacheService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { PostMediaService } from './PostMediaService';
import { AuthServiceError } from '@/lib/auth/AuthErrors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { presenceService } from './PresenceService';
import { nativeCallService } from './NativeCallService';
import { AppServerError, appServerService } from './AppServerService';
import { qrLoginService, QRLoginService } from './QRLoginService';
import { usernameService } from './UsernameService';
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
  identityVerificationStatus?: string;
  blogPublishingSuspended?: boolean;
  visibility?: 'public' | 'friends' | 'private';
  followersCount?: number;
  friendsCount?: number;
  postsCount?: number;
  gender?: string;
  dateOfBirth?: string;
  country?: string;
  state?: string;
  city?: string;
  phone?: string;
  profilePicture?: string | null;
  selectedInterests?: string[];
  createdAt?: FieldValue | Timestamp;
};

export type UserAccessProfile = Pick<
  UserProfile,
  'accountType' | 'role' | 'isAdmin' | 'isDeveloper'
>;

export type RegistrationVerificationType = 'student_id' | 'national_id' | 'guardian' | 'drivers_license' | 'skipped' | '';

export type VerificationDocumentInput = {
  faceUri?: string | null;
  frontUri?: string | null;
  backUri?: string | null;
};

export type RegistrationInput = {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password: string;
  accountType: 'student' | 'regular' | '';
  studentLevel?: string;
  gender?: string;
  dateOfBirth?: string;
  country?: string;
  state?: string;
  city?: string;
  phone?: string;
  profilePicture?: string | null;
  /** Optional cover photo (local file), like the website's "Upload Your Own Pictures" step. */
  coverPhoto?: string | null;
  selectedInterests?: string[];
  verificationType?: RegistrationVerificationType;
  idSubType?: 'national_id' | 'passport' | null;
  guardianRelation?: 'biological_parent' | 'legal_guardian' | null;
  guardianEmail?: string;
  verificationDocuments?: VerificationDocumentInput;
  referralToken?: string;
  policyAcknowledgements: {
    terms: boolean;
    privacy: boolean;
    childSafety: boolean;
  };
};

type RegistrationStartResponse = {
  userId: string;
  customToken: string;
};

export type RegistrationResult = {
  user: FirebaseUser;
  verificationEmailSent: boolean;
};

export class AuthService {
  private static instance: AuthService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly mediaService = PostMediaService.getInstance();
  private readonly profilePromises = new Map<string, Promise<UserProfile | null>>();
  private readonly profileMemoryCache = new Map<string, { profile: UserProfile; timestamp: number }>();
  private readonly maximumProfileCacheEntries = 100;

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

  public subscribeToUserAccessProfile(
    uid: string,
    onChange: (profile: UserAccessProfile) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    if (!uid) {
      console.error('[subscribeToUserAccessProfile] uid is required');
      return () => undefined;
    }

    return onSnapshot(
      doc(db, 'users', uid),
      (snapshot) => {
        const profileRecord = this.toRecord(snapshot.data());
        this.invalidateUserProfile(uid);
        onChange({
          accountType: this.readString(profileRecord.accountType, 'regular'),
          role: this.readString(profileRecord.role) || undefined,
          isAdmin: profileRecord.isAdmin === true,
          isDeveloper: profileRecord.isDeveloper === true,
        });
      },
      (error) => onError(error),
    );
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
      await this.assertAccountCanSignIn(account);
      if (account?.registrationStatus === 'incomplete') {
        await setDoc(doc(db, 'users', credential.user.uid), { registrationStatus: 'complete', currentStep: 8, updatedAt: serverTimestamp() }, { merge: true })
          .catch((error: unknown) => this.logger.warn('AuthService', 'login:finish-registration', { error: error instanceof Error ? error.message : String(error) }));
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
      void qrLoginService.registerCurrentNativeSession();
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
  public async register(formData: RegistrationInput): Promise<RegistrationResult> {
    if (!formData.policyAcknowledgements.terms || !formData.policyAcknowledgements.privacy || !formData.policyAcknowledgements.childSafety) {
      throw new AuthServiceError('UNKNOWN', 'Accept all required Ourlime policies before registering.');
    }

    const startResponse = await appServerService.call<RegistrationStartResponse>('startRegistration', {
      firstName: formData.firstName,
      lastName: formData.lastName,
      userName: formData.userName,
      email: formData.email,
      password: formData.password,
      accountType: formData.accountType,
      referralToken: formData.referralToken,
      platform: Platform.OS,
    }, 30_000).catch((error: unknown) => {
      if (error instanceof AppServerError && error.code === 'already-exists' && error.message === 'auth/email-already-in-use') {
        throw new AuthServiceError('UNKNOWN', 'An account with this email already exists. Try signing in instead.');
      }
      throw new AuthServiceError('UNKNOWN', error instanceof Error ? error.message : 'Failed to start registration.');
    });
    if (!startResponse.userId || !startResponse.customToken) throw new AuthServiceError('UNKNOWN', 'Failed to start registration.');

    const credential = await signInWithCustomToken(auth, startResponse.customToken);
    const user = credential.user;
    try {
      // Create user profile in Firestore
      const profilePicture = formData.profilePicture && /^(file:|content:)/i.test(formData.profilePicture)
        ? await this.mediaService.uploadProfileImage({ userId: user.uid, uri: formData.profilePicture }).catch((error: unknown) => {
          this.logger.warn('AuthService', 'register:profile-picture', { error: error instanceof Error ? error.message : String(error) });
          return null;
        })
        : formData.profilePicture || null;
      const coverPhoto = formData.coverPhoto && /^(file:|content:)/i.test(formData.coverPhoto)
        ? await this.saveRegistrationCover(user.uid, formData.coverPhoto)
        : null;
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
      state: formData.state || '',
      city: formData.city || '',
      phone: formData.phone || '',
      profilePicture,
      ...(coverPhoto ? { coverPhoto } : {}),
      selectedInterests: formData.selectedInterests || [],
      createdAt: serverTimestamp(),
    };

      // Handle Verification Documents Upload if provided
      const docs = formData.verificationDocuments;
      const wantsVerificationDocs = Boolean(
        formData.verificationType &&
        formData.verificationType !== 'skipped' &&
        docs?.faceUri &&
        docs?.frontUri
      );
      let hasVerificationDocs = false;

      if (wantsVerificationDocs && docs) {
        try {
        const authDocsCollection = collection(db, 'users', user.uid, 'authenticationDocuments');

        // Face doc
        if (docs.faceUri) {
          const faceResult = await this.mediaService.uploadVerificationDocument({
            email: user.email || formData.email,
            type: 'faceID',
            uri: docs.faceUri,
          });
          await setDoc(doc(authDocsCollection), {
            type: 'faceID',
            fileName: faceResult.fileName,
            imageURL: faceResult.downloadUrl,
            verified: false,
            createdAt: serverTimestamp(),
          });
        }

        // Front doc
        if (docs.frontUri) {
          const frontResult = await this.mediaService.uploadVerificationDocument({
            email: user.email || formData.email,
            type: 'frontID',
            uri: docs.frontUri,
          });
          await setDoc(doc(authDocsCollection), {
            type: 'frontID',
            fileName: frontResult.fileName,
            imageURL: frontResult.downloadUrl,
            verified: false,
            createdAt: serverTimestamp(),
          });
        }

        // Back doc (if provided, e.g. not passport)
        if (docs.backUri) {
          const backResult = await this.mediaService.uploadVerificationDocument({
            email: user.email || formData.email,
            type: 'backID',
            uri: docs.backUri,
          });
          await setDoc(doc(authDocsCollection), {
            type: 'backID',
            fileName: backResult.fileName,
            imageURL: backResult.downloadUrl,
            verified: false,
            createdAt: serverTimestamp(),
          });
        }

        // Notify Admin of ID submission
        await appServerService.call('notifyAdminIdSubmitted').catch((error: unknown) => {
          this.logger.warn('AuthService', 'register:admin-notification', { error: error instanceof Error ? error.message : String(error) });
        });
          hasVerificationDocs = true;
        } catch (error: unknown) {
          // Failed ID upload: the account is still created and marked 'documents_required' so they can resubmit.
          this.logger.warn('AuthService', 'register:verification-documents', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      const verificationType = formData.verificationType || 'skipped';
      const verificationStatus = verificationType === 'skipped'
        ? null
        : hasVerificationDocs
          ? 'pending'
          : verificationType === 'guardian'
            ? 'pending'
            : 'documents_required';

      await setDoc(doc(db, 'users', user.uid), {
        ...userProfile,
        studentLevel: formData.studentLevel || '',
        registrationStatus: 'complete',
        currentStep: 8,
        emailVerified: false,
        verificationType,
        idSubType: formData.idSubType || null,
        guardianRelation: formData.guardianRelation || null,
        verificationStatus,
        guardianEmail: formData.guardianEmail?.trim() || null,
        policyAcknowledgements: {
          termsAcceptedAt: serverTimestamp(),
          privacyAcceptedAt: serverTimestamp(),
          childSafetyAcceptedAt: serverTimestamp(),
          source: 'ourlime-mobile',
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await usernameService.claim(user.uid, formData.userName).catch((error: unknown) => {
        this.logger.warn('AuthService', 'register:reserve-username', { error: error instanceof Error ? error.message : String(error) });
      });

      if (verificationType === 'guardian' && formData.guardianEmail?.trim()) {
        await appServerService.call('notifyGuardian').catch((error: unknown) => {
          this.logger.warn('AuthService', 'register:guardian-notification', { error: error instanceof Error ? error.message : String(error) });
        });
      }

      let verificationEmailSent = true;
      await sendEmailVerification(user, { url: 'https://ourlime.com/verify-email' }).catch((error: unknown) => {
        verificationEmailSent = false;
        this.logger.warn('AuthService', 'register:verification-email', { error: error instanceof Error ? error.message : String(error) });
      });

      return { user, verificationEmailSent };
    } finally {
      await signOut(auth).catch(() => undefined);
    }
  }

  /**
   * Saves a sign-up cover photo the way the website / profile header do: a profileImages doc
   * (typeOfImage 'coverProfile') selected by a profileImageSetAs 'coverProfile' assignment.
   * A failed cover never blocks sign-up; the user can add one later from their profile.
   */
  private async saveRegistrationCover(userId: string, uri: string): Promise<string | null> {
    try {
      const imageURL = await this.mediaService.uploadProfileCover({ userId, uri });
      const coverImage = await addDoc(collection(db, 'profileImages'), {
        userId, imageURL, typeOfImage: 'coverProfile', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'profileImageSetAs'), {
        userId, setAs: 'coverProfile', profileImageId: [{ id: coverImage.id, displayorder: 1 }], createdAt: serverTimestamp(),
      });
      return imageURL;
    } catch (error: unknown) {
      this.logger.warn('AuthService', 'register:cover-photo', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  public async resendRegistrationVerificationEmail(userId: string): Promise<void> {
    await appServerService.call('resendVerificationEmail', { userId }, 30_000);
  }

  private async assertAccountCanSignIn(account: DocumentData | undefined): Promise<void> {
    const deny = async (code: 'ACCOUNT_DELETED' | 'ACCOUNT_DISABLED' | 'ACCOUNT_BANNED' | 'ACCOUNT_SUSPENDED' | 'BETA_ACCESS_REVOKED' | 'BETA_ACCESS_SUSPENDED', message: string): Promise<never> => {
      await signOut(auth);
      throw new AuthServiceError(code, message);
    };
    if (!account) return;
    if (account.deletedAt || account.status === 'deleted' || account.accountStatus === 'archived') {
      await deny('ACCOUNT_DELETED', 'This account has been archived. Contact support if you believe this is a mistake.');
    }
    if (account.isBanned === true || account.accountStatus === 'banned' || account.status === 'banned') {
      const reason = typeof account.statusReason === 'string' ? account.statusReason : typeof account.banReason === 'string' ? account.banReason : 'Violation of Ourlime community standards.';
      await deny('ACCOUNT_BANNED', `Your account has been permanently banned from Ourlime. Reason: ${reason}`);
    }
    if (account.betaTesterStatus === 'removed') {
      await deny('BETA_ACCESS_REVOKED', 'Your Ourlime beta access has been revoked.');
    }
    if (account.betaTesterStatus === 'suspended') {
      await deny('BETA_ACCESS_SUSPENDED', 'Your Ourlime beta access is currently suspended.');
    }
    if (account.isSuspended === true || account.accountStatus === 'suspended' || account.status === 'suspended') {
      const suspendedUntil = this.readAccountDate(account.suspendedUntil);
      if (!suspendedUntil || suspendedUntil.getTime() > Date.now()) {
        const reason = typeof account.statusReason === 'string' ? account.statusReason : typeof account.suspensionReason === 'string' ? account.suspensionReason : 'Violation of Ourlime community standards.';
        const untilLabel = suspendedUntil ? ` until ${suspendedUntil.toLocaleString()}` : '';
        await deny('ACCOUNT_SUSPENDED', `Your account is temporarily suspended${untilLabel}. Reason: ${reason}`);
      }
    }
    if (account.disabled === true || account.status === 'disabled') {
      await deny('ACCOUNT_DISABLED', 'This account is currently disabled.');
    }
  }

  private readAccountDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object' && value !== null) {
      const timestamp = value as { toDate?: unknown; seconds?: unknown };
      if (typeof timestamp.toDate === 'function') return (timestamp.toDate as () => Date)();
      if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000);
    }
    return null;
  }

  /**
   * Fetch user profile from Firestore with in-flight deduplication and memory caching
   */
  public async getUserProfile(uid: string, force = false): Promise<UserProfile | null> {
    return this.getUserProfileWithMissingWarning(uid, force, true);
  }

  /**
   * Resolve an optional profile reference without treating a legacy or removed
   * document as an operational warning.
   */
  public async getUserProfileIfAvailable(uid: string): Promise<UserProfile | null> {
    return this.getUserProfileWithMissingWarning(uid, false, false);
  }

  private async getUserProfileWithMissingWarning(uid: string, force: boolean, warnIfMissing: boolean): Promise<UserProfile | null> {
    if (!uid) return null;
    if (!force) {
      const cached = this.profileMemoryCache.get(uid);
      if (cached && Date.now() - cached.timestamp < 120_000) {
        this.profileMemoryCache.delete(uid);
        this.profileMemoryCache.set(uid, cached);
        return cached.profile;
      }
      if (cached) this.profileMemoryCache.delete(uid);
      const inFlight = this.profilePromises.get(uid);
      if (inFlight) {
        return inFlight;
      }
    }

    const promise = (async () => {
      try {
        return await this.fetchUserProfileInternal(uid, warnIfMissing);
      } finally {
        this.profilePromises.delete(uid);
      }
    })();
    this.profilePromises.set(uid, promise);
    return promise;
  }

  private async fetchUserProfileInternal(uid: string, warnIfMissing = true): Promise<UserProfile | null> {
    this.logger.info('AuthService', 'profile:user-document:start', { uid, collection: 'users' });
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      this.logger.success('AuthService', 'profile:user-document', { uid, exists: snap.exists() });
      if (!snap.exists()) {
        if (warnIfMissing) {
          this.logger.warn('AuthService', 'profile:not-found', { uid, path: `users/${uid}` });
        }
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
        identityVerificationStatus: this.readString(profileRecord.identityVerificationStatus) || undefined,
        blogPublishingSuspended: profileRecord.blogPublishingSuspended === true,
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
      this.cacheUserProfile(profile);
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

  private cacheUserProfile(profile: UserProfile): void {
    this.profileMemoryCache.delete(profile.uid);
    this.profileMemoryCache.set(profile.uid, { profile, timestamp: Date.now() });
    while (this.profileMemoryCache.size > this.maximumProfileCacheEntries) {
      const oldestUserId = this.profileMemoryCache.keys().next().value;
      if (typeof oldestUserId !== 'string') return;
      this.profileMemoryCache.delete(oldestUserId);
    }
  }

  /**
   * Fetch user profile by username
   */
  public async getUserProfileByUsername(userName: string): Promise<UserProfile | null> {
    try {
      const userId = await usernameService.findUserId(userName);
      if (!userId) return null;
      return this.getUserProfile(userId);
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
    await AsyncStorage.removeItem(QRLoginService.NATIVE_SESSION_KEY).catch(() => undefined);
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

  /** Waits (briefly) for Firebase to restore a saved session, so cold-start links don't flash the login screen. */
  public async waitForVerifiedCurrentUser(timeoutMs = 2500): Promise<FirebaseUser | null> {
    if (auth.currentUser) return this.getVerifiedCurrentUser();
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        auth.authStateReady(),
        new Promise<void>((resolve) => { timer = setTimeout(resolve, timeoutMs); }),
      ]);
    } catch (error: unknown) {
      this.logger.warn('AuthService', 'waitForVerifiedCurrentUser', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (timer) clearTimeout(timer);
    }
    return this.getVerifiedCurrentUser();
  }

  public getVerifiedCurrentUser(): FirebaseUser | null {
    const currentUser = auth.currentUser;
    return currentUser?.emailVerified === true ? currentUser : null;
  }

  public isVerifiedUser(user: FirebaseUser | null | undefined): user is FirebaseUser {
    return user?.emailVerified === true;
  }

  public async updateUserProfile(userId: string, updates: Pick<UserProfile, 'firstName' | 'lastName' | 'userName' | 'bio' | 'location' | 'profilePicture' | 'coverPhoto'>): Promise<void> {
    // A changed username is reserved first (fails with "Username is already taken." if someone has it).
    const current = await getDoc(doc(db, 'users', userId));
    const currentUserName = typeof current.data()?.userName === 'string' ? String(current.data()?.userName) : '';
    if (updates.userName && updates.userName.trim() !== currentUserName) {
      await usernameService.claim(userId, updates.userName);
    }
    await updateDoc(doc(db, 'users', userId), {
      ...updates,
      coverImage: updates.coverPhoto ?? null,
      coverPicture: updates.coverPhoto ?? null,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Upload verification ID documents for an already-registered user.
   * Called from VerificationUploadModal.
   */
  public async uploadVerificationDocuments(options: {
    files: { faceUri: string; frontUri?: string; backUri?: string };
    verificationType: string;
    idSubType?: string | null;
  }): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      throw new AuthServiceError('UNKNOWN', 'You must be logged in to upload verification documents.');
    }

    const authCollection = collection(db, 'users', currentUser.uid, 'authenticationDocuments');

    // Face ID
    const faceResult = await this.mediaService.uploadVerificationDocument({
      email: currentUser.email,
      type: 'faceID',
      uri: options.files.faceUri,
    });
    await setDoc(doc(authCollection), {
      type: 'faceID',
      fileName: faceResult.fileName,
      imageURL: faceResult.downloadUrl,
      verified: false,
      createdAt: serverTimestamp(),
    });

    // Front ID
    if (options.files.frontUri) {
      const frontResult = await this.mediaService.uploadVerificationDocument({
        email: currentUser.email,
        type: 'frontID',
        uri: options.files.frontUri,
      });
      await setDoc(doc(authCollection), {
        type: 'frontID',
        fileName: frontResult.fileName,
        imageURL: frontResult.downloadUrl,
        verified: false,
        createdAt: serverTimestamp(),
      });
    }

    // Back ID
    if (options.files.backUri) {
      const backResult = await this.mediaService.uploadVerificationDocument({
        email: currentUser.email,
        type: 'backID',
        uri: options.files.backUri,
      });
      await setDoc(doc(authCollection), {
        type: 'backID',
        fileName: backResult.fileName,
        imageURL: backResult.downloadUrl,
        verified: false,
        createdAt: serverTimestamp(),
      });
    }

    // Update user document with verification type and status
    await updateDoc(doc(db, 'users', currentUser.uid), {
      verificationType: options.verificationType,
      ...(options.idSubType ? { idSubType: options.idSubType } : {}),
      verificationStatus: 'pending',
      updatedAt: serverTimestamp(),
    });

    this.invalidateUserProfile(currentUser.uid);

    // Notify admin
    await appServerService.call('notifyAdminIdSubmitted').catch((error: unknown) => {
      this.logger.warn('AuthService', 'uploadVerificationDocuments:admin-notification', {
        error: error instanceof Error ? error.message : String(error),
      });
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
