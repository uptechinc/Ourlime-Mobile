import { Redirect } from 'expo-router';

/** Reports live in the Moderation screen; report detail stays at /admin/reports/[reportId]. */
export default function AdminReportsRoute() {
	return <Redirect href="/admin/moderation" />;
}
