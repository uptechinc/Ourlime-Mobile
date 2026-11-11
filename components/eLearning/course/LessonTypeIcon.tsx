import { ClipboardList, FileText, HelpCircle, Paperclip, PlayCircle } from 'lucide-react-native';
import type { CourseLesson } from '@/lib/types/course';

type LessonTypeIconProps = { type: CourseLesson['type']; size?: number };

/** The icon and colour each lesson type uses across the course screens (web modules page palette). */
export default function LessonTypeIcon({ type, size = 18 }: LessonTypeIconProps) {
  if (type === 'video') return <PlayCircle size={size} color="#10b981" />;
  if (type === 'quiz') return <HelpCircle size={size} color="#9333ea" />;
  if (type === 'assignment') return <ClipboardList size={size} color="#ea580c" />;
  if (type === 'document' || type === 'resource') return <Paperclip size={size} color="#0891b2" />;
  return <FileText size={size} color="#3b82f6" />;
}
