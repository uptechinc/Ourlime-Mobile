/** Mirrors the website's shared/types/pets.ts (Market → Pets for Adoption); the server is the petsApi callable. */
export const PET_TYPES = ['Dogs', 'Cats', 'Small pets', 'Other'] as const;
export const PET_SEXES = ['Male', 'Female', 'Unknown'] as const;
export const PET_HEALTH_STATUSES = ['yes', 'no', 'unknown'] as const;
export const PET_ADOPTION_STATUSES = ['available', 'adoption_pending', 'adopted'] as const;
/** Towns and regions a carer picks from when submitting a pet. */
export const PET_LOCATIONS = ['Port of Spain', 'San Juan', 'Diego Martin', 'Tunapuna', 'Arima', 'Sangre Grande', 'Chaguanas', 'Couva', 'San Fernando', 'Princes Town', 'Penal', 'Siparia', 'Point Fortin', 'Mayaro', 'Tobago'] as const;

export type PetType = (typeof PET_TYPES)[number];
export type PetSex = (typeof PET_SEXES)[number];
export type PetHealthStatus = (typeof PET_HEALTH_STATUSES)[number];
export type PetAdoptionStatus = (typeof PET_ADOPTION_STATUSES)[number];
export type PetModerationStatus = 'pending' | 'approved' | 'rejected' | 'removed';
export type PetEnquiryStatus = 'new' | 'reviewing' | 'accepted' | 'declined' | 'withdrawn';
export type PetContactPreference = 'ourlime' | 'email' | 'phone';

export type PetListing = {
  id: string;
  name: string;
  petType: PetType;
  breed?: string;
  age: string;
  sex: PetSex;
  location: string;
  description: string;
  temperament: string;
  vaccinationStatus: PetHealthStatus;
  sterilisationStatus: PetHealthStatus;
  healthNotes?: string;
  adoptionRequirements: string;
  contactPreference: PetContactPreference;
  imageUrls: string[];
  adoptionStatus: PetAdoptionStatus;
  moderationStatus: PetModerationStatus;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  moderatedAt?: string;
  moderationReason?: string;
};

export type CreatePetListingInput = Pick<PetListing,
  'name' | 'petType' | 'breed' | 'age' | 'sex' | 'location' | 'description' | 'temperament'
  | 'vaccinationStatus' | 'sterilisationStatus' | 'healthNotes' | 'adoptionRequirements' | 'contactPreference'
>;

export type CreatePetInterestInput = { name: string; contact: string; message: string };

export type PetEnquiry = CreatePetInterestInput & {
  id: string;
  petId: string;
  petName: string;
  ownerId: string;
  requesterId: string;
  status: PetEnquiryStatus;
  createdAt: string;
  updatedAt?: string;
};

/** A photo picked on the device, before it is resized and sent. */
export type PetPhotoPick = { uri: string; width: number; height: number };
