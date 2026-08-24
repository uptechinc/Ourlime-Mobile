import ChildSafetyCaseDetailScreen from '@/app/admin/child-safety/[reportId]';
import type { Href } from 'expo-router';

export default function ChildSafetyReviewerCaseRoute() {
	return (
		<ChildSafetyCaseDetailScreen
			queueRoute={'/help/child-safety/review' as Href}
		/>
	);
}
