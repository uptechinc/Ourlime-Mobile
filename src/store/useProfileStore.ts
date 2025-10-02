import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProfileImage } from '@/types/userTypes';

type ProfileStore = {
  id: string | null;
  profileImage: ProfileImage | null;
  coverImage: ProfileImage | null;
  postProfileImage: ProfileImage | null;
  jobProfileImage: ProfileImage | null;
  userImages: ProfileImage[];
  // Array for multiple cover profiles
  coverProfiles: ProfileImage[];
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  country: string | null;
  createdAt: Date | null;
  unreadCount: number;
  lastCheckedAt: Date | null;
  friendsCount: number;
  postsCount: number;
  followingCount: number;
 
  // New properties for tier system and user roles
  userTier: number | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  emailVerified: boolean;
  role: string | null;

  setUserData: (data: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    userName: string | null;
    country: string | null;
    createdAt: Date | null;
    friendsCount: number;
    postsCount: number;
    followingCount: number;
    userTier?: number | null;
    isAuthenticated?: boolean;
    isAdmin?: boolean;
    emailVerified?: boolean;
    role?: string | null;
  }) => void;
  setProfileImage: (profileImage: ProfileImage) => void;
  setCoverImage: (coverImage: ProfileImage) => void;
  setPostProfileImage: (postProfileImage: ProfileImage) => void;
  setJobProfileImage: (jobProfileImage: ProfileImage) => void;
  setUserImages: (userImages: ProfileImage[]) => void;
 
  // Methods for multiple cover profiles
  setCoverProfiles: (coverProfiles: ProfileImage[]) => void;
  addCoverProfile: (coverProfile: ProfileImage) => void;
  removeCoverProfile: (coverProfileId: string) => void;
  updateCoverProfile: (coverProfileId: string, updates: Partial<ProfileImage>) => void;
 
  setUserName: (userName: string) => void;
  setFirstName: (firstName: string) => void;
  setLastName: (lastName: string) => void;
  setEmail: (email: string) => void;
  setCountry: (country: string) => void;
  setCreatedAt: (createdAt: Date) => void;
  setFriendsCount: (count: number) => void;
  setPostsCount: (count: number) => void;
  setFollowingCount: (count: number) => void;
 
  // New setters for tier system and user roles
  setUserTier: (tier: number) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setEmailVerified: (emailVerified: boolean) => void;
  setRole: (role: string) => void;
};

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      id: null,
      profileImage: null,
      coverImage: null,
      postProfileImage: null,
      jobProfileImage: null,
      userImages: [],
      // Initialize the cover profiles array
      coverProfiles: [],
      userName: null,
      firstName: null,
      lastName: null,
      email: null,
      country: null,
      createdAt: null,
      unreadCount: 0,
      lastCheckedAt: null,
      friendsCount: 0,
      postsCount: 0,
      followingCount: 0,
     
      // Initialize new properties
      userTier: null,
      isAuthenticated: false,
      isAdmin: false,
      emailVerified: false,
      role: null,

      setUserData: (data) => {
        set({
          id: data.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          userName: data.userName,
          country: data.country,
          createdAt: data.createdAt,
          friendsCount: data.friendsCount,
          postsCount: data.postsCount,
          followingCount: data.followingCount,
          // Include new properties if provided
          ...(data.userTier !== undefined && { userTier: data.userTier }),
          ...(data.isAuthenticated !== undefined && { isAuthenticated: data.isAuthenticated }),
          ...(data.isAdmin !== undefined && { isAdmin: data.isAdmin }),
          ...(data.emailVerified !== undefined && { emailVerified: data.emailVerified }),
          ...(data.role !== undefined && { role: data.role })
        });
      },
      setProfileImage: (profileImage) => {
        set({ profileImage });
      },
      setCoverImage: (coverImage) => set({ coverImage }),
      setPostProfileImage: (postProfileImage) => set({ postProfileImage }),
      setJobProfileImage: (jobProfileImage) => set({ jobProfileImage }),
      setUserImages: (userImages) => set({ userImages }),
     
      // Methods for multiple cover profiles
      setCoverProfiles: (coverProfiles) => set({ coverProfiles }),
     
      addCoverProfile: (coverProfile) =>
        set((state) => ({
          coverProfiles: [...state.coverProfiles, coverProfile]
        })),
     
      removeCoverProfile: (coverProfileId) =>
        set((state) => ({
          coverProfiles: state.coverProfiles.filter(cp => cp.id !== coverProfileId)
        })),
     
      updateCoverProfile: (coverProfileId, updates) =>
        set((state) => ({
          coverProfiles: state.coverProfiles.map(cp =>
            cp.id === coverProfileId ? { ...cp, ...updates } : cp
          )
        })),
     
      setUserName: (userName) => set({ userName }),
      setFirstName: (firstName) => set({ firstName }),
      setLastName: (lastName) => set({ lastName }),
      setEmail: (email) => set({ email }),
      setCountry: (country) => set({ country }),
      setCreatedAt: (createdAt) => set({ createdAt }),
      setFriendsCount: (count) => set({ friendsCount: count }),
      setPostsCount: (count) => set({ postsCount: count }),
      setFollowingCount: (count) => set({ followingCount: count }),
     
      // New setters for tier system and user roles
      setUserTier: (tier) => set({ userTier: tier }),
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      setEmailVerified: (emailVerified) => set({ emailVerified }),
      setRole: (role) => set({ role })
    }),
    {
      name: 'profile-storage',
      partialize: (state) => {
        return {
          id: state.id,
          profileImage: state.profileImage,
          userName: state.userName,
          firstName: state.firstName,
          lastName: state.lastName,
          email: state.email,
          country: state.country,
          createdAt: state.createdAt,
          friendsCount: state.friendsCount,
          postsCount: state.postsCount,
          followingCount: state.followingCount,
          // Add coverProfiles to persisted state
          coverProfiles: state.coverProfiles,
          // Add new properties to persisted state
          userTier: state.userTier,
          isAdmin: state.isAdmin,
          role: state.role,
          emailVerified: state.emailVerified, // Now persisting emailVerified
          // Don't persist sensitive authentication data
          isAuthenticated: state.isAuthenticated,
        };
      }
    }
  )
);
