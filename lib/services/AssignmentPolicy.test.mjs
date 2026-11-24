import { describe, expect, test } from 'bun:test';
import {
  applyLatePenalty,
  buildPolicyInput,
  buildRubricInput,
  cohortJoinProblem,
  decodeCohort,
  decodeLatePenalty,
  decodeResubmission,
  decodeRubric,
  decodeSession,
  decodeSubmissionHistory,
  describeAppliedPenalty,
  describeLatePolicy,
  describeResubmission,
  handInGate,
  isRubricComplete,
  joinUrlProblem,
  lateDaysBetween,
  newOperationId,
  policyDraftFrom,
  resubmissionsRemaining,
  resubmitGate,
  reviewRequestGate,
  rubricRawScore,
  rubricToDraft,
} from './AssignmentPolicy.ts';

const timestamp = (iso) => ({ toDate: () => new Date(iso) });
const rubric = {
  criteria: [
    { id: 'c1', title: 'Argument', levels: [{ id: 'l1', title: 'Strong', points: 10 }, { id: 'l2', title: 'Weak', points: 4 }] },
    { id: 'c2', title: 'Sources', levels: [{ id: 'l3', title: 'Cited', points: 5 }, { id: 'l4', title: 'Missing', points: 0 }] },
  ],
};

describe('rubric', () => {
  test('decodes leniently and totals each criterion\'s best level', () => {
    const decoded = decodeRubric({ criteria: [...rubric.criteria, { id: 'bad', levels: [] }, 'junk'] });
    expect(decoded.totalPoints).toBe(15);
    expect(decoded.criteria.map((criterion) => criterion.maxPoints)).toEqual([10, 5]);
    expect(decodeRubric(null)).toBeNull();
    expect(decodeRubric({ criteria: [] })).toBeNull();
  });

  test('raw score and completeness follow the chosen levels', () => {
    const decoded = decodeRubric(rubric);
    expect(rubricRawScore(decoded, { c1: 'l2', c2: 'l3' })).toBe(9);
    expect(isRubricComplete(decoded, { c1: 'l2' })).toBe(false);
    expect(isRubricComplete(decoded, { c1: 'l2', c2: 'l4' })).toBe(true);
  });

  test('drafts round-trip and invalid drafts explain what to fix', () => {
    const drafts = rubricToDraft(decodeRubric(rubric));
    const built = buildRubricInput(drafts);
    expect(built.errors).toEqual([]);
    expect(built.totalPoints).toBe(15);
    expect(built.rubric.criteria[0].levels[1]).toEqual({ id: 'l2', title: 'Weak', description: '', points: 4 });
    expect(buildRubricInput([]).rubric).toBeNull();
    const broken = buildRubricInput([{ id: 'c1', title: '', description: '', levels: [{ id: 'l1', title: 'A', description: '', points: '1.5' }] }]);
    expect(broken.errors.some((error) => error.includes('Name criterion 1'))).toBe(true);
    expect(broken.errors.some((error) => error.includes('whole number'))).toBe(true);
    const zero = buildRubricInput([{ id: 'c1', title: 'Only', description: '', levels: [{ id: 'l1', title: 'A', description: '', points: '0' }] }]);
    expect(zero.errors).toEqual(['A rubric must be worth at least one point.']);
  });
});

describe('late policy', () => {
  test('penalties match the server: a share of the points earned, per day up to a cap, waivable', () => {
    const perDay = { type: 'percent_per_day', percent: 10, maxPercent: 25 };
    expect(applyLatePenalty(80, perDay, 2, false)).toEqual({ score: 64, latePenalty: { lateDays: 2, percent: 20, points: 16, waived: false } });
    expect(applyLatePenalty(80, perDay, 5, false).latePenalty.percent).toBe(25);
    expect(applyLatePenalty(80, perDay, 2, true)).toEqual({ score: 80, latePenalty: { lateDays: 2, percent: 0, points: 0, waived: true } });
    expect(applyLatePenalty(33.3, { type: 'percent', percent: 15, maxPercent: 15 }, 1, false).score).toBe(28.31);
    expect(applyLatePenalty(50, { type: 'none', percent: 0, maxPercent: 0 }, 3, true).latePenalty.waived).toBe(false);
  });

  test('late days are started days after the due date', () => {
    expect(lateDaysBetween('2026-11-01T12:00:00.000Z', new Date('2026-11-01T12:00:00.000Z'))).toBe(0);
    expect(lateDaysBetween('2026-11-01T12:00:00.000Z', new Date('2026-11-01T12:00:01.000Z'))).toBe(1);
    expect(lateDaysBetween('2026-11-01T12:00:00.000Z', new Date('2026-11-03T13:00:00.000Z'))).toBe(3);
    expect(lateDaysBetween(undefined, new Date())).toBe(0);
  });

  test('decoder and copy never claim a penalty the lesson does not define', () => {
    expect(decodeLatePenalty(undefined)).toEqual({ type: 'none', percent: 0, maxPercent: 0 });
    expect(decodeLatePenalty({ type: 'percent_per_day', percent: 10 })).toEqual({ type: 'percent_per_day', percent: 10, maxPercent: 100 });
    expect(describeLatePolicy(true, decodeLatePenalty(undefined))).toBe('Late work is accepted with no penalty.');
    expect(describeLatePolicy(false, decodeLatePenalty({ type: 'percent', percent: 10 }))).toBe('Work is not accepted after the due date.');
    expect(describeLatePolicy(true, { type: 'percent_per_day', percent: 5, maxPercent: 20 })).toContain('up to 20%');
    expect(describeAppliedPenalty({ lateDays: 2, percent: 20, points: 16, waived: false })).toBe('Late by 2 days: −20% (−16 points)');
    expect(describeAppliedPenalty({ lateDays: 1, percent: 0, points: 0, waived: true })).toBe('Late by 1 day: late penalty waived');
    expect(describeAppliedPenalty({ lateDays: 0, percent: 0, points: 0, waived: false })).toBeNull();
  });

  test('policy drafts become what the server accepts', () => {
    const draft = policyDraftFrom(true, { type: 'percent_per_day', percent: 10, maxPercent: 30 }, { allowed: true, maxResubmissions: 2, until: '2026-12-01T00:00:00.000Z' });
    const built = buildPolicyInput(draft);
    expect(built.errors).toEqual([]);
    expect(built.latePenalty).toEqual({ type: 'percent_per_day', percent: 10, maxPercent: 30 });
    expect(built.resubmission).toEqual({ allowed: true, maxResubmissions: 2, until: '2026-12-01T00:00:00.000Z' });
    expect(buildPolicyInput({ ...draft, allowLateSubmission: false }).latePenalty.type).toBe('none');
    expect(buildPolicyInput({ ...draft, penaltyMaxPercent: '5' }).errors.length).toBe(1);
    expect(buildPolicyInput({ ...draft, maxResubmissions: '11' }).errors.length).toBe(1);
  });
});

describe('what the learner can do next', () => {
  const now = new Date('2026-11-10T00:00:00.000Z');
  const resubmission = decodeResubmission({ allowed: true, maxResubmissions: 2, until: timestamp('2026-11-20T00:00:00.000Z') });

  test('resubmission policy decodes Timestamps and describes itself', () => {
    expect(resubmission).toEqual({ allowed: true, maxResubmissions: 2, until: '2026-11-20T00:00:00.000Z' });
    expect(resubmissionsRemaining(resubmission, 1)).toBe(1);
    expect(decodeResubmission({ allowed: false, maxResubmissions: 3 })).toEqual({ allowed: false, maxResubmissions: 0, until: null });
    expect(describeResubmission(resubmission)).toContain('up to 2 times');
    expect(describeResubmission(decodeResubmission(null))).toBeNull();
  });

  test('handing in follows the due date and late policy like the server', () => {
    const base = { now, dueDate: '2026-11-05T00:00:00.000Z', resubmission };
    expect(handInGate({ ...base, allowLateSubmission: false, submission: null }).allowed).toBe(false);
    expect(handInGate({ ...base, allowLateSubmission: true, submission: null }).allowed).toBe(true);
    expect(handInGate({ ...base, allowLateSubmission: false, submission: { status: 'submitted', version: 1 } }).reason).toContain('can no longer be changed');
    expect(handInGate({ ...base, allowLateSubmission: false, submission: { status: 'submitted', version: 2 } }).allowed).toBe(true);
    expect(handInGate({ ...base, now: new Date('2026-11-21T00:00:00.000Z'), allowLateSubmission: true, submission: { status: 'submitted', version: 2 } }).allowed).toBe(false);
  });

  test('resubmitting needs a graded hand-in, the policy, no open review, some left and the deadline not passed', () => {
    const graded = { status: 'graded', version: 1, resubmissionsUsed: 0 };
    const base = { now, allowLateSubmission: false, resubmission };
    expect(resubmitGate({ ...base, submission: graded }).allowed).toBe(true);
    expect(resubmitGate({ ...base, submission: { ...graded, appealStatus: 'open' } }).reason).toContain('review request');
    expect(resubmitGate({ ...base, submission: { ...graded, resubmissionsUsed: 2 } }).allowed).toBe(false);
    expect(resubmitGate({ ...base, now: new Date('2026-11-21T00:00:00.000Z'), submission: graded }).reason).toContain('deadline');
    expect(resubmitGate({ ...base, resubmission: decodeResubmission(null), submission: graded }).allowed).toBe(false);
    expect(resubmitGate({ ...base, submission: { status: 'submitted', version: 1 } }).allowed).toBe(false);
  });

  test('a review can be asked once per graded version within 30 days', () => {
    expect(reviewRequestGate({ status: 'graded', gradedAt: '2026-11-01T00:00:00.000Z' }, now).allowed).toBe(true);
    expect(reviewRequestGate({ status: 'graded', gradedAt: '2026-11-01T00:00:00.000Z', appealStatus: 'upheld' }, now).allowed).toBe(false);
    expect(reviewRequestGate({ status: 'graded', gradedAt: '2026-09-01T00:00:00.000Z' }, now).reason).toContain('30 days');
    expect(reviewRequestGate({ status: 'submitted' }, now).allowed).toBe(false);
  });
});

describe('server views', () => {
  test('history hides grade fields of ungraded versions and sorts newest first', () => {
    const history = decodeSubmissionHistory({
      submissionId: 's1',
      versions: [
        { id: 's1_v1', version: 1, status: 'graded', score: 64, rawScore: 80, maxScore: 100, latePenalty: { lateDays: 2, percent: 20, points: 16 }, rubricScores: [{ criterionId: 'c1', points: 8 }], feedback: 'Good', submittedAt: '2026-11-03T00:00:00.000Z' },
        { id: 's1_v2', version: 2, status: 'submitted', score: 99, feedback: 'draft leak', textResponse: 'Better' },
      ],
      grades: [{ id: 's1_001', version: 1, event: 'graded', score: 64, maxScore: 100 }, { id: 'x' , event: 'unknown' }],
      appeals: [{ id: 's1_v1', submissionId: 's1', status: 'adjusted', version: 1, resultScore: 70 }],
    });
    expect(history.versions.map((entry) => entry.version)).toEqual([2, 1]);
    expect(history.versions[0].score).toBeNull();
    expect(history.versions[0].feedback).toBe('');
    expect(history.versions[1].latePenalty).toEqual({ lateDays: 2, percent: 20, points: 16, waived: false });
    expect(history.grades[1].event).toBe('graded');
    expect(history.appeals[0].resultScore).toBe(70);
  });

  test('cohorts say why they cannot be joined', () => {
    const cohort = decodeCohort({ courseId: 'k', name: 'Evening', capacity: 2, memberCount: 2, enrollmentClosesAt: timestamp('2026-12-01T00:00:00.000Z') }, 'k_1');
    expect(cohort.id).toBe('k_1');
    expect(cohortJoinProblem(cohort, new Date('2026-11-10T00:00:00.000Z'))).toBe('Full');
    expect(cohortJoinProblem({ ...cohort, memberCount: 1 }, new Date('2026-11-10T00:00:00.000Z'))).toBeNull();
    expect(cohortJoinProblem({ ...cohort, memberCount: 1 }, new Date('2026-12-02T00:00:00.000Z'))).toBe('Enrollment closed');
    expect(cohortJoinProblem({ ...cohort, status: 'archived' }, new Date('2026-11-10T00:00:00.000Z'))).toBe('Closed');
    expect(decodeCohort({ name: 'No course' }, 'x')).toBeNull();
  });

  test('sessions only keep https join links; join links are checked before saving', () => {
    expect(decodeSession({ id: 's', title: 'Class', joinUrl: 'javascript:alert(1)' }).joinUrl).toBe('');
    expect(decodeSession({ id: 's', title: 'Class', joinUrl: 'https://meet.example.com/abc', kind: 'office_hours', status: 'cancelled' })).toMatchObject({ joinUrl: 'https://meet.example.com/abc', kind: 'office_hours', status: 'cancelled' });
    expect(joinUrlProblem('')).toBeNull();
    expect(joinUrlProblem('http://meet.example.com')).not.toBeNull();
    expect(joinUrlProblem('https://meet.example.com/x')).toBeNull();
  });

  test('operation ids use only characters the server accepts', () => {
    expect(newOperationId('cohort:1')).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
