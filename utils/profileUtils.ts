import { collection, getDocs, doc, getDoc, query, where, documentId, updateDoc } from 'firebase/firestore';
import { User, updateProfile } from 'firebase/auth';
import { db } from '@/lib/firebaseConfig';
import { ProfileData, UserData, SocialPosts, Communities, Follower, Following } from '@/types/global';

export const fetchUserData = async (currentUser: User): Promise<{ profileData: ProfileData; userData: UserData } | null> => {
  const profileRef = doc(db, 'profiles', currentUser.uid);
  const profileSnap = await getDoc(profileRef);

  const userRef = doc(db, 'users', currentUser.uid);
  const userSnap = await getDoc(userRef);

  if (profileSnap.exists() && userSnap.exists()) {
    const profileData = profileSnap.data() as ProfileData;
    const userData = userSnap.data() as UserData;

    if (userData.photoURL && userData.photoURL !== currentUser.photoURL) {
      await updateProfile(currentUser, { photoURL: userData.photoURL });
    }

    return { profileData, userData };
  }

  return null;
};

export const fetchUserPosts = async (userEmail: string): Promise<SocialPosts[]> => {
  const getPosts = await getDocs(collection(db, 'posts'));
  const postsData = getPosts.docs.map((doc) => doc.data() as SocialPosts);
  return postsData
    .filter((post) => post.email === userEmail)
    .sort((a, b) => b.time - a.time);
};

export const fetchUserCommunities = async (userId: string): Promise<Communities[]> => {
  const communitiesCollection = collection(db, 'communities');
  const communitySnapshot = await getDocs(communitiesCollection);
  const communitiesData = communitySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Communities));

  return communitiesData.filter((community) =>
    community.members && community.members.includes(userId)
  );
};

export const fetchFollowersAndFollowing = async (currentUser: User): Promise<{ followers: Follower[]; following: Following[] }> => {
  const followersSnapshot = await getDocs(query(collection(db, 'followers'), where('followedId', '==', currentUser.uid)));
  const followerIds = followersSnapshot.docs.map(doc => doc.data().followerId);

  const followingSnapshot = await getDocs(query(collection(db, 'following'), where('followerId', '==', currentUser.uid)));
  const followingIds = followingSnapshot.docs.map(doc => doc.data().followedId);

  const userIds = Array.from(new Set([...followerIds, ...followingIds]));
  
  let usersData: { [key: string]: any } = {};
  if (userIds.length > 0) {
    const usersSnapshot = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', userIds)));
    usersData = usersSnapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data();
      return acc;
    }, {} as { [key: string]: any });
  }

  const followers: Follower[] = followerIds.map(id => ({
    uid: id,
    username: usersData[id]?.userName,
    profilePicture: usersData[id]?.profilePicture,
    email: usersData[id]?.email
  }));

  const following: Following[] = followingIds.map(id => ({
    uid: id,
    username: usersData[id]?.userName,
    profilePicture: usersData[id]?.profilePicture,
    email: usersData[id]?.email
  }));

  return { followers, following };
};

export const updateUserProfile = async (currentUser: User, updatedData: Partial<ProfileData & { photoURL?: string }>): Promise<void> => {
  const profileRef = doc(db, 'profiles', currentUser.uid);
  await updateDoc(profileRef, updatedData);

  if (updatedData.photoURL) {
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      photoURL: updatedData.photoURL,
    });
    await updateProfile(currentUser, { photoURL: updatedData.photoURL });
  }
};
