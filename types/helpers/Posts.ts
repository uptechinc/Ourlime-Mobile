import { db } from "@/lib/firebaseConfig";
import { collection, getDoc, getDocs, query, Timestamp, where, doc, orderBy, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { Comment, Reply } from '@/types/global';
import { BasePost, UserData } from "@/types/userTypes";
import { Post } from "@/types/userTypes";
// Function to format the Firebase timestamp into a readable format
export const formatDate = (timestamp: any) => {
	let date: Date;

	if (
		timestamp &&
		typeof timestamp.seconds === 'number' &&
		typeof timestamp.nanoseconds === 'number'
	) {
		// Create a new Firebase Timestamp
		const firebaseTimestamp = new Timestamp(
			timestamp.seconds,
			timestamp.nanoseconds
		);
		date = firebaseTimestamp.toDate();
	} else if (timestamp instanceof Date) {
		date = timestamp;
	} else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
		date = new Date(timestamp);
	} else {
		return 'Invalid Date';
	}

	// Format the date as "23 January at 12:59"
	const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
	const formattedDate = date.toLocaleDateString('en-GB', options);
	
	const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
	const formattedTime = date.toLocaleTimeString([], timeOptions); // Remove colon for formatting

	return `${formattedDate} at ${formattedTime}`;
};

// Function to fetch all feed posts
export const fetchAllFeedPosts = async (): Promise<Post[]> => {
    const postsRef = collection(db, 'feedPosts'); // Reference to the correct collection

    try {
        const snapshot = await getDocs(postsRef); // Fetch all documents in the collection
        const postsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(), // Spread the document data
        })) as Post[]; // Cast to Post type

        console.log(`Fetched ${postsData.length} posts`);
        return postsData;
    } catch (error) {
        console.error('Error fetching feed posts:', error);
        return [];
    }
};

export const fetchPosts = async (collectionName: string = 'feedPosts'): Promise<Post[]> => {
    const postsRef = collection(db, collectionName);
    const q = query(postsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const postsWithUserData = await Promise.all(
        snapshot.docs.map(async (postDoc) => {
            const postData = postDoc.data();

            // Fetch user data
            const userDocRef = doc(db, 'users', postData.userId);
            const userDocSnap = await getDoc(userDocRef);
            const userData = userDocSnap.data();

            // Get user's profile image
            const profileImagesQuery = query(
                collection(db, 'profileImages'),
                where('userId', '==', postData.userId)
            );
            const profileImagesSnapshot = await getDocs(profileImagesQuery);
            const profileSetAsQuery = query(
                collection(db, 'profileImageSetAs'),
                where('userId', '==', postData.userId),
                where('setAs', '==', 'profile')
            );
            const setAsSnapshot = await getDocs(profileSetAsQuery);

            let profileImage = null;
            if (!setAsSnapshot.empty) {
                const setAsDoc = setAsSnapshot.docs[0].data();
                const matchingImage = profileImagesSnapshot.docs
                    .find(img => img.id === setAsDoc.profileImageId);
                if (matchingImage) {
                    profileImage = matchingImage.data();
                }
            }

            // Fetch media for this post
            const mediaQuery = query(
                collection(db, 'feedsPostSummary'),
                where('feedsPostId', '==', postDoc.id)
            );
            const mediaSnapshot = await getDocs(mediaQuery);
            const media = mediaSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return {
                id: postDoc.id,
                caption: postData.caption,
                description: postData.description,
                visibility: postData.visibility,
                createdAt: postData.createdAt.toDate(),
                userId: postData.userId,
                hashtags: postData.hashtags || [],
                media,
                user: {
                    ...userData,
                    profileImage: profileImage?.imageURL,
                },
            } as unknown as Post;
        })
    );

    return postsWithUserData;
};

// Reusable function to fetch comments for a specific post
export const fetchCommentsForPost = async (collectionName: string, postId: string): Promise<Comment[]> => {
    const commentsRef = collection(db, collectionName);
    const q = query(commentsRef, where('feedsPostId', '==', postId)); // Ensure the field name matches your Firestore structure

    try {
        const snapshot = await getDocs(q);
        console.log(`Querying comments for postId: ${postId}, found ${snapshot.docs.length} comments.`);
        
        const commentsData = await Promise.all(snapshot.docs.map(async (commentDoc) => {
            const data = commentDoc.data();
            const userId = data.userId;

            // Fetch user data for the comment
            const userDoc = await getDoc(doc(db, "users", userId));
            let commentUserData: UserData | null = null;

            if (userDoc.exists()) {
                commentUserData = userDoc.data() as UserData;
            } else {
                console.log("No user document found for userId:", userId);
            }

            // Get user's profile image
            const profileImagesQuery = query(
                collection(db, 'profileImages'),
                where('userId', '==', data.userId)
            );
            const profileImagesSnapshot = await getDocs(profileImagesQuery);
            const profileSetAsQuery = query(
                collection(db, 'profileImageSetAs'),
                where('userId', '==', data.userId),
                where('setAs', '==', 'profile')
            );
            const setAsSnapshot = await getDocs(profileSetAsQuery);

            let profileImage = null;
            if (!setAsSnapshot.empty) {
                const setAsDoc = setAsSnapshot.docs[0].data();
                const matchingImage = profileImagesSnapshot.docs
                    .find(img => img.id === setAsDoc.profileImageId);
                if (matchingImage) {
                    profileImage = matchingImage.data();
                } else {
                    console.log("No matching profile image found for userId: ", userId);
                }
            } else {
                console.log("No profile image set for userId: ", userId);
            }

            return {
                id: commentDoc.id,
                comment: data.comment,
                createdAt: data.createdAt.toDate(),
                feedsPostId: data.feedsPostId,
                userId: userId,
                userData: {
                    firstName: commentUserData?.firstName || '',
                    lastName: commentUserData?.lastName || '',
                    userName: commentUserData?.userName || '',
                    profileImage: profileImage?.imageURL || null,
                },
                replies: [],
            } as Comment;
        }));

        console.log(`Fetched ${commentsData.length} comments for post ID: ${postId}`);
        return commentsData;
    } catch (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
};

// Function to fetch replies for comments
export const fetchRepliesForComments = async (collectionName: string, commentId: string): Promise<Reply[]> => {
    const repliesRef = collection(db, collectionName);
    const q = query(repliesRef, where("feedsPostCommentId", "==", commentId)); // Ensure the field name matches your Firestore structure

    try {
        const snapshot = await getDocs(q);
        console.log(`Querying replies for commentId: ${commentId}, found ${snapshot.docs.length} replies.`);
        
        const repliesData = await Promise.all(snapshot.docs.map(async (replyDoc) => {
            const data = replyDoc.data();
            const userId = data.userId;

            // Fetch user data for the reply
            const userDoc = await getDoc(doc(db, "users", userId));
            let replyUserData: UserData | null = null;

            if (userDoc.exists()) {
                replyUserData = userDoc.data() as UserData;
            } else {
                console.log("No user document found for userId:", userId);
            }

            // Get user's profile image
            const profileImagesQuery = query(
                collection(db, 'profileImages'),
                where('userId', '==', data.userId)
            );
            const profileImagesSnapshot = await getDocs(profileImagesQuery);
            const profileSetAsQuery = query(
                collection(db, 'profileImageSetAs'),
                where('userId', '==', data.userId),
                where('setAs', '==', 'profile')
            );
            const setAsSnapshot = await getDocs(profileSetAsQuery);

            let profileImage = null;
            if (!setAsSnapshot.empty) {
                const setAsDoc = setAsSnapshot.docs[0].data();
                const matchingImage = profileImagesSnapshot.docs
                    .find(img => img.id === setAsDoc.profileImageId);
                if (matchingImage) {
                    profileImage = matchingImage.data();
                } else {
                    console.log("No matching profile image found for userId: ", userId);
                }
            } else {
                console.log("No profile image set for userId: ", userId);
            }

            return {
                id: replyDoc.id,
                reply: data.reply,
                feedsPostCommentId: data.feedsPostCommentId,
                userId: data.userId,
                createdAt: data.createdAt.toDate(),
                userData: {
                    firstName: replyUserData?.firstName || '',
                    lastName: replyUserData?.lastName || '',
                    userName: replyUserData?.userName || '',
                    profileImage: profileImage?.imageURL || null,
                },
            } as Reply;
        }));

        console.log(`Fetched ${repliesData.length} replies for comment ID: ${commentId}`);
        return repliesData;
    } catch (error) {
        console.error('Error fetching replies:', error);
        return [];
    }
};

// Function to get actual comment count for a post
export const getCommentCount = async (postId: string): Promise<number> => {
    try {
        const commentsRef = collection(db, 'feedsPostComments');
        const q = query(commentsRef, where('feedsPostId', '==', postId));
        const snapshot = await getDocs(q);
        return snapshot.docs.length;
    } catch (error) {
        console.error('Error fetching comment count:', error);
        return 0;
    }
};

// Function to update comment count in likesCount collection
export const updateCommentCount = async (postId: string): Promise<void> => {
    try {
        const actualCount = await getCommentCount(postId);
        
        // Check if likes count document exists
        const likesCountRef = collection(db, 'likesCount');
        const q = query(likesCountRef, where('feedsPostId', '==', postId));
        const snapshot = await getDocs(q);
        
        if (snapshot.docs.length > 0) {
            // Update existing document
            const docRef = doc(db, 'likesCount', snapshot.docs[0].id);
            await updateDoc(docRef, {
                commentCount: actualCount,
                updatedAt: serverTimestamp()
            });
        } else {
            // Create new document
            await addDoc(collection(db, 'likesCount'), {
                feedsPostId: postId,
                likeCount: 0,
                commentCount: actualCount,
                shareCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        
        console.log(`Updated comment count for post ${postId}: ${actualCount}`);
    } catch (error) {
        console.error('Error updating comment count:', error);
    }
};

// Function to get comment count for community posts
export const getCommunityCommentCount = async (communityVariantDetailsId: string): Promise<number> => {
    try {
        const commentsRef = collection(db, 'communityVariantDetailsComments');
        const q = query(commentsRef, where('communityVariantDetailsId', '==', communityVariantDetailsId));
        const snapshot = await getDocs(q);
        return snapshot.docs.length;
    } catch (error) {
        console.error('Error fetching community comment count:', error);
        return 0;
    }
};
