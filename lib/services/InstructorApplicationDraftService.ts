import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInfoAsync } from 'expo-file-system/legacy';
import type { ApplicationType, CourseAvailability, CourseVisibility, PickedUpload } from '@/lib/types/instructor';

/** Everything typed or picked in "Become an instructor", kept on the phone until the application is sent. */
export type InstructorApplicationDraft = {
  stepIndex: number;
  applicationType: ApplicationType;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  qualification: string;
  expertise: string[];
  years: string;
  languages: string[];
  bio: string;
  previousTeaching: string;
  resume: PickedUpload | null;
  certificates: PickedUpload[];
  website: string;
  linkedin: string;
  subjects: string[];
  levels: string[];
  methods: string[];
  availability: CourseAvailability;
  intended: string;
  orgName: string;
  orgEmail: string;
  orgWebsite: string;
  orgType: string;
  orgRegistration: string;
  proof: PickedUpload | null;
  teachers: string;
  students: string;
  privatePortal: boolean;
  portalFeatures: string[];
  visibility: CourseVisibility;
  sample: PickedUpload | null;
  agreed: string[];
};

type StoredDraft = { version: 1; savedAt: string; draft: InstructorApplicationDraft };

const STORAGE_PREFIX = 'ourlime_instructor_application_draft_v1:';
// A draft nobody came back to for a month is dropped rather than filled in unexpectedly.
const MAX_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Keeps the instructor application on the phone while it is being filled in. Android can close the whole app while
 * the file picker is open (common on phones short of memory), which used to throw away everything typed so far.
 */
export class InstructorApplicationDraftService {
  private static instance: InstructorApplicationDraftService;

  private constructor() {}

  public static getInstance(): InstructorApplicationDraftService {
    if (!InstructorApplicationDraftService.instance) {
      InstructorApplicationDraftService.instance = new InstructorApplicationDraftService();
    }
    return InstructorApplicationDraftService.instance;
  }

  public async save(userId: string, draft: InstructorApplicationDraft): Promise<void> {
    const stored: StoredDraft = { version: 1, savedAt: new Date().toISOString(), draft };
    await AsyncStorage.setItem(this.key(userId), JSON.stringify(stored));
  }

  /** The saved draft, with any picked file that is no longer on the phone left out. */
  public async load(userId: string): Promise<InstructorApplicationDraft | null> {
    try {
      const raw = await AsyncStorage.getItem(this.key(userId));
      if (!raw) return null;
      const stored = JSON.parse(raw) as StoredDraft;
      if (stored.version !== 1 || !stored.draft || Date.now() - new Date(stored.savedAt).getTime() > MAX_DRAFT_AGE_MS) {
        await this.clear(userId);
        return null;
      }
      const { draft } = stored;
      const [resume, proof, sample, certificates] = await Promise.all([
        this.keepIfPresent(draft.resume),
        this.keepIfPresent(draft.proof),
        this.keepIfPresent(draft.sample),
        Promise.all((draft.certificates ?? []).map((certificate) => this.keepIfPresent(certificate))),
      ]);
      return { ...draft, resume, proof, sample, certificates: certificates.filter((certificate): certificate is PickedUpload => certificate !== null) };
    } catch (error: unknown) {
      console.error('[InstructorApplicationDraftService.load] Error:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  public async clear(userId: string): Promise<void> {
    await AsyncStorage.removeItem(this.key(userId));
  }

  private key(userId: string): string {
    return `${STORAGE_PREFIX}${userId}`;
  }

  /** Picked files are copied into the app's cache, which the phone may empty; a missing copy must be picked again. */
  private async keepIfPresent(file: PickedUpload | null | undefined): Promise<PickedUpload | null> {
    if (!file?.uri) return null;
    const info = await getInfoAsync(file.uri).catch(() => null);
    return info?.exists ? file : null;
  }
}

export const instructorApplicationDraftService = InstructorApplicationDraftService.getInstance();
