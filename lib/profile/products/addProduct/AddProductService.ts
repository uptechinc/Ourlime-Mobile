import { db, storage } from '@/lib/firebaseConfig';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    ProductFormData,
    Colors,
    Sizes,
    ColorVariants,
    SizeVariants,
    ProductVariant
} from '@/types/productTypes';

interface UserTypeData {
    type: 'personal' | 'business';
    businessData?: any;
}

export class AddProductService {
    private static instance: AddProductService;
    private readonly db;
    private readonly storage;

    private constructor() {
        this.db = db;
        this.storage = storage;
    }

    public static getInstance(): AddProductService {
        if (!AddProductService.instance) {
            AddProductService.instance = new AddProductService();
        }
        return AddProductService.instance;
    }

    private async getUserType(userId: string): Promise<'personal' | 'business'> {
        try {
            console.log('Checking user type for userId:', userId);
            
            const userDoc = await getDoc(doc(this.db, 'users', userId));
            const userData = userDoc.data();
            console.log('User Data:', userData);
            console.log('Email Type:', userData?.emailType);
    
            if (userData?.emailType === 'business') {
                console.log('Business email detected, checking businesses collection...');
                
                const businessQuery = query(
                    collection(this.db, 'businesses'),
                    where('userId', '==', userId)
                );
                const businessSnapshot = await getDocs(businessQuery);
                console.log('Business documents found:', businessSnapshot.size);
                
                if (!businessSnapshot.empty) {
                    const businessData = businessSnapshot.docs[0].data();
                    console.log('Business data:', businessData);
                    console.log('Confirming business type');
                    return 'business';
                }
            }
            
            console.log('Setting type as personal');
            return 'personal';
        } catch (error) {
            console.error('Error in getUserType:', error);
            return 'personal';
        }
    }
    
    private async createOwnership(productId: string, userId: string, userType: 'personal' | 'business') {
        console.log('Creating ownership with type:', userType);
        const ownershipData = {
            productId,
            userId,
            sellerType: userType,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
    
        if (userType === 'business') {
            console.log('Creating business ownership');
            return addDoc(collection(this.db, 'ownership'), {
                ...ownershipData,
                businessProfile: {
                    rating: {
                        overall: 0,
                        product: 0,
                        service: 0,
                        delivery: 0
                    },
                    reviews: {
                        total: 0,
                        positive: 0,
                        negative: 0
                    },
                    feedback: {
                        satisfaction: 0,
                        responseTime: 0,
                        resolution: 0
                    }
                }
            });
        }
    
        console.log('Creating personal ownership');
        return addDoc(collection(this.db, 'ownership'), ownershipData);
    }
    
    public async createProduct(data: {
        userId: string;
        thumbnailImage: File;
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
        contactInfo?: {
            type: 'phone' | 'email' | 'website';
            value: string;
        }[];
    }) {
        try {
            const { userId, thumbnailImage, media, ...productData } = data;
            const userType = await this.getUserType(userId);

            // Upload thumbnail image
            const thumbnailRef = ref(this.storage, `products/${userId}/thumbnails/${thumbnailImage.name}`);
            const thumbnailSnapshot = await uploadBytes(thumbnailRef, thumbnailImage);
            const thumbnailUrl = await getDownloadURL(thumbnailSnapshot.ref);

            // Create main product
            const productRef = await addDoc(collection(this.db, 'products'), {
                title: productData.title,
                category: productData.category,
                shortDescription: productData.shortDescription,
                longDescription: productData.longDescription,
                thumbnailImage: thumbnailUrl,
                contactInfo: productData.contactInfo || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Handle base colors
            const colorMap = new Map();
            if (productData.newColors?.length > 0) {
                for (const color of productData.newColors) {
                    const colorQuery = query(
                        collection(this.db, 'colors'),
                        where('colorName', '==', color.colorName.toLowerCase())
                    );
                    const colorSnapshot = await getDocs(colorQuery);

                    if (colorSnapshot.empty) {
                        const newColorRef = await addDoc(collection(this.db, 'colors'), {
                            colorName: color.colorName.toLowerCase()
                        });
                        colorMap.set(color.colorName.toLowerCase(), newColorRef.id);
                    } else {
                        colorMap.set(color.colorName.toLowerCase(), colorSnapshot.docs[0].id);
                    }
                }
            }

            // Handle base sizes
            const sizeMap = new Map();
            if (productData.newSizes?.length > 0) {
                for (const size of productData.newSizes) {
                    const sizeQuery = query(
                        collection(this.db, 'sizes'),
                        where('sizeName', '==', size.sizeName.toLowerCase())
                    );
                    const sizeSnapshot = await getDocs(sizeQuery);

                    if (sizeSnapshot.empty) {
                        const newSizeRef = await addDoc(collection(this.db, 'sizes'), {
                            sizeName: size.sizeName.toLowerCase()
                        });
                        sizeMap.set(size.sizeName.toLowerCase(), newSizeRef.id);
                    } else {
                        sizeMap.set(size.sizeName.toLowerCase(), sizeSnapshot.docs[0].id);
                    }
                }
            }

            // Add color variants
            const colorVariantRefs = [];
            if (productData.colors?.length > 0) {
                for (const colorVariant of productData.colors) {
                    const colorVariantRef = await addDoc(collection(this.db, 'colorVariants'), {
                        colorVariantName: colorVariant.colorVariantName,
                        productId: productRef.id,
                        colorId: colorVariant.colorId
                    });
                    colorVariantRefs.push({ id: colorVariantRef.id, originalId: colorVariant.id });
                }
            }

            // Add size variants
            const sizeVariantRefs = [];
            if (productData.sizes?.length > 0) {
                for (const sizeVariant of productData.sizes) {
                    const sizeVariantRef = await addDoc(collection(this.db, 'sizeVariants'), {
                        sizeVariantName: sizeVariant.sizeVariantName,
                        productId: productRef.id,
                        sizeId: sizeVariant.sizeId
                    });
                    sizeVariantRefs.push({ id: sizeVariantRef.id, originalId: sizeVariant.id });
                }
            }

            // Handle media uploads
            if (media?.length > 0) {
                const mediaPromises = media.map(async (file) => {
                    const imageRef = ref(this.storage, `products/${userId}/images/${file.name}`);
                    const snapshot = await uploadBytes(imageRef, file);
                    const imageUrl = await getDownloadURL(snapshot.ref);
                    return addDoc(collection(this.db, 'subImages'), {
                        imageName: imageUrl,
                        productId: productRef.id
                    });
                });
                await Promise.all(mediaPromises);
            }

            // Add variants
            if (productData.variants?.length > 0) {
                const variantPromises = productData.variants.map(variant => {
                    const colorVariantRef = colorVariantRefs.find(ref => ref.originalId === variant.colorVariantId);
                    const sizeVariantRef = sizeVariantRefs.find(ref => ref.originalId === variant.sizeVariantId);

                    return addDoc(collection(this.db, 'variants'), {
                        productId: productRef.id,
                        colorVariantId: colorVariantRef?.id || '',
                        sizeVariantId: sizeVariantRef?.id || '',
                        price: variant.price,
                        quantity: variant.quantity,
                        status: variant.status
                    });
                });

                await Promise.all(variantPromises);
            }

            // Create ownership record
            await this.createOwnership(productRef.id, userId, userType);

            return {
                success: true,
                productId: productRef.id
            };

        } catch (error) {
            console.error('Error in createProduct:', error);
            throw new Error('Failed to create product');
        }
    }
}
