import { Redirect, type Href } from 'expo-router';

/** The website's /eLearning/courses/create opens the app's course editor. */
export default function CreateCourseRedirect() {
  return <Redirect href={'/eLearning/instructor/create' as Href} />;
}
