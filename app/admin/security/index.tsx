import { Redirect } from 'expo-router';

export default function AdminSecurityRoute() {
  return <Redirect href={{ pathname: '/admin', params: { section: 'security' } }} />;
}
