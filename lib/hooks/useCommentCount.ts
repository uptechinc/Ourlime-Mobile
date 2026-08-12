import { useState, useEffect, useCallback } from 'react';
import { PostService } from '@/lib/services/PostService';

const postService = PostService.getInstance();

type PostType = 'feed' | 'community';

/**
 * Custom hook to manage comment counts for posts
 * @param postId - The ID of the post
 * @param postType - The type of post ('feed' or 'community')
 * @param initialCount - Optional initial count to display while loading
 * @returns Object containing commentCount, isLoading, and refreshCount function
 */
export const useCommentCount = (postId: string, postType: PostType = 'feed', initialCount?: number) => {
    const [commentCount, setCommentCount] = useState<number>(initialCount || 0);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const refreshCount = useCallback(async () => {
        if (!postId) return;

        try {
            setIsLoading(true);
            let count = 0;
            
            if (postType === 'feed') {
                count = await postService.getCommentCount(postId, 'feed');
            } else if (postType === 'community') {
                count = await postService.getCommentCount(postId, 'community');
            }
            
            setCommentCount(count);
        } catch (error) {
            console.error(`Error fetching comment count for ${postType} post ${postId}:`, error);
            // Keep the current count on error
        } finally {
            setIsLoading(false);
        }
    }, [postId, postType]);

    useEffect(() => {
        refreshCount();
    }, [refreshCount]);

    return {
        commentCount,
        isLoading,
        refreshCount
    };
};

/**
 * Hook to manage comment counts for multiple posts
 * @param postIds - Array of post IDs
 * @param postType - The type of posts ('feed' or 'community')
 * @returns Object containing commentCounts map, isLoading, and refreshCounts function
 */
export const useCommentCounts = (postIds: string[], postType: PostType = 'feed') => {
    const [commentCounts, setCommentCounts] = useState<{ [key: string]: number }>({});
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const refreshCounts = useCallback(async () => {
        if (postIds.length === 0) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const counts: { [key: string]: number } = {};
            
            await Promise.all(
                postIds.map(async (postId) => {
                    try {
                        if (postType === 'feed') {
                            counts[postId] = await postService.getCommentCount(postId, 'feed');
                        } else if (postType === 'community') {
                            counts[postId] = await postService.getCommentCount(postId, 'community');
                        }
                    } catch (error) {
                        console.error(`Error fetching comment count for ${postType} post ${postId}:`, error);
                        counts[postId] = commentCounts[postId] || 0; // Keep existing count on error
                    }
                })
            );
            
            setCommentCounts(counts);
        } catch (error) {
            console.error('Error fetching comment counts:', error);
        } finally {
            setIsLoading(false);
        }
    }, [postIds, postType, commentCounts]);

    useEffect(() => {
        refreshCounts();
    }, [refreshCounts]);

    return {
        commentCounts,
        isLoading,
        refreshCounts
    };
};
