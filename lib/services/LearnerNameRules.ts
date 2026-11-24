/**
 * How a learner's name appears to other learners on reviews and discussions (Stage 0 audit decision D11).
 *
 * Student accounts (13-15 must be `accountType: 'student'`) show only a first name and last initial, such as "Maya R.".
 * When the profile cannot be read, the stored name is shortened the same way, because the app cannot tell whether
 * the writer is a minor. An email address is never shown. Instructors grading their own learners are not affected.
 */
export type LearnerProfileFields = {
  firstName?: unknown;
  lastName?: unknown;
  displayName?: unknown;
  userName?: unknown;
  accountType?: unknown;
};

const FALLBACK_NAME = 'Learner';

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const isEmailLike = (value: string): boolean => value.includes('@');

/** "Maya Ramdial" -> "Maya R."; a single word stays as it is; empty input gives ''. */
export function shortenName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0];
  const lastWord = words[words.length - 1];
  return `${words[0]} ${lastWord.charAt(0).toUpperCase()}.`;
}

/** Student accounts are the platform's minor accounts; everything else is treated as an adult account. */
export function isStudentAccount(profile: LearnerProfileFields | null | undefined): boolean {
  return readText(profile?.accountType).toLowerCase() === 'student';
}

/**
 * The name other learners see. `storedName` is what the server copied onto the review or discussion (it may be a full
 * name or, for some older accounts, an email address).
 */
export function learnerPublicName(profile: LearnerProfileFields | null | undefined, storedName = ''): string {
  const stored = readText(storedName);
  if (!profile) {
    const shortened = isEmailLike(stored) ? '' : shortenName(stored);
    return shortened || FALLBACK_NAME;
  }
  const firstName = readText(profile.firstName);
  const lastName = readText(profile.lastName);
  if (isStudentAccount(profile)) {
    const fromProfile = firstName ? shortenName([firstName, lastName].filter(Boolean).join(' ')) : '';
    const fromStored = isEmailLike(stored) ? '' : shortenName(stored);
    return fromProfile || fromStored || FALLBACK_NAME;
  }
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const candidates = [readText(profile.displayName), fullName, stored, readText(profile.userName)];
  return candidates.find((candidate) => candidate && !isEmailLike(candidate)) ?? FALLBACK_NAME;
}
