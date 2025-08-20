import { db } from '@/lib/firebaseConfig';
import {
	collection,
	query,
	where,
	getDocs,
	addDoc,
	deleteDoc,
	doc,
	Timestamp,
	updateDoc,
	orderBy,
	getDoc,
	limit,
	writeBatch,
} from 'firebase/firestore';

// Define proper types
interface Album {
	id: string;
	name: string;
	description?: string;
	coverImageId?: string;
	userId: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
	privacy: 'public' | 'private' | 'friends';
}

interface AlbumImage {
	id: string;
	albumId: string;
	imageId: string;
	imageType: string; // 'profile', 'gallery', or 'video'
	mediaType: 'image' | 'video';
	addedAt: Timestamp;
	order: number;
}

interface GalleryImage {
	id: string;
	imageURL?: string;
	videoURL?: string;
	mediaURL?: string; // Generic URL field for either image or video
	displayURL?: string; // URL to display (thumbnail for videos, image for images)
	userId: string;
	typeOfImage: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
	mediaType: 'image' | 'video'; // Added to distinguish between images and videos
	thumbnailURL?: string; // For videos, a thumbnail image
	duration?: number; // For videos, duration in seconds
	fileName?: string; // Original file name
}

export class GalleryService {
	private static instance: GalleryService;
	private readonly db;

	private constructor() {
		this.db = db;
	}

	public static getInstance(): GalleryService {
		if (!GalleryService.instance) {
			GalleryService.instance = new GalleryService();
		}
		return GalleryService.instance;
	}

	// Get all media for a user (including profile images, gallery images, and videos)
	async getUserMedia(userId: string): Promise<GalleryImage[]> {
		console.log('GalleryService: Fetching media for user', userId);

		try {
			// First query: Get documents with createdAt field
			const withCreatedAtQuery = query(
				collection(this.db, 'profileImages'),
				where('userId', '==', userId),
				orderBy('createdAt', 'desc')
			);

			const withCreatedAtSnapshot = await getDocs(withCreatedAtQuery);
			console.log(
				'GalleryService: Found',
				withCreatedAtSnapshot.docs.length,
				'media items with createdAt'
			);

			// Second query: Get documents without using orderBy (to catch those without createdAt)
			const allUserMediaQuery = query(
				collection(this.db, 'profileImages'),
				where('userId', '==', userId)
			);

			const allUserMediaSnapshot = await getDocs(allUserMediaQuery);
			console.log(
				'GalleryService: Found',
				allUserMediaSnapshot.docs.length,
				'total media items for user'
			);

			// Combine results, removing duplicates
			const allDocs = [...withCreatedAtSnapshot.docs];
			const existingIds = new Set(allDocs.map((doc) => doc.id));

			allUserMediaSnapshot.docs.forEach((doc) => {
				if (!existingIds.has(doc.id)) {
					allDocs.push(doc);
					existingIds.add(doc.id);
				}
			});

			console.log(
				'GalleryService: Combined total:',
				allDocs.length,
				'unique media items'
			);

			// Process all media items
			return allDocs.map((doc) => {
				const data = doc.data();
				const isVideo = data.mediaType === 'video';

				// Use uploadedAt as fallback for createdAt
				const timestamp = data.createdAt || data.uploadedAt || Timestamp.now();

				// Create a consistent media object with all necessary fields
				return {
					id: doc.id,
					imageURL: !isVideo ? data.imageURL : undefined,
					videoURL: isVideo ? data.videoURL : undefined,
					mediaURL: data.mediaURL || (isVideo ? data.videoURL : data.imageURL),
					displayURL:
						data.displayURL ||
						(isVideo ? data.thumbnailURL || data.videoURL : data.imageURL),
					userId: data.userId,
					typeOfImage: data.typeOfImage || 'gallery',
					createdAt: timestamp,
					updatedAt: data.updatedAt || timestamp,
					mediaType: data.mediaType || 'image',
					thumbnailURL: data.thumbnailURL,
					duration: data.duration,
					fileName: data.fileName || `media_${doc.id}`,
					width: data.width,
					height: data.height,
					fileSize: data.fileSize,
					mimeType: data.mimeType,
				} as GalleryImage;
			});
		} catch (error) {
			console.error('Error in getUserMedia:', error);
			throw error;
		}
	}

	// Add a new media item (image or video)
	async addMediaItem(mediaData: {
		userId: string;
		imageURL?: string;
		videoURL?: string;
		thumbnailURL?: string;
		typeOfImage: string;
		fileName?: string;
		mediaType: 'image' | 'video';
		duration?: number;
		width?: number;
		height?: number;
		fileSize?: number;
		mimeType?: string;
		mediaURL?: string;
		displayURL?: string;
	}): Promise<string> {
		console.log(
			`GalleryService: Adding ${mediaData.mediaType} for user`,
			mediaData.userId
		);
	
		// Create a data object with all possible fields
		const data: any = {
			...mediaData,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
		};
	
		// For videos, ensure we have a thumbnailURL
		if (mediaData.mediaType === 'video' && !data.thumbnailURL && data.videoURL) {
			// Instead of using a placeholder that might not exist,
			// we'll use the video URL itself as the thumbnail
			console.log('No thumbnail provided for video, using video URL as thumbnail');
			data.thumbnailURL = data.videoURL;
		}
	
		// Add mediaURL field for consistency
		if (mediaData.mediaType === 'video' && data.videoURL) {
			data.mediaURL = data.videoURL;
		} else if (data.imageURL) {
			data.mediaURL = data.imageURL;
		}
	
		// Add displayURL field for consistency
		if (mediaData.mediaType === 'video') {
			data.displayURL = data.thumbnailURL || data.videoURL;
		} else {
			data.displayURL = data.imageURL;
		}
	
		// Store in profileImages collection
		const mediaRef = await addDoc(collection(this.db, 'profileImages'), data);
		console.log(
			`GalleryService: Added ${mediaData.mediaType} with ID`,
			mediaRef.id
		);
	
		return mediaRef.id;
	}
	

	// Delete a media item (image or video)
	async deleteMediaItem(
		mediaId: string,
		mediaType: string = 'gallery',
		forceDelete: boolean = false
	): Promise<void> {
		console.log(
			`GalleryService: Deleting media item ${mediaId}${forceDelete ? ' (forced)' : ''}`
		);

		// Check if media is used in albums if not force deleting
		if (!forceDelete) {
			const usageInfo = await this.checkMediaUsage(mediaId);
			if (usageInfo.inAlbums) {
				throw new Error(
					`Media is used in ${usageInfo.albumIds.length} albums. Use force=true to delete anyway.`
				);
			}
		} else {
			console.log(
				`GalleryService: Force delete enabled, bypassing album usage check for ${mediaId}`
			);
		}

		// First, remove this media from all albums
		const albumImagesQuery = query(
			collection(this.db, 'albumImages'),
			where('imageId', '==', mediaId)
		);

		const albumImagesSnapshot = await getDocs(albumImagesQuery);

		// Delete all album associations
		await Promise.all(
			albumImagesSnapshot.docs.map((doc) => deleteDoc(doc.ref))
		);
		console.log(
			`GalleryService: Removed media from ${albumImagesSnapshot.docs.length} albums`
		);

		// Delete the media item from profileImages
		try {
			await deleteDoc(doc(this.db, 'profileImages', mediaId));
			console.log(
				`GalleryService: Deleted media item ${mediaId} from profileImages`
			);
		} catch (error) {
			console.error(`Error deleting from profileImages:`, error);
			throw new Error(`Failed to delete media item ${mediaId}`);
		}
	}

	// Get all albums for a user
	async getUserAlbums(userId: string): Promise<Album[]> {
		console.log('GalleryService: Fetching albums for user', userId);

		const albumsQuery = query(
			collection(this.db, 'albums'),
			where('userId', '==', userId),
			orderBy('updatedAt', 'desc')
		);

		const snapshot = await getDocs(albumsQuery);
		console.log('GalleryService: Found', snapshot.docs.length, 'albums');

		const albums = snapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
		})) as Album[];

		// Get cover images and count for each album
		return Promise.all(
			albums.map(async (album) => {
				// Get image count
				const countQuery = query(
					collection(this.db, 'albumImages'),
					where('albumId', '==', album.id)
				);
				const countSnapshot = await getDocs(countQuery);
				const imageCount = countSnapshot.size;

				// Get cover image if specified
				if (album.coverImageId) {
					try {
						const imageDocRef = doc(
							this.db,
							'profileImages',
							album.coverImageId
						);
						const imageSnapshot = await getDoc(imageDocRef);

						if (imageSnapshot.exists()) {
							const imageData = imageSnapshot.data();
							return {
								...album,
								coverImage:
									imageData.mediaType === 'video'
										? imageData.thumbnailURL || imageData.videoURL
										: imageData.imageURL,
								imageCount,
							};
						}
					} catch (error) {
						console.error('Error fetching cover image:', error);
					}
				}

				// If no cover image or error, try to get the first image in the album
				if (!album.coverImageId && imageCount > 0) {
					try {
						const firstImageQuery = query(
							collection(this.db, 'albumImages'),
							where('albumId', '==', album.id),
							orderBy('order'),
							limit(1)
						);

						const firstImageSnapshot = await getDocs(firstImageQuery);

						if (!firstImageSnapshot.empty) {
							const firstAlbumImage = firstImageSnapshot.docs[0].data();
							const mediaSnapshot = await getDoc(
								doc(this.db, 'profileImages', firstAlbumImage.imageId)
							);

							if (mediaSnapshot.exists()) {
								const mediaData = mediaSnapshot.data();
								return {
									...album,
									coverImage:
										mediaData.mediaType === 'video'
											? mediaData.thumbnailURL || mediaData.videoURL
											: mediaData.imageURL,
									imageCount,
								};
							}
						}
					} catch (error) {
						console.error('Error fetching first album image:', error);
					}
				}

				return {
					...album,
					imageCount,
				};
			})
		);
	}

	// Create a new album
	async createAlbum(
		userId: string,
		albumData: {
			name: string;
			description?: string;
			coverImageId?: string;
			privacy?: 'public' | 'private' | 'friends';
		}
	): Promise<string> {
		console.log('GalleryService: Creating album for user', userId);

		const albumRef = await addDoc(collection(this.db, 'albums'), {
			...albumData,
			userId,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
			privacy: albumData.privacy || 'public', // Default privacy setting
		});

		console.log('GalleryService: Created album with ID', albumRef.id);
		return albumRef.id;
	}

	// Update album details
	async updateAlbum(
		albumId: string,
		data: Partial<{
			name: string;
			description: string;
			coverImageId: string;
			privacy: 'public' | 'private' | 'friends';
		}>
	): Promise<void> {
		console.log('GalleryService: Updating album', albumId);

		const albumRef = doc(this.db, 'albums', albumId);
		await updateDoc(albumRef, {
			...data,
			updatedAt: Timestamp.now(),
		});

		console.log('GalleryService: Updated album', albumId);
	}

	// Delete an album
	async deleteAlbum(albumId: string): Promise<void> {
		console.log('GalleryService: Deleting album', albumId);

		// First delete all album-image associations
		const albumImagesQuery = query(
			collection(this.db, 'albumImages'),
			where('albumId', '==', albumId)
		);
		const snapshot = await getDocs(albumImagesQuery);

		console.log(
			'GalleryService: Deleting',
			snapshot.docs.length,
			'album media associations'
		);

		await Promise.all(snapshot.docs.map((doc) => deleteDoc(doc.ref)));

		// Then delete the album itself
		await deleteDoc(doc(this.db, 'albums', albumId));
		console.log('GalleryService: Deleted album', albumId);
	}

	// Add media items to an album
	async addMediaToAlbum(
		albumId: string,
		mediaIds: string[]
	): Promise<string[]> {
		console.log(
			'GalleryService: Adding',
			mediaIds.length,
			'media items to album',
			albumId
		);

		// Get current highest order
		const orderQuery = query(
			collection(this.db, 'albumImages'),
			where('albumId', '==', albumId)
		);

		const orderSnapshot = await getDocs(orderQuery);
		let nextOrder = 1;

		if (!orderSnapshot.empty) {
			// Find the highest order
			let maxOrder = 0;
			orderSnapshot.docs.forEach((doc) => {
				const data = doc.data();
				if (data.order && data.order > maxOrder) {
					maxOrder = data.order;
				}
			});
			nextOrder = maxOrder + 1;
		}

		// Add each media item
		const results = await Promise.all(
			mediaIds.map(async (mediaId, index) => {
				// Check if already exists
				const existingQuery = query(
					collection(this.db, 'albumImages'),
					where('albumId', '==', albumId),
					where('imageId', '==', mediaId)
				);
				const existingSnapshot = await getDocs(existingQuery);

				if (existingSnapshot.empty) {
					// Determine media type by checking in profileImages collection
					let mediaType = 'image';
					let imageType = 'gallery';

					// Check profileImages
					const mediaRef = doc(this.db, 'profileImages', mediaId);
					const mediaSnapshot = await getDoc(mediaRef);

					if (mediaSnapshot.exists()) {
						const data = mediaSnapshot.data();
						mediaType = data.mediaType || 'image';
						imageType = data.typeOfImage || 'gallery';
					} else {
						console.warn(
							`Media item ${mediaId} not found in profileImages collection`
						);
					}

					const albumImageRef = await addDoc(
						collection(this.db, 'albumImages'),
						{
							albumId,
							imageId: mediaId,
							imageType,
							mediaType,
							addedAt: Timestamp.now(),
							order: nextOrder + index,
						}
					);

					// If this is the first image and album has no cover, set it as cover
					const albumRef = doc(this.db, 'albums', albumId);
					const albumSnapshot = await getDoc(albumRef);

					if (albumSnapshot.exists()) {
						const albumData = albumSnapshot.data();
						if (!albumData.coverImageId && index === 0) {
							await updateDoc(albumRef, {
								coverImageId: mediaId,
								updatedAt: Timestamp.now(),
							});
						}
					}

					return albumImageRef.id;
				}
				return existingSnapshot.docs[0].id;
			})
		);

		console.log('GalleryService: Added media to album', albumId);
		return results;
	}

	// Remove media items from an album
	async removeMediaFromAlbum(
		albumId: string,
		relationshipIds: string[]
	): Promise<void> {
		console.log(
			'GalleryService: Removing',
			relationshipIds.length,
			'media items from album',
			albumId
		);

		try {
			let deletedCount = 0;
			let removedImageIds = [];

			// Delete the album-image relationships directly by their document IDs
			for (const relationshipId of relationshipIds) {
				try {
					// Get the relationship document first to extract the imageId
					const relationshipRef = doc(this.db, 'albumImages', relationshipId);
					const relationshipSnap = await getDoc(relationshipRef);

					if (relationshipSnap.exists()) {
						const data = relationshipSnap.data();
						// Verify this relationship belongs to the correct album
						if (data.albumId === albumId) {
							// Store the imageId for cover image check later
							removedImageIds.push(data.imageId);
							// Delete the relationship
							await deleteDoc(relationshipRef);
							deletedCount++;
							console.log(
								`Deleted album-image relationship: ${relationshipId}`
							);
						} else {
							console.log(
								`Relationship ${relationshipId} does not belong to album ${albumId}`
							);
						}
					} else {
						console.log(`Relationship ${relationshipId} not found`);
					}
				} catch (err) {
					console.error(`Error deleting relationship ${relationshipId}:`, err);
				}
			}

			// Check if the album's cover image was removed
			if (deletedCount > 0) {
				const albumRef = doc(this.db, 'albums', albumId);
				const albumSnapshot = await getDoc(albumRef);

				if (albumSnapshot.exists()) {
					const albumData = albumSnapshot.data();

					if (
						albumData.coverImageId &&
						removedImageIds.includes(albumData.coverImageId)
					) {
						console.log('Cover image was removed, finding a new one');

						// Cover image was removed, find a new one
						const remainingImagesQuery = query(
							collection(this.db, 'albumImages'),
							where('albumId', '==', albumId),
							orderBy('order'),
							limit(1)
						);

						const remainingSnapshot = await getDocs(remainingImagesQuery);

						if (!remainingSnapshot.empty) {
							// Set the first remaining image as cover
							const newCoverImageId = remainingSnapshot.docs[0].data().imageId;
							await updateDoc(albumRef, {
								coverImageId: newCoverImageId,
								updatedAt: Timestamp.now(),
							});
							console.log(`Set new cover image: ${newCoverImageId}`);
						} else {
							// No images left, remove cover image
							await updateDoc(albumRef, {
								coverImageId: null,
								updatedAt: Timestamp.now(),
							});
							console.log('No images left, removed cover image');
						}
					}
				}
			}

			console.log(
				`GalleryService: Removed ${deletedCount} media items from album ${albumId}`
			);
		} catch (error) {
			console.error('Error removing media from album:', error);
			throw new Error(`Failed to remove media from album: ${error.message}`);
		}
	}

	// Get media items in an album
	async getAlbumMedia(albumId: string): Promise<any[]> {
		console.log('GalleryService: Fetching media for album', albumId);

		const albumImagesQuery = query(
			collection(this.db, 'albumImages'),
			where('albumId', '==', albumId),
			orderBy('order')
		);

		const snapshot = await getDocs(albumImagesQuery);
		console.log(
			'GalleryService: Found',
			snapshot.docs.length,
			'album media associations'
		);

		const albumImages = snapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
		})) as AlbumImage[];

		// Get actual media data
		const mediaData = await Promise.all(
			albumImages.map(async (albumImage) => {
				try {
					const mediaDocRef = doc(this.db, 'profileImages', albumImage.imageId);
					const mediaSnapshot = await getDoc(mediaDocRef);

					if (mediaSnapshot.exists()) {
						const data = mediaSnapshot.data();
						const isVideo = data.mediaType === 'video';

						return {
							...albumImage,
							imageData: {
								id: albumImage.imageId,
								...data,
								// Ensure consistent URL fields for both images and videos
								mediaURL: isVideo ? data.videoURL : data.imageURL,
								displayURL: isVideo
									? data.thumbnailURL || data.videoURL
									: data.imageURL,
							},
						};
					}

					console.warn(
						`Media item ${albumImage.imageId} not found in profileImages collection`
					);
					return null;
				} catch (error) {
					console.error('Error fetching media:', error);
					return null;
				}
			})
		);

		// Filter out any null results
		return mediaData.filter((item) => item !== null);
	}

	// Reorder media items in an album
	async reorderAlbumMedia(
		albumId: string,
		orderedMediaIds: string[]
	): Promise<void> {
		console.log('GalleryService: Reordering media in album', albumId);

		// Get all album images
		const albumImagesQuery = query(
			collection(this.db, 'albumImages'),
			where('albumId', '==', albumId)
		);

		const snapshot = await getDocs(albumImagesQuery);
		const albumImages = snapshot.docs.map((doc) => ({
			docRef: doc.ref,
			id: doc.id,
			imageId: doc.data().imageId,
		}));

		// Update order for each media item
		await Promise.all(
			orderedMediaIds.map(async (mediaId, index) => {
				const albumImage = albumImages.find((item) => item.imageId === mediaId);
				if (albumImage) {
					await updateDoc(albumImage.docRef, { order: index + 1 });
				}
			})
		);
		console.log('GalleryService: Reordered media in album', albumId);
	}

	// Set album cover image
	async setAlbumCover(albumId: string, imageId: string): Promise<void> {
		try {
			console.log(
				`GalleryService: Setting cover image ${imageId} for album ${albumId}`
			);

			// Update the album document with the new cover image
			const albumRef = doc(this.db, 'albums', albumId);
			await updateDoc(albumRef, {
				coverImageId: imageId,
				updatedAt: Timestamp.now(),
			});

			console.log(`GalleryService: Set cover image for album ${albumId}`);
		} catch (error) {
			console.error('Error setting album cover:', error);
			throw new Error(`Failed to set album cover: ${error.message}`);
		}
	}

	// Get media item details
	async getMediaDetails(
		mediaId: string,
		mediaType: string = 'gallery'
	): Promise<GalleryImage | null> {
		console.log('GalleryService: Getting details for media', mediaId);

		try {
			const mediaRef = doc(this.db, 'profileImages', mediaId);
			const mediaSnapshot = await getDoc(mediaRef);

			if (mediaSnapshot.exists()) {
				const data = mediaSnapshot.data();
				const isVideo = data.mediaType === 'video';

				return {
					id: mediaId,
					...data,
					// Ensure consistent URL fields
					mediaURL: isVideo ? data.videoURL : data.imageURL,
					displayURL: isVideo
						? data.thumbnailURL || data.videoURL
						: data.imageURL,
				} as GalleryImage;
			}

			return null;
		} catch (error) {
			console.error('Error getting media details:', error);
			return null;
		}
	}

	// Check if media is used in any albums
	async checkMediaUsage(
		mediaId: string
	): Promise<{ inAlbums: boolean; albumIds: string[]; albumNames: string[] }> {
		console.log('GalleryService: Checking usage for media', mediaId);

		const albumImagesQuery = query(
			collection(this.db, 'albumImages'),
			where('imageId', '==', mediaId)
		);

		const snapshot = await getDocs(albumImagesQuery);

		if (snapshot.empty) {
			return {
				inAlbums: false,
				albumIds: [],
				albumNames: [],
			};
		}

		// Get album IDs
		const albumIds = snapshot.docs.map((doc) => doc.data().albumId);

		// Get album names
		const albumNames = await Promise.all(
			albumIds.map(async (albumId) => {
				const albumRef = doc(this.db, 'albums', albumId);
				const albumSnapshot = await getDoc(albumRef);

				if (albumSnapshot.exists()) {
					return albumSnapshot.data().name;
				}
				return 'Unknown Album';
			})
		);

		return {
			inAlbums: true,
			albumIds,
			albumNames,
		};
	}

	// Batch check media usage in albums
	async batchCheckMediaUsage(mediaIds: string[]): Promise<{
		[mediaId: string]: {
			isUsed: boolean;
			albumIds: string[];
			albumDetails: { albumId: string; albumName: string }[];
		};
	}> {
		console.log(
			'GalleryService: Batch checking usage for',
			mediaIds.length,
			'media items'
		);

		// Create a map to track albums for each media item
		const mediaUsageMap: {
			[mediaId: string]: {
				isUsed: boolean;
				albumIds: string[];
				albumDetails: { albumId: string; albumName: string }[];
			};
		} = {};

		// Initialize all media IDs with empty arrays
		mediaIds.forEach((id) => {
			mediaUsageMap[id] = {
				isUsed: false,
				albumIds: [],
				albumDetails: [],
			};
		});

		// Check each media item
		for (const mediaId of mediaIds) {
			const albumImagesQuery = query(
				collection(this.db, 'albumImages'),
				where('imageId', '==', mediaId)
			);

			const snapshot = await getDocs(albumImagesQuery);

			// Add all album IDs to the media's array
			if (!snapshot.empty) {
				const albumIds = snapshot.docs.map((doc) => doc.data().albumId);
				mediaUsageMap[mediaId].albumIds = albumIds;
				mediaUsageMap[mediaId].isUsed = albumIds.length > 0;

				// Get album names
				const albumDetails = await Promise.all(
					albumIds.map(async (albumId) => {
						const albumRef = doc(this.db, 'albums', albumId);
						const albumSnapshot = await getDoc(albumRef);

						if (albumSnapshot.exists()) {
							return {
								albumId,
								albumName: albumSnapshot.data().name,
							};
						}
						return {
							albumId,
							albumName: 'Unknown Album',
						};
					})
				);

				mediaUsageMap[mediaId].albumDetails = albumDetails;
			}
		}

		return mediaUsageMap;
	}
}

export const galleryService = GalleryService.getInstance();
