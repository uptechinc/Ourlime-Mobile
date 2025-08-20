import { db, storage } from '@/lib/firebaseConfig';
import {
    collection,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    getDocs,
    query,
    where,
    addDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
    ProductFormData,
    Colors,
    Sizes,
    ColorVariants,
    SizeVariants,
    ProductVariant,
    ContactInfoItem
} from '@/types/productTypes';

export class UpdateProductService {
    private static instance: UpdateProductService;
    private readonly db;
    private readonly storage;

    private constructor() {
        this.db = db;
        this.storage = storage;
    }

    public static getInstance(): UpdateProductService {
        if (!UpdateProductService.instance) {
            UpdateProductService.instance = new UpdateProductService();
        }
        return UpdateProductService.instance;
    }

    public async getProduct(productId: string) {
        try {
            // Get the base product data
            const productDoc = await getDoc(doc(this.db, 'products', productId));
            if (!productDoc.exists()) {
                throw new Error('Product not found');
            }
            
            const productData = productDoc.data();
            
            // Get color variants
            const colorVariantsQuery = query(
                collection(this.db, 'colorVariants'),
                where('productId', '==', productId)
            );
            const colorVariantsSnapshot = await getDocs(colorVariantsQuery);
            const colorVariants = colorVariantsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Get size variants
            const sizeVariantsQuery = query(
                collection(this.db, 'sizeVariants'),
                where('productId', '==', productId)
            );
            const sizeVariantsSnapshot = await getDocs(sizeVariantsQuery);
            const sizeVariants = sizeVariantsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Get product variants (price, quantity, etc.)
            const variantsQuery = query(
                collection(this.db, 'variants'),
                where('productId', '==', productId)
            );
            const variantsSnapshot = await getDocs(variantsQuery);
            const variants = variantsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Get additional images
            const subImagesQuery = query(
                collection(this.db, 'subImages'),
                where('productId', '==', productId)
            );
            const subImagesSnapshot = await getDocs(subImagesQuery);
            const subImages = subImagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Get ownership data
            const ownershipQuery = query(
                collection(this.db, 'ownership'),
                where('productId', '==', productId)
            );
            const ownershipSnapshot = await getDocs(ownershipQuery);
            const ownership = ownershipSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            return {
                success: true,
                product: {
                    id: productDoc.id,
                    ...productData,
                    colorVariants,
                    sizeVariants,
                    variants,
                    subImages,
                    ownership: ownership[0]
                }
            };
        } catch (error) {
            console.error('Error fetching product:', error);
            return { success: false, error: 'Failed to fetch product data' };
        }
    }

    public async updateProduct(productId: string, data: {
        userId: string;
        thumbnailImage?: File;
        newThumbnail: boolean;
        media: File[];
        title: string;
        category: string;
        shortDescription: string;
        longDescription: string;
        variants: ProductVariant[];
        colors: ColorVariants[];
        sizes: SizeVariants[];
        newColors: any[];
        newSizes: any[];
        contactInfo?: ContactInfoItem[];
        deletedImages?: string[];
    }) {
        try {
            const { userId, thumbnailImage, media, newThumbnail, deletedImages, ...productData } = data;
            
            // Update the main product document
            const productRef = doc(this.db, 'products', productId);
            
            // Base update object
            const updateData: any = {
                title: productData.title,
                category: productData.category,
                shortDescription: productData.shortDescription,
                longDescription: productData.longDescription,
                contactInfo: productData.contactInfo || null,
                updatedAt: serverTimestamp()
            };
            
            // Handle thumbnail image upload if provided
            if (thumbnailImage && newThumbnail) {
                // Get the current thumbnail URL to delete later
                const productDoc = await getDoc(productRef);
                const oldThumbnailUrl = productDoc.data()?.thumbnailImage;
                
                // Upload new thumbnail
                const thumbnailRef = ref(this.storage, `products/${userId}/thumbnails/${thumbnailImage.name}`);
                const thumbnailSnapshot = await uploadBytes(thumbnailRef, thumbnailImage);
                updateData.thumbnailImage = await getDownloadURL(thumbnailSnapshot.ref);
                
                // Try to delete the old thumbnail if it exists
                if (oldThumbnailUrl) {
                    try {
                        const oldThumbRef = ref(this.storage, oldThumbnailUrl);
                        await deleteObject(oldThumbRef);
                    } catch (error) {
                        console.warn('Could not delete old thumbnail:', error);
                    }
                }
            }
            
            // Update the main product document
            await updateDoc(productRef, updateData);
            
            // Delete specified images
            if (deletedImages && deletedImages.length > 0) {
                for (const imageId of deletedImages) {
                    // Get the image document
                    const imageDoc = await getDoc(doc(this.db, 'subImages', imageId));
                    if (imageDoc.exists()) {
                        const imageUrl = imageDoc.data().imageName;
                        
                        // Delete from storage
                        try {
                            const imageRef = ref(this.storage, imageUrl);
                            await deleteObject(imageRef);
                        } catch (error) {
                            console.warn('Could not delete image from storage:', error);
                        }
                        
                        // Delete the document
                        await deleteDoc(doc(this.db, 'subImages', imageId));
                    }
                }
            }
            
            // Upload new media files
            if (media && media.length > 0) {
                const mediaPromises = media.map(async (file) => {
                    const imageRef = ref(this.storage, `products/${userId}/images/${file.name}`);
                    const snapshot = await uploadBytes(imageRef, file);
                    const imageUrl = await getDownloadURL(snapshot.ref);
                    return addDoc(collection(this.db, 'subImages'), {
                        imageName: imageUrl,
                        productId: productId
                    });
                });
                await Promise.all(mediaPromises);
            }
            
            // Update variants, sizes, and colors if needed
            // (This would be more complex and require comparing existing vs. new data)
            
            return {
                success: true,
                productId
            };
        } catch (error) {
            console.error('Error updating product:', error);
            throw new Error('Failed to update product');
        }
    }
    
    public async deleteProduct(productId: string, userId: string) {
        try {
            // Get all the product data first
            const productResult = await this.getProduct(productId);
            if (!productResult.success) {
                throw new Error('Failed to fetch product for deletion');
            }
            
            // Use type assertion for the entire product object to handle its properties safely
            const product = productResult.product as any;
            
            // Verify the user is the owner with proper type checking
            // First make sure ownership exists
            if (!product.ownership) {
                throw new Error('Ownership information is missing for this product');
            }
            
            // Explicitly check for userId with type safety
            const ownerData = product.ownership as any; // Use type assertion to handle the structure
            if (ownerData.userId !== userId) {
                throw new Error('You do not have permission to delete this product');
            }
            
            // Delete all sub-images
            if (product.subImages && Array.isArray(product.subImages)) {
                for (const image of product.subImages) {
                    // Delete from storage
                    try {
                        if (image.imageName) {
                            const imageRef = ref(this.storage, image.imageName);
                            await deleteObject(imageRef);
                        }
                    } catch (error) {
                        console.warn('Could not delete sub-image from storage:', error);
                    }
                    
                    // Delete the document
                    await deleteDoc(doc(this.db, 'subImages', image.id));
                }
            }
            
            // Delete thumbnail image from storage
            if (product.thumbnailImage) {
                try {
                    const thumbnailRef = ref(this.storage, product.thumbnailImage);
                    await deleteObject(thumbnailRef);
                } catch (error) {
                    console.warn('Could not delete thumbnail from storage:', error);
                }
            }
            
            // Delete variants
            if (product.variants && Array.isArray(product.variants)) {
                for (const variant of product.variants) {
                    await deleteDoc(doc(this.db, 'variants', variant.id));
                }
            }
            
            // Delete color variants
            if (product.colorVariants && Array.isArray(product.colorVariants)) {
                for (const colorVariant of product.colorVariants) {
                    await deleteDoc(doc(this.db, 'colorVariants', colorVariant.id));
                }
            }
            
            // Delete size variants
            if (product.sizeVariants && Array.isArray(product.sizeVariants)) {
                for (const sizeVariant of product.sizeVariants) {
                    await deleteDoc(doc(this.db, 'sizeVariants', sizeVariant.id));
                }
            }
            
            // Delete ownership
            await deleteDoc(doc(this.db, 'ownership', ownerData.id));
            
            // Finally, delete the product document
            await deleteDoc(doc(this.db, 'products', productId));
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting product:', error);
            return { success: false, error: error.message };
        }
    }
} 