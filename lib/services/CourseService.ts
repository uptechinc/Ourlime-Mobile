import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth, db } from '@/lib/firebaseConfig';
import { nativeSessionService } from './NativeSessionService';
import type { Course, CourseAnnouncement, CourseCategory, CourseModule, CourseLesson, Enrollment, InstructorProfile, CxcSubject } from '@/lib/types/course';

type Data = DocumentData;
type QueryDocument = QueryDocumentSnapshot<Data>;
export type LearningOverview = { courses: Course[]; announcements: CourseAnnouncement[]; instructors: InstructorProfile[]; categories: CourseCategory[] };
type MutationResponse = { id: string };

export class CourseService {
  private static instance: CourseService;
  private constructor() {}
  private get database() { return db; }
  public static getInstance(): CourseService { return this.instance ??= new CourseService(); }

  public async getOverview(userId: string): Promise<LearningOverview> {
    this.assertWebSession(userId);
    const [courses, announcements, instructors, categories] = await Promise.all([
      this.getCourses(), this.getAnnouncements(userId), this.getInstructors(), this.getCategories(),
    ]);
    nativeSessionService.assertOwner(userId);
    return { courses, announcements, instructors, categories };
  }

  public async getCourses(category = 'All', searchQuery = ''): Promise<Course[]> {
    this.requireUserId();
    const q = query(collection(this.database, 'courses'), where('status', '==', 'published'), limit(60));
    const snapshot = await getDocs(q);
    let docs = snapshot.docs;
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
    const q = query(collection(this.database, 'courseModules'), where('courseId', '==', courseId), limit(100));
    const snapshot = await getDocs(q);
    const sortedDocs = [...snapshot.docs].sort((a, b) => this.integer(a.data().order) - this.integer(b.data().order));
    const values: (CourseModule | null)[] = await Promise.all(sortedDocs.map(async (moduleDocument): Promise<CourseModule | null> => {
      let lessonDocuments: QueryDocument[] = [];
      if (access === 'enrolled') {
        const lessonsSnap = await getDocs(query(collection(this.database, 'courseLessons'), where('courseId', '==', courseId), where('moduleId', '==', moduleDocument.id), limit(200)));
        lessonDocuments = [...lessonsSnap.docs].sort((a, b) => this.integer(a.data().order) - this.integer(b.data().order));
      } else {
        lessonDocuments = await this.getPreviewLessonDocuments(courseId, moduleDocument.id);
      }
      const decodedLessons = lessonDocuments.map((item) => this.lesson(item.id, item.data())).filter((item): item is CourseLesson => item !== null);
      const data = moduleDocument.data();
      return this.text(data.courseId) && this.text(data.title) ? {
        id: moduleDocument.id, courseId: this.text(data.courseId), title: this.text(data.title), description: this.optionalText(data.description),
        order: this.integer(data.order), isPublished: data.isPublished !== false, lessons: decodedLessons,
      } satisfies CourseModule : null;
    }));
    return values.filter((item): item is CourseModule => item !== null);
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
    return snapshot.exists() && data ? this.enrollment(snapshot.id, data) : null;
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
    const sortedDocs = [...snapshot.docs].sort((a, b) => {
      const timeA = new Date(String(a.data().enrolledAt || 0)).getTime();
      const timeB = new Date(String(b.data().enrolledAt || 0)).getTime();
      return timeB - timeA;
    });
    const values = await Promise.all(sortedDocs.map(async (item) => {
      const enrollment = this.enrollment(item.id, item.data());
      if (!enrollment) return null;
      const course = await this.getCourse(enrollment.courseId);
      return course ? { ...enrollment, course } : enrollment;
    }));
    nativeSessionService.assertOwner(userId);
    return values.filter((item): item is Enrollment => item !== null);
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
    const enrollments = await this.getMyEnrollments(userId);
    const courseIds = [...new Set(enrollments.map((item) => item.courseId))].slice(0, 10);
    if (!courseIds.length) return [];
    const snapshot = await getDocs(query(collection(this.database, 'courseAnnouncements'), where('courseId', 'in', courseIds), limit(20)));
    return snapshot.docs.map((item) => this.announcement(item.id, item.data())).filter((item): item is CourseAnnouncement => item !== null);
  }

  public async getInstructors(): Promise<InstructorProfile[]> {
    this.requireUserId();
    const snapshot = await getDocs(query(collection(this.database, 'instructors'), where('isVerified', '==', true), limit(20)));
    return snapshot.docs.map((item) => this.instructor(item.id, item.data())).filter((item): item is InstructorProfile => item !== null);
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
      instructor: { id: this.text(instructor.id), name: this.text(instructor.name), email: this.optionalText(instructor.email), avatar: this.optionalText(instructor.avatar), role: this.optionalText(instructor.role) },
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
      completedLessons: this.textList(data.completedLessons ?? data.completedModules), certificateIssued: data.certificateIssued === true,
      certificateUrl: this.optionalText(data.certificateUrl) };
  }
  private lesson(id: string, data: Data): CourseLesson | null {
    const allowed = ['video', 'text', 'quiz', 'assignment', 'resource'] as const;
    const type = allowed.find((candidate) => candidate === data.type);
    if (!type || !this.text(data.courseId) || !this.text(data.moduleId) || !this.text(data.title)) return null;
    return { id, courseId: this.text(data.courseId), moduleId: this.text(data.moduleId), title: this.text(data.title), description: this.optionalText(data.description),
      type, content: this.optionalText(data.content ?? data.contentUrl), duration: this.integer(data.duration), order: this.integer(data.order),
      isRequired: data.isRequired === true, isPublished: data.isPublished !== false, isFree: data.isFree === true || data.isPreview === true };
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
