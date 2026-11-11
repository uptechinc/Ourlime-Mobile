import { Linking } from 'react-native';
import type { Href } from 'expo-router';
import type { CourseLesson } from '@/lib/types/course';

/** The lesson screen opened on one lesson (web /lesson/[id], /quiz/[id] and /assignment/[id] all live in it here). */
export const lessonHref = (courseId: string, lessonId?: string): Href =>
  (lessonId
    ? `/eLearning/courses/${encodeURIComponent(courseId)}/lesson?lessonId=${encodeURIComponent(lessonId)}`
    : `/eLearning/courses/${encodeURIComponent(courseId)}/lesson`) as Href;

export const courseHref = (courseId: string, section?: 'modules' | 'quizzes' | 'assignments' | 'grades' | 'discussions'): Href =>
  (section ? `/eLearning/courses/${encodeURIComponent(courseId)}/${section}` : `/eLearning/courses/${encodeURIComponent(courseId)}`) as Href;

export const pluralize = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

export const formatDate = (value: string | undefined, fallback = 'No due date'): string => {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : fallback;
};

export const formatFileSize = (bytes: number): string =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const lessonTypeLabel = (type: CourseLesson['type']): string => ({
  video: 'Video', text: 'Reading', quiz: 'Quiz', assignment: 'Assignment', resource: 'Resource', document: 'Document',
})[type];

/** Opens an http(s) link in the browser or the system viewer; resolves false when the device cannot open it. */
export const openExternalLink = async (url: string): Promise<boolean> => {
  try {
    await Linking.openURL(url);
    return true;
  } catch (error: unknown) {
    console.error('[openExternalLink] Error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
};
