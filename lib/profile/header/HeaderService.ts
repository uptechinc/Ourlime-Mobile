import {
	addDoc,
	collection,
	doc,
	getDoc,
	getDocs,
	query,
	serverTimestamp,
	updateDoc,
	where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebaseConfig';
import { ProfileImage, UserData } from '@/types/userTypes';

export class HeaderService {
	private static instance: HeaderService;

	private constructor() {}

	public static getInstance(): HeaderService {
		if (!HeaderService.instance) {
			HeaderService.instance = new HeaderService();
		}
		return HeaderService.instance;
	}

	// Fetch user profile data
	public async getUserData(userId: string): Promise<UserData | null> {
		try {
			// Fetch the main user document
			const userDoc = await getDoc(doc(db, 'users', userId));

			if (!userDoc.exists()) {
				return null;
			}

			const userData = userDoc.data() as UserData;

			// Fetch account settings from subcollection
			try {
				const accountSettingsDoc = await getDoc(
					doc(db, 'users', userId, 'userSettings', 'account')
				);

				if (accountSettingsDoc.exists()) {
					// Add account settings to the user data
					userData.accountSettings = accountSettingsDoc.data();
				}
			} catch (settingsError) {
				console.error('Error fetching account settings:', settingsError);
				// Continue even if settings fetch fails
			}

			return userData;
		} catch (error) {
			console.error('Error fetching user data:', error);
			return null;
		}
	}

	// Fetch all profile images
	public async getUserImages(userId: string): Promise<ProfileImage[]> {
		try {
			const imagesSnapshot = await getDocs(
				query(collection(db, 'profileImages'), where('userId', '==', userId))
			);

			return imagesSnapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					...data,
					createdAt: data.createdAt?.toDate() || new Date(),
					updatedAt: data.updatedAt?.toDate() || new Date(),
				} as ProfileImage;
			});
		} catch (error) {
			console.error('Error fetching user images:', error);
			return [];
		}
	}

	// Fetch image assignments
	public async getImageAssignments(userId: string) {
		try {
			const setAsSnapshot = await getDocs(
				query(
					collection(db, 'profileImageSetAs'),
					where('userId', '==', userId)
				)
			);

			return setAsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));
		} catch (error) {
			console.error('Error fetching image assignments:', error);
			return [];
		}
	}

	// Select a profile image
	public async selectProfileImage(
		userId: string,
		selectedImage: ProfileImage
	): Promise<boolean> {
		try {
			const profileSetAsQuery = query(
				collection(db, 'profileImageSetAs'),
				where('userId', '==', userId),
				where('setAs', '==', 'profile')
			);
			const setAsSnapshot = await getDocs(profileSetAsQuery);

			if (!setAsSnapshot.empty) {
				const setAsDoc = setAsSnapshot.docs[0];
				await updateDoc(doc(db, 'profileImageSetAs', setAsDoc.id), {
					profileImageId: selectedImage.id,
					updatedAt: serverTimestamp(),
				});
			} else {
				// Create new assignment if none exists
				await addDoc(collection(db, 'profileImageSetAs'), {
					userId: userId,
					profileImageId: selectedImage.id,
					setAs: 'profile',
					createdAt: serverTimestamp(),
				});
			}
			return true;
		} catch (error) {
			console.error('Error selecting profile image:', error);
			return false;
		}
	}

	// Upload a profile image
	public async uploadProfileImage(
		userId: string,
		file: File
	): Promise<ProfileImage | null> {
		try {
			const storageRef = ref(
				storage,
				`profiles/${userId}/${Date.now()}_${file.name}`
			);
			const uploadTask = await uploadBytes(storageRef, file);
			const imageURL = await getDownloadURL(uploadTask.ref);

			const profileImageRef = await addDoc(collection(db, 'profileImages'), {
				userId: userId,
				imageURL: imageURL,
				typeOfImage: 'profile',
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
			});

			const newProfileImage = {
				id: profileImageRef.id,
				imageURL,
				userId: userId,
				typeOfImage: 'profile',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			// Update profile image assignment
			const profileSetAsQuery = query(
				collection(db, 'profileImageSetAs'),
				where('userId', '==', userId),
				where('setAs', '==', 'profile')
			);
			const setAsSnapshot = await getDocs(profileSetAsQuery);

			if (!setAsSnapshot.empty) {
				const setAsDoc = setAsSnapshot.docs[0];
				await updateDoc(doc(db, 'profileImageSetAs', setAsDoc.id), {
					profileImageId: profileImageRef.id,
					updatedAt: serverTimestamp(),
				});
			} else {
				await addDoc(collection(db, 'profileImageSetAs'), {
					userId: userId,
					profileImageId: profileImageRef.id,
					setAs: 'profile',
					createdAt: serverTimestamp(),
				});
			}

			return newProfileImage;
		} catch (error) {
			console.error('Error uploading profile image:', error);
			return null;
		}
	}

	// Save cover image selections
	public async saveCoverImage(
		userId: string,
		selectedImageIds: string[]
	): Promise<boolean> {
		try {
			// Find existing cover image assignment
			const coverSetAsQuery = query(
				collection(db, 'profileImageSetAs'),
				where('userId', '==', userId),
				where('setAs', '==', 'coverProfile')
			);
			const setAsSnapshot = await getDocs(coverSetAsQuery);

			// Create the array of selected images with display order
			const selectedImagesWithOrder = selectedImageIds.map(
				(imageId, index) => ({
					id: imageId,
					displayorder: index + 1,
				})
			);

			// Update or create cover image assignment
			if (!setAsSnapshot.empty) {
				const setAsDoc = setAsSnapshot.docs[0];
				await updateDoc(doc(db, 'profileImageSetAs', setAsDoc.id), {
					profileImageId: selectedImagesWithOrder,
					updatedAt: serverTimestamp(),
				});
			} else {
				// Create new assignment if none exists
				await addDoc(collection(db, 'profileImageSetAs'), {
					userId: userId,
					profileImageId: selectedImagesWithOrder,
					setAs: 'coverProfile',
					createdAt: serverTimestamp(),
				});
			}
			return true;
		} catch (error) {
			console.error('Error saving cover image:', error);
			return false;
		}
	}

	// Upload a cover image
	public async uploadCoverImage(
		userId: string,
		file: File
	): Promise<ProfileImage | null> {
		try {
			const storageRef = ref(
				storage,
				`profiles/${userId}/covers/${Date.now()}_${file.name}`
			);
			const uploadTask = await uploadBytes(storageRef, file);
			const imageURL = await getDownloadURL(uploadTask.ref);

			const coverImageRef = await addDoc(collection(db, 'profileImages'), {
				userId: userId,
				imageURL,
				typeOfImage: 'coverProfile',
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
			});

			return {
				id: coverImageRef.id,
				imageURL,
				userId: userId,
				typeOfImage: 'coverProfile',
				createdAt: new Date(),
				updatedAt: new Date(),
			};
		} catch (error) {
			console.error('Error uploading cover image:', error);
			return null;
		}
	}

	// Add this method to your existing HeaderService class
	public async updateCoverImageOrder(
		userId: string,
		orderedImageIds: string[]
	): Promise<boolean> {
		try {
			// Find existing cover image assignment
			const coverSetAsQuery = query(
				collection(db, 'profileImageSetAs'),
				where('userId', '==', userId),
				where('setAs', '==', 'coverProfile')
			);
			const setAsSnapshot = await getDocs(coverSetAsQuery);

			if (!setAsSnapshot.empty) {
				const setAsDoc = setAsSnapshot.docs[0];

				// Create the ordered array with display order
				const profileImageIdArray = orderedImageIds.map((id, index) => ({
					id,
					[`displayorder${index + 1}`]: index + 1,
				}));

				// Update the document with the new ordered array
				await updateDoc(doc(db, 'profileImageSetAs', setAsDoc.id), {
					profileImageId: profileImageIdArray,
					updatedAt: serverTimestamp(),
				});

				return true;
			}
			return false;
		} catch (error) {
			console.error('Error updating image order in database:', error);
			return false;
		}
	}

	// Update user bio
	public async updateBio(userId: string, bio: string): Promise<boolean> {
		try {
			await updateDoc(doc(db, 'users', userId), {
				bio: bio,
			});
			return true;
		} catch (error) {
			console.error('Error updating bio:', error);
			return false;
		}
	}
	async updateBioAndStatus(
		userId: string,
		bio: string,
		onlineStatus: string
	): Promise<boolean> {
		try {
			// Update the user document with both bio and onlineStatus
			const userRef = doc(db, 'users', userId);
			await updateDoc(userRef, {
				bio,
				onlineStatus,
			});
			return true;
		} catch (error) {
			console.error('Error updating bio and status:', error);
			return false;
		}
	}
}

export default HeaderService.getInstance();
