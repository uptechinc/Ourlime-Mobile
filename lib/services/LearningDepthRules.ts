import { OURLIME_SITE_URL } from '@/lib/constants/site';
import type {
  Certificate,
  CertificateEligibility,
  CertificateMissingReason,
  CertificateNameDisplay,
  CourseSuggestion,
  LearnerCourseState,
  LearningPath,
  PrerequisiteLink,
  PrerequisiteStatus,
  ProfileCertificate,
  PublicCertificate,
} from '@/lib/types/course';

/*
 * Pure decoders and wording for learning depth (E-Learning slice 4), shared by the catalog, course screen, My learning,
 * the certificate screen and the profile. The server decides prerequisites, eligibility and every certificate fact;
 * these only read what it stored or returned, leniently, and say it in plain words. No Firebase here (unit-tested).
 */

type Source = { [field: string]: unknown };

export const CERTIFICATE_LABEL = 'Ourlime course completion — not an accredited qualification';
export const NAME_DISPLAY_OPTIONS: { value: CertificateNameDisplay; label: string }[] = [
  { value: 'name', label: 'My name' },
  { value: 'short', label: 'First name and initial' },
  { value: 'hidden', label: 'Hide my name' },
];
export const VERIFICATION_CODE_PATTERN = /^OLC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const object = (value: unknown): Source | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Source : null);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const number = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** A Firestore Timestamp, a Date or an ISO string as an ISO string. */
export function readIsoDate(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    const date: unknown = (value as { toDate: () => unknown }).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return typeof value === 'string' && value && Number.isFinite(Date.parse(value)) ? value : null;
}

export function readPrerequisiteLinks(value: unknown): PrerequisiteLink[] {
  return list(value).flatMap((entry) => {
    const link = object(entry);
    return link && text(link.courseId) ? [{ courseId: text(link.courseId), title: text(link.title) || 'Course', required: link.required === true }] : [];
  }).slice(0, 10);
}

export function decodePrerequisiteStatus(value: unknown, courseId: string): PrerequisiteStatus {
  const source = object(value) ?? {};
  return {
    courseId,
    links: list(source.links).flatMap((entry) => {
      const link = object(entry);
      return link && text(link.courseId) ? [{ courseId: text(link.courseId), title: text(link.title) || 'Course', required: link.required === true, completed: link.completed === true }] : [];
    }),
    missingRequired: readPrerequisiteLinks(source.missingRequired),
    missingRecommended: readPrerequisiteLinks(source.missingRecommended),
  };
}

/** "Complete "Basics" and "Tools" before you enroll in this course." (the same words the server refuses with). */
export function prerequisiteBlockMessage(missing: readonly PrerequisiteLink[]): string {
  if (missing.length === 0) return '';
  const titles = missing.map((link) => `"${link.title}"`);
  const joined = titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
  return `Complete ${joined} before you enroll in this course.`;
}

const STATES: readonly LearnerCourseState[] = ['completed', 'in_progress', 'not_started', 'unavailable'];

export function decodeLearningPath(value: unknown): LearningPath | null {
  const source = object(value);
  if (!source || !text(source.id)) return null;
  const progress = object(source.progress);
  return {
    id: text(source.id), title: text(source.title) || 'Learning path', description: text(source.description), level: text(source.level) || 'mixed',
    ownerName: text(source.ownerName) || 'Instructor',
    courses: list(source.courses).flatMap((entry) => {
      const course = object(entry);
      return course && text(course.courseId) ? [{ courseId: text(course.courseId), title: text(course.title) || 'Course', image: text(course.image), available: course.available === true }] : [];
    }),
    progress: progress ? {
      steps: list(progress.steps).flatMap((entry) => {
        const step = object(entry);
        const state = STATES.find((candidate) => candidate === step?.state);
        return step && text(step.courseId) && state ? [{ courseId: text(step.courseId), title: text(step.title) || 'Course', state, progress: Math.max(0, Math.min(100, number(step.progress))) }] : [];
      }),
      completedCount: number(progress.completedCount), availableCount: number(progress.availableCount), percent: Math.max(0, Math.min(100, number(progress.percent))),
      nextCourseId: text(progress.nextCourseId) || null, nextReason: text(progress.nextReason),
    } : null,
  };
}

export function decodeSuggestion(value: unknown): CourseSuggestion | null {
  const source = object(value);
  if (!source || !text(source.courseId)) return null;
  const reasons = list(source.reasons).map((entry) => text(object(entry)?.text)).filter(Boolean);
  // A suggestion is never shown without the reason behind it.
  if (reasons.length === 0) return null;
  return { courseId: text(source.courseId), title: text(source.title) || 'Course', image: text(source.image), category: text(source.category), instructorName: text(source.instructorName), reasons };
}

const certificateStatus = (value: unknown): 'valid' | 'revoked' => (value === 'revoked' ? 'revoked' : 'valid');

export function decodePublicCertificate(code: string, value: unknown): PublicCertificate {
  const source = object(value) ?? {};
  return {
    code, courseId: text(source.courseId), courseTitle: text(source.courseTitle) || 'Course',
    courseVersion: number(source.courseVersion) >= 1 ? number(source.courseVersion) : 1, instructorName: text(source.instructorName), criteria: text(source.criteria),
    completedAt: readIsoDate(source.completedAt), issuedAt: readIsoDate(source.issuedAt), status: certificateStatus(source.status),
    statusChangedAt: readIsoDate(source.statusChangedAt), correctedAt: readIsoDate(source.correctedAt), learnerName: text(source.learnerName),
  };
}

/** The learner's own certificate, from certificates/{id} or the server's certificate view (code or verificationCode). */
export function decodeCertificate(id: string, value: unknown): Certificate | null {
  const source = object(value);
  const code = text(source?.code) || text(source?.verificationCode);
  if (!source || !VERIFICATION_CODE_PATTERN.test(code)) return null;
  const isMinor = source.isMinor === true;
  const display = NAME_DISPLAY_OPTIONS.find((option) => option.value === source.nameDisplay)?.value ?? 'name';
  return {
    ...decodePublicCertificate(code, source), id: text(source.id) || id, statusReason: text(source.statusReason),
    nameDisplay: isMinor && display === 'name' ? 'short' : display, showOnProfile: source.showOnProfile === true, isMinor,
  };
}

export function decodeEligibility(value: unknown): CertificateEligibility {
  const source = object(value) ?? {};
  const reasons: readonly CertificateMissingReason[] = ['not_completed', 'quiz_not_attempted', 'assignment_not_submitted'];
  return {
    eligible: source.eligible === true, requiredCount: number(source.requiredCount), completedCount: number(source.completedCount),
    missing: list(source.missing).flatMap((entry) => {
      const item = object(entry);
      const reason = reasons.find((candidate) => candidate === item?.reason);
      return item && text(item.lessonId) && reason ? [{ lessonId: text(item.lessonId), title: text(item.title) || 'Lesson', reason }] : [];
    }),
  };
}

export function decodeProfileCertificate(code: string, value: unknown): ProfileCertificate {
  const source = object(value) ?? {};
  return { code, courseTitle: text(source.courseTitle) || 'Course', instructorName: text(source.instructorName), completedAt: readIsoDate(source.completedAt) };
}

export function missingReasonLabel(reason: CertificateMissingReason): string {
  if (reason === 'quiz_not_attempted') return 'Submit an attempt';
  if (reason === 'assignment_not_submitted') return 'Hand it in';
  return 'Complete this lesson';
}

export function learnerCourseStateLabel(state: LearnerCourseState): string {
  if (state === 'completed') return 'Completed';
  if (state === 'in_progress') return 'In progress';
  if (state === 'unavailable') return 'No longer available';
  return 'Not started';
}

/** The public check on the website, which anyone with the link can open (and print or save as a PDF). */
export function certificateWebLink(code: string): string {
  return `${OURLIME_SITE_URL}/eLearning/certificates/${encodeURIComponent(code)}`;
}

export function formatCertificateDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
