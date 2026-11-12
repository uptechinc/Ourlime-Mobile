import { Redirect, type Href } from 'expo-router';

/** The website's /eLearning/instructor/courses ("My Courses") is the app's instructor dashboard. */
export default function InstructorCoursesRedirect() {
  return <Redirect href={'/eLearning/instructor' as Href} />;
}
