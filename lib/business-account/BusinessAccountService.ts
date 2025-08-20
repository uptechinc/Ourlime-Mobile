import { BusinessProfile } from "@/types/businessTypes";
import { BusinessMetricsService } from "./BusinessMetricsService";
import { BusinessProfileService } from "./BusinessProfileService";
import { ValidationService } from "./ValidationService";

export class BusinessAccountService {
    private static instance: BusinessAccountService;
    private readonly validationService: ValidationService;
    private readonly metricsService: BusinessMetricsService;
    private readonly profileService: BusinessProfileService;

    private constructor() {
        this.validationService = ValidationService.getInstance();
        this.metricsService = BusinessMetricsService.getInstance();
        this.profileService = BusinessProfileService.getInstance();
    }

    public static getInstance(): BusinessAccountService {
        if (!BusinessAccountService.instance) {
            BusinessAccountService.instance = new BusinessAccountService();
        }
        return BusinessAccountService.instance;
    }

    public async getBusinessAccount(userId: string) {
        const profile = await this.profileService.getProfile(userId);
        const metrics = await this.metricsService.getMetrics(userId);

        return {
            profile: {
                name: profile?.profile?.name || "",
                established: profile?.profile?.established || "",
                description: profile?.profile?.description || "",
                location: profile?.profile?.location || "",
                contact: {
                    email: profile?.profile?.contact?.email || "",
                    phone: profile?.profile?.contact?.phone || "",
                    website: profile?.profile?.contact?.website || ""
                }
            },
            metrics: {
                totalProducts: metrics?.totalProducts || 0,
                totalSales: metrics?.totalSales || 0,
                avgRating: metrics?.avgRating || 0,
                responseRate: metrics?.responseRate || "0%"
            },
            feedback: {
                resolution: profile?.feedback?.resolution || 0,
                responseTime: profile?.feedback?.responseTime || 0,
                satisfaction: profile?.feedback?.satisfaction || 0
            },
            rating: {
                delivery: profile?.rating?.delivery || 0,
                overall: profile?.rating?.overall || 0,
                product: profile?.rating?.product || 0,
                service: profile?.rating?.service || 0
            },
            reviews: {
                negative: profile?.reviews?.negative || 0,
                positive: profile?.reviews?.positive || 0,
                total: profile?.reviews?.total || 0
            },
            categories: profile?.categories || []
        };
    }

    public async createBusinessAccount(data: any): Promise<void> {
        // First validate the business email
        const isValidEmail = await this.validationService.validateBusinessEmail(data.contact?.email);
        
        if (!isValidEmail) {
            throw new Error('Invalid business email');
        }
    
        const newProfile: BusinessProfile = {
            userId: data.userId,
            profile: {
                name: data.businessName || '',
                established: data.established || '',
                description: data.description || '',
                location: data.location || '',
                contact: {
                    email: data.contact?.email || '',
                    phone: data.contact?.phone || '',
                    website: data.contact?.website || ''
                }
            },
            metrics: {
                totalProducts: 0,
                totalSales: 0,
                avgRating: 0,
                responseRate: "0%"
            },
            feedback: {
                resolution: 0,
                responseTime: 0,
                satisfaction: 0
            },
            rating: {
                delivery: 0,
                overall: 0,
                product: 0,
                service: 0
            },
            reviews: {
                negative: 0,
                positive: 0,
                total: 0
            },
            categories: data.categories || [],
            status: 'active' as 'active' | 'pending' | 'inactive',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    
        await this.profileService.createProfile(newProfile);
    }
    
    

    public async updateBusinessAccount(userId: string, updates: any) {
        await this.profileService.updateProfile(userId, {
            ...updates,
            updatedAt: new Date()
        });
    }

    public async deleteBusinessAccount(userId: string) {
        await this.profileService.deleteProfile(userId);
    }
}
