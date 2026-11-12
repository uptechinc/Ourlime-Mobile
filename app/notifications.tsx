import { useLocalSearchParams, useRouter } from 'expo-router';
import NotificationsModal from '@/components/home/NotificationsModal';

export default function NotificationsScreen() {
  const router = useRouter();
  const { notificationId, removalId } = useLocalSearchParams<{ notificationId?: string; removalId?: string }>();

  return (
    <NotificationsModal
      mode="screen"
      initialNotificationId={notificationId}
      initialRemovalId={removalId}
      onClose={() => router.back()}
    />
  );
}
