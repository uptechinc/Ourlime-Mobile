import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/** The website's /eLearning/courses/[courseId]/quizzes/create opens the app's quiz editor. */
export default function CreateQuizRedirect() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  return <Redirect href={`/eLearning/instructor/quiz/${encodeURIComponent(typeof courseId === 'string' ? courseId : '')}` as Href} />;
}
