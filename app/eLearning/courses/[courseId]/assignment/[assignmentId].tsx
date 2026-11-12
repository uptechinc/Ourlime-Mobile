import { Redirect, useLocalSearchParams } from 'expo-router';
import { lessonHref } from '@/components/eLearning/course/workspaceHelpers';

/** The website's /eLearning/courses/[courseId]/assignment/[assignmentId]: the app opens quizzes and assignments in the lesson screen. */
export default function AssignmentLinkRedirect() {
  const { courseId, assignmentId } = useLocalSearchParams<{ courseId: string; assignmentId: string }>();
  return <Redirect href={lessonHref(typeof courseId === 'string' ? courseId : '', typeof assignmentId === 'string' ? assignmentId : undefined)} />;
}
