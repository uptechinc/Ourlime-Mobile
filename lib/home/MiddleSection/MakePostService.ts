import { db } from '@/lib/firebaseConfig';
import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    updateDoc,
    increment,
} from 'firebase/firestore';
import { storage } from '@/lib/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface PostResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export class MakePostService {
    private static instance: MakePostService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): MakePostService {
        if (!MakePostService.instance) {
            MakePostService.instance = new MakePostService();
        }
        return MakePostService.instance;
    }

    private async processHashtags(hashtags: string[]) {
        const hashtagsRef = collection(this.db, 'hashtags');

        await Promise.all(
            hashtags.map(async (tag) => {
                const hashtagQuery = query(hashtagsRef, where('tag', '==', tag));
                const snapshot = await getDocs(hashtagQuery);

                if (snapshot.empty) {
                    await addDoc(hashtagsRef, {
                        tag,
                        count: 1,
                        createdAt: serverTimestamp(),
                    });
                } else {
                    const hashtagDoc = snapshot.docs[0];
                    await updateDoc(hashtagDoc.ref, {
                        count: increment(1),
                    });
                }
            })
        );
    }

    async createPost(postData: any): Promise<PostResponse> {
        try {
            const basePostData = {
                userId: postData.userId,
                caption: postData.caption,
                description: postData.description,
                visibility: postData.visibility,
                hashtags: postData.hashtags || [],
                mentions: postData.mentions || [],
                friendReferences: postData.friendReferences || [],
                type: postData.type,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            if (postData.type === 'poll') {
                basePostData['pollOptions'] = postData.pollData.options;
                basePostData['pollDuration'] = postData.pollData.duration;
                basePostData['pollEndTime'] = postData.pollData.endTime;
                basePostData['pollVotes'] = {};
            }

            const postRef = await addDoc(
                collection(this.db, 'feedPosts'),
                basePostData
            );

            // Increment postsCount for the user after successful post creation
            /**
             * Increments the postsCount field on the user document after a post is created.
             * Ensures the user's post counter is always up to date.
             */
            const userDocQuery = query(collection(this.db, 'users'), where('id', '==', postData.userId));
            const userDocSnapshot = await getDocs(userDocQuery);
            if (!userDocSnapshot.empty) {
                const userDocRef = userDocSnapshot.docs[0].ref;
                await updateDoc(userDocRef, { postsCount: increment(1) });
            }

            if (postData.media?.length > 0) {
                await Promise.all(
                    postData.media.map((media) =>
                        addDoc(collection(this.db, 'feedsPostSummary'), {
                            feedsPostId: postRef.id,
                            type: media.type,
                            typeUrl: media.typeUrl,
                            fileName: media.fileName,
                        })
                    )
                );
            }

            if (postData.type === 'poll' && postData.pollData?.image) {
                await addDoc(collection(this.db, 'feedsPostSummary'), {
                    feedsPostId: postRef.id,
                    type: 'image',
                    typeUrl: postData.pollData.image,
                    fileName: `poll_image_${Date.now()}.jpg`,
                });
            }

            if (postData.hashtags?.length > 0) {
                await this.processHashtags(postData.hashtags);
            }

            return {
                success: true,
                data: { postId: postRef.id },
            };
        } catch (error) {
            console.error('Error creating post:', error);
            return {
                success: false,
                error: 'Failed to create post',
            };
        }
    }
}

export const makePostService = MakePostService.getInstance();
