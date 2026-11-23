/**
 * Pure Jobs rules shared by the job forms and JobDataService, the same rules as the website's lib/job/JobRules.ts.
 * No Firebase imports, so they can be unit tested (lib/services/JobRules.test.mjs).
 */

/**
 * Status changes the job's poster may make: pending -> reviewing -> interviewing -> offer -> accepted, or rejected
 * along the way. 'withdrawn' is the applicant's own action (the Firestore rules refuse it from the poster), and final
 * statuses stay final.
 */
export const EMPLOYER_APPLICATION_TRANSITIONS: { readonly [status: string]: readonly string[] } = {
  pending: ['reviewing', 'rejected'],
  reviewing: ['interviewing', 'offer', 'accepted', 'rejected'],
  interviewing: ['offer', 'accepted', 'rejected'],
  offer: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
  withdrawn: [],
  job_withdrawn: [],
};

export function canEmployerChangeApplicationStatus(previousStatus: unknown, nextStatus: unknown): boolean {
  if (typeof previousStatus !== 'string' || typeof nextStatus !== 'string') return false;
  if (!Object.prototype.hasOwnProperty.call(EMPLOYER_APPLICATION_TRANSITIONS, previousStatus)) return false;
  return EMPLOYER_APPLICATION_TRANSITIONS[previousStatus].includes(nextStatus);
}

/** Applicants may withdraw while their application is still pending or being reviewed. */
export function canApplicantWithdraw(status: unknown): boolean {
  return status === 'pending' || status === 'reviewing';
}

/**
 * A closing date picked on the calendar (any time of that day) as the last second of that local day, so the job stays
 * open through the whole picked day, as on the website.
 */
export function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 0);
}
