import { describe, expect, mock, test } from 'bun:test';

let enrollmentSnapshot = { id: 'user-1_course-1', exists: () => false, data: () => undefined };

mock.module('@/lib/firebaseConfig', () => ({ app: {}, auth: { currentUser: { uid: 'user-1' } }, db: {}, storage: {} }));
mock.module('firebase/firestore', () => ({
  collection: (_db, ...path) => path.join('/'),
  doc: (_db, ...path) => path.join('/'),
  getDoc: async () => enrollmentSnapshot,
  getDocs: async () => ({ docs: [], size: 0 }),
  limit: () => null,
  orderBy: () => null,
  query: () => null,
  startAfter: () => null,
  where: () => null,
}));
let callableResponse = {};
let lastCallableRequest = null;
mock.module('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => async (request) => { lastCallableRequest = request; return { data: callableResponse }; } }));
mock.module('firebase/storage', () => ({ getDownloadURL: async () => '', ref: () => null, uploadBytes: async () => undefined }));
mock.module('./FirestoreBatchReadService', () => ({ firestoreBatchReadService: { getDocumentsByIds: async () => new Map() } }));
mock.module('./NativeSessionService', () => ({ nativeSessionService: { assertOwner: () => undefined, ensure: async () => undefined } }));

const { courseService, isActiveEnrollment } = await import('./CourseService.ts');

const lesson = (id, overrides = {}) => ({ id, courseId: 'course-1', moduleId: 'module-1', title: id, type: 'text', duration: 0, order: 0, isRequired: false, isPublished: true, isFree: false, allowLateSubmission: false, attachments: [], quizQuestions: [], ...overrides });
const modules = [
  { id: 'module-1', title: 'Basics', lessons: [lesson('one'), lesson('two')] },
  { id: 'module-2', title: 'Advanced', lessons: [lesson('three')] },
  { id: 'module-3', title: 'Empty' },
];

describe('enrollments', () => {
  test('only active and completed enrollments open a course', () => {
    expect(isActiveEnrollment({ status: 'active' })).toBe(true);
    expect(isActiveEnrollment({ status: 'completed' })).toBe(true);
    expect(isActiveEnrollment({ status: 'dropped' })).toBe(false);
    expect(isActiveEnrollment({ status: 'suspended' })).toBe(false);
    expect(isActiveEnrollment(null)).toBe(false);
    expect(isActiveEnrollment(undefined)).toBe(false);
  });

  test('completed lessons merge the website and server lists', async () => {
    enrollmentSnapshot = {
      id: 'user-1_course-1',
      exists: () => true,
      data: () => ({ userId: 'user-1', courseId: 'course-1', status: 'active', progress: 40, completedLessons: [], completedModules: ['one', 'two', 'two', 7, ' '] }),
    };
    const enrollment = await courseService.getEnrollmentStatus('user-1', 'course-1');
    expect(enrollment.completedLessons).toEqual(['one', 'two']);
    expect(courseService.nextLesson(modules, enrollment).lesson.id).toBe('three');
  });

  test('progress is clamped to 0-100 and bad records are ignored', async () => {
    enrollmentSnapshot = { id: 'e', exists: () => true, data: () => ({ userId: 'user-1', courseId: 'course-1', status: 'completed', progress: 140, completedLessons: ['one'] }) };
    expect((await courseService.getEnrollmentStatus('user-1', 'course-1')).progress).toBe(100);
    enrollmentSnapshot = { id: 'e', exists: () => true, data: () => ({ userId: 'user-1', courseId: 'course-1', status: 'active', progress: -5 }) };
    const negative = await courseService.getEnrollmentStatus('user-1', 'course-1');
    expect(negative.progress).toBe(0);
    expect(negative.completedLessons).toEqual([]);
    enrollmentSnapshot = { id: 'e', exists: () => true, data: () => ({ userId: 'user-1', courseId: 'course-1', status: 'unknown' }) };
    expect(await courseService.getEnrollmentStatus('user-1', 'course-1')).toBeNull();
  });

  test('another account cannot read this learner\'s enrollment', async () => {
    await expect(courseService.getEnrollmentStatus('user-2', 'course-1')).rejects.toThrow('Your account changed');
  });
});

describe('syllabus helpers', () => {
  test('lessons flatten in module order', () => {
    expect(courseService.flattenLessons(modules).map((item) => item.id)).toEqual(['one', 'two', 'three']);
    expect(courseService.flattenLessons([])).toEqual([]);
  });

  test('next lesson is the first one not completed, or null when everything is done', () => {
    expect(courseService.nextLesson(modules, null)).toEqual({ lesson: modules[0].lessons[0], moduleTitle: 'Basics' });
    expect(courseService.nextLesson(modules, { completedLessons: ['one'] }).lesson.id).toBe('two');
    expect(courseService.nextLesson(modules, { completedLessons: ['one', 'two'] }).moduleTitle).toBe('Advanced');
    expect(courseService.nextLesson(modules, { completedLessons: ['one', 'two', 'three'] })).toBeNull();
    expect(courseService.nextLesson([], null)).toBeNull();
  });

  test('a lesson is overdue only when past due and not done', () => {
    const now = Date.parse('2026-11-23T12:00:00Z');
    const due = (dueDate) => lesson('a', { dueDate });
    expect(courseService.isOverdue(due('2026-11-22T12:00:00Z'), false, now)).toBe(true);
    expect(courseService.isOverdue(due('2026-11-22T12:00:00Z'), true, now)).toBe(false);
    expect(courseService.isOverdue(due('2026-11-24T12:00:00Z'), false, now)).toBe(false);
    expect(courseService.isOverdue(due(undefined), false, now)).toBe(false);
    expect(courseService.isOverdue(due('not a date'), false, now)).toBe(false);
  });

  test('completion counts lessons, quizzes and assignments, with a handed-in assignment as done', () => {
    const work = [{ id: 'm', title: 'Unit', lessons: [lesson('read'), lesson('quiz', { type: 'quiz' }), lesson('essay', { type: 'assignment' }), lesson('video', { type: 'video' })] }];
    const result = courseService.completion(work, { completedLessons: ['read', 'quiz'] }, new Map([['essay', { status: 'submitted' }]]));
    expect(result.all).toEqual({ total: 4, done: 3 });
    expect(result.lessons).toEqual({ total: 2, done: 1 });
    expect(result.quizzes).toEqual({ total: 1, done: 1 });
    expect(result.assignments).toEqual({ total: 1, done: 1 });
    expect(courseService.completion([], null).all).toEqual({ total: 0, done: 0 });
  });

  test('the next step is overdue work first, then the next unfinished lesson', () => {
    const now = Date.parse('2026-11-23T12:00:00Z');
    const work = [
      { id: 'm1', title: 'One', lessons: [lesson('intro'), lesson('next')] },
      { id: 'm2', title: 'Two', lessons: [lesson('late', { type: 'assignment', dueDate: '2026-11-20T00:00:00Z' })] },
    ];
    expect(courseService.nextStep(work, { completedLessons: ['intro'] }, new Map(), now)).toMatchObject({ kind: 'overdue', moduleTitle: 'Two' });
    expect(courseService.nextStep(work, { completedLessons: ['intro'] }, new Map([['late', {}]]), now)).toMatchObject({ kind: 'lesson', lesson: { id: 'next' } });
    expect(courseService.nextStep(work, { completedLessons: ['intro', 'next', 'late'] }, new Map(), now)).toEqual({ kind: 'finished' });
    expect(courseService.nextStep([], null)).toEqual({ kind: 'empty' });
  });

  test('the gradebook counts the best quiz attempt and graded assignments only', () => {
    const now = Date.parse('2026-11-23T12:00:00Z');
    const work = [{ id: 'm', title: 'Unit', lessons: [
      lesson('q1', { type: 'quiz', maxAttempts: 3 }),
      lesson('q2', { type: 'quiz', dueDate: '2026-11-01T00:00:00Z' }),
      lesson('q3', { type: 'quiz' }),
      lesson('a1', { type: 'assignment', points: 20 }),
      lesson('a2', { type: 'assignment' }),
      lesson('reading'),
    ] }];
    const enrollment = { completedLessons: ['q1'], quizSummary: { q1: { attempts: 2, bestPercent: 80, latestPercent: 60 } } };
    const submissions = new Map([['a1', { status: 'graded', score: 15, maxScore: 20, feedback: 'Clear argument' }], ['a2', { status: 'submitted' }]]);
    const book = courseService.gradebook(work, enrollment, submissions, new Map([['q3', 50]]), now);
    const byId = Object.fromEntries(book.rows.map((row) => [row.lessonId, row]));
    expect(book.rows).toHaveLength(5);
    expect(byId.q1).toMatchObject({ status: 'attempted', percent: 80, attempts: 2, latestPercent: 60, maxAttempts: 3 });
    expect(byId.q2).toMatchObject({ status: 'overdue', percent: null });
    expect(byId.q3).toMatchObject({ status: 'attempted', percent: 50, attempts: 1 });
    expect(byId.a1).toMatchObject({ status: 'graded', percent: 75, score: 15, maxScore: 20, feedback: 'Clear argument' });
    expect(byId.a2).toMatchObject({ status: 'submitted', percent: null });
    expect(book.scoredCount).toBe(3);
    expect(book.averagePercent).toBe(68);
  });

  test('continue learning picks the most recent unfinished active course still in the catalog', () => {
    const catalog = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
    const enrollments = new Map([
      ['c1', { courseId: 'c1', status: 'active', progress: 20, lastAccessed: '2026-11-01T00:00:00Z' }],
      ['c2', { courseId: 'c2', status: 'active', progress: 40, lastAccessed: '2026-11-20T00:00:00Z' }],
      ['c3', { courseId: 'c3', status: 'completed', progress: 100, lastAccessed: '2026-11-22T00:00:00Z' }],
      ['gone', { courseId: 'gone', status: 'active', progress: 10, lastAccessed: '2026-11-23T00:00:00Z' }],
    ]);
    expect(courseService.continueLearning(catalog, enrollments).course.id).toBe('c2');
    expect(courseService.continueLearning(catalog, new Map())).toBeNull();
  });

  test('hub stats average only rated courses', () => {
    expect(courseService.getStats([])).toEqual({ totalCourses: 0, totalLearners: 0, averageRating: 0 });
    expect(courseService.getStats([{ rating: 4, enrolledStudents: 10 }, { rating: 0, enrolledStudents: 5 }, { rating: 5, enrolledStudents: 1 }]))
      .toEqual({ totalCourses: 3, totalLearners: 16, averageRating: 4.5 });
  });
});

describe('course records', () => {
  const course = (overrides = {}) => courseService.course('course-1', {
    title: 'Algebra', description: 'Numbers', category: 'Mathematics', level: 'beginner', status: 'published',
    instructor: { id: 'teacher-1', name: 'Ms. Ali' }, price: 0, ...overrides,
  });

  test('a published course with an instructor is listed; drafts and incomplete records are not', () => {
    expect(course()?.title).toBe('Algebra');
    expect(course({ status: 'draft' })).toBeNull();
    expect(course({ level: 'expert' })).toBeNull();
    expect(course({ title: '  ' })).toBeNull();
    expect(course({ instructor: { id: 'teacher-1' } })).toBeNull();
  });

  test('price, rating and counts are numbers, never NaN or negative counts', () => {
    const value = course({ price: 'free', rating: Number.NaN, enrolledStudents: -3, totalRatings: 2.6, tags: ['a', 3, ' '] });
    expect(value.price).toBe(0);
    expect(value.rating).toBe(0);
    expect(value.enrolledStudents).toBe(0);
    expect(value.totalRatings).toBe(3);
    expect(value.tags).toEqual(['a']);
    expect(course({ price: 49.99 }).price).toBe(49.99);
  });

  test('quiz questions keep their server order so answers line up with the answer key', () => {
    const questions = courseService.quizQuestions([
      { title: 'Pick one', options: ['A', 'B'], correctIndex: 1 },
      { title: 'Explain', type: 'short' },
      { title: 'True?', type: 'tf' },
      null,
    ]);
    expect(questions.map((question) => question.type)).toEqual(['multiple_choice', 'short_answer', 'true_false', 'short_answer']);
    expect(questions[2].options).toEqual(['True', 'False']);
    expect(questions[3].title).toBe('Question 4');
    expect(courseService.quizQuestions('nope')).toEqual([]);
  });

  test('learners never hold the answer key, even from lessons that still store it', () => {
    const questions = courseService.quizQuestions([{ id: 'q1', title: 'Pick one', options: ['A', 'B'], correctIndex: 1, explanation: 'Because B' }, { question: 'Old prompt', options: ['x', 'y'] }]);
    for (const question of questions) {
      expect('correctIndex' in question).toBe(false);
      expect('explanation' in question).toBe(false);
    }
    expect(questions[1].title).toBe('Old prompt');
    const quizLesson = courseService.lesson('quiz-1', { courseId: 'course-1', moduleId: 'module-1', title: 'Check', type: 'quiz', maxAttempts: 3, quizQuestions: [{ title: 'Q', options: ['a'], correctIndex: 0 }] });
    expect(quizLesson.maxAttempts).toBe(3);
    expect(JSON.stringify(quizLesson).includes('correctIndex')).toBe(false);
    expect(courseService.lesson('quiz-2', { courseId: 'course-1', moduleId: 'module-1', title: 'Check', type: 'quiz', maxAttempts: 0 }).maxAttempts).toBeUndefined();
  });

  test('course records drop the instructor email older documents still carry', () => {
    expect(course({ instructor: { id: 'teacher-1', name: 'Ms. Ali', email: 'ali@example.test' } }).instructor).toEqual({ id: 'teacher-1', name: 'Ms. Ali', avatar: undefined, role: undefined });
  });
});

describe('quiz attempts', () => {
  test('the enrollment carries attempts used and the best score per quiz', async () => {
    enrollmentSnapshot = { id: 'user-1_course-1', exists: () => true, data: () => ({ userId: 'user-1', courseId: 'course-1', status: 'active', progress: 50, quizSummary: { q1: { attempts: 2, bestPercent: 80, latestPercent: 60 }, bad: 'x' } }) };
    const enrollment = await courseService.getEnrollmentStatus('user-1', 'course-1');
    expect(enrollment.quizSummary).toEqual({ q1: { attempts: 2, bestPercent: 80, latestPercent: 60 } });
  });

  test('a submission returns the server-marked attempt and reuses the operation id it was given', async () => {
    callableResponse = {
      id: 'user-1_course-1', score: 75,
      attempt: {
        id: 'a1', attemptNumber: 2, score: 3, maxScore: 4, percent: 75, correctCount: 1, markableCount: 2, feedbackReleased: true,
        results: [{ questionId: 'q1', index: 0, scored: true, correct: false, chosenIndex: 1, points: 3, earned: 0, correctIndex: 0, explanation: 'Why' }, 'junk'],
        attemptsUsed: 2, maxAttempts: 3, attemptsRemaining: 1, bestPercent: 75, submittedAt: '2026-11-23T00:00:00.000Z',
      },
    };
    const attempt = await courseService.submitQuiz('user-1_course-1', 'lesson-1', [1, -1], 'op-1');
    expect(lastCallableRequest).toEqual({ enrollmentId: 'user-1_course-1', lessonId: 'lesson-1', operationId: 'op-1', answers: [1, -1] });
    expect(attempt.percent).toBe(75);
    expect(attempt.results).toHaveLength(1);
    expect(attempt.results[0].correctIndex).toBe(0);
    expect(attempt.attemptsRemaining).toBe(1);
    callableResponse = { id: 'user-1_course-1' };
    expect(await courseService.submitQuiz('user-1_course-1', 'lesson-1', [], 'op-2')).toBeNull();
    callableResponse = { id: 'e', attempt: { id: 'a2', percent: null, feedbackReleased: false, maxAttempts: null } };
    const scoreOnly = await courseService.submitQuiz('user-1_course-1', 'lesson-1', [-1], 'op-3');
    expect(scoreOnly.feedbackReleased).toBe(false);
    expect(scoreOnly.results).toBeUndefined();
    expect(scoreOnly.maxAttempts).toBeNull();
  });

  test('attempt wording and limits', () => {
    expect(courseService.attemptAllowanceText(0, null)).toBe('Unlimited attempts');
    expect(courseService.attemptAllowanceText(1, 3)).toBe('1 of 3 attempts used');
    expect(courseService.attemptAllowanceText(3, 3)).toBe('All 3 attempts used');
    expect(courseService.attemptAllowanceText(0, 1)).toBe('One attempt allowed');
    expect(courseService.isAttemptLimitReached(3, 3)).toBe(true);
    expect(courseService.isAttemptLimitReached(3, null)).toBe(false);
  });

  test('lesson HTML becomes readable text and file lessons open as documents', () => {
    const textLesson = courseService.lesson('lesson-1', { courseId: 'course-1', moduleId: 'module-1', title: 'Read', type: 'text', content: '<p>One &amp; two</p><ul><li>Item</li></ul>' });
    expect(textLesson.content).toBe('One & two\n• Item');
    expect(textLesson.contentHtml).toBe('<p>One &amp; two</p><ul><li>Item</li></ul>');
    expect(courseService.lesson('lesson-5', { courseId: 'course-1', moduleId: 'module-1', title: 'Plain', type: 'text', content: 'Just text' }).contentHtml).toBeUndefined();
    const fileLesson = courseService.lesson('lesson-2', { courseId: 'course-1', moduleId: 'module-1', title: 'Slides', type: 'pdf', contentUrl: 'https://cdn.example/a.pdf' });
    expect(fileLesson.type).toBe('document');
    expect(fileLesson.mediaUrl).toBe('https://cdn.example/a.pdf');
    expect(courseService.lesson('lesson-3', { courseId: 'course-1', moduleId: 'module-1', title: 'Bad', type: 'game' })).toBeNull();
    expect(courseService.lesson('lesson-4', { courseId: 'course-1', moduleId: 'module-1', title: 'Free', type: 'video', isPreview: true }).isFree).toBe(true);
  });
});

describe('assignment teaching workflows', () => {
  test('a learner never sees a grade that is not published, even when the record carries one', () => {
    const ungraded = courseService.submission('s1', { lessonId: 'a1', status: 'submitted', score: 90, feedback: 'draft', rawScore: 90, rubricScores: [{ criterionId: 'c1', points: 9 }], latePenalty: { percent: 10 }, version: 2, resubmissionsUsed: 1, isLate: true, lateDays: 2 });
    expect(ungraded.score).toBeUndefined();
    expect(ungraded.feedback).toBeUndefined();
    expect(ungraded.rubricScores).toBeUndefined();
    expect(ungraded.latePenalty).toBeUndefined();
    expect(ungraded).toMatchObject({ version: 2, resubmissionsUsed: 1, isLate: true, lateDays: 2 });
    const graded = courseService.submission('s1', { lessonId: 'a1', status: 'graded', score: 72, rawScore: 80, maxScore: 100, feedback: 'Good', latePenalty: { lateDays: 1, percent: 10, points: 8 }, rubricScores: [{ criterionId: 'c1', criterionTitle: 'Argument', levelId: 'l1', levelTitle: 'Strong', points: 80, maxPoints: 100 }], appealStatus: 'open', gradedAt: { toDate: () => new Date('2026-11-20T00:00:00.000Z') } });
    expect(graded).toMatchObject({ score: 72, rawScore: 80, feedback: 'Good', appealStatus: 'open', gradedAt: '2026-11-20T00:00:00.000Z', version: 1 });
    expect(graded.latePenalty).toEqual({ lateDays: 1, percent: 10, points: 8, waived: false });
    expect(graded.rubricScores).toHaveLength(1);
  });

  test('assignment lessons carry their rubric, late penalty and resubmission policy; other lessons do not', () => {
    const assignment = courseService.lesson('a1', {
      courseId: 'course-1', moduleId: 'module-1', title: 'Essay', type: 'assignment', allowLateSubmission: true,
      rubric: { criteria: [{ id: 'c1', title: 'Argument', levels: [{ id: 'l1', title: 'Strong', points: 10 }] }] },
      latePenalty: { type: 'percent', percent: 10 }, resubmission: { allowed: true, maxResubmissions: 2, until: null },
    });
    expect(assignment.rubric.totalPoints).toBe(10);
    expect(assignment.latePenalty).toEqual({ type: 'percent', percent: 10, maxPercent: 10 });
    expect(assignment.resubmission).toEqual({ allowed: true, maxResubmissions: 2, until: null });
    const plain = courseService.lesson('a2', { courseId: 'course-1', moduleId: 'module-1', title: 'Essay', type: 'assignment' });
    expect(plain.rubric).toBeUndefined();
    expect(plain.latePenalty.type).toBe('none');
    expect(courseService.lesson('t1', { courseId: 'course-1', moduleId: 'module-1', title: 'Read', type: 'text', rubric: { criteria: [] } }).latePenalty).toBeUndefined();
  });

  test('enrollment, course and class fields', async () => {
    enrollmentSnapshot = { id: 'user-1_course-1', exists: () => true, data: () => ({ userId: 'user-1', courseId: 'course-1', status: 'active', cohortId: 'course-1_evening' }) };
    callableResponse = { id: 'user-1_course-1', cohortId: 'course-1_evening' };
    const enrollment = await courseService.enrollInCourse('user-1', 'course-1', 'op_enroll', 'course-1_evening');
    expect(lastCallableRequest).toEqual({ courseId: 'course-1', operationId: 'op_enroll', cohortId: 'course-1_evening' });
    expect(enrollment.cohortId).toBe('course-1_evening');
    await courseService.enrollInCourse('user-1', 'course-1', 'op_self');
    expect(lastCallableRequest).toEqual({ courseId: 'course-1', operationId: 'op_self' });
    expect(courseService.course('course-1', { title: 'A', description: 'B', category: 'C', level: 'beginner', status: 'published', instructor: { id: 't', name: 'T' }, cohortRequired: true }).cohortRequired).toBe(true);
  });

  test('learner calls go through manageLearning with the server\'s action names', async () => {
    callableResponse = { submissionId: 'a1_user-1', version: 2, kind: 'resubmit', isLate: false };
    expect(await courseService.submitAssignment('course-1', 'a1', ' Better ', [])).toEqual({ submissionId: 'a1_user-1', version: 2, isLate: false });
    expect(lastCallableRequest).toEqual({ action: 'submit_assignment', courseId: 'course-1', lessonId: 'a1', textResponse: 'Better', files: [] });
    callableResponse = { appeal: { id: 'a1_user-1_v2', submissionId: 'a1_user-1', status: 'open', version: 2, reason: 'Recount' } };
    const appeal = await courseService.requestGradeReview('a1_user-1', ' Recount ');
    expect(lastCallableRequest).toEqual({ action: 'request_grade_review', submissionId: 'a1_user-1', reason: 'Recount' });
    expect(appeal.status).toBe('open');
    callableResponse = { submissionId: 'a1_user-1', versions: [], grades: [], appeals: [] };
    expect((await courseService.getSubmissionHistory('a1_user-1')).submissionId).toBe('a1_user-1');
    callableResponse = { sessions: [{ id: 's1', title: 'Week 1', kind: 'live_class', joinUrl: 'https://meet.example.com/w1', startsAt: '2026-12-01T18:00:00.000Z' }] };
    const sessions = await courseService.getUpcomingSessions('course-1');
    expect(lastCallableRequest).toEqual({ action: 'course_sessions', courseId: 'course-1' });
    expect(sessions[0].joinUrl).toBe('https://meet.example.com/w1');
    await courseService.joinCohort('course-1', 'course-1_evening');
    expect(lastCallableRequest).toEqual({ action: 'join_cohort', courseId: 'course-1', cohortId: 'course-1_evening' });
  });
});
