import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where, type DocumentData } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { app, auth, db, storage } from '@/lib/firebaseConfig';
import { settleAll } from '@/lib/utils/settleAll';
import { nativeSessionService } from './NativeSessionService';
import { decodeAppliedPenalty, decodeLatePenalty, decodeResubmission, decodeRubric, decodeRubricScores } from './AssignmentPolicy';
import type { AssignmentFile } from '@/lib/types/course';
import type {
  CourseReviewOutline,
  CourseReviewResult,
  InstructorReviewResult,
  LearningReviewDecision,
  LearningReviewQueue,
} from '@/lib/types/learningReview';
import type {
  AnnouncementDraft,
  CourseInsights,
  InstructorAnnouncement,
  InstructorApplicant,
  InstructorApplication,
  InstructorApplicationState,
  InstructorCourse,
  InstructorCourseDetail,
  InstructorCourseStatus,
  InstructorCurriculum,
  InstructorDocumentKind,
  InstructorGradeDraft,
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
  AnnouncementDraft,
  CourseInsights,
  InstructorAnnouncement,
  InstructorApplicant,
  InstructorApplication,
  InstructorApplicationState,
  InstructorCourse,
  InstructorGradeDraft,
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
  | { action: 'resubmit_course'; courseId: string }
  | { action: 'delete_course'; courseId: string }
  | { action: 'create_assessment'; kind: 'quiz'; courseId: string; title: string; description: string; questions: NewQuiz['questions']; maxAttempts?: number }
  | ({
    action: 'create_assessment'; kind: 'assignment'; courseId: string; title: string; description: string; instructions: string; dueDate: string;
    points: number; allowLateSubmission: boolean; attachments: AssignmentFile[];
  } & Pick<NewAssignment, 'latePenalty' | 'resubmission' | 'rubric'>)
  | { action: 'grade_submission'; submissionId: string; score: number; feedback: string; draft: boolean }
  | { action: 'grade_drafts'; courseId: string }
  // Course announcements and insights (the course's instructor or an administrator).
  | ({ action: 'create_announcement'; courseId: string; operationId: string } & AnnouncementDraft)
  | ({ action: 'update_announcement'; announcementId: string } & AnnouncementDraft)
  | { action: 'delete_announcement'; announcementId: string }
  | { action: 'course_insights'; courseId: string }
  // Administrator review (the server refuses anyone else).
  | { action: 'review_queue' }
  | { action: 'review_course_outline'; courseId: string }
  | { action: 'review_instructor'; instructorId: string; decision: LearningReviewDecision; reason?: string }
  | { action: 'review_course'; courseId: string; decision: LearningReviewDecision; reason?: string };

const LESSON_TYPES: readonly InstructorLessonType[] = ['video', 'text', 'quiz', 'assignment', 'resource', 'pdf', 'document', 'image', 'audio'];
const DOCUMENT_PREFIX: Record<InstructorDocumentKind, string> = { resume: 'resume', certificate: 'certificate', sample: 'sample', proof: 'proof' };

/**
 * Instructor side of E-Learning in the app: the application, the instructor's own courses (including drafts and
 * courses waiting for review, which the student-side CourseService hides), quizzes, assignments and grading. Reads use
 * the rules (an instructor reads their own instructors/{uid}, their own courses in any state with their modules and
 * lessons, their courses' submissions and announcements); every write, and the learner-progress totals, go through the
 * manageLearning callable, which applies the same checks as the website.
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
    return (await this.getApplicationState(userId)).status;
  }

  /**
   * The member's own application (instructors/{uid}, readable by its owner): verified wins; an administrator's decline
   * (review_instructor) sets applicationStatus 'declined' with the reason in declineReason; anything else is waiting.
   */
  public async getApplicationState(userId: string): Promise<InstructorApplicationState> {
    const snapshot = await getDoc(doc(db, 'instructors', userId));
    if (!snapshot.exists()) return { status: 'none', declineReason: '' };
    const data = snapshot.data();
    if (data.isVerified === true) return { status: 'verified', declineReason: '' };
    return data.applicationStatus === 'declined' ? { status: 'declined', declineReason: this.text(data.declineReason) } : { status: 'pending', declineReason: '' };
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
    const withCounts = await Promise.all(courses.map(async (course) => ({ ...course, ...(await this.assessmentCounts(course.id)) })));
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
      ...(await this.assessmentCounts(course.id)),
      shortDescription: this.text(data.shortDescription),
      description: this.text(data.description),
      level: this.text(data.level) || 'beginner',
      language: this.text(data.language) || 'en',
      tags: this.texts(data.tags),
      prerequisites: this.texts(data.prerequisites),
      learningObjectives: this.texts(data.learningObjectives),
      durationHours: this.number(data.duration),
      cohortRequired: data.cohortRequired === true,
    };
  }

  /**
   * Modules and lessons of the instructor's course in any state: the rules let a course's own instructor read its
   * outline while it is a draft, waiting for review, declined or archived (everyone else only once it is published).
   */
  public async getCurriculum(courseId: string): Promise<InstructorCurriculum> {
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

  /** Quizzes and assignments of the instructor's course (empty when the lessons can't be read). */
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

  /**
   * Puts a draft, declined or archived course forward again (resubmit_course): verified instructors publish it, others
   * send it back to the administrator's review queue. Resolves with the course's new status.
   */
  public async resubmitCourse(courseId: string): Promise<'published' | 'pending_review'> {
    const result = await this.call<{ status?: string }>({ action: 'resubmit_course', courseId });
    return result.status === 'published' ? 'published' : 'pending_review';
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
      // The server keeps the answer key apart from the lesson learners read, and enforces the attempt limit.
      ...(quiz.maxAttempts ? { maxAttempts: quiz.maxAttempts } : {}),
    });
    return result.lessonId;
  }

  public async createAssignment(assignment: NewAssignment): Promise<string> {
    const result = await this.call<{ lessonId: string }>({
      action: 'create_assessment', kind: 'assignment', courseId: assignment.courseId, title: assignment.title.trim(), description: assignment.description.trim(),
      instructions: assignment.instructions.trim(), dueDate: assignment.dueDate.toISOString(), points: Math.max(0, Math.floor(assignment.points)),
      allowLateSubmission: assignment.allowLateSubmission, attachments: assignment.attachments,
      // The server enforces the late policy, resubmissions and rubric; with a rubric the points follow its total.
      latePenalty: assignment.latePenalty, resubmission: assignment.resubmission, rubric: assignment.rubric,
    });
    return result.lessonId;
  }

  // ── Grading ──

  /**
   * The course's submissions. An assistant passes the cohorts they assist: the rules let them read only work whose
   * cohortId is one of those, so the query names each cohort (one query per cohort).
   */
  public async getSubmissions(courseId: string, cohortIds?: string[]): Promise<InstructorSubmission[]> {
    const snapshots = cohortIds
      ? await Promise.all(cohortIds.slice(0, 10).map((cohortId) => getDocs(query(collection(db, 'assignmentSubmissions'), where('courseId', '==', courseId), where('cohortId', '==', cohortId), limit(200)))))
      : [await getDocs(query(collection(db, 'assignmentSubmissions'), where('courseId', '==', courseId), limit(200)))];
    return snapshots.flatMap((snapshot) => snapshot.docs)
      .map((submission) => this.toSubmission(submission.id, submission.data()))
      // Ungraded first, then newest.
      .sort((left, right) => Number(left.status === 'graded') - Number(right.status === 'graded') || (right.submittedAt ?? '').localeCompare(left.submittedAt ?? ''));
  }

  /**
   * Hand-ins waiting for a grade, per course, as server-side counts (one aggregate read per course, no documents
   * downloaded). Only courses that can have submissions are asked; a course whose count is refused is left out, so the
   * screen shows no number rather than a wrong one.
   */
  public async getWaitingCounts(courses: InstructorCourse[]): Promise<Map<string, number>> {
    const askable = courses.filter((course) => course.status === 'published' || course.status === 'archived').slice(0, 50);
    const settled = await settleAll(askable.map((course) => getCountFromServer(query(
      collection(db, 'assignmentSubmissions'), where('courseId', '==', course.id), where('status', '==', 'submitted'),
    ))));
    const counts = new Map<string, number>();
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') counts.set(askable[index].id, result.value.data().count);
      else console.warn('[InstructorService.getWaitingCounts] Error:', result.reason instanceof Error ? result.reason.message : 'Unknown error');
    });
    return counts;
  }

  /** "12 handed in · 3 waiting · 9 graded" numbers for one course, from submissions already read. */
  public submissionSummary(submissions: InstructorSubmission[]): { total: number; waiting: number; graded: number } {
    const graded = submissions.filter((submission) => submission.status === 'graded').length;
    return { total: submissions.length, waiting: submissions.length - graded, graded };
  }

  /** draft: saves the score and feedback on the server only (gradeDrafts); the student sees nothing until it is published. */
  public async grade(submissionId: string, score: number, feedback: string, draft: boolean): Promise<void> {
    await this.call({ action: 'grade_submission', submissionId, score, feedback: feedback.trim(), draft });
  }

  /** The instructor's saved draft grades for a course (grade_drafts), to put back on the grading screen. */
  public async getGradeDrafts(courseId: string): Promise<InstructorGradeDraft[]> {
    const result = await this.call<{ drafts?: unknown }>({ action: 'grade_drafts', courseId });
    return Array.isArray(result.drafts) ? result.drafts.flatMap((entry: unknown): InstructorGradeDraft[] => {
      if (!entry || typeof entry !== 'object') return [];
      const draft = entry as DocumentData;
      return this.text(draft.submissionId) ? [{
        submissionId: this.text(draft.submissionId), lessonId: this.text(draft.lessonId), score: this.number(draft.score),
        rawScore: typeof draft.rawScore === 'number' ? draft.rawScore : this.number(draft.score), feedback: this.text(draft.feedback),
        rubricScores: decodeRubricScores(draft.rubricScores), waiveLatePenalty: draft.waiveLatePenalty === true,
      }] : [];
    }) : [];
  }

  // ── Announcements and insights ──

  /** The course's announcements, newest first (readable by its instructor and enrolled learners). */
  public async getAnnouncements(courseId: string): Promise<InstructorAnnouncement[]> {
    const snapshot = await getDocs(query(collection(db, 'courseAnnouncements'), where('courseId', '==', courseId), orderBy('createdAt', 'desc'), limit(50)));
    return snapshot.docs.flatMap((item): InstructorAnnouncement[] => {
      const announcement = this.toAnnouncement({ ...item.data(), id: item.id });
      return announcement ? [announcement] : [];
    });
  }

  /** `operationId` makes a retry return the announcement already posted instead of posting it twice. No push or email is sent. */
  public async createAnnouncement(courseId: string, draft: AnnouncementDraft, operationId: string): Promise<InstructorAnnouncement> {
    const result = await this.call<{ announcement?: unknown }>({ action: 'create_announcement', courseId, operationId, ...this.cleanDraft(draft) });
    return this.requireAnnouncement(result.announcement);
  }

  public async updateAnnouncement(announcementId: string, draft: AnnouncementDraft): Promise<InstructorAnnouncement> {
    const result = await this.call<{ announcement?: unknown }>({ action: 'update_announcement', announcementId, ...this.cleanDraft(draft) });
    return this.requireAnnouncement(result.announcement);
  }

  public async deleteAnnouncement(announcementId: string): Promise<void> {
    await this.call({ action: 'delete_announcement', announcementId });
  }

  /**
   * Learner progress totals for one course (course_insights), computed on the server because instructors cannot read
   * enrollments. Completion and per-lesson numbers are withheld while a course has too few learners.
   */
  public async getInsights(courseId: string): Promise<CourseInsights> {
    const result = await this.call<Partial<CourseInsights>>({ action: 'course_insights', courseId });
    const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0);
    const nullableCount = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
    const lessons = Array.isArray(result.lessons) ? result.lessons.flatMap((entry: unknown): CourseInsights['lessons'] => {
      if (!entry || typeof entry !== 'object') return [];
      const lesson = entry as DocumentData;
      return this.text(lesson.lessonId) ? [{
        lessonId: this.text(lesson.lessonId), title: this.text(lesson.title) || 'Lesson', type: this.text(lesson.type) || 'text',
        completedCount: nullableCount(lesson.completedCount), completedPercent: nullableCount(lesson.completedPercent), dropOff: nullableCount(lesson.dropOff),
      }] : [];
    }) : [];
    const drop = result.biggestDropOff;
    return {
      courseId, generatedAt: this.text(result.generatedAt) || new Date().toISOString(),
      enrollments: count(result.enrollments), learners: count(result.learners),
      completed: nullableCount(result.completed), completionPercent: nullableCount(result.completionPercent),
      submissionsWaiting: count(result.submissionsWaiting), lessons,
      biggestDropOff: drop && this.text(drop.lessonId) ? { lessonId: this.text(drop.lessonId), title: this.text(drop.title) || 'Lesson', dropOff: count(drop.dropOff) } : null,
      withheld: result.withheld === true, minimumGroup: count(result.minimumGroup) || 5, partial: result.partial === true,
    };
  }

  private cleanDraft(draft: AnnouncementDraft): AnnouncementDraft {
    return { title: draft.title.trim(), body: draft.body.trim(), important: draft.important };
  }

  private requireAnnouncement(value: unknown): InstructorAnnouncement {
    const announcement = value && typeof value === 'object' ? this.toAnnouncement(value as DocumentData) : null;
    if (!announcement) throw new Error('The announcement was not confirmed. Pull down to refresh.');
    return announcement;
  }

  /** From a Firestore document (Timestamps) or a manageLearning response (ISO strings). */
  private toAnnouncement(data: DocumentData): InstructorAnnouncement | null {
    const id = this.text(data.id);
    const title = this.text(data.title);
    const body = this.text(data.body ?? data.content);
    if (!id || !title || !body) return null;
    const editedAt = this.isoDate(data.editedAt);
    return {
      id, courseId: this.text(data.courseId), title, body, important: data.important === true, authorName: this.text(data.authorName) || 'Instructor',
      createdAt: this.isoDate(data.createdAt), ...(editedAt ? { editedAt } : {}),
    };
  }

  // ── Administrator review ──

  /** Instructor applications and courses waiting for an administrator, oldest first (admin only on the server). */
  public async getReviewQueue(): Promise<LearningReviewQueue> {
    return this.call<LearningReviewQueue>({ action: 'review_queue' });
  }

  /** Modules and lessons of a course waiting for review; the rules hide them from clients until it is published. */
  public async getCourseReviewOutline(courseId: string): Promise<CourseReviewOutline> {
    return this.call<CourseReviewOutline>({ action: 'review_course_outline', courseId });
  }

  /** Approve verifies the instructor; decline keeps them unverified with the (required) reason. */
  public async reviewInstructor(instructorId: string, decision: LearningReviewDecision, reason: string): Promise<InstructorReviewResult> {
    return this.call<InstructorReviewResult>({ action: 'review_instructor', instructorId, decision, ...(decision === 'decline' ? { reason: reason.trim() } : {}) });
  }

  /** Approve publishes the course; decline returns it to draft with the (required) reason. */
  public async reviewCourse(courseId: string, decision: LearningReviewDecision, reason: string): Promise<CourseReviewResult> {
    return this.call<CourseReviewResult>({ action: 'review_course', courseId, decision, ...(decision === 'decline' ? { reason: reason.trim() } : {}) });
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
        ...(type === 'assignment' ? this.assignmentPolicies(data) : {}),
      }];
    });
  }

  private assignmentPolicies(data: DocumentData): Pick<InstructorLesson, 'allowLateSubmission' | 'rubric' | 'latePenalty' | 'resubmission'> {
    const rubric = decodeRubric(data.rubric);
    return { allowLateSubmission: data.allowLateSubmission === true, ...(rubric ? { rubric } : {}), latePenalty: decodeLatePenalty(data.latePenalty), resubmission: decodeResubmission(data.resubmission) };
  }

  private async assessmentCounts(courseId: string): Promise<{ quizCount: number | null; assignmentCount: number | null }> {
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
      ...(data.reviewStatus === 'approved' || data.reviewStatus === 'declined' || data.reviewStatus === 'resubmitted' ? { reviewStatus: data.reviewStatus } : {}),
      ...(this.text(data.reviewNote) ? { reviewNote: this.text(data.reviewNote) } : {}),
    };
  }

  private toSubmission(id: string, data: DocumentData): InstructorSubmission {
    const files = Array.isArray(data.files) ? data.files.flatMap((file: unknown): AssignmentFile[] => {
      if (!file || typeof file !== 'object') return [];
      const value = file as DocumentData;
      return typeof value.url === 'string' ? [{ name: typeof value.name === 'string' ? value.name : 'Attachment', url: value.url, size: this.number(value.size) }] : [];
    }) : [];
    const studentName = typeof data.studentName === 'string' && data.studentName.trim() && !data.studentName.includes('@') ? data.studentName.trim() : 'Student';
    const appealStatus = data.appealStatus === 'open' || data.appealStatus === 'upheld' || data.appealStatus === 'adjusted' || data.appealStatus === 'withdrawn' ? data.appealStatus : undefined;
    const latePenalty = decodeAppliedPenalty(data.latePenalty);
    const rubricScores = decodeRubricScores(data.rubricScores);
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
      version: typeof data.version === 'number' && data.version >= 1 ? Math.floor(data.version) : 1,
      isLate: data.isLate === true,
      lateDays: typeof data.lateDays === 'number' && data.lateDays > 0 ? Math.floor(data.lateDays) : 0,
      cohortId: this.text(data.cohortId),
      ...(appealStatus ? { appealStatus } : {}),
      ...(typeof data.rawScore === 'number' ? { rawScore: data.rawScore } : {}),
      ...(latePenalty ? { latePenalty } : {}),
      ...(rubricScores.length > 0 ? { rubricScores } : {}),
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
