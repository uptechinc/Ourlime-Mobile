import CourseWorkListScreen from '@/components/eLearning/course/CourseWorkListScreen';

/** The course's assignments with due dates, points, overdue and submission status (web /eLearning/courses/[id]/assignments). */
export default function CourseAssignmentsScreen() {
  return <CourseWorkListScreen kind="assignment" />;
}
