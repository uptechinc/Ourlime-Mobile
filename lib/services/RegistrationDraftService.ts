import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RegistrationVerificationType } from '@/lib/services/AuthService';

const REGISTRATION_DRAFT_KEY = 'ourlime-registration-draft-v1';
const REGISTRATION_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_VERIFICATION_KEY = 'ourlime-pending-email-verification-v1';
const PENDING_VERIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAXIMUM_STEP = 7;

/** Sign-up answers kept between visits, like the website's registration draft. Passwords and photos are never saved. */
export type RegistrationDraft = {
  step: number;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  accountType: 'student' | 'regular' | '';
  studentLevel: string;
  dateOfBirth: string;
  gender: string;
  country: string;
  state: string;
  phone: string;
  city: string;
  /** A preset avatar file name; uploaded photos are device files and are not restored. */
  profilePicture: string | null;
  selectedInterests: string[];
  verificationType: RegistrationVerificationType;
  guardianEmail: string;
  showInterestsPreview: boolean;
};

/** An account that was created and is waiting for its email to be verified (shown again if the page is reopened). */
export type PendingEmailVerification = { userId: string; email: string; verificationEmailSent: boolean };

type StoredRecord<TValue> = { savedAt: number; value: TValue };

const VERIFICATION_TYPES: readonly RegistrationVerificationType[] = ['student_id', 'national_id', 'guardian', 'drivers_license', 'skipped', ''];

/**
 * Saves the sign-up form so a visitor who leaves can continue where they stopped (7 days), and remembers a finished
 * sign-up that still needs email verification (24 hours), mirroring the website's localStorage draft.
 */
export class RegistrationDraftService {
  private static instance: RegistrationDraftService;

  private constructor() {}

  public static getInstance(): RegistrationDraftService {
    if (!RegistrationDraftService.instance) RegistrationDraftService.instance = new RegistrationDraftService();
    return RegistrationDraftService.instance;
  }

  public async loadDraft(): Promise<RegistrationDraft | null> {
    const record = await this.read(REGISTRATION_DRAFT_KEY, REGISTRATION_DRAFT_MAX_AGE_MS);
    if (!record || typeof record !== 'object') return null;
    const draft = record as { [field: string]: unknown };
    const text = (value: unknown): string => (typeof value === 'string' ? value : '');
    const step = typeof draft.step === 'number' && Number.isInteger(draft.step) && draft.step >= 0 && draft.step <= MAXIMUM_STEP ? draft.step : 0;
    const accountType = draft.accountType === 'student' || draft.accountType === 'regular' ? draft.accountType : '';
    const verificationType = VERIFICATION_TYPES.find((type) => type === draft.verificationType) ?? 'skipped';
    const profilePicture = typeof draft.profilePicture === 'string' && !/^(file:|content:|blob:)/i.test(draft.profilePicture) ? draft.profilePicture : null;
    return {
      // Passwords are never saved, so a draft past the account details resumes there to collect them again.
      step: Math.min(step, 2),
      firstName: text(draft.firstName),
      lastName: text(draft.lastName),
      userName: text(draft.userName),
      email: text(draft.email),
      accountType,
      studentLevel: text(draft.studentLevel),
      dateOfBirth: text(draft.dateOfBirth),
      gender: text(draft.gender),
      country: text(draft.country),
      state: text(draft.state),
      phone: text(draft.phone),
      city: text(draft.city),
      profilePicture,
      selectedInterests: Array.isArray(draft.selectedInterests)
        ? draft.selectedInterests.filter((interest): interest is string => typeof interest === 'string')
        : [],
      verificationType,
      guardianEmail: text(draft.guardianEmail),
      showInterestsPreview: draft.showInterestsPreview === true,
    };
  }

  public async saveDraft(draft: RegistrationDraft): Promise<void> {
    await this.write(REGISTRATION_DRAFT_KEY, draft);
  }

  public async clearDraft(): Promise<void> {
    await AsyncStorage.removeItem(REGISTRATION_DRAFT_KEY).catch((error: unknown) => console.error('[RegistrationDraftService.clearDraft] Error:', error));
  }

  public async loadPendingVerification(): Promise<PendingEmailVerification | null> {
    const record = await this.read(PENDING_VERIFICATION_KEY, PENDING_VERIFICATION_MAX_AGE_MS);
    if (!record || typeof record !== 'object') return null;
    const pending = record as { [field: string]: unknown };
    if (typeof pending.userId !== 'string' || !pending.userId || typeof pending.email !== 'string') return null;
    return { userId: pending.userId, email: pending.email, verificationEmailSent: pending.verificationEmailSent !== false };
  }

  public async savePendingVerification(pending: PendingEmailVerification): Promise<void> {
    await this.write(PENDING_VERIFICATION_KEY, pending);
  }

  public async clearPendingVerification(): Promise<void> {
    await AsyncStorage.removeItem(PENDING_VERIFICATION_KEY).catch((error: unknown) => console.error('[RegistrationDraftService.clearPendingVerification] Error:', error));
  }

  private async read(key: string, maximumAgeMs: number): Promise<unknown> {
    try {
      const serialized = await AsyncStorage.getItem(key);
      if (!serialized) return null;
      const parsed = JSON.parse(serialized) as Partial<StoredRecord<unknown>>;
      if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > maximumAgeMs) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      return parsed.value ?? null;
    } catch (error: unknown) {
      console.error('[RegistrationDraftService.read] Error:', error instanceof Error ? error.message : error);
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return null;
    }
  }

  private async write<TValue>(key: string, value: TValue): Promise<void> {
    const record: StoredRecord<TValue> = { savedAt: Date.now(), value };
    await AsyncStorage.setItem(key, JSON.stringify(record)).catch((error: unknown) => console.error('[RegistrationDraftService.write] Error:', error));
  }
}

export const registrationDraftService = RegistrationDraftService.getInstance();
