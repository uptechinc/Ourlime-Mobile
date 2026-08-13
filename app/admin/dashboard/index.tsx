import { Redirect } from 'expo-router';

export default function AdminDashboardRoute() {
  return <Redirect href={{ pathname: '/admin', params: { section: 'overview' } }} />;
}
