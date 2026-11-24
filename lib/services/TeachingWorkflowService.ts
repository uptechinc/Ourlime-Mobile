import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth, db } from '@/lib/firebaseConfig';
import { settleAll } from '@/lib/utils/settleAll';
import { nativeSessionService } from './NativeSessionService';
import {
  decodeCohort,
  decodeGradeAppeal,
  decodeGradeAppeals,
  decodeRoster,
  decodeSession,
  decodeSessions,
  decodeSubmissionHistory,
  newOperationId,
  readIso,
} from './AssignmentPolicy';
import type { CourseCohort, CourseSession, GradeAppeal, RosterLearner, SessionKind, SessionRecording, SubmissionHistory } from '@/lib/types/course';
import type { AssignmentSettingsUpdate, StaffCourse } from '@/lib/types/instructor';

/** One criterion as graded: the chosen level and optional feedback (the server copies titles and points). */
export type RubricScoreInput = { criterionId: string; levelId: string; feedback: string };
/** A grade as the grader sends it: rubric scores when the assignment has a rubric, otherwise a score. */
export type GradeInput = {
  submissionId: string;
  /** The version the grader saw; the server refuses when the learner has handed in a newer one. */
  version: number;
  feedback: string;
  draft: boolean;
  waiveLatePenalty: boolean;
  note?: string;
  score?: number;
  rubricScores?: RubricScoreInput[];
};
export type GradeResult = { score: number; rawScore: number; maxScore: number };
export type ReviewResponseInput = {
  appealId: string;
  decision: 'uphold' | 'adjust';
  note: string;
  waiveLatePenalty: boolean;
  score?: number;
  rubricScores?: RubricScoreInput[];
};
export type CohortInput = {
  name: string;
  description: string;
  startsAt: Date | null;
  endsAt: Date | null;
  capacity: number | null;
  enrollmentOpensAt: Date | null;
  enrollmentClosesAt: Date | null;
};
export type SessionInput = {
  cohortId: string;
  kind: SessionKind;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  joinUrl: string;
  recording: SessionRecording;
  recordingNote: string;
};

/**
 * The course staff's side of E-Learning slice 3, all through the manageLearning callable (the server checks the caller
 * is the course's instructor, an administrator, or an assistant of the cohort the work belongs to):
 *  - grading with rubrics, the late penalty (waivable) and draft grades; assignment settings;
 *  - grade review requests (list and answer) and submission history;
 *  - classes (cohorts): create/edit/archive, assistants, the class requirement, roster and moving learners;
 *  - scheduled sessions (live class, office hours, deadline) with an external join link.
 * Reads that the rules allow (cohorts, the assistant's own courseStaff records) go straight to Firestore.
 */
export class TeachingWorkflowService {
  private static instance: TeachingWorkflowService;
  private constructor() {}

  public static getInstance(): TeachingWorkflowService {
    if (!TeachingWorkflowService.instance) TeachingWorkflowService.instance = new TeachingWorkflowService();
    return TeachingWorkflowService.instance;
  }

  // ── Assistants ──

  /** Courses the member assists in (courseStaff where userId == uid), with the course title when it can be read. */
  public async getStaffCourses(userId: string): Promise<StaffCourse[]> {
    const snapshot = await getDocs(query(collection(db, 'courseStaff'), where('userId', '==', userId), limit(50)));
    const records = snapshot.docs.map((item) => {
      const data = item.data();
      const cohortIds = Array.isArray(data.cohortIds) ? data.cohortIds.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];
      return { courseId: typeof data.courseId === 'string' ? data.courseId : '', cohortIds };
    }).filter((record) => record.courseId && record.cohortIds.length > 0);
    const courses = await settleAll(records.map((record) => getDoc(doc(db, 'courses', record.courseId))));
    return records.map((record, index): StaffCourse => {
      const result = courses[index];
      const title = result.status === 'fulfilled' && typeof result.value.data()?.title === 'string' ? String(result.value.data()?.title).trim() : '';
      return { ...record, title: title || 'Course' };
    }).sort((left, right) => left.title.localeCompare(right.title));
  }

  // ── Assignment settings and grading ──

  public async updateAssignmentSettings(lessonId: string, update: AssignmentSettingsUpdate): Promise<void> {
    await this.call({ action: 'update_assignment_settings', lessonId, ...update });
  }

  /** draft: saved server-only (the learner sees nothing); otherwise published, with a grade-history event. */
  public async grade(input: GradeInput): Promise<GradeResult> {
    const result = await this.call<{ score?: unknown; rawScore?: unknown; maxScore?: unknown }>({
      action: 'grade_submission', submissionId: input.submissionId, version: input.version, feedback: input.feedback.trim(), draft: input.draft,
      waiveLatePenalty: input.waiveLatePenalty,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(input.rubricScores ? { rubricScores: input.rubricScores.map((score) => ({ ...score, feedback: score.feedback.trim() })) } : { score: input.score }),
    });
    const number = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
    return { score: number(result.score), rawScore: number(result.rawScore), maxScore: number(result.maxScore) };
  }

  public async getSubmissionHistory(submissionId: string): Promise<SubmissionHistory> {
    return decodeSubmissionHistory(await this.call({ action: 'submission_history', submissionId }));
  }

  /** Review requests in a course the caller may answer (open ones by default, oldest first). */
  public async getGradeReviews(courseId: string, status: 'open' | 'all' = 'open'): Promise<GradeAppeal[]> {
    const result = await this.call<{ appeals?: unknown }>({ action: 'grade_reviews', courseId, status });
    return decodeGradeAppeals(result.appeals);
  }

  /** Keep (uphold) or change (adjust, scored like any grade) a grade after a review request; the note is required. */
  public async respondToReview(input: ReviewResponseInput): Promise<GradeAppeal> {
    const result = await this.call<{ appeal?: unknown }>({
      action: 'respond_grade_review', appealId: input.appealId, decision: input.decision, note: input.note.trim(),
      ...(input.decision === 'adjust' ? {
        waiveLatePenalty: input.waiveLatePenalty,
        ...(input.rubricScores ? { rubricScores: input.rubricScores.map((score) => ({ ...score, feedback: score.feedback.trim() })) } : { score: input.score }),
      } : {}),
    });
    const appeal = decodeGradeAppeal(result.appeal);
    if (!appeal) throw new Error('The answer was not confirmed. Pull down to refresh.');
    return appeal;
  }

  // ── Classes (cohorts) ──

  public async getCohorts(courseId: string): Promise<CourseCohort[]> {
    const snapshot = await getDocs(query(collection(db, 'courseCohorts'), where('courseId', '==', courseId), limit(100)));
    return snapshot.docs.map((item) => decodeCohort(item.data(), item.id))
      .filter((item): item is CourseCohort => item !== null)
      .sort((left, right) => Number(left.status === 'archived') - Number(right.status === 'archived') || (left.startsAt ?? '9999').localeCompare(right.startsAt ?? '9999') || left.name.localeCompare(right.name));
  }

  /** Creates (a new operation id; retry-safe) or edits a class. */
  public async saveCohort(courseId: string, input: CohortInput, cohortId?: string, operationId = newOperationId('cohort')): Promise<CourseCohort> {
    const result = await this.call<{ cohort?: unknown }>({
      action: 'save_cohort', courseId, ...(cohortId ? { cohortId } : { operationId }),
      name: input.name.trim(), description: input.description.trim(), capacity: input.capacity,
      startsAt: this.iso(input.startsAt), endsAt: this.iso(input.endsAt), enrollmentOpensAt: this.iso(input.enrollmentOpensAt), enrollmentClosesAt: this.iso(input.enrollmentClosesAt),
    });
    return this.requireCohort(result.cohort);
  }

  /** Archive closes a class to new learners (members and their work stay); restore reopens it. */
  public async archiveCohort(cohortId: string, restore: boolean): Promise<CourseCohort> {
    return this.requireCohort((await this.call<{ cohort?: unknown }>({ action: 'archive_cohort', cohortId, restore })).cohort);
  }

  /** Adds an assistant by Ourlime username (adults with an active account who are not learners of the course). */
  public async addAssistant(cohortId: string, userName: string): Promise<CourseCohort> {
    return this.requireCohort((await this.call<{ cohort?: unknown }>({ action: 'add_cohort_assistant', cohortId, userName: userName.trim().replace(/^@+/, '') })).cohort);
  }

  public async removeAssistant(cohortId: string, userId: string): Promise<CourseCohort> {
    return this.requireCohort((await this.call<{ cohort?: unknown }>({ action: 'remove_cohort_assistant', cohortId, userId })).cohort);
  }

  public async setCohortRequirement(courseId: string, required: boolean): Promise<void> {
    await this.call({ action: 'set_cohort_requirement', courseId, required });
  }

  /** Places an enrolled learner in a class, moves them, or takes them out of every class (cohortId ''). */
  public async assignLearner(courseId: string, userId: string, cohortId: string): Promise<void> {
    await this.call({ action: 'assign_learner_cohort', courseId, userId, cohortId });
  }

  /** null: everyone (instructor only); '': learners in no class (instructor only); an id: that class's roster. */
  public async getRoster(courseId: string, cohortId: string | null): Promise<{ learners: RosterLearner[]; truncated: boolean }> {
    const result = await this.call<{ learners?: unknown; truncated?: unknown }>({ action: 'course_roster', courseId, ...(cohortId !== null ? { cohortId } : {}) });
    return { learners: decodeRoster(result.learners), truncated: result.truncated === true };
  }

  // ── Sessions ──

  /** upcoming: from three hours ago, soonest first; all: the latest 100 including past ones. */
  public async getSessions(courseId: string, range: 'upcoming' | 'all'): Promise<CourseSession[]> {
    const result = await this.call<{ sessions?: unknown }>({ action: 'course_sessions', courseId, ...(range === 'all' ? { range: 'all' } : {}) });
    return decodeSessions(result.sessions);
  }

  public async saveSession(courseId: string, input: SessionInput, sessionId?: string, operationId = newOperationId('session')): Promise<CourseSession> {
    const result = await this.call<{ session?: unknown }>({
      action: 'save_session', courseId, ...(sessionId ? { sessionId } : { operationId }), cohortId: input.cohortId, kind: input.kind,
      title: input.title.trim(), description: input.description.trim(), startsAt: input.startsAt.toISOString(), endsAt: this.iso(input.endsAt),
      joinUrl: input.kind === 'deadline' ? '' : input.joinUrl.trim(), recording: input.kind === 'deadline' ? 'not_recorded' : input.recording,
      recordingNote: input.recording === 'recorded' && input.kind !== 'deadline' ? input.recordingNote.trim() : '',
    });
    return this.requireSession(result.session);
  }

  public async cancelSession(sessionId: string): Promise<CourseSession> {
    return this.requireSession((await this.call<{ session?: unknown }>({ action: 'cancel_session', sessionId })).session);
  }

  // ── Internals ──

  private iso(value: Date | null): string | null {
    return value ? readIso(value) : null;
  }

  private requireCohort(value: unknown): CourseCohort {
    const cohort = decodeCohort(value);
    if (!cohort) throw new Error('The class was not confirmed. Pull down to refresh.');
    return cohort;
  }

  private requireSession(value: unknown): CourseSession {
    const session = decodeSession(value);
    if (!session) throw new Error('The session was not confirmed. Pull down to refresh.');
    return session;
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

export const teachingWorkflowService = TeachingWorkflowService.getInstance();

/** The server's refusal as a sentence for the screen (its messages are written for members), or the fallback. */
export function serverMessage(error: unknown, fallback: string): string {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = error instanceof Error ? error.message.replace(/^[A-Za-z-]+\/[a-z-]+:?\s*/, '').trim() : '';
  if (/(failed-precondition|invalid-argument|permission-denied|not-found|already-exists)$/.test(code) && message && !/^internal$/i.test(message)) return message;
  return fallback;
}
