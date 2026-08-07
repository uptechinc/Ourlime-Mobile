import { Redirect } from 'expo-router';

// The entry point of the app — redirect immediately to the Login screen.
// The old debug menu page has been removed.
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
