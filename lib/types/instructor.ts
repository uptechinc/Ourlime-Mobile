import type { AssignmentFile } from '@/lib/types/course';

/**
 * none: no instructors/{uid}; pending: applied, waiting for an administrator; verified: can publish; declined: an
 * administrator did not approve the application (the reason is in InstructorApplicationState) and they can apply again.
 */
export type InstructorStatus = 'none' | 'pending' | 'verified' | 'declined';

/** The member's own application: its status and, when declined, the administrator's reason. */
export type InstructorApplicationState = { status: InstructorStatus; declineReason: string };

/** How an administrator's review left a course: declined back to draft with a note, or resubmitted by the instructor. */
export type InstructorCourseReviewStatus = 'approved' | 'declined' | 'resubmitted';

/** courses/{id}.status. pending_review is set by the server for courses from instructors who are not yet verified. */
export type InstructorCourseStatus = 'draft' | 'pending_review' | 'published' | 'archived';

/** The statuses update_course accepts (pending_review is server-only). */
export type InstructorSettableStatus = 'draft' | 'published' | 'archived';

export type InstructorCourse = {
  id: string;
  title: string;
  image?: string;
  category: string;
  subcategory?: string;
  status: InstructorCourseStatus;
  enrolledStudents: number;
  rating: number;
  totalRatings: number;
  price: number;
  /** null when the lessons can't be read yet (modules and lessons are readable only once the course is published). */
  quizCount: number | null;
  assignmentCount: number | null;
  reviewStatus?: InstructorCourseReviewStatus;
  /** The administrator's reason when the course was declined. */
  reviewNote?: string;
};

export type InstructorCourseDetail = InstructorCourse & {
  shortDescription: string;
  description: string;
  level: string;
  language: string;
  tags: string[];
  prerequisites: string[];
  learningObjectives: string[];
  durationHours: number;
};

export type InstructorLessonType = 'video' | 'text' | 'quiz' | 'assignment' | 'resource' | 'pdf' | 'document' | 'image' | 'audio';

export type InstructorLesson = {
  id: string;
  moduleId: string;
  title: string;
  type: InstructorLessonType;
  order: number;
  duration: number;
  points?: number;
  dueDate?: string;
  questionCount: number;
};

export type InstructorModule = {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: InstructorLesson[];
};

/** Modules with lessons, or 'unavailable' while the rules hide them (draft, pending review or archived courses). */
export type InstructorCurriculum = { kind: 'available'; modules: InstructorModule[] } | { kind: 'unavailable' };

export type InstructorSubmission = {
  id: string;
  lessonId: string;
  studentName: string;
  status: 'submitted' | 'graded';
  textResponse: string;
  files: AssignmentFile[];
  score?: number;
  /** The score the server allows (assignmentSubmissions.maxScore, copied from lesson.points; 100 when missing). */
  maxScore: number;
  feedback?: string;
  submittedAt?: string;
  gradedAt?: string;
};

export type QuizQuestionType = 'mcq' | 'tf' | 'short';

export type QuizQuestionInput = {
  id: string;
  title: string;
  type: QuizQuestionType;
  options: string[];
  correctIndex?: number;
  explanation?: string;
  points: number;
};

/** maxAttempts: attempts each learner may make; null means unlimited (the default). */
export type NewQuiz = { courseId: string; title: string; description: string; questions: QuizQuestionInput[]; maxAttempts: number | null };

/** A draft grade the instructor saved; it stays on the server until they publish it. */
export type InstructorGradeDraft = { submissionId: string; lessonId: string; score: number; feedback: string };

/** One announcement of the instructor's course (courseAnnouncements; written through manageLearning). */
export type InstructorAnnouncement = { id: string; courseId: string; title: string; body: string; important: boolean; authorName: string; createdAt?: string; editedAt?: string };
export type AnnouncementDraft = { title: string; body: string; important: boolean };

/** One lesson in the instructor's course insights; counts are null while withheld (too few learners). */
export type CourseLessonInsight = { lessonId: string; title: string; type: string; completedCount: number | null; completedPercent: number | null; dropOff: number | null };

/** Server-computed totals for one course (manageLearning course_insights); never per-learner records. */
export type CourseInsights = {
  courseId: string;
  generatedAt: string;
  enrollments: number;
  learners: number;
  completed: number | null;
  completionPercent: number | null;
  submissionsWaiting: number;
  lessons: CourseLessonInsight[];
  biggestDropOff: { lessonId: string; title: string; dropOff: number } | null;
  withheld: boolean;
  minimumGroup: number;
  partial: boolean;
};

export type NewAssignment = {
  courseId: string;
  title: string;
  description: string;
  instructions: string;
  dueDate: Date;
  points: number;
  allowLateSubmission: boolean;
  attachments: AssignmentFile[];
};

export type ApplicationType = 'individual' | 'school' | 'training_company';
export type CourseAvailability = 'free' | 'paid' | 'both';
export type CourseVisibility = 'public' | 'private' | 'both';

export type SchoolDetails = {
  organizationName: string;
  officialOrganizationEmail: string;
  website: string;
  organizationType: string;
  registrationNumber: string;
  proofOfAuthorizationUrl: string;
  estimatedTeachers: number;
  estimatedStudents: number;
  requestPrivatePortal: boolean;
  courseVisibility: CourseVisibility;
  privatePortalFeatures: string[];
};

/** The register_instructor profile, as the website sends it. */
export type InstructorApplication = {
  firstName: string;
  lastName: string;
  email: string;
  bio: string;
  socialLinks: { website?: string; linkedin?: string };
  applicationType: ApplicationType;
  jobTitle: string;
  highestQualification: string;
  fieldsOfExpertise: string[];
  yearsOfExperience: number;
  previousTeachingExperience: string;
  languagesTaught: string[];
  resumeUrl: string;
  certificateUrls: string[];
  subjectCategories: string[];
  studentLevels: string[];
  courseDeliveryMethods: string[];
  /** The server keeps public/private/both; the website's free/paid choices are stored as 'both'. */
  courseAvailability: CourseAvailability;
  intendedCoursesDescription: string;
  sampleLessonUrl: string;
  schoolDetails?: SchoolDetails;
};

/** The applicant's own account details, used to prefill and gate the application. */
export type InstructorApplicant = {
  firstName: string;
  lastName: string;
  email: string;
  /** users/{uid}.verificationStatus (or identityVerificationStatus); 'verified' unlocks the application. */
  verificationStatus: string | null;
};

export type InstructorDocumentKind = 'resume' | 'certificate' | 'sample' | 'proof';

export type PickedUpload = { uri: string; name: string; mimeType?: string; size?: number };

export type CourseFileKind = 'video' | 'pdf' | 'document' | 'image';

/**
 * A file in the course editor's library (the website's Content step): uploaded straight away to the instructor's
 * staging folder, then attached to lessons. `path` and `url` are set once the upload finishes.
 */
export type CourseLibraryFile = {
  id: string;
  name: string;
  kind: CourseFileKind;
  size: number;
  status: 'uploading' | 'ready' | 'error';
  path?: string;
  url?: string;
  /** Video length in whole minutes, when the picker reported it (fills in the lesson duration). */
  durationMinutes?: number;
};
