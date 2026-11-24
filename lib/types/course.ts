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
  /** archived and deleted (a soft delete) reach only enrolled learners, who keep read access. */
  status: 'draft' | 'published' | 'archived' | 'deleted';
  isPublic: boolean;
  tags: string[];
  prerequisites?: string[];
  /** Courses to complete first (required: enrollment is refused until then) or recommended (advice only). */
  prerequisiteCourses?: PrerequisiteLink[];
  learningObjectives?: string[];
  featured?: boolean;
  difficulty?: number; // 1-5 scale
  language?: string;
  /** The instructor requires learners to join a class (cohort) when they enroll. */
  cohortRequired?: boolean;
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
  /** Assignment rubric (criteria and levels); learners see it before they hand in. Points follow its total. */
  rubric?: AssignmentRubric;
  /** How late work loses points (none when the lesson defines no penalty). Enforced by the server when grading. */
  latePenalty?: LatePenaltyPolicy;
  /** Whether a new version may be handed in after a grade is published, how many times and until when. */
  resubmission?: ResubmissionPolicy;
};

// ── Assignment teaching workflows (rubrics, late policy, resubmission, review requests) ──

export type RubricLevel = { id: string; title: string; description: string; points: number };
export type RubricCriterion = { id: string; title: string; description: string; levels: RubricLevel[]; maxPoints: number };
/** courseLessons/{id}.rubric: totalPoints is the sum of each criterion's best level. */
export type AssignmentRubric = { criteria: RubricCriterion[]; totalPoints: number };
/** One criterion as graded (titles and points copied, so a later rubric edit never rewrites a published grade). */
export type RubricScore = { criterionId: string; criterionTitle: string; levelId: string; levelTitle: string; points: number; maxPoints: number; feedback: string };
/** percent: a fixed share of the score comes off late work; percent_per_day: that share per started day, up to maxPercent. */
export type LatePenaltyType = 'none' | 'percent' | 'percent_per_day';
export type LatePenaltyPolicy = { type: LatePenaltyType; percent: number; maxPercent: number };
/** `until` is an ISO date (null: no resubmission deadline). */
export type ResubmissionPolicy = { allowed: boolean; maxResubmissions: number; until: string | null };
/** The penalty a published grade carries: the share and points taken off, or waived by the grader. */
export type AppliedLatePenalty = { lateDays: number; percent: number; points: number; waived: boolean };
export type GradeAppealStatus = 'open' | 'upheld' | 'adjusted' | 'withdrawn';
/** One hand-in version (assignmentSubmissionVersions); the grade fields are present only once it is graded. */
export type SubmissionVersion = {
  id: string;
  version: number;
  textResponse: string;
  files: AssignmentFile[];
  submittedAt: string | null;
  isLate: boolean;
  lateDays: number;
  status: 'submitted' | 'graded';
  score: number | null;
  rawScore: number | null;
  maxScore: number | null;
  latePenalty: AppliedLatePenalty | null;
  rubricScores: RubricScore[];
  feedback: string;
  gradedAt: string | null;
};
export type GradeEventKind = 'graded' | 'regraded' | 'appeal_upheld' | 'appeal_adjusted';
/** One published grade event (assignmentGradeHistory). */
export type GradeEvent = {
  id: string;
  version: number;
  event: GradeEventKind;
  score: number;
  rawScore: number;
  maxScore: number;
  latePenalty: AppliedLatePenalty | null;
  rubricScores: RubricScore[];
  feedback: string;
  note: string;
  actorRole: string;
  createdAt: string | null;
};
/** A learner's request for a review of a published grade (gradeAppeals/{submissionId}_v{n}). */
export type GradeAppeal = {
  id: string;
  submissionId: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  studentId: string;
  studentName: string;
  cohortId: string;
  version: number;
  reason: string;
  status: GradeAppealStatus;
  originalScore: number;
  maxScore: number;
  resultScore: number | null;
  responseNote: string;
  respondedByRole: string;
  createdAt: string | null;
  resolvedAt: string | null;
};
/** manageLearning submission_history: every version, published grade and review request of one submission. */
export type SubmissionHistory = { submissionId: string; versions: SubmissionVersion[]; grades: GradeEvent[]; appeals: GradeAppeal[] };

// ── Cohorts (classes) and scheduled sessions ──

export type CohortAssistant = { id: string; name: string };
/** courseCohorts/{id}: dates, capacity and assistants, never learners. */
export type CourseCohort = {
  id: string;
  courseId: string;
  name: string;
  description: string;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  memberCount: number;
  enrollmentOpensAt: string | null;
  enrollmentClosesAt: string | null;
  status: 'active' | 'archived';
  assistants: CohortAssistant[];
};
/** One learner on a staff roster (course_roster); names are display-safe (a minor shows as "First L."). */
export type RosterLearner = { userId: string; displayName: string; cohortId: string; enrollmentStatus: string; progress: number; enrolledAt: string | null };
export type SessionKind = 'live_class' | 'office_hours' | 'deadline';
export type SessionRecording = 'not_recorded' | 'recorded';
/** A scheduled course session (course_sessions); the join link is an external https meeting. */
export type CourseSession = {
  id: string;
  courseId: string;
  cohortId: string;
  cohortName: string;
  kind: SessionKind;
  title: string;
  description: string;
  startsAt: string | null;
  endsAt: string | null;
  joinUrl: string;
  recording: SessionRecording;
  recordingNote: string;
  status: 'scheduled' | 'cancelled';
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
  /** The verification code of the certificate the server issued for this course (slice 4). */
  certificateCode?: string;
  /** The learner's quiz record per quiz lesson id, kept by the server. */
  quizSummary?: { [lessonId: string]: QuizAttemptSummary };
  /** The class (cohort) the learner is in; empty for self-paced study. */
  cohortId?: string;
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
/**
 * The learner's current hand-in. Grade fields (score, rawScore, latePenalty, rubricScores, feedback, gradedAt) are set
 * only once the grade is published (status 'graded'); a draft grade never reaches the learner.
 */
export type AssignmentSubmission = {
  id: string;
  lessonId?: string;
  status: 'submitted' | 'graded';
  textResponse: string;
  files: AssignmentFile[];
  score?: number;
  maxScore?: number;
  feedback?: string;
  submittedAt?: string;
  /** 1 for the first hand-in; each resubmission after a grade adds one. */
  version?: number;
  isLate?: boolean;
  lateDays?: number;
  resubmissionsUsed?: number;
  appealStatus?: GradeAppealStatus;
  rawScore?: number;
  latePenalty?: AppliedLatePenalty;
  rubricScores?: RubricScore[];
  gradedAt?: string;
};
export type CourseReview = { id: string; userId: string; reviewerName: string; rating: number; comment: string; createdAt?: string };
/** Which course file a short-lived signed link is asked for (manageLearning media_link). */
export type CourseMediaRequest =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'resource'; resourceId: string }
  | { kind: 'lesson_attachment'; lessonId: string; index: number }
  /** `version`: a file of an earlier hand-in version, not the current one. */
  | { kind: 'submission_file'; submissionId: string; index: number; version?: number };
export type CourseMediaLink = { url: string; expiresAt: string | null; signed: boolean; name: string };
export type CourseAnnouncement = { id: string; courseId: string; title: string; body: string; authorName: string; authorAvatar?: string; important: boolean; createdAt?: string };
export type InstructorProfile = { id: string; name: string; avatar?: string; bio?: string; specialties: string[]; rating: number; totalStudents: number; totalCourses: number; isVerified: true };
export type CourseCategory = { id: string; name: string; description?: string; icon?: string; color?: string; order: number; isActive: boolean; courseCount: number };
/** `authorDisplayName`: the display-safe name the server stored on newer posts (shown as it is). */
export type CourseDiscussion = { id: string; courseId: string; authorId: string; authorName?: string; authorDisplayName?: string; title?: string; body: string; replyCount: number; createdAt?: string };
export type CourseDiscussionReply = { id: string; discussionId: string; courseId: string; authorId: string; authorName?: string; authorDisplayName?: string; body: string; createdAt?: string };
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

// ── Learning depth (E-Learning slice 4): paths, prerequisites, suggestions, certificates ──

export type PrerequisiteLink = { courseId: string; title: string; required: boolean };
export type PrerequisiteStatus = {
  courseId: string;
  links: (PrerequisiteLink & { completed: boolean })[];
  missingRequired: PrerequisiteLink[];
  missingRecommended: PrerequisiteLink[];
};
export type LearnerCourseState = 'completed' | 'in_progress' | 'not_started' | 'unavailable';
export type LearningPathStep = { courseId: string; title: string; state: LearnerCourseState; progress: number };
export type LearningPath = {
  id: string;
  title: string;
  description: string;
  level: string;
  ownerName: string;
  courses: { courseId: string; title: string; image: string; available: boolean }[];
  progress: { steps: LearningPathStep[]; completedCount: number; availableCount: number; percent: number; nextCourseId: string | null; nextReason: string } | null;
};
export type CourseSuggestion = { courseId: string; title: string; image: string; category: string; instructorName: string; reasons: string[] };
export type CertificateStatus = 'valid' | 'revoked';
/** name: the display-safe name (a minor's is "First L."); short: "First L."; hidden: no name on the public check. */
export type CertificateNameDisplay = 'name' | 'short' | 'hidden';
export type CertificateMissingReason = 'not_completed' | 'quiz_not_attempted' | 'assignment_not_submitted';
export type CertificateEligibility = {
  eligible: boolean;
  requiredCount: number;
  completedCount: number;
  missing: { lessonId: string; title: string; reason: CertificateMissingReason }[];
};
/** The public facts of a certificate (certificateVerifications/{code}): no account id, no reasons. */
export type PublicCertificate = {
  code: string;
  courseId: string;
  courseTitle: string;
  courseVersion: number;
  instructorName: string;
  criteria: string;
  completedAt: string | null;
  issuedAt: string | null;
  status: CertificateStatus;
  statusChangedAt: string | null;
  correctedAt: string | null;
  learnerName: string;
};
/** The learner's own certificate (certificates/{uid}_{courseId}_v{version}). */
export type Certificate = PublicCertificate & {
  id: string;
  statusReason: string;
  nameDisplay: CertificateNameDisplay;
  showOnProfile: boolean;
  isMinor: boolean;
};
/** A certificate its learner chose to show on their profile (profileCertificates/{code}). */
export type ProfileCertificate = { code: string; courseTitle: string; instructorName: string; completedAt: string | null };
