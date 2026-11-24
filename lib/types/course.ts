/** A course's instructor as learners see it. Course documents no longer carry the instructor's email (it is server-only). */
export type CourseInstructor = {
  id: string;
  name: string;
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
  /** The instructor's formatted text when it was written as HTML; RichBlogContent parses it into native blocks (no WebView). */
  contentHtml?: string;
  /** The lesson's video or file: contentUrl, attachedFile, or a URL stored in content. */
  mediaUrl?: string;
  /** Quiz questions without the answer key (the server keeps it and marks every attempt). */
  quizQuestions?: CourseQuizQuestion[];
  /** Attempts a learner may make at this quiz; undefined means unlimited. */
  maxAttempts?: number;
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

/** A quiz question as a learner holds it: never the correct option or the explanation (the server returns those as feedback). */
export type CourseQuizQuestion = {
  id: string;
  title: string;
  options: string[];
  /** Decoded from the stored 'mcq' | 'tf' | 'short' (or the long names); short-answer questions have no options. */
  type?: CourseQuizQuestionType;
  points?: number;
};

/** How the server marked one question. correctIndex and explanation are present only when the quiz releases feedback. */
export type QuizQuestionResult = {
  questionId: string;
  index: number;
  scored: boolean;
  correct: boolean;
  chosenIndex: number;
  points: number;
  earned: number;
  correctIndex?: number;
  explanation?: string;
};

/** One quiz attempt as completeCourseLesson returns it. */
export type QuizAttemptResult = {
  id: string;
  attemptNumber: number;
  score: number;
  maxScore: number;
  /** null when the quiz has no scored question. */
  percent: number | null;
  correctCount: number;
  markableCount: number;
  feedbackReleased: boolean;
  results?: QuizQuestionResult[];
  attemptsUsed: number;
  maxAttempts: number | null;
  attemptsRemaining: number | null;
  bestPercent: number | null;
  submittedAt: string;
};

/** enrollments/{id}.quizSummary.{lessonId}: attempts used and the best score, which is the one that counts. */
export type QuizAttemptSummary = { attempts: number; bestPercent: number | null; latestPercent: number | null };

/** A past attempt from quizAttempts (the learner's own history; it never carries the answer key). */
export type QuizAttemptRecord = { id: string; attemptNumber: number; percent: number | null; submittedAt?: string };

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
  /** The learner's quiz record per quiz lesson id, kept by the server. */
  quizSummary?: { [lessonId: string]: QuizAttemptSummary };
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

/** Done and total for one part of what completes a course. */
export type CompletionPart = { total: number; done: number };

/**
 * What finishing a course takes, from its syllabus and the learner's record: every lesson counts; a quiz counts once an
 * attempt is submitted (no pass mark yet) and an assignment once it is handed in, which is how the server completes them.
 */
export type CourseCompletion = { all: CompletionPart; lessons: CompletionPart; quizzes: CompletionPart; assignments: CompletionPart };

/** A quiz or assignment as the learner's gradebook shows it. */
export type GradeStatus = 'not_started' | 'overdue' | 'attempted' | 'submitted' | 'graded';

export type GradeRow = {
  lessonId: string;
  title: string;
  moduleTitle: string;
  kind: 'quiz' | 'assignment';
  status: GradeStatus;
  /** The percentage that counts: the best quiz attempt, or a graded assignment's score out of its points. */
  percent: number | null;
  /** Quiz attempts used (0 for assignments). */
  attempts: number;
  latestPercent: number | null;
  maxAttempts: number | null;
  score?: number;
  maxScore?: number;
  feedback?: string;
  dueDate?: string;
};

export type Gradebook = { rows: GradeRow[]; averagePercent: number | null; scoredCount: number };

/** The single most useful thing to do next in a course (overdue work first, then the next unfinished lesson). */
export type CourseNextStep =
  | { kind: 'overdue'; lesson: CourseLesson; moduleTitle: string }
  | { kind: 'lesson'; lesson: CourseLesson; moduleTitle: string }
  | { kind: 'finished' }
  | { kind: 'empty' };

/** Everything a learner's course workspace shows (web StudentCourseDashboard + modules/quizzes/assignments pages). */
export type CourseWorkspace = { course: Course; enrollment: Enrollment | null; modules: CourseModule[]; submissions: Map<string, AssignmentSubmission> };
export type LearningStats = { totalCourses: number; totalLearners: number; averageRating: number };
export type CatalogSort = 'featured' | 'recent' | 'rating';
export type CatalogPriceFilter = 'All' | 'Free' | 'Paid';
export type MyLearningStatus = 'All' | 'In progress' | 'Not started' | 'Completed';
export type MyLearningSort = 'recent' | 'progress';
