import {
	signOut,
	onAuthStateChanged,
	User,
	createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebaseConfig';
import {
	doc,
	getDoc,
	setDoc,
	collection,
	query,
	where,
	getDocs,
	addDoc,
	updateDoc,
	increment,
	deleteDoc,
	Timestamp,
} from 'firebase/firestore';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { uploadFile } from '@/helpers/firebaseStorage';

interface UserRegistrationData {
	firstName: string;
	lastName: string;
	userName: string;
	email: string;
	password: string;
	gender: string;
	birthday: string;
	country: string;
	phone: string;
	address: {
		street: string;
		city: string;
		postalCode: string;
		zipCode: string;
	};
	selectedFiles: {
		profile: File | null;
		cover: File | null;
	};
	profilePicture: string;
	selectedInterests: string[];
	idDocuments: {
		face: File | null;
		front: File | null;
		back: File | null;
	};
	skipAuthentication?: boolean;
}

interface EmailVerificationRecord {
	userId: string;
	email: string;
	verificationToken: string;
	createdAt: { seconds: number; nanoseconds: number };
	expiresAt: { seconds: number; nanoseconds: number };
	isVerified: boolean;
}

class AuthService {
	static async redirectAfterRegistration(
		router: AppRouterInstance
	): Promise<void> {
		await signOut(auth);
		router.push('/login');
	}

	static async redirectHome(router: AppRouterInstance): Promise<boolean> {
		return new Promise((resolve) => {
			onAuthStateChanged(auth, async (user) => {
				if (user) {
					const userDoc = await getDoc(doc(db, 'users', user.uid));
					if (userDoc.exists() && userDoc.data().emailVerified) {
						router.push('/');
						resolve(true);
					} else {
						await signOut(auth);
						router.push('/login');
						resolve(false);
					}
				} else {
					resolve(false);
				}
			});
		});
	}

	static async redirectLogin(
		router: AppRouterInstance,
		authorized: boolean = true
	): Promise<User | null> {
		return new Promise((resolve, reject) => {
			onAuthStateChanged(auth, async (user) => {
				if (!user) {
					router.push('/login');
					return;
				}

				const userDoc = await getDoc(doc(db, 'users', user.uid));
				if (!userDoc.exists() || !userDoc.data().emailVerified) {
					await signOut(auth);
					router.push('/login');
					return;
				}

				if (!authorized) {
					if (!userDoc.data().isAdmin) {
						router.push('/');
						return;
					}
				}

				resolve(user);
			});
		});
	}

	static async signOut(router: AppRouterInstance): Promise<void> {
		try {
			await signOut(auth);
			localStorage.clear();
			window.location.replace('/login');
		} catch (error) {
			throw new Error('Failed to sign out');
		}
	}
}

class RegisterService {
	static async registerUser(
		userData: UserRegistrationData
	): Promise<{ success: boolean; message: string; userId?: string }> {
		// Pre-validate data
		const validationResult = this.validateUserData(userData);
		if (!validationResult.valid) {
			return { success: false, message: validationResult.message };
		}

		// Check if user already exists
		try {
			const userExists = await UserService.checkUserExists(
				userData.email,
				userData.userName,
				userData.phone
			);
			if (userExists) {
				return {
					success: false,
					message: 'User with this email, username, or phone already exists',
				};
			}
		} catch (error) {
			console.error('Error checking existing user:', error);
			return { success: false, message: 'Failed to check if user exists' };
		}

		let user: User | null = null;
		let createdDocuments: { collection: string; docId: string }[] = [];

		try {
			
			// Create Firebase Auth user
			const userCredential = await createUserWithEmailAndPassword(
				auth,
				userData.email,
				userData.password
			);
			user = userCredential.user;

			await setDoc(doc(db, 'users', user.uid), {
				firstName: userData.firstName,
				lastName: userData.lastName,
				userName: userData.userName,
				email: user.email,
				emailVerified: false,
				gender: userData.gender,
				birthday: userData.birthday,
				country: userData.country,
				isAdmin: false,
				last_loggedIn: new Date(),
				userTier: 1,
				createdAt: new Date(),
			});
			createdDocuments.push({ collection: 'users', docId: user.uid });
			console.log('User profile document created successfully');

			// Process remaining data in parallel for efficiency
			try {
				await Promise.all([
					this.createAddressDocuments(user, userData.address, createdDocuments),
					this.handleProfileImages(user, userData, createdDocuments),
					this.createContactDocuments(user, userData.phone, createdDocuments),
					this.handleInterests(user, userData.selectedInterests, createdDocuments),
					!userData.skipAuthentication
						? this.createAuthenticationDocuments(user, userData.idDocuments, createdDocuments)
						: Promise.resolve()
				]);
			} catch (parallelError) {
				console.error('Error in parallel document creation:', parallelError);
				throw parallelError;
			}

			// Send verification email last (after all data is created)
			console.log('Sending verification email...');
			await EmailVerificationService.sendCustomVerification(user, userData);
			console.log('Verification email sent successfully');

			// Sign out user
			await signOut(auth);
			console.log('User signed out successfully');

			return {
				success: true,
				message: 'Registration successful. Please check your email to verify your account.',
				userId: user.uid,
			};
		} catch (error) {
			console.error('Registration error:', error);

			// Attempt to clean up any created documents
			if (createdDocuments.length > 0) {
				console.log('Cleaning up created documents...');
				await this.cleanupCreatedDocuments(createdDocuments);
			}

			// Delete the user if it was created
			if (user) {
				try {
					console.log('Deleting Firebase Auth user...');
					await user.delete();
					console.log('Firebase Auth user deleted successfully');
				} catch (deleteError) {
					console.error('Failed to delete user after registration failure:', deleteError);
				}
			}

			// Return appropriate error message
			if (error.code === 'auth/email-already-in-use') {
				return { success: false, message: 'Email is already in use' };
			} else if (error.code === 'auth/invalid-email') {
				return { success: false, message: 'Invalid email format' };
			} else if (error.code === 'auth/weak-password') {
				return { success: false, message: 'Password is too weak' };
			} else if (error.message && typeof error.message === 'string') {
				return {
					success: false,
					message: `Registration failed: ${error.message}`,
				};
			} else {
				return {
					success: false,
					message: 'Registration failed. Please try again later.',
				};
			}
		}
	}

	private static validateUserData(userData: UserRegistrationData): {
		valid: boolean;
		message: string;
	} {
		// Check required fields
		const requiredFields = [
			'firstName',
			'lastName',
			'userName',
			'email',
			'password',
			'gender',
			'birthday',
			'country',
			'phone',
		];

		for (const field of requiredFields) {
			if (!userData[field as keyof UserRegistrationData]) {
				return { valid: false, message: `Missing required field: ${field}` };
			}
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(userData.email)) {
			return { valid: false, message: 'Invalid email format' };
		}

		// Validate password strength
		if (userData.password.length < 8) {
			return {
				valid: false,
				message: 'Password must be at least 8 characters long',
			};
		}

		// Validate phone number
		const phoneRegex = /^\+?[0-9]{7,15}$/;
		if (!phoneRegex.test(userData.phone)) {
			return { valid: false, message: 'Invalid phone number format' };
		}

		// Only require ID documents if NOT skipping authentication
		if (!userData.skipAuthentication) {
			if (
				!userData.idDocuments.face ||
				!userData.idDocuments.front ||
				!userData.idDocuments.back
			) {
				return { valid: false, message: 'All ID documents are required' };
			}
		}

		// No validation for address fields (they are optional)
		return { valid: true, message: '' };
	}

	private static async cleanupCreatedDocuments(
		documents: { collection: string; docId: string }[]
	): Promise<void> {
		const deletePromises = documents.map(({ collection, docId }) => {
			// Handle subcollections with special path format
			if (collection.includes('/')) {
				const [parentColl, parentId, subColl] = collection.split('/');
				return deleteDoc(doc(db, parentColl, parentId, subColl, docId)).catch(
					(error) =>
						console.error(`Failed to delete ${collection}/${docId}:`, error)
				);
			} else {
				return deleteDoc(doc(db, collection, docId)).catch((error) =>
					console.error(`Failed to delete ${collection}/${docId}:`, error)
				);
			}
		});

		await Promise.allSettled(deletePromises);
	}

	private static async createAddressDocuments(
		user: User,
		address: UserRegistrationData['address'],
		createdDocuments: { collection: string; docId: string }[]
	) {
		try {
			const addressRef = doc(collection(db, 'addresses'));
			await setDoc(addressRef, {
				userId: user.uid,
				Address: address.street,
				city: address.city,
				postalCode: address.postalCode,
				zipCode: address.zipCode,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			createdDocuments.push({ collection: 'addresses', docId: addressRef.id });

			const setAsRef = doc(collection(db, 'addressSetAs'));
			await setDoc(setAsRef, {
				setAs: 'home',
				addressId: addressRef.id,
			});
			createdDocuments.push({ collection: 'addressSetAs', docId: setAsRef.id });
		} catch (error) {
			console.error('Error creating address documents:', error);
			throw new Error('Failed to create address information');
		}
	}

	private static async handleProfileImages(
		user: User,
		userData: UserRegistrationData,
		createdDocuments: { collection: string; docId: string }[]
	) {
		try {
			console.log('Starting profile image handling...');
			let profileImageURL: string;
			let coverImageURL: string | null = null;

			// Handle profile image
			if (userData.selectedFiles.profile) {
				console.log('Uploading custom profile image...');
				profileImageURL = await uploadFile(
					userData.selectedFiles.profile,
					`profiles/${user.uid}/profile`
				);
				console.log('Custom profile image uploaded successfully:', profileImageURL);
			} else {
				console.log('Uploading default avatar to storage...');
				const avatarBlob = await fetch(`/images/register/${userData.profilePicture}`).then(res => res.blob());
				console.log('Fetched avatar blob:', avatarBlob);
				profileImageURL = await uploadFile(
					new File([avatarBlob], userData.profilePicture, { type: 'image/svg+xml' }),
					`profiles/${user.uid}/${userData.profilePicture}`
				);
				console.log('Default avatar uploaded successfully:', profileImageURL);
			}

			// Handle cover image if provided
			if (userData.selectedFiles.cover) {
				console.log('Uploading cover image...');
				coverImageURL = await uploadFile(
					userData.selectedFiles.cover,
					`profiles/${user.uid}/cover`
				);
				console.log('Cover image uploaded successfully:', coverImageURL);
			}

			// Create profile image document
			console.log('Creating profile image document...');
			const profileImageRef = doc(collection(db, 'profileImages'));
			await setDoc(profileImageRef, {
				imageURL: profileImageURL,
				typeOfImage: 'profile',
				userId: user.uid,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			createdDocuments.push({
				collection: 'profileImages',
				docId: profileImageRef.id,
			});
			console.log('Profile image document created successfully');

			// Set profile image as default
			console.log('Setting profile image as default...');
			const profileSetAsRef = doc(collection(db, 'profileImageSetAs'));
			await setDoc(profileSetAsRef, {
				setAs: 'profile',
				profileImageId: profileImageRef.id,
				userId: user.uid,
			});
			createdDocuments.push({
				collection: 'profileImageSetAs',
				docId: profileSetAsRef.id,
			});
			console.log('Profile image set as default successfully');

			// Handle cover image if available
			if (coverImageURL) {
				console.log('Creating cover image document...');
				const coverImageRef = doc(collection(db, 'profileImages'));
				await setDoc(coverImageRef, {
					imageURL: coverImageURL,
					typeOfImage: 'cover',
					userId: user.uid,
					createdAt: new Date(),
					updatedAt: new Date(),
				});
				createdDocuments.push({
					collection: 'profileImages',
					docId: coverImageRef.id,
				});
				console.log('Cover image document created successfully');

				console.log('Setting cover image as default...');
				const coverSetAsRef = doc(collection(db, 'profileImageSetAs'));
				await setDoc(coverSetAsRef, {
					setAs: 'coverProfile',
					profileImageId: coverImageRef.id,
					userId: user.uid,
				});
				createdDocuments.push({
					collection: 'profileImageSetAs',
					docId: coverSetAsRef.id,
				});
				console.log('Cover image set as default successfully');
			}
		} catch (error) {
			console.error('Error in handleProfileImages:', error);
			throw new Error('Failed to upload and save profile images');
		}
	}

	private static async createContactDocuments(
		user: User,
		phone: string,
		createdDocuments: { collection: string; docId: string }[]
	) {
		try {
			const contactRef = doc(collection(db, 'contact'));
			await setDoc(contactRef, {
				userId: user.uid,
				contactNumber: phone,
				isVerified: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			createdDocuments.push({ collection: 'contact', docId: contactRef.id });

			const setAsRef = doc(collection(db, 'contactSetAs'));
			await setDoc(setAsRef, {
				setAs: 'personal',
				contactId: contactRef.id,
			});
			createdDocuments.push({ collection: 'contactSetAs', docId: setAsRef.id });
		} catch (error) {
			console.error('Error creating contact documents:', error);
			throw new Error('Failed to create contact information');
		}
	}

	private static async handleInterests(
		user: User,
		interests: string[],
		createdDocuments: { collection: string; docId: string }[]
	) {
		try {
			// Create interests in the global interests collection and increment counts
			await Promise.all(
				interests.map(async (interestName) => {
					const interestsRef = collection(db, 'interests');
					const q = query(interestsRef, where('name', '==', interestName));
					const querySnapshot = await getDocs(q);
					
					if (querySnapshot.empty) {
						await addDoc(collection(db, 'interests'), {
							name: interestName,
							likeCount: 1,
						});
					} else {
						const interestDoc = querySnapshot.docs[0];
						await updateDoc(interestDoc.ref, {
							likeCount: increment(1),
						});
					}
				})
			);
	
			// Store user's interests in the user's about subcollection
			const aboutCollection = collection(db, 'users', user.uid, 'about');
			
			await Promise.all(
				interests.map(async (interest) => {
					const interestDoc = doc(aboutCollection);
					await setDoc(interestDoc, {
						type: 'interests',
						value: interest,
						createdAt: new Date()
					});
					
					createdDocuments.push({ 
						collection: `users/${user.uid}/about`, 
						docId: interestDoc.id 
					});
				})
			);
		} catch (error) {
			console.error('Error handling interests:', error);
			throw new Error('Failed to save user interests');
		}
	}
	
	private static async createAuthenticationDocuments(
		user: User,
		idDocuments: UserRegistrationData['idDocuments'],
		createdDocuments: { collection: string; docId: string }[]
	) {
		try {
			// Upload ID documents to storage
			const faceImageURL = await uploadFile(
				idDocuments.face,
				`authentication/${user.uid}/faceID`
			);
			
			const frontImageURL = await uploadFile(
				idDocuments.front,
				`authentication/${user.uid}/frontID`
			);
			
			const backImageURL = await uploadFile(
				idDocuments.back,
				`authentication/${user.uid}/backID`
			);
	
			// Create authentication documents in user's subcollection
			const authCollection = collection(db, 'users', user.uid, 'authenticationDocuments');
			
			// Face ID document
			const faceDoc = doc(authCollection);
			await setDoc(faceDoc, {
				type: 'faceID',
				imageURL: faceImageURL,
				verified: false,
				createdAt: new Date(),
			});
			createdDocuments.push({
				collection: `users/${user.uid}/authenticationDocuments`,
				docId: faceDoc.id,
			});
			
			// Front ID document
			const frontDoc = doc(authCollection);
			await setDoc(frontDoc, {
				type: 'frontID',
				imageURL: frontImageURL,
				verified: false,
				createdAt: new Date(),
			});
			createdDocuments.push({
				collection: `users/${user.uid}/authenticationDocuments`,
				docId: frontDoc.id,
			});
			
			// Back ID document
			const backDoc = doc(authCollection);
			await setDoc(backDoc, {
				type: 'backID',
				imageURL: backImageURL,
				verified: false,
				createdAt: new Date(),
			});
			createdDocuments.push({
				collection: `users/${user.uid}/authenticationDocuments`,
				docId: backDoc.id,
			});
	
			// Optional: Create a verification status document for easier admin querying
			// This could be done in a Cloud Function instead to keep registration simpler
			/*
			const verificationStatusRef = doc(collection(db, 'verificationStatus'));
			await setDoc(verificationStatusRef, {
				userId: user.uid,
				status: 'pending',
				createdAt: new Date(),
				updatedAt: new Date()
			});
			createdDocuments.push({ collection: 'verificationStatus', docId: verificationStatusRef.id });
			*/
			
		} catch (error) {
			console.error('Error creating authentication documents:', error);
			throw new Error('Failed to upload and save ID documents');
		}
	}
	
}

class UserService {
	static async fetchUser(uid: string) {
		try {
			const userRef = doc(db, 'users', uid);
			return await getDoc(userRef);
		} catch (error) {
			throw new Error('Failed to fetch user');
		}
	}

	static async fetchProfileImages(userId: string) {
		try {
			// First get the profile image settings
			const profileSettingsQuery = query(
				collection(db, 'profileImageSetAs'),
				where('userId', '==', userId)
			);

			const settingsSnapshot = await getDocs(profileSettingsQuery);

			if (settingsSnapshot.empty) {
				return { profileImage: null, coverImages: [], allImages: [] };
			}

			// Fetch all profile images for this user
			const imagesQuery = query(
				collection(db, 'profileImages'),
				where('userId', '==', userId)
			);

			const imagesSnapshot = await getDocs(imagesQuery);

			// Process settings to find profile and cover images
			let profileImage = null;
			const coverImages = [];

			// Group settings by type
			const profileSettings = settingsSnapshot.docs.filter(
				(doc) => doc.data().setAs === 'profile'
			);
			const coverSettings = settingsSnapshot.docs.filter(
				(doc) => doc.data().setAs === 'coverProfile'
			);

			// Get profile image (should be only one)
			if (profileSettings.length > 0) {
				const profileSetting = profileSettings[0]; // Take the first one if multiple exist
				const profileImageId = profileSetting.data().profileImageId;
				const matchingImage = imagesSnapshot.docs.find(
					(img) => img.id === profileImageId
				);

				if (matchingImage) {
					const imageData = matchingImage.data();
					profileImage = {
						id: matchingImage.id,
						imageURL: imageData.imageURL,
						userId: imageData.userId,
						typeOfImage: imageData.typeOfImage,
						createdAt: imageData.createdAt?.toDate() || new Date(),
						updatedAt: imageData.updatedAt?.toDate() || new Date(),
					};
				}
			}

			// Get cover images (up to 10)
			for (const coverSetting of coverSettings.slice(0, 10)) {
				const coverImageId = coverSetting.data().profileImageId;
				const matchingImage = imagesSnapshot.docs.find(
					(img) => img.id === coverImageId
				);

				if (matchingImage) {
					const imageData = matchingImage.data();
					coverImages.push({
						id: matchingImage.id,
						imageURL: imageData.imageURL,
						userId: imageData.userId,
						typeOfImage: imageData.typeOfImage,
						createdAt: imageData.createdAt?.toDate() || new Date(),
						updatedAt: imageData.updatedAt?.toDate() || new Date(),
					});
				}
			}

			// Also return all images for potential use
			const allImages = imagesSnapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					imageURL: data.imageURL,
					userId: data.userId,
					typeOfImage: data.typeOfImage,
					createdAt: data.createdAt?.toDate() || new Date(),
					updatedAt: data.updatedAt?.toDate() || new Date(),
				};
			});

			return { profileImage, coverImages, allImages };
		} catch (error) {
			throw new Error('Failed to fetch profile images');
		}
	}

	static async fetchFriendships(userId: string) {
		try {
			// Fetch friendships where user is userId1
			const friendships1Query = query(
				collection(db, 'friendship'),
				where('userId1', '==', userId),
				where('friendshipStatus', '==', 'accepted')
			);

			// Fetch friendships where user is userId2
			const friendships2Query = query(
				collection(db, 'friendship'),
				where('userId2', '==', userId),
				where('friendshipStatus', '==', 'accepted')
			);

			const [friendships1, friendships2] = await Promise.all([
				getDocs(friendships1Query),
				getDocs(friendships2Query),
			]);

			return {
				friendships1,
				friendships2,
				totalCount: friendships1.size + friendships2.size,
			};
		} catch (error) {
			throw new Error('Failed to fetch friendships');
		}
	}

	static async fetchUserPosts(userId: string) {
		try {
			const postsQuery = query(
				collection(db, 'feedPosts'),
				where('userId', '==', userId)
			);
			return await getDocs(postsQuery);
		} catch (error) {
			throw new Error('Failed to fetch user posts');
		}
	}

	static async fetchFollowing(userId: string) {
		try {
			const followingQuery = query(
				collection(db, 'followers'),
				where('followerId', '==', userId)
			);
			return await getDocs(followingQuery);
		} catch (error) {
			throw new Error('Failed to fetch following data');
		}
	}

	static async checkUserExists(
		email: string,
		username: string,
		contactNumber?: string
	): Promise<boolean> {
		const usersRef = collection(db, 'users');
		const contactRef = collection(db, 'contact');
		const queries = [];

		if (email) {
			queries.push(getDocs(query(usersRef, where('email', '==', email))));
		}

		if (username) {
			queries.push(getDocs(query(usersRef, where('userName', '==', username))));
		}

		if (contactNumber) {
			queries.push(
				getDocs(query(contactRef, where('contactNumber', '==', contactNumber)))
			);
		}

		const results = await Promise.all(queries);
		return results.some((snapshot) => !snapshot.empty);
	}

}

class EmailVerificationService {
	static async sendCustomVerification(
		user: User,
		userData: UserRegistrationData
	): Promise<void> {
		const verificationToken = crypto.randomUUID();
		const now = new Date();
		const expiresAt = new Date(now.getTime() + 30 * 60000); // 30 minutes

		// Create verification document
		await setDoc(doc(db, 'emailVerifications', user.uid), {
			userId: user.uid,
			email: user.email,
			verificationToken,
			createdAt: now,
			expiresAt,
			isVerified: false,
		});

		// Send verification email through API route
		const response = await fetch(`${window.location.origin}/api/register/verificationEmail`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				userName: userData.firstName,
				verificationToken,
				userId: user.uid,
				email: user.email,
				expiresIn: '30 minutes',
			}),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || 'Failed to send verification email');
		}

		// Set cleanup timeout for unverified accounts
		setTimeout(async () => {
			const docRef = doc(db, 'emailVerifications', user.uid);
			const docSnap = await getDoc(docRef);

			if (docSnap.exists() && !docSnap.data().isVerified) {
				await deleteDoc(docRef);
				await user.delete();
			}
		}, 30 * 60000);
	}

	static async verifyEmail(userId: string, token: string): Promise<boolean> {
		const verificationDoc = await getDoc(doc(db, 'emailVerifications', userId));
		if (!verificationDoc.exists()) return false;

		const data = verificationDoc.data() as EmailVerificationRecord;
		if (
			data.verificationToken !== token ||
			Timestamp.now().seconds > data.expiresAt.seconds
		)
			return false;

		// Updates emailVerified in users collection
		await Promise.all([
			updateDoc(doc(db, 'users', userId), {
				emailVerified: true,
			}),
			deleteDoc(doc(db, 'emailVerifications', userId)),
		]);

		return true;
	}

	static async checkEmailVerification(userId: string): Promise<boolean> {
		const userDoc = await getDoc(doc(db, 'users', userId));
		return userDoc.exists() && userDoc.data()?.emailVerified === true;
	}

	static async resendVerificationEmail(userId: string): Promise<void> {
		try {
			const response = await fetch(`${window.location.origin}/api/resend-verification`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ userId }),
			});

			const result = await response.json();
			
			if (!response.ok || !result.success) {
				throw new Error(result.error || 'Failed to resend verification email');
			}
		} catch (error) {
			console.error('Error resending verification email:', error);
			throw error;
		}
	}
}

export async function handleSignOut(router: AppRouterInstance) {
	try {
		await signOut(auth);
		// Clear any user-related local storage or state here if needed
		localStorage.removeItem('user');

		// Redirect to login page
		router.push('/login');
	} catch (error) {
		console.error('Sign out error:', error);
		// Optionally handle sign out error (show toast, etc.)
	}
}

export { AuthService, UserService, EmailVerificationService, RegisterService };
