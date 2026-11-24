import type {
  AppliedLatePenalty,
  AssignmentRubric,
  AssignmentSubmission,
  CourseCohort,
  CourseSession,
  GradeAppeal,
  GradeAppealStatus,
  GradeEvent,
  GradeEventKind,
  LatePenaltyPolicy,
  ResubmissionPolicy,
  RosterLearner,
  RubricCriterion,
  RubricLevel,
  RubricScore,
  SessionKind,
  SubmissionHistory,
  SubmissionVersion,
} from '@/lib/types/course';
import type { AssignmentPolicyDraft, AssignmentSettingsUpdate, RubricCriterionDraft, RubricLevelDraft } from '@/lib/types/instructor';

/*
 * Pure rules the app shares with the server for assignment teaching workflows (E-Learning slice 3): lenient decoders for
 * what the server stores and returns, the late-penalty arithmetic (identical to functions/src/AssignmentPolicyRules),
 * plain-English descriptions, and what the learner may do next. The server always decides; these only explain and
 * avoid offering an action it would refuse. No Firebase here, so everything is unit-tested.
 */

type Source = { [field: string]: unknown };

export const RUBRIC_MAX_CRITERIA = 20;
export const RUBRIC_MAX_LEVELS = 6;
export const RUBRIC_MAX_LEVEL_POINTS = 1000;
export const MAX_RESUBMISSIONS = 10;
export const APPEAL_WINDOW_DAYS = 30;
export const APPEAL_REASON_MAX = 2000;
export const APPEAL_NOTE_MAX = 2000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const NO_LATE_PENALTY: LatePenaltyPolicy = { type: 'none', percent: 0, maxPercent: 0 };
export const NO_RESUBMISSION: ResubmissionPolicy = { allowed: false, maxResubmissions: 0, until: null };

const object = (value: unknown): Source | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Source : null);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const count = (value: unknown): number => Math.max(0, Math.round(finite(value) ?? 0));
const round2 = (value: number): number => Math.round(value * 100) / 100;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,60}$/;

/** A Firestore Timestamp, Date or ISO string as a Date (null when it cannot be read). */
export function readDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const candidate = object(value);
  if (candidate && typeof candidate.toDate === 'function') {
    const converted: unknown = (candidate.toDate as () => unknown)();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }
  return null;
}

export const readIso = (value: unknown): string | null => readDate(value)?.toISOString() ?? null;

/** A retry-safe id the server accepts (letters, digits, _ and -). */
export function newOperationId(prefix: string): string {
  return `${prefix.replace(/[^A-Za-z0-9_-]/g, '')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Rubric ──

/** A stored rubric, read leniently: malformed criteria or levels are dropped; null when nothing usable is left. */
export function decodeRubric(value: unknown): AssignmentRubric | null {
  const source = object(value);
  if (!source || !Array.isArray(source.criteria)) return null;
  const criteria = source.criteria.flatMap((entry: unknown): RubricCriterion[] => {
    const criterion = object(entry);
    if (!criterion || !text(criterion.id) || !Array.isArray(criterion.levels)) return [];
    const levels = criterion.levels.flatMap((levelEntry: unknown): RubricLevel[] => {
      const level = object(levelEntry);
      const points = finite(level?.points);
      return level && text(level.id) && points !== null ? [{ id: text(level.id), title: text(level.title) || 'Level', description: text(level.description), points: Math.max(0, points) }] : [];
    });
    if (levels.length === 0) return [];
    return [{ id: text(criterion.id), title: text(criterion.title) || 'Criterion', description: text(criterion.description), levels, maxPoints: Math.max(...levels.map((level) => level.points)) }];
  });
  if (criteria.length === 0) return null;
  const totalPoints = criteria.reduce((total, criterion) => total + criterion.maxPoints, 0);
  return totalPoints > 0 ? { criteria, totalPoints } : null;
}

export function decodeRubricScores(value: unknown): RubricScore[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown): RubricScore[] => {
    const score = object(entry);
    const points = finite(score?.points);
    if (!score || !text(score.criterionId) || points === null) return [];
    return [{
      criterionId: text(score.criterionId), criterionTitle: text(score.criterionTitle), levelId: text(score.levelId), levelTitle: text(score.levelTitle),
      points, maxPoints: finite(score.maxPoints) ?? points, feedback: text(score.feedback),
    }];
  });
}

/** The points a set of chosen levels adds up to (criterion id → level id). */
export function rubricRawScore(rubric: AssignmentRubric, choices: { [criterionId: string]: string }): number {
  return rubric.criteria.reduce((total, criterion) => total + (criterion.levels.find((level) => level.id === choices[criterion.id])?.points ?? 0), 0);
}

/** Whether every criterion has a level chosen. */
export function isRubricComplete(rubric: AssignmentRubric, choices: { [criterionId: string]: string }): boolean {
  return rubric.criteria.every((criterion) => criterion.levels.some((level) => level.id === choices[criterion.id]));
}

let idCounter = 0;
/** A rubric criterion or level id the server accepts. */
export function newRubricId(prefix: 'c' | 'l'): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function emptyCriterionDraft(): RubricCriterionDraft {
  return {
    id: newRubricId('c'), title: '', description: '', levels: [
      { id: newRubricId('l'), title: 'Excellent', description: '', points: '10' },
      { id: newRubricId('l'), title: 'Good', description: '', points: '7' },
      { id: newRubricId('l'), title: 'Needs work', description: '', points: '3' },
    ],
  };
}

export function rubricToDraft(rubric: AssignmentRubric | null | undefined): RubricCriterionDraft[] {
  return (rubric?.criteria ?? []).map((criterion) => ({
    id: criterion.id, title: criterion.title, description: criterion.description,
    levels: criterion.levels.map((level): RubricLevelDraft => ({ id: level.id, title: level.title, description: level.description, points: String(level.points) })),
  }));
}

/**
 * The rubric the server receives, from the editor's drafts: an empty list means "no rubric" (points-only grading).
 * Errors are written for the instructor and match what the server would refuse.
 */
export function buildRubricInput(drafts: RubricCriterionDraft[]): { rubric: AssignmentSettingsUpdate['rubric']; totalPoints: number; errors: string[] } {
  if (drafts.length === 0) return { rubric: null, totalPoints: 0, errors: [] };
  const errors: string[] = [];
  if (drafts.length > RUBRIC_MAX_CRITERIA) errors.push(`A rubric can have at most ${RUBRIC_MAX_CRITERIA} criteria.`);
  let totalPoints = 0;
  const criteria = drafts.map((criterion, criterionIndex) => {
    const label = criterion.title.trim() || `Criterion ${criterionIndex + 1}`;
    if (!criterion.title.trim()) errors.push(`Name criterion ${criterionIndex + 1}.`);
    if (!ID_PATTERN.test(criterion.id)) errors.push(`${label} has an invalid ID.`);
    if (criterion.levels.length === 0) errors.push(`${label} needs at least one level.`);
    if (criterion.levels.length > RUBRIC_MAX_LEVELS) errors.push(`${label} can have at most ${RUBRIC_MAX_LEVELS} levels.`);
    const levels = criterion.levels.map((level, levelIndex) => {
      const points = Number(level.points);
      if (!level.title.trim()) errors.push(`Name level ${levelIndex + 1} of ${label}.`);
      if (level.points.trim() === '' || !Number.isInteger(points) || points < 0 || points > RUBRIC_MAX_LEVEL_POINTS) errors.push(`Points for "${level.title.trim() || `level ${levelIndex + 1}`}" in ${label} must be a whole number from 0 to ${RUBRIC_MAX_LEVEL_POINTS}.`);
      return { id: level.id, title: level.title.trim(), description: level.description.trim(), points: Number.isInteger(points) ? points : 0 };
    });
    totalPoints += levels.length ? Math.max(...levels.map((level) => level.points)) : 0;
    return { id: criterion.id, title: criterion.title.trim(), description: criterion.description.trim(), levels };
  });
  if (errors.length === 0 && totalPoints <= 0) errors.push('A rubric must be worth at least one point.');
  return { rubric: { criteria }, totalPoints, errors: [...new Set(errors)] };
}

// ── Late policy ──

export function decodeLatePenalty(value: unknown): LatePenaltyPolicy {
  const source = object(value);
  const type = text(source?.type);
  const percent = finite(source?.percent);
  if (!source || (type !== 'percent' && type !== 'percent_per_day') || percent === null || percent <= 0) return NO_LATE_PENALTY;
  const clamped = Math.min(100, percent);
  if (type === 'percent') return { type, percent: clamped, maxPercent: clamped };
  return { type, percent: clamped, maxPercent: Math.min(100, Math.max(clamped, finite(source.maxPercent) ?? 100)) };
}

export function decodeAppliedPenalty(value: unknown): AppliedLatePenalty | null {
  const source = object(value);
  const percent = finite(source?.percent);
  if (!source || percent === null) return null;
  return { lateDays: count(source.lateDays), percent, points: finite(source.points) ?? 0, waived: source.waived === true };
}

/** Started days after the due date (0 when on time or without a due date). */
export function lateDaysBetween(dueDate: string | Date | null | undefined, submittedAt: Date): number {
  const due = dueDate instanceof Date ? dueDate : readDate(dueDate);
  if (!due) return 0;
  const difference = submittedAt.getTime() - due.getTime();
  return difference > 0 ? Math.ceil(difference / DAY_MS) : 0;
}

export function latePenaltyPercent(policy: LatePenaltyPolicy, lateDays: number): number {
  if (lateDays <= 0 || policy.type === 'none') return 0;
  if (policy.type === 'percent') return policy.percent;
  return Math.min(policy.maxPercent, policy.percent * lateDays);
}

/** The grade after the late penalty: a share of the points earned, waivable by the grader (same as the server). */
export function applyLatePenalty(rawScore: number, policy: LatePenaltyPolicy, lateDays: number, waived: boolean): { score: number; latePenalty: AppliedLatePenalty } {
  const percent = latePenaltyPercent(policy, lateDays);
  const points = waived || percent === 0 ? 0 : round2(rawScore * percent / 100);
  return { score: Math.max(0, round2(rawScore - points)), latePenalty: { lateDays, percent: waived ? 0 : percent, points, waived: waived && percent > 0 } };
}

/** What happens to late work, in one sentence for learners (no penalty is claimed unless the lesson defines one). */
export function describeLatePolicy(allowLateSubmission: boolean, policy: LatePenaltyPolicy): string {
  if (!allowLateSubmission) return 'Work is not accepted after the due date.';
  if (policy.type === 'percent') return `Late work is accepted and loses ${policy.percent}% of its score.`;
  if (policy.type === 'percent_per_day') {
    return `Late work is accepted and loses ${policy.percent}% of its score for each day late${policy.maxPercent < 100 ? `, up to ${policy.maxPercent}%` : ''}.`;
  }
  return 'Late work is accepted with no penalty.';
}

/** "Late by 2 days: −10% (−3 points)", "Late penalty waived" or null when on time. */
export function describeAppliedPenalty(penalty: AppliedLatePenalty | null | undefined): string | null {
  if (!penalty || penalty.lateDays <= 0) return null;
  const late = `Late by ${penalty.lateDays} ${penalty.lateDays === 1 ? 'day' : 'days'}`;
  if (penalty.waived) return `${late}: late penalty waived`;
  if (penalty.percent <= 0) return `${late}: no late penalty`;
  return `${late}: −${penalty.percent}% (−${penalty.points} ${penalty.points === 1 ? 'point' : 'points'})`;
}

// ── Resubmission ──

export function decodeResubmission(value: unknown): ResubmissionPolicy {
  const source = object(value);
  if (!source || source.allowed !== true) return NO_RESUBMISSION;
  return { allowed: true, maxResubmissions: Math.min(MAX_RESUBMISSIONS, Math.max(1, count(source.maxResubmissions) || 1)), until: readIso(source.until) };
}

export function resubmissionsRemaining(policy: ResubmissionPolicy, used: number): number {
  return policy.allowed ? Math.max(0, policy.maxResubmissions - used) : 0;
}

const shortDate = (iso: string): string => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** "You can hand in a new version up to 2 times after a grade, until Dec 3, 2026." or null when not allowed. */
export function describeResubmission(policy: ResubmissionPolicy): string | null {
  if (!policy.allowed) return null;
  const times = policy.maxResubmissions === 1 ? 'once' : `up to ${policy.maxResubmissions} times`;
  return `After a grade is published you can hand in a new version ${times}${policy.until ? `, until ${shortDate(policy.until)}` : ''}.`;
}

export type ActionGate = { allowed: boolean; reason: string };

type SubmissionGateInput = {
  now: Date;
  dueDate?: string;
  allowLateSubmission: boolean;
  resubmission: ResubmissionPolicy;
  submission: Pick<AssignmentSubmission, 'status' | 'version' | 'resubmissionsUsed' | 'appealStatus'> | null;
};

/** Whether the learner can hand in now (first hand-in or changing an ungraded one), mirroring the server's planSubmission. */
export function handInGate({ now, dueDate, allowLateSubmission, resubmission, submission }: SubmissionGateInput): ActionGate {
  if (submission?.status === 'graded') return { allowed: false, reason: 'Graded work can only be changed by resubmitting.' };
  const version = submission?.version ?? 1;
  if (submission && version > 1) {
    if (resubmission.until && now.getTime() > Date.parse(resubmission.until)) return { allowed: false, reason: 'The resubmission deadline has passed, so this version can no longer be changed.' };
    return { allowed: true, reason: '' };
  }
  if (lateDaysBetween(dueDate, now) > 0 && !allowLateSubmission) {
    return { allowed: false, reason: submission ? 'The due date has passed, so your hand-in can no longer be changed.' : 'The due date has passed and this assignment does not accept late work.' };
  }
  return { allowed: true, reason: '' };
}

/** Whether a new version may be handed in after a published grade (same order of checks as the server). */
export function resubmitGate({ now, resubmission, submission }: SubmissionGateInput): ActionGate {
  if (!submission || submission.status !== 'graded') return { allowed: false, reason: '' };
  if (!resubmission.allowed) return { allowed: false, reason: 'This assignment does not accept resubmissions.' };
  if (submission.appealStatus === 'open') return { allowed: false, reason: 'Your review request is still open. Wait for the answer or withdraw it before resubmitting.' };
  if ((submission.resubmissionsUsed ?? 0) >= resubmission.maxResubmissions) return { allowed: false, reason: 'You have used every resubmission this assignment allows.' };
  if (resubmission.until && now.getTime() > Date.parse(resubmission.until)) return { allowed: false, reason: 'The resubmission deadline has passed.' };
  return { allowed: true, reason: '' };
}

/** Whether the learner can ask for a review of this grade: graded, none asked for this version, within the window. */
export function reviewRequestGate(submission: Pick<AssignmentSubmission, 'status' | 'appealStatus' | 'gradedAt'> | null, now: Date): ActionGate {
  if (!submission || submission.status !== 'graded') return { allowed: false, reason: '' };
  if (submission.appealStatus) return { allowed: false, reason: 'You already asked for a review of this grade.' };
  const gradedAt = submission.gradedAt ? Date.parse(submission.gradedAt) : NaN;
  if (Number.isFinite(gradedAt) && now.getTime() - gradedAt > APPEAL_WINDOW_DAYS * DAY_MS) {
    return { allowed: false, reason: `Reviews can be requested within ${APPEAL_WINDOW_DAYS} days of a grade being published.` };
  }
  return { allowed: true, reason: '' };
}

export const APPEAL_STATUS_LABELS: { readonly [status in GradeAppealStatus]: string } = {
  open: 'Review requested', upheld: 'Grade kept after review', adjusted: 'Grade changed after review', withdrawn: 'Review request withdrawn',
};

const EVENT_LABELS: { readonly [kind in GradeEventKind]: string } = {
  graded: 'Graded', regraded: 'Grade updated', appeal_upheld: 'Review: grade kept', appeal_adjusted: 'Review: grade changed',
};
export const gradeEventLabel = (kind: GradeEventKind): string => EVENT_LABELS[kind];

/** The policy draft an assignment's stored settings start the editor from. */
export function policyDraftFrom(allowLateSubmission: boolean, penalty: LatePenaltyPolicy, resubmission: ResubmissionPolicy): AssignmentPolicyDraft {
  return {
    allowLateSubmission, penaltyType: penalty.type,
    penaltyPercent: penalty.type === 'none' ? '10' : String(penalty.percent),
    penaltyMaxPercent: penalty.type === 'percent_per_day' ? String(penalty.maxPercent) : '50',
    resubmissionAllowed: resubmission.allowed, maxResubmissions: String(resubmission.allowed ? resubmission.maxResubmissions : 1),
    resubmissionUntil: resubmission.until ? new Date(resubmission.until) : null,
  };
}

/** The late penalty and resubmission policy the server receives, with errors to show when the draft is not valid. */
export function buildPolicyInput(draft: AssignmentPolicyDraft): { latePenalty: LatePenaltyPolicy; resubmission: { allowed: boolean; maxResubmissions: number; until: string | null }; errors: string[] } {
  const errors: string[] = [];
  let latePenalty: LatePenaltyPolicy = NO_LATE_PENALTY;
  if (draft.allowLateSubmission && draft.penaltyType !== 'none') {
    const percent = Number(draft.penaltyPercent);
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) errors.push('The late penalty must be a whole number from 1 to 100%.');
    if (draft.penaltyType === 'percent') latePenalty = { type: 'percent', percent, maxPercent: percent };
    else {
      const maxPercent = Number(draft.penaltyMaxPercent);
      if (!Number.isInteger(maxPercent) || maxPercent < percent || maxPercent > 100) errors.push('The largest late penalty must be a whole number from the daily penalty up to 100%.');
      latePenalty = { type: 'percent_per_day', percent, maxPercent };
    }
  }
  let resubmission: { allowed: boolean; maxResubmissions: number; until: string | null } = { allowed: false, maxResubmissions: 0, until: null };
  if (draft.resubmissionAllowed) {
    const maxResubmissions = Number(draft.maxResubmissions);
    if (!Number.isInteger(maxResubmissions) || maxResubmissions < 1 || maxResubmissions > MAX_RESUBMISSIONS) errors.push(`Resubmissions must be a whole number from 1 to ${MAX_RESUBMISSIONS}.`);
    resubmission = { allowed: true, maxResubmissions, until: draft.resubmissionUntil ? draft.resubmissionUntil.toISOString() : null };
  }
  return { latePenalty, resubmission, errors };
}

// ── Server views (manageLearning responses) ──

const files = (value: unknown): { name: string; url: string; size: number }[] =>
  Array.isArray(value) ? value.flatMap((entry: unknown) => {
    const file = object(entry);
    return file && text(file.url) ? [{ name: text(file.name) || 'Attachment', url: text(file.url), size: count(file.size) }] : [];
  }) : [];

const version = (value: unknown): number => Math.max(1, count(value) || 1);

export function decodeSubmissionVersion(value: unknown): SubmissionVersion | null {
  const source = object(value);
  if (!source || !text(source.id)) return null;
  const graded = source.status === 'graded';
  return {
    id: text(source.id), version: version(source.version), textResponse: text(source.textResponse), files: files(source.files),
    submittedAt: readIso(source.submittedAt), isLate: source.isLate === true, lateDays: count(source.lateDays), status: graded ? 'graded' : 'submitted',
    score: graded ? finite(source.score) : null, rawScore: graded ? finite(source.rawScore) : null, maxScore: graded ? finite(source.maxScore) : null,
    latePenalty: graded ? decodeAppliedPenalty(source.latePenalty) : null, rubricScores: graded ? decodeRubricScores(source.rubricScores) : [],
    feedback: graded ? text(source.feedback) : '', gradedAt: graded ? readIso(source.gradedAt) : null,
  };
}

export function decodeGradeEvent(value: unknown): GradeEvent | null {
  const source = object(value);
  if (!source || !text(source.id)) return null;
  const kinds: GradeEventKind[] = ['graded', 'regraded', 'appeal_upheld', 'appeal_adjusted'];
  return {
    id: text(source.id), version: version(source.version), event: kinds.find((kind) => kind === source.event) ?? 'graded',
    score: finite(source.score) ?? 0, rawScore: finite(source.rawScore) ?? 0, maxScore: finite(source.maxScore) ?? 0,
    latePenalty: decodeAppliedPenalty(source.latePenalty), rubricScores: decodeRubricScores(source.rubricScores), feedback: text(source.feedback),
    note: text(source.note), actorRole: text(source.actorRole) || 'instructor', createdAt: readIso(source.createdAt),
  };
}

export function decodeGradeAppeal(value: unknown): GradeAppeal | null {
  const source = object(value);
  if (!source || !text(source.id) || !text(source.submissionId)) return null;
  const statuses: GradeAppealStatus[] = ['open', 'upheld', 'adjusted', 'withdrawn'];
  return {
    id: text(source.id), submissionId: text(source.submissionId), courseId: text(source.courseId), lessonId: text(source.lessonId),
    lessonTitle: text(source.lessonTitle), studentId: text(source.studentId), studentName: text(source.studentName) || 'Learner', cohortId: text(source.cohortId),
    version: version(source.version), reason: text(source.reason), status: statuses.find((status) => status === source.status) ?? 'open',
    originalScore: finite(source.originalScore) ?? 0, maxScore: finite(source.maxScore) ?? 0, resultScore: finite(source.resultScore),
    responseNote: text(source.responseNote), respondedByRole: text(source.respondedByRole), createdAt: readIso(source.createdAt), resolvedAt: readIso(source.resolvedAt),
  };
}

const list = <Value>(value: unknown, decode: (entry: unknown) => Value | null): Value[] =>
  Array.isArray(value) ? value.map(decode).filter((entry): entry is Value => entry !== null) : [];

export function decodeSubmissionHistory(value: unknown): SubmissionHistory {
  const source = object(value) ?? {};
  return {
    submissionId: text(source.submissionId),
    versions: list(source.versions, decodeSubmissionVersion).sort((left, right) => right.version - left.version),
    grades: list(source.grades, decodeGradeEvent),
    appeals: list(source.appeals, decodeGradeAppeal).sort((left, right) => right.version - left.version),
  };
}

export const decodeGradeAppeals = (value: unknown): GradeAppeal[] => list(value, decodeGradeAppeal);

/** A cohort from Firestore (Timestamps) or a manageLearning response (ISO strings). `id` may come from the document. */
export function decodeCohort(value: unknown, id?: string): CourseCohort | null {
  const source = object(value);
  const cohortId = id ?? text(source?.id);
  if (!source || !cohortId || !text(source.courseId)) return null;
  const assistants = Array.isArray(source.assistants) ? source.assistants.flatMap((entry: unknown) => {
    const assistant = object(entry);
    return assistant && text(assistant.id) ? [{ id: text(assistant.id), name: text(assistant.name) || 'Assistant' }] : [];
  }) : [];
  const capacity = finite(source.capacity);
  return {
    id: cohortId, courseId: text(source.courseId), name: text(source.name) || 'Class', description: text(source.description),
    startsAt: readIso(source.startsAt), endsAt: readIso(source.endsAt), capacity: capacity !== null && capacity > 0 ? Math.round(capacity) : null,
    memberCount: count(source.memberCount), enrollmentOpensAt: readIso(source.enrollmentOpensAt), enrollmentClosesAt: readIso(source.enrollmentClosesAt),
    status: source.status === 'archived' ? 'archived' : 'active', assistants,
  };
}

/** Why a learner cannot join this class now, or null when they can (the server's cohortJoinProblem). */
export function cohortJoinProblem(cohort: CourseCohort, now: Date): string | null {
  if (cohort.status !== 'active') return 'Closed';
  if (cohort.enrollmentOpensAt && now.getTime() < Date.parse(cohort.enrollmentOpensAt)) return `Opens ${shortDate(cohort.enrollmentOpensAt)}`;
  if (cohort.enrollmentClosesAt && now.getTime() > Date.parse(cohort.enrollmentClosesAt)) return 'Enrollment closed';
  if (cohort.capacity !== null && cohort.memberCount >= cohort.capacity) return 'Full';
  return null;
}

/** "Starts Dec 1, 2026 · Ends Feb 1, 2027", "12 of 30 places taken" and similar, for class cards. */
export function cohortSummary(cohort: CourseCohort): string {
  return [
    cohort.startsAt ? `Starts ${shortDate(cohort.startsAt)}` : null,
    cohort.endsAt ? `Ends ${shortDate(cohort.endsAt)}` : null,
    cohort.capacity !== null ? `${cohort.memberCount} of ${cohort.capacity} places taken` : `${cohort.memberCount} ${cohort.memberCount === 1 ? 'learner' : 'learners'}`,
  ].filter(Boolean).join(' · ');
}

export function decodeRosterLearner(value: unknown): RosterLearner | null {
  const source = object(value);
  if (!source || !text(source.userId)) return null;
  return {
    userId: text(source.userId), displayName: text(source.displayName) || 'Learner', cohortId: text(source.cohortId),
    enrollmentStatus: text(source.enrollmentStatus), progress: Math.min(100, count(source.progress)), enrolledAt: readIso(source.enrolledAt),
  };
}

export const decodeRoster = (value: unknown): RosterLearner[] => list(value, decodeRosterLearner);

export function decodeSession(value: unknown): CourseSession | null {
  const source = object(value);
  if (!source || !text(source.id) || !text(source.title)) return null;
  const kinds: SessionKind[] = ['live_class', 'office_hours', 'deadline'];
  const joinUrl = text(source.joinUrl);
  return {
    id: text(source.id), courseId: text(source.courseId), cohortId: text(source.cohortId), cohortName: text(source.cohortName),
    kind: kinds.find((kind) => kind === source.kind) ?? 'live_class', title: text(source.title), description: text(source.description),
    startsAt: readIso(source.startsAt), endsAt: readIso(source.endsAt),
    // Only https links are opened; anything else is treated as no link.
    joinUrl: /^https:\/\//i.test(joinUrl) ? joinUrl : '',
    recording: source.recording === 'recorded' ? 'recorded' : 'not_recorded', recordingNote: text(source.recordingNote),
    status: source.status === 'cancelled' ? 'cancelled' : 'scheduled',
  };
}

export const decodeSessions = (value: unknown): CourseSession[] => list(value, decodeSession);

const SESSION_KIND_LABELS: { readonly [kind in SessionKind]: string } = { live_class: 'Live class', office_hours: 'Office hours', deadline: 'Deadline' };
export const sessionKindLabel = (kind: SessionKind): string => SESSION_KIND_LABELS[kind];

/** "Tue, Dec 1 · 6:00 PM – 7:00 PM" in the device's time zone (local date and time). */
export function formatSessionTime(startsAt: string | null, endsAt: string | null): string {
  const start = startsAt ? new Date(startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return 'Time to be confirmed';
  const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const clock = (date: Date): string => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const end = endsAt ? new Date(endsAt) : null;
  if (!end || Number.isNaN(end.getTime())) return `${day} · ${clock(start)}`;
  const sameDay = end.toDateString() === start.toDateString();
  return sameDay ? `${day} · ${clock(start)} – ${clock(end)}` : `${day} · ${clock(start)} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${clock(end)}`;
}

/** null when the link is a usable https address (or empty and optional), otherwise the problem in words. */
export function joinUrlProblem(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return 'The join link is too long.';
  return /^https:\/\/[^\s/@]+\.[^\s]+$/i.test(trimmed) ? null : 'The join link must be a full https:// address.';
}
