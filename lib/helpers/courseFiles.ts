import type { CourseFileKind } from '@/lib/types/instructor';

/** Same wording as the website's library ("1.5 MB", "820 KB"). */
export const formatCourseFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(2))} ${units[index]}`;
};

/** The website's file type rule: video/*, application/pdf, image/*, anything else is a document. */
export const courseFileKind = (mimeType: string | undefined, name: string): CourseFileKind => {
  const type = (mimeType ?? '').toLowerCase();
  const lowerName = name.toLowerCase();
  if (type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/.test(lowerName)) return 'video';
  if (type === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic)$/.test(lowerName)) return 'image';
  return 'document';
};

export const COURSE_FILE_FILTERS: { value: CourseFileKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'pdf', label: 'PDFs' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
];
