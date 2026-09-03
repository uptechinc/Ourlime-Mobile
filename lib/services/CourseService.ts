import { db } from '@/lib/firebaseConfig';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import type {
  Course,
  CourseModule,
  CourseLesson,
  Enrollment,
  CourseReview,
  CxcSubject,
} from '@/lib/types/course';

const FALLBACK_COURSES: Course[] = [
  {
    id: 'course-react-native-mastery',
    title: 'Mobile App Architecture with React Native',
    description: 'Learn modern React Native, Expo, NativeWind, TypeScript, and offline-first state architecture with real-world Caribbean mobile projects.',
    shortDescription: 'Master modern React Native with TypeScript and Expo.',
    instructor: {
      id: 'inst-1',
      name: 'Dr. Kevin Vance',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      role: 'Lead Mobile Architect',
    },
    category: 'Technology',
    level: 'intermediate',
    duration: 18,
    price: 0,
    image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600',
    rating: 4.9,
    totalRatings: 128,
    enrolledStudents: 1420,
    status: 'published',
    isPublic: true,
    tags: ['React Native', 'Expo', 'TypeScript', 'Mobile'],
    learningObjectives: [
      'Build scalable multi-screen mobile apps',
      'Integrate Firebase Authentication & Firestore',
      'Optimize UI performance with FlashList & Reanimated',
    ],
    featured: true,
  },
  {
    id: 'course-csec-math-bootcamp',
    title: 'CSEC Mathematics Comprehensive Prep',
    description: 'Complete revision of Paper 1 and Paper 2 CXC CSEC Mathematics with step-by-step worked solutions for Caribbean students.',
    shortDescription: 'Ace your CSEC Mathematics exam with proven techniques.',
    instructor: {
      id: 'inst-2',
      name: 'Prof. Ronald Persad',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      role: 'Senior CXC Examiner',
    },
    category: 'CSEC Prep',
    level: 'beginner',
    duration: 24,
    price: 0,
    image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600',
    rating: 4.8,
    totalRatings: 340,
    enrolledStudents: 3890,
    status: 'published',
    isPublic: true,
    tags: ['CSEC', 'CXC', 'Mathematics', 'Algebra', 'Geometry'],
    learningObjectives: [
      'Master Algebra, Relations, Functions & Graphs',
      'Solve Trigonometry and Coordinate Geometry problems',
      'Excel in Probability & Statistics Paper 1 & 2',
    ],
    featured: true,
  },
  {
    id: 'course-caribbean-business-finance',
    title: 'Principles of Caribbean Business & Entrepreneurship',
    description: 'Discover how to start, fund, and scale modern Caribbean businesses navigating regional regulations, banking, and digital commerce.',
    shortDescription: 'Start and grow successful Caribbean digital ventures.',
    instructor: {
      id: 'inst-3',
      name: 'Camille St. Louis',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      role: 'Caribbean Venture Partner',
    },
    category: 'Business',
    level: 'beginner',
    duration: 12,
    price: 0,
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600',
    rating: 4.7,
    totalRatings: 94,
    enrolledStudents: 980,
    status: 'published',
    isPublic: true,
    tags: ['Entrepreneurship', 'Business', 'Caribbean', 'Finance'],
    featured: true,
  },
];

const CXC_SUBJECTS_DATA: CxcSubject[] = [
  {
    id: 'csec-math',
    code: 'MATH-01',
    title: 'CSEC Mathematics',
    level: 'CSEC',
    category: 'Sciences & Math',
    topicsCount: 14,
    pastPapersCount: 22,
    papers: [
      { year: 2025, paperNumber: 1, title: 'May/June Paper 01 Solutions' },
      { year: 2025, paperNumber: 2, title: 'May/June Paper 02 Solutions' },
      { year: 2024, paperNumber: 1, title: 'May/June Paper 01 Solutions' },
      { year: 2024, paperNumber: 2, title: 'May/June Paper 02 Solutions' },
    ],
  },
  {
    id: 'csec-english-a',
    code: 'ENG-A',
    title: 'CSEC English A',
    level: 'CSEC',
    category: 'Languages',
    topicsCount: 10,
    pastPapersCount: 18,
    papers: [
      { year: 2025, paperNumber: 1, title: 'Paper 01 Comprehension Practice' },
      { year: 2025, paperNumber: 2, title: 'Paper 02 Summary & Essay Guides' },
    ],
  },
  {
    id: 'csec-it',
    code: 'IT-03',
    title: 'CSEC Information Technology',
    level: 'CSEC',
    category: 'Technology',
    topicsCount: 12,
    pastPapersCount: 16,
    papers: [
      { year: 2025, paperNumber: 1, title: 'Theory & Problem Solving' },
      { year: 2025, paperNumber: 2, title: 'SBA & Programming Solutions' },
    ],
  },
  {
    id: 'csec-biology',
    code: 'BIO-04',
    title: 'CSEC Biology',
    level: 'CSEC',
    category: 'Sciences & Math',
    topicsCount: 16,
    pastPapersCount: 15,
    papers: [
      { year: 2025, paperNumber: 1, title: 'Living Organisms & Ecology' },
      { year: 2025, paperNumber: 2, title: 'Genetics & Physiology' },
    ],
  },
  {
    id: 'csec-poa',
    code: 'POA-05',
    title: 'CSEC Principles of Accounts',
    level: 'CSEC',
    category: 'Business',
    topicsCount: 11,
    pastPapersCount: 14,
    papers: [
      { year: 2025, paperNumber: 1, title: 'Balance Sheets & Ledgers' },
      { year: 2025, paperNumber: 2, title: 'Partnership Accounts Practice' },
    ],
  },
];

export class CourseService {
  private static instance: CourseService;
  private readonly db: Firestore;

  private constructor() {
    this.db = db;
  }

  public static getInstance(): CourseService {
    if (!CourseService.instance) {
      CourseService.instance = new CourseService();
    }
    return CourseService.instance;
  }

  public async getCourses(category?: string, searchQuery?: string): Promise<Course[]> {
    try {
      const coursesRef = collection(this.db, 'courses');
      const q = category && category !== 'All'
        ? query(coursesRef, where('category', '==', category), limit(40))
        : query(coursesRef, limit(40));

      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Course[];

      if (list.length === 0) {
        list = FALLBACK_COURSES;
      }

      if (searchQuery && searchQuery.trim()) {
        const lower = searchQuery.trim().toLowerCase();
        list = list.filter(
          (c) =>
            c.title.toLowerCase().includes(lower) ||
            c.description.toLowerCase().includes(lower) ||
            c.tags?.some((t) => t.toLowerCase().includes(lower))
        );
      }

      return list;
    } catch {
      return FALLBACK_COURSES;
    }
  }

  public async getCourse(courseId: string): Promise<Course | null> {
    try {
      const courseSnap = await getDoc(doc(this.db, 'courses', courseId));
      if (courseSnap.exists()) {
        return { id: courseSnap.id, ...courseSnap.data() } as Course;
      }
      return FALLBACK_COURSES.find((c) => c.id === courseId) ?? null;
    } catch {
      return FALLBACK_COURSES.find((c) => c.id === courseId) ?? null;
    }
  }

  public async getCourseCurriculum(courseId: string): Promise<CourseModule[]> {
    try {
      const modulesRef = collection(this.db, 'courseModules');
      const q = query(modulesRef, where('courseId', '==', courseId), orderBy('order', 'asc'));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        return Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const modData = docSnap.data();
            const lessonsRef = collection(this.db, 'courseLessons');
            const lQ = query(lessonsRef, where('moduleId', '==', docSnap.id), orderBy('order', 'asc'));
            const lSnap = await getDocs(lQ);
            const lessons = lSnap.docs.map((lDoc) => ({ id: lDoc.id, ...lDoc.data() })) as CourseLesson[];

            return {
              id: docSnap.id,
              courseId,
              title: modData.title,
              description: modData.description,
              order: modData.order ?? 0,
              lessons,
            };
          })
        );
      }

      // Fallback sample curriculum
      return [
        {
          id: 'mod-1',
          courseId,
          title: 'Module 1: Foundations & Core Concepts',
          description: 'Introduction and fundamental principles.',
          order: 1,
          lessons: [
            {
              id: 'les-1-1',
              moduleId: 'mod-1',
              courseId,
              title: '1.1 Getting Started & Setup',
              type: 'video',
              duration: 15,
              order: 1,
              content: 'Welcome to this comprehensive course! In this lesson, we establish our core workspace setup and roadmap.',
              isFree: true,
            },
            {
              id: 'les-1-2',
              moduleId: 'mod-1',
              courseId,
              title: '1.2 Fundamental Architecture',
              type: 'text',
              duration: 20,
              order: 2,
              content: 'Understanding state management, component decomposition, and high-performance layout rendering.',
            },
          ],
        },
        {
          id: 'mod-2',
          courseId,
          title: 'Module 2: Advanced Techniques & Practical Implementation',
          description: 'Hands-on practical walkthroughs.',
          order: 2,
          lessons: [
            {
              id: 'les-2-1',
              moduleId: 'mod-2',
              courseId,
              title: '2.1 Building Real-World Solutions',
              type: 'video',
              duration: 35,
              order: 1,
              content: 'Step-by-step coding and architecture walkthrough.',
            },
            {
              id: 'les-2-2',
              moduleId: 'mod-2',
              courseId,
              title: '2.2 Knowledge Check & Quiz',
              type: 'quiz',
              duration: 15,
              order: 2,
              content: 'Interactive assessment covering core principles.',
            },
          ],
        },
      ];
    } catch {
      return [];
    }
  }

  public async getEnrollmentStatus(userId: string, courseId: string): Promise<Enrollment | null> {
    try {
      const q = query(
        collection(this.db, 'enrollments'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Enrollment;
      }
      return null;
    } catch {
      return null;
    }
  }

  public async enrollInCourse(userId: string, courseId: string): Promise<Enrollment> {
    const existing = await this.getEnrollmentStatus(userId, courseId);
    if (existing) return existing;

    const newEnrollmentRef = doc(collection(this.db, 'enrollments'));
    const enrollmentData = {
      userId,
      courseId,
      enrolledAt: serverTimestamp(),
      status: 'active',
      progress: 0,
      completedLessons: [],
      certificateIssued: false,
    };

    await setDoc(newEnrollmentRef, enrollmentData);
    return {
      id: newEnrollmentRef.id,
      ...enrollmentData,
      enrolledAt: new Date(),
    } as Enrollment;
  }

  public async getMyEnrollments(userId: string): Promise<Enrollment[]> {
    try {
      const q = query(collection(this.db, 'enrollments'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const enrollments = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data() as Enrollment;
          const course = await this.getCourse(data.courseId);
          return {
            ...data,
            id: docSnap.id,
            course: course ?? undefined,
          };
        })
      );

      if (enrollments.length === 0) {
        return [
          {
            id: 'mock-enr-1',
            userId,
            courseId: FALLBACK_COURSES[0].id,
            course: FALLBACK_COURSES[0],
            enrolledAt: new Date(),
            status: 'active',
            progress: 35,
            completedLessons: ['les-1-1'],
          },
          {
            id: 'mock-enr-2',
            userId,
            courseId: FALLBACK_COURSES[1].id,
            course: FALLBACK_COURSES[1],
            enrolledAt: new Date(),
            status: 'active',
            progress: 75,
            completedLessons: ['les-1-1', 'les-1-2'],
          },
        ];
      }

      return enrollments;
    } catch {
      return [];
    }
  }

  public async markLessonCompleted(
    enrollmentId: string,
    lessonId: string,
    totalLessonsCount: number
  ): Promise<void> {
    try {
      const enrollmentRef = doc(this.db, 'enrollments', enrollmentId);
      const snap = await getDoc(enrollmentRef);
      if (snap.exists()) {
        const data = snap.data();
        const completed: string[] = data.completedLessons || [];
        if (!completed.includes(lessonId)) {
          completed.push(lessonId);
          const progress = Math.min(100, Math.round((completed.length / Math.max(1, totalLessonsCount)) * 100));
          await setDoc(
            enrollmentRef,
            {
              completedLessons: completed,
              progress,
              status: progress >= 100 ? 'completed' : 'active',
              lastAccessed: serverTimestamp(),
            },
            { merge: true }
          );
        }
      }
    } catch (err) {
      console.warn('[markLessonCompleted] Error:', err);
    }
  }

  public getCxcSubjects(): CxcSubject[] {
    return CXC_SUBJECTS_DATA;
  }
}

export const courseService = CourseService.getInstance();
