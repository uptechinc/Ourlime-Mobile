import { db, auth } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, orderBy, Timestamp, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { Friendship, Following, FriendWithDetails, FollowerWithDetails } from '@/types/friendTypes';
import { UserData } from '@/types/userTypes';
import { onAuthStateChanged } from 'firebase/auth';

export const getFriends = async (userId: string): Promise<FriendWithDetails[]> => {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            console.log('Getting friends for userId:', userId);
  
            const friendsQuery1 = query(
              collection(db, 'friendship'),
              where('userId1', '==', userId),
              where('friendshipStatus', '==', 'accepted'),
              orderBy('createdAt', 'desc')
            );
  
            const friendsQuery2 = query(
              collection(db, 'friendship'),
              where('userId2', '==', userId),
              where('friendshipStatus', '==', 'accepted'),
              orderBy('createdAt', 'desc')
            );
  
            const [snapshot1, snapshot2] = await Promise.all([
              getDocs(friendsQuery1),
              getDocs(friendsQuery2)
            ]);
  
            const friendships = [...snapshot1.docs, ...snapshot2.docs].map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Friendship));
  
            console.log('Found friendships:', friendships);
  
            const friendsWithDetails = await Promise.all(
              friendships.map(async (friendship) => {
                const friendId = friendship.userId1 === userId ? friendship.userId2 : friendship.userId1;
                console.log('Processing friend:', friendId);
                
                const userDoc = await getDoc(doc(db, 'users', friendId));
                let userData = userDoc.exists() ? userDoc.data() as UserData : null;
                console.log('User data:', userData);
  
                if (userData) {
                  // Get profile image setting
                  const profileSetAsQuery = query(
                    collection(db, 'profileImageSetAs'),
                    where('userId', '==', friendId),
                    where('setAs', '==', 'profile')
                  );
                  const profileSetAsSnapshot = await getDocs(profileSetAsQuery);
                  console.log('Profile setAs snapshot:', profileSetAsSnapshot.docs.map(doc => doc.data()));
  
                  if (!profileSetAsSnapshot.empty) {
                    const profileImageId = profileSetAsSnapshot.docs[0].data().profileImageId;
                    console.log('Found profileImageId:', profileImageId);
  
                    const profileImageDoc = await getDoc(doc(db, 'profileImages', profileImageId));
                    console.log('Profile image doc:', profileImageDoc.data());
  
                    if (profileImageDoc.exists()) {
                        const imageData = profileImageDoc.data();
                        userData = {
                          ...userData,
                          profileImage: imageData.imageURL
                        };
                        console.log('Updated userData with image URL:', userData);
                      }
                      
                  }
                }
                
                const mutualFriendsCount = await getMutualFriendsCount(userId, friendId);
  
                return {
                  ...friendship,
                  friendDetails: userData,
                  mutualFriendsCount
                };
              })
            );
  
            console.log('Final friends with details:', friendsWithDetails);
            resolve(friendsWithDetails);
          } catch (error) {
            console.error('Error getting friends:', error);
            resolve([]);
          }
        } else {
          resolve([]);
        }
      });
    });
  };
  
  export const getFollowers = async (userId: string): Promise<FollowerWithDetails[]> => {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const followersQuery = query(
              collection(db, 'followers'),
              where('followeeId', '==', userId),
              orderBy('createdAt', 'desc')
            );
  
            const snapshot = await getDocs(followersQuery);
            
            const followersWithDetails = await Promise.all(
              snapshot.docs.map(async (docSnapshot) => {
                const followerData = { id: docSnapshot.id, ...docSnapshot.data() } as Following;
                const userDoc = await getDoc(doc(db, 'users', followerData.followerId));
                let userData = userDoc.exists() ? userDoc.data() as UserData : null;
  
                if (userData) {
                  const profileSetAsQuery = query(
                    collection(db, 'profileImageSetAs'),
                    where('userId', '==', followerData.followerId),
                    where('setAs', '==', 'profile')
                  );
                  const profileSetAsSnapshot = await getDocs(profileSetAsQuery);
  
                  if (!profileSetAsSnapshot.empty) {
                    const profileImageId = profileSetAsSnapshot.docs[0].data().profileImageId;
                    const profileImageDoc = await getDoc(doc(db, 'profileImages', profileImageId));
                    if (profileImageDoc.exists()) {
                      userData = {
                        ...userData,
                        profileImage: profileImageDoc.data().imageURL
                      };
                    }
                  }
                }
                
                return {
                  ...followerData,
                  userDetails: userData
                };
              })
            );
  
            resolve(followersWithDetails);
          } catch (error) {
            console.error('Error getting followers:', error);
            resolve([]);
          }
        } else {
          resolve([]);
        }
      });
    });
  };
  
  export const getFollowing = async (userId: string): Promise<FollowerWithDetails[]> => {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const followingQuery = query(
              collection(db, 'followers'),
              where('followerId', '==', userId),
              orderBy('createdAt', 'desc')
            );
  
            const snapshot = await getDocs(followingQuery);
            
            const followingWithDetails = await Promise.all(
              snapshot.docs.map(async (docSnapshot) => {
                const followingData = { id: docSnapshot.id, ...docSnapshot.data() } as Following;
                const userDoc = await getDoc(doc(db, 'users', followingData.followeeId));
                let userData = userDoc.exists() ? userDoc.data() as UserData : null;
  
                if (userData) {
                  const profileSetAsQuery = query(
                    collection(db, 'profileImageSetAs'),
                    where('userId', '==', followingData.followeeId),
                    where('setAs', '==', 'profile')
                  );
                  const profileSetAsSnapshot = await getDocs(profileSetAsQuery);
  
                  if (!profileSetAsSnapshot.empty) {
                    const profileImageId = profileSetAsSnapshot.docs[0].data().profileImageId;
                    const profileImageDoc = await getDoc(doc(db, 'profileImages', profileImageId));
                    if (profileImageDoc.exists()) {
                      userData = {
                        ...userData,
                        profileImage: profileImageDoc.data().imageURL
                      };
                    }
                  }
                }
                
                return {
                  ...followingData,
                  userDetails: userData
                };
              })
            );
  
            resolve(followingWithDetails);
          } catch (error) {
            console.error('Error getting following:', error);
            resolve([]);
          }
        } else {
          resolve([]);
        }
      });
    });
  };

  export const getFriendRequests = async (userId: string): Promise<FriendWithDetails[]> => {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const requestsQuery = query(
              collection(db, 'friendship'),
              where('userId2', '==', userId),
              where('friendshipStatus', '==', 'pending'),
              orderBy('createdAt', 'desc')
            );
  
            const snapshot = await getDocs(requestsQuery);
            
            const requestsWithDetails = await Promise.all(
              snapshot.docs.map(async (docSnapshot) => {
                const friendshipData = { id: docSnapshot.id, ...docSnapshot.data() } as Friendship;
                const userDoc = await getDoc(doc(db, 'users', friendshipData.userId1));
                let userData = userDoc.exists() ? userDoc.data() as UserData : null;
  
                if (userData) {
                  const profileSetAsQuery = query(
                    collection(db, 'profileImageSetAs'),
                    where('userId', '==', friendshipData.userId1),
                    where('setAs', '==', 'profile')
                  );
                  const profileSetAsSnapshot = await getDocs(profileSetAsQuery);
  
                  if (!profileSetAsSnapshot.empty) {
                    const profileImageId = profileSetAsSnapshot.docs[0].data().profileImageId;
                    const profileImageDoc = await getDoc(doc(db, 'profileImages', profileImageId));
                    if (profileImageDoc.exists()) {
                      userData = {
                        ...userData,
                        profileImage: profileImageDoc.data().imageURL
                      };
                    }
                  }
                }
  
                return {
                  ...friendshipData,
                  friendDetails: userData,
                  mutualFriendsCount: await getMutualFriendsCount(userId, friendshipData.userId1)
                };
              })
            );
  
            resolve(requestsWithDetails);
          } catch (error) {
            console.error('Error getting friend requests:', error);
            resolve([]);
          }
        } else {
          resolve([]);
        }
      });
    });
  };
  
  

const getMutualFriendsCount = async (userId1: string, userId2: string): Promise<number> => {
  try {
    const user1Friends = await getFriendIds(userId1);
    const user2Friends = await getFriendIds(userId2);
    return user1Friends.filter(id => user2Friends.includes(id)).length;
  } catch (error) {
    console.error('Error getting mutual friends count:', error);
    return 0;
  }
};

const getFriendIds = async (userId: string): Promise<string[]> => {
  try {
    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(query(
        collection(db, 'friendship'),
        where('userId1', '==', userId),
        where('friendshipStatus', '==', 'accepted')
      )),
      getDocs(query(
        collection(db, 'friendship'),
        where('userId2', '==', userId),
        where('friendshipStatus', '==', 'accepted')
      ))
    ]);

    const friendIds = [
      ...snapshot1.docs.map(doc => doc.data().userId2),
      ...snapshot2.docs.map(doc => doc.data().userId1)
    ];

    return friendIds;
  } catch (error) {
    console.error('Error getting friend IDs:', error);
    return [];
  }
};

export const unfriend = async (friendshipId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'friendship', friendshipId));
    return true;
  } catch (error) {
    console.error('Error unfriending:', error);
    return false;
  }
};

export const unfollow = async (followerId: string, followeeId: string): Promise<boolean> => {
  try {
    const followQuery = query(
      collection(db, 'followers'),
      where('followerId', '==', followerId),
      where('followeeId', '==', followeeId)
    );
    
    const snapshot = await getDocs(followQuery);
    if (!snapshot.empty) {
      await deleteDoc(doc(db, 'followers', snapshot.docs[0].id));
    }
    return true;
  } catch (error) {
    console.error('Error unfollowing:', error);
    return false;
  }
};
