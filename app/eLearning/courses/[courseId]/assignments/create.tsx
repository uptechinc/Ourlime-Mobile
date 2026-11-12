import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/** The website's /eLearning/courses/[courseId]/assignments/create opens the app's assignment editor. */
export default function CreateAssignmentRedirect() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  return <Redirect href={`/eLearning/instructor/assignment/${encodeURIComponent(typeof courseId === 'string' ? courseId : '')}` as Href} />;
}
