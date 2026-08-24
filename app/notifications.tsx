import { useLocalSearchParams, useRouter } from 'expo-router';
import NotificationsModal from '@/components/home/NotificationsModal';

export default function NotificationsScreen() {
  const router = useRouter();
  const { notificationId } = useLocalSearchParams<{ notificationId?: string }>();

  return (
    <NotificationsModal
      mode="screen"
      initialNotificationId={notificationId}
      onClose={() => router.back()}
    />
  );
}
