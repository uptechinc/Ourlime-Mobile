import { Redirect } from 'expo-router';

export default function AdminPageAccessRoute() {
  return <Redirect href={{ pathname: '/admin', params: { section: 'page_access' } }} />;
}
