/**
 * Ads marketplace records, mirroring the website's types/adsMarketplaceTypes.ts. The records live in the
 * adsHosts / adsOffers / adsClients / adsBookings / adsProofOfDelivery / adsReviews collections, which are closed to
 * clients; the app reads and writes them through the `adsApi` callable that runs the website's /api/ads routes.
 */

/** A Firestore timestamp as the ads routes return it in JSON. */
export type AdsTimestamp = {
  seconds: number;
  nanoseconds: number;
};

export type HostType = 'business' | 'influencer';
export type HostVerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type HostTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type SocialPlatform = 'instagram' | 'facebook' | 'x' | 'youtube' | 'tiktok';

export type BusinessAddress = {
  street?: string;
  city?: string;
  state?: string;
  country: string;
  postalCode?: string;
};

export type BusinessVerificationDocuments = {
  registrationCertificate?: string;
  taxIdDocument?: string;
  businessEmailVerified: boolean;
  websiteVerified: boolean;
};

export type BusinessHost = {
  hostId: string;
  userId: string;
  hostType: 'business';
  businessName: string;
  businessRegistrationNumber?: string;
  taxId?: string;
  businessEmail: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessAddress?: BusinessAddress;
  verificationStatus: HostVerificationStatus;
  verificationDocuments?: BusinessVerificationDocuments;
  verifiedAt?: AdsTimestamp;
  verifiedBy?: string;
  canHostDigital: boolean;
  canHostSocial: boolean;
  canHostPhysical: boolean;
  totalBookings: number;
  completedBookings: number;
  averageRating: number;
  totalReviews: number;
  tier: HostTier;
  isActive: boolean;
  createdAt: AdsTimestamp;
  updatedAt: AdsTimestamp;
};

export type LinkedSocialAccount = {
  platform: SocialPlatform;
  username: string;
  verified: boolean;
  followerCount?: number;
  averageReach?: number;
};

export type InfluencerHost = {
  hostId: string;
  userId: string;
  hostType: 'influencer';
  verificationStatus: HostVerificationStatus;
  governmentIdVerified: boolean;
  governmentIdDocument?: string;
  linkedSocialAccounts?: LinkedSocialAccount[];
  followerBase: number;
  averageEngagement: number;
  engagementRate: number;
  totalBookings: number;
  completedBookings: number;
  averageRating: number;
  totalReviews: number;
  tier: HostTier;
  isActive: boolean;
  createdAt: AdsTimestamp;
  updatedAt: AdsTimestamp;
};

export type Host = BusinessHost | InfluencerHost;

export type AdDisplayType = 'digital' | 'social' | 'physical';
export type AdOfferStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type SocialPostType = 'post' | 'story' | 'reel' | 'video';
export type PhysicalDisplayKind = 'banner' | 'poster' | 'sign' | 'billboard';
export type AudienceGender = 'male' | 'female' | 'all';
export type PricingModel = 'fixed' | 'per_day' | 'per_week' | 'per_month' | 'per_impression' | 'per_click';

export type AdDisplaySpecs = {
  screenSize?: string;
  digitalLocation?: string;
  websiteUrl?: string;
  appName?: string;
  platform?: SocialPlatform;
  postType?: SocialPostType;
  estimatedReach?: number;
  physicalLocation?: string;
  displaySize?: string;
  displayType?: PhysicalDisplayKind;
};

export type AdAudienceInfo = {
  demographics?: {
    ageRange?: { min: number; max: number };
    gender?: AudienceGender;
    location?: string[];
  };
  interests?: string[];
  estimatedReach: number;
  averageEngagement?: number;
};

export type AdPricing = {
  basePrice: number;
  currency: string;
  pricingModel: PricingModel;
  minimumDuration?: number;
  maximumDuration?: number;
};

export type OperatingHours = {
  [dayOfWeek: string]: { start: string; end: string; isOpen: boolean };
};

export type AdOffer = {
  offerId: string;
  hostId: string;
  userId: string;
  title: string;
  description: string;
  displayType: AdDisplayType;
  displaySpecs: AdDisplaySpecs;
  audienceInfo: AdAudienceInfo;
  pricing: AdPricing;
  availableTimeSlots?: { startDate: AdsTimestamp; endDate: AdsTimestamp; isAvailable: boolean }[];
  operatingHours?: OperatingHours;
  totalInventory?: number;
  bookedInventory?: number;
  availableInventory?: number;
  status: AdOfferStatus;
  isFeatured: boolean;
  category?: string;
  tags?: string[];
  createdAt: AdsTimestamp;
  updatedAt: AdsTimestamp;
};

export type Client = {
  clientId: string;
  userId: string;
  clientName: string;
  clientType: 'business' | 'individual';
  email: string;
  phone?: string;
  website?: string;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpent: number;
  createdAt: AdsTimestamp;
  updatedAt: AdsTimestamp;
};

export type BookingStatus = 'pending_payment' | 'paid' | 'active' | 'completed' | 'cancelled' | 'disputed';
export type BookingPaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export type AdMaterials = {
  images?: string[];
  videos?: string[];
  copy?: string;
  ctaUrl?: string;
};

export type AdBooking = {
  bookingId: string;
  offerId: string;
  hostId: string;
  clientId: string;
  userId: string;
  adMaterials: AdMaterials;
  startDate: AdsTimestamp;
  endDate: AdsTimestamp;
  duration: number;
  agreedPrice: number;
  currency: string;
  ourlimeCommission: number;
  hostPayout: number;
  paymentStatus: BookingPaymentStatus;
  paymentMethod?: string;
  paymentTransactionId?: string;
  paidAt?: AdsTimestamp;
  status: BookingStatus;
  proofOfDelivery?: {
    submitted: boolean;
    submittedAt?: AdsTimestamp;
    proofFiles?: string[];
    verified: boolean;
    verifiedAt?: AdsTimestamp;
    verifiedBy?: string;
  };
  createdAt: AdsTimestamp;
  updatedAt: AdsTimestamp;
};

export type ProofFileType = 'screenshot' | 'photo' | 'analytics_report' | 'video';

/** A proof file the host is about to submit; uploadedAt is an ISO string, as the website's route expects. */
export type ProofFileInput = {
  type: ProofFileType;
  url: string;
  description?: string;
  uploadedAt: string;
};

export type ProofAnalyticsData = {
  impressions?: number;
  clicks?: number;
  reach?: number;
  engagement?: number;
  views?: number;
  platform?: string;
};

export type ReviewRatingBreakdown = {
  communication?: number;
  delivery?: number;
  quality?: number;
  value?: number;
};

/** What a business host registration sends (POST /api/ads/hosts with hostType 'business'). */
export type BusinessHostRegistration = {
  businessName: string;
  businessRegistrationNumber?: string;
  taxId?: string;
  businessEmail: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessAddress: BusinessAddress;
  canHostDigital: boolean;
  canHostSocial: boolean;
  canHostPhysical: boolean;
  verificationDocuments: { registrationCertificate: string; taxIdDocument?: string };
};

/** What an influencer host registration sends (POST /api/ads/hosts with hostType 'influencer'). */
export type InfluencerHostRegistration = {
  followerBase: number;
  averageEngagement: number;
  linkedSocialAccounts: LinkedSocialAccount[];
  governmentIdDocument: string;
};

/** The offer fields the create and edit forms send (POST / PUT /api/ads/offers). */
export type AdOfferInput = {
  title: string;
  description: string;
  displayType?: AdDisplayType;
  displaySpecs: AdDisplaySpecs;
  audienceInfo: AdAudienceInfo;
  pricing: AdPricing;
  category?: string;
  tags?: string[];
  totalInventory: number;
  status?: AdOfferStatus;
  availableTimeSlots?: { startDate: string; endDate: string; isAvailable: boolean }[];
  operatingHours?: OperatingHours;
};

export type AdBookingInput = {
  offerId: string;
  hostId: string;
  clientId: string;
  adMaterials: AdMaterials;
  startDate: string;
  endDate: string;
  agreedPrice: number;
  currency: string;
};

export type AdReviewInput = {
  bookingId: string;
  hostId: string;
  clientId: string;
  reviewedUserId: string;
  rating: number;
  ratingBreakdown?: ReviewRatingBreakdown;
  title?: string;
  comment: string;
};

/** A local file chosen on the phone (image picker or document picker). */
export type AdsPickedFile = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
};
