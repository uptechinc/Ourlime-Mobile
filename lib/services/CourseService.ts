import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth, db, storage } from '@/lib/firebaseConfig';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firestoreBatchReadService } from './FirestoreBatchReadService';
import { nativeSessionService } from './NativeSessionService';
import { learnerPublicName } from './LearnerNameRules';
import type { AssignmentFile, AssignmentSubmission, Course, CourseAnnouncement, CourseCompletion, CourseNextStep, CourseReview, CourseCategory, CourseModule, CourseLesson, CourseQuizQuestion, CourseQuizQuestionType, CourseResource, CourseWorkspace, Enrollment, GradeRow, Gradebook, InstructorProfile, CxcSubject, LearningStats, QuizAttemptRecord, QuizAttemptResult, QuizAttemptSummary, QuizQuestionResult } from '@/lib/types/course';

type Data = DocumentData;
type QueryDocument = QueryDocumentSnapshot<Data>;
/** The hub's data. `enrollments` is the learner's own record by course id (for "Continue learning"); it may be empty. */
export type LearningOverview = { courses: Course[]; enrollments: Map<string, Enrollment>; announcements: CourseAnnouncement[]; instructors: InstructorProfile[]; categories: CourseCategory[]; stats: LearningStats };
type MutationResponse = { id: string };
/** completeCourseLesson's reply: `score` is the attempt's percentage; `attempt` is the full marked attempt. */
type LessonCompletionResponse = { id: string; score?: number; attempt?: unknown };

const COURSE_PAGE_SIZE = 100;
const MAX_COURSE_PAGES = 20;
// Lesson types the server writes for file lessons (CourseAuthoringService LESSON_TYPES); the app opens them as files.
const FILE_LESSON_TYPES = ['document', 'pdf', 'image', 'audio', 'file'];

/** Only active and completed enrollments open a course (dropped/suspended ones do not), matching the Firestore rules. */
export const isActiveEnrollment = (enrollment: Enrollment | null | undefined): boolean =>
  Boolean(enrollment && (enrollment.status === 'active' || enrollment.status === 'completed'));

export class CourseService {
  private static instance: CourseService;
  private constructor() {}
  private get database() { return db; }
  public static getInstance(): CourseService { return this.instance ??= new CourseService(); }

  public async getOverview(userId: string): Promise<LearningOverview> {
    this.assertWebSession(userId);
    // Courses decide whether the page works at all; the learner's enrollments, announcements, tutors and categories are
    // extras that must not take the whole page down when one of them is refused (the website loads them the same way).
    // Announcements reuse the one enrollment read instead of reading the enrollments again.
    const enrollmentsRequest = this.optional('enrollments', this.getEnrollmentIndex(userId), new Map<string, Enrollment>());
    const [courses, enrollments, announcements, instructors, categories] = await Promise.all([
      this.getCourses(),
      enrollmentsRequest,
      enrollmentsRequest.then((index) => this.optional('announcements', this.getAnnouncementsFor([...index.values()]), [] as CourseAnnouncement[])),
      this.optional('instructors', this.getInstructors(), [] as InstructorProfile[]),
      this.optional('categories', this.getCategories(), [] as CourseCategory[]),
    ]);
    nativeSessionService.assertOwner(userId);
    return { courses, enrollments, announcements, instructors, categories, stats: this.getStats(courses) };
  }

  /**
   * The course the learner should continue: their most recently opened active enrollment that is not finished and is
   * still in the catalog, with its course. Null when there is none.
   */
  public continueLearning(courses: Course[], enrollments: Map<string, Enrollment>): { course: Course; enrollment: Enrollment } | null {
    const byId = new Map(courses.map((course) => [course.id, course]));
    const candidates = [...enrollments.values()]
      .filter((enrollment) => enrollment.status === 'active' && enrollment.progress < 100 && byId.has(enrollment.courseId))
      .sort((left, right) => this.activityTime(right) - this.activityTime(left));
    const enrollment = candidates[0];
    const course = enrollment ? byId.get(enrollment.courseId) : undefined;
    return enrollment && course ? { course, enrollment } : null;
  }

  private activityTime(enrollment: Enrollment): number {
    const read = (value: Enrollment['lastAccessed']): number => {
      if (!value) return 0;
      if (typeof value === 'string') return Date.parse(value) || 0;
      if (value instanceof Date) return value.getTime();
      if (typeof value.toDate === 'function') return value.toDate().getTime();
      return typeof value.seconds === 'number' ? value.seconds * 1000 : 0;
    };
    return read(enrollment.lastAccessed) || read(enrollment.enrolledAt);
  }

  /** Every published course, read in pages of 100 (the website loads the whole catalog too). */
  public async getCourses(category = 'All', searchQuery = ''): Promise<Course[]> {
    this.requireUserId();
    let docs: QueryDocument[] = [];
    let lastDocument: QueryDocument | undefined;
    for (let page = 0; page < MAX_COURSE_PAGES; page += 1) {
      const pageQuery = lastDocument
        ? query(collection(this.database, 'courses'), where('status', '==', 'published'), startAfter(lastDocument), limit(COURSE_PAGE_SIZE))
        : query(collection(this.database, 'courses'), where('status', '==', 'published'), limit(COURSE_PAGE_SIZE));
      const snapshot = await getDocs(pageQuery);
      docs = docs.concat(snapshot.docs);
      lastDocument = snapshot.docs.at(-1);
      if (snapshot.docs.length < COURSE_PAGE_SIZE || !lastDocument) break;
    }
    if (category !== 'All') {
      docs = docs.filter((item) => (item.data() as { category?: string }).category?.toLowerCase() === category.toLowerCase());
    }
    const search = searchQuery.trim().toLocaleLowerCase();
    return docs.map((item) => this.course(item.id, item.data()))
      .filter((item): item is Course => item !== null)
      .filter((item) => !search || [item.title, item.description, ...item.tags].some((value) => value.toLocaleLowerCase().includes(search)));
  }

  public async getCourse(courseId: string): Promise<Course | null> {
    this.requireUserId();
    const snapshot = await getDoc(doc(this.database, 'courses', courseId));
    const data = snapshot.data();
    return snapshot.exists() && data ? this.course(snapshot.id, data) : null;
  }

  public async getCourseCurriculum(courseId: string, access: 'preview' | 'enrolled'): Promise<CourseModule[]> {
    this.requireUserId();
    // Unpublished modules stay hidden from learners, like the website's getCourseModules (isPublished == true).
    const q = query(collection(this.database, 'courseModules'), where('courseId', '==', courseId), where('isPublished', '==', true), limit(100));
    const [snapshot, resources] = await Promise.all([
      getDocs(q),
      access === 'enrolled' ? this.optional('resources', this.getCourseResources(courseId), [] as CourseResource[]) : Promise.resolve([] as CourseResource[]),
    ]);
    const sortedDocs = [...snapshot.docs].sort((a, b) => this.integer(a.data().order) - this.integer(b.data().order));
    const values: (CourseModule | null)[] = await Promise.all(sortedDocs.map(async (moduleDocument): Promise<CourseModule | null> => {
      let lessonDocuments: QueryDocument[] = [];
      if (access === 'enrolled') {
        try {
          const lessonsSnap = await getDocs(query(collection(this.database, 'courseLessons'), where('courseId', '==', courseId), where('moduleId', '==', moduleDocument.id), limit(200)));
          lessonDocuments = [...lessonsSnap.docs].sort((a, b) => this.integer(a.data().order) - this.integer(b.data().order));
        } catch (error: unknown) {
          // The rules grant full lessons through enrollments/{uid}_{courseId}; an older auto-id enrollment is refused, so
          // show the preview lessons rather than failing the whole course page.
          console.warn('[CourseService.getCourseCurriculum] Enrolled lessons refused, showing previews:', error instanceof Error ? error.message : 'Unknown error');
          lessonDocuments = await this.getPreviewLessonDocuments(courseId, moduleDocument.id);
        }
      } else {
        lessonDocuments = await this.getPreviewLessonDocuments(courseId, moduleDocument.id);
      }
      const decodedLessons = lessonDocuments.map((item) => this.lesson(item.id, item.data()))
        .filter((item): item is CourseLesson => item !== null && item.isPublished !== false);
      const data = moduleDocument.data();
      return this.text(data.courseId) && this.text(data.title) ? {
        id: moduleDocument.id, courseId: this.text(data.courseId), title: this.text(data.title), description: this.optionalText(data.description),
        order: this.integer(data.order), isPublished: data.isPublished !== false, lessons: decodedLessons,
        resources: resources.filter((resource) => resource.moduleId === moduleDocument.id),
      } satisfies CourseModule : null;
    }));
    return values.filter((item): item is CourseModule => item !== null);
  }

  /** A course's module resources (courseResources; readable once enrolled). One query by courseId so the rules can check it. */
  public async getCourseResources(courseId: string): Promise<CourseResource[]> {
    this.requireUserId();
    const snapshot = await getDocs(query(collection(this.database, 'courseResources'), where('courseId', '==', courseId), limit(300)));
    return snapshot.docs.map((item) => this.resource(item.id, item.data()))
      .filter((item): item is CourseResource => item !== null)
      .sort((left, right) => left.order - right.order);
  }

  /** The learner's course workspace: the course, their enrollment, its modules (lessons + resources) and their submissions. */
  public async getCourseWorkspace(userId: string, courseId: string): Promise<CourseWorkspace | null> {
    this.assertWebSession(userId);
    const [course, enrollment] = await Promise.all([this.getCourse(courseId), this.getEnrollmentStatus(userId, courseId)]);
    if (!course) return null;
    const enrolled = isActiveEnrollment(enrollment);
    const [modules, submissions] = await Promise.all([
      this.getCourseCurriculum(courseId, enrolled ? 'enrolled' : 'preview'),
      enrolled ? this.optional('submissions', this.getMySubmissions(userId, courseId), new Map<string, AssignmentSubmission>()) : Promise.resolve(new Map<string, AssignmentSubmission>()),
    ]);
    nativeSessionService.assertOwner(userId);
    return { course, enrollment, modules, submissions };
  }

  /** The learner's assignment submissions in one course, keyed by lesson id. */
  public async getMySubmissions(userId: string, courseId: string): Promise<Map<string, AssignmentSubmission>> {
    this.assertWebSession(userId);
    const snapshot = await getDocs(query(collection(this.database, 'assignmentSubmissions'), where('studentId', '==', userId), where('courseId', '==', courseId), limit(200)));
    nativeSessionService.assertOwner(userId);
    const submissions = new Map<string, AssignmentSubmission>();
    snapshot.docs.forEach((item) => {
      const submission = this.submission(item.id, item.data());
      if (submission.lessonId) submissions.set(submission.lessonId, submission);
    });
    return submissions;
  }

  /** The learner's enrollments by course id, without loading the courses (for enrolled badges). */
  public async getEnrollmentIndex(userId: string): Promise<Map<string, Enrollment>> {
    this.assertWebSession(userId);
    const snapshot = await getDocs(query(collection(this.database, 'enrollments'), where('userId', '==', userId), limit(200)));
    nativeSessionService.assertOwner(userId);
    const index = new Map<string, Enrollment>();
    snapshot.docs.forEach((item) => {
      const enrollment = this.enrollment(item.id, item.data());
      // The deterministic {uid}_{courseId} document wins over an older auto-id duplicate.
      if (enrollment && (!index.has(enrollment.courseId) || item.id === userId + '_' + enrollment.courseId)) index.set(enrollment.courseId, enrollment);
    });
    return index;
  }

  /** The course's lessons in syllabus order (module order, then lesson order). */
  public flattenLessons(modules: CourseModule[]): CourseLesson[] {
    return modules.flatMap((courseModule) => courseModule.lessons ?? []);
  }

  /** The first lesson the learner has not completed (the website's "Next Up"), or null when all are done. */
  public nextLesson(modules: CourseModule[], enrollment: Enrollment | null): { lesson: CourseLesson; moduleTitle: string } | null {
    const completed = new Set(enrollment?.completedLessons ?? []);
    for (const courseModule of modules) {
      const lesson = (courseModule.lessons ?? []).find((candidate) => !completed.has(candidate.id));
      if (lesson) return { lesson, moduleTitle: courseModule.title };
    }
    return null;
  }

  /** Past its due date and not yet handed in or completed (web assignments/quizzes pages). */
  public isOverdue(lesson: CourseLesson, isDone: boolean, now = Date.now()): boolean {
    const due = lesson.dueDate ? Date.parse(lesson.dueDate) : NaN;
    return !isDone && Number.isFinite(due) && due < now;
  }

  /** Counts behind "4 of 9 done": every lesson, split into reading/video lessons, quizzes and assignments. */
  public completion(modules: CourseModule[], enrollment: Enrollment | null, submissions: Map<string, AssignmentSubmission> = new Map()): CourseCompletion {
    const completed = new Set(enrollment?.completedLessons ?? []);
    const empty = () => ({ total: 0, done: 0 });
    const result: CourseCompletion = { all: empty(), lessons: empty(), quizzes: empty(), assignments: empty() };
    this.flattenLessons(modules).forEach((lesson) => {
      const isDone = completed.has(lesson.id) || (lesson.type === 'assignment' && submissions.has(lesson.id));
      const part = lesson.type === 'quiz' ? result.quizzes : lesson.type === 'assignment' ? result.assignments : result.lessons;
      part.total += 1;
      result.all.total += 1;
      if (isDone) { part.done += 1; result.all.done += 1; }
    });
    return result;
  }

  /**
   * Overdue quiz or assignment first (it is the one with a consequence), then the next unfinished lesson in syllabus
   * order, then "finished" or "empty".
   */
  public nextStep(modules: CourseModule[], enrollment: Enrollment | null, submissions: Map<string, AssignmentSubmission> = new Map(), now = Date.now()): CourseNextStep {
    const completed = new Set(enrollment?.completedLessons ?? []);
    const isDone = (lesson: CourseLesson) => completed.has(lesson.id) || (lesson.type === 'assignment' && submissions.has(lesson.id));
    for (const courseModule of modules) {
      const overdue = (courseModule.lessons ?? []).find((lesson) => (lesson.type === 'quiz' || lesson.type === 'assignment') && this.isOverdue(lesson, isDone(lesson), now));
      if (overdue) return { kind: 'overdue', lesson: overdue, moduleTitle: courseModule.title };
    }
    for (const courseModule of modules) {
      const lesson = (courseModule.lessons ?? []).find((candidate) => !isDone(candidate));
      if (lesson) return { kind: 'lesson', lesson, moduleTitle: courseModule.title };
    }
    return this.flattenLessons(modules).length > 0 ? { kind: 'finished' } : { kind: 'empty' };
  }

  /**
   * The learner's quizzes and assignments with what counts for each: the best quiz attempt (enrollment.quizSummary,
   * kept by the server; older attempts fall back to courseProgress scores) and a graded assignment's score out of its
   * points. The average is over scored items only and is labelled that way on screen; it is not a course grade.
   */
  public gradebook(modules: CourseModule[], enrollment: Enrollment | null, submissions: Map<string, AssignmentSubmission>, legacyScores: Map<string, number> = new Map(), now = Date.now()): Gradebook {
    const completed = new Set(enrollment?.completedLessons ?? []);
    const rows: GradeRow[] = [];
    modules.forEach((courseModule) => (courseModule.lessons ?? []).forEach((lesson) => {
      if (lesson.type === 'quiz') {
        const summary = enrollment?.quizSummary?.[lesson.id];
        const legacy = legacyScores.get(lesson.id);
        const attempts = summary?.attempts ?? (legacy !== undefined ? 1 : 0);
        const percent = summary?.bestPercent ?? legacy ?? null;
        const isDone = attempts > 0 || completed.has(lesson.id);
        rows.push({
          lessonId: lesson.id, title: lesson.title, moduleTitle: courseModule.title, kind: 'quiz',
          status: isDone ? 'attempted' : this.isOverdue(lesson, false, now) ? 'overdue' : 'not_started',
          percent: percent === null ? null : Math.round(percent), attempts, latestPercent: summary?.latestPercent ?? null,
          maxAttempts: lesson.maxAttempts ?? null, dueDate: lesson.dueDate,
        });
        return;
      }
      if (lesson.type !== 'assignment') return;
      const submission = submissions.get(lesson.id);
      const maxScore = submission?.maxScore ?? lesson.points;
      const isGraded = submission?.status === 'graded' && typeof submission.score === 'number';
      const percent = isGraded && maxScore && maxScore > 0 && submission.score !== undefined ? Math.round((submission.score / maxScore) * 100) : null;
      rows.push({
        lessonId: lesson.id, title: lesson.title, moduleTitle: courseModule.title, kind: 'assignment',
        status: isGraded ? 'graded' : submission || completed.has(lesson.id) ? 'submitted' : this.isOverdue(lesson, false, now) ? 'overdue' : 'not_started',
        percent, attempts: 0, latestPercent: null, maxAttempts: null, dueDate: lesson.dueDate,
        ...(isGraded && submission.score !== undefined ? { score: submission.score } : {}), ...(maxScore !== undefined ? { maxScore } : {}),
        ...(isGraded && submission.feedback ? { feedback: submission.feedback } : {}),
      });
    }));
    const scored = rows.filter((row) => row.percent !== null).map((row) => row.percent ?? 0);
    return { rows, scoredCount: scored.length, averagePercent: scored.length ? Math.round(scored.reduce((total, value) => total + value, 0) / scored.length) : null };
  }

  /** Hub numbers like the website's: published courses, learners across them and the average of rated courses. */
  public getStats(courses: Course[]): LearningStats {
    const rated = courses.filter((course) => course.rating > 0);
    return {
      totalCourses: courses.length,
      totalLearners: courses.reduce((total, course) => total + course.enrolledStudents, 0),
      averageRating: rated.length ? rated.reduce((total, course) => total + course.rating, 0) / rated.length : 0,
    };
  }

  private async getPreviewLessonDocuments(courseId: string, moduleId: string): Promise<QueryDocument[]> {
    const [previewSnapshot, legacyFreeSnapshot] = await Promise.all([
      getDocs(query(collection(this.database, 'courseLessons'), where('courseId', '==', courseId), where('moduleId', '==', moduleId), where('isPreview', '==', true), limit(50))),
      getDocs(query(collection(this.database, 'courseLessons'), where('courseId', '==', courseId), where('moduleId', '==', moduleId), where('isFree', '==', true), limit(50))),
    ]);
    const uniqueDocuments = new Map<string, QueryDocument>();
    [...previewSnapshot.docs, ...legacyFreeSnapshot.docs].forEach((lessonDocument) => uniqueDocuments.set(lessonDocument.id, lessonDocument));
    return [...uniqueDocuments.values()].sort((leftDocument, rightDocument) => this.integer(leftDocument.data().order) - this.integer(rightDocument.data().order));
  }

  public async getEnrollmentStatus(userId: string, courseId: string): Promise<Enrollment | null> {
    this.assertWebSession(userId);
    const snapshot = await getDoc(doc(this.database, 'enrollments', userId + '_' + courseId));
    nativeSessionService.assertOwner(userId);
    const data = snapshot.data();
    if (snapshot.exists() && data) return this.enrollment(snapshot.id, data);
    // Older website enrollments have auto ids (scripts/migrateEnrollmentIds.ts on the web moves them); find those by field.
    const legacySnapshot = await getDocs(query(collection(this.database, 'enrollments'), where('userId', '==', userId), where('courseId', '==', courseId), limit(1)));
    nativeSessionService.assertOwner(userId);
    const legacyDocument = legacySnapshot.docs[0];
    return legacyDocument ? this.enrollment(legacyDocument.id, legacyDocument.data()) : null;
  }

  public async enrollInCourse(userId: string, courseId: string, operationId = userId + '_' + courseId): Promise<Enrollment> {
    await nativeSessionService.ensure(userId);
    await httpsCallable<{ courseId: string; operationId: string }, MutationResponse>(getFunctions(app), 'enrollInCourse')({ courseId, operationId });
    const value = await this.getEnrollmentStatus(userId, courseId);
    if (!value) throw new Error('Enrollment could not be confirmed.');
    return value;
  }

  public async getMyEnrollments(userId: string): Promise<Enrollment[]> {
    this.assertWebSession(userId);
    const snapshot = await getDocs(query(collection(this.database, 'enrollments'), where('userId', '==', userId), limit(100)));
    // enrolledAt is a Firestore Timestamp; String(timestamp) is not a parseable date, so read it through timestamp().
    const enrolledAtMillis = (data: Data): number => Date.parse(this.timestamp(data.enrolledAt) ?? '') || 0;
    const sortedDocs = [...snapshot.docs].sort((leftDocument, rightDocument) => enrolledAtMillis(rightDocument.data()) - enrolledAtMillis(leftDocument.data()));
    const values = await Promise.all(sortedDocs.map(async (item) => {
      const enrollment = this.enrollment(item.id, item.data());
      if (!enrollment) return null;
      const course = await this.getCourse(enrollment.courseId);
      return course ? { ...enrollment, course } : enrollment;
    }));
    nativeSessionService.assertOwner(userId);
    return values.filter((item): item is Enrollment => item !== null);
  }

  /** The learner's scored lessons in a course (courseProgress: moduleId holds the lesson id), as lessonId -> score. */
  public async getLessonScores(userId: string, courseId: string): Promise<Map<string, number>> {
    this.assertWebSession(userId);
    const snapshot = await getDocs(query(collection(this.database, 'courseProgress'), where('userId', '==', userId), where('courseId', '==', courseId), limit(200)));
    nativeSessionService.assertOwner(userId);
    const scores = new Map<string, number>();
    snapshot.docs.forEach((item) => {
      const data = item.data();
      if (typeof data.score === 'number' && Number.isFinite(data.score) && this.text(data.moduleId)) scores.set(this.text(data.moduleId), Math.round(data.score));
    });
    return scores;
  }

  /** Published reviews of a course, newest first (courseReviews; readable while the course is published). */
  public async getReviews(courseId: string): Promise<CourseReview[]> {
    this.requireUserId();
    const snapshot = await getDocs(query(collection(this.database, 'courseReviews'), where('courseId', '==', courseId), limit(50)));
    // The stored title falls back to the account's userName, which for some accounts is their email address: show the
    // profile's name instead, and never an email. Student (minor) accounts show a first name and last initial.
    const reviewerIds = [...new Set(snapshot.docs.map((item) => this.text(item.data().userId)).filter(Boolean))];
    const profiles = await this.optional('reviewers', firestoreBatchReadService.getDocumentsByIds('users', reviewerIds), new Map<string, Data>());
    return snapshot.docs.flatMap((item): CourseReview[] => {
      const data = item.data();
      const rating = this.integer(data.rating);
      if (rating < 1 || rating > 5) return [];
      const userId = this.text(data.userId);
      return [{ id: item.id, userId, reviewerName: learnerPublicName(profiles.get(userId), this.text(data.title)), rating, comment: this.text(data.comment), createdAt: this.timestamp(data.createdAt) }];
    }).sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));
  }

  /** Rates a course through manageLearning (add_review), the same server action the website uses; one review per learner. */
  public async addReview(courseId: string, rating: number, comment: string): Promise<void> {
    const userId = this.requireUserId();
    await nativeSessionService.ensure(userId);
    await httpsCallable<{ action: 'add_review'; courseId: string; rating: number; comment: string }, { reviewId: string }>(getFunctions(app), 'manageLearning')({
      action: 'add_review', courseId, rating, comment: comment.trim(),
    });
    nativeSessionService.assertOwner(userId);
  }

  /** The learner's own submission for an assignment lesson, if any (readable by the student and the course owner). */
  public async getMySubmission(userId: string, lessonId: string): Promise<AssignmentSubmission | null> {
    this.assertWebSession(userId);
    const snapshot = await getDocs(query(collection(this.database, 'assignmentSubmissions'), where('studentId', '==', userId), where('lessonId', '==', lessonId), limit(1)));
    nativeSessionService.assertOwner(userId);
    const item = snapshot.docs[0];
    return item ? this.submission(item.id, item.data()) : null;
  }

  private submission(id: string, data: Data): AssignmentSubmission {
    return {
      id, lessonId: this.optionalText(data.lessonId), status: data.status === 'graded' ? 'graded' : 'submitted', textResponse: this.text(data.textResponse), files: this.files(data.files),
      score: typeof data.score === 'number' ? data.score : undefined, maxScore: typeof data.maxScore === 'number' ? data.maxScore : undefined,
      feedback: this.optionalText(data.feedback), submittedAt: this.timestamp(data.submittedAt ?? data.createdAt),
    };
  }

  private files(value: unknown): AssignmentFile[] {
    return Array.isArray(value) ? value.flatMap((file: unknown): AssignmentFile[] => {
      const entry = this.object(file);
      return entry && this.text(entry.url) ? [{ name: this.text(entry.name) || 'Attachment', url: this.text(entry.url), size: this.integer(entry.size) }] : [];
    }) : [];
  }

  /** Uploads one attachment to assignment-submissions/{uid}/{lessonId}/, the folder the server accepts attachments from. */
  public async uploadAssignmentFile(lessonId: string, file: { uri: string; name: string; mimeType?: string; size?: number }): Promise<AssignmentFile> {
    const userId = this.requireUserId();
    const blob = await (await fetch(file.uri)).blob();
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'attachment';
    const fileReference = ref(storage, `assignment-submissions/${userId}/${lessonId}/${Date.now()}_${safeName}`);
    await uploadBytes(fileReference, blob, { contentType: file.mimeType || blob.type || 'application/octet-stream' });
    return { name: file.name, url: await getDownloadURL(fileReference), size: file.size ?? blob.size };
  }

  /** Hands an assignment in through manageLearning (submit_assignment), as the website does; resubmitting replaces it until graded. */
  public async submitAssignment(courseId: string, lessonId: string, textResponse: string, files: AssignmentFile[]): Promise<void> {
    const userId = this.requireUserId();
    await nativeSessionService.ensure(userId);
    await httpsCallable<{ action: 'submit_assignment'; courseId: string; lessonId: string; textResponse: string; files: AssignmentFile[] }, { submissionId: string }>(getFunctions(app), 'manageLearning')({
      action: 'submit_assignment', courseId, lessonId, textResponse: textResponse.trim(), files,
    });
    nativeSessionService.assertOwner(userId);
  }

  /**
   * Submits one quiz attempt with answers aligned by question index, exactly like the website quiz page: the chosen option
   * index, or -1 when skipped or for a short-answer question. The server marks it with its own key, records the attempt
   * and returns it with the feedback the quiz releases. Reuse the same operationId to retry after a lost connection: the
   * server then returns the same attempt instead of recording a second one.
   */
  public async submitQuiz(enrollmentId: string, lessonId: string, answers: number[], operationId: string): Promise<QuizAttemptResult | null> {
    const userId = this.requireUserId();
    await nativeSessionService.ensure(userId);
    const result = await httpsCallable<{ enrollmentId: string; lessonId: string; operationId: string; answers: number[] }, LessonCompletionResponse>(getFunctions(app), 'completeCourseLesson')({
      enrollmentId, lessonId, operationId, answers,
    });
    nativeSessionService.assertOwner(userId);
    return this.quizAttempt(result.data.attempt);
  }

  /** The learner's own attempts at one quiz, newest first (quizAttempts; at most 20, readable by the learner and the instructor). */
  public async getMyQuizAttempts(userId: string, lessonId: string): Promise<QuizAttemptRecord[]> {
    this.assertWebSession(userId);
    const snapshot = await getDocs(query(collection(this.database, 'quizAttempts'), where('userId', '==', userId), where('lessonId', '==', lessonId), orderBy('submittedAt', 'desc'), limit(20)));
    nativeSessionService.assertOwner(userId);
    return snapshot.docs.map((item) => {
      const data = item.data();
      return { id: item.id, attemptNumber: this.integer(data.attemptNumber), percent: this.finiteOrNull(data.percent), submittedAt: this.timestamp(data.submittedAt) };
    });
  }

  /** "Unlimited attempts", "3 attempts allowed", "1 of 3 attempts used", "All 3 attempts used". */
  public attemptAllowanceText(attemptsUsed: number, maxAttempts: number | null | undefined): string {
    if (typeof maxAttempts !== 'number' || maxAttempts <= 0) return attemptsUsed > 0 ? `${attemptsUsed} ${attemptsUsed === 1 ? 'attempt' : 'attempts'} so far · unlimited` : 'Unlimited attempts';
    if (attemptsUsed <= 0) return maxAttempts === 1 ? 'One attempt allowed' : `${maxAttempts} attempts allowed`;
    if (attemptsUsed >= maxAttempts) return maxAttempts === 1 ? 'Your one attempt is used' : `All ${maxAttempts} attempts used`;
    return `${attemptsUsed} of ${maxAttempts} attempts used`;
  }

  public isAttemptLimitReached(attemptsUsed: number, maxAttempts: number | null | undefined): boolean {
    return typeof maxAttempts === 'number' && maxAttempts > 0 && attemptsUsed >= maxAttempts;
  }

  /** The attempt in a completeCourseLesson response, or null when there is none (a quiz without questions). */
  public quizAttempt(value: unknown): QuizAttemptResult | null {
    const source = this.object(value);
    if (!source || !this.text(source.id)) return null;
    const results = Array.isArray(source.results) ? source.results.flatMap((entry: unknown): QuizQuestionResult[] => {
      const item = this.object(entry);
      if (!item || !this.text(item.questionId)) return [];
      const correctIndex = this.finiteOrNull(item.correctIndex);
      const explanation = this.optionalText(item.explanation);
      return [{
        questionId: this.text(item.questionId), index: this.integer(item.index), scored: item.scored === true, correct: item.correct === true,
        chosenIndex: Math.floor(this.finiteOrNull(item.chosenIndex) ?? -1), points: this.number(item.points), earned: this.number(item.earned),
        ...(correctIndex !== null ? { correctIndex } : {}), ...(explanation ? { explanation } : {}),
      }];
    }) : undefined;
    const maxAttempts = this.finiteOrNull(source.maxAttempts);
    const remaining = this.finiteOrNull(source.attemptsRemaining);
    return {
      id: this.text(source.id), attemptNumber: this.integer(source.attemptNumber), score: this.number(source.score), maxScore: this.number(source.maxScore),
      percent: this.finiteOrNull(source.percent), correctCount: this.integer(source.correctCount), markableCount: this.integer(source.markableCount),
      feedbackReleased: source.feedbackReleased === true && results !== undefined, ...(results ? { results } : {}),
      attemptsUsed: this.integer(source.attemptsUsed), maxAttempts: maxAttempts === null ? null : Math.floor(maxAttempts),
      attemptsRemaining: remaining === null ? null : this.integer(remaining), bestPercent: this.finiteOrNull(source.bestPercent), submittedAt: this.text(source.submittedAt),
    };
  }

  public async markLessonCompleted(enrollmentId: string, lessonId: string, _totalLessonsCount: number): Promise<void> {
    const userId = this.requireUserId();
    await nativeSessionService.ensure(userId);
    await httpsCallable<{ enrollmentId: string; lessonId: string; operationId: string }, MutationResponse>(getFunctions(app), 'completeCourseLesson')({
      enrollmentId, lessonId, operationId: enrollmentId + '_' + lessonId,
    });
    nativeSessionService.assertOwner(userId);
  }

  public async getAnnouncements(userId: string): Promise<CourseAnnouncement[]> {
    return this.getAnnouncementsFor([...(await this.getEnrollmentIndex(userId)).values()]);
  }

  /** Announcements of the learner's active courses (at most 10 courses, 5 each), from enrollments already read. */
  private async getAnnouncementsFor(enrollments: Enrollment[]): Promise<CourseAnnouncement[]> {
    const courseIds = [...new Set(enrollments.filter((item) => isActiveEnrollment(item)).map((item) => item.courseId))].slice(0, 10);
    if (!courseIds.length) return [];
    // One equality query per course: the rules can only prove access course by course, so a single `in` query is refused
    // as soon as one of the courses is not readable.
    const perCourse = await Promise.all(courseIds.map((courseId) => this.optional('announcements:' + courseId,
      getDocs(query(collection(this.database, 'courseAnnouncements'), where('courseId', '==', courseId), limit(5)))
        .then((snapshot) => snapshot.docs.map((item) => this.announcement(item.id, item.data())).filter((item): item is CourseAnnouncement => item !== null)),
      [] as CourseAnnouncement[])));
    return perCourse.flat();
  }

  private async optional<Value>(label: string, request: Promise<Value>, fallback: Value): Promise<Value> {
    try {
      return await request;
    } catch (error: unknown) {
      console.warn('[CourseService.optional] ' + label + ' unavailable:', error instanceof Error ? error.message : 'Unknown error');
      return fallback;
    }
  }

  public async getInstructors(): Promise<InstructorProfile[]> {
    this.requireUserId();
    const snapshot = await getDocs(query(collection(this.database, 'instructors'), where('isVerified', '==', true), limit(20)));
    const instructors = snapshot.docs
      .map((item) => this.instructor(item.id, item.data()))
      .filter((item): item is InstructorProfile => item !== null)
      .sort((left, right) => right.totalStudents - left.totalStudents);
    // Some instructors have more than one profile document; list each person once (the busiest profile wins).
    const seenNames = new Set<string>();
    return instructors.filter((instructor) => {
      const key = instructor.name.toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });
  }

  public async getCategories(): Promise<CourseCategory[]> {
    this.requireUserId();
    const snapshot = await getDocs(query(collection(this.database, 'courseCategories'), where('isActive', '==', true), limit(100)));
    const sorted = [...snapshot.docs].sort((a, b) => this.integer(a.data().order) - this.integer(b.data().order));
    return sorted.map((item) => this.category(item.id, item.data())).filter((item): item is CourseCategory => item !== null);
  }

  public async getCxcSubjects(): Promise<CxcSubject[]> {
    this.requireUserId();
    const snapshot = await getDocs(query(collection(this.database, 'cxcSubjects'), where('published', '==', true), limit(100)));
    const sorted = [...snapshot.docs].sort((a, b) => this.text(a.data().title).localeCompare(this.text(b.data().title)));
    const subjects = sorted.map((item) => this.cxc(item.id, item.data())).filter((item): item is CxcSubject => item !== null);
    return Promise.all(subjects.map(async (subject) => {
      const papers = await getDocs(query(collection(this.database, 'cxcPapers'), where('subjectId', '==', subject.id), where('published', '==', true), limit(100)));
      const sortedPapers = [...papers.docs].sort((a, b) => this.integer(b.data().year) - this.integer(a.data().year));
      return { ...subject, papers: sortedPapers.map((paper) => {
        const data = paper.data();
        return { year: this.integer(data.year), paperNumber: this.integer(data.paperNumber), title: this.text(data.title), url: this.optionalText(data.url) };
      }).filter((paper) => paper.year > 0 && paper.paperNumber > 0 && Boolean(paper.title)) };
    }));
  }

  private course(id: string, data: Data): Course | null {
    const instructor = this.object(data.instructor);
    const level = data.level === 'beginner' || data.level === 'intermediate' || data.level === 'advanced' ? data.level : null;
    if (!level || data.status !== 'published' || !this.text(data.title) || !this.text(data.description) || !this.text(data.category) || !instructor || !this.text(instructor.id) || !this.text(instructor.name)) return null;
    return { id, title: this.text(data.title), description: this.text(data.description), shortDescription: this.optionalText(data.shortDescription),
      // Older course documents still carry the instructor's email; it is never decoded or shown.
      instructor: { id: this.text(instructor.id), name: this.text(instructor.name), avatar: this.optionalText(instructor.avatar), role: this.optionalText(instructor.role) },
      category: this.text(data.category), subcategory: this.optionalText(data.subcategory), level, duration: this.number(data.duration), price: this.number(data.price),
      image: this.text(data.image), thumbnail: this.optionalText(data.thumbnail), rating: this.number(data.rating), totalRatings: this.integer(data.totalRatings),
      enrolledStudents: this.integer(data.enrolledStudents), status: 'published', isPublic: data.isPublic !== false, tags: this.textList(data.tags),
      prerequisites: this.textList(data.prerequisites), learningObjectives: this.textList(data.learningObjectives), featured: data.featured === true,
      difficulty: this.integer(data.difficulty), language: this.optionalText(data.language), createdAt: this.timestamp(data.createdAt), updatedAt: this.timestamp(data.updatedAt) };
  }
  private enrollment(id: string, data: Data): Enrollment | null {
    const status = data.status === 'active' || data.status === 'completed' || data.status === 'dropped' || data.status === 'suspended' ? data.status : null;
    if (!status || !this.text(data.userId) || !this.text(data.courseId)) return null;
    return { id, userId: this.text(data.userId), courseId: this.text(data.courseId), enrolledAt: this.timestamp(data.enrolledAt) ?? 'Date unavailable',
      status, progress: Math.max(0, Math.min(100, this.number(data.progress))), lastAccessed: this.timestamp(data.lastAccessed),
      // Both names hold completed lesson ids (website: completedModules); merge them like the website and the server do.
      completedLessons: [...new Set([...this.textList(data.completedLessons), ...this.textList(data.completedModules)])], certificateIssued: data.certificateIssued === true,
      certificateUrl: this.optionalText(data.certificateUrl), quizSummary: this.quizSummaries(data.quizSummary) };
  }
  private quizSummaries(value: unknown): { [lessonId: string]: QuizAttemptSummary } {
    const summaries: { [lessonId: string]: QuizAttemptSummary } = {};
    Object.entries(this.object(value) ?? {}).forEach(([lessonId, entry]) => {
      const summary = this.object(entry);
      if (summary) summaries[lessonId] = { attempts: this.integer(summary.attempts), bestPercent: this.finiteOrNull(summary.bestPercent), latestPercent: this.finiteOrNull(summary.latestPercent) };
    });
    return summaries;
  }
  private lesson(id: string, data: Data): CourseLesson | null {
    const allowed = ['video', 'text', 'quiz', 'assignment', 'resource', 'document'] as const;
    // File lessons (document/pdf/image/audio/file, e.g. from the app's course creator) open their file like a resource.
    const storedType: unknown = FILE_LESSON_TYPES.includes(this.text(data.type)) ? 'document' : data.type;
    const type = allowed.find((candidate) => candidate === storedType);
    if (!type || !this.text(data.courseId) || !this.text(data.moduleId) || !this.text(data.title)) return null;
    // Same sources as the website lesson page: the media is contentUrl, attachedFile or a URL in content; content is HTML text.
    const content = this.text(data.content);
    const contentIsUrl = /^https?:\/\//i.test(content);
    const mediaUrl = this.optionalText(data.contentUrl) ?? this.optionalText(data.attachedFile) ?? (contentIsUrl ? content : undefined);
    return { id, courseId: this.text(data.courseId), moduleId: this.text(data.moduleId), title: this.text(data.title), description: this.optionalText(data.description),
      type, content: contentIsUrl ? undefined : this.plainText(content),
      // Formatted text keeps its HTML for RichBlogContent, which rebuilds it from a closed set of native blocks.
      ...(!contentIsUrl && /<[a-z][^>]*>/i.test(content) ? { contentHtml: content.slice(0, 200000) } : {}),
      mediaUrl, quizQuestions: this.quizQuestions(data.quizQuestions),
      ...(typeof data.maxAttempts === 'number' && Number.isInteger(data.maxAttempts) && data.maxAttempts > 0 ? { maxAttempts: data.maxAttempts } : {}),
      duration: this.integer(data.duration), order: this.integer(data.order),
      isRequired: data.isRequired === true, isPublished: data.isPublished !== false, isFree: data.isFree === true || data.isPreview === true,
      dueDate: this.timestamp(data.dueDate), points: typeof data.points === 'number' && Number.isFinite(data.points) ? Math.max(0, data.points) : undefined,
      allowLateSubmission: data.allowLateSubmission === true, attachments: this.files(data.attachments) };
  }
  /**
   * Every stored question, in server order: the server marks answers[index] against quizQuestions[index], so dropping
   * one (e.g. a short-answer question with no options) would shift every later answer. The answer key (correctIndex,
   * explanation) is never decoded, even from lessons written before it moved server-side.
   */
  private quizQuestions(value: unknown): CourseQuizQuestion[] {
    if (!Array.isArray(value)) return [];
    return value.map((item: unknown, index): CourseQuizQuestion => {
      const question: Data = this.object(item) ?? {};
      const storedOptions = this.textList(question.options);
      const type = this.questionType(question.type, storedOptions.length);
      const options = type === 'short_answer' ? [] : type === 'true_false' && storedOptions.length < 2 ? ['True', 'False'] : storedOptions;
      return { id: this.text(question.id) || 'question-' + index, title: this.text(question.title) || this.text(question.question) || 'Question ' + (index + 1), options, type,
        points: typeof question.points === 'number' && Number.isFinite(question.points) ? Math.max(0, question.points) : 1 };
    });
  }
  private questionType(value: unknown, optionCount: number): CourseQuizQuestionType {
    if (value === 'tf' || value === 'true_false') return 'true_false';
    if (value === 'short' || value === 'short_answer') return 'short_answer';
    return optionCount > 0 ? 'multiple_choice' : 'short_answer';
  }
  private resource(id: string, data: Data): CourseResource | null {
    if (!this.text(data.moduleId) || !/^https?:\/\//i.test(this.text(data.url))) return null;
    const type = data.type === 'link' || data.type === 'video' || data.type === 'document' ? data.type : 'file';
    return { id, moduleId: this.text(data.moduleId), title: this.text(data.title) || 'Resource', type, url: this.text(data.url),
      size: this.integer(data.size) || undefined, format: this.optionalText(data.format), description: this.optionalText(data.description),
      order: this.integer(data.order), isRequired: data.isRequired === true };
  }
  private plainText(html: string): string | undefined {
    const text = html
      .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text || undefined;
  }
  private announcement(id: string, data: Data): CourseAnnouncement | null {
    if (!this.text(data.courseId) || !this.text(data.title) || !this.text(data.body ?? data.content)) return null;
    return { id, courseId: this.text(data.courseId), title: this.text(data.title), body: this.text(data.body ?? data.content),
      authorName: this.text(data.authorName) || 'Instructor', authorAvatar: this.optionalText(data.authorAvatar), important: data.important === true, createdAt: this.timestamp(data.createdAt) };
  }
  private instructor(id: string, data: Data): InstructorProfile | null {
    if (!this.text(data.name) || data.isVerified !== true) return null;
    return { id, name: this.text(data.name), avatar: this.optionalText(data.avatar), bio: this.optionalText(data.bio), specialties: this.textList(data.specialties),
      rating: this.number(data.rating), totalStudents: this.integer(data.totalStudents), totalCourses: this.integer(data.totalCourses), isVerified: true };
  }
  private category(id: string, data: Data): CourseCategory | null {
    if (!this.text(data.name)) return null;
    return { id, name: this.text(data.name), description: this.optionalText(data.description), icon: this.optionalText(data.icon), color: this.optionalText(data.color),
      order: this.integer(data.order), isActive: data.isActive === true, courseCount: this.integer(data.courseCount) };
  }
  private cxc(id: string, data: Data): CxcSubject | null {
    const level = data.level === 'CSEC' || data.level === 'CAPE' ? data.level : null;
    if (!level || !this.text(data.title) || !this.text(data.code)) return null;
    return { id, code: this.text(data.code), title: this.text(data.title), level, category: this.text(data.category),
      topicsCount: this.integer(data.topicsCount), pastPapersCount: this.integer(data.pastPapersCount), papers: [] };
  }
  private requireUserId(): string { const userId = auth.currentUser?.uid; if (!userId) throw new Error('You must be signed in to use E-Learning.'); return userId; }
  private assertWebSession(userId: string): void {
    if (!userId || auth.currentUser?.uid !== userId) throw new Error('Your account changed. Reopen E-Learning.');
  }
  private object(value: unknown): Data | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Data : null; }
  private text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
  private optionalText(value: unknown): string | undefined { const result = this.text(value); return result || undefined; }
  private number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
  private finiteOrNull(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
  private integer(value: unknown): number { return Math.max(0, Math.round(this.number(value))); }
  private textList(value: unknown): string[] { return Array.isArray(value) ? value.map((entry) => this.text(entry)).filter(Boolean) : []; }
  private timestamp(value: unknown): string | undefined {
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
    const candidate = this.object(value);
    if (candidate && typeof candidate.toDate === 'function') {
      const converted: unknown = candidate.toDate();
      if (converted instanceof Date && Number.isFinite(converted.getTime())) return converted.toISOString();
    }
    return undefined;
  }
}
export const courseService = CourseService.getInstance();
