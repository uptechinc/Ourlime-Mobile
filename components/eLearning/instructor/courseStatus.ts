import type { ELearningTone } from '@/components/eLearning/ELearningParts';
import type { InstructorCourse, InstructorStatus } from '@/lib/types/instructor';

/** The five states an instructor sees, in words: a declined course is stored as a draft with reviewStatus 'declined'. */
export type CourseStage = 'draft' | 'waiting' | 'declined' | 'published' | 'archived' | 'deleted';

export type CourseStagePresentation = { stage: CourseStage; label: string; tone: ELearningTone; explanation: string };

export function courseStage(course: Pick<InstructorCourse, 'status' | 'reviewStatus'>): CourseStage {
  if (course.status === 'pending_review') return 'waiting';
  if (course.status === 'draft' && course.reviewStatus === 'declined') return 'declined';
  return course.status;
}

/** Label, tone and one sentence on what the state means and what to do next (the instructor's status decides publishing). */
export function courseStagePresentation(course: Pick<InstructorCourse, 'status' | 'reviewStatus'>, instructorStatus: InstructorStatus | null): CourseStagePresentation {
  const stage = courseStage(course);
  const isVerified = instructorStatus === 'verified';
  switch (stage) {
    case 'waiting':
      return { stage, label: 'Waiting for review', tone: 'warning', explanation: 'An administrator is checking this course. Learners can find it once it is approved.' };
    case 'declined':
      return { stage, label: 'Declined', tone: 'danger', explanation: 'An administrator did not approve this course. Read the note, make the changes, then submit it again.' };
    case 'published':
      return { stage, label: 'Published', tone: 'success', explanation: 'Learners can find and enroll in this course.' };
    case 'archived':
      return { stage, label: 'Archived', tone: 'neutral', explanation: isVerified ? 'Hidden from the catalog. Publish it again when it is ready.' : 'Hidden from the catalog. Submitting it again sends it for review.' };
    case 'deleted':
      return { stage, label: 'Deleted', tone: 'danger', explanation: 'Its learners keep read-only access and their records. Restore it to edit or publish it again.' };
    default:
      return { stage, label: 'Draft', tone: 'neutral', explanation: isVerified ? 'Only you can see this course. Publish it when it is ready.' : 'Only you can see this course. Submit it for review when it is ready.' };
  }
}
