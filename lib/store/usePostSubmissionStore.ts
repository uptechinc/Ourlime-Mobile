import { create } from 'zustand';
import type { PostSubmissionSnapshot } from '@/lib/types/postSubmission';

type PostSubmissionState = { submission: PostSubmissionSnapshot | null };

// Presentation only; task ownership, callbacks, and cancellation stay in the service.
export const usePostSubmissionStore = create<PostSubmissionState>(() => ({ submission: null }));
