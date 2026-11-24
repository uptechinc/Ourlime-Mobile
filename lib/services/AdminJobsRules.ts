/** Pure job-moderation rules shared by AdminJobsService and its unit tests (no Firebase imports). */

export type AdminJobRecord = {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  status: string;
  createdAtSeconds: number;
  userId: string;
  priceRange: { from: number; to: number } | null;
  currency: string;
  location: string;
  skills: string[];
  employmentType: string;
  experienceLevel: string;
  posterName: string;
  posterUsername: string;
};

export type AdminJobDocumentData = { basic_info?: unknown; details?: unknown };

/** Newest jobs loaded into the moderation list; older ones are reached through the website. */
export const ADMIN_JOBS_FETCH_LIMIT = 500;

/** Statuses that take a job out of moderation entirely. */
const HIDDEN_JOB_STATUSES = new Set(['removed', 'deleted']);

type JobLocationValue = string | { type?: unknown } | undefined;

const readString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const readLocation = (value: JobLocationValue): string => {
  if (!value) return 'N/A';
  if (typeof value === 'string') return value || 'N/A';
  return readString(value.type, 'N/A') || 'N/A';
};

const readPriceRange = (value: unknown): AdminJobRecord['priceRange'] => {
  if (!value || typeof value !== 'object') return null;
  const range = value as { from?: unknown; to?: unknown };
  if (range.from === null || range.from === undefined || range.to === null || range.to === undefined) return null;
  const from = Number(range.from);
  const to = Number(range.to);
  return Number.isFinite(from) && Number.isFinite(to) ? { from, to } : null;
};

/** Maps a `jobs` document to a moderation row, or null when it has no basic_info or was removed/deleted. */
export const mapAdminJobDocument = (id: string, data: AdminJobDocumentData): AdminJobRecord | null => {
  if (!data.basic_info || typeof data.basic_info !== 'object') return null;
  const basic = data.basic_info as { [field: string]: unknown };
  if (HIDDEN_JOB_STATUSES.has(readString(basic.status))) return null;
  const details = (data.details && typeof data.details === 'object' ? data.details : undefined) as { skills?: unknown } | undefined;
  const createdAt = basic.createdAt as { seconds?: unknown } | undefined;
  return {
    id,
    title: readString(basic.title) || 'Untitled',
    description: readString(basic.description),
    type: readString(basic.type) || 'professional',
    category: readString(basic.category),
    status: readString(basic.status) || 'draft',
    createdAtSeconds: typeof createdAt?.seconds === 'number' ? createdAt.seconds : 0,
    userId: readString(basic.userId),
    priceRange: readPriceRange(basic.priceRange),
    currency: readString(basic.currency) || 'USD',
    location: readLocation(basic.location as JobLocationValue),
    skills: Array.isArray(details?.skills) ? details.skills.filter((skill): skill is string => typeof skill === 'string') : [],
    employmentType: readString(basic.employmentType),
    experienceLevel: readString(basic.experienceLevel),
    posterName: 'Unknown',
    posterUsername: '',
  };
};

/**
 * The rejection reason lives on basic_info, next to the status. The `jobs` rules only allow the keys
 * basic_info/details/category_specific/disclaimerAcknowledgment at the top level, so a top-level
 * rejectionReason would block the poster's later edits. A reason is required (empty string = missing), since it is shown to the poster.
 */
export const resolveRejectionReason = (reason: string): string => reason.trim();

type ErrorWithCode = { code?: unknown; message?: unknown };

/** Turns a Firestore or access error into a message an administrator can act on. */
export const describeJobActionError = (error: unknown, fallback: string): string => {
  const candidate = (error && typeof error === 'object' ? error : {}) as ErrorWithCode;
  const code = readString(candidate.code).replace(/^firestore\//, '');
  if (code === 'permission-denied') return `${fallback}: your account is not allowed to make this change.`;
  if (code === 'not-found') return `${fallback}: this record no longer exists. Pull to refresh.`;
  if (code === 'unavailable' || code === 'deadline-exceeded') return `${fallback}: the connection dropped. Check your network and try again.`;
  if (code === 'unauthenticated') return `${fallback}: sign in again and retry.`;
  const message = readString(candidate.message).trim();
  return message ? `${fallback}: ${message}` : `${fallback}. Please try again.`;
};
