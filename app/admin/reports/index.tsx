import { Redirect } from 'expo-router';

export default function AdminReportsRoute() {
  return <Redirect href={{ pathname: '/admin/index', params: { section: 'moderation' } }} />;
}
