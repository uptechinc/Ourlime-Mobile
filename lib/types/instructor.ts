import type { AssignmentFile } from '@/lib/types/course';

/** none: no instructors/{uid}; pending: applied, waiting for an administrator; verified: can publish. */
export type InstructorStatus = 'none' | 'pending' | 'verified';

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

export type NewQuiz = { courseId: string; title: string; description: string; questions: QuizQuestionInput[] };

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
