export type CourseInstructor = {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  bio?: string;
  role?: string;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  instructor: CourseInstructor;
  category: string;
  subcategory?: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in hours
  price: number; // 0 for free
  image: string;
  thumbnail?: string;
  rating: number;
  totalRatings: number;
  enrolledStudents: number;
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;
  tags: string[];
  prerequisites?: string[];
  learningObjectives?: string[];
  featured?: boolean;
  difficulty?: number; // 1-5 scale
  language?: string;
  createdAt?: { seconds?: number; toDate?: () => Date } | string | Date;
  updatedAt?: { seconds?: number; toDate?: () => Date } | string | Date;
};

export type CourseLesson = {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description?: string;
  /** 'document' covers file lessons (document/pdf/image/audio/file on the server): they open their file link. */
  type: 'video' | 'text' | 'quiz' | 'assignment' | 'resource' | 'document';
  /** Readable lesson text (the website stores it as HTML; tags are stripped). */
  content?: string;
  /** The lesson's video or file: contentUrl, attachedFile, or a URL stored in content. */
  mediaUrl?: string;
  /** Multiple-choice questions for quiz lessons; the server scores the answers. */
  quizQuestions?: CourseQuizQuestion[];
  duration?: number; // in minutes
  order: number;
  isRequired?: boolean;
  isPublished?: boolean;
  isFree?: boolean;
  /** Assignment/quiz due date (ISO string). */
  dueDate?: string;
  /** Points for graded lessons (quizzes/assignments). */
  points?: number;
  allowLateSubmission?: boolean;
  /** Reference files an instructor attached to an assignment. */
  attachments?: AssignmentFile[];
};

export type CourseQuizQuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export type CourseQuizQuestion = {
  id: string;
  title: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
  /** Decoded from the stored 'mcq' | 'tf' | 'short' (or the long names); short-answer questions have no options. */
  type?: CourseQuizQuestionType;
  points?: number;
};

export type CourseResource = {
  id: string;
  moduleId: string;
  title: string;
  type: 'file' | 'link' | 'video' | 'document';
  url: string;
  size?: number;
  format?: string;
  description?: string;
  order: number;
  isRequired?: boolean;
};

export type CourseModule = {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  isPublished?: boolean;
  lessons?: CourseLesson[];
  resources?: CourseResource[];
};

export type Enrollment = {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: { seconds?: number; toDate?: () => Date } | string | Date;
  status: 'active' | 'completed' | 'dropped' | 'suspended';
  progress: number; // 0-100
  lastAccessed?: { seconds?: number; toDate?: () => Date } | string | Date;
  completedLessons?: string[];
  certificateIssued?: boolean;
  certificateUrl?: string;
  course?: Course;
};

export type CxcSubject = {
  id: string;
  code: string;
  title: string;
  level: 'CSEC' | 'CAPE';
  category: string;
  iconName?: string;
  topicsCount: number;
  pastPapersCount: number;
  papers: {
    year: number;
    paperNumber: number;
    title: string;
    url?: string;
  }[];
};

export type AssignmentFile = { name: string; url: string; size: number };
export type AssignmentSubmission = { id: string; lessonId?: string; status: 'submitted' | 'graded'; textResponse: string; files: AssignmentFile[]; score?: number; maxScore?: number; feedback?: string; submittedAt?: string };
export type CourseReview = { id: string; userId: string; reviewerName: string; rating: number; comment: string; createdAt?: string };
export type CourseAnnouncement = { id: string; courseId: string; title: string; body: string; authorName: string; authorAvatar?: string; important: boolean; createdAt?: string };
export type InstructorProfile = { id: string; name: string; avatar?: string; bio?: string; specialties: string[]; rating: number; totalStudents: number; totalCourses: number; isVerified: true };
export type CourseCategory = { id: string; name: string; description?: string; icon?: string; color?: string; order: number; isActive: boolean; courseCount: number };
export type CourseDiscussion = { id: string; courseId: string; authorId: string; authorName?: string; title?: string; body: string; replyCount: number; createdAt?: string };
export type CourseDiscussionReply = { id: string; discussionId: string; courseId: string; authorId: string; authorName?: string; body: string; createdAt?: string };
export type DiscussionCursor = { createdAt: string; id: string };
export type DiscussionPage = { items: CourseDiscussion[]; cursor: DiscussionCursor | null };

/** Everything a learner's course workspace shows (web StudentCourseDashboard + modules/quizzes/assignments pages). */
export type CourseWorkspace = { course: Course; enrollment: Enrollment | null; modules: CourseModule[]; submissions: Map<string, AssignmentSubmission> };
export type LearningStats = { totalCourses: number; totalLearners: number; averageRating: number };
export type CatalogSort = 'featured' | 'recent' | 'rating';
export type CatalogPriceFilter = 'All' | 'Free' | 'Paid';
export type MyLearningStatus = 'All' | 'In progress' | 'Not started' | 'Completed';
export type MyLearningSort = 'recent' | 'progress';
