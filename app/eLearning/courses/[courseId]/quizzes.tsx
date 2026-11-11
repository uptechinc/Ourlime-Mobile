import CourseWorkListScreen from '@/components/eLearning/course/CourseWorkListScreen';

/** The course's quizzes with due dates, points and completion (web /eLearning/courses/[id]/quizzes). */
export default function CourseQuizzesScreen() {
  return <CourseWorkListScreen kind="quiz" />;
}
