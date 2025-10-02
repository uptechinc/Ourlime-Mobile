// lib/services/MarketService.ts

import { db } from '@/lib/firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
	Product,
	Colors,
	Sizes,
	ColorVariants,
	SizeVariants,
	ProductVariant,
} from '@/types/productTypes';

export class MarketService {
	static async getBaseData(): Promise<{
		success: boolean;
		data?: any;
		error?: string;
	}> {
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
				images: doc.data().images || [],
				status: doc.data().status || 'active',
				createdAt: doc.data().createdAt,
				updatedAt: doc.data().updatedAt,
			})) as Product[];

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
					colorId: variantData.colorsId,
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
			};

			return { success: true, data: baseData };
		} catch (error) {
			console.error('Market service error:', error);
			return { success: false, error: 'Failed to fetch market data' };
		}
	}
}

export class MarketFilterService {
	static async filterProducts(filters: {
		categories?: string[];
		colors?: string[];
		sizes?: string[];
		priceRange?: [number, number];
		searchTerm?: string;
	}): Promise<{ success: boolean; data?: any; error?: string }> {
		try {
			const baseData = await MarketService.getBaseData();
			if (!baseData.success || !baseData.data) {
				throw new Error('Failed to get base data');
			}

			let filteredProducts = [...baseData.data.products];

			// Apply category filter
			if (filters.categories?.length) {
				filteredProducts = filteredProducts.filter((product) =>
					filters.categories?.includes(product.category)
				);
			}

			// Apply color filter
			if (filters.colors?.length) {
				filteredProducts = filteredProducts.filter((product) => {
					const hasColor = baseData.data.colorVariants.some((cv) => {
						return (
							cv.productId === product.id &&
							filters.colors?.includes(cv.colorId)
						);
					});
					return hasColor;
				});

			}

			// Apply size filter
			if (filters.sizes?.length) {
				filteredProducts = filteredProducts.filter((product) =>
					baseData.data.sizeVariants.some(
						(sv) =>
							sv.productId === product.id && filters.sizes?.includes(sv.sizeId)
					)
				);
			}

			// Apply price range filter
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

			// Apply search term filter
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
			return { success: false, error: 'Failed to filter products' };
		}
	}
}
