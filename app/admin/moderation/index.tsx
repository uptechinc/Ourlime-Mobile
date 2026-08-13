import { Redirect } from 'expo-router';

export default function AdminModerationRoute() {
  return <Redirect href={{ pathname: '/admin', params: { section: 'moderation' } }} />;
}
