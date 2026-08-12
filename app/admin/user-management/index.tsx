import { Redirect } from 'expo-router';

export default function AdminUserManagementRoute() {
  return <Redirect href={{ pathname: '/admin/index', params: { section: 'users' } }} />;
}
