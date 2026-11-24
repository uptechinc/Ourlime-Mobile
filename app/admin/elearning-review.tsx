import { useLocalSearchParams } from 'expo-router';
import AdminLearningReviewWorkspace from '@/components/admin/AdminLearningReviewWorkspace';

export default function AdminLearningReviewRoute() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  return <AdminLearningReviewWorkspace initialTab={tab === 'courses' ? 'courses' : 'instructors'} />;
}
