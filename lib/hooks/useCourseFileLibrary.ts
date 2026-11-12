import { useCallback, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { instructorService } from '@/lib/services/InstructorService';
import type { CourseLibraryFile, PickedUpload } from '@/lib/types/instructor';
import { courseFileKind } from '@/lib/helpers/courseFiles';

// instructors/{uid}/courseUploads accepts images, videos, PDF and Word files (storage.rules), up to 50 MB.
const DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
export const MAX_COURSE_FILE_BYTES = 50 * 1024 * 1024;

type PickedLibraryFile = PickedUpload & { durationMinutes?: number };

let idCounter = 0;
const nextId = (): string => `file-${Date.now()}-${idCounter++}`;

/**
 * The course editor's file library (the website's Content step): picked files upload straight away to the instructor's
 * staging folder and can then be previewed, removed and attached to lessons. publish_course copies them into the course.
 */
export function useCourseFileLibrary() {
  const [files, setFiles] = useState<CourseLibraryFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const filesRef = useRef<CourseLibraryFile[]>([]);
  filesRef.current = files;

  const upload = useCallback(async (picked: PickedLibraryFile[]): Promise<CourseLibraryFile[]> => {
    const tooLarge = picked.filter((file) => (file.size ?? 0) > MAX_COURSE_FILE_BYTES).map((file) => file.name);
    setError(tooLarge.length > 0 ? `Larger than 50 MB, not added: ${tooLarge.join(', ')}` : null);
    const accepted = picked.filter((file) => (file.size ?? 0) <= MAX_COURSE_FILE_BYTES);
    const added: CourseLibraryFile[] = accepted.map((file) => ({
      id: nextId(), name: file.name, kind: courseFileKind(file.mimeType, file.name), size: file.size ?? 0, status: 'uploading',
      ...(file.durationMinutes ? { durationMinutes: file.durationMinutes } : {}),
    }));
    setFiles((current) => [...current, ...added]);
    // Uploads run one after another (like the website) and each row updates when its own upload finishes.
    void (async () => {
      for (const [index, entry] of added.entries()) {
        try {
          const { staged, url } = await instructorService.stageCourseFile(accepted[index], entry.kind);
          setFiles((current) => current.map((file) => (file.id === entry.id ? { ...file, status: 'ready', path: staged.path, url, size: staged.size } : file)));
        } catch (uploadError: unknown) {
          console.error('[useCourseFileLibrary.upload] Error:', uploadError instanceof Error ? uploadError.message : 'Unknown error');
          setFiles((current) => current.map((file) => (file.id === entry.id ? { ...file, status: 'error' } : file)));
        }
      }
    })();
    return added;
  }, []);

  /** Videos and images from the photo library (the picker reports each video's length). */
  const addMedia = useCallback(async (kind: 'all' | 'videos' = 'all', multiple = true): Promise<CourseLibraryFile[]> => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'videos' ? ['videos'] : ['images', 'videos'], allowsMultipleSelection: multiple, quality: 1 });
    if (result.canceled) return [];
    return upload(result.assets.map((asset): PickedLibraryFile => {
      const isVideo = asset.type === 'video';
      const minutes = isVideo && typeof asset.duration === 'number' && asset.duration > 0 ? Math.max(1, Math.round(asset.duration / 60000)) : undefined;
      return {
        uri: asset.uri,
        name: asset.fileName ?? `${isVideo ? 'video' : 'image'}-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        mimeType: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
        size: asset.fileSize,
        ...(minutes ? { durationMinutes: minutes } : {}),
      };
    }));
  }, [upload]);

  /** PDF and Word documents. */
  const addDocuments = useCallback(async (multiple = true): Promise<CourseLibraryFile[]> => {
    const result = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_TYPES, multiple, copyToCacheDirectory: true });
    if (result.canceled) return [];
    return upload(result.assets.map((asset): PickedLibraryFile => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size })));
  }, [upload]);

  const remove = useCallback((fileId: string) => setFiles((current) => current.filter((file) => file.id !== fileId)), []);

  const find = useCallback((fileId: string | null | undefined): CourseLibraryFile | undefined => (fileId ? filesRef.current.find((file) => file.id === fileId) : undefined), []);

  return { files, error, addMedia, addDocuments, remove, find };
}
