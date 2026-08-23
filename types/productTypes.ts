// types/productTypes.ts
export type ContactInfoItem = {
    type: 'phone' | 'email' | 'website';
    value: string;
};

export type Product = {
    id: string;
    title: string;
    shortDescription: string;
    longDescription: string;
    thumbnailImage: string;
    category: string;
    createdAt: unknown;
    views?: string;
    contactInfo?: ContactInfoItem[];
    images?: string[];
    status?: 'pending' | 'approved' | 'active' | 'rejected';
};

export type Colors = {
    id: string;
    colorName: string;
};

export type Sizes = {
    id: string;
    sizeName: string;
};

export type ColorVariants = {
    id: string;
    colorVariantName: string;
    colorId: string;
    productId: string;
};

export type SizeVariants = {
    id: string;
    sizeVariantName: string;
    sizeId: string;
    productId: string;
};

export type ProductVariant = {
    id: string;
    productId: string;
    colorVariantId: string;
    sizeVariantId: string;
    price: number;
    quantity: number;
    status: 'active' | 'inactive';
};

export type ProductSubImage = {
    id: string;
    productId: string;
    imageName: string;
};

export type ProductOwnership = {
    id: string;
    productId: string;
    userId: string;
    sellerType: 'business' | 'personal';
    profileImage?: string;
    businessDetails?: {
        name?: string;
        description?: string;
        location?: string;
        established?: string;
        contact?: { email?: string; phone?: string; website?: string };
    };
    businessOwner?: { name?: string; email?: string };
    businessProfile?: {
        rating?: { overall?: number; service?: number; delivery?: number; product?: number };
        feedback?: { satisfaction?: number; resolution?: number; responseTime?: number };
        reviews?: { total?: number; positive?: number; negative?: number };
    };
};

export type ProductFormData = {
    title: string;
    category: string;
    shortDescription: string;
    longDescription: string;
    thumbnailImage?: File;
    thumbnailUrl?: string;
    media: File[];
    variants: ProductVariant[];
    colors: ColorVariants[];
    sizes: SizeVariants[];
    newColors: Colors[];
    newSizes: Sizes[];
    selectedBaseColor?: string;
    selectedBaseSize?: string;
    contactInfo?: ContactInfoItem[];
};
