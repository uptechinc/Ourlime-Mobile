/*
 * Administrator review of E-Learning instructor applications and courses waiting for review: the shapes the
 * manageLearning callable returns for review_queue, review_course_outline, review_instructor and review_course
 * (the website's lib/types/learningReview.ts).
 */

export type LearningReviewDecision = 'approve' | 'decline';
export type LearningReviewTab = 'instructors' | 'courses';

export type InstructorReviewItem = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  /** individual | school | training_company */
  applicationType: string;
  jobTitle: string;
  highestQualification: string;
  fieldsOfExpertise: string[];
  yearsOfExperience: number;
  previousTeachingExperience: string;
  languagesTaught: string[];
  subjectCategories: string[];
  intendedCoursesDescription: string;
  resumeUrl: string;
  certificateUrls: string[];
  sampleLessonUrl: string;
  organizationName: string;
  organizationWebsite: string;
  proofOfAuthorizationUrl: string;
  /** ISO date of the (re)submission, or null. */
  submittedAt: string | null;
};

export type CourseReviewItem = {
  id: string;
  title: string;
  shortDescription: string;
  category: string;
  level: string;
  price: number;
  image: string;
  instructorId: string;
  instructorName: string;
  instructorVerified: boolean;
  moduleCount: number;
  lessonCount: number;
  submittedAt: string | null;
};

export type LearningReviewQueue = { instructors: InstructorReviewItem[]; courses: CourseReviewItem[] };

export type CourseReviewLesson = { id: string; title: string; type: string; duration: number; order: number };
export type CourseReviewModule = { id: string; title: string; order: number; lessons: CourseReviewLesson[] };
/** Modules and lessons of a course for review; lengths in minutes, no lesson content. */
export type CourseReviewOutline = { courseId: string; modules: CourseReviewModule[]; totalMinutes: number };

export type InstructorReviewResult = { instructorId: string; decision: LearningReviewDecision; status: 'verified' | 'declined'; changed: boolean };
/** A declined course goes back to draft with reviewStatus 'declined' and the reason in reviewNote. */
export type CourseReviewResult = { courseId: string; decision: LearningReviewDecision; status: 'published' | 'draft'; changed: boolean };

export type LearningReviewTarget = { kind: 'instructor' | 'course'; id: string; name: string; decision: LearningReviewDecision };
