/**
 * Mirrors the website's shared/types/couriers.ts; the server is the courierApi callable. Courier services register,
 * are approved by an administrator, and can then be chosen by sellers and buyers.
 */

/** Towns and regions a courier can cover; matches the pet adoption location list. */
export const COURIER_SERVICE_AREAS = [
  'Port of Spain',
  'San Juan',
  'Diego Martin',
  'Tunapuna',
  'Arima',
  'Sangre Grande',
  'Chaguanas',
  'Couva',
  'San Fernando',
  'Princes Town',
  'Penal',
  'Siparia',
  'Point Fortin',
  'Mayaro',
  'Tobago',
] as const;

export const COURIER_VEHICLES = ['motorcycle', 'car', 'van', 'truck'] as const;
export const COURIER_SPEEDS = ['same_day', 'next_day', 'scheduled'] as const;
export const COURIER_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;

/** How many couriers a seller can list as preferred. */
export const MAX_SELLER_COURIERS = 5;

export type CourierServiceArea = typeof COURIER_SERVICE_AREAS[number];
export type CourierVehicle = typeof COURIER_VEHICLES[number];
export type CourierSpeed = typeof COURIER_SPEEDS[number];
export type CourierStatus = typeof COURIER_STATUSES[number];

export const COURIER_VEHICLE_LABELS: Readonly<Record<CourierVehicle, string>> = {
  motorcycle: 'Motorcycle',
  car: 'Car',
  van: 'Van',
  truck: 'Truck',
};

export const COURIER_SPEED_LABELS: Readonly<Record<CourierSpeed, string>> = {
  same_day: 'Same day',
  next_day: 'Next day',
  scheduled: 'Scheduled',
};

export const COURIER_STATUS_LABELS: Readonly<Record<CourierStatus, string>> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Not approved',
  suspended: 'Suspended',
};

/** What a courier fills in when registering or editing their service. */
export type CourierProfileInput = {
  businessName: string;
  contactName: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  description: string;
  /** Every town in COURIER_SERVICE_AREAS when islandWide is true. */
  serviceAreas: CourierServiceArea[];
  islandWide: boolean;
  vehicles: CourierVehicle[];
  speeds: CourierSpeed[];
  /** Lowest delivery fee in TTD, if the courier wants to show one. */
  startingPrice?: number;
};

/** A registered courier service; the document id is the owner's user id (one courier service per account). */
export type Courier = CourierProfileInput & {
  id: string;
  ownerId: string;
  status: CourierStatus;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
};

/** The couriers a seller prefers for their deliveries (ids of approved couriers, in the seller's order). */
export type SellerCourierPreferences = {
  sellerId: string;
  courierIds: string[];
  updatedAt?: string;
};
