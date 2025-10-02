import { auth } from '@/lib/firebaseConfig';
import { db } from '@/lib/firebaseConfig';
import { relationshipHelpers } from '@/helpers/relationshipHelpers';
import { relationshipQueries } from '@/lib/relationships/relationshipQueries';
import {
    collection,
    query,
    orderBy,
    getDocs,
    doc,
    getDoc,
    where,
} from 'firebase/firestore';

interface RelationshipStatus {
    isFriend: boolean;
    isFollowing: boolean;
    friendshipStatus: 'none' | 'pending' | 'accepted' | 'declined';
    mutualFriends: number;
    mutualFollowers: number;
}

export class ViewPostService {
    private static instance: ViewPostService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): ViewPostService {
        if (!ViewPostService.instance) {
            ViewPostService.instance = new ViewPostService();
        }
        return ViewPostService.instance;
    }

    async getPosts(currentUserId?: string) {
        try {
            const user = auth.currentUser;
            const authenticatedUserId = user?.uid || currentUserId;
            const postsRef = collection(this.db, 'feedPosts');
            const q = query(postsRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            
            const posts = await Promise.all(
                snapshot.docs.map(async (postDoc) => {
                    const postData = postDoc.data();
                
                    let relationshipStatus;
                    if (authenticatedUserId && authenticatedUserId !== postData.userId) {
                        relationshipStatus = await relationshipHelpers.getRelationshipStatus(
                            authenticatedUserId,
                            postData.userId
                        );
                    }

                    const canView = this.checkPostVisibilityByStatus(
                        authenticatedUserId,
                        postData.userId,
                        postData.visibility,
                        relationshipStatus
                    );

                    if (!canView) {
                        return null;
                    }

                    const userDocRef = doc(this.db, 'users', postData.userId);
                    const userDocSnap = await getDoc(userDocRef);
                    const userData = userDocSnap.data();

                    const profileImagesQuery = query(
                        collection(this.db, 'profileImages'),
                        where('userId', '==', postData.userId)
                    );
                    const profileImagesSnapshot = await getDocs(profileImagesQuery);

                    const profileSetAsQuery = query(
                        collection(this.db, 'profileImageSetAs'),
                        where('userId', '==', postData.userId)
                    );
                    const setAsSnapshot = await getDocs(profileSetAsQuery);

                    let profileImage = null;
                    if (!setAsSnapshot.empty) {
                        let setAsDoc = setAsSnapshot.docs.find(
                            (doc) => doc.data().setAs === 'postProfile'
                        );

                        if (!setAsDoc) {
                            setAsDoc = setAsSnapshot.docs.find(
                                (doc) => doc.data().setAs === 'profile'
                            );
                        }

                        if (setAsDoc) {
                            const setAsData = setAsDoc.data();
                            const matchingImage = profileImagesSnapshot.docs.find(
                                (img) => img.id === setAsData.profileImageId
                            );
                            if (matchingImage) {
                                profileImage = matchingImage.data();
                            }
                        }
                    }

                    const mediaQuery = query(
                        collection(this.db, 'feedsPostSummary'),
                        where('feedsPostId', '==', postDoc.id)
                    );
                    const mediaSnapshot = await getDocs(mediaQuery);
                    const media = mediaSnapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));

                    const likesCountRef = collection(this.db, 'likesCount');
                    const likesQuery = query(
                        likesCountRef,
                        where('feedsPostId', '==', postDoc.id)
                    );
                    const likesSnapshot = await getDocs(likesQuery);
                    const likesData = likesSnapshot.docs[0]?.data() || {
                        likeCount: 0,
                        commentCount: 0,
                        shareCount: 0,
                    };

                    // Get actual comment count from feedsPostComments collection
                    const commentsRef = collection(this.db, 'feedsPostComments');
                    const commentsQuery = query(
                        commentsRef,
                        where('feedsPostId', '==', postDoc.id)
                    );
                    const commentsSnapshot = await getDocs(commentsQuery);
                    const actualCommentCount = commentsSnapshot.docs.length;

                    const likesRef = collection(this.db, 'feedsPostLikeCount');
                    const likedUsersQuery = query(
                        likesRef,
                        where('feedsPostId', '==', postDoc.id),
                        where('likes', '==', true)
                    );
                    const likedUsersSnapshot = await getDocs(likedUsersQuery);

                    const likedUsers = await Promise.all(
                        likedUsersSnapshot.docs.map(async (likeDoc) => {
                            const userData = likeDoc.data();
                            const userDocRef = doc(this.db, 'users', userData.userId);
                            const userSnap = await getDoc(userDocRef);
                            const userDetails = userSnap.data();
                            const profileImage = await relationshipQueries.getUserProfileImage(userData.userId);

                            return {
                                id: userData.userId,
                                firstName: userDetails.firstName,
                                lastName: userDetails.lastName,
                                profileImage,
                            };
                        })
                    );

                    return {
                        id: postDoc.id,
                        caption: postData.caption,
                        description: postData.description,
                        visibility: postData.visibility,
                        createdAt: postData.createdAt.toDate(),
                        userId: postData.userId,
                        hashtags: postData.hashtags || [],
                        mentions: postData.mentions || [],
                        friendReferences: postData.friendReferences || [],
                        type: postData.type || 'regular',
                        pollOptions: postData.pollOptions || [],
                        pollDuration: postData.pollDuration || 0,
                        pollEndTime: postData.pollEndTime || null,
                        pollVotes: postData.pollVotes || {},
                        media,
                        user: {
                            ...userData,
                            profileImage: profileImage?.imageURL,
                            emailVerified: userData?.emailVerified || false,
                            userName: userData?.userName || '',
                            firstName: userData?.firstName || '',
                            lastName: userData?.lastName || ''
                        },
                        stats: {
                            likes: likesData.likeCount,
                            comments: actualCommentCount, // Use actual count from comments collection
                            shares: likesData.shareCount,
                        },
                        likedUsers,
                    };
                })
            );

            const filteredPosts = posts.filter(post => post !== null);
            return {
                success: true,
                data: filteredPosts
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to fetch posts'
            };
        }
    }

    private checkPostVisibilityByStatus(
        viewerId: string | undefined,
        creatorId: string,
        visibility: string,
        relationshipStatus?: RelationshipStatus
    ): boolean {
        if (visibility === 'public') {
            return true;
        }

        if (!viewerId) {
            return visibility === 'public';
        }

        if (viewerId === creatorId) {
            return true;
        }

        if (!relationshipStatus) {
            return visibility === 'public';
        }

        if (visibility === 'private') {
            return false;
        }

        if (visibility === 'friends' && relationshipStatus.isFriend) {
            return true;
        }

        if (visibility === 'friends_followers' && 
            (relationshipStatus.isFriend || relationshipStatus.isFollowing)) {
            return true;
        }
        
        return false;
    }
}

export const viewPostService = ViewPostService.getInstance();
