import { Redirect } from 'expo-router';

/** The website's /profile/admin/dashboard is the hub in the app. */
export default function AdminDashboardRoute() {
	return <Redirect href="/admin" />;
}
