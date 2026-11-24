import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth, db } from '@/lib/firebaseConfig';
import { nativeSessionService } from './NativeSessionService';
import {
  decodeCertificate,
  decodeEligibility,
  decodeLearningPath,
  decodePrerequisiteStatus,
  decodeProfileCertificate,
  decodePublicCertificate,
  decodeSuggestion,
  VERIFICATION_CODE_PATTERN,
} from './LearningDepthRules';
import type {
  Certificate,
  CertificateEligibility,
  CertificateNameDisplay,
  CourseSuggestion,
  LearningPath,
  PrerequisiteStatus,
  ProfileCertificate,
  PublicCertificate,
} from '@/lib/types/course';

/**
 * Learning depth for learners (E-Learning slice 4), through the manageLearning callable: learning paths with the
 * learner's progress, explained course suggestions, prerequisite status, and verified completion certificates (claim,
 * name and profile choices). Three reads go straight to Firestore under the rules: the learner's own certificates, a
 * public certificate check by code, and a member's profile certificates. The server decides everything that matters.
 */
export class LearningDepthService {
  private static instance: LearningDepthService;
  private constructor() {}

  public static getInstance(): LearningDepthService {
    if (!LearningDepthService.instance) LearningDepthService.instance = new LearningDepthService();
    return LearningDepthService.instance;
  }

  public async getPaths(): Promise<LearningPath[]> {
    const result = await this.call<{ paths?: unknown[] }>({ action: 'learning_paths' });
    return (result.paths ?? []).map(decodeLearningPath).filter((path): path is LearningPath => path !== null);
  }

  public async getSuggestions(): Promise<CourseSuggestion[]> {
    const result = await this.call<{ recommendations?: unknown[] }>({ action: 'course_recommendations' });
    return (result.recommendations ?? []).map(decodeSuggestion).filter((suggestion): suggestion is CourseSuggestion => suggestion !== null);
  }

  public async getPrerequisiteStatus(courseId: string): Promise<PrerequisiteStatus> {
    return decodePrerequisiteStatus((await this.call<{ status?: unknown }>({ action: 'course_prerequisites', courseId })).status, courseId);
  }

  /** Issues the certificate when the server agrees the learner finished; otherwise says what is still missing. */
  public async claimCertificate(courseId: string): Promise<{ certificate: Certificate | null; eligibility: CertificateEligibility }> {
    const result = await this.call<{ certificate?: unknown; eligibility?: unknown }>({ action: 'claim_certificate', courseId });
    return { certificate: result.certificate ? decodeCertificate('', result.certificate) : null, eligibility: decodeEligibility(result.eligibility) };
  }

  public async getMyCertificates(): Promise<Certificate[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    const snapshot = await getDocs(query(collection(db, 'certificates'), where('userId', '==', userId), orderBy('issuedAt', 'desc'), limit(50)));
    return snapshot.docs.map((entry) => decodeCertificate(entry.id, entry.data())).filter((certificate): certificate is Certificate => certificate !== null);
  }

  public async setCertificatePreferences(certificateId: string, preferences: { nameDisplay?: CertificateNameDisplay; showOnProfile?: boolean }): Promise<Certificate> {
    const result = await this.call<{ certificate?: unknown }>({ action: 'set_certificate_preferences', certificateId, ...preferences });
    const certificate = decodeCertificate(certificateId, result.certificate);
    if (!certificate) throw new Error('The certificate could not be read back.');
    return certificate;
  }

  /** The public check by code (anyone may read one certificate; nobody may list them). Null when there is none. */
  public async getPublicCertificate(code: string): Promise<PublicCertificate | null> {
    if (!VERIFICATION_CODE_PATTERN.test(code)) return null;
    const snapshot = await getDoc(doc(db, 'certificateVerifications', code));
    return snapshot.exists() ? decodePublicCertificate(code, snapshot.data()) : null;
  }

  /** Certificates a member chose to show on their profile. */
  public async getProfileCertificates(userId: string): Promise<ProfileCertificate[]> {
    const snapshot = await getDocs(query(collection(db, 'profileCertificates'), where('userId', '==', userId), orderBy('issuedAt', 'desc'), limit(20)));
    return snapshot.docs.map((entry) => decodeProfileCertificate(entry.id, entry.data()));
  }

  private async call<Result = unknown>(request: { action: string } & { [field: string]: unknown }): Promise<Result> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to continue.');
    await nativeSessionService.ensure(userId);
    const result = await httpsCallable<typeof request, Result>(getFunctions(app), 'manageLearning')(request);
    nativeSessionService.assertOwner(userId);
    return result.data;
  }
}

export const learningDepthService = LearningDepthService.getInstance();
