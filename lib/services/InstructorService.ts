import { collection, doc, getDoc, getDocs, limit, query, where, type DocumentData } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { app, auth, db, storage } from '@/lib/firebaseConfig';
import { nativeSessionService } from './NativeSessionService';
import type { AssignmentFile } from '@/lib/types/course';

export type InstructorStatus = 'none' | 'pending' | 'verified';
export type InstructorCourseStatus = 'draft' | 'published' | 'archived';

export type InstructorCourse = {
  id: string;
  title: string;
  image?: string;
  category: string;
  status: InstructorCourseStatus;
  totalStudents: number;
  rating: number;
  totalRatings: number;
  price: number;
};

export type InstructorSubmission = {
  id: string;
  lessonId: string;
  studentName: string;
  status: 'submitted' | 'graded';
  textResponse: string;
  files: AssignmentFile[];
  score?: number;
  maxScore: number;
  feedback?: string;
  submittedAt?: string;
};

export type InstructorApplication = {
  firstName: string;
  lastName: string;
  email: string;
  bio: string;
  jobTitle: string;
  highestQualification: string;
  yearsOfExperience: number;
  fieldsOfExpertise: string[];
  languagesTaught: string[];
  subjectCategories: string[];
  studentLevels: string[];
  courseDeliveryMethods: string[];
  previousTeachingExperience: string;
  intendedCoursesDescription: string;
  resumeUrl: string;
};

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type StagedCourseFile = { path: string; name: string; type: 'video' | 'pdf' | 'document' | 'image'; size: number };
export type NewCourseLesson = { title: string; type: 'video' | 'text' | 'document'; content: string; duration: number; file: StagedCourseFile | null };
export type NewCourse = {
  course: { title: string; shortDescription: string; description: string; category: string; level: CourseLevel; price: number; tags: string[]; prerequisites: string[]; learningObjectives: string[] };
  thumbnail: StagedCourseFile | null;
  modules: { title: string; description: string; lessons: NewCourseLesson[] }[];
};

type ManageLearningRequest =
  | ({ action: 'publish_course' } & NewCourse)
  | { action: 'register_instructor'; profile: InstructorApplication & { applicationType: 'individual'; courseAvailability: 'both' } }
  | { action: 'update_course'; courseId: string; updates: { status: InstructorCourseStatus } }
  | { action: 'delete_course'; courseId: string }
  | { action: 'grade_submission'; submissionId: string; score: number; feedback: string };

/**
 * Instructor side of E-Learning in the app: the application, the instructor's own courses, and grading. Reads use the
 * rules (an instructor reads their own instructors/{uid}, their own courses and their courses' submissions); every write
 * goes through the manageLearning callable, which applies the same checks as the website.
 */
export class InstructorService {
  private static instance: InstructorService;
  private constructor() {}

  public static getInstance(): InstructorService {
    if (!InstructorService.instance) InstructorService.instance = new InstructorService();
    return InstructorService.instance;
  }

  public async getStatus(userId: string): Promise<InstructorStatus> {
    const snapshot = await getDoc(doc(db, 'instructors', userId));
    if (!snapshot.exists()) return 'none';
    return snapshot.data().isVerified === true ? 'verified' : 'pending';
  }

  public async getMyCourses(userId: string): Promise<InstructorCourse[]> {
    const snapshot = await getDocs(query(collection(db, 'courses'), where('instructor.id', '==', userId), limit(100)));
    return snapshot.docs
      .map((course) => this.toCourse(course.id, course.data()))
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  public async getSubmissions(courseId: string): Promise<InstructorSubmission[]> {
    const snapshot = await getDocs(query(collection(db, 'assignmentSubmissions'), where('courseId', '==', courseId), limit(200)));
    return snapshot.docs
      .map((submission) => this.toSubmission(submission.id, submission.data()))
      // Ungraded first, then newest.
      .sort((left, right) => Number(left.status === 'graded') - Number(right.status === 'graded') || (right.submittedAt ?? '').localeCompare(left.submittedAt ?? ''));
  }

  public async getLessonTitles(courseId: string): Promise<Map<string, string>> {
    const snapshot = await getDocs(query(collection(db, 'courseLessons'), where('courseId', '==', courseId), limit(300)));
    return new Map(snapshot.docs.map((lesson) => [lesson.id, typeof lesson.data().title === 'string' ? lesson.data().title : 'Assignment']));
  }

  /** Uploads the CV to instructors/{uid}/, the only folder register_instructor accepts document links from. */
  public async uploadResume(file: { uri: string; name: string; mimeType?: string }): Promise<string> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to continue.');
    const blob = await (await fetch(file.uri)).blob();
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'resume';
    const fileReference = ref(storage, `instructors/${userId}/resume/${Date.now()}_${safeName}`);
    await uploadBytes(fileReference, blob, { contentType: file.mimeType || blob.type || 'application/pdf' });
    return getDownloadURL(fileReference);
  }

  public async apply(application: InstructorApplication): Promise<void> {
    await this.call({ action: 'register_instructor', profile: { ...application, applicationType: 'individual', courseAvailability: 'both' } });
  }

  /**
   * Stages a course file at instructors/{uid}/courseUploads/<file> (the only place publish_course accepts files from;
   * the server copies it into the course's own folder).
   */
  public async uploadCourseFile(file: { uri: string; name: string; mimeType?: string; size?: number }, type: StagedCourseFile['type']): Promise<StagedCourseFile> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to continue.');
    const blob = await (await fetch(file.uri)).blob();
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'file';
    const path = `instructors/${userId}/courseUploads/${Date.now()}_${safeName}`;
    await uploadBytes(ref(storage, path), blob, { contentType: file.mimeType || blob.type || 'application/octet-stream' });
    return { path, name: file.name, type, size: file.size ?? blob.size };
  }

  /** Creates the course with its modules and lessons; verified instructors publish straight away, others go to review. */
  public async createCourse(course: NewCourse): Promise<{ courseId: string; status: 'published' | 'pending_review' }> {
    return this.call<{ courseId: string; status: 'published' | 'pending_review' }>({ action: 'publish_course', ...course });
  }

  public async setCourseStatus(courseId: string, status: InstructorCourseStatus): Promise<void> {
    await this.call({ action: 'update_course', courseId, updates: { status } });
  }

  public async deleteCourse(courseId: string): Promise<void> {
    await this.call({ action: 'delete_course', courseId });
  }

  public async grade(submissionId: string, score: number, feedback: string): Promise<void> {
    await this.call({ action: 'grade_submission', submissionId, score, feedback: feedback.trim() });
  }

  private async call<Result = unknown>(request: ManageLearningRequest): Promise<Result> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to continue.');
    await nativeSessionService.ensure(userId);
    const result = await httpsCallable<ManageLearningRequest, Result>(getFunctions(app), 'manageLearning')(request);
    nativeSessionService.assertOwner(userId);
    return result.data;
  }

  private toCourse(id: string, data: DocumentData): InstructorCourse {
    const status: InstructorCourseStatus = data.status === 'published' ? 'published' : data.status === 'archived' ? 'archived' : 'draft';
    return {
      id, status,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Untitled course',
      image: typeof data.image === 'string' && data.image ? data.image : typeof data.thumbnail === 'string' && data.thumbnail ? data.thumbnail : undefined,
      category: typeof data.category === 'string' ? data.category : '',
      totalStudents: this.number(data.totalStudents ?? data.enrollmentCount),
      rating: this.number(data.rating),
      totalRatings: this.number(data.totalRatings),
      price: this.number(data.price),
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
      lessonId: typeof data.lessonId === 'string' ? data.lessonId : '',
      status: data.status === 'graded' ? 'graded' : 'submitted',
      textResponse: typeof data.textResponse === 'string' ? data.textResponse : '',
      score: typeof data.score === 'number' ? data.score : undefined,
      maxScore: typeof data.maxScore === 'number' && data.maxScore > 0 ? data.maxScore : 100,
      feedback: typeof data.feedback === 'string' && data.feedback ? data.feedback : undefined,
      submittedAt: this.isoDate(data.submittedAt ?? data.createdAt),
    };
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
