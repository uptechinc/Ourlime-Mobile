import { collection, doc, getDoc, getDocs, limit, query, where, type DocumentData } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { app, auth, db, storage } from '@/lib/firebaseConfig';
import { nativeSessionService } from './NativeSessionService';
import type { AssignmentFile } from '@/lib/types/course';
import type {
  InstructorApplicant,
  InstructorApplication,
  InstructorCourse,
  InstructorCourseDetail,
  InstructorCourseStatus,
  InstructorCurriculum,
  InstructorDocumentKind,
  InstructorLesson,
  InstructorLessonType,
  InstructorModule,
  InstructorSettableStatus,
  InstructorStatus,
  InstructorSubmission,
  NewAssignment,
  NewQuiz,
  PickedUpload,
} from '@/lib/types/instructor';

export type {
  InstructorApplicant,
  InstructorApplication,
  InstructorCourse,
  InstructorCourseDetail,
  InstructorCourseStatus,
  InstructorCurriculum,
  InstructorLesson,
  InstructorModule,
  InstructorSettableStatus,
  InstructorStatus,
  InstructorSubmission,
  NewAssignment,
  NewQuiz,
  PickedUpload,
} from '@/lib/types/instructor';

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type StagedCourseFile = { path: string; name: string; type: 'video' | 'pdf' | 'document' | 'image'; size: number };
/** Lesson types the course editor sends; files ride on a text or video lesson, as on the website's curriculum step. */
export type NewCourseLesson = { title: string; type: 'video' | 'text'; content: string; duration: number; file: StagedCourseFile | null };
export type NewCourse = {
  course: {
    title: string; shortDescription: string; description: string; category: string; subcategory: string; level: CourseLevel; price: number;
    tags: string[]; prerequisites: string[]; learningObjectives: string[];
  };
  thumbnail: StagedCourseFile | null;
  modules: { title: string; description: string; lessons: NewCourseLesson[] }[];
};

type ServerApplication = Omit<InstructorApplication, 'courseAvailability'> & { courseAvailability: 'public' | 'private' | 'both' };

type ManageLearningRequest =
  | ({ action: 'publish_course' } & NewCourse)
  | { action: 'register_instructor'; profile: ServerApplication }
  | { action: 'update_course'; courseId: string; updates: { status: InstructorSettableStatus } }
  | { action: 'delete_course'; courseId: string }
  | { action: 'create_assessment'; kind: 'quiz'; courseId: string; title: string; description: string; questions: NewQuiz['questions'] }
  | {
    action: 'create_assessment'; kind: 'assignment'; courseId: string; title: string; description: string; instructions: string; dueDate: string;
    points: number; allowLateSubmission: boolean; attachments: AssignmentFile[];
  }
  | { action: 'grade_submission'; submissionId: string; score: number; feedback: string; draft: boolean };

const LESSON_TYPES: readonly InstructorLessonType[] = ['video', 'text', 'quiz', 'assignment', 'resource', 'pdf', 'document', 'image', 'audio'];
const DOCUMENT_PREFIX: Record<InstructorDocumentKind, string> = { resume: 'resume', certificate: 'certificate', sample: 'sample', proof: 'proof' };

/**
 * Instructor side of E-Learning in the app: the application, the instructor's own courses (including drafts and
 * courses waiting for review, which the student-side CourseService hides), quizzes, assignments and grading. Reads use
 * the rules (an instructor reads their own instructors/{uid}, their own courses and their courses' submissions; modules
 * and lessons only once a course is published); every write goes through the manageLearning callable, which applies
 * the same checks as the website.
 */
export class InstructorService {
  private static instance: InstructorService;
  private constructor() {}

  public static getInstance(): InstructorService {
    if (!InstructorService.instance) InstructorService.instance = new InstructorService();
    return InstructorService.instance;
  }

  // ── Application ──

  public async getStatus(userId: string): Promise<InstructorStatus> {
    const snapshot = await getDoc(doc(db, 'instructors', userId));
    if (!snapshot.exists()) return 'none';
    return snapshot.data().isVerified === true ? 'verified' : 'pending';
  }

  /** The signed-in member's name, email and identity verification status (users/{uid}). */
  public async getApplicant(userId: string): Promise<InstructorApplicant> {
    const snapshot = await getDoc(doc(db, 'users', userId));
    const data = snapshot.data() ?? {};
    const status = this.text(data.verificationStatus) || this.text(data.identityVerificationStatus);
    const identityStatus = this.text(data.identityVerificationStatus);
    return {
      firstName: this.text(data.firstName),
      lastName: this.text(data.lastName),
      email: auth.currentUser?.email ?? '',
      // Either field marks a verified identity (the same check as the app's blog and job gates).
      verificationStatus: identityStatus === 'verified' ? 'verified' : status || null,
    };
  }

  /** Uploads an application document to instructors/{uid}/documents/, the folder register_instructor accepts links from. */
  public async uploadApplicationDocument(kind: InstructorDocumentKind, file: PickedUpload): Promise<string> {
    const userId = this.requireUserId();
    const path = `instructors/${userId}/documents/${DOCUMENT_PREFIX[kind]}_${Date.now()}_${this.safeName(file.name, kind)}`;
    return this.upload(path, file, 'application/pdf');
  }

  public async apply(application: InstructorApplication): Promise<void> {
    // The server stores public/private/both; the website's free/paid answers arrive there as 'both' too.
    const { courseAvailability: _pricing, ...rest } = application;
    await this.call({ action: 'register_instructor', profile: { ...rest, courseAvailability: 'both' } });
  }

  // ── Courses ──

  public async getMyCourses(userId: string): Promise<InstructorCourse[]> {
    const snapshot = await getDocs(query(collection(db, 'courses'), where('instructor.id', '==', userId), limit(100)));
    const courses = snapshot.docs.map((course) => this.toCourse(course.id, course.data()));
    const withCounts = await Promise.all(courses.map(async (course) => ({ ...course, ...(await this.assessmentCounts(course.id, course.status)) })));
    return withCounts.sort((left, right) => left.title.localeCompare(right.title));
  }

  /** The instructor's own course in any status (CourseService only decodes published courses). */
  public async getCourse(courseId: string): Promise<InstructorCourseDetail | null> {
    const userId = this.requireUserId();
    const snapshot = await getDoc(doc(db, 'courses', courseId));
    const data = snapshot.data();
    if (!snapshot.exists() || !data) return null;
    if (this.text(data.instructor?.id) !== userId) return null;
    const course = this.toCourse(snapshot.id, data);
    return {
      ...course,
      ...(await this.assessmentCounts(course.id, course.status)),
      shortDescription: this.text(data.shortDescription),
      description: this.text(data.description),
      level: this.text(data.level) || 'beginner',
      language: this.text(data.language) || 'en',
      tags: this.texts(data.tags),
      prerequisites: this.texts(data.prerequisites),
      learningObjectives: this.texts(data.learningObjectives),
      durationHours: this.number(data.duration),
    };
  }

  /** Modules and lessons of the instructor's course. The rules only expose them once the course is published. */
  public async getCurriculum(courseId: string, status: InstructorCourseStatus): Promise<InstructorCurriculum> {
    if (status !== 'published') return { kind: 'unavailable' };
    try {
      const [modules, lessons] = await Promise.all([
        getDocs(query(collection(db, 'courseModules'), where('courseId', '==', courseId), limit(100))),
        this.getLessons(courseId),
      ]);
      const byModule = new Map<string, InstructorLesson[]>();
      lessons.forEach((lesson) => byModule.set(lesson.moduleId, [...(byModule.get(lesson.moduleId) ?? []), lesson]));
      const decoded: InstructorModule[] = modules.docs.map((module) => ({
        id: module.id,
        title: this.text(module.data().title) || 'Module',
        description: this.text(module.data().description),
        order: this.number(module.data().order),
        lessons: (byModule.get(module.id) ?? []).sort((left, right) => left.order - right.order),
      }));
      return { kind: 'available', modules: decoded.sort((left, right) => left.order - right.order) };
    } catch (error: unknown) {
      console.warn('[InstructorService.getCurriculum] Error:', error instanceof Error ? error.message : 'Unknown error');
      return { kind: 'unavailable' };
    }
  }

  /** Quizzes and assignments of a published course (empty when the lessons can't be read). */
  public async getAssessments(courseId: string): Promise<InstructorLesson[]> {
    try {
      return (await this.getLessons(courseId)).filter((lesson) => lesson.type === 'quiz' || lesson.type === 'assignment');
    } catch (error: unknown) {
      console.warn('[InstructorService.getAssessments] Error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Stages a course file at instructors/{uid}/courseUploads/<file> (the only place publish_course accepts files from;
   * the server copies it into the course's own folder).
   */
  public async uploadCourseFile(file: PickedUpload, type: StagedCourseFile['type']): Promise<StagedCourseFile> {
    return (await this.stageCourseFile(file, type)).staged;
  }

  /** Same staging upload as uploadCourseFile, plus a download link so the course editor's file library can preview it. */
  public async stageCourseFile(file: PickedUpload, type: StagedCourseFile['type']): Promise<{ staged: StagedCourseFile; url: string }> {
    const userId = this.requireUserId();
    const path = `instructors/${userId}/courseUploads/${Date.now()}_${this.safeName(file.name, 'file')}`;
    const blob = await (await fetch(file.uri)).blob();
    const reference = ref(storage, path);
    await uploadBytes(reference, blob, { contentType: file.mimeType || blob.type || 'application/octet-stream' });
    return { staged: { path, name: file.name, type, size: file.size ?? blob.size }, url: await getDownloadURL(reference) };
  }

  /** Creates the course with its modules and lessons; verified instructors publish straight away, others go to review. */
  public async createCourse(course: NewCourse): Promise<{ courseId: string; status: 'published' | 'pending_review' }> {
    return this.call<{ courseId: string; status: 'published' | 'pending_review' }>({ action: 'publish_course', ...course });
  }

  public async setCourseStatus(courseId: string, status: InstructorSettableStatus): Promise<void> {
    await this.call({ action: 'update_course', courseId, updates: { status } });
  }

  public async deleteCourse(courseId: string): Promise<void> {
    await this.call({ action: 'delete_course', courseId });
  }

  // ── Quizzes and assignments ──

  /** Uploads an assignment attachment to courseFiles/{courseId}/{uid}/, the course folder create_assessment accepts. */
  public async uploadAssignmentAttachment(courseId: string, file: PickedUpload): Promise<AssignmentFile> {
    const userId = this.requireUserId();
    const path = `courseFiles/${courseId}/${userId}/${Date.now()}_${this.safeName(file.name, 'attachment')}`;
    const url = await this.upload(path, file, 'application/octet-stream');
    return { name: file.name, url, size: file.size ?? 0 };
  }

  public async createQuiz(quiz: NewQuiz): Promise<string> {
    const result = await this.call<{ lessonId: string }>({
      action: 'create_assessment', kind: 'quiz', courseId: quiz.courseId, title: quiz.title.trim(), description: quiz.description.trim(),
      questions: quiz.questions.map((question) => ({
        id: question.id, title: question.title.trim(), type: question.type, options: question.options.map((option) => option.trim()),
        ...(question.correctIndex !== undefined ? { correctIndex: question.correctIndex } : {}),
        ...(question.explanation ? { explanation: question.explanation.trim() } : {}),
        points: Math.max(0, Math.floor(question.points)),
      })),
    });
    return result.lessonId;
  }

  public async createAssignment(assignment: NewAssignment): Promise<string> {
    const result = await this.call<{ lessonId: string }>({
      action: 'create_assessment', kind: 'assignment', courseId: assignment.courseId, title: assignment.title.trim(), description: assignment.description.trim(),
      instructions: assignment.instructions.trim(), dueDate: assignment.dueDate.toISOString(), points: Math.max(0, Math.floor(assignment.points)),
      allowLateSubmission: assignment.allowLateSubmission, attachments: assignment.attachments,
    });
    return result.lessonId;
  }

  // ── Grading ──

  public async getSubmissions(courseId: string): Promise<InstructorSubmission[]> {
    const snapshot = await getDocs(query(collection(db, 'assignmentSubmissions'), where('courseId', '==', courseId), limit(200)));
    return snapshot.docs
      .map((submission) => this.toSubmission(submission.id, submission.data()))
      // Ungraded first, then newest.
      .sort((left, right) => Number(left.status === 'graded') - Number(right.status === 'graded') || (right.submittedAt ?? '').localeCompare(left.submittedAt ?? ''));
  }

  /** draft: saves the score and feedback without releasing them (the submission stays "submitted"). */
  public async grade(submissionId: string, score: number, feedback: string, draft: boolean): Promise<void> {
    await this.call({ action: 'grade_submission', submissionId, score, feedback: feedback.trim(), draft });
  }

  // ── Internals ──

  private async getLessons(courseId: string): Promise<InstructorLesson[]> {
    const snapshot = await getDocs(query(collection(db, 'courseLessons'), where('courseId', '==', courseId), limit(400)));
    return snapshot.docs.flatMap((lesson): InstructorLesson[] => {
      const data = lesson.data();
      const type = LESSON_TYPES.find((candidate) => candidate === data.type);
      if (!type) return [];
      return [{
        id: lesson.id, moduleId: this.text(data.moduleId), title: this.text(data.title) || 'Lesson', type, order: this.number(data.order),
        duration: this.number(data.duration), points: typeof data.points === 'number' && data.points >= 0 ? data.points : undefined,
        dueDate: this.isoDate(data.dueDate), questionCount: Array.isArray(data.quizQuestions) ? data.quizQuestions.length : 0,
      }];
    });
  }

  private async assessmentCounts(courseId: string, status: InstructorCourseStatus): Promise<{ quizCount: number | null; assignmentCount: number | null }> {
    if (status !== 'published') return { quizCount: null, assignmentCount: null };
    try {
      const lessons = await this.getLessons(courseId);
      return { quizCount: lessons.filter((lesson) => lesson.type === 'quiz').length, assignmentCount: lessons.filter((lesson) => lesson.type === 'assignment').length };
    } catch (error: unknown) {
      console.warn('[InstructorService.assessmentCounts] Error:', error instanceof Error ? error.message : 'Unknown error');
      return { quizCount: null, assignmentCount: null };
    }
  }

  private async upload(path: string, file: PickedUpload, fallbackType: string): Promise<string> {
    const blob = await (await fetch(file.uri)).blob();
    const reference = ref(storage, path);
    await uploadBytes(reference, blob, { contentType: file.mimeType || blob.type || fallbackType });
    return getDownloadURL(reference);
  }

  private async call<Result = unknown>(request: ManageLearningRequest): Promise<Result> {
    const userId = this.requireUserId();
    await nativeSessionService.ensure(userId);
    const result = await httpsCallable<ManageLearningRequest, Result>(getFunctions(app), 'manageLearning')(request);
    nativeSessionService.assertOwner(userId);
    return result.data;
  }

  private requireUserId(): string {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to continue.');
    return userId;
  }

  private safeName(name: string, fallback: string): string {
    return name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || fallback;
  }

  private toCourse(id: string, data: DocumentData): InstructorCourse {
    const status: InstructorCourseStatus = data.status === 'published' || data.status === 'archived' || data.status === 'pending_review' ? data.status : 'draft';
    const subcategory = this.text(data.subcategory);
    return {
      id, status,
      title: this.text(data.title) || 'Untitled course',
      image: this.text(data.image) || this.text(data.thumbnail) || undefined,
      category: this.text(data.category),
      ...(subcategory ? { subcategory } : {}),
      // The server writes enrolledStudents; older courses used totalStudents or enrollmentCount.
      enrolledStudents: this.number(data.enrolledStudents ?? data.totalStudents ?? data.enrollmentCount),
      rating: this.number(data.rating),
      totalRatings: this.number(data.totalRatings),
      price: this.number(data.price),
      quizCount: null,
      assignmentCount: null,
    };
  }

  private toSubmission(id: string, data: DocumentData): InstructorSubmission {
    const files = Array.isArray(data.files) ? data.files.flatMap((file: unknown): AssignmentFile[] => {
      if (!file || typeof file !== 'object') return [];
      const value = file as DocumentData;
      return typeof value.url === 'string' ? [{ name: typeof value.name === 'string' ? value.name : 'Attachment', url: value.url, size: this.number(value.size) }] : [];
    }) : [];
    const studentName = typeof data.studentName === 'string' && data.studentName.trim() && !data.studentName.includes('@') ? data.studentName.trim() : 'Student';
    return {
      id, files, studentName,
      lessonId: this.text(data.lessonId),
      status: data.status === 'graded' ? 'graded' : 'submitted',
      textResponse: typeof data.textResponse === 'string' ? data.textResponse : '',
      score: typeof data.score === 'number' ? data.score : undefined,
      maxScore: typeof data.maxScore === 'number' && data.maxScore > 0 ? data.maxScore : 100,
      feedback: typeof data.feedback === 'string' && data.feedback ? data.feedback : undefined,
      submittedAt: this.isoDate(data.submittedAt ?? data.createdAt),
      gradedAt: this.isoDate(data.gradedAt),
    };
  }

  private text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private texts(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map((entry) => entry.trim()) : [];
  }

  private number(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private isoDate(value: unknown): string | undefined {
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      const date: unknown = value.toDate();
      return date instanceof Date ? date.toISOString() : undefined;
    }
    return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : undefined;
  }
}

export const instructorService = InstructorService.getInstance();
