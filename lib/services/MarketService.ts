import { db } from '@/lib/firebaseConfig';
import { collection, getDocs, query, where, Firestore, getDoc, doc, documentId } from 'firebase/firestore';
import {
    Product,
    Colors,
    Sizes,
    ColorVariants,
    SizeVariants,
    ProductVariant,
} from '@/types/productTypes';

interface BusinessData {
    profile: {
        name: string;
        established: string;
        description: string;
        location: string;
        contact: {
            email: string;
            phone: string;
            website: string;
        };
    };
    metrics: {
        totalProducts: number;
        totalSales: number;
        avgRating: number;
        responseRate: string;
    };
    feedback: {
        resolution: number;
        responseTime: number;
        satisfaction: number;
    };
    rating: {
        delivery: number;
        overall: number;
        product: number;
        service: number;
    };
    reviews: {
        negative: number;
        positive: number;
        total: number;
    };
    categories: string[];
}

export class MarketService {
    private static instance: MarketService;
    private readonly db: Firestore;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): MarketService {
        if (!MarketService.instance) {
            MarketService.instance = new MarketService();
        }
        return MarketService.instance;
    }

    public async getBaseData() {
        try {
            const [
                productsSnapshot,
                colorsSnapshot,
                sizesSnapshot,
                colorVariantsSnapshot,
                sizeVariantsSnapshot,
                variantsSnapshot,
                subImagesSnapshot,
            ] = await Promise.all([
                getDocs(collection(db, 'products')),
                getDocs(collection(db, 'colors')),
                getDocs(collection(db, 'sizes')),
                getDocs(collection(db, 'colorVariants')),
                getDocs(collection(db, 'sizeVariants')),
                getDocs(collection(db, 'variants')),
                getDocs(collection(db, 'subImages')),
            ]);

            const products = productsSnapshot.docs.map((doc) => ({
                id: doc.id,
                title: doc.data().title,
                category: doc.data().category,
                shortDescription: doc.data().shortDescription,
                longDescription: doc.data().longDescription,
                thumbnailImage: doc.data().thumbnailImage,
                contactInfo: doc.data().contactInfo || null,
                images: doc.data().images || [],
                status: doc.data().status || 'active',
                createdAt: doc.data().createdAt,
                updatedAt: doc.data().updatedAt,
            })) as Product[];

            const productOwnership = await this.getProductOwnership(
                products.map(p => p.id)
            );

            const colors = colorsSnapshot.docs.map((doc) => ({
                id: doc.id,
                colorName: doc.data().colorName,
                colorCode: doc.data().colorCode,
            })) as Colors[];

            const sizes = sizesSnapshot.docs.map((doc) => ({
                id: doc.id,
                sizeName: doc.data().sizeName,
                sizeCode: doc.data().sizeCode,
            })) as Sizes[];

            const colorVariants = colorVariantsSnapshot.docs.map((doc) => {
                const variantData = doc.data();
                return {
                    id: doc.id,
                    colorVariantName: variantData.colorVariantName,
                    productId: variantData.productId,
                    colorId: variantData.colorId,
                    status: variantData.status || 'active',
                    createdAt: variantData.createdAt,
                    updatedAt: variantData.updatedAt,
                };
            }) as ColorVariants[];

            const sizeVariants = sizeVariantsSnapshot.docs.map((doc) => {
                const variantData = doc.data();
                return {
                    id: doc.id,
                    sizeVariantName: variantData.sizeVariantName,
                    productId: variantData.productId,
                    sizeId: variantData.sizeId,
                    status: variantData.status || 'active',
                    createdAt: variantData.createdAt,
                    updatedAt: variantData.updatedAt,
                };
            }) as SizeVariants[];

            const subImages = subImagesSnapshot.docs.map((doc) => ({
                id: doc.id,
                productId: doc.data().productId,
                imageName: doc.data().imageName,
            }));

            const variants = variantsSnapshot.docs.map((doc) => ({
                id: doc.id,
                productId: doc.data().productId,
                price: doc.data().price,
                quantity: doc.data().quantity || 0,
                colorVariantId: doc.data().colorVariantId,
                sizeVariantId: doc.data().sizeVariantId,
                status: doc.data().status || 'active',
                createdAt: doc.data().createdAt,
                updatedAt: doc.data().updatedAt,
            })) as ProductVariant[];

            const baseData = {
                products,
                categories: Array.from(
                    new Set(products.map((product) => product.category))
                ),
                colors,
                sizes,
                colorVariants,
                sizeVariants,
                variants,
                subImages,
                ownership: productOwnership,
            };

            return { success: true, data: baseData };
        } catch (error) {
            console.error('Market service error:', error);
            throw new Error('Failed to fetch market data');
        }
    }

    public async filterProducts(filters: {
        categories?: string[];
        colors?: string[];
        sizes?: string[];
        priceRange?: [number, number];
        searchTerm?: string;
    }) {
        try {
            const baseData = await this.getBaseData();
            let filteredProducts = [...baseData.data.products];

            // Category filtering
            if (filters.categories?.length) {
                filteredProducts = filteredProducts.filter((product) =>
                    filters.categories?.includes(product.category)
                );
            }

            // Color filtering
            if (filters.colors?.length) {
                console.log('Selected Color Filters:', filters.colors);
                console.log('Color Variants:', baseData.data.colorVariants.map(cv => ({
                    id: cv.id,
                    colorId: cv.colorId,
                    productId: cv.productId
                })));
                
                const productIdsWithColor = baseData.data.colorVariants
                    .filter(cv => filters.colors?.includes(cv.colorId))
                    .map(cv => cv.productId);
                
                console.log('Product IDs with Selected Colors:', productIdsWithColor);
                
                // Further filter to ensure the color variant has available stock
                const productIdsWithAvailableColor = productIdsWithColor.filter(productId => 
                    baseData.data.variants.some(v => 
                        v.productId === productId && 
                        v.colorVariantId && 
                        v.quantity > 0
                    )
                );

                filteredProducts = filteredProducts.filter(product => 
                    productIdsWithAvailableColor.includes(product.id)
                );
                
                console.log('Filtered Products:', filteredProducts.map(p => p.title));
            }

            // Size filtering
            if (filters.sizes?.length) {
                const productIdsWithSize = baseData.data.sizeVariants
                    .filter(sv => filters.sizes?.includes(sv.sizeId))
                    .map(sv => sv.productId);
                
                filteredProducts = filteredProducts.filter(product => 
                    productIdsWithSize.includes(product.id)
                );
            }

            // Price range filtering
            if (filters.priceRange) {
                const [minPrice, maxPrice] = filters.priceRange;
                filteredProducts = filteredProducts.filter((product) => {
                    const productVariants = baseData.data.variants.filter(
                        (v) => v.productId === product.id
                    );
                    return productVariants.some(
                        (v) => v.price >= minPrice && v.price <= maxPrice
                    );
                });
            }

            // Search term filtering
            if (filters.searchTerm) {
                const searchLower = filters.searchTerm.toLowerCase();
                filteredProducts = filteredProducts.filter(
                    (product) =>
                        product.title.toLowerCase().includes(searchLower) ||
                        product.shortDescription.toLowerCase().includes(searchLower) ||
                        product.category.toLowerCase().includes(searchLower)
                );
            }

            return {
                success: true,
                data: {
                    ...baseData.data,
                    products: filteredProducts,
                },
            };
        } catch (error) {
            console.error('Filter service error:', error);
            throw new Error('Failed to filter products');
        }
    }

    private async getProductOwnershipWithBusiness(userId: string) {
        console.log('Fetching business data for userId:', userId);
    
        const businessQuery = query(
            collection(this.db, 'businesses'),
            where('userId', '==', userId)
        );
        const businessSnapshot = await getDocs(businessQuery);
        const businessData = !businessSnapshot.empty ? businessSnapshot.docs[0].data() : null;
        console.log('Raw business data:', businessData);
    
        // Rest of the function remains the same
        let profileImage = null;

        const companyProfileQuery = query(
            collection(this.db, 'profileImageSetAs'),
            where('userId', '==', userId),
            where('setAs', '==', 'companyProfile')
        );
        
        let profileSetAsSnapshot = await getDocs(companyProfileQuery);
        console.log('Company profile snapshot:', profileSetAsSnapshot.docs.map(d => d.data()));
    
        if (profileSetAsSnapshot.empty) {
            const regularProfileQuery = query(
                collection(this.db, 'profileImageSetAs'),
                where('userId', '==', userId),
                where('setAs', '==', 'profile')
            );
            profileSetAsSnapshot = await getDocs(regularProfileQuery);
            console.log('Regular profile snapshot:', profileSetAsSnapshot.docs.map(d => d.data()));
        }
    
        if (!profileSetAsSnapshot.empty) {
            const setAsData = profileSetAsSnapshot.docs[0].data();
            const imageDoc = await getDoc(doc(this.db, 'profileImages', setAsData.profileImageId));
            if (imageDoc.exists()) {
                profileImage = imageDoc.data().imageURL;
                console.log('Found profile image:', profileImage);
            }
        }
    
        const userNameQuery = query(
            collection(this.db, 'users'),
            where(documentId(), '==', userId)
        );
        const userNameSnapshot = await getDocs(userNameQuery);
        const userName = !userNameSnapshot.empty ? userNameSnapshot.docs[0].data().userName : null;

        const businessDetails = {
            name: businessData?.profile?.name || '',
            description: businessData?.profile?.description || '',
            established: businessData?.profile?.established || '',
            location: businessData?.profile?.location || '',
            contact: {
                email: businessData?.profile?.contact?.email || '',
                phone: businessData?.profile?.contact?.phone || '',
                website: businessData?.profile?.contact?.website || ''
            },
            categories: businessData?.categories || []
        };
    
        console.log('Processed business details:', businessDetails);
    
        return {
            businessDetails: {
                name: businessData?.profile?.name || '',
                description: businessData?.profile?.description || '',
                established: businessData?.profile?.established || '',
                location: businessData?.profile?.location || '',
                contact: {
                    email: businessData?.profile?.contact?.email || '',
                    phone: businessData?.profile?.contact?.phone || '',
                    website: businessData?.profile?.contact?.website || ''
                },
                categories: businessData?.categories || []
            },
            businessProfile: businessData?.businessProfile || {
                reviews: { total: 0, positive: 0, negative: 0 },
                feedback: { resolution: 0, satisfaction: 0, responseTime: 0 },
                rating: { product: 0, service: 0, overall: 0, delivery: 0 }
            },
            metrics: businessData?.metrics || {
                totalProducts: 0,
                totalSales: 0,
                avgRating: 0,
                responseRate: '0%'
            },
            profileImage,
            userName
        };
    }
    
    
    private async getProductOwnership(productIds: string[]) {
        const ownershipQuery = query(
            collection(this.db, 'ownership'),
            where('productId', 'in', productIds)
        );
        const ownershipSnapshot = await getDocs(ownershipQuery);
        
        const ownershipData = await Promise.all(
            ownershipSnapshot.docs.map(async (ownershipDoc) => {
                const ownership = ownershipDoc.data();
                
                if (ownership.sellerType === 'business') {
                    const businessInfo = await this.getProductOwnershipWithBusiness(ownership.userId);
                    
                    // Get product-specific reviews
                    const reviewsQuery = query(
                        collection(this.db, 'productReviews'),
                        where('productId', '==', ownership.productId)
                    );
                    const reviewsSnapshot = await getDocs(reviewsQuery);
                    const reviews = reviewsSnapshot.docs.map(doc => doc.data());
    
                    return {
                        id: ownershipDoc.id,
                        userId: ownership.userId,
                        productId: ownership.productId,
                        sellerType: ownership.sellerType,
                        userName: businessInfo.userName,
                        businessDetails: businessInfo.businessDetails,
                        profileImage: businessInfo.profileImage,
                        businessProfile: {
                            rating: {
                                overall: businessInfo.businessProfile.rating.overall || 0,
                                service: businessInfo.businessProfile.rating.service || 0,
                                delivery: businessInfo.businessProfile.rating.delivery || 0,
                                product: businessInfo.businessProfile.rating.product || 0
                            },
                            feedback: {
                                responseTime: businessInfo.businessProfile.feedback.responseTime || 0,
                                satisfaction: businessInfo.businessProfile.feedback.satisfaction || 0,
                                resolution: businessInfo.businessProfile.feedback.resolution || 0
                            },
                            reviews: {
                                total: businessInfo.businessProfile.reviews.total || 0,
                                positive: businessInfo.businessProfile.reviews.positive || 0,
                                negative: businessInfo.businessProfile.reviews.negative || 0
                            }
                        },
                        metrics: businessInfo.metrics,
                        productReviews: reviews
                    };
                }
    
                // For personal accounts, fetch the username separately
                const userNameQuery = query(
                    collection(this.db, 'users'),
                    where(documentId(), '==', ownership.userId)
                );
                const userNameSnapshot = await getDocs(userNameQuery);
                const userName = !userNameSnapshot.empty ? userNameSnapshot.docs[0].data().userName : 'Unknown User';

                // Get user profile image
                let profileImage = null;
                const profileQuery = query(
                    collection(this.db, 'profileImageSetAs'),
                    where('userId', '==', ownership.userId),
                    where('setAs', '==', 'profile')
                );
                const profileSnapshot = await getDocs(profileQuery);
                
                if (!profileSnapshot.empty) {
                    const setAsData = profileSnapshot.docs[0].data();
                    const imageDoc = await getDoc(doc(this.db, 'profileImages', setAsData.profileImageId));
                    if (imageDoc.exists()) {
                        profileImage = imageDoc.data().imageURL;
                    }
                }
    
                return {
                    id: ownershipDoc.id,
                    userId: ownership.userId,
                    productId: ownership.productId,
                    sellerType: ownership.sellerType,
                    userName: userName,
                    businessDetails: null,
                    profileImage: profileImage,
                    businessProfile: null,
                    metrics: null,
                    productReviews: []
                };
            })
        );
    
        return ownershipData;
    }
    
}
