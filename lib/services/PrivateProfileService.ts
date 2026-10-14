import { doc, getDoc, serverTimestamp, setDoc, type DocumentData, type DocumentReference, type FieldValue } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

export type GuardianRelation = 'biological_parent' | 'legal_guardian';

export type AccountRestrictions = {
  messaging?: boolean;
  expiresAt?: unknown;
  reason?: string;
};

/**
 * Personal and moderation fields kept in users/{uid}/private/profile. Only the member and administrators can
 * read that document; users/{uid} carries public profile fields only.
 */
export type PrivateProfile = {
  email: string;
  phone: string;
  dateOfBirth: string;
  guardianEmail: string | null;
  guardianRelation: GuardianRelation | null;
  statusReason: string;
  banReason: string;
  suspensionReason: string;
  accountRestrictions: AccountRestrictions | null;
};

/** Fields the member may write themselves (rules: selfEditablePrivateFields). */
export type PrivateProfileUpdate = Partial<{
  email: string;
  phone: string;
  dateOfBirth: string;
  guardianEmail: string | null;
  guardianRelation: GuardianRelation | null;
}>;

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
const readGuardianRelation = (value: unknown): GuardianRelation | null =>
  value === 'biological_parent' || value === 'legal_guardian' ? value : null;
const readRestrictions = (value: unknown): AccountRestrictions | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as AccountRestrictions : null;

export class PrivateProfileService {
  private static instance: PrivateProfileService;

  private constructor() {}

  public static getInstance(): PrivateProfileService {
    if (!PrivateProfileService.instance) PrivateProfileService.instance = new PrivateProfileService();
    return PrivateProfileService.instance;
  }

  public reference(userId: string): DocumentReference<DocumentData> {
    return doc(db, 'users', userId, 'private', 'profile');
  }

  /**
   * The signed-in member's private fields. Accounts not yet migrated still carry them on users/{uid}, so
   * `legacyProfile` (that document's data, when the caller already has it) fills any field the private document lacks.
   */
  public async getOwn(userId: string, legacyProfile?: DocumentData | null): Promise<PrivateProfile> {
    const snapshot = await getDoc(this.reference(userId)).catch(() => null);
    return this.merge(snapshot?.data() ?? null, legacyProfile ?? null);
  }

  public merge(privateData: DocumentData | null, legacyProfile: DocumentData | null): PrivateProfile {
    const pick = (field: string): unknown => privateData?.[field] ?? legacyProfile?.[field];
    return {
      email: readString(pick('email')),
      phone: readString(pick('phone')) || readString(pick('phoneNumber')),
      dateOfBirth: readString(pick('dateOfBirth')) || readString(pick('birthday')),
      guardianEmail: readString(pick('guardianEmail')) || null,
      guardianRelation: readGuardianRelation(pick('guardianRelation')),
      statusReason: readString(pick('statusReason')),
      banReason: readString(pick('banReason')),
      suspensionReason: readString(pick('suspensionReason')),
      accountRestrictions: readRestrictions(pick('accountRestrictions')),
    };
  }

  /**
   * Administrators only: users/{uid} data for several members with their private fields laid over it
   * (a private value wins; a missing one falls back to the legacy users field).
   */
  public async withPrivateFields<T extends object>(users: { id: string; data: T }[]): Promise<T[]> {
    const privateProfiles = await Promise.all(users.map((user) => getDoc(this.reference(user.id)).catch(() => null)));
    return users.map((user, index) => {
      const privateData = privateProfiles[index]?.data() ?? {};
      const present = Object.entries(privateData).filter(([, value]) => value !== undefined && value !== null && value !== '');
      return { ...user.data, ...Object.fromEntries(present) } as T;
    });
  }

  /** The private-document write, for callers that batch it with their users/{uid} write. */
  public payload(update: PrivateProfileUpdate): PrivateProfileUpdate & { updatedAt: FieldValue } {
    return { ...update, updatedAt: serverTimestamp() };
  }

  public async update(userId: string, update: PrivateProfileUpdate): Promise<void> {
    await setDoc(this.reference(userId), this.payload(update), { merge: true });
  }
}

export const privateProfileService = PrivateProfileService.getInstance();
