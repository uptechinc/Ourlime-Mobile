import { collection, getDocs, query, where, doc, getDoc, deleteDoc, increment, serverTimestamp, writeBatch, updateDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { UserData, Post, BasePost } from "@/types/userTypes"; // Adjust the import based on your project structure
import { Comment, Reply } from "@/types/global";
import { CommunityVariantDetailsSummary, Community, CommunityMember } from "@/types/communityTypes";
import { error } from "console";

interface UpdateCommunityData {
    title: string;
    description: string;
    imageUrl: string;
    isPrivate: boolean;
}

export const fetchCommunityData = async (communityVariantId: string): Promise<Community | null> => {
    if (!communityVariantId) return null; // Ensure ID is valid

    const communityDocRef = doc(db, "communityVariant", communityVariantId);
    const communitySnapshot = await getDoc(communityDocRef);

    if (!communitySnapshot.exists()) { 
        console.warn(`Community with ID ${communityVariantId} not found.`);
        return null;
    }

    const communityData = communitySnapshot.data();
    const creatorId = communityData.userId;

    // Fetch creator's profile image
    const profileImagesQuery = query(
        collection(db, 'profileImages'),
        where('userId', '==', creatorId)
    );
    const profileImagesSnapshot = await getDocs(profileImagesQuery);

    const profileSetAsQuery = query(
        collection(db, 'profileImageSetAs'),
        where('userId', '==', creatorId),
        where('setAs', '==', 'profile')
    );
    const setAsSnapshot = await getDocs(profileSetAsQuery);

    let creatorProfileImage = null;
    if (!setAsSnapshot.empty) {
        const setAsDoc = setAsSnapshot.docs[0].data();
        const matchingImage = profileImagesSnapshot.docs
            .find(img => img.id === setAsDoc.profileImageId);
        if (matchingImage) {
            creatorProfileImage = matchingImage.data().imageURL;
        }
    }

    // Fetch creator's user data
    const userDocRef = doc(db, 'users', creatorId);
    const userDocSnap = await getDoc(userDocRef);
    const userData = userDocSnap.data();

    return { 
        id: communitySnapshot.id, 
        ...communityData,
        creatorProfileImage,
        creatorName: userData ? `${userData.firstName} ${userData.lastName}` : 'Unknown User'
    } as Community;
};

export const fetchCommunityMembers = async (communityVariantId: string): Promise<CommunityMember[]> => {
    const membersRef = collection(db, 'communityVariantMembership');
    const q = query(membersRef, where('communityVariantId', '==', communityVariantId));
    const snapshot = await getDocs(q);

    const membersData: CommunityMember[] = await Promise.all(snapshot.docs.map(async (memberDoc) => {
        const memberData = memberDoc.data();
        const userId = memberData.userId;

        // Fetch additional user data
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.data() as UserData;

        // Fetch user's profile image
        const profileImagesQuery = query(
            collection(db, 'profileImages'),
            where('userId', '==', userId)
        );
        const profileImagesSnapshot = await getDocs(profileImagesQuery);

        const profileSetAsQuery = query(
            collection(db, 'profileImageSetAs'),
            where('userId', '==', userId),
            where('setAs', '==', 'profile')
        );
        const setAsSnapshot = await getDocs(profileSetAsQuery);

        let profileImage = null;
        if (!setAsSnapshot.empty) {
            const setAsDoc = setAsSnapshot.docs[0].data();
            const matchingImage = profileImagesSnapshot.docs
                .find(img => img.id === setAsDoc.profileImageId);
            if (matchingImage) {
                profileImage = matchingImage.data().imageURL; // Ensure we get the imageURL
            }
        }

        return {
            userId: userId,
            communityVariantId: communityVariantId,
            status: memberData.status, // Assuming status is stored in Firestore
            role: memberData.role, // Assuming role is stored in Firestore
            joinedAt: memberData.joinedAt, // Assuming joinedAt is stored in Firestore
            profileImage: profileImage, // Add profile image
            firstName: userData.firstName, // Add first name
            lastName: userData.lastName, // Add last name
            userName: userData.userName, // Add username
        } as CommunityMember;
    }));

    return membersData; // Return the array of CommunityMember objects
};

export const fetchCommunityPosts = async (communityVariantId: string): Promise<BasePost[]> => {
    if (!communityVariantId) {
        throw new Error("communityVariantId is required");
    }
    const postsRef = collection(db, 'communityVariantDetails');
    const q = query(postsRef, where('communityVariantId', '==', communityVariantId));
    const snapshot = await getDocs(q);

    const postsData = await Promise.all(snapshot.docs.map(async (postdoc) => {
        const userId = postdoc.data().userId;

        // Log the userId for debugging
        console.log(`Fetching user data for userId: ${userId}`);

        if (!userId) {
            throw new Error("userId is required");
        }

        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.data() as UserData;

        // Set the id property to the document ID
        userData.id = userDocSnap.id; // Assign the document ID to the id property

        // Log the entire userData object for debugging
        console.log("User Data Retrieved: ", userData);

        // Get user's profile image
        const profileImagesQuery = query(
            collection(db, 'profileImages'),
            where('userId', '==', userData.id)
        );
        const profileImagesSnapshot = await getDocs(profileImagesQuery);
        const profileSetAsQuery = query(
            collection(db, 'profileImageSetAs'),
            where('userId', '==', userData.id),
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

        // Fetch associated summary data from communityVariantDetailsSummary
        const summaryRef = collection(db, 'communityVariantDetailsSummary');
        const summaryQuery = query(summaryRef, where('communityVariantDetailsId', '==', postdoc.id));
        const summarySnapshot = await getDocs(summaryQuery);

        const mediaDetails: CommunityVariantDetailsSummary[] = summarySnapshot.docs.map(summaryDoc => {
            const data = summaryDoc.data(); // Get the data from the document
            return {
                id: summaryDoc.id,
                type: data.type, // Ensure type is included
                typeUrl: data.typeUrl, // Ensure typeUrl is included
                communityVariantDetailsId: data.communityVariantDetailsId, // Ensure communityVariantDetailsId is included
                // Add any other necessary properties from the summaryDoc.data() if needed
            } as CommunityVariantDetailsSummary; // Cast to the correct type
        });

        // Construct the post object ensuring all required properties are included
        const post = {
            id: postdoc.id,
            title: postdoc.data().title,
            caption: postdoc.data().caption,
            content: postdoc.data().content,
            visibility: postdoc.data().visibility,
            userId: postdoc.data().userId,
            hashtags: postdoc.data().hashtags || [],
            media: mediaDetails.map(item => item.typeUrl), // Ensure media is included
            timestamp: postdoc.data().createdAt.toDate(), // Ensure timestamp is included
            userReferences: postdoc.data().userReferences || [], // Ensure userReferences is included
            author: {
                ...userData,
                profileImage: profileImage?.imageURL || null,
            },
            description: postdoc.data().description || '', // Ensure description is included
            createdAt: postdoc.data().createdAt.toDate(), // Ensure createdAt is included
            mediaDetails,
        } as unknown as BasePost;

        return  post; // Return the post object
    }));

    return postsData;
};

export const fetchCommunityPostComments = async (communityVariantDetailsId: string): Promise<Comment[]> => {
    if (!communityVariantDetailsId) {
        throw new Error("Community Variant Details Id Required");
    }

    try {
        const commentsRef = collection(db, "communityVariantDetailsComments");
        const q = query(commentsRef, where("communityVariantDetailsId", "==", communityVariantDetailsId));
        const querySnapshot = await getDocs(q);

        const comments: Comment[] = await Promise.all(querySnapshot.docs.map(async (commentDoc) => {
            const commentData = commentDoc.data();
            const userId = commentData.userId;

            // Fetch user data
            const userDoc = await getDoc(doc(db, "users", userId));
            let commentUserData = null;

            if (userDoc.exists()) {
                commentUserData = userDoc.data();
            } else {
                console.warn("No user document found for userId:", userId);
            }

            // Fetch user's profile image
            const profileImagesQuery = query(
                collection(db, "profileImages"),
                where("userId", "==", userId)
            );
            const profileImagesSnapshot = await getDocs(profileImagesQuery);

            const profileSetAsQuery = query(
                collection(db, "profileImageSetAs"),
                where("userId", "==", userId),
                where("setAs", "==", "profile")
            );
            const setAsSnapshot = await getDocs(profileSetAsQuery);

            let profileImage = null;
            if (!setAsSnapshot.empty) {
                const setAsDoc = setAsSnapshot.docs[0].data();
                const matchingImage = profileImagesSnapshot.docs.find(img => img.id === setAsDoc.profileImageId);
                if (matchingImage) {
                    profileImage = matchingImage.data().imageURL;
                } else {
                    console.warn("No matching profile image found for userId:", userId);
                }
            } else {
                console.warn("No profile image set for userId:", userId);
            }

            return {
                id: commentDoc.id,
                comment: commentData.comment || '', // Adjust based on Comment type definition
                createdAt: commentData.createdAt.toDate(),
                feedsPostId: commentData.communityVariantDetailsId,
                userId: userId,
                userData: {
                    id: userId,
                    firstName: commentUserData?.firstName || '',
                    lastName: commentUserData?.lastName || '',
                    userName: commentUserData?.userName || '',
                    profileImage: profileImage || null,
                },
                replies: [],
            } as Comment;
        }));

        console.log(`Fetched ${comments.length} comments for post ID: ${communityVariantDetailsId}`);
        return comments;
    } catch (error) {
        console.error("Error fetching community post comments:", error);
        throw new Error("Failed to fetch community post comments");
    }
};

// Function to fetch replies for comments
export const fetchRepliesForCommunityPostComments = async (collectionName: string, commentId: string): Promise<Reply[]> => {
    const repliesRef = collection(db, collectionName);
    const q = query(repliesRef, where("communityVariantDetailsCommentsId", "==", commentId)); // Ensure the field name matches your Firestore structure

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
                reply: data.commentReply,
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

// Handle liking a post
export async function likeCommunityPost(postId: string, userId: string, isLiked: boolean) {
    if (!postId || !userId) throw new Error("Post ID and User ID are required");

    const batch = writeBatch(db);
    const likesRef = collection(db, "communityVariantDetailsLikes");
    const countRef = doc(db, "communityVariantDetailsCounter", postId);

    // Check if user has already liked the post
    const userLikeQuery = query(likesRef, where("postId", "==", postId), where("userId", "==", userId));
    const snapshot = await getDocs(userLikeQuery);

    if (!isLiked) {
        // Add like
        batch.set(doc(likesRef), { postId, userId, timestamp: serverTimestamp() });
    } else {
        // Remove like if exists
        if (!snapshot.empty) {
            batch.delete(snapshot.docs[0].ref);
        }
    }

    // Check if like counter document exists
    const countDoc = await getDoc(countRef);

    if (!countDoc.exists()) {
        // Create counter document if it doesn't exist
        batch.set(countRef, { likeCount: isLiked ? 0 : 1 });
    } else {
        // Update like count
        batch.update(countRef, { likeCount: increment(isLiked ? -1 : 1) });
    }

    await batch.commit();
}


// Remove a user from a community
export async function removeUserFromCommunity(userId: string, communityId: string, adminId: string) {
    if (!userId || !communityId || !adminId) throw new Error("Missing required parameters");

    // Verify if the admin is authorized
    const communityRef = doc(db, "communityVariant", communityId);
    const communitySnap = await getDoc(communityRef);

    if (!communitySnap.exists() || communitySnap.data().userId !== adminId) {
        throw new Error("Unauthorized to remove users from this community.");
    }

    // Find the user's membership document
    const membershipRef = collection(db, "communityVariantMembership");
    const membershipQuery = query(membershipRef, where("userId", "==", userId), where("communityVariantId", "==", communityId));
    const membershipSnapshot = await getDocs(membershipQuery);

    if (!membershipSnapshot.empty) {
        await deleteDoc(membershipSnapshot.docs[0].ref);
        
        // Decrement the membership count
        const countRef = doc(db, "communityVariantMembershipAndLikeCount", communityId);
        const countDoc = await getDoc(countRef);
        
        if (countDoc.exists()) {
            await updateDoc(countRef, {
                membershipCount: increment(-1)
            });
        }
    }

    // Find and delete all posts related to the user in this community
    const postsRef = collection(db, "communityVariantDetails");
    const postsQuery = query(postsRef, where("userId", "==", userId), where("communityVariantId", "==", communityId));
    const postsSnapshot = await getDocs(postsQuery);

    const deletePromises = postsSnapshot.docs.map(postDoc => deleteDoc(doc(db, "communityVariantDetails", postDoc.id)));
    await Promise.all(deletePromises);

    return { success: true, message: `User ${userId} removed from the community and their posts deleted successfully.` };
}

export async function banUserFromCommunity(userId: string, communityId: string, adminId: string) {
    if (!userId || !communityId || !adminId) throw new Error("Missing required parameters");

    // Verify if the admin is authorized
    const communityRef = doc(db, "communityVariant", communityId);
    const communitySnap = await getDoc(communityRef);

    if (!communitySnap.exists() || communitySnap.data().userId !== adminId) {
        throw new Error("Unauthorized to ban users from this community.");
    }

    // Add the user to the bannedCommunityMembers collection
    await addDoc(collection(db, "bannedCommunityMembers"), {
        userId,
        communityVariantId: communityId,
    });

    console.log(`User ${userId} has been banned from the community.`);

    // Remove the user from the community (this will also handle the membership count decrement)
    await removeUserFromCommunity(userId, communityId, adminId);

    return { success: true, message: `User ${userId} has been banned and removed from the community.` };
}

export async function checkIfUserIsBanned(userId: string, communityId: string): Promise<boolean> {
    console.log("Checking ban status for:", { userId, communityId });

    if (!userId || !communityId) throw new Error("Missing required parameters");

    const bannedQuery = query(
        collection(db, "bannedCommunityMembers"),
        where("userId", "==", userId),
        where("communityVariantId", "==", communityId)
    );

    const bannedSnapshot = await getDocs(bannedQuery);
    console.log("Ban Query Result:", bannedSnapshot.docs.map(doc => doc.data()));

    return !bannedSnapshot.empty;
}

export async function updateCommunity(communityId: string, updateData: Partial<UpdateCommunityData>) {
    if (!communityId) throw new Error("Community ID is required");

    // Remove undefined values to avoid Firestore errors
    const filteredData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(filteredData).length === 0) {
        throw new Error("No valid fields to update");
    }

    const communityRef = doc(db, "communityVariant", communityId);
    await updateDoc(communityRef, filteredData);
}

export async function checkIfUserIsMember(communityId: string, userId: string): Promise<boolean> {
    if (!communityId || !userId) throw new Error("Community ID and User ID are required");

    const membersRef = collection(db, "communityVariantMembership");
    const q = query(
        membersRef,
        where("communityVariantId", "==", communityId),
        where("userId", "==", userId),
        where("isMember", "==", true)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

export async function checkRequestStatus(communityId: string): Promise<string | null> {
    if (!communityId) throw new Error("Community ID is required");

    const requestsRef = collection(db, "communityRequests");
    const q = query(
        requestsRef,
        where("communityVariantId", "==", communityId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    return snapshot.docs[0].data().status || null;
}
