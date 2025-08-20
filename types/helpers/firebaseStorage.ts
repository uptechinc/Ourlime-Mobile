import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebaseConfig';

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * @param file - The file to upload.
 * @param path - The storage path where the file will be uploaded.
 * @returns A promise that resolves to the download URL of the uploaded file.
 */
export const uploadFile = async(file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return getDownloadURL(storageRef)
}