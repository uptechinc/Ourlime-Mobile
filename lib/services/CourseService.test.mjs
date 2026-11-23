import { describe, expect, mock, test } from 'bun:test';

let enrollmentSnapshot = { id: 'user-1_course-1', exists: () => false, data: () => undefined };

mock.module('@/lib/firebaseConfig', () => ({ app: {}, auth: { currentUser: { uid: 'user-1' } }, db: {}, storage: {} }));
mock.module('firebase/firestore', () => ({
  collection: (_db, ...path) => path.join('/'),
  doc: (_db, ...path) => path.join('/'),
  getDoc: async () => enrollmentSnapshot,
  getDocs: async () => ({ docs: [], size: 0 }),
  limit: () => null,
  query: () => null,
  startAfter: () => null,
  where: () => null,
}));
mock.module('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => async () => ({ data: {} }) }));
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

  test('lesson HTML becomes readable text and file lessons open as documents', () => {
    const textLesson = courseService.lesson('lesson-1', { courseId: 'course-1', moduleId: 'module-1', title: 'Read', type: 'text', content: '<p>One &amp; two</p><ul><li>Item</li></ul>' });
    expect(textLesson.content).toBe('One & two\n• Item');
    const fileLesson = courseService.lesson('lesson-2', { courseId: 'course-1', moduleId: 'module-1', title: 'Slides', type: 'pdf', contentUrl: 'https://cdn.example/a.pdf' });
    expect(fileLesson.type).toBe('document');
    expect(fileLesson.mediaUrl).toBe('https://cdn.example/a.pdf');
    expect(courseService.lesson('lesson-3', { courseId: 'course-1', moduleId: 'module-1', title: 'Bad', type: 'game' })).toBeNull();
    expect(courseService.lesson('lesson-4', { courseId: 'course-1', moduleId: 'module-1', title: 'Free', type: 'video', isPreview: true }).isFree).toBe(true);
  });
});
