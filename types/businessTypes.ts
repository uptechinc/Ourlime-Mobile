// types/businessTypes.ts
export interface BusinessProfile {
    userId: string;
    profile: {
        name: string;
        established: string;
        description: string;
        location: string;
        contact: {
            email: string;
            phone: string;
            website?: string;
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
        total: number;
        positive: number;
        negative: number;
    };
    categories: string[];
    status: 'active' | 'inactive' | 'pending';
    createdAt: Date;
    updatedAt: Date;
}

export interface BusinessMetrics {
    totalProducts: number;
    totalSales: number;
    avgRating: number;
    responseRate: string;
    reviews: {
        total: number;
        positive: number;
        negative: number;
    };
}
