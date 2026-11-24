import { describe, expect, mock, test } from 'bun:test';

let callableResponse = {};
let lastCallableRequest = null;
let staffDocs = [];
mock.module('@/lib/firebaseConfig', () => ({ app: {}, auth: { currentUser: { uid: 'assistant-1' } }, db: {}, storage: {} }));
mock.module('firebase/firestore', () => ({
  collection: (_db, ...path) => path.join('/'),
  doc: (_db, ...path) => path.join('/'),
  getDoc: async (path) => ({ data: () => (path === 'courses/course-1' ? { title: 'Algebra' } : undefined) }),
  getDocs: async () => ({ docs: staffDocs }),
  limit: () => null,
  query: () => null,
  where: () => null,
}));
mock.module('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => async (request) => { lastCallableRequest = request; return { data: callableResponse }; } }));
mock.module('./NativeSessionService', () => ({ nativeSessionService: { assertOwner: () => undefined, ensure: async () => undefined } }));

const { teachingWorkflowService, serverMessage } = await import('./TeachingWorkflowService.ts');

describe('staff calls use the server contract', () => {
  test('grading with a rubric sends rubric scores (no score), the version and the waiver', async () => {
    callableResponse = { submissionId: 's1', status: 'graded', score: 72, rawScore: 80, maxScore: 100 };
    const result = await teachingWorkflowService.grade({
      submissionId: 's1', version: 2, feedback: ' Good ', draft: false, waiveLatePenalty: true, note: ' ',
      rubricScores: [{ criterionId: 'c1', levelId: 'l1', feedback: ' Clear ' }],
    });
    expect(lastCallableRequest).toEqual({ action: 'grade_submission', submissionId: 's1', version: 2, feedback: 'Good', draft: false, waiveLatePenalty: true, rubricScores: [{ criterionId: 'c1', levelId: 'l1', feedback: 'Clear' }] });
    expect(result).toEqual({ score: 72, rawScore: 80, maxScore: 100 });
    await teachingWorkflowService.grade({ submissionId: 's1', version: 1, feedback: '', draft: true, waiveLatePenalty: false, score: 9, note: 'Recount' });
    expect(lastCallableRequest).toEqual({ action: 'grade_submission', submissionId: 's1', version: 1, feedback: '', draft: true, waiveLatePenalty: false, note: 'Recount', score: 9 });
  });

  test('keeping a grade after review sends only the decision and note', async () => {
    callableResponse = { appeal: { id: 's1_v1', submissionId: 's1', status: 'upheld', responseNote: 'Checked' } };
    const appeal = await teachingWorkflowService.respondToReview({ appealId: 's1_v1', decision: 'uphold', note: ' Checked ', waiveLatePenalty: false, score: 5 });
    expect(lastCallableRequest).toEqual({ action: 'respond_grade_review', appealId: 's1_v1', decision: 'uphold', note: 'Checked' });
    expect(appeal.status).toBe('upheld');
    callableResponse = { appeal: { id: 's1_v1', submissionId: 's1', status: 'adjusted' } };
    await teachingWorkflowService.respondToReview({ appealId: 's1_v1', decision: 'adjust', note: 'Fixed', waiveLatePenalty: false, score: 8 });
    expect(lastCallableRequest).toEqual({ action: 'respond_grade_review', appealId: 's1_v1', decision: 'adjust', note: 'Fixed', waiveLatePenalty: false, score: 8 });
  });

  test('classes and sessions', async () => {
    callableResponse = { cohort: { id: 'course-1_op', courseId: 'course-1', name: 'Evening', memberCount: 0, status: 'active', assistants: [] } };
    const cohort = await teachingWorkflowService.saveCohort('course-1', { name: ' Evening ', description: '', startsAt: new Date('2026-12-01T00:00:00.000Z'), endsAt: null, capacity: 20, enrollmentOpensAt: null, enrollmentClosesAt: null }, undefined, 'op');
    expect(lastCallableRequest).toEqual({ action: 'save_cohort', courseId: 'course-1', operationId: 'op', name: 'Evening', description: '', capacity: 20, startsAt: '2026-12-01T00:00:00.000Z', endsAt: null, enrollmentOpensAt: null, enrollmentClosesAt: null });
    expect(cohort.name).toBe('Evening');
    await teachingWorkflowService.addAssistant('course-1_op', ' @maya.r ');
    expect(lastCallableRequest).toEqual({ action: 'add_cohort_assistant', cohortId: 'course-1_op', userName: 'maya.r' });
    callableResponse = { learners: [{ userId: 'u1', displayName: 'Maya R.', cohortId: '', progress: 40 }], truncated: false };
    const roster = await teachingWorkflowService.getRoster('course-1', '');
    expect(lastCallableRequest).toEqual({ action: 'course_roster', courseId: 'course-1', cohortId: '' });
    expect(roster.learners[0].displayName).toBe('Maya R.');
    await teachingWorkflowService.getRoster('course-1', null);
    expect(lastCallableRequest).toEqual({ action: 'course_roster', courseId: 'course-1' });
    callableResponse = { session: { id: 'sess', title: 'Due', kind: 'deadline' } };
    await teachingWorkflowService.saveSession('course-1', { cohortId: '', kind: 'deadline', title: 'Due', description: '', startsAt: new Date('2026-12-02T00:00:00.000Z'), endsAt: null, joinUrl: 'https://x.test', recording: 'recorded', recordingNote: 'x' }, undefined, 'op2');
    expect(lastCallableRequest).toMatchObject({ action: 'save_session', operationId: 'op2', kind: 'deadline', joinUrl: '', recording: 'not_recorded', recordingNote: '' });
  });

  test('assisted courses come from the member\'s own courseStaff records', async () => {
    staffDocs = [
      { data: () => ({ courseId: 'course-1', userId: 'assistant-1', cohortIds: ['course-1_a', 7] }) },
      { data: () => ({ courseId: 'course-2', userId: 'assistant-1', cohortIds: [] }) },
    ];
    expect(await teachingWorkflowService.getStaffCourses('assistant-1')).toEqual([{ courseId: 'course-1', cohortIds: ['course-1_a'], title: 'Algebra' }]);
  });

  test('server refusals reach the screen in their own words; other errors use the fallback', () => {
    const refusal = Object.assign(new Error('Assistants must be adults.'), { code: 'functions/failed-precondition' });
    expect(serverMessage(refusal, 'Fallback')).toBe('Assistants must be adults.');
    expect(serverMessage(Object.assign(new Error('internal'), { code: 'functions/internal' }), 'Fallback')).toBe('Fallback');
    expect(serverMessage('nope', 'Fallback')).toBe('Fallback');
  });
});
