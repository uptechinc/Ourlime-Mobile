import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, getDoc, doc, DocumentData, DocumentReference, orderBy } from 'firebase/firestore';
import { UserData, AboutItem } from '@/types/userTypes';

export class ViewOtherProfileService {
    private static instance: ViewOtherProfileService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): ViewOtherProfileService {
        if (!ViewOtherProfileService.instance) {
            ViewOtherProfileService.instance = new ViewOtherProfileService();
        }
        return ViewOtherProfileService.instance;
    }

    public async fetchUserProfile(username: string) {
        try {
            const usersQuery = query(
                collection(this.db, 'users'),
                where('userName', '==', username)
            );

            const userSnapshot = await getDocs(usersQuery);

            if (userSnapshot.empty) {
                return { error: 'User not found', status: 404 };
            }

            const userDoc = userSnapshot.docs[0];
            const userId = userDoc.id;
            const userData = userDoc.data() as UserData;

            const [
                profileImagesSnapshot,
                setAsSnapshot,
                postsSnapshot,
                friendsSnapshot1,
                friendsSnapshot2,
                communityVariantsSnapshot,
                communityCountsSnapshot,
                followingSnapshot,
                followersSnapshot,
                workExperienceSnapshot,
                educationSnapshot,
                aboutSnapshot
            ] = await Promise.all([
                getDocs(query(collection(this.db, 'profileImages'), where('userId', '==', userId))),
                getDocs(query(collection(this.db, 'profileImageSetAs'), where('userId', '==', userId))),
                getDocs(query(collection(this.db, 'feedPosts'), where('userId', '==', userId))),
                getDocs(query(collection(this.db, 'friendship'), where('userId1', '==', userId), where('friendshipStatus', '==', 'accepted'))),
                getDocs(query(collection(this.db, 'friendship'), where('userId2', '==', userId), where('friendshipStatus', '==', 'accepted'))),
                getDocs(query(collection(this.db, 'communityVariant'), where('userId', '==', userId))),
                getDocs(collection(this.db, 'communityVariantMembershipAndLikeCount')),
                getDocs(query(collection(this.db, 'followers'), where('followerId', '==', userId))),
                getDocs(query(collection(db, 'followers'), where('followeeId', '==', userId))),
                getDocs(query(collection(this.db, 'users', userId, 'workExperience'), orderBy('startDate', 'desc'))),
                getDocs(query(collection(this.db, 'users', userId, 'education'), orderBy('startDate', 'desc'))),
                getDocs(query(collection(this.db, 'users', userId, 'about')))
            ]);

            const profileImages = {};
            setAsSnapshot.docs.forEach(doc => {
                const setAsData = doc.data();
                const matchingImage = profileImagesSnapshot.docs.find(img => img.id === setAsData.profileImageId);
                if (matchingImage) {
                    profileImages[setAsData.setAs] = matchingImage.data().imageURL;
                }
            });

            const userImages = profileImagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                uploadedAt: doc.data().uploadedAt?.toDate()
            })).sort((a, b) => b.uploadedAt - a.uploadedAt);

            const following = await Promise.all(followingSnapshot.docs.map(async (docSnapshot) => {
                const followData = docSnapshot.data();
                const followingUserRef = doc(db, 'users', followData.followeeId) as DocumentReference<DocumentData>;
                const followingUserDoc = await getDoc(followingUserRef);
                const followingUserData = followingUserDoc.data() as UserData;
                
                const profileImageQuery = query(
                    collection(db, 'profileImages'),
                    where('userId', '==', followData.followeeId)
                );
                const profileSetAsQuery = query(
                    collection(db, 'profileImageSetAs'),
                    where('userId', '==', followData.followeeId),
                    where('setAs', '==', 'profile')
                );
                
                const [profileImagesSnap, setAsSnap] = await Promise.all([
                    getDocs(profileImageQuery),
                    getDocs(profileSetAsQuery)
                ]);
            
                let profileImage = null;
                if (!setAsSnap.empty) {
                    const setAsDoc = setAsSnap.docs[0].data();
                    const matchingImage = profileImagesSnap.docs.find(img => img.id === setAsDoc.profileImageId);
                    if (matchingImage) {
                        profileImage = matchingImage.data().imageURL;
                    }
                }
            
                return {
                    id: docSnapshot.id,
                    ...followData,
                    user: {
                        id: followingUserDoc.id,
                        firstName: followingUserData.firstName,
                        lastName: followingUserData.lastName,
                        userName: followingUserData.userName,
                        profileImage
                    }
                };
            }));

            const followers = await Promise.all(followersSnapshot.docs.map(async (docSnapshot) => {
                const followData = docSnapshot.data();
                const followerUserRef = doc(db, 'users', followData.followerId) as DocumentReference<DocumentData>;
                const followerUserDoc = await getDoc(followerUserRef);
                const followerUserData = followerUserDoc.data() as UserData;
                
                const profileImageQuery = query(
                    collection(db, 'profileImages'),
                    where('userId', '==', followData.followerId)
                );
                const profileSetAsQuery = query(
                    collection(db, 'profileImageSetAs'),
                    where('userId', '==', followData.followerId),
                    where('setAs', '==', 'profile')
                );
                
                const [profileImagesSnap, setAsSnap] = await Promise.all([
                    getDocs(profileImageQuery),
                    getDocs(profileSetAsQuery)
                ]);
            
                let profileImage = null;
                if (!setAsSnap.empty) {
                    const setAsDoc = setAsSnap.docs[0].data();
                    const matchingImage = profileImagesSnap.docs.find(img => img.id === setAsDoc.profileImageId);
                    if (matchingImage) {
                        profileImage = matchingImage.data().imageURL;
                    }
                }
            
                return {
                    id: docSnapshot.id,
                    ...followData,
                    user: {
                        id: followerUserDoc.id,
                        firstName: followerUserData.firstName,
                        lastName: followerUserData.lastName,
                        userName: followerUserData.userName,
                        profileImage
                    }
                };
            }));

            const friends = await Promise.all([...friendsSnapshot1.docs, ...friendsSnapshot2.docs].map(async (docSnapshot) => {
                const friendshipData = docSnapshot.data();
                const friendId = friendshipData.userId1 === userId ? friendshipData.userId2 : friendshipData.userId1;
                
                const friendUserRef = doc(db, 'users', friendId);
                const friendUserDoc = await getDoc(friendUserRef);
                const friendUserData = friendUserDoc.data() as UserData;
            
                const profileImageQuery = query(
                    collection(db, 'profileImages'),
                    where('userId', '==', friendId)
                );
                const profileSetAsQuery = query(
                    collection(db, 'profileImageSetAs'),
                    where('userId', '==', friendId),
                    where('setAs', '==', 'profile')
                );
                
                const [profileImagesSnap, setAsSnap] = await Promise.all([
                    getDocs(profileImageQuery),
                    getDocs(profileSetAsQuery)
                ]);
            
                let profileImage = null;
                if (!setAsSnap.empty) {
                    const setAsDoc = setAsSnap.docs[0].data();
                    const matchingImage = profileImagesSnap.docs.find(img => img.id === setAsDoc.profileImageId);
                    if (matchingImage) {
                        profileImage = matchingImage.data().imageURL;
                    }
                }
            
                return {
                    id: docSnapshot.id,
                    friendshipStatus: friendshipData.friendshipStatus,
                    createdAt: friendshipData.createdAt,
                    user: {
                        id: friendUserDoc.id,
                        firstName: friendUserData.firstName,
                        lastName: friendUserData.lastName,
                        userName: friendUserData.userName,
                        profileImage
                    }
                };
            }));
            
            const posts = await Promise.all(postsSnapshot.docs.map(async (doc) => {
                const postData = doc.data();
                
                const summaryQuery = query(
                    collection(this.db, 'feedsPostSummary'),
                    where('feedsPostId', '==', doc.id)
                );
                const summarySnapshot = await getDocs(summaryQuery);
                
                const media = summarySnapshot.docs.map(summary => {
                    const summaryData = summary.data();
                    return {
                        type: summaryData.type,
                        typeUrl: summaryData.typeUrl,
                        fileType: summaryData.fileType,
                        displayOrder: summaryData.displayOrder
                    };
                });

                return {
                    id: doc.id,
                    ...postData,
                    createdAt: postData.createdAt.toDate(),
                    user: {
                        profileImage: profileImages['profile'],
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        userName: userData.userName
                    },
                    media
                };
            }));

            const communities = await Promise.all(communityVariantsSnapshot.docs.map(async (doc) => {
                const communityData = doc.data();
                const countDoc = communityCountsSnapshot.docs.find(
                    count => count.data().communityVariantId === doc.id
                );
                
                return {
                    id: doc.id,
                    ...communityData,
                    createdAt: communityData.createdAt.toDate(),
                    membershipCount: countDoc?.data().membershipCount || 0,
                    membershipLikes: countDoc?.data().membershipLikes || 0
                };
            }));

            const aboutData = aboutSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AboutItem[];
            
            const interests = aboutData.filter(item => item.type === 'interests');
            const skills = aboutData.filter(item => item.type === 'skills');
            
            return {
                status: 'success',
                user: {
                    id: userId,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    userName: userData.userName,
                    email: userData.email,
                    gender: userData.gender,
                    birthday: userData.birthday,
                    country: userData.country,
                    isAdmin: userData.isAdmin,
                    last_loggedIn: userData.last_loggedIn,
                    userTier: userData.userTier,
                    createdAt: userData.createdAt,
                    bio: userData.bio,
                    profileImages,
                    postsCount: postsSnapshot.size,
                    friendsCount: friendsSnapshot1.size + friendsSnapshot2.size
                },
                posts,
                communities,
                images: userImages,
                following,
                followers,
                friends,
                about: {
                    workExperience: workExperienceSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })),
                    education: educationSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })),
                    interests,
                    skills
                }
            };

        } catch (error) {
            return { error: 'Failed to fetch user profile', status: 500 };
        }
    }
}
