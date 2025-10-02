import { UserService } from '@/helpers/Auth';
import { useProfileStore } from "@/src/store/useProfileStore";

// From helpers\initialDataFetch.ts
export const fetchInitialUserData = async (userId: string) => {
    try {
        // Get the setUserData function from the Zustand store
        const { setUserData, setProfileImage, setCoverImage, setUserImages } = useProfileStore.getState();
        
        // Fetch all user data in parallel using our service methods
        const [
            userDoc,
            profileImagesData,
            friendshipsData,
            postsSnapshot,
            followingSnapshot
        ] = await Promise.all([
            UserService.fetchUser(userId),
            UserService.fetchProfileImages(userId),
            UserService.fetchFriendships(userId),
            UserService.fetchUserPosts(userId),
            UserService.fetchFollowing(userId)
        ]);
        
        // Process user data
        const userData = userDoc?.data();
        
        if (!userData) {
            throw new Error('User data not found');
        }
        
        // Set profile image if available
        if (profileImagesData.profileImage) {
            setProfileImage(profileImagesData.profileImage);
        }
        
        // Set cover image if available (first one from the array)
        if (profileImagesData.coverImages && profileImagesData.coverImages.length > 0) {
            setCoverImage(profileImagesData.coverImages[0]);
        }
        
        // Set all user images
        if (profileImagesData.allImages) {
            setUserImages(profileImagesData.allImages);
        }
        
        // Set user data in the store with additional properties
        setUserData({
            id: userId,
            firstName: userData.firstName || null,
            lastName: userData.lastName || null,
            email: userData.email || null,
            userName: userData.userName || null,
            country: userData.country || null,
            createdAt: userData.createdAt?.toDate() || null,
            friendsCount: friendshipsData.totalCount || 0,
            postsCount: postsSnapshot.size || 0,
            followingCount: followingSnapshot.size || 0,
            // Add the new properties - fix isAdmin mapping
            userTier: userData.userTier || 1,
            isAuthenticated: userData.isAuthenticated || false,
            isAdmin: userData.isAdmin || false,
            emailVerified: userData.emailVerified || false,
            role: userData.role || 'user'
        });
            
        return true;
    } catch (error) {
        console.error('Error fetching initial user data:', error);
        return false;
    }
};
