import { Redirect, useLocalSearchParams } from 'expo-router';
import { lessonHref } from '@/components/eLearning/course/workspaceHelpers';

/** The website's /eLearning/courses/[courseId]/quiz/[quizId]: the app opens quizzes and assignments in the lesson screen. */
export default function QuizLinkRedirect() {
  const { courseId, quizId } = useLocalSearchParams<{ courseId: string; quizId: string }>();
  return <Redirect href={lessonHref(typeof courseId === 'string' ? courseId : '', typeof quizId === 'string' ? quizId : undefined)} />;
}
